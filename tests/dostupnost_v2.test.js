// dostupnost-v2 (25.10.2026, [Ночные запуски]): ссылки внутри абзацев отличаются от текста не только цветом
// (WCAG 1.4.1, axe link-in-text-block). Аудит axe-core 4.10: 86 страниц × светлая/тёмная × 1280/390 px —
// 30 ссылок в 11 блоках (на этих страницах свой `a{text-decoration:none}`, синий к тексту рядом 1,07–2,98 : 1).
// Правило — partials/shapka.css (в пакете ds и в /css/shapka.css на всех страницах).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BLOKI = ['pyat', 'celi', 'princip', 'pravila', 'ndsq', 'ndsf__m', 'gran', 'ras__pod', 'pkg__cap', 'formula', 'lead'];
// где axe нашёл ссылку без подчёркивания (страница → блок): если блок со страницы ушёл — сверить список заново
const GDE = {
  'o-proekte/index.html': ['pyat', 'celi', 'princip'],
  'tarify/index.html': ['pravila'],
  'indeks/index.html': ['formula'],
  'skoraya-115-fz/index.html': ['pkg__cap'],
  'nalogi/pismo-o-smene-rekvizitov-kak-proverit/index.html': ['pyat'],
  'nalogi/nds-postavshchika-na-usn-po-inn/index.html': ['ndsq', 'ndsf__m'],
  'nalogi/chto-oznachayut-cifry-inn-i-kpp/index.html': ['ras__pod'],
  'nalogi/nagruzka-po-otraslyam-2025/index.html': ['lead'],
  'praktika/nalogi/vokfors-rekonstrukciya/index.html': ['gran'],
};
const SRC = fs.readFileSync(path.join(ROOT, 'partials', 'shapka.css'), 'utf8');
const SOBRANO = fs.readFileSync(path.join(ROOT, 'css', 'shapka.css'), 'utf8');

function pravila(css) {
  return [...css.matchAll(/:is\(([^)]*)\) a:not\(\[class\]\)(:hover)?\{([^}]*)\}/g)]
    .map((m) => ({ bloki: m[1].split(',').map((x) => x.trim().replace(/^\./, '')), hover: !!m[2], tel: m[3] }));
}

test('правило подчёркивает ссылки во всех 11 блоках, тонко и с отступом', () => {
  const p = pravila(SRC).filter((x) => !x.hover);
  assert.ok(p.length >= 1, 'нет правила dostupnost-v2 в partials/shapka.css');
  const osn = p.find((x) => /text-decoration-line:underline/.test(x.tel));
  assert.ok(osn, 'нет text-decoration-line:underline');
  assert.deepStrictEqual([...osn.bloki].sort(), [...BLOKI].sort());
  assert.match(osn.tel, /text-decoration-thickness:1px/);
  assert.match(osn.tel, /text-underline-offset:\.2em/);
  for (const x of pravila(SRC)) assert.deepStrictEqual([...x.bloki].sort(), [...BLOKI].sort(), 'списки блоков в правилах разошлись');
});

test('цвет линии: запасной — цвет ссылки, полупрозрачный — только под @supports color-mix', () => {
  assert.match(SRC, /a:not\(\[class\]\)\{[^}]*text-decoration-color:currentColor\}/);
  assert.match(SRC, /@supports \(color:color-mix\(in srgb,red 50%,transparent\)\)\{[^@]*color-mix\(in srgb,currentColor 55%,transparent\)/);
});

test('кнопки и ссылки с классом не трогаем (только a:not([class]))', () => {
  for (const x of pravila(SRC)) assert.ok(!/(^|;)(display|color|font|padding|background):/.test(x.tel), 'правило меняет не только линию: ' + x.tel);
  assert.ok(!/:is\(\.pyat[^)]*\) a\{/.test(SRC), 'правило без :not([class]) задело бы кнопки');
});

test('собранный /css/shapka.css несёт правило (sobrat_shapku)', () => {
  assert.ok(SOBRANO.includes(':is(.pyat,.celi,.princip,.pravila,.ndsq,.ndsf__m,.gran,.ras__pod,.pkg__cap,.formula,.lead) a:not([class])'));
});

test('блоки из списка стоят на своих страницах со ссылками внутри', () => {
  for (const [f, bloki] of Object.entries(GDE)) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const b of bloki) {
      const re = new RegExp('class="[^"]*\\b' + b.replace(/_/g, '_') + '\\b[^"]*"[^>]*>[\\s\\S]{0,4000}?<a (?![^>]*class=)[^>]*href=');
      assert.ok(re.test(s), f + ': нет блока .' + b + ' со ссылкой без класса');
    }
  }
});
