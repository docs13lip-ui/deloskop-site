// SEO-метаданные: title ≤ 70, description ≤ 160 у индексируемых страниц; FAQPage только при видимом блоке вопросов.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
function pages(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['tests', 'partials', 'node_modules', '.git'].includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) pages(p, out);
    else if (f.name.endsWith('.html') && !/^(yandex_|google)/.test(f.name)) out.push(p);
  }
  return out;
}
const un = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&nbsp;/g, ' ');
for (const p of pages(ROOT)) {
  const rel = path.relative(ROOT, p);
  const s = fs.readFileSync(p, 'utf8');
  const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/.test(s);
  test(`SEO-мета: ${rel}`, () => {
    const t = (s.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    assert.ok(t, 'нет <title>');
    if (noindex) return;
    assert.ok(un(t.trim()).length <= 70, `title ${un(t.trim()).length} > 70: ${t}`);
    const d = (s.match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1];
    assert.ok(d, 'нет description');
    assert.ok(un(d).length <= 160, `description ${un(d).length} > 160`);
    if (s.includes('"FAQPage"')) assert.ok(/<details|Частые вопросы/.test(s), 'FAQPage без видимого блока вопросов');
  });
}
