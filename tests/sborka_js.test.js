// vizual-v3.0a «Фундамент» (18.10.2026, [Ночные запуски]): пакеты JS — tests/sobrat_js.py, карта partials/sborka.json.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const K = path.join(__dirname, '..');
const KARTA = JSON.parse(fs.readFileSync(path.join(K, 'partials', 'sborka.json'), 'utf8'));
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const vid = (imya) => KARTA.pakety[imya][0].endsWith('.css') ? 'css' : 'js';
const paket = (imya) => {
  const v = vid(imya);
  const f = fs.readdirSync(path.join(K, v, 'b')).filter((x) => new RegExp('^' + imya + '\\.[0-9a-f]{10}\\.' + v + '$').test(x));
  assert.strictEqual(f.length, 1, 'ровно один файл пакета ' + imya);
  return v + '/b/' + f[0];
};

test('сборщик пакетов ничего не меняет (как sobrat_shapku в CI): python3 tests/sobrat_js.py --check', () => {
  execFileSync('python3', [path.join(K, 'tests', 'sobrat_js.py'), '--check'], { stdio: 'pipe' });
});

test('пакет = исходники в порядке карты; отпечаток в имени — от содержимого', () => {
  const crypto = require('crypto');
  for (const [imya, fajly] of Object.entries(KARTA.pakety)) {
    const p = paket(imya), t = chitat(p);
    let poz = 0;
    for (const f of fajly) {
      const i = t.indexOf('/* --- /' + f + ' --- */\n' + chitat(f).trimEnd() + (vid(imya) === 'js' ? '\n;\n' : '\n'), poz);
      assert.ok(i >= poz, imya + ': ' + f + ' целиком и по порядку');
      poz = i + 1;
    }
    assert.strictEqual(p.split('.')[1], crypto.createHash('sha256').update(t, 'utf8').digest('hex').slice(0, 10), p);
    if (vid(imya) === 'js') assert.doesNotThrow(() => new vm.Script(t, { filename: p }), p + ': синтаксис');
  }
});

test('модули отчёта из пакета дают те же объекты, что и по отдельности (Usloviya, Otchet, Dinamika, IndeksOtvet, Sushchestvennoe…)', () => {
  const okno = {};
  const ctx = vm.createContext({ window: okno, self: okno, console, setTimeout, clearTimeout, Promise, JSON, Math, Date, RegExp,
    navigator: { userAgent: 'node' }, location: { hostname: 'localhost', search: '', pathname: '/' } });
  okno.window = okno;
  vm.runInContext('var window=this.window;', ctx);
  // пакет исполняется в браузере с this === window: UMD-обёртки кладут объекты в root
  vm.runInContext('(function(){' + chitat(paket('otchet')) + '\n}).call(window)', ctx);
  const est = Object.keys(okno).concat(Object.keys(ctx));
  for (const g of ['Usloviya', 'Otchet', 'Dinamika', 'IndeksOtvet', 'Sushchestvennoe', 'Shchit', 'Otkuda', 'Terminy', 'DeloskopIndeks', 'Nedavnie'])
    assert.ok(est.includes(g), g);
});

test('каждая страница карты подключает свои пакеты, и ни один исходник пакета не подключён на ней отдельно', () => {
  for (const [str, imena] of Object.entries(KARTA.stranicy)) {
    const h = chitat(str);
    for (const imya of imena) {
      assert.ok(h.includes('/' + paket(imya)), str + ' → ' + imya);
      for (const f of KARTA.pakety[imya]) assert.ok(!h.includes('<script src="/' + f + '"') && !h.includes('href="/' + f + '"'), str + ': ' + f + ' дважды');
    }
  }
});

test('главная до проверки: ≤ 6 файлов стилей и скриптов (было 17: 6 стилей + 11 скриптов); модулей отчёта на старте нет', () => {
  const h = chitat('index.html');
  const src = (h.match(/<script src="[^"]+"/g) || []).concat(h.match(/<link rel="stylesheet" href="[^"]+"/g) || []);
  assert.ok(src.length <= 6, 'файлов: ' + src.length + ' ' + src.join(' '));
  assert.ok(src.every((s) => /\/(?:js|css)\/b\//.test(s)), 'только пакеты: ' + src.join(' '));
  assert.ok(!src.some((s) => /otchet\./.test(s) && /script/.test(s)), 'пакет отчёта — не тегом');
});

test('главная: Speculation Rules — prerender только тарифов, Паспорта, методики и карточек; статьи — prefetch; проверку заранее не открываем; Метрика ждёт показа', () => {
  const m = chitat('index.html').match(/<script type="speculationrules">([\s\S]*?)<\/script>/);
  assert.ok(m, 'правила есть');
  const j = JSON.parse(m[1]);
  assert.deepStrictEqual(Object.keys(j).sort(), ['prefetch', 'prerender']);
  const pr = JSON.stringify(j.prerender);
  for (const u of ['/tarify/', '/pasport/', '/indeks/', '/company/*']) assert.ok(pr.includes('"' + u + '"'), u);
  assert.ok(!/115-fz|nalogi|inn=|\/api\//.test(pr), 'лишнее в prerender');
  assert.ok(/"not":\{"href_matches":"\/\*\\\\\?\*"\}/.test(m[1]), 'адреса с «?» (в т. ч. ?inn=) не открываем заранее');
  j.prerender.concat(j.prefetch).forEach((r) => assert.strictEqual(r.eagerness, 'moderate'));
  const met = chitat('js/metrika.js');
  assert.match(met, /if \(document\.prerendering\) document\.addEventListener\("prerenderingchange", zapusk, \{ once: true \}\);\n\s*else zapusk\(\);/);
});
