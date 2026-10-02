// «Предел аванса — открыто» (Очередь п. 119; Прорыв «Ф. Формула вместо чёрного ящика»; тексты Маркетинга 28.09, раздел 3.3).
// 1) под пределом всегда строка «Как посчитали» с цифрами компании;
// 2) «Не проверяли: …», пока источник долгов прямо не сказал found / not_found (не проверено ≠ не найдено);
// 3) числа разбора «Сколько платить вперёд» = константы js/usloviya.js — статья и расчёт не разойдутся;
// 4) фразы-отрицания без источника и даты не вернутся (Маркетинг 28.09, 1.4).
// Запуск: node --test tests/predel_avansa.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const U = require('../js/usloviya.js');

const KOREN = path.join(__dirname, '..');
const NB = ' ';
const STATYA = 'nalogi/skolko-platit-vpered-neznakomoj-kompanii/index.html';
const sig = (title, status, detail) => ({ title, status, detail: detail || '' });
const resp = (o) => Object.assign({ checked_at: '2026-09-28T10:00:00+03:00', risk_level: 'low',
  company: { inn: '7700000000', name_short: 'ООО «Тест»', status: 'ACTIVE', reg_date: '2024-06-01' }, signals: [] }, o || {});
const bezNb = (s) => s.replace(/ /g, ' ');

test('пример из разбора: 13 млн ÷ 26 = 500 тыс., одно замечание → половина 250 тыс.', () => {
  const v = U.decide(resp({ dossier: { kpi: [{ label: 'Выручка за 2025', value: 13000000 }] }, signals: [sig('Административные правонарушения', 'warn', 'штраф')] }));
  assert.strictEqual(v.tone, 'cap');
  assert.strictEqual(v.cap, 250000);
  assert.strictEqual(bezNb(v.kak.kak), 'Как посчитали: выручка за 2025 — 13 000 000 ₽ ÷ 26 = 500 000 ₽ (две недели выручки) · есть 1 замечание → половина: 250 000 ₽, округлили вниз.');
});

test('молодая компания: две недели выручки выше потолка → потолок возраста', () => {
  const v = U.decide(resp({ company: { inn: '7700000001', status: 'ACTIVE', reg_date: '2026-02-10' }, dossier: { kpi: [{ label: 'Выручка', value: 20800000 }] } }));
  assert.match(bezNb(v.kak.kak), /две недели выручки — 800 000 ₽, но компании 7 мес\. — не больше потолка для возраста до года: 300 000 ₽/);
  assert.strictEqual(v.cap, 150000);
});

test('выручки нет → потолок по возрасту; «стоп» и «по факту» → «Вперёд — 0 ₽» с причиной', () => {
  assert.match(bezNb(U.decide(resp()).kak.kak), /^Как посчитали: выручки в отчётности нет — берём потолок по возрасту \(2 года\): 1 000 000 ₽\.$/);
  const post = U.decide(resp({ signals: [sig('Исполнительные производства ФССП', 'bad', '2 на 400 тыс.')] }));
  assert.match(bezNb(post.kak.kak), /^Вперёд — 0 ₽: исполнительные производства ФССП.* — платите после поставки или акта\.$/);
  assert.strictEqual(post.kak.ne, '', 'при нуле строка «Не проверяли» лишняя');
  const stop = U.decide(resp({ company: { inn: '7700000000', status: 'LIQUIDATED' } }));
  assert.match(bezNb(stop.kak.kak), /^Вперёд — 0 ₽: компания ликвидирована/);
});

test('не проверено ≠ не найдено: без статуса источника — «Не проверяли» оба вида долгов', () => {
  const v = U.decide(resp({ signals: [sig('Задолженность по налогам', 'ok', 'Нет')] }));
  assert.deepStrictEqual(v.neProvereno.spisok, ['долги у приставов', 'долги по налогам']);
  assert.match(v.kak.ne, /^Не проверяли: долги у приставов, долги по налогам\. Если они есть — вперёд лучше не платить\./);
});

test('источник прямо сказал not_found → строка его не называет; полнота — с датой', () => {
  const v = U.decide(resp({ damia: { fssp: { status: 'not_found' }, polnota: { provereno: 6, iz: 7 }, data_svedeniy: '2026-09-28T09:00:00+03:00' },
    istochniki: [{ kod: 'fns_debt', status: 'not_checked' }] }));
  assert.deepStrictEqual(v.neProvereno.spisok, ['долги по налогам']);
  assert.match(v.kak.ne, / Из внешних реестров ответили 6 из 7 на 28\.09\.2026\.$/);
  const vse = U.decide(resp({ damia: { fssp: { status: 'found' } }, istochniki: [{ kod: 'nalogi', status: 'not_found' }] }));
  assert.strictEqual(vse.kak.ne, '');
});

test('«осторожный предел» выключен, пока [Данные] не решили (методика не меняется молча)', () => {
  assert.strictEqual(U.METODIKA.OSTOROZHNO, false);
  assert.strictEqual(U.decide(resp()).cap, 1000000);
});

test('карточка «Условия сделки» рисует «Как посчитали», «Не проверяли» и ссылку на разбор', () => {
  const src = fs.readFileSync(path.join(KOREN, 'js/usloviya.js'), 'utf8');
  assert.match(src, /class="usl-kak"/);
  assert.match(src, /usl-ne/);
  assert.ok(src.includes("STATYA = '/nalogi/skolko-platit-vpered-neznakomoj-kompanii/'"));
  assert.ok(fs.existsSync(path.join(KOREN, STATYA)), 'разбор, на который ссылается отчёт, существует');
});

test('числа разбора = константы расчёта', () => {
  const s = fs.readFileSync(path.join(KOREN, STATYA), 'utf8');
  const m = (k) => { const r = new RegExp('data-m="' + k + '">([^<]+)<').exec(s); assert.ok(r, k); return Number(r[1].replace(/\D/g, '')); };
  assert.strictEqual(m('delitel'), U.METODIKA.DELITEL);
  const P = U.METODIKA.POTOLKI;
  assert.deepStrictEqual([m('p6'), m('p12'), m('p36'), m('pmax')], P.map((x) => x[1]));
  assert.deepStrictEqual(P.slice(0, 3).map((x) => x[0]), [6, 12, 36]);
  // пример статьи считается тем же кодом
  const v = U.decide(resp({ company: { inn: '7700000009', status: 'ACTIVE', reg_date: '2024-06-01' }, dossier: { kpi: [{ label: 'Выручка', value: 13000000 }] }, signals: [sig('Административные правонарушения', 'warn', 'штраф')] }), { amount: 1200000 });
  assert.strictEqual(v.cap, 250000);
  assert.ok(bezNb(s).includes('13 000 000 ÷ 26 = 500 000 ₽'));
  assert.ok(bezNb(s).includes('половина: 250 000 ₽'));
  // шаги округления в тексте = niceFloor
  assert.strictEqual(U.niceFloor(87400), 80000);
  assert.strictEqual(U.niceFloor(987000), 950000);
  assert.strictEqual(U.niceFloor(1237000), 1200000);
  assert.strictEqual(U.niceFloor(12400000), 12000000);
  assert.ok(bezNb(s).includes('до 10 млн ₽ — до 100 тыс., дальше — до 1 млн ₽'));
});

test('разбор: SEO-обвязка — canonical, FAQPage с видимыми вопросами, sitemap, хаб, ссылки из соседних', () => {
  const s = fs.readFileSync(path.join(KOREN, STATYA), 'utf8');
  assert.match(s, /<link rel="canonical" href="https:\/\/deloskop\.ru\/nalogi\/skolko-platit-vpered-neznakomoj-kompanii\/">/);
  assert.ok(s.includes('"FAQPage"') && (s.match(/<details>/g) || []).length === 5);
  assert.ok(!/noindex/.test(s));
  assert.match(fs.readFileSync(path.join(KOREN, 'sitemap.xml'), 'utf8'), /skolko-platit-vpered-neznakomoj-kompanii\/<\/loc>/);
  let vhod = 0;
  for (const f of ['nalogi/index.html', 'nalogi/kak-proverit-schet-pered-oplatoj/index.html', 'nalogi/proverka-kontragenta-pered-dogovorom/index.html'])
    if (fs.readFileSync(path.join(KOREN, f), 'utf8').includes('href="/nalogi/skolko-platit-vpered-neznakomoj-kompanii/"')) vhod++;
  assert.strictEqual(vhod, 3);
  for (const slovo of ['гарантия исхода', 'гарантированно', 'долгов нет', 'нейросет'])
    assert.ok(!bezNb(s).toLowerCase().includes(slovo), slovo);
});

test('запрещённые фразы-отрицания (Маркетинг 28.09, 1.4) — нигде на сайте', () => {
  const ZAPRET = [/долгов нет/i, /долгов у приставов нет/i, /не за что зацепиться/i, /ограничивают сч[её]та/i];
  const fajly = [];
  (function obhod(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || ['node_modules', 'tests', 'сайт', 'fonts'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) obhod(p);
      else if (/\.(html|js|json)$/.test(e.name)) fajly.push(p);
    }
  })(KOREN);
  for (const f of fajly) {
    const t = bezNb(fs.readFileSync(f, 'utf8'));
    for (const z of ZAPRET) assert.ok(!z.test(t), path.relative(KOREN, f) + ': ' + z);
  }
});
