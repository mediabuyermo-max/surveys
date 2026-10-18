/**
 * كود Google Apps Script لاستقبال ردود الاستبيانات وتخزينها في Google Sheets
 *
 * طريقة التثبيت:
 * 1. افتح جدول بيانات جديد في Google Sheets.
 * 2. من القائمة العلوية: ملحقات (Extensions) > Apps Script.
 * 3. امسح أي كود موجود والصق هذا الكود كاملًا.
 * 4. اكتب المفتاح في السطر الخاص بـ SECRET_KEY تحت (نفس القيمة اللي في SURVEY_KEY جوه survey-handler.js).
 * 5. اضغط "نشر" (Deploy) > "نشر جديد" (New deployment)، نوع النشر: "تطبيق ويب" (Web app).
 * 6. في خانة "من يملك حق الوصول" اختر: "أي مستخدم" (Anyone).
 * 7. انسخ رابط تطبيق الويب. وأي تعديل بعد كده في الكود يحتاج "نشر جديد" عشان يشتغل.
 * 8. دخول لوحة الردود: من شاشة Apps Script اختار «إعدادات المشروع» (Project Settings) > «خصائص السكريبت» (Script Properties)،
 *    وضيف خاصيتين باسمين ثابتين: DASH_USER (اليوزر) و DASH_PASS (الباس، ١٢ حرف على الأقل). القيم تكتبها انت بنفسك هناك، وماتتكتبش في أي ملف.
 *
 * الجدول بيتبني مرة واحدة لكل استبيان، وأي سؤال جديد بيتضاف في آخر الأعمدة.
 * الإجابات في ورقة كل استبيان بـ «رقم الرد» عشوائي من غير اسم ولا رقم.
 * بيانات التواصل في ورقة لوحدها اسمها «التواصل» ومعاها رقم الرد، وبتتبعت بس لو المستجيب وافق.
 * ورقة «الخام» فيها كل رد (من غير بيانات التواصل) بشكل نص منظم، علشان لوحة الردود تقراه.
 */

// ضع هنا المفتاح السري (سطر شرح: بيمنع العبث العادي بس، لأن نسخة منه موجودة في ملف عام).
// لو سيبته فاضي السكريبت هيرفض أي رد.
var SECRET_KEY = "";

var CONTACT_SHEET = "التواصل";
var RAW_SHEET = "الخام";
var MAX_PER_MINUTE = 3; // أكتر من كده من نفس المتصفح في دقيقة بيتتجاهل

// دخول لوحة الردود
var TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // مفتاح الدخول بيعيش ساعتين
var MAX_FAILS = 5; // بعد ٥ محاولات غلط ورا بعض
var LOCK_MS = 15 * 60 * 1000; // الدخول يتقفل ١٥ دقيقة
var FAIL_DELAY_MS = 2000; // كل محاولة غلط تستنى ثانيتين قبل الرد
var MIN_PASS_LENGTH = 12;

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function styleHeader_(sheet, count) {
  var range = sheet.getRange(1, 1, 1, count);
  range.setBackground("#0f7b6c");
  range.setFontColor("#ffffff");
  range.setFontWeight("bold");
  sheet.setFrozenRows(1);
}

// رقم الرد موجود قبل كده؟ (العمود الأول)
function hasResponseId_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return true;
  }
  return false;
}

// يرجّع صف العناوين بعد إضافة أي عناوين جديدة في الآخر
function ensureHeaders_(sheet, wanted) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var added = [];
  wanted.forEach(function (h) {
    if (headers.indexOf(h) === -1 && added.indexOf(h) === -1) added.push(h);
  });
  if (added.length) {
    sheet.getRange(1, headers.length + 1, 1, added.length).setValues([added]);
    headers = headers.concat(added);
    styleHeader_(sheet, headers.length);
  }
  return headers;
}

function getOrCreateSheet_(ss, name, firstHeaders) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, firstHeaders.length).setValues([firstHeaders]);
    styleHeader_(sheet, firstHeaders.length);
  }
  return sheet;
}

function props_() {
  return PropertiesService.getScriptProperties();
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// مقارنة نصوص من غير ما الوقت يفرق لو أول حرف صح
function safeEq_(a, b) {
  a = String(a);
  b = String(b);
  var diff = a.length ^ b.length;
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function readTokens_() {
  try { return JSON.parse(props_().getProperty("DASH_TOKENS") || "{}"); } catch (x) { return {}; }
}

function tokenValid_(token) {
  if (!token) return false;
  var tokens = readTokens_();
  return !!tokens[token] && tokens[token] > Date.now();
}

function handleLogin_(data) {
  var p = props_();
  var user = p.getProperty("DASH_USER");
  var pass = p.getProperty("DASH_PASS");
  if (!user || !pass || pass.length < MIN_PASS_LENGTH) return { result: "error", error: "dash_not_set" };

  var lockedFor = withLock_(function () {
    var until = Number(p.getProperty("LOGIN_LOCK_UNTIL") || 0);
    return until > Date.now() ? Math.ceil((until - Date.now()) / 1000) : 0;
  });
  if (lockedFor) return { result: "locked", retryAfter: lockedFor };

  var okUser = safeEq_(data.user || "", user);
  var okPass = safeEq_(data.pass || "", pass);
  if (!(okUser && okPass)) {
    Utilities.sleep(FAIL_DELAY_MS);
    return withLock_(function () {
      var fails = Number(p.getProperty("LOGIN_FAILS") || 0) + 1;
      if (fails >= MAX_FAILS) {
        p.setProperty("LOGIN_LOCK_UNTIL", String(Date.now() + LOCK_MS));
        fails = 0;
      }
      p.setProperty("LOGIN_FAILS", String(fails));
      return { result: "bad_login" };
    });
  }

  return withLock_(function () {
    p.setProperty("LOGIN_FAILS", "0");
    var now = Date.now();
    var tokens = readTokens_();
    Object.keys(tokens).forEach(function (t) { if (tokens[t] <= now) delete tokens[t]; });
    var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
    tokens[token] = now + TOKEN_TTL_MS;
    p.setProperty("DASH_TOKENS", JSON.stringify(tokens));
    return { result: "success", token: token, expiresInSec: TOKEN_TTL_MS / 1000 };
  });
}

function handleLogout_(data) {
  withLock_(function () {
    var tokens = readTokens_();
    delete tokens[data.token];
    props_().setProperty("DASH_TOKENS", JSON.stringify(tokens));
  });
  return { result: "success" };
}

// الردود الحقيقية من ورقة «الخام»، ومعاها بيانات التواصل لو فيه موافقة مربوطة برقم الرد
function handleRead_(data) {
  if (!tokenValid_(data.token)) return { result: "unauthorized" };
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var contacts = {};
  var cs = ss.getSheetByName(CONTACT_SHEET);
  if (cs && cs.getLastRow() > 1) {
    cs.getRange(2, 1, cs.getLastRow() - 1, 6).getValues().forEach(function (r) {
      var phone = String(r[4] || "");
      if (/^1\d{9}$/.test(phone)) phone = "0" + phone; // الصفر الأول بيضيع لو الجدول حوّله لرقم
      contacts[String(r[0])] = { name: String(r[3] || ""), phone: phone, gov: String(r[5] || "") };
    });
  }

  var responses = [];
  var raw = ss.getSheetByName(RAW_SHEET);
  if (raw && raw.getLastRow() > 1) {
    raw.getRange(2, 1, raw.getLastRow() - 1, 6).getValues().forEach(function (r) {
      var rec;
      try { rec = JSON.parse(String(r[5])); } catch (x) { return; }
      var c = contacts[String(r[0])];
      rec.contact = c
        ? { name: c.name || "غير محدد", phone: c.phone || "غير محدد", gov: c.gov || "غير محدد" }
        : { name: "غير محدد", phone: "غير محدد", gov: "غير محدد" };
      responses.push(rec);
    });
  }
  responses.reverse(); // الأحدث الأول
  return { result: "success", responses: responses };
}

// ورقة «الخام» وورقة «التواصل»: بتتكتب مرة واحدة لكل رقم رد، حتى لو الرد اتبعت تاني
function saveExtras_(ss, data, submittedAt) {
  if (data.record) {
    var rs = getOrCreateSheet_(ss, RAW_SHEET, ["رقم الرد", "الاستبيان", "اسم الملف", "تاريخ ووقت الإرسال", "الوقت", "البيانات"]);
    if (!hasResponseId_(rs, data.responseId)) {
      var rec = {};
      Object.keys(data.record).forEach(function (k) { if (k !== "contact") rec[k] = data.record[k]; });
      rs.appendRow([data.responseId, data.surveyTitle, data.surveyFilename || "", submittedAt, data.timestamp || "", JSON.stringify(rec)]);
    }
  }
  // بيانات التواصل: بس لو اتبعتت (يعني فيه موافقة)
  if (data.contact && (data.contact.name || data.contact.phone || data.contact.gov)) {
    var cs = getOrCreateSheet_(ss, CONTACT_SHEET, ["رقم الرد", "تاريخ ووقت الإرسال", "الاستبيان", "الاسم", "رقم الهاتف", "المحافظة والمنطقة"]);
    if (!hasResponseId_(cs, data.responseId)) {
      cs.getRange(cs.getLastRow() + 1, 5).setNumberFormat("@"); // الرقم يفضل نص ومايضيعش الصفر
      cs.appendRow([data.responseId, submittedAt, data.surveyTitle, data.contact.name || "", data.contact.phone || "", data.contact.gov || ""]);
    }
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var data = JSON.parse(e.postData.contents);

    // لوحة الردود: دخول وخروج وقراية (من غير المفتاح السري، ليها مفتاح دخول لوحدها)
    if (data && data.action === "login") return reply_(handleLogin_(data));
    if (data && data.action === "logout") return reply_(handleLogout_(data));
    if (data && data.action === "read") return reply_(handleRead_(data));

    if (!SECRET_KEY) return reply_({ result: "error", error: "key_not_set" });
    if (!data || data.key !== SECRET_KEY) return reply_({ result: "error", error: "bad_key" });
    if (!data.responseId || !data.surveyTitle || !data.fields) return reply_({ result: "error", error: "bad_payload" });

    lock.waitLock(20000);
    locked = true;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet_(ss, data.surveyTitle, ["رقم الرد", "تاريخ ووقت الإرسال"]);
    if (String(sheet.getRange(1, 1).getValue()) !== "رقم الرد") {
      return reply_({ result: "error", error: "old_sheet_format" });
    }

    // رد مكرر: نقول نجاح من غير ما نكتب في ورقة الاستبيان تاني
    if (hasResponseId_(sheet, data.responseId)) {
      saveExtras_(ss, data, data.submittedAt || "");
      return reply_({ result: "success", duplicate: true });
    }

    // حد الدقيقة لكل متصفح
    var cache = CacheService.getScriptCache();
    var rateKey = "rate_" + String(data.clientId || "none");
    var count = Number(cache.get(rateKey) || 0);
    if (count >= MAX_PER_MINUTE) return reply_({ result: "rate_limited" });
    cache.put(rateKey, String(count + 1), 60);

    var wanted = data.fields.map(function (f) { return f.header; });
    var headers = ensureHeaders_(sheet, wanted);
    var row = headers.map(function () { return ""; });
    row[0] = data.responseId;
    row[1] = data.submittedAt || new Date().toLocaleString("ar-EG");
    data.fields.forEach(function (f) {
      row[headers.indexOf(f.header)] = f.value === null || f.value === undefined ? "" : f.value;
    });
    sheet.appendRow(row);

    saveExtras_(ss, data, row[1]);

    return reply_({ result: "success" });
  } catch (error) {
    return reply_({ result: "error", error: error.toString() });
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (x) {} }
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Webhook الاستبيانات يعمل بنجاح! جاهز لاستقبال بيانات POST.").setMimeType(ContentService.MimeType.TEXT);
}
