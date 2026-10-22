// zhivoj-v2: сторож «живого отчёта» (ожидание ответа, проявление вывода) и тёмного слоя для классов на <html>.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');

const JS = chitat('js/zhivoj-otchet.js');
const CSS = chitat('css/otchet.css');
const INDEX = chitat('index.html');

function modul() {
  const W = { matchMedia: () => ({ matches: true }) };
  new Function('window', 'document', JS)(W, {});
  return W.DlkZhivoj;
}

test('модуль в пакете главной, index.html зовёт его при «Проверить» и внутри перехода к отчёту', () => {
  const sb = JSON.parse(chitat('partials/sborka.json'));
  assert.ok(sb.pakety.glavnaya.includes('js/zhivoj-otchet.js'));
  assert.match(INDEX, /if\(window\.DlkZhivoj\)try\{DlkZhivoj\.zhdu\(note,v\)\}catch\(e\)\{\}report\.classList\.add\('loading'\)/);
  // проявление — в том же обновлении, что и render: класс попадает в новый снимок перехода, а не после него
  assert.match(INDEX, /perehod\(function\(\)\{render\(x\.j,o\);if\(window\.DlkZhivoj\)try\{DlkZhivoj\.pojav\(report\)\}catch\(e\)\{\}\}\)/);
  // без модуля — прежний текст строки
  assert.ok(INDEX.includes("note.textContent='Проверяем по реестрам…';if(window.DlkZhivoj)"));
});

test('реестры в строке ожидания — те, что в «Откуда данные»; у ИП — ЕГРИП и без ГИР БО; галочек «готово» до ответа нет', () => {
  const Z = modul();
  assert.deepStrictEqual(Z.reestry('7707083893'), ['ЕГРЮЛ', 'ГИР БО', 'суды', 'ФССП', 'ФНС', 'ЕИС']);
  assert.deepStrictEqual(Z.reestry('500100732259'), ['ЕГРИП', 'суды', 'ФССП', 'ФНС', 'ЕИС']);
  const otk = chitat('js/otkuda.js');
  for (const r of ['ЕГРЮЛ', 'ЕГРИП', 'ГИР БО', 'ФНС']) assert.ok(otk.includes(r), 'есть в «Откуда данные»: ' + r);
  assert.ok(!/[✓✔]|получено|готово/i.test(JS.slice(JS.indexOf('function zhdu'), JS.indexOf('function pojav'))), 'до ответа ничего не отмечаем');
  assert.match(JS, /setAttribute\('aria-hidden', 'true'\)/, 'разделители скрыты от диктора');
});

test('css: только opacity/transform, «Уменьшить движение» всё гасит, свет строки — вторым слоем (основной текст не тускнеет)', () => {
  const kadry = [...CSS.matchAll(/@keyframes (zh-[\w-]+)\{((?:[^{}]*\{[^}]*\})+)\}/g)];
  assert.deepStrictEqual(kadry.map((m) => m[1]).sort(), ['zh-akk', 'zh-ist', 'zh-pereliv', 'zh-pojav']);
  for (const [, imya, telo] of kadry) for (const p of telo.match(/[a-z-]+(?=:)/g)) assert.ok(['opacity', 'transform'].includes(p), imya + ': ' + p);
  const tiho = CSS.match(/@media \(prefers-reduced-motion:reduce\)\{\.zh-ist__i::after[^\n]*/);
  assert.ok(tiho, 'блок reduce');
  for (const s of ['.zh-ist__i::after', '.report.loading::after', '.ot-vd--pojav .ot-vt>*', '.report.ot details[open]>:not(summary)']) assert.ok(tiho[0].includes(s), 'reduce: ' + s);
  assert.match(CSS, /\.zh-ist__i::after\{content:attr\(data-t\);position:absolute[^}]*opacity:0;animation:zh-ist/);
  assert.ok(!/\.zh-ist__i\{[^}]*opacity/.test(CSS), 'основное слово не прозрачное — контраст строки');
  assert.match(CSS, /\.report\.loading::after\{[^}]*pointer-events:none[^}]*animation:zh-pereliv[^;}]* \.25s infinite/);
  assert.match(CSS, /\[data-theme=dark\] \.report\.loading::after\{--zh-pereliv:rgba\(255,255,255,\.07\)\}/, 'в тёмной — светлый перелив на самом ::after');
  // вывод — fill backwards: после проявления transform не держится (у кнопок свой scale/магнит)
  assert.match(CSS, /animation:zh-pojav [^;}]*backwards/);
});

test('тёмный слой: классы на <html> находятся и на самом <html> (на живом 19.10 полоса формы была светлой, пока шёл запрос)', () => {
  const r = spawnSync('python3', ['-c', [
    'import sys; sys.path.insert(0, "tests"); import tema_temnaya as t',
    'print(t._selektor(".rezhim-otcheta .hero-text")); print(t._selektor(".report .x")); print(t._selektor(".rezhim-otchetax .y"))',
    'print(" ".join(t.KORNEVYE))',
  ].join('\n')], { cwd: K, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const [a, b, c, spisok] = r.stdout.trim().split('\n');
  assert.strictEqual(a, '[data-theme=dark] .rezhim-otcheta .hero-text,[data-theme=dark].rezhim-otcheta .hero-text');
  assert.strictEqual(b, '[data-theme=dark] .report .x');
  assert.strictEqual(c, '[data-theme=dark] .rezhim-otchetax .y');
  // все классы, которые скрипты ставят на <html>, — в списке генератора
  const kornevye = new Set(spisok.split(' '));
  const ist = INDEX + chitat('js/shapka.js') + chitat('js/zhivoj-indeks.js');
  const na = [...ist.matchAll(/(?:documentElement|root|\(document\.documentElement\)|\bd)\.classList\.add\(([^)]*)\)/g)]
    .flatMap((m) => m[1].match(/['"]([\w-]+)['"]/g) || []).map((x) => x.slice(1, -1));
  assert.ok(na.includes('rezhim-otcheta') && na.includes('tema-vt'), 'нашли классы: ' + na);
  for (const k of na) assert.ok(kornevye.has(k), 'нет в KORNEVYE: ' + k);
  // собранный слой: у каждого правила «[data-theme=dark] .<класс html>» есть пара без пробела
  const tema = chitat('css/tema.css');
  for (const m of tema.matchAll(new RegExp('\\[data-theme=dark\\] \\.(' + [...kornevye].join('|') + ')(?![\\w-])([^,{]*)', 'g'))) {
    if (tema.slice(0, m.index).lastIndexOf('/*<avto>*/') < 0) continue; // ручная часть до авто-слоя
    assert.ok(tema.includes('[data-theme=dark].' + m[1] + m[2]), 'нет пары для ' + m[0]);
  }
  assert.ok(tema.includes('[data-theme=dark].rezhim-otcheta .hero-text{background:rgba(17,17,19,0.92)}'));
});
