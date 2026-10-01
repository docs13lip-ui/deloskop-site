// Статья «Письмо о смене реквизитов» (текст [Продукт · Маркетинг] 01.10, только абзацы, согласованные [Право]).
// Запуск: node --test tests/pismo_smena.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const A = '/nalogi/pismo-o-smene-rekvizitov-kak-proverit/';
const chit = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const S = chit('nalogi/pismo-o-smene-rekvizitov-kak-proverit/index.html');
const T = S.replace(/&nbsp;/g, ' ').replace(/ /g, ' ');

test('мета, canonical и разметка Article + FAQPage + BreadcrumbList', () => {
  assert.match(S, /<link rel="canonical" href="https:\/\/deloskop\.ru\/nalogi\/pismo-o-smene-rekvizitov-kak-proverit\/">/);
  const ld = JSON.parse(S.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepStrictEqual(ld.map((x) => x['@type']), ['Article', 'FAQPage', 'BreadcrumbList']);
  const vidimye = (S.match(/<details><summary>/g) || []).length;
  assert.strictEqual(ld[1].mainEntity.length, vidimye, 'FAQPage = видимые вопросы');
  assert.strictEqual((S.match(/<h1>/g) || []).length, 1);
});

test('главное: звонок по известному номеру, 5 проверок, кнопка в «Сравнить реквизиты»', () => {
  assert.ok(T.includes('по номеру, который знали раньше'));
  assert.strictEqual((S.match(/<ol class="pyat">([\s\S]*?)<\/ol>/)[1].match(/<li>/g) || []).length, 5);
  assert.ok(S.includes('href="/proverit-schet/#smena"'));
  assert.ok(T.includes('40702') && T.includes('40802') && T.includes('40817'));
  assert.ok(T.includes('п. 1 ст. 385 ГК'));
});

test('без обещаний исхода и без абзацев, ждущих сверки [Право]', () => {
  assert.ok(!/гарантированно вернём|вернуть деньги можно всегда|вернём деньги/i.test(T));
  assert.ok(T.includes('Гарантий нет'));
  // ◐ до «да» юриста: ст. 312 ГК, ст. 5 161-ФЗ, дело ВС, заявление в полицию, пункт в договор
  assert.ok(!/ст\. 312|161-ФЗ|304-ЭС23-9987|полици|Об изменении банковских реквизитов Сторона/.test(T), 'абзац ◐ попал на сайт до сверки');
  assert.ok(!/искусственн|нейросет|\bИИ\b/.test(T));
});

test('Клерк в источниках — только как пересказ; первоисточники — ГК и 809-П', () => {
  const src = T.match(/<section class="src">([\s\S]*?)<\/section>/)[1];
  assert.ok(/klerk\.ru[^<]*<\/a>|Клерк[^<]*пересказ, не первоисточник/.test(src) && src.includes('пересказ, не первоисточник'));
  assert.ok(src.includes('cons_doc_LAW_5142') && src.includes('cons_doc_LAW_436264'));
});

test('перелинковка: статья о счёте, «Проверь счёт», хаб, sitemap, лента', () => {
  assert.ok(chit('nalogi/kak-proverit-schet-pered-oplatoj/index.html').includes('href="' + A + '"'));
  const ps = chit('proverit-schet/index.html');
  const smena = ps.slice(ps.indexOf('id="smena"'), ps.indexOf('</section>', ps.indexOf('id="smena"')));
  assert.ok(smena.includes('href="' + A + '"'), 'ссылка в #smena');
  assert.ok(chit('nalogi/index.html').includes('href="' + A + '"'));
  assert.ok(chit('sitemap.xml').includes('<loc>https://deloskop.ru' + A + '</loc>'));
  const l = JSON.parse(chit('obnovleniya.json')).obnovleniya;
  const z = l.find((x) => x.id === '2026-10-01-13');
  assert.ok(z && z.chto_proverit.some((c) => c.ssylka === A));
  assert.strictEqual(l.filter((x) => x.id === '2026-10-01-13').length, 1);
});
