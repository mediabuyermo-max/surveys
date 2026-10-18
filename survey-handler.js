// ملف معالجة وتجميع وإرسال بيانات الاستبيانات
// يرسل الرد لجدول جوجل ويتأكد من الرد قبل ما يقول للمستخدم «تم الإرسال».
// لو الإرسال فشل، الرد يفضل محفوظ في المتصفح ويتبعت تاني من غير ما يتكرر.

const DEFAULT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyT6ppK5VINcGdvy-vj5gQHTZ3DKB3CtPAKetH09FNWWi5YRDNHBT3XMkxHQelQ7JbE/exec";

// مفتاح الإرسال: لازم يكون نفس القيمة اللي في SECRET_KEY جوه سكريبت الجدول.
// اتركه فاضي لحد ما صاحب المشروع يكتب المفتاح (التفاصيل في README.md).
const SURVEY_KEY = "";

const PENDING_KEY = "SURVEY_PENDING";
const RATE_KEY = "SURVEY_SENT_TIMES";
const CLIENT_KEY = "SURVEY_CLIENT_ID";

function getWebhookUrl() {
  return localStorage.getItem("SURVEY_WEBHOOK_URL") || DEFAULT_WEBHOOK_URL;
}

function randomId(prefix, len) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return prefix + [...bytes].map(b => (b % 36).toString(36)).join("");
}

function getClientId() {
  let id = localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id = randomId("c_", 12);
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}

function cardIsShown(card) {
  const cond = card.closest(".cond");
  return !cond || cond.classList.contains("show");
}

// يقرا كل الأسئلة بترتيبها الثابت في الصفحة، اللي ما ظهرتش بتبقى hidden وإجابتها فاضية
function readCards() {
  const cards = [];
  document.querySelectorAll(".card.q").forEach((card) => {
    const qId = card.id ? card.id.replace("q-", "") : "";
    const qTitle = card.querySelector(".q-title span:last-child")?.textContent?.trim() || "";
    const hidden = !cardIsShown(card);
    const base = { id: qId, question: qTitle, hidden };

    const rows = card.querySelectorAll(".row");
    if (rows.length > 0) {
      const matrix = [];
      rows.forEach(r => {
        const rowText = r.querySelector(".row-text")?.textContent?.trim() || "";
        const checked = r.querySelector("input:checked");
        matrix.push({ item: rowText, score: checked ? Number(checked.value) : null });
      });
      cards.push({ ...base, type: "matrix", answer: matrix });
      return;
    }

    const fields = card.querySelectorAll(".field");
    if (fields.length > 0) {
      const values = {};
      fields.forEach(f => {
        const label = f.querySelector("label")?.textContent?.trim() || "";
        values[label] = f.querySelector("input")?.value.trim() || "";
      });
      cards.push({ ...base, type: "fields", answer: values });
      return;
    }

    const checkboxes = [...card.querySelectorAll("input[type=checkbox]:checked")];
    if (checkboxes.length > 0) {
      const selected = checkboxes.map(c => c.value);
      const otherInput = card.querySelector(".other-in");
      if (otherInput && otherInput.value.trim() && !otherInput.hidden) {
        selected.push("أخرى: " + otherInput.value.trim());
      }
      cards.push({ ...base, type: "multi", answer: selected });
      return;
    }

    const radio = card.querySelector("input[type=radio]:checked");
    if (radio) {
      let val = radio.value;
      const otherInput = card.querySelector(".other-in");
      if (otherInput && otherInput.value.trim() && !otherInput.hidden) {
        val = otherInput.value.trim();
      }
      cards.push({ ...base, type: "single", answer: val });
      return;
    }

    const textEl = card.querySelector("textarea, input[type=text]");
    if (textEl && textEl.value.trim()) {
      cards.push({ ...base, type: "open", answer: textEl.value.trim() });
      return;
    }

    cards.push({ ...base, type: "unanswered", answer: null });
  });
  return cards;
}

// بيانات التواصل: بتتجمع بس لو خانة الموافقة معلّمة وفيه بيانات مكتوبة
function readContact(cards) {
  const consent = cards.find(c => c.id === "consent");
  const agreed = !!(consent && Array.isArray(consent.answer) && consent.answer.length > 0);
  const empty = { agreed, name: "", phone: "", gov: "" };
  if (!agreed) return empty;
  const fieldsCard = cards.find(c => c.type === "fields");
  if (!fieldsCard) return empty;
  const contact = { ...empty };
  Object.entries(fieldsCard.answer).forEach(([label, val]) => {
    if (label.includes("اسم")) contact.name = val;
    else if (label.includes("موبايل") || label.includes("واتساب") || label.includes("رقم")) contact.phone = val;
    else if (label.includes("محافظة")) contact.gov = val;
  });
  return contact;
}

// يحوّل الأسئلة لقائمة أعمدة ثابتة: عمود لكل سؤال، وعمود لكل بند في المصفوفة (رقم من ١ لـ ٥)
function flattenFields(cards) {
  const out = [];
  const used = new Set();
  const uniq = (h, id) => {
    let name = h;
    if (used.has(name)) name = h + " (" + id + ")";
    used.add(name);
    return name;
  };
  cards.forEach((c) => {
    if (c.type === "fields" || c.id === "consent") return; // التواصل والموافقة مش جزء من الإجابات
    if (c.type === "matrix") {
      c.answer.forEach((m, i) => {
        const header = uniq(c.question + " — " + (i + 1) + ". " + m.item.slice(0, 40), c.id + "-" + i);
        out.push({ key: c.id + "-" + i, header, value: c.hidden || m.score === null ? "" : m.score });
      });
      return;
    }
    let value = "";
    if (!c.hidden && c.answer !== null && c.answer !== undefined) {
      value = Array.isArray(c.answer) ? c.answer.join("، ") : String(c.answer);
    }
    out.push({ key: c.id, header: uniq(c.question || c.id, c.id), value });
  });
  return out;
}

// الشكل اللي بيتحفظ محليًا ويقراه لوحة الردود (من غير الأسئلة اللي ما ظهرتش)
function toLocalRecord(responseId, payload, cards, contact) {
  return {
    id: responseId,
    surveyTitle: payload.surveyTitle,
    surveyFilename: payload.surveyFilename,
    submittedAt: payload.submittedAt,
    timestamp: payload.timestamp,
    contact: contact.agreed
      ? { name: contact.name || "غير محدد", phone: contact.phone || "غير محدد", gov: contact.gov || "غير محدد" }
      : { name: "غير محدد", phone: "غير محدد", gov: "غير محدد" },
    answers: cards
      .filter(c => !c.hidden && c.type !== "fields")
      .map(c => ({ id: c.id, question: c.question, type: c.type, answer: c.answer }))
  };
}

function collectSurveyData() {
  const cards = readCards();
  const contact = readContact(cards);
  const responseId = randomId("r_", 10);
  const filename = decodeURIComponent(location.pathname.split("/").pop() || "استبيان");
  const now = new Date();

  const payload = {
    key: SURVEY_KEY,
    clientId: getClientId(),
    responseId,
    surveyTitle: document.title || "استبيان",
    surveyFilename: filename,
    submittedAt: now.toLocaleString("ar-EG"),
    timestamp: now.toISOString(),
    fields: flattenFields(cards)
  };
  // بيانات التواصل تتضاف بس مع الموافقة، ولو مفيش بيانات مكتوبة ما بتتضافش
  if (contact.agreed && (contact.name || contact.phone || contact.gov)) {
    payload.contact = { name: contact.name, phone: contact.phone, gov: contact.gov };
  }
  const local = toLocalRecord(responseId, payload, cards, contact);
  // نسخة من الرد من غير بيانات التواصل، علشان لوحة الردود تقراها من ورقة «الخام»
  payload.record = { ...local, contact: undefined };
  return { payload, local };
}

function readList(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}

function saveLocalSubmission(record) {
  try {
    const list = readList("SURVEY_SUBMISSIONS").filter(r => r.id !== record.id);
    list.unshift(record);
    localStorage.setItem("SURVEY_SUBMISSIONS", JSON.stringify(list));
  } catch (err) {
    console.error("Local save error:", err);
  }
}

function addPending(payload) {
  const list = readList(PENDING_KEY).filter(p => p.responseId !== payload.responseId);
  list.push(payload);
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
}

function removePending(responseId) {
  const list = readList(PENDING_KEY).filter(p => p.responseId !== responseId);
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
}

// أكتر من ٣ ردود في الدقيقة من نفس المتصفح: بنوقف الإرسال ونقول يستنى
function tooManyRecently(payload) {
  const now = Date.now();
  const times = readList(RATE_KEY).filter(t => now - t.at < 60000);
  const fresh = times.filter(t => t.id !== payload.responseId);
  return fresh.length >= 3;
}

function markSent(payload) {
  const now = Date.now();
  const times = readList(RATE_KEY).filter(t => now - t.at < 60000 && t.id !== payload.responseId);
  times.push({ id: payload.responseId, at: now });
  localStorage.setItem(RATE_KEY, JSON.stringify(times));
}

// يرجّع: "ok" | "rate" | "fail"
async function sendPayload(payload) {
  const url = getWebhookUrl();
  if (!url || !url.startsWith("http")) return "fail";
  if (tooManyRecently(payload)) return "rate";
  markSent(payload);
  try {
    const res = await fetch(url, {
      method: "POST",
      cache: "no-cache",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) return "fail";
    const reply = await res.json();
    if (reply && reply.result === "success") return "ok";
    if (reply && reply.result === "rate_limited") return "rate";
    return "fail";
  } catch (error) {
    console.warn("Survey send failed (kept in browser):", error);
    return "fail";
  }
}

// محاولة هادية لإرسال ردود محفوظة من زيارة سابقة
async function flushPending() {
  for (const p of readList(PENDING_KEY)) {
    if (await sendPayload(p) === "ok") removePending(p.responseId);
  }
}

const MSG_CONSENT = "علّم الموافقة علشان نقدر نتواصل معاك، أو امسح بياناتك لو مش حابب";

// لو كتب اسم أو رقم أو محافظة ومعلّمش الموافقة: نمنع الإرسال
function contactNeedsConsent() {
  const cards = readCards();
  const consent = cards.find(c => c.id === "consent");
  const agreed = !!(consent && Array.isArray(consent.answer) && consent.answer.length > 0);
  if (agreed) return false;
  const fieldsCard = cards.find(c => c.type === "fields");
  if (!fieldsCard) return false;
  return Object.values(fieldsCard.answer).some(v => String(v).trim());
}

const MSG_FAIL = "الرد اتحفظ عندك ولسه ما وصلناش، جرّب تاني";
const MSG_RATE = "الرد اتحفظ عندك. فيه ردود كتير اتبعتت من الجهاز ده في دقيقة، استنى شوية وجرّب تاني";

let currentPending = null;

async function handleSurveySubmit() {
  const submitBtn = document.getElementById("submitBtn");
  const submitStatus = document.getElementById("submitStatus");
  const submitWrap = document.getElementById("submitWrap");
  const thanksBox = document.getElementById("thanksBox");

  // بيانات تواصل من غير موافقة: ما نبعتش ولا نحفظ حاجة
  if (!currentPending && contactNeedsConsent()) {
    if (submitStatus) {
      submitStatus.textContent = MSG_CONSENT;
      submitStatus.classList.add("error");
    }
    document.getElementById("q-consent")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  // لو دي إعادة محاولة نبعت نفس الرد بنفس رقمه، فمفيش تكرار
  if (!currentPending) {
    const { payload, local } = collectSurveyData();
    currentPending = payload;
    saveLocalSubmission(local);
    addPending(payload);
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "جاري الإرسال…";
  }
  if (submitStatus) {
    submitStatus.textContent = "جاري إرسال البيانات…";
    submitStatus.classList.remove("error");
  }

  const result = await sendPayload(currentPending);

  if (result === "ok") {
    removePending(currentPending.responseId);
    currentPending = null;
    if (submitStatus) submitStatus.textContent = "تم إرسال الاستبيان بنجاح!";
    setTimeout(() => {
      if (submitWrap) submitWrap.hidden = true;
      if (thanksBox) {
        thanksBox.hidden = false;
        thanksBox.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 400);
    return;
  }

  if (submitStatus) {
    submitStatus.textContent = result === "rate" ? MSG_RATE : MSG_FAIL;
    submitStatus.classList.add("error");
  }
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "إعادة المحاولة";
  }
}

function initSubmit() {
  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) {
    submitBtn.onclick = handleSurveySubmit;
  }
  flushPending();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSubmit);
} else {
  initSubmit();
}
