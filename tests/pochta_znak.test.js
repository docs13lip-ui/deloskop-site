// pochta-znak-v1 (14.11.2026): графика фирменной подписи писем (/pochta/) — знак № 27 «лупа-галочка» и палитра бренда.
// Сторожа: имена и размеры файлов прежние (подписи в почтовых программах ссылаются на эти адреса); знак — тот же, что в
// шапке сайта; цвета — тёмно-синий, латунь, тёплый белый; прежнего синего нет; картинки лёгкие; прозрачные — с альфой.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');

// [файл, ширина, высота, альфа, предел в байтах]
const NABOR = [
  ['podpis-logo.png', 496, 111, false, 20000],
  ['podpis-banner-v2.jpg', 1202, 300, false, 60000],
  ['podpis-banner.png', 1200, 280, false, 60000],
  ['podpis-ekosistema.png', 1200, 116, true, 30000],
  ['vizitka.png', 1050, 600, false, 60000],
  ['podpis-ic-pdf.png', 50, 48, true, 4000],
  ['podpis-ic-pochta.png', 48, 48, true, 4000],
  ['podpis-ic-sajt.png', 50, 48, true, 4000],
  ['podpis-ic-vizitka.png', 50, 48, true, 4000],
  ['podpis-ic-vk.png', 50, 48, true, 4000],
];

function razmer(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), alfa: buf[25] === 6 || buf[25] === 4 || (buf[25] === 3 && buf.includes('tRNS')) };
  for (let i = 2; i < buf.length - 9;) { // JPEG: ищем SOF0/SOF2
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m === 0xc0 || m === 0xc2) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), alfa: false };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

test('графика подписи: прежние имена и размеры, лёгкие файлы, прозрачность где была', () => {
  for (const [f, w, h, alfa, predel] of NABOR) {
    const buf = fs.readFileSync(path.join(KOREN, 'pochta', f));
    const r = razmer(buf);
    assert.ok(r, f + ': читается');
    assert.deepStrictEqual([r.w, r.h], [w, h], f + ': размер прежний');
    assert.strictEqual(r.alfa, alfa, f + (alfa ? ': прозрачный фон' : ': без альфы'));
    assert.ok(buf.length <= predel, f + ': ' + buf.length + ' Б ≤ ' + predel);
  }
});

test('исходник графики: знак из шапки сайта, палитра бренда, прежнего синего и колец нет', () => {
  const src = chitat('tests/pochta/podpis.html');
  const putiFavicon = new Set([...chitat('favicon.svg').matchAll(/ d="([^"]+)"/g)][0][1].split(/(?=M)/));
  const putiZnaka = new Set([...src.matchAll(/<path id="z[AB]" d="([^"]+)"/g)].flatMap((m) => m[1].split(/(?=M)/)));
  assert.deepStrictEqual([...putiZnaka].sort(), [...putiFavicon].sort(), 'контуры знака — те же, что в значке сайта');
  for (const c of ['#0D2247', '#D9B45A', '#B58A32', '#F5F1E6']) assert.ok(src.includes(c), 'цвет бренда: ' + c);
  assert.doesNotMatch(src, /#(0B63E5|2F80ED|0A84FF|3B82F6|1E6FFF|5AA0FF)\b/i, 'прежнего синего нет');
  assert.ok(src.includes('"Unbounded"') && (src.match(/class="sl">Делоскоп</g) || []).length === 2, 'слово «Делоскоп» — Unbounded, в логотипе и визитке');
  assert.doesNotMatch(src, /Делоскоп\.рф<\/span>/, 'в слове-логотипе нет «.рф» (в шрифте знака только буквы названия)');
  const sd = chitat('tests/pochta/sdelat.js');
  for (const [f] of NABOR) assert.ok(sd.includes("'" + f + "'"), 'сборщик пишет ' + f);
});
