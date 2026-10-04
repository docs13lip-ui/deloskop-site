// Экран проверки: строка «Статус» в «Существенных фактах» ведёт в справочник «Коды статуса компании в ЕГРЮЛ»
// (/nalogi/kody-statusa-egryul/, statusy-egryul-v1). node --test tests/statusy_iz_proverki.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../js/sushchestvennoe.js');
const KOREN = path.join(__dirname, '..');
const NB = '\u00a0';

// компания вымышленная; поля — как у ответа /api/check
function otvet(company, status) {
  return {
    company: Object.assign({ inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2015-03-10' }, company || {}),
    checked_at: '2026-10-03T09:00:00Z',
    signals: [Object.assign({ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null }, status || {})],
    dossier: {},
  };
}
const fakt = (r) => S.fakty(r).spisok.find((x) => x.k === 'status');

test('код состояния есть — ссылка на его строку справочника', () => {
  const f = fakt(otvet({ status: 'LIQUIDATING', state_code: '105' }, { status: 'bad', detail: 'ФНС готовит исключение из ЕГРЮЛ' }));
  assert.strictEqual(f.spravka, '/nalogi/kody-statusa-egryul/#k105');
  assert.strictEqual(f.spravkaT, 'что значит код' + NB + '105');
  const h = S.html(otvet({ status: 'LIQUIDATING', state_code: 105 }, { status: 'bad', detail: 'ФНС готовит исключение из ЕГРЮЛ' }));
  assert.match(h, /<a href="\/nalogi\/kody-statusa-egryul\/#k105" data-goal="statusy_iz_proverki">что значит код\u00a0105<\/a>/);
  assert.ok(!/kody-statusa-egryul[^"]*" target=/.test(h), 'своя страница — в той же вкладке');
});

test('кода нет, статус не «норма» — ссылка на справочник без якоря', () => {
  const f = fakt(otvet({ status: 'LIQUIDATING' }, { status: 'bad', detail: 'Ликвидируется' }));
  assert.strictEqual(f.spravka, '/nalogi/kody-statusa-egryul/');
  assert.strictEqual(f.spravkaT, 'что значат коды статуса');
});

test('действующая без кода — ссылки нет; ИП — ссылки нет; мусор в коде — как без кода', () => {
  assert.strictEqual(fakt(otvet()).spravka, undefined);
  assert.ok(!/kody-statusa-egryul/.test(S.html(otvet())));
  const ip = otvet({ inn: '770000000012', kind: 'INDIVIDUAL', state_code: '201' }, { status: 'bad', detail: 'Прекратил деятельность' });
  assert.strictEqual(fakt(ip).spravka, undefined);
  assert.strictEqual(fakt(otvet({ state_code: '10' })).spravka, undefined);
  assert.strictEqual(fakt(otvet({ state_code: '1050' }, { status: 'warn' })).spravka, '/nalogi/kody-statusa-egryul/');
});

test('у каждого кода справочника есть якорь на странице — ссылка с экрана не уводит в пустоту', () => {
  const d = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/statusy-egryul.json'), 'utf8'));
  const str = fs.readFileSync(path.join(KOREN, 'nalogi/kody-statusa-egryul/index.html'), 'utf8');
  assert.ok(d.kody.length >= 60);
  for (const k of d.kody) assert.ok(str.includes('id="k' + k.kod + '"'), 'нет якоря #k' + k.kod);
});
