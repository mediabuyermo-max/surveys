// node check.cjs — فحص سريع للصفحات: الوقت، عدد الأسئلة، سلامة الجافاسكربت، وجود سؤال الموافقة
const fs = require("fs");
const dir = "D:/web/medical1/test-reports/provider-surveys/";
const out = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".html"))) {
  const t = fs.readFileSync(dir + f, "utf8");
  const script = t.match(/<script>([\s\S]*)<\/script>/)[1].split("const form = ")[0];
  let js = "ok";
  try { new Function(script); } catch (e) { js = e.message; }
  const lis = [...t.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]).slice(0, 2).join(" | ");
  const consent = /["']?id["']?:\s*"consent"/.test(t);
  const old = /خدمات متاحة حاليًا|أهمية كل خدمة|لترك أي منصة/.test(t);
  out.push(`${f}: ${lis} | js:${js} | consent:${consent} | oldWording:${old}`);
}
fs.writeFileSync(dir + "pages/check-result.txt", out.join("\n"), "utf8");
console.log(out.join("\n"));
