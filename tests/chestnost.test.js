// Честность формулировок — замечания А–Д внешнего аудита 27.09.2026 (claude/Внешний_аудит_27.09.md).
// Фразы, которые обещают больше, чем доказано, не должны вернуться на сайт.
// Запуск: node --test tests/chestnost.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const html = [];
(function obhod(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'tests' || e.name === 'сайт') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) obhod(p);
    else if (e.name.endsWith('.html')) html.push(p);
  }
})(KOREN);

test('А: цифра о блокировках карт граждан (161-ФЗ) не используется как довод про 115-ФЗ', () => {
  for (const f of html) {
    const t = fs.readFileSync(f, 'utf8');
    assert.ok(!/2[–-]3\s*(?:&nbsp;)?(?:миллиона|млн)\s+счетов/.test(t), path.relative(KOREN, f) + ': «2–3 миллиона счетов»');
  }
  assert.match(chitat('index.html'), /cbr\.ru\/counteraction_m_ter\/platform_zsk/);
});

test('Б: «Проверь счёт» — формат реквизитов ≠ владелец счёта', () => {
  const t = chitat('proverit-schet/index.html');
  assert.match(t, /Принадлежность счёта поставщику не подтверждена/);
  assert.match(t, /'Владелец счёта'/);
  assert.ok(!/'Можно платить'/.test(t), 'заголовок «Можно платить» обещает больше, чем проверено');
  assert.ok(!/Так ловится подмена реквизитов/.test(t));
});

test('В: прогноз ЗСК помечен как наша оценка, экран в три части', () => {
  const r = chitat('report.html');
  assert.match(r, /не статус Банка России/);
  for (const s of ['Подтверждено источником', 'Рассчитано Делоскопом', 'Проверить не удалось']) assert.ok(r.includes(s), s);
  assert.match(chitat('index.html'), /Прогноз ЗСК · наша оценка/);
  assert.match(chitat('pasport/index.html'), /не статус Банка России/);
});

test('Г: Индекс не обещает вероятностей до отчёта точности', () => {
  const t = chitat('indeks/index.html');
  assert.ok(!/вдвое больше шансов беды/.test(t));
  assert.ok(!/индекс учится на том, что реально случилось/.test(t));
  assert.match(t, /объяснимая оценка признаков/);
  const m = JSON.parse(chitat('indeks/metodika-v1.json'));
  assert.match(m.shkala ? m.shkala.poyasnenie : JSON.stringify(m), /не проверена/);
});

test('Д: «не проверено» ≠ «не обнаружено» — объяснено на главной и в методике', () => {
  assert.match(chitat('index.html'), /не&nbsp;проверено/);
  assert.match(chitat('indeks/index.html'), /Нет данных — не нарушение/);
});
