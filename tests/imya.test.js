// kavychki-v1 (10.10.2026, [Ночные-3]): названия из ЕГРЮЛ — с «ёлочками» и „лапками“, буквы — как в реестре.
// Найдено отрисовкой живого ответа /api/check (6164266561, 10.10): ПАО "РОССЕТИ ЮГ" прямыми кавычками
// в заголовке отчёта, в PDF-досье, в Паспорте (и в его подписи с отпечатком) и в разделе «Профиль».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I = require('../js/imya.js');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');

const SLUCHAI = [
  ['ПАО "РОССЕТИ ЮГ"', 'ПАО «РОССЕТИ ЮГ»'],
  ['ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "РОССЕТИ ЮГ"', 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «РОССЕТИ ЮГ»'],
  // вложенная без закрывающей — так часто в ЕГРЮЛ
  ['АО "АВИАКОМПАНИЯ "СИБИРЬ"', 'АО «АВИАКОМПАНИЯ „СИБИРЬ“»'],
  ['ООО "ТД "ЧЕРНОЗЕМЬЕ""', 'ООО «ТД „ЧЕРНОЗЕМЬЕ“»'],
  ['ПАО "ТАТНЕФТЬ" ИМ. В.Д. ШАШИНА', 'ПАО «ТАТНЕФТЬ» ИМ. В.Д. ШАШИНА'],
  ['ПАО "РОССЕТИ МОСКОВСКИЙ РЕГИОН", ПАО "РОССЕТИ МР"', 'ПАО «РОССЕТИ МОСКОВСКИЙ РЕГИОН», ПАО «РОССЕТИ МР»'],
  ['ООО ТД"ЛЕНТА"', 'ООО ТД«ЛЕНТА»'],
  ['АО "О`КЕЙ"', 'АО «О`КЕЙ»'],
  ['ООО “АЛЬФА”', 'ООО «АЛЬФА»'],
  ['БАНК ВТБ (ПАО)', 'БАНК ВТБ (ПАО)'],
  ['ООО «Пример»', 'ООО «Пример»'],
  ['', ''],
];

test('кавычки: «ёлочки» снаружи, „лапки“ внутри, буквы не меняются', () => {
  for (const [vh, ozh] of SLUCHAI) {
    const v = I.kavychki(vh);
    assert.strictEqual(v, ozh, vh);
    assert.strictEqual(v.replace(/[«»„“"”]/g, ''), vh.replace(/[«»„“"”]/g, ''), 'изменились буквы: ' + vh);
    assert.ok(!/["”]/.test(v), 'прямая кавычка осталась: ' + v);
  }
});

test('повторный вызов ничего не меняет; кавычки парные', () => {
  for (const [vh] of SLUCHAI) {
    const a = I.kavychki(vh);
    assert.strictEqual(I.kavychki(a), a, vh);
    assert.strictEqual((a.match(/«/g) || []).length, (a.match(/»/g) || []).length, a);
    assert.strictEqual((a.match(/„/g) || []).length, (a.match(/“/g) || []).length, a);
  }
  assert.strictEqual(I.kavychki(null), null);
  assert.strictEqual(I.kavychki(undefined), undefined);
});

test('ispravitOtvet: company и строки «…наименование» в досье; остальное не трогаем', () => {
  const r = {
    company: { inn: '6164266561', name_short: 'ПАО "РОССЕТИ ЮГ"', name_full: 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "РОССЕТИ ЮГ"', address: 'УЛ. "ТЕСТ"' },
    verdict: 'Слово "как есть"',
    dossier: { sections: [
      { id: 'profile', rows: [['Полное наименование', 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "РОССЕТИ ЮГ"'], ['Юридический адрес', 'УЛ. "ТЕСТ"']] },
      { id: 'x', rows: null },
      { id: 'y', rows: [['Сокращённое наименование', 'ПАО "РОССЕТИ ЮГ"'], 'мусор', [1, 2]] },
    ] },
  };
  assert.strictEqual(I.ispravitOtvet(r), r);
  assert.strictEqual(r.company.name_short, 'ПАО «РОССЕТИ ЮГ»');
  assert.strictEqual(r.company.name_full, 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «РОССЕТИ ЮГ»');
  assert.strictEqual(r.dossier.sections[0].rows[0][1], 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «РОССЕТИ ЮГ»');
  assert.strictEqual(r.dossier.sections[2].rows[0][1], 'ПАО «РОССЕТИ ЮГ»');
  assert.strictEqual(r.company.address, 'УЛ. "ТЕСТ"', 'адрес не название');
  assert.strictEqual(r.dossier.sections[0].rows[1][1], 'УЛ. "ТЕСТ"');
  assert.strictEqual(r.verdict, 'Слово "как есть"');
  assert.strictEqual(I.ispravitOtvet(null), null);
  assert.deepStrictEqual(I.ispravitOtvet({}), {});
});

test('подключено там, где показываем ответ API: отчёт, подсказки, PDF-досье, Паспорт, кабинет', () => {
  const idx = chitat('index.html');
  assert.ok(idx.includes('<script src="/js/imya.js" defer></script>'));
  assert.ok(/DlkImya\.ispravitOtvet\(x\.j\)/.test(idx), 'главная: ответ /api/check не исправляется');
  assert.ok(/DlkImya\.kavychki\(it\.name\)/.test(idx), 'подсказки при вводе');
  const rep = chitat('report.html');
  assert.ok(rep.includes('<script src="/js/imya.js"></script>') && /DlkImya\.ispravitOtvet\(d\);return render\(d\)/.test(rep), 'PDF-досье');
  const pas = chitat('pasport/kontragent/index.html');
  assert.ok(pas.includes('<script src="/js/imya.js"></script>') && /DlkImya\.ispravitOtvet\(r\);var go=/.test(pas), 'Паспорт');
  assert.ok(chitat('cabinet.html').includes('<script src="/js/imya.js"></script>'), 'кабинет: недавние проверки');
  assert.ok(/kav\(x\.name\)/.test(chitat('js/nedavnie.js')));
  assert.ok(/kav\(r\.nm\)/.test(chitat('js/portfel.js')));
});

test('модуль без сырых неразрывных пробелов и типографских знаков в коде (брать патч текстом)', () => {
  const s = chitat('js/imya.js');
  const kod = s.split('\n').filter((l) => !/^\s*(\/\*|\*|\/\/)/.test(l)).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.ok(!/[\u00a0«»„“”]/.test(kod), 'в коде — только \\u-последовательности');
});

// kavychki-v1.1 (10.10.2026, [Ночные-3]): те же «ёлочки» везде, где показываем название компании —
// кабинет (история и слежение), «Папка проверок», «Проверь счёт», Делопись, свой Паспорт,
// «Кому вы платите» и Финцентр (названия из выписки 1С), «Скорая 115-ФЗ», «Наличные» (Щит).
test('v1.1: модуль подключён и вызывается на остальных страницах с названиями', () => {
  const nado = {
    'proverit-schet/index.html': [/<script src="\/js\/imya\.js" defer><\/script>/, /DlkImya\.ispravitOtvet\(x\.j\);render\(r,sel,local,x\.j,null\)/],
    'delopis/index.html': [/<script src="\/js\/imya\.js"><\/script>/, /DlkImya\.ispravitOtvet\(j\)/],
    'pasport/index.html': [/<script src="\/js\/imya\.js"><\/script>/],
    'kontragenty-iz-vypiski/index.html': [/<script src="\/js\/imya\.js"><\/script>/, /esc\(top\.name\?kav\(top\.name\)/, /var name=kav\(/],
    'skoraya-115-fz/index.html': [/<script src="\/js\/imya\.js"><\/script>/],
    'nalichnye/index.html': [/<script src="\/js\/imya\.js"><\/script>/],
    'cabinet.html': [/esc\(r\.name\?\(window\.DlkImya\?DlkImya\.kavychki\(r\.name\)/],
    'js/papka-proverok.js': [/esc\(g\.nm \? kav\(g\.nm\)/],
    'kontragenty-iz-vypiski/engine.js': [/return kav\(s\.name\) \|\| s\.inn/],
    'kontragenty-iz-vypiski/fincentr.js': [/esc\(kav\(x\.name\)/],
    'skoraya-115-fz/app.js': [/esc\(kav\(r\.name\)\)/],
    'nalichnye/shchit-ui.js': [/esc\(kav\(r\.client\.name\)/],
  };
  for (const [f, rx] of Object.entries(nado)) {
    const s = chitat(f);
    for (const r of rx) assert.ok(r.test(s), f + ': нет ' + r);
  }
  // свой Паспорт: оба ответа /api/check исправляются до показа
  assert.strictEqual((chitat('pasport/index.html').match(/if\(x\.ok&&window\.DlkImya\)DlkImya\.ispravitOtvet\(x\.j\)/g) || []).length, 2);
  // imya.js на странице раньше модулей, которые его зовут
  for (const [f, mod] of [['skoraya-115-fz/index.html', '/skoraya-115-fz/app.js'], ['nalichnye/index.html', '/nalichnye/shchit-ui.js'], ['kontragenty-iz-vypiski/index.html', '/kontragenty-iz-vypiski/engine.js']]) {
    const s = chitat(f);
    assert.ok(s.indexOf('/js/imya.js') < s.indexOf(mod), f);
  }
});

test('v1.1: без модуля в браузере (и в node) движки выписки отдают название как есть', () => {
  const E = require('../kontragenty-iz-vypiski/engine.js');
  assert.ok(E && typeof E === 'object');
  const src = chitat('kontragenty-iz-vypiski/engine.js');
  assert.ok(/typeof window !== 'undefined' && window\.DlkImya/.test(src));
});
