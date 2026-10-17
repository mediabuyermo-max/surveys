/**
 * كود Google Apps Script لاستقبال ردود الاستبيانات وتخزينها تلقائيًا في Google Sheets
 * 
 * طريقة التثبيت في دقيقتين:
 * 1. افتح جدول بيانات جديد في Google Sheets (شيتس).
 * 2. من القائمة العلوية اضغط على: ملحقات (Extensions) > Apps Script.
 * 3. امسح أي كود موجود والصق هذا الكود كاملًا.
 * 4. اضغط على زر "نشر" (Deploy) > "نشر جديد" (New deployment).
 * 5. اختر نوع النشر: "تطبيق ويب" (Web app).
 * 6. في خانة "من يملك حق الوصول" (Who has access)، اختر: "أي مستخدم" (Anyone).
 * 7. اضغط "نشر" (Deploy) وانسخ رابط تطبيق الويب (Web App URL).
 * 8. الصق هذا الرابط في صفحة "dashboard.html".
 */

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = data.surveyTitle || "الاستبيانات";
    var sheet = ss.getSheetByName(sheetName);
    
    // إذا لم تكن هناك صفحة بهذا الاسم، يتم إنشاؤها وتجهيز العناوين
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      
      var headers = ["تاريخ ووقت الإرسال", "الاسم", "رقم الهاتف", "المحافظة"];
      
      if (data.answers && data.answers.length > 0) {
        data.answers.forEach(function(a) {
          headers.push(a.question || a.id);
        });
      }
      
      sheet.appendRow(headers);
      
      // تنسيق شريط العناوين
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#0f7b6c");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    
    // تجهيز صف الإجابات
    var row = [
      data.submittedAt || new Date().toLocaleString("ar-EG"),
      (data.contact && data.contact.name) ? data.contact.name : "غير محدد",
      (data.contact && data.contact.phone) ? data.contact.phone : "غير محدد",
      (data.contact && data.contact.gov) ? data.contact.gov : "غير محدد"
    ];
    
    if (data.answers && data.answers.length > 0) {
      data.answers.forEach(function(a) {
        var ansText = "";
        if (a.answer === null || a.answer === undefined) {
          ansText = "—";
        } else if (Array.isArray(a.answer)) {
          if (a.type === "matrix") {
            // تنسيق إجابات المصفوفة
            ansText = a.answer.map(function(item) {
              return (item.item || "") + ": " + (item.score || "—");
            }).join(" | ");
          } else {
            // خيارات متعددة
            ansText = a.answer.join("، ");
          }
        } else if (typeof a.answer === "object") {
          // حقول مخصصة
          ansText = Object.keys(a.answer).map(function(k) {
            return k + ": " + a.answer[k];
          }).join(" | ");
        } else {
          ansText = String(a.answer);
        }
        
        row.push(ansText);
      });
    }
    
    sheet.appendRow(row);
    
    return ContentService.createTextOutput(JSON.stringify({
      result: "success",
      message: "تم حفظ الرد بنجاح"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error",
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Webhook الاستبيانات يعمل بنجاح! جاهز لاستقبال بيانات POST.").setMimeType(ContentService.MimeType.TEXT);
}
