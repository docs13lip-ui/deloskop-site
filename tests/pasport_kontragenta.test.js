// Паспорт контрагента v2 (Г2): правила солидности из эталона [Данных] 29.09, разд. 4 — node --test tests/pasport_kontragenta.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const U = require(path.join(ROOT, 'js', 'usloviya.js'));
const IV = require(path.join(ROOT, 'js', 'indeks-vorota.js'));
const E = require(path.join(ROOT, 'pasport', 'engine.js'));

function demo(extra) {
  const r = JSON.parse(JSON.stringify(E.DEMO));
  r.checked_at = '2026-09-29T10:14:00+03:00';
  return Object.assign(r, extra || {});
}
const opt = (o) => Object.assign({ usloviya: U, indeksVorota: IV }, o || {});

test('17 разделов эталона по порядку, у каждого источник', () => {
  const p = P.sobrat(demo(), opt());
  assert.strictEqual(p.razdely.length, 17);
  p.razdely.forEach((x, i) => { assert.strictEqual(x.n, i + 1); assert.ok(x.istochnik, x.title); });
  assert.deepStrictEqual(P.proverit(p), []);
});

test('раздел со сведениями — с источником и датой; «не проверяли» — всегда с причиной', () => {
  const p = P.sobrat(demo(), opt());
  p.razdely.forEach((x) => {
    if (x.status === 'found' || x.status === 'not_found') { assert.ok(x.istochnik && x.data_svedeniy, x.title); }
    if (x.status === 'not_checked') { assert.ok(x.prichina.length > 20, x.title); assert.strictEqual(x.fakty.length, 0, x.title); }
  });
});

test('раздел 16 «Чего мы не знаем» не бывает пустым — даже когда проверено всё', () => {
  const full = demo({ damia: {
    sudy: { status: 'not_found', itog: 'Незавершённых дел не найдено', istochnik: 'картотека арбитражных дел', data_svedeniy: '2026-09-29' },
    bankrotstvo: { status: 'not_found', itog: 'Дел о банкротстве не найдено', istochnik: 'картотека арбитражных дел', data_svedeniy: '2026-09-29' },
    fssp: { status: 'not_found', itog: 'Действующих производств не найдено', istochnik: 'ФССП', data_svedeniy: '2026-09-29' },
    rnp: { status: 'not_found', itog: 'В РНП не найдено', istochnik: 'ЕИС', data_svedeniy: '2026-09-29' },
    priostanovki: { status: 'not_checked', prichina: 'Нужен БИК банка.' }
  } });
  const p = P.sobrat(full, opt());
  const nz = p.razdely.find((x) => x.id === 'ne_znaem');
  assert.ok(nz.fakty.length >= P.VSEGDA_NE_ZNAEM.length);
  P.VSEGDA_NE_ZNAEM.forEach((t) => assert.ok(nz.fakty.some((f) => f.tekst === t)));
  const sudy = p.razdely.find((x) => x.id === 'sudy');
  assert.strictEqual(sudy.status, 'not_found');
  assert.strictEqual(sudy.data_svedeniy, '2026-09-29');
  assert.strictEqual(p.razdely.find((x) => x.id === 'scheta').prichina, 'Нужен БИК банка.');
});

test('«не найдено» без даты сведений не бывает — такой ответ остаётся «не проверяли»', () => {
  const p = P.sobrat(demo({ damia: { fssp: { status: 'not_found', itog: 'Не найдено', istochnik: 'ФССП' } } }), opt());
  assert.strictEqual(p.razdely.find((x) => x.id === 'pristavy').status, 'not_checked');
});

test('«на кону» — только с формулой и суммой; без суммы — пусто', () => {
  const p1 = P.sobrat(demo(), opt({ summa: 1000000 }));
  assert.ok(p1.itog.na_konu && p1.itog.na_konu.formula && p1.itog.na_konu.rub > 0);
  assert.strictEqual(P.sobrat(demo(), opt()).itog.na_konu, null);
  const bez = P.sobrat(demo(), opt({ summa: 1000000 })); bez.itog.na_konu.formula = '';
  assert.ok(P.proverit(bez).some((e) => /формул/.test(e)));
  const usn = P.sobrat(demo(), opt({ summa: 1000000, rezhim: 'usn_d' }));
  assert.strictEqual(usn.itog.na_konu.rub, 0);
});

test('ИП (12 цифр или kind INDIVIDUAL) — Паспорт не выпускаем, ни одного раздела с данными', () => {
  const r = demo(); r.company.inn = '500100732259'; r.company.kind = 'INDIVIDUAL';
  const p = P.sobrat(r, opt());
  assert.strictEqual(p.ip, true);
  assert.strictEqual(p.razdely.length, 0);
  assert.ok(/не выпускаем/.test(p.tekst));
});

test('флаг persons=false — ни одного ФИО в Паспорте (PERSONS_PUBLIC, п. 92)', () => {
  const r = demo(); r.signals.push({ title: 'Руководитель', status: 'info', detail: 'Примеров Иван Петрович с 2021 года', source: 'ЕГРЮЛ' });
  const txt = JSON.stringify(P.sobrat(r, opt({ persons: false })));
  assert.ok(!/Примеров/.test(txt));
  assert.ok(/Примеров/.test(JSON.stringify(P.sobrat(r, opt()))));
});

test('отпечаток SHA-256 воспроизводится и меняется при изменении сведений', async () => {
  const a = await P.otpechatok(P.sobrat(demo(), opt()));
  const b = await P.otpechatok(P.sobrat(demo(), opt()));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.strictEqual(a, b);
  const r = demo(); r.signals[0].detail = '15 человек за 2025 год';
  assert.notStrictEqual(await P.otpechatok(P.sobrat(r, opt())), a);
  assert.strictEqual(P.kanon({ b: 1, a: [2, { d: 3, c: 4 }] }), P.kanon({ a: [2, { c: 4, d: 3 }], b: 1 }));
});

test('признаки — в свои разделы; «Дисквалифицированные» не попадают в суды', () => {
  assert.strictEqual(P.razdelDlya('Дисквалифицированные руководители'), 'lyudi');
  assert.strictEqual(P.razdelDlya('Недостоверность адреса или руководителя'), 'rekvizity');
  assert.strictEqual(P.razdelDlya('Исполнительные производства'), 'pristavy');
  assert.strictEqual(P.razdelDlya('Решение о приостановлении операций'), 'scheta');
  assert.strictEqual(P.razdelDlya('Дело о банкротстве'), 'sudy');
  assert.strictEqual(P.razdelDlya('В реестре недобросовестных поставщиков'), 'goszakaz');
  assert.strictEqual(P.razdelDlya('Долги по налогам'), 'nalogi');
  assert.strictEqual(P.razdelDlya('Среднесписочная численность'), 'finansy');
  assert.strictEqual(P.razdelDlya('Массовый адрес'), 'svyazi');
});

test('Индекс — только за воротами полноты: без ворот числа нет, есть «считаем»', () => {
  const p = P.sobrat(demo({ indeks: 72, polnota: 40 }), opt());
  const ix = p.razdely.find((x) => x.id === 'indeks');
  assert.strictEqual(ix.status, 'not_checked'); assert.ok(/собрано 40%/.test(ix.prichina));
  assert.strictEqual(p.meta.indeks.ball, null);
  const p2 = P.sobrat(demo({ indeks: 72, polnota: 78 }), opt());
  assert.strictEqual(p2.meta.indeks.ball, 72);
});

test('готовый ответ сервера по контракту берётся как есть', () => {
  const gotov = { meta: { nomer: 'X' }, itog: {}, razdely: [] };
  assert.strictEqual(P.sobrat(gotov, opt()), gotov);
});

test('страница: noindex, не в sitemap, запрещённых формулировок нет, из досье есть кнопка', () => {
  const html = fs.readFileSync(path.join(ROOT, 'pasport', 'kontragent', 'index.html'), 'utf8');
  assert.ok(/<meta name="robots" content="noindex">/.test(html));
  assert.ok(!/pasport\/kontragent/.test(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8')));
  const js = fs.readFileSync(path.join(ROOT, 'js', 'pasport-kontragenta.js'), 'utf8').split('\n').filter((l) => !/ZAPRET =/.test(l)).join('\n') + html;
  ['долгов нет', 'рисков нет', 'не банкрот', 'не судится', 'компания надёжна'].forEach((w) => assert.ok(!js.includes(w), w));
  assert.ok(/@bottom-right\{content:"стр\. " counter\(page\) " из " counter\(pages\)/.test(html), 'нумерация страниц в печати');
  const rep = fs.readFileSync(path.join(ROOT, 'report.html'), 'utf8');
  assert.ok(/\/pasport\/kontragent\/\?id=/.test(rep));
});

// ---- п. 145 (Планёрка 29.09 15:05): правовая и визуальная приёмка Паспорта v2 ----
const PAGE = () => fs.readFileSync(path.join(ROOT, 'pasport', 'kontragent', 'index.html'), 'utf8');

test('п. 145 (д): номер Паспорта — из даты и отпечатка, без ИНН и без номера досье', async () => {
  const r = demo(); r.id = 'AbCdEf123456';
  const p = P.sobrat(r, opt());
  assert.strictEqual(p.meta.nomer, null);
  const h = await P.vypustit(p);
  assert.match(p.meta.nomer, /^П-\d{8}-[0-9A-F]{8}$/);
  assert.ok(!p.meta.nomer.includes(r.company.inn) && !p.meta.nomer.includes(r.id));
  assert.strictEqual(p.meta.nomer.slice(11), h.slice(0, 8).toUpperCase());
  const n17 = p.razdely.find((x) => x.id === 'podlinnost').fakty.find((f) => f.tekst === 'Номер Паспорта');
  assert.strictEqual(n17.znachenie, p.meta.nomer);
  // отпечаток не зависит от номера: тот же Паспорт → тот же номер
  const p2 = P.sobrat(demo(), opt()); await P.vypustit(p2);
  assert.strictEqual(p2.meta.nomer, p.meta.nomer);
  assert.ok(!/nomer:\s*id/.test(PAGE()), 'страница не должна отдавать номер досье как номер Паспорта');
});

test('п. 145 (а): QR ведёт на открытую проверку подлинности, а не на Паспорт и не на /api/report', async () => {
  const p = P.sobrat(demo(), opt()); const h = await P.vypustit(p);
  const q = P.qrSsylka(p, h, 'https://deloskop.ru');
  assert.ok(q.startsWith('https://deloskop.ru/pasport/proverka/?n='));
  assert.ok(!/[?&]id=|api\/report|kontragent/.test(q), q);
  assert.ok(q.includes('&h=' + h.slice(0, 16)) && !q.includes(h.slice(16)), 'в QR — только начало отпечатка');
  const pv = fs.readFileSync(path.join(ROOT, 'pasport', 'proverka', 'index.html'), 'utf8');
  assert.ok(/<meta name="robots" content="noindex">/.test(pv));
  assert.ok(!/api\.deloskop\.ru|\/api\//.test(pv), 'страница проверки не обращается к API — открыта всем');
  assert.ok(/inn\.length!==10/.test(pv), 'ИНН ИП на странице проверки не показываем');
  assert.ok(/не защищает от подделки/.test(pv), 'честно о пределах проверки');
});

test('п. 145 (д): бесплатный уровень — разделы «Про» без сведений, не печатаются и не в отпечатке', () => {
  const r = demo(); r.signals.push({ title: 'Среднесписочная численность', status: 'info', detail: '77 человек', source: 'ФНС', as_of: '2026-08-01' });
  const polnyj = P.sobrat(r, opt());
  assert.ok(JSON.stringify(polnyj).includes('77 человек'));
  const p = P.sobrat(r, opt({ dostup: 'free' }));
  const pro = p.razdely.filter((x) => P.RAZDELY[x.n - 1].dostup === 'pro');
  assert.ok(pro.length >= 4);
  pro.forEach((x) => { assert.strictEqual(x.status, 'locked', x.title); assert.strictEqual(x.fakty.length, 0, x.title); });
  assert.ok(!JSON.stringify(p).includes('77 человек'), 'сведения закрытого раздела утекли');
  assert.deepStrictEqual(P.proverit(p), []);
  const nz = p.razdely.find((x) => x.id === 'ne_znaem');
  assert.ok(!nz.fakty.some((f) => /Финансы и штат/.test(f.tekst)), 'закрытый ≠ «не проверяли»');
  assert.ok(/rz'\+\(x\.status==='locked'\?' noprint'/.test(PAGE()), 'закрытый раздел не печатается');
});

test('п. 145 (б, в): значки ● ◆ ○; подвал и определение Индекса — дословно Юриста; слов «печать», «заверено», «официальный» нет', () => {
  const html = PAGE();
  assert.ok(html.includes("'m-ras','◆'") && !html.includes('◐'), '◆ вместо ◐');
  const pv = P.podval('29.09.2026 в 10:14 МСК', 'П-20260929-1A2B3C4D');
  ['а не заключение о надёжности или платёжеспособности компании и не гарантия исхода сделки',
   'Если данных нет, мы пишем «не проверяли», а не «не нашли».', 'по номеру П-20260929-1A2B3C4D'].forEach((s) => assert.ok(pv.includes(s), s));
  assert.ok(/P\.podval\(/.test(html), 'подвал страницы — из P.podval');
  assert.match(P.OPREDELENIE_INDEKSA, /^Индекс Делоскопа — оценка признаков риска для сделки .* Это не кредитный рейтинг и не мнение о способности компании исполнять финансовые обязательства\.$/);
  assert.match(P.PODPIS_PREDELA, /Это не оценка способности компании вернуть деньги\.$/);
  const js = fs.readFileSync(path.join(ROOT, 'js', 'pasport-kontragenta.js'), 'utf8').split('\n')
    .filter((l) => !/SLOVAR_222 =|OPREDELENIE_INDEKSA =|function podval|заключение о надёжности или платёжеспособности/.test(l)).join('\n');
  const pv2 = fs.readFileSync(path.join(ROOT, 'pasport', 'proverka', 'index.html'), 'utf8');
  for (const [imya, t] of [['js', js], ['страница', html.replace(/P\.podval\([^)]*\)/, '')], ['проверка', pv2]]) {
    const m = t.match(P.SLOVAR_222); assert.ok(!m, imya + ': «' + (m && m[0]) + '»');
  }
});

test('п. 145 (г): «на кону» — по режиму покупателя, по умолчанию общая система с подписью', () => {
  const html = PAGE();
  assert.ok(/для компании на общей системе, ставки 2026 года/.test(html));
  assert.ok(/<select name="rezhim"/.test(html));
  const dr = P.sobrat(demo(), opt({ summa: 1000000, rezhim: 'usn_dr' }));
  assert.ok(dr.itog.na_konu.rub >= 150000, '15% от всей суммы (Налоговый юрист 29.09)');
  const d = P.sobrat(demo(), opt({ summa: 1000000, rezhim: 'usn_d' }));
  assert.ok(/18% суммы/.test(d.itog.na_konu.formula));
});
