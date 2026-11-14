// og-v1 (21.10.2026, [Ночные запуски]): обложка ссылок 1200×630 вместо значка 512×512 на всех страницах.
// Обложку и блок Open Graph ставит tests/sobrat_shapku.py (og_oblozhka) — карточки, разборы, рейтинг, журнал и тарифы
// проходят через тот же sobrat_stranicu, поэтому достаточно одного места. Картинка — tests/oblozhka/ (страница → снимок → палитра).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const K = path.join(__dirname, '..');
const OBL = 'https://deloskop.ru/oblozhka.png';

function stranicy() {
  return execSync('git ls-files "*.html"', { cwd: K, encoding: 'utf8' }).split('\n')
    .filter((f) => f && !/^(tests|partials|сайт)\//.test(f) && !/^(yandex_[0-9a-f]+|google[0-9a-f]+|admin|offline)\.html$/.test(f))
    .filter((f) => fs.existsSync(path.join(K, f)));
}
const golova = (f) => { const t = fs.readFileSync(path.join(K, f), 'utf8'); return t.slice(0, t.indexOf('</head>')); };

// oblozhka-3d-v1 (15.11.2026): объёмный знак со свечением весит больше плоского — порог 40 → 60 КБ
// (без полос в свечении меньше не выходит: 48 цветов — 45 КБ, но ступени на латуни). Превью площадки берут картинку один раз и кэшируют.
test('oblozhka.png — PNG 1200×630, не тяжелее 60 КБ', () => {
  const b = fs.readFileSync(path.join(K, 'oblozhka.png'));
  assert.strictEqual(b.toString('latin1', 1, 4), 'PNG');
  assert.strictEqual(b.readUInt32BE(16), 1200);
  assert.strictEqual(b.readUInt32BE(20), 630);
  assert.ok(b.length <= 60 * 1024, 'обложка ' + b.length + ' байт — превью ВК и Telegram грузят её на каждую ссылку');
});

test('значка 512×512 в og:image нет ни на одной странице; у обложки — размеры, подпись, имя сайта', () => {
  const plohie = [];
  for (const f of stranicy()) {
    const h = golova(f);
    if (h.includes('og:image" content="https://deloskop.ru/ikonka-512.png"')) plohie.push(f + ': значок');
    if (h.includes(OBL)) {
      for (const m of ['og:image:width" content="1200"', 'og:image:height" content="630"', 'og:image:alt" content="', 'og:site_name" content="Делоскоп"', 'og:locale" content="ru_RU"']) {
        if (h.split(m).length !== 2) plohie.push(f + ': ' + m.split('"')[0] + ' — не один раз');
      }
    }
  }
  assert.deepStrictEqual(plohie, []);
});

test('у каждой страницы в индексе — og:title, og:description, og:url = canonical и картинка', () => {
  const plohie = [];
  for (const f of stranicy()) {
    const h = golova(f);
    if (/name="robots" content="noindex/.test(h)) continue;
    const kanon = /<link rel="canonical" href="([^"]+)">/.exec(h);
    if (!kanon) continue;
    for (const p of ['og:title', 'og:description', 'og:image']) if (!h.includes('property="' + p + '"')) plohie.push(f + ': нет ' + p);
    const url = /property="og:url" content="([^"]+)"/.exec(h);
    if (!url || url[1] !== kanon[1]) plohie.push(f + ': og:url ≠ canonical');
  }
  assert.deepStrictEqual(plohie, []);
});

test('sobrat_shapku: обложка — одна на странице и не задваивается при повторной сборке', () => {
  const src = fs.readFileSync(path.join(K, 'tests/sobrat_shapku.py'), 'utf8');
  assert.match(src, /txt = og_oblozhka\(txt\)/);
  for (const f of stranicy()) {
    // obraz-statej-v1: тот же адрес бывает и в image разметки Article (если JSON-LD в <head>) — считаем мету og:image
    const n = golova(f).split('<meta property="og:image" content="' + OBL + '">').length - 1;
    assert.ok(n <= 1, f + ': обложка ' + n + ' раз');
  }
});

test('карточка из API (kartochka_render) — с той же обложкой, что ставит sobrat_shapku', () => {
  const sh = fs.readFileSync(path.join(K, 'tests/sobrat_shapku.py'), 'utf8');
  const kr = fs.readFileSync(path.join(K, 'tests/kartochka_render.py'), 'utf8');
  const blok = /OG_OBLOZHKA = "\\n"\.join\(\(\n([\s\S]*?)\)\)/.exec(sh)[1].split('\n').map((s) => s.trim()).filter(Boolean)
    .map((s) => s.replace(/^'|',?$/g, ''));
  assert.strictEqual(blok.length, 6);
  assert.ok(kr.includes(blok.join('\n')), 'kartochka_render.py: блок og:image не совпадает с OG_OBLOZHKA');
});

// oblozhka-znak-v1 (14.11.2026): обложка и значок ярлыков — знак № 27 «лупа-галочка» и палитра бренда (решение владельца 14.11).
// Сторожа: в заготовке обложки — путь знака из favicon.svg и слово Unbounded, прежних колец нет; в палитре PNG — тёмно-синий
// и латунь, прежнего синего (#0B63E5, #5B9BFF) нет; ярлык — 96×96, знак из того же favicon.svg.
const PUT27 = /<path transform="[^"]+" d="([^"]+)" fill="#D9B45A"\/>/.exec(fs.readFileSync(path.join(K, 'favicon.svg'), 'utf8'))[1];
function palitra(f) {
  const b = fs.readFileSync(path.join(K, f)), cv = [];
  for (let i = 8; i < b.length;) {
    const n = b.readUInt32BE(i), t = b.toString('latin1', i + 4, i + 8);
    if (t === 'PLTE') for (let j = 0; j < n; j += 3) cv.push([b[i + 8 + j], b[i + 9 + j], b[i + 10 + j]]);
    i += 12 + n;
  }
  return cv;
}
const blizko = (cv, [r, g, bl], d) => cv.some((c) => Math.abs(c[0] - r) <= d && Math.abs(c[1] - g) <= d && Math.abs(c[2] - bl) <= d);

test('oblozhka-znak-v1: заготовка обложки — знак «лупа-галочка», слово Unbounded, палитра бренда; прежних колец нет', () => {
  const h = fs.readFileSync(path.join(K, 'tests/oblozhka/oblozhka.html'), 'utf8');
  assert.strictEqual(h.split('d="' + PUT27 + '"').length - 1, 1, 'плоский знак — в строке имени, путь из favicon.svg');
  // oblozhka-3d-v1: крупно справа — объёмный знак из значка приложения, 1 : 1 (512 px), края растворены маской
  assert.ok(h.includes('<img class="k" src="/ikonka-512.png" alt="">') && /\.k\{[^}]*width:512px;height:512px;[^}]*mask-image:radial-gradient/.test(h),
    'объёмный знак — ikonka-512.png без растяжки, с круглой маской');
  assert.ok(h.includes('font:700 32px/1 "Unbounded"') && h.includes('>Делоскоп</div>'), 'слово — Unbounded 700, как в шапке');
  assert.ok(h.includes('background:#0D2247') && h.includes('fill="#D9B45A"'), 'тёмно-синий и латунь');
  assert.ok(!h.includes('M36 18.1') && !/circle cx="(150|310)"/.test(h) && !h.includes('#12305F"/><g'), 'прежнего знака-колец нет');
});

test('oblozhka-znak-v1: в картинках — тёмно-синий и латунь, прежнего синего нет; ярлык 96×96', () => {
  for (const f of ['oblozhka.png', 'ikonki/yarlyk-96.png']) {
    const cv = palitra(f);
    assert.ok(cv.length > 0 && cv.length <= 64, f + ': палитра ' + cv.length);
    assert.ok(blizko(cv, [13, 34, 71], 2), f + ': тёмно-синий #0D2247');
    assert.ok(blizko(cv, [217, 180, 90], 3), f + ': латунь #D9B45A');
    assert.ok(!blizko(cv, [11, 99, 229], 12) && !blizko(cv, [91, 155, 255], 12), f + ': прежний синий');
  }
  const y = fs.readFileSync(path.join(K, 'ikonki/yarlyk-96.png'));
  assert.ok(y.readUInt32BE(16) === 96 && y.readUInt32BE(20) === 96 && y.length <= 4096, 'ярлык 96×96, лёгкий: ' + y.length);
  const s = fs.readFileSync(path.join(K, 'tests/oblozhka/sdelat.js'), 'utf8');
  assert.ok(s.includes("'favicon.svg'") && s.includes("'ikonki/yarlyk-96.png'"), 'ярлык рисуется из favicon.svg тем же снимком');
});
