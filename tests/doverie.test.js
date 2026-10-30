// doverie-v1 — первый инкремент «доверие» (решение владельца 30.10, задание Master, внешний взгляд 30.10).
// Сначала тест, воспроизводящий дефект, потом правка:
//  (1) неизвестные возраст и выручка → нет положительного аванса: состояние insufficient_data, cap = null (не 0 и не 1 000 000);
//  (2) УСН «доходы» (ПСН, НПД) → налоговый риск не «нулевой», а «зависит от статуса по НДС — уточните»;
//  (3) положительный, нулевой и отсутствующий предел различимы в ответе (predel.sostoyanie) и у правила есть версия;
//  (4) /kak-rabotaet/ не обещает картотеку арбитражных дел — суды не подключены (как на /indeks/).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const U = require('../js/usloviya.js');
const P = require('../indeks/predoplata.js');
const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const bezNb = (s) => String(s).replace(/ /g, ' ');

function resp(c, extra) {
  return Object.assign({ company: Object.assign({ inn: '7700000000', name_short: 'ООО «Тест»', status: 'ACTIVE' }, c || {}),
    risk_level: 'low', signals: [], checked_at: '2026-10-30T10:00:00Z' }, extra || {});
}
// долги проверены источником (not_found) — чтобы проверить, что и тогда положительного аванса из неизвестных нет
const DOLGI_OK = { damia: { fssp: { status: 'not_found', nazvanie: 'ФССП' }, nalogi: { status: 'not_found', nazvanie: 'Долги по налогам' } } };

test('(1) возраст и выручка неизвестны → insufficient_data, cap = null, без «Работать можно» и без суммы', () => {
  [resp(), resp({}, DOLGI_OK)].forEach((r) => {
    ['platim', 'otgruzhaem'].forEach((napr) => {
      const v = U.decide(r, { amount: 500000, napravlenie: napr });
      assert.strictEqual(v.cap, null, 'cap = null, а не ' + v.cap);
      assert.strictEqual(v.predel.sostoyanie, 'insufficient_data');
      assert.ok(!/Работать можно|серьёзного не нашли/.test(v.headline), v.headline);
      assert.ok(!/1\s000\s000/.test(bezNb(v.kak.kak + ' ' + v.prepay + ' ' + v.headline)), 'никакого «осторожного потолка» 1 000 000 ₽');
      assert.ok(!/укладывается в ориентир|в пределах ориентира/.test(v.prepay), v.prepay);
      assert.match(bezNb(v.kak.kak), /неизвестны/);
      assert.match(bezNb(v.kak.kak), /Чего не хватает/);
      assert.match(bezNb(v.prepay), napr === 'otgruzhaem' ? /после оплаты/ : /по факту поставки/);
    });
  });
  // тон «с пределом» — тот же отказ считать, заголовок без «до null»
  const w = U.decide(resp({}, { risk_level: 'medium' }), { amount: 500000 });
  assert.strictEqual(w.cap, null);
  assert.ok(!/null|undefined|NaN/.test(w.headline + w.prepay + w.kak.kak), w.headline);
});

test('(1) prepayCap: из одних неизвестных — null; известна выручка или возраст — прежний расчёт', () => {
  assert.strictEqual(U.prepayCap({ revenue: null, ageMonths: null, bad: {}, warn: {} }, 'go').cap, null);
  assert.strictEqual(U.prepayCap({ revenue: null, ageMonths: null, bad: {}, warn: {} }, 'go').nedostatochno, true);
  assert.strictEqual(U.prepayCap({ revenue: null, ageMonths: 24 }, 'go').cap, 1000000, 'возраст известен — потолок по возрасту');
  assert.strictEqual(U.prepayCap({ revenue: 26000000, ageMonths: null }, 'go').cap, 1000000, 'выручка известна — две недели выручки');
  assert.strictEqual(U.prepayCap({ revenue: null, ageMonths: null, vyruchkaNol: true }, 'go').cap, 0, 'отчёт без выручки — 0 ₽, это не «неизвестно»');
  assert.strictEqual(U.prepayCap({ revenue: null, ageMonths: null }, 'post').cap, 0, '«по факту» — свой ноль со своим основанием');
});

test('(3) три разных состояния предела: positive / zero / insufficient_data (+ finorg), у правила — версия', () => {
  assert.strictEqual(U.decide(resp({ reg_date: '2020-01-10' })).predel.sostoyanie, 'positive');
  assert.strictEqual(U.decide(resp({ status: 'LIQUIDATING' })).predel.sostoyanie, 'zero');
  assert.strictEqual(U.decide(resp()).predel.sostoyanie, 'insufficient_data');
  assert.strictEqual(U.decide(resp({ reg_date: '2020-01-10', okved: '64.19' })).predel.sostoyanie, 'finorg');
  assert.match(U.decide(resp()).predel.pravilo, /^usloviya-\d{4}-\d{2}-\d{2}$/);
  assert.strictEqual(U.METODIKA.PRAVILO, U.decide(resp()).predel.pravilo);
});

test('(1) /indeks/: формула и мини-расчёт не обещают 1 000 000 ₽ при неизвестных возрасте и выручке', () => {
  const r = P.raschet({ vyruchka: null, vozrast: 'net', vyvod: 'go' });
  assert.strictEqual(r.itog, null, 'не 0 и не сумма');
  assert.ok(r.shagi.some((s) => /не считаем/.test(bezNb(s))), r.shagi.join(' | '));
  const html = bezNb(chitat('indeks/index.html').replace(/&nbsp;/g, ' '));
  assert.ok(!/Возраст тоже неизвестен — 1 000 000/.test(html));
  assert.match(html, /Возраст тоже неизвестен — предел не считаем/);
});

test('(2) УСН «доходы»: риск не «нулевой», а «зависит от статуса по НДС — уточните»', () => {
  const s = U.atStake(1220000, 'usn_d');
  assert.ok(!s.zero, 'не zero');
  assert.strictEqual(s.soft, null); assert.strictEqual(s.hard, null);
  assert.strictEqual(s.utochnit, 'nds');
  assert.strictEqual(Math.round(s.vat), 220000, 'если вычет НДС есть — на кону НДС 22/122');
  const src = chitat('js/usloviya.js');
  assert.ok(!/налоговый риск по этому поставщику нулевой/.test(src), 'фразы «риск нулевой» больше нет');
  assert.match(src, /зависит от вашего статуса по\\u00a0НДС — уточните/);
});

test('(2) Паспорт: УСН «доходы» — не «до 0 ₽», а уточнение по НДС', () => {
  const pg = chitat('pasport/kontragent/index.html');
  assert.match(pg, /it\.na_konu\.rub==null/, 'строка 3 итога различает «не посчитано» и сумму');
});

test('(4) /kak-rabotaet/: картотеку арбитражных дел не называем среди запрашиваемых', () => {
  const html = bezNb(chitat('kak-rabotaet/index.html').replace(/&nbsp;/g, ' '));
  const m = /спрашиваем реестры<\/b><span>([^<]*)/i.exec(html);
  assert.ok(m, 'шаг «Мы спрашиваем реестры» на месте');
  assert.ok(!/арбитраж/i.test(m[1]), m[1]);
  assert.match(m[1], /Суды пока не подключены/);
  assert.ok(!/<li>Суды<\/li>/.test(html), 'в показе нет плашки «Суды» среди запрашиваемых');
});

test('(1) Паспорт: при неизвестных выручке и возрасте — «не считаем», тон не зелёный, состояние в итоге', () => {
  const PK = require('../js/pasport-kontragenta.js');
  const p = PK.sobrat(resp(), { summa: 500000, dostup: 'pro', usloviya: U });
  assert.strictEqual(p.itog.predel_avansa_rub, null);
  assert.strictEqual(p.itog.predel_sostoyanie, 'insufficient_data');
  const pr = p.razdely.find((x) => x.id === 'predel');
  const f = pr && pr.fakty.find((x) => x.tekst === 'Предел аванса');
  assert.ok(f, 'строка «Предел аванса» есть');
  assert.notStrictEqual(f.ton, 'ok');
  assert.match(bezNb(f.znachenie || f.tekst), /не считаем/);
});

test('(1) интерфейс: «данных мало» — нейтральная метка, не зелёная', () => {
  const src = chitat('js/usloviya.js');
  assert.match(src, /\(v\.nedostatochno \? ' ned' : ''\)/);
  assert.match(src, /\.usl\.ned \.usl-mark\{background:#8E8E93/);
});
