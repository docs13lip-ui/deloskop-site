// Паспорт контрагента: «Что изменилось с вашей прошлой проверки» (pasport-izm-v1, Ночные-3 04.10).
// Сравнение — со снимком этого браузера (js/dinamika.js), только чтение: Паспорт снимков не пишет.
// Блок — под «Итогом», только на экране: в PDF (noprint) и в отпечаток SHA-256 не входит.
// node --test tests/pasport_izm.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(path.join(ROOT, 'js', 'dinamika.js'));
const E = require(path.join(ROOT, 'pasport', 'engine.js'));
const HTML = fs.readFileSync(path.join(ROOT, 'pasport', 'kontragent', 'index.html'), 'utf8');
const NB = String.fromCharCode(0xa0);
const NEVIDIMYE = [0xa0, 0x202f, 0x2009, 0xad, 0x200b];

function ls(init) {
  const m = new Map(init ? [[D.KEY, JSON.stringify(init)]] : []);
  let zapisej = 0;
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { zapisej++; m.set(k, v); }, zapisej: () => zapisej };
}
function otvet(t, dop) {
  return Object.assign({ checked_at: t, risk_level: 'low',
    company: { inn: '7736050003', kpp: '770401001', kind: 'LEGAL', status: 'ACTIVE', name_short: 'ПАО «Пример»' }, signals: [] }, dop || {});
}

test('прошлая проверка в браузере → строки изменений; хранилище не меняется', () => {
  const a = D.snimok(otvet('2026-09-01T10:00:00+03:00', { risk_level: 'medium' }));
  a.kpp = '781401001';
  const s = ls({ '7736050003': [a] });
  const rez = D.sravnitSnimki(otvet('2026-10-04T10:00:00+03:00'), s);
  assert.ok(rez && rez.s.t === a.t);
  const t = rez.izm.map((x) => x.t).join(' | ');
  assert.match(t, /Оценка риска/);
  assert.match(t, /КПП сменился: 781401001 → 770401001 — компания встала на/);
  assert.strictEqual(s.zapisej(), 0, 'Паспорт снимков не пишет');
});

test('берёт самую позднюю проверку раньше досье больше чем на час; свежую (< 1 ч) и будущую — нет', () => {
  const t0 = Date.parse('2026-10-04T10:00:00+03:00');
  const sn = (t, lvl) => { const x = D.snimok(otvet(new Date(t).toISOString(), { risk_level: lvl })); return x; };
  const s = ls({ '7736050003': [sn(t0 - 30 * 864e5, 'high'), sn(t0 - 2 * 36e5, 'medium'), sn(t0 - 20 * 6e4, 'high'), sn(t0 + 864e5, 'high')] });
  const rez = D.sravnitSnimki(otvet('2026-10-04T10:00:00+03:00'), s);
  assert.strictEqual(rez.s.t, t0 - 2 * 36e5);
});

test('нечего сравнить → null и пустой блок: нет хранилища, нет снимков, другая компания, ИП без снимка', () => {
  const r = otvet('2026-10-04T10:00:00+03:00');
  assert.strictEqual(D.sravnitSnimki(r, null), null);
  assert.strictEqual(D.sravnitSnimki(r, ls()), null);
  assert.strictEqual(D.sravnitSnimki(r, ls({ '7707083893': [D.snimok(otvet('2026-09-01T10:00:00+03:00'))] })), null);
  const bad = { getItem: () => '{oshibka', setItem: () => {} };
  assert.strictEqual(D.sravnitSnimki(r, bad), null);
  assert.strictEqual(D.htmlPasport(null), '');
});

test('блок: noprint, подпись «только на экране», без изменений — «существенных изменений нет»', () => {
  const a = D.snimok(otvet('2026-09-01T10:00:00+03:00'));
  const rez = D.sravnitSnimki(otvet('2026-10-04T10:00:00+03:00'), ls({ '7736050003': [a] }));
  const h = D.htmlPasport(rez);
  assert.match(h, /^<section class="pk-izm noprint"/);
  assert.match(h, /существенных изменений нет/);
  assert.match(h, new RegExp('в' + NB + 'PDF Паспорта и в' + NB + 'его отпечаток не' + NB + 'входит'));
  assert.match(h, new RegExp('Сравнили с' + NB + 'вашей проверкой на' + NB + 'этом устройстве'));
  assert.doesNotMatch(h, /Образец/);
});

test('образец Паспорта: три отличия на вымышленной компании, с пометкой «Образец»', () => {
  const r = JSON.parse(JSON.stringify(E.DEMO));
  r.checked_at = '2026-10-04T10:00:00+03:00';
  r.dossier = { charts: { revenue: [{ year: 2023, value: 48200000 }, { year: 2024, value: 56100000 }, { year: 2025, value: 61400000 }] } };
  const rez = D.obrazecIzm(r);
  const t = rez.izm.map((x) => x.t).join(' | ');
  assert.strictEqual(rez.izm.length, 3, t);
  assert.match(t, /Оценка риска: средний → низкий/i);
  assert.match(t, /КПП сменился: 001101001 → 001201001/);
  assert.match(t, /Появилась отчётность за 2025/);
  assert.match(D.htmlPasport(rez, true), /Образец: так блок выглядит/);
});

test('страница Паспорта: dinamika.js подключён, блок вставляется после выпуска под «Итогом», не в отпечаток', () => {
  assert.match(HTML, /<script src="\/js\/dinamika\.js"><\/script>/);
  const i = HTML.indexOf('Dinamika.htmlPasport');
  assert.ok(i > HTML.indexOf('P.vypustit(p).then'), 'после выпуска (отпечаток уже посчитан)');
  assert.match(HTML, /m\.demo\?Dinamika\.obrazecIzm\(r\):Dinamika\.sravnitSnimki\(r,ls\)/);
  assert.match(HTML, /ig\.insertAdjacentHTML\('afterend',hz\)/);
  assert.match(HTML, /\.pk-izm\{/);
});

test('новые строки без невидимых символов и без обещаний', () => {
  const kod = fs.readFileSync(path.join(ROOT, 'js', 'dinamika.js'), 'utf8');
  const kusok = kod.slice(kod.indexOf('pasport-izm-v1'), kod.indexOf('// rez.id — сравнение'));
  assert.ok(kusok.length > 500);
  NEVIDIMYE.forEach((c) => assert.ok(!kusok.includes(String.fromCharCode(c)), c.toString(16)));
  const t = fs.readFileSync(__filename, 'utf8');
  NEVIDIMYE.forEach((c) => assert.ok(!t.includes(String.fromCharCode(c)), 'тест: ' + c.toString(16)));
  assert.doesNotMatch(kusok, /гарантир|надёжн|лучш/i);
});
