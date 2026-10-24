// tipograf-chisla-v1 (24.10.2026): «2 | проверки», «35 | факторов», «12 | общедоступных критериев», «ул. | Неглинная»,
// «г. | Сергиеву Посаду» и «слово | —» рвались переносом — замер Chromium 390/1280 на 87 страницах (без /company/): 321 разрыв
// «число | слово». Правило — tipograf_statej.chislo_slovo/sokr (Python) и tipo() скриптов ленты и калькулятора (JS = Python).
// Номер — не счёт: после «п.», «ст.», «ч.», «№», «статья», «пункт», «критерий», «приложение», «код»… пробел остаётся обычным —
// иначе «п. 5 ст. 7.7 закона № 115‑ФЗ» стал бы одной неразрывной строкой шире телефона.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OBRAZCY = ['это 2 проверки из дневного лимита', '35 факторов, 4 стоп-фактора', 'п. 5 ст. 7.7 закона № 115-ФЗ',
  'критерий 11 приложения 2 к Концепции', 'из 12 общедоступных критериев', '1/300 ставки', 'из 3 323 заявленных',
  'ул. Неглинная, д. 12', 'по г. Сергиеву Посаду', 'т. е. так', 'пп. 10 и 11 ст. 7', 'в 1–3 предложениях',
  'Подписи 12,5 и 14 пикселей', 'в 2025 году', 'абз. 3 пп. 1', 'шаг 2 и вопрос', '№ 12 от 5 марта', 'код 105 означает',
  'Без входа — 10 проверок в день', 'от 17 апреля 2026 г.; ООО «Пример»'];

function python() {
  const kod = 'import sys, json; sys.path.insert(0, "tests"); import tipograf_statej as T; ' +
    'print(json.dumps([T.tekst(x) for x in json.loads(sys.argv[1])], ensure_ascii=False))';
  return JSON.parse(execFileSync('python3', ['-c', kod, JSON.stringify(OBRAZCY)], { cwd: ROOT, encoding: 'utf8' }));
}

test('Python: счёт — неразрывно, номер статьи и пункта — переносится', () => {
  const py = python();
  const v = (s) => py[OBRAZCY.indexOf(s)];
  assert.ok(v('это 2 проверки из дневного лимита').includes('2&nbsp;проверки'));
  assert.ok(v('35 факторов, 4 стоп-фактора').startsWith('35&nbsp;факторов, 4&nbsp;стоп'));
  assert.ok(v('из 12 общедоступных критериев').includes('12&nbsp;общедоступных'));
  assert.ok(v('из 3 323 заявленных').includes('3&nbsp;323&nbsp;заявленных'));
  assert.ok(v('ул. Неглинная, д. 12').includes('ул.&nbsp;Неглинная, д.&nbsp;12'));
  assert.ok(v('по г. Сергиеву Посаду').includes('г.&nbsp;Сергиеву'));
  assert.ok(v('т. е. так').startsWith('т.&nbsp;е.'));
  // номер, а не счёт — пробел после числа обычный
  assert.ok(v('п. 5 ст. 7.7 закона № 115-ФЗ').includes('5 ст.') && v('п. 5 ст. 7.7 закона № 115-ФЗ').includes('7.7 закона'));
  assert.ok(v('критерий 11 приложения 2 к Концепции').includes('11 приложения') && v('критерий 11 приложения 2 к Концепции').includes('2 к'));
  assert.ok(v('пп. 10 и 11 ст. 7').includes('11 ст.'));
  assert.ok(v('шаг 2 и вопрос').includes('2 и'));
  assert.ok(v('№ 12 от 5 марта').includes('12 от'));
  assert.ok(v('код 105 означает').includes('105 означает'));
  assert.ok(v('1/300 ставки').includes('300 ставки'));
  assert.ok(v('абз. 3 пп. 1').includes('3 пп.'));
});

test('tipo() в скриптах ленты и калькулятора — как Python', () => {
  const py = python();
  for (const f of ['obnovleniya.js', 'obnovleniya/index.html', 'tarify/tarify.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = s.match(/function tipo\(s\)\{[\s\S]*?\\u2011"\);\}/);
    assert.ok(m, f);
    const tipo = new Function(m[0] + '; return tipo;')();
    OBRAZCY.forEach((x, i) => assert.strictEqual(tipo(x).replace(/ /g, '&nbsp;').replace(/‑/g, '&#8209;'), py[i], f + ': ' + x));
  }
});

test('руками и в сборщиках: «слово — …» и счёт на страницах вне типографа', () => {
  const est = (f, s) => assert.ok(fs.readFileSync(path.join(ROOT, f), 'utf8').includes(s), f + ': ' + s);
  est('delopis/index.html', 'это 2&nbsp;проверки');
  est('delopis/index.html', 'без&nbsp;штата&nbsp;— запрет');
  est('115-fz/index.html', 'ограничили&nbsp;— план');
  est('115-fz/index.html', 'за&nbsp;15&nbsp;минут');
  est('obnovleniya/index.html', 'Новое&nbsp;— сверху.');
  est('skoraya-115-fz/index.html', 'Цена&nbsp;— справочная;');
  est('nalogi/kalkulyator-tehnicheskij-postavshchik/index.html', 'на&nbsp;прибыль&nbsp;— худший');
  est('nalogi/kalkulyator-tehnicheskij-postavshchik/index.html', 'просрочки&nbsp;— 1/150');
  est('nalogi/nagruzka-po-otraslyam-2025/index.html', 'взносы&nbsp;— справочно');
});
