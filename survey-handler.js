// ملف معالجة وتجميع وإرسال بيانات الاستبيانات
// يتصل بـ Google Sheets / Webhook ويحفظ نسخة احتياطية محلية تلقائيًا

const DEFAULT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyT6ppK5VINcGdvy-vj5gQHTZ3DKB3CtPAKetH09FNWWi5YRDNHBT3XMkxHQelQ7JbE/exec"; 

function getWebhookUrl() {
  return localStorage.getItem("SURVEY_WEBHOOK_URL") || DEFAULT_WEBHOOK_URL;
}

function collectSurveyData() {
  const visibleCards = [...document.querySelectorAll(".card.q")].filter(c => {
    const cond = c.closest(".cond");
    return !cond || cond.classList.contains("show");
  });

  const answers = [];
  const contact = {};

  visibleCards.forEach((card) => {
    const qId = card.id ? card.id.replace("q-", "") : "";
    const qTitle = card.querySelector(".q-title span:last-child")?.textContent?.trim() || "";
    
    // Matrix rows
    const rows = card.querySelectorAll(".row");
    if (rows.length > 0) {
      const matrixAnswers = [];
      rows.forEach(r => {
        const rowText = r.querySelector(".row-text")?.textContent?.trim() || "";
        const checked = r.querySelector("input:checked");
        const val = checked ? checked.value : null;
        matrixAnswers.push({ item: rowText, score: val });
      });
      answers.push({ id: qId, question: qTitle, type: "matrix", answer: matrixAnswers });
      return;
    }

    // Contact fields
    const fields = card.querySelectorAll(".field");
    if (fields.length > 0) {
      const fieldAnswers = {};
      fields.forEach(f => {
        const label = f.querySelector("label")?.textContent?.trim() || "";
        const input = f.querySelector("input");
        const val = input ? input.value.trim() : "";
        fieldAnswers[label] = val;
        if (label.includes("اسم")) contact.name = val;
        if (label.includes("موبايل") || label.includes("واتساب") || label.includes("رقم")) contact.phone = val;
        if (label.includes("محافظة")) contact.gov = val;
      });
      answers.push({ id: qId, question: qTitle, type: "fields", answer: fieldAnswers });
      return;
    }

    // Multi checkboxes
    const checkboxes = [...card.querySelectorAll("input[type=checkbox]:checked")];
    if (checkboxes.length > 0) {
      const selected = checkboxes.map(c => c.value);
      const otherInput = card.querySelector(".other-in");
      if (otherInput && otherInput.value.trim() && !otherInput.hidden) {
        selected.push("أخرى: " + otherInput.value.trim());
      }
      answers.push({ id: qId, question: qTitle, type: "multi", answer: selected });
      return;
    }

    // Single radio
    const radio = card.querySelector("input[type=radio]:checked");
    if (radio) {
      let val = radio.value;
      const otherInput = card.querySelector(".other-in");
      if (otherInput && otherInput.value.trim() && !otherInput.hidden) {
        val = otherInput.value.trim();
      }
      answers.push({ id: qId, question: qTitle, type: "single", answer: val });
      return;
    }

    // Open textarea or text input
    const textEl = card.querySelector("textarea, input[type=text]");
    if (textEl && textEl.value.trim()) {
      answers.push({ id: qId, question: qTitle, type: "open", answer: textEl.value.trim() });
      return;
    }

    // Unanswered
    answers.push({ id: qId, question: qTitle, type: "unanswered", answer: null });
  });

  const filename = decodeURIComponent(location.pathname.split("/").pop() || "استبيان");

  return {
    id: "sub_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    surveyTitle: document.title || "استبيان",
    surveyFilename: filename,
    submittedAt: new Date().toLocaleString("ar-EG"),
    timestamp: new Date().toISOString(),
    contact: {
      name: contact.name || "غير محدد",
      phone: contact.phone || "غير محدد",
      gov: contact.gov || "غير محدد"
    },
    answers
  };
}

function saveLocalSubmission(payload) {
  try {
    const list = JSON.parse(localStorage.getItem("SURVEY_SUBMISSIONS") || "[]");
    list.unshift(payload);
    localStorage.setItem("SURVEY_SUBMISSIONS", JSON.stringify(list));
  } catch (err) {
    console.error("Local save error:", err);
  }
}

async function handleSurveySubmit() {
  const submitBtn = document.getElementById("submitBtn");
  const submitStatus = document.getElementById("submitStatus");
  const submitWrap = document.getElementById("submitWrap");
  const thanksBox = document.getElementById("thanksBox");

  const data = collectSurveyData();

  // حفظ نسخة احتياطية فورية في المتصفح
  saveLocalSubmission(data);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "جاري الإرسال…";
  }
  if (submitStatus) {
    submitStatus.textContent = "جاري إرسال البيانات…";
    submitStatus.classList.remove("error");
  }

  const webhookUrl = getWebhookUrl();

  if (webhookUrl && webhookUrl.startsWith("http")) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors",
        cache: "no-cache",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(data)
      });
      if (submitStatus) submitStatus.textContent = "تم إرسال الاستبيان بنجاح!";
    } catch (error) {
      console.warn("Webhook fetch notice (saved locally):", error);
      if (submitStatus) submitStatus.textContent = "تم حفظ الرد محليًا بنجاح.";
    }
  } else {
    if (submitStatus) submitStatus.textContent = "تم حفظ الرد في لوحة التحكم بنجاح!";
  }

  setTimeout(() => {
    if (submitWrap) submitWrap.hidden = true;
    if (thanksBox) {
      thanksBox.hidden = false;
      thanksBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 400);
}

function initSubmit() {
  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) {
    submitBtn.onclick = handleSurveySubmit;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSubmit);
} else {
  initSubmit();
}
