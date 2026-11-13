// scena-poiska-v1 (13.11.2026): сцена поиска в окне «та же строка поверх любой страницы» — js/scena.js + js/poisk-okno.js.
// Решение владельца 13.11 («поиск в 3D, строка по центру», перенос согласован). Правила Арт-директора — те же, что у линзы:
// вне экрана и в закрытом окне 0 кадров; «уменьшить движение» — статичный кадр; цвета знака, строки и состояний — токены ДС
// (палитра фона — в шейдере, по решению владельца «больше 3D и цветов»); запасной CSS-кадр; пакет грузится только после
// открытия окна; ни текст, ни ИНН в сцену и наружу не уходят. Бюджет пакета сцены — ≤ 14 КБ gzip.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');

test('пакет сцены: один файл, ≤ 14 КБ gzip, адрес — у значка лупы, тегом не грузится нигде', () => {
  const sb = JSON.parse(chitat('partials/sborka.json'));
  assert.deepStrictEqual(sb.pakety.scena, ['js/scena.js']);
  assert.ok(!Object.values(sb.stranicy).some((x) => x.includes('scena')), 'пакет сцены не грузится тегом — только после открытия окна');
  const adres = chitat('partials/shapka.html').match(/data-scena-src="(\/js\/b\/scena\.[0-9a-f]{10}\.js)"/)[1];
  assert.ok(fs.existsSync(path.join(KOREN, adres)), 'пакет собран: ' + adres);
  const gz = zlib.gzipSync(fs.readFileSync(path.join(KOREN, adres)), { level: 9 }).length;
  assert.ok(gz <= 14 * 1024, 'пакет сцены ' + gz + ' Б gzip > 14 КБ');
  for (const s of ['praktika/index.html', 'o-proekte/index.html', 'index.html']) {
    const h = chitat(s);
    assert.ok(h.includes('data-scena-src="' + adres + '"'), 'тот же адрес на ' + s);
    assert.doesNotMatch(h, /<script[^>]+src="\/js\/b\/scena\./, 'на ' + s + ' сцена тегом не подключена');
  }
});

test('js/scena.js: токены ДС, reduce-motion, 0 кадров вне экрана, потолок точек, без сети и хранилища', () => {
  const js = chitat('js/scena.js');
  const kod = js.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const t of ["'--bg'", "'--accent'", "'--warn'", "'--ink'", "'--ok'"]) assert.ok(js.includes(t), 'цвет из токена ' + t);
  assert.doesNotMatch(kod, /#[0-9a-f]{6}\b/i, 'шестнадцатеричных цветов нет');
  assert.match(js, /attributeFilter:\['data-theme'\]/, 'тема — по data-theme');
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /if\(tih\)\{if\(!gryaz\)return;/, '«уменьшить движение» и замершая сцена — кадр только по событию');
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /cancelAnimationFrame\(raf\)/, 'вне экрана и в закрытом окне кадр отменён');
  assert.match(js, /document\.hidden/);
  assert.match(js, /KHR_parallel_shader_compile/, 'программы собираются без остановки страницы');
  assert.match(js, /if\(px>2\.2e6\)/, 'холст — не больше 2,2 млн точек');
  assert.match(js, /Math\.sqrt\(1\.05e6\/\(w\*h\)\)/, 'фон — не больше 1,05 млн точек');
  assert.match(js, /gl\.readPixels\(0,0,1,1/, 'цену кадра меряет видеокарта, а не пауза между кадрами');
  assert.match(js, /stat=true/, 'совсем тяжело — сцена замирает кадром');
  assert.match(js, /webglcontextlost/);
  assert.doesNotMatch(kod, /fetch\(|XMLHttpRequest|sendBeacon|postMessage|localStorage|sessionStorage|dlkGoal|ym\(|document\.cookie/, 'ничего никуда не уходит');
  assert.strictEqual((kod.match(/\.value/g) || []).length, (kod.match(/q\.value\?1:0/g) || []).length, 'текст поля не читается — только «пусто / не пусто»');
});

test('js/scena.js: модуль отдаёт DlkScena; без WebGL — O.netGL() и ни одного кадра', () => {
  const js = chitat('js/scena.js');
  let netGL = 0, raf = 0;
  const cv = { getContext() { return null; }, getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }, addEventListener() {}, hidden: false };
  const window = { matchMedia() { return { matches: false }; }, devicePixelRatio: 1, addEventListener() {} };
  const ctx = { window, location: { hash: '' }, performance: { now: () => 0 }, matchMedia: window.matchMedia,
    document: { hidden: false, documentElement: { addEventListener() {} }, addEventListener() {} },
    getComputedStyle() { return { getPropertyValue() { return ''; } }; },
    requestAnimationFrame() { raf++; return 1; }, cancelAnimationFrame() {} };
  vm.runInNewContext(js, ctx);
  assert.strictEqual(typeof window.DlkScena, 'function');
  const pole = { value: '', addEventListener() {} };
  const S = window.DlkScena({ cv, mark: cv, box: cv, pole, lupa: [], shit: [], sost() { return { focus: 0, exact: false, err: false }; }, netGL() { netGL++; } });
  assert.strictEqual(S.est(), false);
  assert.strictEqual(netGL, 1, 'страница узнала, что сцены нет, — остаётся CSS-кадр');
  assert.strictEqual(cv.hidden, true);
  S.vkl(true); S.vkl(false); S.puls();
  assert.strictEqual(raf, 0, 'кадров нет');
});

test('окно поиска: сцена — после открытия, по своему адресу; закрыли — выключили; в сцену — три числа состояния', () => {
  const o = chitat('js/poisk-okno.js');
  assert.match(o, /function otkryt\(otkuda\) \{[\s\S]*?razd\(\);\n    scena\(\);/, 'пакет сцены просят только при открытии окна');
  assert.match(o, /\/\^\\\/js\\\/b\\\/scena\\\.\[0-9a-f\]\+\\\.js\$\/\.test\(src\)/, 'адрес пакета — только свой');
  assert.match(o, /dlg\.addEventListener\('close', function \(\) \{ clearTimeout\(tmr\); if \(SC\) SC\.vkl\(false\);/, 'закрыли окно — 0 кадров');
  assert.match(o, /sost: function \(\) \{ return SOST; \}/);
  assert.match(o, /SOST\.exact = !!PR\.exact; SOST\.err = !!PR\.err; SOST\.focus = PR\.exact \? 1 : \.6;/);
  assert.match(o, /netGL: function \(\) \{ dlg\.classList\.remove\('pso--gl'\); \}/, 'нет WebGL — CSS-кадр');
  assert.match(o, /\.pso--gl \.pso__zn::before,\.pso--gl \.pso__zn::after\{visibility:hidden\}/, 'CSS-кольца — запасной кадр знака');
  assert.match(o, /<canvas class="pso__gl" aria-hidden="true"><\/canvas>/);
  assert.match(o, /<p class="pso__h" id="pso-h">Что проверяем\?<\/p>/);
  assert.match(o, /e\.target === dlg \|\| e\.target === sc/, 'нажатие мимо строки и списка закрывает окно');
  assert.doesNotMatch(o, /DlkScena\(\{[^}]*input\.value/, 'текст запроса в сцену не передаётся');
});
