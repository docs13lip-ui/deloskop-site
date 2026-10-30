// obraz-statej-v1 (26.10.2026, [Ночные запуски]): у каждой статьи и разбора (верхний Article/TechArticle в JSON-LD)
// есть image — та же картинка, что og:image страницы, с размерами из og:image:width/height.
// Ставит tests/sobrat_shapku.py (obraz_statej, шаг 6е sobrat_stranicu). Красный тест → python3 tests/sobrat_shapku.py → закоммитить.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const PRO_SAJT = ['.github', 'node_modules', 'tests', '.git', 'partials'];

function stranicy(dir = KOREN, out = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    if (PRO_SAJT.includes(n.name)) continue;
    const p = path.join(dir, n.name);
    if (n.isDirectory()) stranicy(p, out);
    else if (n.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function statyi() {
  const out = [];
  for (const f of stranicy()) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      for (const u of [].concat(JSON.parse(m[1]))) {
        if (u['@context'] && /^(Tech)?Article$/.test(u['@type'])) out.push({ f: path.relative(KOREN, f), s, u });
      }
    }
  }
  return out;
}

test('статей и разборов с разметкой Article — не меньше 50 (сторож видит их все)', () => {
  assert.ok(statyi().length >= 50, String(statyi().length));
});

test('у каждой статьи image = og:image страницы, с размерами', () => {
  const plohie = [];
  for (const { f, s, u } of statyi()) {
    const head = s.slice(0, s.indexOf('</head>'));
    const og = head.match(/<meta property="og:image" content="([^"]+)">/);
    const w = head.match(/<meta property="og:image:width" content="(\d+)">/);
    const v = head.match(/<meta property="og:image:height" content="(\d+)">/);
    const im = u.image || {};
    if (!og || im['@type'] !== 'ImageObject' || im.url !== og[1]) { plohie.push(f); continue; }
    if (w && v && (im.width !== Number(w[1]) || im.height !== Number(v[1]))) plohie.push(f + ' (размеры)');
  }
  assert.deepStrictEqual(plohie, []);
});

test('элементы hasPart хабов — без image (только верхний объект статьи)', () => {
  for (const { f, u } of statyi()) {
    for (const ch of [].concat(u.hasPart || [])) assert.ok(!ch.image, f);
  }
  const hab = fs.readFileSync(path.join(KOREN, 'praktika', 'index.html'), 'utf8');
  assert.ok(!/"hasPart": \[\{"@type": "Article", "image"/.test(hab));
});

test('картинка статей — существующий файл сайта', () => {
  const adresa = new Set(statyi().map(({ u }) => u.image && u.image.url).filter(Boolean));
  for (const a of adresa) {
    if (!a.startsWith('https://deloskop.ru/')) continue;
    assert.ok(fs.existsSync(path.join(KOREN, a.replace('https://deloskop.ru/', ''))), a);
  }
});
