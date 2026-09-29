// /pasport/ — «Паспорт компании» в двух ролях (п. 148; тексты [Маркетинга] 29.09, решения Планёрки 29.09 15:05).
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'pasport', 'index.html'), 'utf8');
const bez = (t) => t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&laquo;|&raquo;/g, '').trim();

test('мета: title ≤ 70, description ≤ 160, canonical', () => {
  const t = html.match(/<title>([^<]+)<\/title>/)[1];
  const d = html.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.ok(t.length <= 70, t.length);
  assert.ok(d.length <= 160, d.length);
  assert.ok(/^Паспорт компании/.test(t));
  assert.ok(html.includes('<link rel="canonical" href="https://deloskop.ru/pasport/">'));
});

test('две роли: первая — «Проверяю контрагента», якоря #kontragent и #svoya', () => {
  const i1 = html.indexOf('Проверяю контрагента'), i2 = html.indexOf('Показываю свою компанию');
  assert.ok(i1 > 0 && i2 > i1);
  assert.ok(/id="kontragent"/.test(html) && /id="svoya"/.test(html));
  assert.ok(/id="askTop" data-rol="kontragent"/.test(html), 'верхнее поле собирает Паспорт контрагента');
  assert.ok(/id="askSvoya" data-rol="svoya"/.test(html));
  assert.ok(html.includes("'/pasport/kontragent/?id='"), 'после проверки — сразу Паспорт v2');
});

test('JSON-LD: WebPage, BreadcrumbList, FAQPage = видимые вопросы', () => {
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const tipy = ld.map((x) => x['@type']);
  assert.deepStrictEqual(tipy.sort(), ['BreadcrumbList', 'FAQPage', 'WebPage']);
  const faq = ld.find((x) => x['@type'] === 'FAQPage').mainEntity.map((q) => q.name);
  const vidno = [...html.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => bez(m[1]));
  assert.strictEqual(faq.length, 8);
  assert.deepStrictEqual(faq, vidno);
  assert.ok(!tipy.includes('Product'), 'Product/aggregateRating не ставим — отзывов нет');
});

test('без старого имени, без сравнения с чужими продуктами, без обещаний', () => {
  const t = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  for (const re of [/добросовестност/i, /сертификат(ов|ами|ы)\b/i, /class="cmp"/, /Платные свидетельства/i,
    /проверено — чисто/i, /долгов нет/i, /(?<!не )гарантир(уем|ует) (исход|результат)/i, /вместо десят/i, /Паспорт ИП\b/]) {
    assert.ok(!re.test(t), 'нашлось: ' + re);
  }
  assert.ok(t.includes('Чего Паспорт не делает'));
  assert.ok(t.includes('Паспорт индивидуального предпринимателя пока не выпускаем'));
});

test('ИП: 12 цифр — не собираем Паспорт, даём обычную проверку', () => {
  assert.ok(/if\(v\.length===12\)\{tell\('Паспорт индивидуального предпринимателя пока не выпускаем/.test(html));
  assert.ok(html.includes("a.href='/?inn='+v"));
});

test('знак для сайта — новое имя', () => {
  const z = fs.readFileSync(path.join(__dirname, '..', 'pasport', 'znak.svg'), 'utf8');
  assert.ok(z.includes('>Паспорт компании</text>') && !/добросовест/.test(z));
});
