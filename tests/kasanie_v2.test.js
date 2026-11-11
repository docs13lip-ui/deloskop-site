// kasanie-v2 (09.11.2026): цели касания на телефоне ≥ 44 px — остаток после detali-v1c и vitrina-v2a.
// Замер — tests/zamer_detali.js (Chromium, 390 px); здесь сторож, чтобы правило не потерялось при правке css/detali.css.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const chitat = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('kasanie-v2: отдельно стоящие ссылки — поле 44 px без сдвига строки, только на телефоне и сенсорном экране', () => {
  const css = chitat('css/detali.css');
  const i = css.indexOf('kasanie-v2');
  assert.ok(i > 0, 'блок kasanie-v2 в css/detali.css');
  const blok = css.slice(i);
  assert.match(blok, /@media \(max-width:640px\),\(pointer:coarse\)\{/, 'только телефон и сенсорный экран — с мышью вёрстка прежняя');
  for (const s of ['a.avtor', '.ist-t td>a', 'ol.toc li>a', '.gde>a', '.normy-komp details p>a', '.izm__a>a', '.kr-crumbs a', 'a.nazad', 'main.doc td>a', 'button#demo.link'])
    assert.ok(blok.includes(s), s);
  assert.match(blok, /min-height:44px;padding-top:12px;padding-bottom:12px;margin-top:-12px;margin-bottom:-12px\}/, 'поле растёт в воздух над и под строкой — строка не сдвигается');
  assert.match(blok, /div\.seg button,section\.nk \.rezh label,label\.ls-g,article p>a\.btn\{min-height:44px\}/, 'сегменты, переключатель режима, галочки, кнопка — 44 px');
});

test('kasanie-v2: правило попало в собранный пакет ds и пакет подключён на страницах с этими элементами', () => {
  const b = fs.readdirSync(path.join(__dirname, '..', 'css', 'b')).filter((f) => /^ds\.[0-9a-f]+\.css$/.test(f));
  assert.strictEqual(b.length, 1, 'один пакет ds');
  assert.ok(chitat('css/b/' + b[0]).includes('button#demo.link{display:inline-block;box-sizing:border-box;min-height:44px'), 'пакет ds пересобран (python3 tests/sobrat_js.py; комментарии в пакет не попадают)');
  for (const s of ['index.html', 'oferta/index.html', 'nalogi/nagruzka/index.html', 'kontragenty-iz-vypiski/index.html',
    'nalogi/dokumenty-kontragenta-po-summe-sdelki/index.html', 'nalogi/nagruzka-po-otraslyam-2025/index.html'])
    assert.ok(chitat(s).includes('/css/b/' + b[0]), s + ' — пакет ds');
});
