// proba-svetlaya-tema (15.11.2026): светлая тема главной — плитки «Что умеет Делоскоп», карточки «Условий» и строка
// «Чего здесь не хватает?». Текст — не ниже 4,5 : 1 (WCAG 1.4.3), латунная кромка видна на бумаге и на белом
// (не ниже 3 : 1, WCAG 1.4.11), под карточками «Условий» нет второй подложки, под рейкой первого экрана есть воздух.
// Запуск: node --test tests/svetlaya_tema_glavnaya.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const G = chitat('index.html');
const CSS = G.slice(G.indexOf('<style>'), G.indexOf('</style>'));

const L = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const kontrast = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// светлая палитра главной — первый :root страницы; --on-accent — из дизайн-системы
const koren = /:root\{([^}]+)\}/.exec(CSS)[1];
const token = (imya) => {
  const m = new RegExp('--' + imya + ':\\s*(#[0-9A-Fa-f]{6})\\b').exec(koren) || new RegExp('--' + imya + ':(#[0-9A-Fa-f]{6})\\b').exec(chitat('css/ds.css'));
  assert.ok(m, 'нет токена --' + imya);
  return m[1];
};
// значение свойства из правила с точным селектором (первое правило вне @media)
const pravilo = (sel) => {
  const i = CSS.indexOf('\n' + sel + '{');
  assert.ok(i >= 0, 'нет правила ' + sel);
  return CSS.slice(i + sel.length + 2, CSS.indexOf('}', i));
};
const svojstvo = (sel, sv) => {
  const m = new RegExp('(?:^|;)' + sv + ':([^;]+)').exec(pravilo(sel));
  assert.ok(m, sel + ': нет ' + sv);
  return m[1];
};
const cvet = (zn) => {
  const v = /var\(--([a-z0-9-]+)(?:,(#[0-9A-Fa-f]{6}))?\)/.exec(zn);
  if (v) { try { return token(v[1]); } catch (e) { if (v[2]) return v[2]; throw e; } }
  const h = /#[0-9A-Fa-f]{6}\b/.exec(zn);
  assert.ok(h, 'цвет не разобран: ' + zn);
  return h[0];
};

test('светлая тема главной: текст плиток услуг, карточек «Условий» и строки «Чего здесь не хватает?» — не ниже 4,5 : 1', () => {
  const bumaga = cvet(svojstvo('body', 'background'));
  const plitka = cvet(svojstvo('.umeet a', 'background'));
  const belaya = cvet(svojstvo('.white', 'background'));
  const kartochka = cvet(svojstvo('.ceny .usl li', 'background'));
  const pole = cvet(svojstvo('.uv__r input', 'background'));
  const para = [
    // плитки
    ['.umeet small', 'color', plitka], ['.umeet span', 'color', plitka], ['.umeet i', 'color', plitka], ['.umeet svg', 'color', plitka],
    ['.umeet a', 'color', plitka],
    ['.uslugi__vse a', 'color', bumaga], ['.lead', 'color', bumaga], ['body', 'color', bumaga],
    // строка «Чего здесь не хватает?»
    ['.uv__q', 'color', bumaga], ['.uv__n', 'color', bumaga], ['.uv__n a', 'color', bumaga], ['.uv__r button', 'color', bumaga],
    ['.uv__r input', 'color', pole], ['.uv__r input::placeholder', 'color', pole],
    // «Условия»
    ['.ceny .usl', 'color', kartochka], ['.ceny .usl b', 'color', kartochka], ['body', 'color', belaya], ['.note', 'color', belaya],
  ];
  for (const [sel, sv, fon] of para) {
    const c = cvet(svojstvo(sel, sv));
    const k = kontrast(c, fon);
    assert.ok(k >= 4.5, sel + ': ' + c + ' на ' + fon + ' = ' + k.toFixed(2) + ' : 1');
  }
  // ссылка «Тарифы →» в карточке и кнопка «Отправить» при наведении
  assert.ok(kontrast(token('accent'), kartochka) >= 4.5);
  assert.ok(kontrast(token('on-accent'), token('accent')) >= 4.5);
  // карточка «Условий» отличается от своей секции, плитка — от бумаги: иначе граница держится на одной линии
  assert.notStrictEqual(kartochka.toUpperCase(), belaya.toUpperCase());
  assert.notStrictEqual(plitka.toUpperCase(), bumaga.toUpperCase());
});

test('светлая тема главной: латунная кромка плиток и карточек видна — 2 px, не ниже 3 : 1 на белом и на бумаге', () => {
  const re = /\n:root:not\(\[data-theme="dark"\]\) \.umeet a::before,:root:not\(\[data-theme="dark"\]\) \.ceny \.usl li::before\{height:2px;background:linear-gradient\(90deg,var\(--mat-latun-sv,(#[0-9A-F]{6})\) 55%,var\(--mat-svet0,#FFFFFF00\)\)\}/;
  const m = re.exec(CSS);
  assert.ok(m, 'правило кромки для светлой темы на месте; цвет — запасным значением var(--mat-*,#…)');
  for (const fon of [token('card'), token('bg')]) {
    assert.ok(kontrast(m[1], fon) >= 3, 'кромка ' + m[1] + ' на ' + fon + ' = ' + kontrast(m[1], fon).toFixed(2) + ' : 1');
  }
  assert.ok(CSS.indexOf(m[0]) > CSS.indexOf('\n.ceny .usl li::before{'), 'правило светлой темы — после общего, иначе не перекроет');
  // общая кромка (тёмная тема) — прежняя, светлая латунь на синем
  assert.match(pravilo('.umeet a::before'), /var\(--mat-blik,#E3C778\),var\(--mat-latun,#B58A32\) 55%/);
  const avto = (chitat('css/tema.css').match(/\/\*<avto>\*\/[\s\S]*?\/\*<\/avto>\*\//) || [''])[0];
  assert.doesNotMatch(avto, /mat-latun-sv/, 'материалы тёмная тема не перекрашивает');
});

test('«Условия»: под карточками нет второй подложки — общий стиль блока условий отчёта (.usl из js/usloviya.js) сюда не протекает', () => {
  assert.match(chitat('js/usloviya.js'), /'\.usl\{border-radius:16px;background:var\(--bg,#F5F1E6\)/, 'источник протечки — на месте; исчезнет — тест упростить');
  const p = CSS.slice(CSS.indexOf('\n.ceny .usl{display:grid'));
  assert.match(p.slice(0, p.indexOf('}')), /;background:none;border-radius:0$/);
});

test('под рейкой первого экрана есть воздух: от кромки до заголовка следующего блока — не меньше 32 px на любом экране', () => {
  const m = /\nhtml:not\(\.rezhim-otcheta\) \.vhody\{padding-top:clamp\((\d+)px,[\d.]+vw,(\d+)px\)\}/.exec(CSS);
  assert.ok(m, 'отступ блока под рейкой задан');
  assert.ok(+m[1] >= 32 && +m[2] >= +m[1], 'минимум ' + m[1] + ' px');
  const tel = CSS.slice(CSS.indexOf('@media (max-width:600px){\n  /* на телефоне все шесть услуг'));
  assert.doesNotMatch(tel.slice(0, tel.indexOf('\n}')), /\.vhody\{[^}]*padding-top/, 'телефон отступ не обнуляет');
});
