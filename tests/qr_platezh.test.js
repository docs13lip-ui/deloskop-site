// QR для оплаты по ГОСТ Р 56042-2014 (js/qr-platezh.js) — schet-konversiya-v1, [Ночные запуски] 10.10.2026.
// Кодировщик свой; при сборке 45 строк (версии 1–40, кириллица в UTF-8) сверены двумя независимыми декодерами
// (zxing-cpp, OpenCV). Здесь — строка платежа и устройство символа (поисковые узоры, синхронизация, строка формата).
// Запуск: node --test tests/qr_platezh.test.js
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const Q = require('../js/qr-platezh.js');

const SNIMOK = 'bfcd0cd30641d831';
const R = { name: 'ИП Иванов Иван Иванович', rs: '40802810900000000001', bank: 'ПАО Сбербанк', bik: '044525225', ks: '30101810400000000225',
  summa: 3700, naznachenie: 'Оплата по счёту № Д-2026-000123 от 14.10.2026. Без налога (НДС)', inn: '500100732259', inn_platelshchika: '7707083893' };

test('строка платежа: ST00012, обязательные поля по порядку, сумма в копейках', () => {
  assert.strictEqual(Q.stroka(R), 'ST00012|Name=ИП Иванов Иван Иванович|PersonalAcc=40802810900000000001|BankName=ПАО Сбербанк|BIC=044525225|' +
    'CorrespAcc=30101810400000000225|Sum=370000|Purpose=Оплата по счёту № Д-2026-000123 от 14.10.2026. Без налога (НДС)|PayeeINN=500100732259|PayerINN=7707083893');
  assert.match(Q.stroka(Object.assign({}, R, { summa: 390.5 })), /\|Sum=39050\|/);
});

test('строка платежа: «|» и переводы строк в значениях не ломают поля; без реквизитов — пусто', () => {
  const s = Q.stroka(Object.assign({}, R, { naznachenie: 'Оплата | по счёту\nи ещё' }));
  assert.match(s, /\|Purpose=Оплата по счёту и ещё\|/);
  assert.strictEqual(s.split('|').length, 10);
  assert.strictEqual(Q.stroka(Object.assign({}, R, { rs: '' })), '');
  assert.strictEqual(Q.stroka(Object.assign({}, R, { bik: '04452522' })), '');
  assert.strictEqual(Q.stroka(Object.assign({}, R, { ks: '301' })), '');
  assert.ok(!/PayerINN/.test(Q.stroka(Object.assign({}, R, { inn_platelshchika: '123' }))));
});

test('UTF-8: кириллица — 2 байта, ёлочки — 2, эмодзи — 4', () => {
  assert.deepStrictEqual(Q.utf8('Ж'), [0xD0, 0x96]);
  assert.deepStrictEqual(Q.utf8('«'), [0xC2, 0xAB]);
  assert.strictEqual(Q.utf8('😀').length, 4);
});

function formatOk(m, N) {
  // строка формата вокруг верхнего левого узора: 15 бит, BCH(15,5) с маской 0x5412; уровень M = 00
  const bit = (x, y) => m[y][x] ? 1 : 0;
  const b = [0, 1, 2, 3, 4, 5].map(i => bit(8, i)).concat([bit(8, 7), bit(8, 8), bit(7, 8)], [9, 10, 11, 12, 13, 14].map(i => bit(14 - i, 8)));
  let v = 0; for (let i = 14; i >= 0; i--) v = v << 1 | b[i];
  v ^= 0x5412;
  const d = v >>> 10; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
  const b2 = [0, 1, 2, 3, 4, 5, 6, 7].map(i => bit(N - 1 - i, 8)).concat([8, 9, 10, 11, 12, 13, 14].map(i => bit(8, N - 15 + i)));
  return { bch: ((d << 10) | r) === v, uroven: d >>> 3, kopiya: b.join('') === b2.join(''), temnyj: bit(8, N - 8) === 1 };
}

test('символ: размер по версии, три поисковых узора, синхронизация, строка формата (уровень M) в двух копиях', () => {
  for (const t of ['A', Q.stroka(R), 'Счёт '.repeat(120)]) {
    const q = Q.kodirovat(t), m = q.moduli, N = m.length;
    assert.strictEqual(N, q.v * 4 + 17);
    for (const [x0, y0] of [[0, 0], [N - 7, 0], [0, N - 7]])
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const d = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        assert.strictEqual(m[y0 + y][x0 + x], d !== 2, 'поисковый узор ' + x0 + ',' + y0);
      }
    for (let i = 8; i < N - 8; i++) { assert.strictEqual(m[6][i], i % 2 === 0); assert.strictEqual(m[i][6], i % 2 === 0); }
    const f = formatOk(m, N);
    assert.ok(f.bch && f.kopiya && f.temnyj, 'строка формата');
    assert.strictEqual(f.uroven, 0, 'уровень коррекции M');
  }
});

test('версия растёт с длиной; строка счёта — не больше 15-й версии (читается камерой с A4 при 32 мм)', () => {
  assert.strictEqual(Q.kodirovat('A').v, 1);
  assert.ok(Q.kodirovat(Q.stroka(R)).v <= 15);
  assert.strictEqual(Q.kodirovat('x'.repeat(2400)), null, 'больше 40-й версии — нет символа, а не порча');
});

test('снимок: тот же вход — тот же символ (сверен декодерами при сборке)', () => {
  const m = Q.kodirovat(Q.stroka(R)).moduli.map(r => r.map(c => c ? 1 : 0).join('')).join('\n');
  assert.strictEqual(crypto.createHash('sha256').update(m).digest('hex').slice(0, 16), SNIMOK);
});

test('SVG: один path, белое поле 4 модуля, подпись для экранного чтения', () => {
  const s = Q.svg(Q.stroka(R), 'QR-код для оплаты');
  const N = Q.kodirovat(Q.stroka(R)).moduli.length;
  assert.match(s, new RegExp('viewBox="0 0 ' + (N + 8) + ' ' + (N + 8) + '"'));
  assert.strictEqual((s.match(/<path/g) || []).length, 1);
  assert.match(s, /role="img" aria-label="QR-код для оплаты"/);
  assert.strictEqual(Q.svg(''), '');
});
