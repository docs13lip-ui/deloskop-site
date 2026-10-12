// Оплата по QR СБП (js/sbp-qr.js) — sbp-qr-v1, 12.10.2026. Запуск: node --test tests/sbp_qr.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
global.DeloskopQR = require('../js/qr-platezh.js');
const S = require('../js/sbp-qr.js');
const OK = 'https://qr.nspk.ru/AS1A003P3RH0LJ2A9ROO038L6NT5RU1M?type=01&bank=100000000008&crc=4D35';

test('без ссылки банка — блока нет (мёртвых кнопок не держим)', () => {
  global.DELOSKOP_SBP_SSYLKA = '';
  assert.strictEqual(S.html({ summa: 490 }), '');
});

test('чужие и битые ссылки не принимаются', () => {
  for (const s of ['http://qr.nspk.ru/AS1A003P3RH0LJ2A9ROO038L6NT5RU1M', 'https://qr.nspk.ru.evil.ru/AS1A003P3RH0LJ2A9ROO038L6NT5RU1M',
    'https://qr.nspk.ru/AS1"onclick=x', 'javascript:alert(1)']) {
    global.DELOSKOP_SBP_SSYLKA = s;
    assert.strictEqual(S.ssylka(), '', s);
  }
});

test('со ссылкой: QR, сумма с неразрывным пробелом, комментарий, кнопка на ссылку', () => {
  global.DELOSKOP_SBP_SSYLKA = OK;
  const h = S.html({ summa: 1490, nomer: 'Д-2026-000123' });
  assert.match(h, /<svg [^>]*role="img"/);
  assert.ok(h.includes('1 490 ₽'));
  assert.ok(h.includes('номер счёта <b>Д-2026-000123</b>'));
  assert.ok(h.includes('href="' + OK.replace(/&/g, '&amp;') + '"'));
});

test('в репозитории ссылка задаётся только в js/sbp-qr.js и только ссылкой НСПК', () => {
  const src = fs.readFileSync(__dirname + '/../js/sbp-qr.js', 'utf8');
  const m = src.match(/var SSYLKA = "([^"]*)";/);
  assert.ok(m, 'строка var SSYLKA = "…";');
  assert.ok(m[1] === '' || /^https:\/\/qr\.nspk\.ru\//.test(m[1]));
});

test('форма счёта: блок для граждан подключён, прежняя строка остаётся запасной', () => {
  const src = fs.readFileSync(__dirname + '/../js/schet.js', 'utf8');
  assert.ok(src.includes('data-sbp-box'));
  assert.ok(src.includes('Для граждан оплата откроется позже'));
  assert.ok(src.includes('/js/sbp-qr.js'));
});
