// znak-glavnaya-v1 (14.11.2026): над заголовком главной — знак № 27 «лупа-галочка» вместо двух колец poisk-v2-c (13.11).
// Знак плоский, одним силуэтом (путь = favicon.svg, разрезан на футляр и линзу); движение — CSS: раскрытие при открытии,
// «водит» при вводе, блик при «распознано», --warn при опечатке, волна на Enter; скрипт только ставит состояние.
// Сторожа: путь знака, цвета — токены (латунь на светлом — #B58A32 только в знаке), reduce-motion, CLS 0, телефон, без сети.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const L = require('../js/linza-poisk.js');
const P = require('../js/poisk.js');

test('состояния: ждёт / ввод / распознано / опечатка — из того же разбора, что строка', () => {
  const s = (q) => L.sostoyanie(q.trim() ? P.razobrat(q, []) : null, q);
  assert.deepStrictEqual(s(''), { sost: 'zhdet', F: 0 });
  assert.deepStrictEqual(s('   '), { sost: 'zhdet', F: 0 });
  assert.strictEqual(s('7707').sost, 'vvod', 'не хватает цифр — ещё печатает, не опечатка');
  assert.strictEqual(s('77070838931').sost, 'vvod', '11 цифр по дороге к ОГРН или счёту — не опечатка');
  assert.strictEqual(s('магни').sost, 'vvod');
  assert.strictEqual(s('7707083893').sost, 'raspoznano');
  assert.strictEqual(s('7707083893').F, 1, 'распознано — линза встаёт ровно');
  assert.strictEqual(s('7707083894').sost, 'opechatka', 'контрольная цифра ИНН не сходится');
  assert.ok(s('7707083894').F < 1, 'при опечатке F < 1');
  const a = s('ма').F, b = s('магнит краснодар').F;
  assert.ok(a > 0 && b > a && b < 1, 'чем больше введено, тем больше F: ' + a + ' → ' + b);
});

const ZNAK_PUT = (() => {
  const m = chitat('favicon.svg').match(/<path[^>]* d="([^"]+)"/);
  return m[1].match(/M[^M]+/g); // подпути знака: плечо футляра, плечо линзы, шарнир, кольцо (внешний, внутренний), отверстие ×3
})();

test('главная: знак над заголовком, скрыт от чтения, путь — из favicon.svg (футляр и линза), отверстие шарнира сквозное', () => {
  const h = chitat('index.html');
  const m = h.match(/<div class="lp" data-sost="zhdet" data-lp-src="(\/js\/b\/linza-poisk\.[0-9a-f]{10}\.js)" aria-hidden="true"><svg class="lp__z" viewBox="([\d. ]+)" focusable="false"><g class="lp__l">([\s\S]*?)<\/g><path class="lp__f" d="([^"]+)"\/><\/svg><\/div>/);
  assert.ok(m, 'нет блока знака (линза под футляром: сначала g.lp__l, потом футляр)');
  assert.ok(fs.existsSync(path.join(KOREN, m[1])), 'пакет собран: ' + m[1]);
  assert.ok(h.indexOf(m[0]) < h.indexOf('<h1 class="hero-h1">'), 'знак — над заголовком');
  assert.strictEqual((h.match(/class="lp"/g) || []).length, 1);
  assert.doesNotMatch(h, /lp__k|lp__gl|lp--gl/, 'двух колец и холста больше нет');
  const [plF, plL, sh, kv, kvn, otv] = ZNAK_PUT;
  assert.strictEqual(m[4], plF + sh + otv + otv, 'футляр: плечо + шарнир + отверстие ×2 (у шарнира два слоя)');
  const lz = m[3].match(/<path class="lp__lz" d="([^"]+)"\/>/);
  assert.ok(lz, 'линза');
  assert.strictEqual(lz[1], plL + kv + kvn + otv, 'линза: плечо + кольцо + отверстие (один слой)');
  assert.match(m[3], /<circle class="lp__st" cx="83" cy="43" r="19"\/>/, 'стекло — внутри кольца R 19');
  assert.match(m[3], /<circle class="lp__v" cx="83" cy="43" r="29"\/>/, 'волна — от внешнего края кольца');
  // рамка обнимает знак: плечо футляра до x 8, низ шарнира y 106, кольцо до x 112 и y 14
  const [x, y, w, hh] = m[2].split(' ').map(Number);
  assert.ok(x <= 8 && y <= 14 && x + w >= 112 && y + hh >= 106, 'viewBox ' + m[2]);
  const zagr = h.slice(h.indexOf(m[0]), h.indexOf('<h1 class="hero-h1">'));
  assert.match(zagr, /IntersectionObserver/, 'скрипт грузится, только когда блок на экране');
  assert.match(zagr, /requestIdleCallback/, 'и когда браузер свободен');
  assert.doesNotMatch(zagr, /<script[^>]+src=/, 'не тегом в разметке — не мешает первому экрану');
  const sb = JSON.parse(chitat('partials/sborka.json'));
  assert.deepStrictEqual(sb.pakety['linza-poisk'], ['js/linza-poisk.js']);
  assert.ok(sb.stranicy['index.html'].includes('linza-poisk'));
  assert.ok(!sb.pakety.glavnaya.includes('js/linza-poisk.js'), 'не в пакете главной — отдельно и позже');
});

test('стили: место под знак с первого кадра (CLS 0), цвета — токены, линза вращается вокруг шарнира, reduce-motion, телефон, печать', () => {
  const h = chitat('index.html');
  const css = h.slice(h.indexOf('/* znak-glavnaya-v1'), h.indexOf('@media print{.lp{display:none!important}}') + 40);
  assert.match(css, /\.lp\{[^}]*height:clamp\([^)]*\);aspect-ratio:1\.115;/, 'высота и пропорция заданы заранее');
  assert.match(css, /\.lp\{--lp-latun:var\(--latun-znak,#B58A32\);--lp-blik:var\(--surface,#fff\);/, 'светлая тема: латунь знака #B58A32 (решение 14.11)');
  // слой тёмной темы (sobrat_shapku → tema_temnaya) не перекрашивает линзу в бледную пару — в тёмной она = --accent, как кнопка
  assert.doesNotMatch(h.match(/<style data-tema>[^<]*<\/style>/)[0], /\.lp\b/);
  assert.match(css, /\[data-theme=dark\] \.lp\{--lp-latun:var\(--accent\);--lp-blik:var\(--ink\)\}/, 'тёмная — латунь из токена --accent');
  const hex = (css.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9A-Fa-f]{3,6}\b/g) || []).filter((c) => !/^#B58A32$|^#fff$/i.test(c));
  assert.deepStrictEqual(hex, [], 'других своих цветов нет');
  assert.match(css, /\.lp\{[^}]*color:var\(--ink\)\}/);
  assert.match(css, /\.lp__f\{fill:currentColor\}/, 'футляр — цвет текста темы, как знак в шапке');
  assert.match(css, /\.lp__l\{transform-box:view-box;transform-origin:41px 94px;/, 'линза вращается вокруг шарнира (41, 94)');
  assert.match(css, /animation:lp-otkr [^;}]+both/, 'открытие страницы — линза выходит из футляра');
  assert.match(css, /@keyframes lp-otkr\{from\{transform:rotate\(-46deg\)\}to\{transform:rotate\(0\)\}\}/);
  assert.match(css, /\.lp\[data-sost=vvod\]\[data-pechat\] \.lp__l\{animation:lp-vodit/, 'водит, только пока печатают');
  assert.match(css, /\.lp\[data-sost=raspoznano\] \.lp__bl\{animation:lp-blik[^}]* 1\}/, 'блик — один раз');
  assert.match(css, /\.lp\[data-sost=opechatka\] \.lp__lz,\.lp\[data-sost=opechatka\] \.lp__st\{fill:var\(--warn\)\}/);
  assert.match(css, /\.lp--puls \.lp__v\{animation:lp-volna/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.lp__l,\.lp__lz,\.lp__st\{transition:none;animation:none!important\}\.lp__bl,\.lp__v\{animation:none!important\}\}/);
  assert.match(css, /@media \(max-width:520px\)\{\.lp\{position:absolute;[^}]*height:52px;/, 'на телефоне знак не сдвигает строку проверки');
  assert.match(css, /\.rezhim-otcheta \.lp\{display:none\}/, 'на экране отчёта — нет');
  assert.match(h, /@media print\{\.lp\{display:none!important\}\}/);
});

test('js/linza-poisk.js: ≤ 2 КБ gzip, только состояние (без WebGL и холста), без сети и хранилища', () => {
  const js = chitat('js/linza-poisk.js');
  const adres = chitat('index.html').match(/\/js\/b\/linza-poisk\.[0-9a-f]{10}\.js/)[0];
  const gz = zlib.gzipSync(fs.readFileSync(path.join(KOREN, adres)), { level: 9 }).length;
  assert.ok(gz <= 2 * 1024, 'пакет знака ' + gz + ' Б gzip > 2 КБ');
  const kod = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(kod, /getContext|webgl|requestAnimationFrame\(kadr|canvas/i, 'рисунок — в разметке, не на холсте');
  assert.doesNotMatch(kod, /#[0-9a-f]{6}\b/i, 'своих цветов нет');
  assert.doesNotMatch(kod, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|dlkGoal|ym\(/, 'ни текст, ни ИНН никуда не уходят');
  assert.match(kod, /setAttribute\('data-sost', st\.sost\)/);
  assert.match(kod, /el\.removeAttribute\('data-pechat'\); \}, TIHO_MS\)/, 'после паузы линза перестаёт водить');
  assert.strictEqual(L.TIHO_MS, 1600);
});

test('start(): ввод → data-sost и data-pechat, тишина → не водит, Enter → волна; повторный запуск не вешает обработчики дважды', () => {
  const ev = {}, attrs = { 'data-sost': 'zhdet' }, kl = new Set(), timers = [];
  const el = {
    getAttribute: (k) => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; },
    classList: { add: (c) => kl.add(c), remove: (c) => kl.delete(c) }, addEventListener: (t, f) => { ev['el:' + t] = f; }
  };
  const input = { value: '', addEventListener: (t, f) => { ev['in:' + t] = f; } };
  const form = { addEventListener: (t, f) => { ev['form:' + t] = f; } };
  const win = {
    document: { querySelector: (s) => (s === '.lp' ? el : null), getElementById: (i) => (i === 'inn' ? input : i === 'check' ? form : null) },
    DlkPoisk: P, setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout: () => {},
    requestAnimationFrame: (f) => { f(); return 1; }, cancelAnimationFrame: () => {}
  };
  L.start(win);
  assert.strictEqual(attrs['data-lp-gotovo'], '1');
  input.value = 'магн'; ev['in:input']();
  assert.strictEqual(attrs['data-sost'], 'vvod'); assert.ok('data-pechat' in attrs, 'печатают — водит');
  timers[timers.length - 1]();
  assert.ok(!('data-pechat' in attrs), 'пауза — замирает');
  input.value = '7707083893'; ev['in:input']();
  assert.strictEqual(attrs['data-sost'], 'raspoznano'); assert.ok(!('data-pechat' in attrs));
  input.value = '7707083894'; ev['in:input']();
  assert.strictEqual(attrs['data-sost'], 'opechatka');
  ev['in:keydown']({ key: 'Enter' }); assert.ok(kl.has('lp--puls'), 'Enter — волна');
  ev['el:animationend']({ animationName: 'lp-volna' }); assert.ok(!kl.has('lp--puls'));
  const pered = Object.keys(ev).length; ev['in:input'] = null; L.start(win);
  assert.strictEqual(ev['in:input'], null, 'второй start() ничего не вешает');
  assert.strictEqual(Object.keys(ev).length, pered);
});
