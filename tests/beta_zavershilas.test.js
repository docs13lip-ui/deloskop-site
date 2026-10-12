// chislo-bystryh-v1 (12.10.2026, [Ночные запуски]): после выключения беты полоса пишет
// «Бета завершилась {beta_do}». 12.10 бету выключили, а beta_do осталась 2026-10-13 —
// на всех страницах стояло «Бета завершилась 13 октября» в день 12 октября.
// Сторож: при "beta": false дата beta_do не позже сегодняшнего дня по Москве.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const T = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tarify', 'tarify.json'), 'utf8'));

function segodnyaMsk(ms) {
  return new Date(ms + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

test('beta:false — beta_do не в будущем (полоса «Бета завершилась» говорит о прошедшем дне)', () => {
  if (T.beta !== false || !T.beta_do) return;
  const s = segodnyaMsk(Date.now());
  assert.ok(T.beta_do <= s, 'tarify.json: beta:false, а beta_do = ' + T.beta_do + ' позже сегодняшнего ' + s +
    ' — поставьте день, когда бету выключили, и пересоберите: sobrat_tarify, sobrat_shapku, kartochki.py perepechatat');
});

test('segodnyaMsk: полночь по Москве', () => {
  assert.strictEqual(segodnyaMsk(Date.parse('2026-10-12T20:59:59Z')), '2026-10-12');
  assert.strictEqual(segodnyaMsk(Date.parse('2026-10-12T21:00:00Z')), '2026-10-13');
});
