// vitrina-v1: сторож «Витрины экосистемы» на главной. Сборщик — tests/sobrat_vitrinu.py (из partials/vitrina.json).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const V = JSON.parse(chitat('partials/vitrina.json'));
const html = chitat('index.html');
const blok = () => {
  const a = html.indexOf('<!--vitrina-->'), b = html.indexOf('<!--/vitrina-->');
  assert.ok(a > 0 && b > a, 'метки <!--vitrina-->…<!--/vitrina--> есть в index.html');
  return html.slice(a, b);
};

test('витрина собрана из partials/vitrina.json (после правки — python3 tests/sobrat_vitrinu.py)', () => {
  execFileSync('python3', [path.join(KOREN, 'tests', 'sobrat_vitrinu.py'), '--check'], { cwd: KOREN, encoding: 'utf8' });
});

test('каждый продукт — экспонат с якорем, статусом, тремя фактами и одним действием; порядок — как в JSON', () => {
  const b = blok();
  let poz = 0;
  // на странице: сначала работающие (зал), потом «В разработке» — внутри каждой группы порядок JSON
  const poryadok = V.eksponaty.filter((x) => x.status !== 'razrabotka').concat(V.eksponaty.filter((x) => x.status === 'razrabotka'));
  for (const x of poryadok) {
    const i = b.indexOf(' id="' + x.id + '"');
    assert.ok(i > poz, 'экспонат ' + x.id + ' на месте и по порядку');
    poz = i;
    const kon = b.indexOf('</li>', b.indexOf('</ul>', i));
    const e = b.slice(i, kon);
    assert.strictEqual((e.match(/<li>/g) || []).length, 3, x.id + ': три факта');
    assert.ok(e.includes('data-status="' + x.status + '"'), x.id + ': статус');
    assert.ok(e.includes('href="' + x.ssylka + '"'), x.id + ': ссылка на страницу продукта');
    assert.ok(b.includes('href="#' + x.id + '"'), x.id + ': есть в карте витрины');
  }
  // id не повторяются на странице
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.strictEqual(new Set(ids).size, ids.length, 'id на главной уникальны');
});

test('заголовки: у работающих продуктов — h2, у будущих — h3 под «В разработке»; уровни не пропущены', () => {
  const b = blok();
  const zhivye = V.eksponaty.filter((x) => x.status !== 'razrabotka').length;
  const budushie = V.eksponaty.length - zhivye;
  assert.strictEqual((b.match(/<h2 class="vit-e__h">/g) || []).length, zhivye);
  assert.strictEqual((b.match(/<h3 class="vit-b__h">/g) || []).length, budushie);
  assert.ok(b.indexOf('id="vitrina-skoro"') < b.indexOf('class="vit-b__h"'));
});

test('будущие продукты — «в разработке», без дат и обещаний; во всей витрине нет «!», цен и процентов', () => {
  const b = blok().replace(/<script[\s\S]*?<\/script>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '');
  const tekst = b.replace(/<[^>]+>/g, ' ');
  assert.ok(!/!/.test(tekst), 'без «!»');
  assert.ok(!/₽|\d\s*(%|&nbsp;%)/.test(tekst), 'без цен и процентов');
  assert.ok(!/(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)|нейросет/i.test(tekst), 'ИИ не упоминаем');
  for (const x of V.eksponaty.filter((y) => y.status === 'razrabotka')) {
    assert.ok(/выход/.test(x.dejstvie), x.id + ': следить за выходом');
    assert.ok(!/\b20\d\d\b|январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|квартал/i.test(x.polza + x.umeet.join(' ')), x.id + ': без сроков');
  }
});

test('JSON-LD ItemList: все продукты, якоря витрины, по порядку', () => {
  const m = blok().match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'есть JSON-LD');
  const d = JSON.parse(m[1]);
  assert.strictEqual(d['@type'], 'ItemList');
  assert.deepStrictEqual(d.itemListElement.map((x) => x.url), V.eksponaty.map((x) => 'https://deloskop.ru/#' + x.id));
  assert.ok(!d.itemListElement.some((x) => /Индекс Делоскопа/.test(x.name + x.description)), 'ворота п. 71 — и в разметке');
  assert.deepStrictEqual(d.itemListElement.map((x) => x.position), V.eksponaty.map((_, i) => i + 1));
});

test('рисунки: у каждого героя есть <symbol>, все сцены ссылаются на существующий', () => {
  const b = blok();
  const sym = new Set([...b.matchAll(/<symbol id="(vg-[a-z]+)"/g)].map((m) => m[1]));
  for (const m of b.matchAll(/<use href="#(vg-[a-z]+)"/g)) assert.ok(sym.has(m[1]), m[1]);
  assert.ok(!/<symbol[^>]*>[^]*?fill="var\(/.test(b), 'var() — только в style (атрибуты его не понимают)');
});

test('стили и скрипт витрины — в пакетах главной; «меньше движения» гасит движение', () => {
  const S = JSON.parse(chitat('partials/sborka.json')).pakety;
  assert.ok(S['glavnaya-stil'].includes('css/vitrina.css'));
  assert.ok(S.glavnaya.includes('js/vitrina.js'));
  const css = chitat('css/vitrina.css');
  assert.ok(/@media \(prefers-reduced-motion:no-preference\)\{\s*\.vit-g\{animation/.test(css), 'поворот по прокрутке — только без «меньше движения»');
  assert.ok(/@media \(prefers-reduced-motion:reduce\)\{[^]*\.vit-e__tilt\{transform:none\}/.test(css));
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(css.replace(/var\(--bad,#B3261E\)|var\(--on-accent,#fff\)/g, '')), 'цвета — только токены темы');
  const js = chitat('js/vitrina.js');
  assert.ok(js.includes('prefers-reduced-motion: reduce') && js.includes('hover: hover'));
});

test('переход на страницу продукта: название экспоната переезжает в заголовок (shapka.js §9, data-vt)', () => {
  const sh = chitat('js/shapka.js');
  assert.ok(sh.includes('closest("a[data-vt]")'));
  const b = blok();
  assert.ok(/<a class="vit-e__a" href="\/pasport\/" data-vt>/.test(b));
  assert.ok(!/href="\/#inn"[^>]*data-vt/.test(b), 'ссылки на поле ИНН — без перехода страниц');
});

test('vitrina-v2: глубина сцены, «Что умеет» на телефоне, бабл «Отзыв» не накрывает кнопки', () => {
  const b = blok();
  const css = fs.readFileSync(path.join(KOREN, 'css/vitrina.css'), 'utf8');
  const js = fs.readFileSync(path.join(KOREN, 'js/vitrina.js'), 'utf8');
  // материалы — градиенты набора, цвета — переменные темы (заданы и на самом наборе: он стоит вне секции)
  assert.ok(/<linearGradient id="vg-gp"[^>]*><stop offset="0" style="stop-color:var\(--vg-p-svet\)"/.test(b));
  assert.ok(/\.vit,\.vit-nabor\{/.test(css), 'переменные градиентов — и на наборе рисунков');
  assert.ok(/\.vit-e__scena \.vit-g\{--vg-p:url\(#vg-gp\)/.test(css));
  // слои глубины в каждой сцене; ритм: крупные 1, 3, 5, 8, 10, 12
  const ex = [...b.matchAll(/<li class="vit-e vit-e--(k|m)" id="([^"]+)"/g)];
  assert.strictEqual(ex.length, V.eksponaty.filter((x) => x.status !== 'razrabotka').length);
  ex.forEach((m, i) => assert.strictEqual(m[1], [1, 3, 5, 8, 10, 12].includes(i + 1) ? 'k' : 'm', m[2] + ': вид экспоната'));
  assert.strictEqual((b.match(/<div class="vit-e__zad"><\/div>/g) || []).length, ex.length);
  // факты: кнопка скрыта, пока скрипт не снимет hidden; свёрнуто только со скриптом (vit--js) и только на узком экране
  assert.strictEqual((b.match(/class="vit-e__fb" aria-expanded="false" aria-controls="vf-[a-z]+" hidden>/g) || []).length, V.eksponaty.length);
  assert.ok(/@media \(max-width:860px\)\{\s*\.vit--js \.vit-e:not\(\.is-f\) \.vit-e__u/.test(css));
  assert.ok(/\.fb-ukryt \.fb-btn\{opacity:0;scale:\.6;pointer-events:none\}/.test(css));
  assert.ok(/rootMargin: '-' \+ verh \+ 'px 0px 0px 0px'/.test(js) && /innerHeight \|\| 800\) - 120/.test(js), 'нижние 120 px экрана');
  assert.ok(/600\)/.test(js), 'возврат через 600 мс');
  // частицы — CSS (вне основного потока), не canvas; при reduce скрипт до них не доходит
  assert.ok(!/getContext\(/.test(js));
  assert.ok(js.indexOf('if (reduce || !sceny.length) return;') < js.indexOf('function sozdat'));
});
