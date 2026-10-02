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
  // С 28.09 (п. 82) владелец счёта — отдельной строкой блока «Проверка реквизитов» (js/acc.js, tests/acc.test.js).
  assert.match(fs.readFileSync(path.join(KOREN, 'js/acc.js'), 'utf8'), /'Счёт принадлежит поставщику', verdikt: 'Не' \+ NB \+ 'подтверждено'/);
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
  assert.match(chitat('index.html'), /[Нн]е&nbsp;проверено/);
  assert.match(chitat('indeks/index.html'), /Нет данных — не нарушение/);
});

// Прорыв «Т» (27.09, 10:05): честность — и для картинок. Правка текста не чинит смысл, если его несёт рисунок.
// Словарь запретов проверяем внутри <svg>, в aria-label, alt и title — там, где читатель видит смысл раньше подписи.
const ZAPRETY = [
  [/×\s*2(?!\d)/, '«×2» — обещание кратных шансов до отчёта точности'],
  [/(?<!не\s)(?<!не&nbsp;)вероятност/i, '«вероятность» без отрицания'],
  [/шанс/i, '«шанс» на рисунке'],
  [/гарантир/i, '«гарантируем» на рисунке'],
  [/заблокирован\S*\s+(?:\S+\s+){0,3}(?:млн|миллион)/i, '«заблокировано … млн» без источника'],
];
function kuskiRisunkov(t) {
  const kuski = [];
  for (const m of t.matchAll(/<svg[\s\S]*?<\/svg>/g)) kuski.push(m[0]);
  for (const m of t.matchAll(/\s(?:aria-label|alt|title)="([^"]*)"/g)) kuski.push(m[1]);
  return kuski;
}

test('Т: рисунки и подписи для незрячих не обещают больше текста (словарь честности)', () => {
  for (const f of html) {
    const t = fs.readFileSync(f, 'utf8');
    for (const k of kuskiRisunkov(t)) for (const [re, pochemu] of ZAPRETY) {
      assert.ok(!re.test(k), path.relative(KOREN, f) + ': ' + pochemu + ' → «' + (k.match(re) || [''])[0] + '»');
    }
  }
});

test('Т: словарь сам по себе работает (ловит «×2» и пропускает «не вероятность»)', () => {
  const plohoj = '<svg><text class="x2">×2</text></svg>';
  assert.ok(kuskiRisunkov(plohoj).some((k) => ZAPRETY[0][0].test(k)));
  const horoshij = '<svg role="img" aria-label="Шкала — оценка признаков, не вероятность."></svg>';
  assert.ok(!kuskiRisunkov(horoshij).some((k) => ZAPRETY.some(([re]) => re.test(k))));
});

test('Г: шкала на /indeks/ — зоны и отметки 1…99, без дуг «×2»', () => {
  const t = chitat('indeks/index.html');
  const svg = t.match(/<svg class="lineyka"[\s\S]*?<\/svg>/)[0];
  assert.ok(!/class="x2"/.test(t), 'остался класс .x2');
  for (const z of ['Много признаков риска', 'Есть серьёзные', 'Есть вопросы', 'Без серьёзных сигналов']) assert.ok(svg.includes(z), z);
  assert.match(svg, /class="tk">1</);
  assert.match(svg, /class="tk">99</);
  assert.ok(!/компания закроет текущие долги вдвое/.test(t));
});
