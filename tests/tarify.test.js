// Автотесты логики тарифов: node tests/tarify.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const T = require('../tarify/tarify.js');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '../tarify/tarify.json'), 'utf8'));
let n = 0;
function ok(name, fn) { fn(); n++; console.log('✓', name); }

ok('ничего не нужно — бесплатно', () => {
  const p = T.podobrat(D, { otchetov: 0, slezhenie: 0, polzovatelej: 1 }, 'god');
  assert.strictEqual(p.luchshij.id, 'free'); assert.strictEqual(p.luchshij.god, 0);
});
ok('3 отчёта и 3 компании — Старт', () => {
  const p = T.podobrat(D, { otchetov: 3, slezhenie: 3, polzovatelej: 1 }, 'god');
  assert.strictEqual(p.luchshij.id, 'start'); assert.strictEqual(p.luchshij.god, 4700);
});
ok('5 отчётов, 3 компании: за год Про дешевле, чем Старт + пакет', () => {
  const p = T.podobrat(D, { otchetov: 5, slezhenie: 3, polzovatelej: 1 }, 'god');
  assert.strictEqual(p.luchshij.id, 'pro'); assert.strictEqual(p.luchshij.god, 14300);
  assert.strictEqual(p.alternativa.id, 'start'); assert.strictEqual(p.alternativa.god, 4700 + 990 * 12);
});
ok('5 отчётов, 3 компании: помесячно Старт + 1 пакет на 10 ₽ дешевле Про', () => {
  const p = T.podobrat(D, { otchetov: 5, slezhenie: 3, polzovatelej: 1 }, 'mes');
  assert.strictEqual(p.luchshij.id, 'start'); assert.strictEqual(p.luchshij.pakety, 1);
  assert.strictEqual(p.alternativa.id, 'pro'); assert.strictEqual(p.alternativa.god - p.luchshij.god, 120);
});
ok('слежение за 5 — Старт не подходит, Про', () => {
  const p = T.podobrat(D, { otchetov: 5, slezhenie: 5, polzovatelej: 1 }, 'god');
  assert.strictEqual(p.luchshij.id, 'pro'); assert.strictEqual(p.luchshij.pakety, 0);
});
ok('25 отчётов — Про + 1 пакет, а не Бизнес', () => {
  const p = T.podobrat(D, { otchetov: 25, slezhenie: 5, polzovatelej: 1 }, 'god');
  assert.strictEqual(p.luchshij.id, 'pro'); assert.strictEqual(p.luchshij.pakety, 1);
  assert.strictEqual(p.alternativa.id, 'biznes'); assert.strictEqual(p.alternativa.god - p.luchshij.god, 21720);
});
ok('2 сотрудника — только Бизнес', () => {
  const p = T.podobrat(D, { otchetov: 1, slezhenie: 0, polzovatelej: 2 }, 'mes');
  assert.strictEqual(p.luchshij.id, 'biznes'); assert.strictEqual(p.luchshij.god, 4990 * 12);
});
ok('Делопись — не ниже Про', () => {
  const p = T.podobrat(D, { otchetov: 0, slezhenie: 0, polzovatelej: 1, delopis: true }, 'god');
  assert.strictEqual(p.luchshij.id, 'pro');
});
ok('больше 5 людей или 50 компаний — индивидуально', () => {
  assert.ok(T.podobrat(D, { otchetov: 1, slezhenie: 0, polzovatelej: 6 }, 'god').individualno);
  assert.ok(T.podobrat(D, { otchetov: 1, slezhenie: 51, polzovatelej: 1 }, 'god').individualno);
});
ok('бесплатный тариф не докупает пакеты', () => {
  const p = T.podobrat(D, { otchetov: 1, slezhenie: 0, polzovatelej: 1 }, 'god');
  assert.strictEqual(p.luchshij.id, 'start');
});
ok('при равной цене выбираем тариф выше', () => {
  const D2 = JSON.parse(JSON.stringify(D)); D2.tarify[2].mesyac = 490 + 990;
  const p = T.podobrat(D2, { otchetov: 5, slezhenie: 3, polzovatelej: 1 }, 'mes');
  assert.strictEqual(p.luchshij.id, 'pro');
});
ok('окупаемость на ОСН совпадает с калькулятором главной', () => {
  // главная: 3 000 000 → НДС 540 984, штраф 108 197, пени по формуле 2 лет
  const o = T.okupaemost(D, { summa: 3000000, rezhim: 'osn', oborot: 0 }, 14300);
  assert.strictEqual(Math.round(o.nalog), 540984);
  assert.strictEqual(Math.round(o.shtraf), 108197);
  const pen = 0.14 * (30 / 300 + 60 / 150 + 640 / 300);
  assert.strictEqual(Math.round(o.peni), Math.round(540983.6 * pen));
  assert.ok(o.razVLet >= 50 && o.razVLet < 100);
});
ok('УСН «доходы»: налогового риска нет, считаем от простоя', () => {
  const o = T.okupaemost(D, { summa: 3000000, rezhim: 'usn6', oborot: 2100000 }, 14300);
  assert.strictEqual(o.naKonu, 0); assert.strictEqual(o.razVLet, null);
  assert.strictEqual(Math.round(o.prostoj), 2000000);
});
ok('маленькая сделка: тариф дороже ошибки — razVLet 0', () => {
  const o = T.okupaemost(D, { summa: 30000, rezhim: 'osn', oborot: 0 }, 14300);
  assert.strictEqual(o.razVLet, 0);
});
ok('годовая скидка не меньше 20% и не больше 21%', () => {
  D.tarify.filter(t => t.mesyac).forEach(t => {
    const sk = 1 - t.god / (t.mesyac * 12);
    assert.ok(sk >= 0.2 && sk < 0.21, t.id + ' ' + sk);
    assert.strictEqual(t.god % 100, 0);
    assert.strictEqual(t.god, Math.floor(t.mesyac * 12 * 0.8 / 100) * 100);
  });
});
console.log(`\n${n} тестов пройдено`);
