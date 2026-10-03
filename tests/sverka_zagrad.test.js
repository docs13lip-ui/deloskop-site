// [Ночные запуски] 03.10 22:05 — sverka-zagrad-v1: сверка разборов по текстам актов (ВС 305-ЭС24-16889, КС 3476-О) + «Вокфорс» v1.1 ([Право] 21:10 разд. 3).
const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs'); const path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
test('заградительные комиссии: цитата ВС дословно, без «Не должен»', () => {
  const t = R('praktika/115-fz/zagraditelnye-komissii/index.html');
  assert.ok(!/Не должен вводить/.test(t));
  assert.match(t, /кредитная\s+организация\s+не\s+должна\s+вводить/);
  assert.match(t, /то\s+есть\s+приобретает\s+заградительный\s+характер/);
});
test('305-ЭС24-5195: в таблице только подтверждённое (без «резервного» тарифа 30 000 ₽)', () => {
  const t = R('tests/praktika/zagraditelnye-komissii.html');
  assert.ok(!/резервный» тариф 30/.test(t));
  assert.match(t, /«штраф»\s+50\s000\s+₽\s+за\s+непредставление\s+документов/);
});
test('«Вокфорс»: суд признаёт начисление незаконным, а не «отменяет налог»; без «в оспоренной части»', () => {
  const t = R('praktika/nalogi/vokfors-rekonstrukciya/index.html');
  assert.ok(!/отменили (95,4|107,7)/.test(t));
  assert.ok(!/в оспоренной части/.test(t));
  assert.match(t, /Спор в\s+Верховном\s+суде\s+—\s+107,7/);
});
