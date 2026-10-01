// Статья «Какие документы запросить у контрагента — по сумме сделки» (Ночные 01.10 15:05, п. 181).
// Держит: таблица и признаки = js/lestnica.js (один источник правды), тексты юристов дословно, без обещаний исхода,
// FAQ виден на странице, расчёт в статье считает то же, что Паспорт. Запуск: node --test tests/lestnica_statya.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const { sobrat, STATYA } = require('./sobrat_lestnicu.js');
const L = require('../js/lestnica.js');
const S = fs.readFileSync(STATYA, 'utf8');
const T = S.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/‑/g, '-').replace(/\s+/g, ' ');
const U = '/nalogi/dokumenty-kontragenta-po-summe-sdelki/';

test('блоки лестницы собраны из js/lestnica.js (иначе: node tests/sobrat_lestnicu.js)', () => {
  assert.strictEqual(sobrat(S), S);
});

test('все пункты четырёх ступеней и шесть признаков — в тексте статьи', () => {
  const norm = t => t.replace(/‑/g, '-').replace(/ /g, ' ');
  for (const s of L.STUPENI.filter(Boolean)) for (const x of s.sdelat) assert.ok(T.includes(norm(x.t)), x.t);
  for (const p of L.PRIZNAKI) assert.ok(T.includes(p[1]), p[1]);
  assert.strictEqual((S.match(/name="pr"/g) || []).length, 6, 'шесть галочек в расчёте');
});

test('тексты юристов дословно: оговорка, наличные (5348-У), паспорт подписанта (п. 176), 5 лет', () => {
  assert.ok(T.includes('Порогов в рублях закон не устанавливает — границы ступеней предложил Делоскоп'));
  assert.ok(T.includes('п. 4 Указания Банка России от 09.12.2019 № 5348-У'));
  assert.ok(!/3073-У/.test(T), 'старое указание 3073-У');
  assert.ok(T.includes('Копию паспорта подписанта не запрашивайте: полномочия видны в выписке ЕГРЮЛ или в доверенности. Копия паспорта — лишние персональные данные, которые вам придётся хранить и защищать.'));
  assert.ok(T.includes('Не меньше 5 лет — таков срок хранения документов для налогов (подп. 8 п. 1 ст. 23 НК)'));
  assert.ok(T.includes('Он не доказывает, что работу выполнил именно он'), 'честная оговорка о реальном исполнителе');
});

test('без обещаний исхода и запретных ярлыков', () => {
  assert.ok(!/гарантир|суд примет|защитит от|однодневк|прокладк|неблагонад/i.test(T));
});

test('SEO: canonical, FAQPage = видимые вопросы, крошки, citation только consultant', () => {
  assert.ok(S.includes(`<link rel="canonical" href="https://deloskop.ru${U}">`));
  const ld = JSON.parse(S.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const faq = ld.find(x => x['@type'] === 'FAQPage');
  assert.strictEqual(faq.mainEntity.length, (S.match(/<details>/g) || []).length);
  assert.ok(faq.mainEntity.length >= 5);
  assert.ok(ld.find(x => x['@type'] === 'BreadcrumbList'));
  for (const c of ld.find(x => x['@type'] === 'Article').citation) assert.match(c, /^https:\/\/www\.consultant\.ru\/document\//);
});

test('страница связана: sitemap, хаб /nalogi/, чек-лист, лента', () => {
  assert.ok(fs.readFileSync(path.join(KOREN, 'sitemap.xml'), 'utf8').includes('https://deloskop.ru' + U));
  assert.ok(fs.readFileSync(path.join(KOREN, 'nalogi/index.html'), 'utf8').includes(`href="${U}"`));
  assert.ok(fs.readFileSync(path.join(KOREN, 'nalogi/proverka-kontragenta-pered-dogovorom/index.html'), 'utf8').includes(`href="${U}"`));
  const ob = JSON.parse(fs.readFileSync(path.join(KOREN, 'obnovleniya.json'), 'utf8')).obnovleniya;
  assert.ok(ob.some(o => (o.chto_proverit || []).some(c => c.ssylka === U)));
});

test('расчёт в статье: подключены lestnica.js и lestnica-statya.js, пример из ленты даёт ступень 3', () => {
  assert.ok(S.indexOf('/js/lestnica.js') < S.indexOf('/js/lestnica-statya.js'));
  assert.strictEqual(L.stupen({ summa: '500 000', priznaki: ['pervaya'] }).n, 3);
  assert.strictEqual(L.stupen({ summa: 300000 }).n, 2, 'FAQ: 300 000 ₽ без признаков — ступень 2');
  assert.strictEqual(L.stupen({ summa: 300000, priznaki: ['pervaya', 'predoplata'] }).n, 3, 'FAQ: два признака — ступень 3 (справка КНД 1120101)');
  assert.strictEqual(L.stupen({ summa: 8e6, zakupki: 2e9 }).n, 2, 'FAQ: 8 млн при миллиардных закупках — вторая ступень');
  const js = fs.readFileSync(path.join(KOREN, 'js/lestnica-statya.js'), 'utf8');
  assert.ok(!/localStorage|sessionStorage|fetch\(|XMLHttpRequest/.test(js), 'расчёт без сети и хранилищ');
  assert.ok(js.includes("dlkGoal('lestnica_iz_stati'"));
});
