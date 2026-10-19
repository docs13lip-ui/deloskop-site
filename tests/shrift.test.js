// shrift-v1 (19.10.2026, [Ночные запуски]): фирменный шрифт — предзагрузкой с HTML, чтобы к первой отрисовке он уже был
// и текст не перенабирался запасным «Onest Zapas» (прыжок строк — CLS на холодном кэше, замер Штаба 19.10 00:55).
// Замер: холодный кэш + 4G (150 мс, 1,6 Мбит/с), 12 страниц × 1280/390 — CLS max 0,022 → 0,001.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const NUZHNO = ['cyrillic-400', 'latin-400', 'cyrillic-600'];
const PRELOAD = /<link rel="preload" href="\/fonts\/onest-([a-z0-9-]+)\.woff2" as="font" type="font\/woff2" crossorigin>/g;

test('предзагружаемые файлы есть и описаны в css/fonts.css (иначе браузер скачает зря и предупредит)', () => {
  const css = chitat('css/fonts.css');
  for (const f of NUZHNO) {
    assert.ok(fs.existsSync(path.join(K, 'fonts', 'onest-' + f + '.woff2')), f);
    assert.ok(css.includes('/fonts/onest-' + f + '.woff2'), f + ' в fonts.css');
  }
});

test('страницы — ровно три предзагрузки шрифта (crossorigin — иначе файл скачается дважды); главная — без них', () => {
  const plohie = [];
  const obhod = (d) => {
    for (const e of fs.readdirSync(path.join(K, d), { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!/^(\.|node_modules|tests|partials|сайт|fonts|js|css|deploy)/.test(e.name)) obhod(p); continue; }
      if (!e.name.endsWith('.html') || /^(admin|offline|yandex_|google)/.test(e.name)) continue;
      const t = fs.readFileSync(path.join(K, p), 'utf8');
      if (!t.includes('<!--shapka-->') && !t.includes('class="shapka')) continue;  // не страница сайта
      const est = [...t.matchAll(PRELOAD)].map((m) => m[1]);
      const zhdem = p === 'index.html' ? [] : NUZHNO;
      if (est.join() !== zhdem.join()) plohie.push(p + ': ' + est.join());
    }
  };
  obhod('.');
  assert.deepStrictEqual(plohie, [], 'запустите python3 tests/sobrat_shapku.py');
});

test('оболочка карточек из API несёт ту же предзагрузку', () => {
  const ob = JSON.parse(chitat('partials/obolochka.json'));
  assert.deepStrictEqual([...ob.head.matchAll(PRELOAD)].map((m) => m[1]), NUZHNO);
});

test('предзагрузка стоит до стилей пакета ds (запрос шрифта уходит раньше разбора стилей)', () => {
  for (const f of ['indeks/index.html', 'zhurnal/index.html', 'reyting/index.html', 'tarify/index.html']) {
    const t = chitat(f), i = t.indexOf('onest-cyrillic-400.woff2" as="font"'), d = t.search(/<link rel="stylesheet" href="\/css\/b\/ds\.[0-9a-f]{10}\.css">/);
    assert.ok(i > 0 && d > 0 && i < d, f);
  }
  const ob = JSON.parse(chitat('partials/obolochka.json')).head;
  assert.ok(ob.indexOf('onest-cyrillic-400') < ob.search(/\/css\/b\/ds\./), 'оболочка API');
});
