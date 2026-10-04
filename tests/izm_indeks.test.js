// [Ночные-3] izm-indeks-v1: «Что изменилось» — (1) Индекс дописывается в снимок, если методика загрузилась позже ответа API
// (раньше снимок оставался без Индекса и строки «Индекс: A → B» через неделю не было); (2) признак «внимание»/«риск»,
// которого нет в новом ответе, — серая строка «в этой строки нет», без «снят». node --test tests/izm_indeks.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const IO = require('../js/indeks-otvet.js');
const NB = ' ';

const SRC = fs.readFileSync(path.join(__dirname, '../js/dinamika.js'), 'utf8');

// Браузер в миниатюре: dinamika.js видит self.IndeksOtvet, у которого методика «ещё грузится», пока не вызовем zagruzit()
function brauzer() {
  let gotov = false, zhdut = [];
  const fake = {
    gotov: () => gotov,
    gotovo: (f) => { if (gotov) f(); else zhdut.push(f); },
    ball: (r) => IO.ball(r), vid: (r) => IO.vid(r), versiya: () => IO.versiya(), faktor: (id) => IO.faktor(id),
  };
  const self = { IndeksOtvet: fake };
  const ctx = vm.createContext({ self, JSON, Date, Math, Object, Array, String, Number, isFinite, parseInt, RegExp });
  vm.runInContext(SRC, ctx);
  const ls = { d: {}, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = String(v); } };
  return {
    D: self.Dinamika, ls,
    zagruzit() { gotov = true; const z = zhdut; zhdut = []; z.forEach((f) => f()); },
    sbros() { gotov = false; },
    tajmaut() { const z = zhdut; zhdut = []; z.forEach((f) => f()); return z.length; }, // gotovo() через 4 с — без методики
    snimki(inn) { return JSON.parse(ls.getItem('dlk_snimki') || '{}')[inn] || []; },
  };
}

function otvet(t, extra) {
  return {
    company: { inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2015-03-10', invalid: false, address_invalid: false },
    risk_level: 'low', checked_at: t,
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ', as_of: null },
      { id: 'age', title: 'Возраст компании', status: 'ok', detail: 'С 10.03.2015', source: 'ЕГРЮЛ', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' },
    ].concat(extra || []),
    dossier: { charts: { revenue: [{ year: 2024, value: 40e6 }, { year: 2025, value: 48.2e6 }], profit: [{ year: 2025, value: -1.5e6 }] } },
  };
}
const MASS = { id: 'management', title: 'Массовый руководитель', status: 'warn', detail: '12 компаний', source: 'ЕГРЮЛ', as_of: null };
const ixStroka = (rez) => (rez && rez.izm || []).find((x) => /^Индекс: /.test(x.t));

test('гонка на первой проверке: методика пришла позже — Индекс дописан в снимок, через неделю есть «Индекс: 75 → 65»', () => {
  const B = brauzer();
  const h1 = B.D.html(otvet('2026-09-27T09:00:00Z'), { ls: B.ls });
  assert.match(h1, /Запомнили эту проверку/);
  assert.strictEqual(B.snimki('7700000001')[0].ix, undefined, 'до загрузки методики Индекса в снимке нет');
  B.zagruzit();
  const s = B.snimki('7700000001')[0];
  assert.strictEqual(s.ix, 75);
  assert.deepStrictEqual(s.ixf, ['vozrast_10g']);
  assert.strictEqual(s.ixv, IO.versiya());
  // вторая проверка — методика уже есть
  const h2 = B.D.html(otvet('2026-10-04T09:00:00Z', [MASS]), { ls: B.ls });
  assert.ok(h2.indexOf('Индекс: 75 → 65 с' + NB + 'проверки 27.09') >= 0, h2);
});

test('гонка на второй проверке: сравнение пересобирается со строкой Индекса, без повторной записи снимка', () => {
  const B = brauzer();
  B.zagruzit();
  B.D.html(otvet('2026-09-27T09:00:00Z'), { ls: B.ls });
  B.sbros();
  const r2 = otvet('2026-10-04T09:00:00Z', [MASS]);
  const h2 = B.D.html(r2, { ls: B.ls });
  assert.ok(h2.indexOf('Индекс:') < 0, 'методики ещё нет — строки Индекса нет');
  assert.strictEqual(B.snimki('7700000001').length, 2);
  B.zagruzit();
  const sn = B.snimki('7700000001');
  assert.strictEqual(sn.length, 2, 'новый снимок не добавлен');
  assert.strictEqual(sn[1].ix, 65);
  // пересборка: dopisatIndeks тем же ключом отдаёт текущее сравнение (уже со строкой) — повторно не меняет
  const kl = '7700000001:' + Date.parse(r2.checked_at);
  const out = B.D.dopisatIndeks(r2, B.ls, kl, null);
  assert.strictEqual(out.zapisan, false, 'второй раз писать нечего');
  assert.strictEqual(out.rez, null, 'сравнение уже со строкой Индекса');
});

test('блок на экране заменяется: после загрузки методики в «Что изменилось» встаёт «Индекс: 75 → 65» с «Почему»', () => {
  const B = brauzer();
  B.zagruzit();
  B.D.html(otvet('2026-09-27T09:00:00Z'), { ls: B.ls });
  B.sbros();
  let vstavleno = null;
  const star = { parentNode: { replaceChild: (nov) => { vstavleno = nov.html; } } };
  const mesto = {
    ownerDocument: { createElement: () => ({ set innerHTML(h) { this.firstChild = { html: h }; } }) },
    querySelector: (sel) => (sel === '.izm' ? star : null),
  };
  const doc = { querySelector: (sel) => (sel === '.report' ? mesto : null), body: mesto };
  const h = B.D.html(otvet('2026-10-04T09:00:00Z', [MASS]), { ls: B.ls, doc });
  assert.ok(h.indexOf('Индекс:') < 0);
  assert.strictEqual(vstavleno, null);
  B.zagruzit();
  assert.ok(vstavleno, 'блок пересобран');
  assert.ok(vstavleno.indexOf('Индекс: 75 → 65 с' + NB + 'проверки 27.09') >= 0, vstavleno);
  assert.ok(vstavleno.indexOf('Почему: появилось') >= 0);
  assert.ok(vstavleno.indexOf('Массовый руководитель') >= 0, 'прежние строки сравнения на месте');
});

test('серверное число и ИП — не ждём методику; другая компания между делом — снимок дописан, блок не трогаем', () => {
  const B = brauzer();
  const rs = otvet('2026-10-04T09:00:00Z'); rs.indeks = 61;
  assert.strictEqual(B.D.ozhidatIndeks(rs, B.ls), false, 'r.indeks от сервера — уже в снимке');
  const ip = otvet('2026-10-04T09:00:00Z'); ip.company = Object.assign({}, ip.company, { inn: '770000000012', kind: 'INDIVIDUAL' });
  assert.strictEqual(B.D.ozhidatIndeks(ip, B.ls), false, 'у ИП Индекса нет');
  // проверили компанию 1, методика не готова; пока ждали — проверили компанию 2
  const r1 = otvet('2026-10-04T09:00:00Z');
  B.D.html(r1, { ls: B.ls });
  const r2 = otvet('2026-10-04T09:01:00Z'); r2.company = Object.assign({}, r2.company, { inn: '7700000002' });
  B.D.html(r2, { ls: B.ls });
  B.zagruzit();
  assert.strictEqual(B.snimki('7700000001')[0].ix, 75);
  assert.strictEqual(B.snimki('7700000002')[0].ix, 75);
  const out = B.D.dopisatIndeks(r1, B.ls, '7700000001:' + Date.parse(r1.checked_at), null);
  assert.strictEqual(out.rez, null, 'на экране уже другая компания');
  // чужой ключ — ничего не делаем
  assert.strictEqual(B.D.dopisatIndeks(r1, B.ls, '7700000001:1', null), null);
});

test('методика так и не пришла (4 с) — снимок без Индекса, ошибок нет', () => {
  const B = brauzer();
  const r = otvet('2026-10-04T09:00:00Z');
  B.D.html(r, { ls: B.ls });
  const out = B.D.dopisatIndeks(r, B.ls, '7700000001:' + Date.parse(r.checked_at), null);
  assert.strictEqual(out, null);
  assert.strictEqual(B.snimki('7700000001')[0].ix, undefined);
});

test('методика пришла позже 4 с (медленная сеть) — ждём ещё, Индекс всё равно в снимке; после 4 попыток — сдаёмся', () => {
  const B = brauzer();
  const r = otvet('2026-10-04T09:00:00Z');
  B.D.html(r, { ls: B.ls });
  assert.strictEqual(B.tajmaut(), 1);
  assert.strictEqual(B.tajmaut(), 1, 'после таймаута снова ждём');
  B.zagruzit();
  assert.strictEqual(B.snimki('7700000001')[0].ix, 75);
  const B2 = brauzer();
  B2.D.html(otvet('2026-10-04T09:00:00Z'), { ls: B2.ls });
  assert.deepStrictEqual([B2.tajmaut(), B2.tajmaut(), B2.tajmaut(), B2.tajmaut(), B2.tajmaut()], [1, 1, 1, 1, 0]);
  assert.strictEqual(B2.snimki('7700000001')[0].ix, undefined);
});

test('ушедший признак: был «внимание» — серая строка «в этой строки нет» с оговоркой; «норма» ушла — молчим', () => {
  const D = require('../js/dinamika.js');
  const a = D.snimok(otvet('2026-09-27T09:00:00Z', [MASS]));
  const b = D.snimok(otvet('2026-10-04T09:00:00Z'));
  const izm = D.sravnit(a, b);
  const x = izm.find((q) => /Массовый руководитель/.test(q.t));
  assert.ok(x, JSON.stringify(izm));
  assert.strictEqual(x.ton, 'info');
  assert.strictEqual(x.t, 'Массовый руководитель: на' + NB + 'прошлой проверке — внимание, в' + NB + 'этой строки нет');
  assert.strictEqual(x.pod, 'Признак могли снять — или источник в этот раз не ответил. «Не проверили» — не значит «не нашли».');
  assert.ok(!/снят|лучше|исчез/i.test(x.t), 'не обещаем, что признак снят');
  // «норма», которой нет в новом ответе, — не изменение
  const a2 = D.snimok(otvet('2026-09-27T09:00:00Z', [{ id: 'fssp', title: 'ФССП', status: 'ok', detail: 'Нет' }]));
  assert.ok(!D.sravnit(a2, b).some((q) => /ФССП/.test(q.t)));
  // новый ответ без признаков вообще — сбой, не «строки нет» по каждому
  const pust = D.snimok(Object.assign(otvet('2026-10-04T09:00:00Z'), { signals: [] }));
  assert.ok(!D.sravnit(a, pust).some((q) => /строки нет/.test(q.t)));
  // признак на месте, но стал «норма» — прежняя строка «внимание → норма», без дубля
  const b3 = D.snimok(otvet('2026-10-04T09:00:00Z', [Object.assign({}, MASS, { status: 'ok' })]));
  const z = D.sravnit(a, b3).filter((q) => /Массовый руководитель/.test(q.t));
  assert.strictEqual(z.length, 1);
  assert.strictEqual(z[0].ton, 'luchshe');
});

test('ушедший признак в блоке: подстрочник выводится, разметка экранирована', () => {
  const D = require('../js/dinamika.js');
  const a = D.snimok(otvet('2026-09-27T09:00:00Z', [Object.assign({}, MASS, { title: 'Адрес <b>x</b>', status: 'bad', id: 'mass_address' })]));
  const b = D.snimok(otvet('2026-10-04T09:00:00Z'));
  const h = D.htmlIzmeneniya({ s: a, izm: D.sravnit(a, b) });
  assert.ok(h.indexOf('Адрес &lt;b&gt;x&lt;/b&gt;: на' + NB + 'прошлой проверке — риск') >= 0, h);
  assert.ok(h.indexOf('<small class="izm__pod">Признак могли снять') >= 0);
});

test('колонка Индекса в листе (js/otchet.js) тоже ждёт методику дольше 4 с — не остаётся «считаем»', () => {
  const src = fs.readFileSync(path.join(__dirname, '../js/otchet.js'), 'utf8');
  assert.ok(!/IO0\.gotovo\(zapolnit\)/.test(src), 'один вызов gotovo без повтора — «считаем» навсегда на медленной сети');
  assert.match(src, /\+\+popytki < 4\) \{ IO0\.gotovo\(zhdat\)/);
});
