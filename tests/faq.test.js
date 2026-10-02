// «Частые вопросы» и FAQPage: (1) блоки статей собраны из partials/faq.json, ответы — дословно из статьи;
// (2) на ЛЮБОЙ странице с FAQPage каждый вопрос и ответ разметки виден читателю (Яндекс и Google требуют совпадения).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

test('sobrat_faq.py --check: собрано, ответы дословно из статей', () => {
  execFileSync('python3', [path.join(__dirname, 'sobrat_faq.py'), '--check'], { stdio: 'pipe' });
});

function pages(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['tests', 'partials', 'node_modules', '.git', 'сайт'].includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) pages(p, out);
    else if (f.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const norm = s => s.replace(/<\/?(a|b|strong|em|i|span|small|abbr|nobr)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&#8209;/g, '-').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/ /g, ' ').replace(/‑/g, '-')
  .replace(/\s+/g, ' ').trim();

for (const p of pages(ROOT)) {
  const s = fs.readFileSync(p, 'utf8');
  if (!s.includes('"FAQPage"')) continue;
  const rel = path.relative(ROOT, p);
  test(`FAQPage = видимые вопросы: ${rel}`, () => {
    const vidno = norm(s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' '));
    let faq = null;
    for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let ld = JSON.parse(m[1]);
      for (const o of (Array.isArray(ld) ? ld : [ld])) if (o['@type'] === 'FAQPage') faq = o;
    }
    assert.ok(faq && Array.isArray(faq.mainEntity) && faq.mainEntity.length, 'FAQPage без вопросов');
    for (const q of faq.mainEntity) {
      assert.ok(vidno.includes(norm(q.name)), `вопроса нет на странице: ${q.name}`);
      assert.ok(vidno.includes(norm(q.acceptedAnswer.text)), `ответа нет на странице: ${q.acceptedAnswer.text.slice(0, 80)}`);
    }
  });
}

// Калькуляторы без <article>: блок встаёт сразу после единственной метки <!--faq-mesto-->, до «Читайте также» и формы ИНН.
test('метка <!--faq-mesto-->: одна на странице, блок сразу после неё', () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'partials', 'faq.json'), 'utf8')).stranicy;
  let n = 0;
  for (const rel of Object.keys(data)) {
    const s = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (s.includes('</article>')) continue;
    n++;
    assert.strictEqual(s.split('<!--faq-mesto-->').length, 2, `${rel}: меток должно быть ровно одна`);
    assert.ok(/<!--faq-mesto-->\s*<!--faq-->/.test(s), `${rel}: блок не сразу после метки`);
    const faq = s.indexOf('<!--faq-->');
    const dalee = [s.indexOf('Читайте также'), s.indexOf('aria-label="Проверка компании"')].filter(i => i > -1);
    assert.ok(dalee.every(i => i > faq), `${rel}: «Частые вопросы» должны стоять до «Читайте также» и формы ИНН`);
  }
  assert.ok(n >= 2, 'ожидались калькуляторы без <article>');
});
