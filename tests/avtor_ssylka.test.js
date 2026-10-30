// avtor-ssylka-v1 (30.10.2026, [Ночные запуски]): видимая подпись «Команда Делоскопа» — ссылка на /o-proekte/#komanda.
// Зачем: author.@id в разметке статей уже ведёт на /o-proekte/#komanda (avtor.test.js), а в тексте подпись была без ссылки —
// у /o-proekte/ был 1 вход из <main> (только лента; замер main 876ddc55, 30.10). Страница «Кто делает Делоскоп» — доверие и E-E-A-T.
// 1) В статьях /nalogi/, /115-fz/, разборах /praktika/ (сборщик tests/sobrat_praktika.py), на /indeks/ и /tochnost/ подпись в строке .meta — ссылка на /o-proekte/#komanda.
// 2) Якорь #komanda на /o-proekte/ существует (h2 «Кто делает Делоскоп»).
// 3) У /o-proekte/ — не меньше 45 входов из <main> других страниц.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const PROPUSK = new Set(['.git', 'tests', 'partials', 'node_modules', 'сайт']);
const V = new Map();
(function obhod(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (PROPUSK.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) obhod(p);
    else if (e.name.endsWith('.html')) {
      let u = '/' + path.relative(K, p).split(path.sep).join('/');
      if (u.endsWith('/index.html')) u = u.slice(0, -'index.html'.length);
      V.set(u, fs.readFileSync(p, 'utf8'));
    }
  }
})(K);
const glavnoe = (h) => { const m = h.match(/<main[\s\S]*?<\/main>/); return m ? m[0] : ''; };
const SSYLKA = '<a class="avtor" href="/o-proekte/#komanda">Команда Делоскопа</a>';

test('подпись «Команда Делоскопа» в статьях — ссылка на /o-proekte/#komanda', () => {
  const nado = [...V.keys()].filter((u) => /^\/(nalogi|115-fz)\/[^/]+\/$/.test(u) || /^\/praktika\/[^/]+\/[^/]+\/$/.test(u) || u === '/indeks/' || u === '/tochnost/');
  const bez = [];
  let n = 0;
  for (const u of nado) {
    const h = V.get(u);
    if (!/class="meta">(<a class="avtor"[^>]*>)?Команда Делоскопа/.test(h)) continue;
    n += 1;
    if (!h.includes('class="meta">' + SSYLKA)) bez.push(u);
  }
  assert.ok(n >= 50, 'подписей найдено ' + n);
  assert.deepStrictEqual(bez, [], 'подпись без ссылки');
});

test('якорь #komanda на /o-proekte/ — заголовок «Кто делает Делоскоп»', () => {
  assert.match(V.get('/o-proekte/'), /<h2 id="komanda">Кто делает Делоскоп<\/h2>/);
});

test('у /o-proekte/ — не меньше 45 входов из текста других страниц', () => {
  let n = 0;
  for (const [u, h] of V) {
    if (u === '/o-proekte/') continue;
    const m = glavnoe(h);
    if (m.includes('href="/o-proekte/"') || m.includes('href="/o-proekte/#')) n += 1;
  }
  assert.ok(n >= 45, 'входов ' + n);
});

test('стиль подписи — в glubina.css, цвет строки (не синий акцент)', () => {
  const css = fs.readFileSync(path.join(K, 'css/glubina.css'), 'utf8');
  assert.match(css, /\.meta a\.avtor\{color:inherit;text-decoration:underline/);
});
