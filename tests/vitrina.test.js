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
