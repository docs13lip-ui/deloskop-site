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

test('oblozhka.png — PNG 1200×630, не тяжелее 40 КБ', () => {
  const b = fs.readFileSync(path.join(K, 'oblozhka.png'));
  assert.strictEqual(b.toString('latin1', 1, 4), 'PNG');
  assert.strictEqual(b.readUInt32BE(16), 1200);
  assert.strictEqual(b.readUInt32BE(20), 630);
  assert.ok(b.length <= 40 * 1024, 'обложка ' + b.length + ' байт — превью ВК и Telegram грузят её на каждую ссылку');
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
