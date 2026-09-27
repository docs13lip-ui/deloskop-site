// Ключевая ставка Банка России в расчётах пеней не должна устаревать молча.
// Календарь решений: https://cbr.ru/dkp/cal_mp/ (ближайшие — 23.10.2026 и 18.12.2026, пресс-релиз в 13:30 МСК).
// После даты решения тест краснеет со следующего дня — пока ставку не сверят и не обновят
// klyuchevaya_stavka, klyuchevaya_stavka_istochnik и klyuchevaya_stavka_sleduyushchee_reshenie в tarify/tarify.json,
// затем python3 tests/sobrat_tarify.py . && python3 tests/sobrat_shapku.py
// Срочная выкладка в день решения: «Проверка и выкладка» → Run workflow → bez_testov.
// Запуск: node --test tests/stavka_cb.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'tarify/tarify.json'), 'utf8'));
const R = D.raschet;

function segodnyaMsk(seychas = new Date()) {
  return new Date(seychas.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}
function ustarela(sled, segodnya) {
  // Решение объявляют в 13:30 — день решения ещё не краснеем, со следующего дня — да.
  return segodnya > sled;
}

test('ставка ЦБ: указана дата следующего решения совета директоров', () => {
  assert.match(R.klyuchevaya_stavka_sleduyushchee_reshenie || '', /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(R.klyuchevaya_stavka > 0 && R.klyuchevaya_stavka < 1, 'ставка — доля, например 0.14');
});

test('ставка ЦБ: сверена после последнего решения Банка России', () => {
  const sled = R.klyuchevaya_stavka_sleduyushchee_reshenie;
  assert.ok(!ustarela(sled, segodnyaMsk()),
    `Банк России принял решение по ставке ${sled}. Сверьте ставку на https://www.cbr.ru/hd_base/KeyRate/ ` +
    'и обновите в tarify/tarify.json ставку, источник и дату следующего решения (https://cbr.ru/dkp/cal_mp/).');
});

test('ставка ЦБ: одна и та же цифра в данных и на странице тарифов', () => {
  const pct = String(Math.round(R.klyuchevaya_stavka * 10000) / 100).replace('.', ',');
  const t = fs.readFileSync(path.join(KOREN, 'tarify/index.html'), 'utf8');
  assert.ok(t.includes(`ключевая ставка ${pct.replace(',', '.')}%`) || t.includes(`ключевая ставка ${pct}%`), `на /tarify/ нет «ключевая ставка ${pct}%»`);
  assert.ok(!/ключевая ставка (?!\d+(?:[.,]\d+)?% — действует)\d+(?:[.,]\d+)?% с \d/.test(t), 'осталась ручная строка «ставка N% с …»');
});

test('ставка ЦБ: логика даты — день решения зелёный, следующий день красный', () => {
  assert.equal(ustarela('2026-10-23', '2026-10-23'), false);
  assert.equal(ustarela('2026-10-23', '2026-10-24'), true);
  assert.equal(segodnyaMsk(new Date('2026-10-23T21:30:00Z')), '2026-10-24');
});
