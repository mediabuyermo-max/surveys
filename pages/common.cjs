const PICK5 = "يمكن اختيار حتى ٥ إجابات";
const LOGO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0 1 12 6.5 5.2 5.2 0 0 1 21.3 12C19 16.6 12 21 12 21z"/><path d="M8 12h2.5l1.5-2.5 2 5 1.5-2.5H17"/></svg>`;
const LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;
const AR = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

const PRIVACY_FORMAL = "تُستخدم إجاباتك لتطوير المنصة فقط، وتُعامل بسرية تامة وتُحلَّل مجمّعةً، ولن تُشارك مع أي جهة خارج فريقنا، وذلك وفق قانون حماية البيانات الشخصية رقم ١٥١ لسنة ٢٠٢٠. وبيانات التواصل (إن تركتها) تُحفظ بشكل منفصل عن إجاباتك، ولا نستخدمها إلا بموافقتك الصريحة.";
const WHY_END_FORMAL = "وسيساعدنا رأيك في تحديد ما نبدأ به، وما نؤجله، وما لا حاجة إليه.";

function hero({ count, greeting, about, why, privacy, who, ivExtra, minutes = "من ٦ إلى ٧ دقائق", gift = true, whyTail = "لا نريد أن نبني المنصة وفق تصوراتنا فقط، بل وفق الاحتياجات الفعلية لأصحاب المهنة.", h1 = "رأي حضرتك يصنع الفرق", whyHead = "لماذا نسأل حضرتك؟", whyEnd = WHY_END_FORMAL, privacyLead = PRIVACY_FORMAL }) {
  return `
  <header class="hero">
    <span class="brand">
      ${LOGO}
      صحة وعافية
    </span>
    <h1>${h1}</h1>
    <ul class="meta">
      <li>${minutes}</li>
      <li>${AR(count)} سؤالًا</li>
      <li>الاسم اختياري</li>
    </ul>
  </header>

  <section class="card intro">
    <p>${greeting}</p>
    <p>${about}</p>
    <p><b>${whyHead}</b> ${why} ${whyTail} ${whyEnd}</p>
    ${gift === true ? '<div class="gift">🎁 عند إكمال الاستبيان وترك رقمك في النهاية، <b>سيصلك كود شهر مجاني</b> عند إطلاق المنصة.</div>' : gift || ""}
    <div class="privacy">
      ${LOCK}
      <span>${privacyLead} ${privacy}</span>
    </div>
    <div class="iv iv-guide">
      <b>لمن يُجري المقابلة</b>
      <ul>
        <li>هدفنا الاستماع لا البيع. اترك ${who} يتحدث، ولا تقاطعه.</li>
        <li>إذا سأل عن السعر أو موعد الإطلاق: «لم نحدد بعد، ورأي حضرتك سيساعدنا في تحديده». لا تذكر أي رقم أو تاريخ.</li>
        <li>إذا سأل عن ميزة ما زالت فكرة، وضّح بصراحة أنها قيد الدراسة، وأن رأيه سيؤثر في قرار تنفيذها.</li>
        <li>${ivExtra}</li>
        <li>الصناديق البنفسجية أسئلة إضافية للمقابلة فقط، ولا تظهر لمن يملأ الاستبيان بنفسه.</li>
      </ul>
    </div>
  </section>`;
}

const thanks = (name) => `
  <section class="card thanks" id="thanksBox" hidden>
    <h2>شكرًا جزيلًا${name ? " " + name : ""} 🌿</h2>
    <p>رأي حضرتك سيُحدث فرقًا حقيقيًا فيما نبنيه.</p>
  </section>`;

const existingLead = { title: "مزايا جاهزة في المنصة", tag: ["now", "جاهزة"], lead: "هذه المزايا تم بناؤها بالفعل، وستكون متاحة عند إطلاق المنصة. والمزايا المميزة بعلامة «تعمل عند الإطلاق» في مرحلة التجهيز الأخيرة. ورأي حضرتك يساعدنا في ترتيب الأولويات." };
const ready = (text) => ({ text, ready: true });
const PUBLIC_PAGE = "صفحة عامة باسمك تظهر في البحث وفي جوجل، وشارة «موثّق» بعد مراجعة ترخيصك";
const NEARBY = "ظهورك للعملاء القريبين منك بالبحث بالموقع";
const ideasLead = { title: "أفكار نفكر فيها", tag: ["idea", "فكرة"], lead: "هذه الأفكار غير متاحة بعد، وما زلنا ندرس تنفيذها. ورأي حضرتك سيساعدنا في اتخاذ القرار." };
const existingQ = (rows, text = "ما مدى فائدة كل ميزة منها في عملك؟") => ({ id: "existing", type: "matrix", text, rows,
  interview: "«أيٌّ منها لو رأيته يعمل أمامك سيشجعك على تجربة المنصة؟»" });
const ideasQ = (rows, text = "إذا تم تنفيذها، ما مدى فائدتها في عملك؟") => ({ id: "ideas", type: "matrix", text, rows });
const pains = (options) => ({ id: "pains", type: "multi", max: 5, text: "ما أكثر الأمور التي تعطّل عملك اليومي أو تسبب لك إزعاجًا؟", hint: PICK5,
  options, other: "أمر آخر", interview: "«هل تتذكر آخر مرة حدث فيها ذلك؟ وكيف تصرفت حضرتك؟»" });
const apps = (place) => ({ id: "apps", type: "open", text: `هل تستخدم أي برنامج أو تطبيق في ${place}؟`, hint: "اذكر اسمه، وما يعجبك فيه، وما لا يعجبك" });

function pricing({ ranges, perWhat, join, leave }) {
  return {
    title: "الاشتراك والأسعار",
    lead: "ستتضمن المنصة باقة مجانية، وباقات مدفوعة بمزايا إضافية. لم نحدد الأسعار بعد، ورأي حضرتك سيساعدنا في تحديدها.",
    questions: [
      { id: "price", type: "single", text: "إذا وفّرت لك المنصة وقتًا فعليًا أو جلبت لك عملاء جددًا، فما المبلغ الشهري المناسب في رأيك؟",
        options: ["لن أدفع، سأكتفي بالباقة المجانية", ...ranges] },
      { id: "paymodel", type: "single", text: "ما طريقة الدفع التي تفضلها؟",
        options: ["اشتراك شهري ثابت", "اشتراك سنوي بخصم", `مبلغ بسيط عن كل ${perWhat} يأتي من المنصة، دون اشتراك`, "غير متأكد"] },
      { id: "join", type: "multi", max: 5, text: "ما الذي قد يشجعك على الاشتراك في باقة مدفوعة؟", hint: PICK5, options: [...join, "تجربة مجانية في البداية"], other: "سبب آخر" },
      { id: "leave", type: "multi", max: 5, text: "ما الذي قد يمنعك من الاشتراك في المنصة أو الاستمرار فيها؟", hint: PICK5,
        options: ["سعر مرتفع مقارنة بما يقدمه", "صعوبة الاستخدام أو استهلاك الوقت", "عدم جلب عملاء جدد", "ضعف الدعم الفني أو تأخر الرد", ...leave, "التقييمات والتعليقات السلبية"], other: "سبب آخر" },
    ],
  };
}

const CONSENT = { id: "consent", type: "multi", optional: true, text: "موافقة على التواصل وحفظ البيانات", hint: "اختياري، ولا يؤثر على قبول إجاباتك",
  options: ["أوافق على أن يتواصل معي فريق «صحة وعافية» بخصوص المنصة فقط، وعلى حفظ بيانات التواصل لهذا الغرض وفق قانون حماية البيانات الشخصية رقم ١٥١ لسنة ٢٠٢٠، ولي الحق في طلب حذفها في أي وقت"] };

function tail(fields) {
  return [
    { title: "كلمة أخيرة", questions: [
      { id: "wish", type: "open", text: "لو أمكنك طلب ميزة واحدة فقط من المنصة، فما هي؟" },
      { id: "extra", type: "open", optional: true, text: "هل هناك ما تود إضافته، أو أمر مهم لم نسأل عنه؟", hint: "اختياري" },
    ] },
    { title: "كن شريكًا معنا", questions: [
      { id: "partner", type: "single", text: "هل تحب أن تشاركنا في بناء المنصة؟",
        options: ["نعم، أرغب في تجربتها قبل إطلاقها وإبداء رأيي", "أبلغوني عند إطلاقها", "ليس الآن، شكرًا"] },
      { id: "contact", type: "fields", optional: true, text: "إذا رغبت في أن نتواصل معك، أو في الحصول على كود الشهر المجاني:", hint: "اختياري",
        fields, note: "سيُستخدم رقمك للتواصل معك بخصوص المنصة فقط، ولن يُشارك مع أي جهة، ولن تصلك منه رسائل إعلانية." },
      { id: "consent", type: "multi", optional: true, text: "موافقة على التواصل وحفظ البيانات", hint: "اختياري، ولا يؤثر على قبول إجاباتك",
        options: ["أوافق على أن يتواصل معي فريق «صحة وعافية» بخصوص المنصة فقط، وعلى حفظ بيانات التواصل لهذا الغرض وفق قانون حماية البيانات الشخصية رقم ١٥١ لسنة ٢٠٢٠، ولي الحق في طلب حذفها في أي وقت"] },
    ] },
  ];
}

const count = (sections) => sections.filter((s) => !s.showIf).reduce((a, s) => a + s.questions.length, 0);

module.exports = { CONSENT, ready, PUBLIC_PAGE, NEARBY, PICK5, hero, thanks, existingLead, ideasLead, existingQ, ideasQ, pains, apps, pricing, tail, count };
