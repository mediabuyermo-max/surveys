// node build.cjs <piece.cjs> <out.html>  — template = doctor survey page
const fs = require("fs");
const path = require("path");
const dir = path.resolve(__dirname, "..");
const tpl = fs.readFileSync(path.join(dir, "استبيان-الدكاترة.html"), "utf8");
const p = require(path.resolve(process.argv[2]));
const cut = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i); if (i < 0 || j < 0) throw new Error("anchor " + a); return [i, j]; };
let out = tpl.replace(/<title>[^<]*<\/title>/, `<title>${p.title}</title>`);
let [i, j] = cut(out, '  <header class="hero">', '  <section class="card how"');
out = out.slice(0, i) + p.hero.trim() + "\n\n" + out.slice(j);
[i, j] = cut(out, '  <section class="card thanks"', '  <p class="draft">');
out = out.slice(0, i) + p.thanks.trim() + "\n\n" + out.slice(j);
out = out.replace(/<p class="draft">[^<]*<\/p>/, `<p class="draft">${p.draft}</p>`);
// optional per-page overrides for the rating scale (used by the user survey)
if (p.levels) out = out.replace(/const LEVELS = \[[^\]]*\];/, () => "const LEVELS = " + JSON.stringify(p.levels) + ";");
if (p.howTitle) out = out.replace(/<p class="how-title">[^<]*<\/p>/, () => `<p class="how-title">${p.howTitle}</p>`);
if (p.howArrow) out = out.replace(/<div class="how-arrow">[\s\S]*?<\/div>/, () => `<div class="how-arrow"><span>${p.howArrow[0]}</span><span>${p.howArrow[1]}</span></div>`);
[i, j] = cut(out, "const SECTIONS = [", "const ORD = ");
out = out.slice(0, i) + "const SECTIONS = " + JSON.stringify(p.sections, null, 2) + ";\n\n" + out.slice(j);
fs.writeFileSync(path.join(dir, process.argv[3]), out);
console.log("wrote", process.argv[3], out.length);
