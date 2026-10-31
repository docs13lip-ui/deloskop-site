// qr-pauza-v1 (31.10.2026, п. 428 Очереди): QR СБП принимает деньги сразу, а онлайн-касса (54-ФЗ) не подключена —
// каждая оплата без чека = штраф (ч. 2 ст. 14.5 КоАП). Пока в tarify/tarify.json нет "kassa": true,
// ссылки НСПК нет ни в js/sbp-qr.js, ни в одном файле сайта — даже в <template> беты (её видят исходник и роботы).
// Вернуть QR: подключить кассу → "kassa": true → ссылка банка в var SSYLKA → python3 tests/sobrat_tarify.py .
// Запуск: node --test tests/qr_pauza.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(R, 'tarify/tarify.json'), 'utf8'));
const KASSA = D.kassa === true;

function obhod(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'tests') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) obhod(p, out);
    else if (/\.(html|js|json|xml|txt)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('без кассы: var SSYLKA в js/sbp-qr.js пустая', { skip: KASSA }, () => {
  const m = fs.readFileSync(path.join(R, 'js/sbp-qr.js'), 'utf8').match(/var SSYLKA = "([^"]*)";/);
  assert.ok(m, 'строка var SSYLKA = "…";');
  assert.strictEqual(m[1], '', 'QR СБП без кассы — штраф по ч. 2 ст. 14.5 КоАП');
});

test('без кассы: ссылки qr.nspk.ru нет ни в одном файле сайта (и в <template> тоже)', { skip: KASSA }, () => {
  const s = obhod(R, []).filter((f) => fs.readFileSync(f, 'utf8').includes('qr.nspk.ru/A'));
  assert.deepStrictEqual(s.map((f) => path.relative(R, f)), []);
});

test('без кассы: на /tarify/ нет блока «Гражданам — по СБП» и ссылки на #sbp', { skip: KASSA }, () => {
  const h = fs.readFileSync(path.join(R, 'tarify/index.html'), 'utf8');
  assert.ok(!h.includes('data-sbp-tarify'));
  assert.ok(!/href="#sbp"|data-oplata-href="#sbp"/.test(h));
});
