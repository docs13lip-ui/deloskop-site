// inn-vv-v1 (31.10.2026, [Ночные запуски]): поле ИНН внизу /vse-vozmozhnosti/ — ТЗ схемы А, разд. 3
// (claude/Продукт_ТЗ_главная_схема_А_30.10.md): «Внизу страницы — поле ИНН (компонент как на главной, id="inn-vv")
// и «10 проверок в день — бесплатно, без регистрации.»». Было: ссылка «Проверить компанию по ИНН» на /#inn —
// человек дочитал каталог, ушёл на главную и вводил ИНН там. Стало: поле здесь же, форма GET на «/» —
// главная по /?inn=<10|12 цифр> сразу строит отчёт, название подставляет в своё поле (index.html, innIzAdresa).
// node --test tests/vse_vozmozhnosti_inn.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const html = chitat('vse-vozmozhnosti/index.html');
const glav = chitat('index.html');
const forma = (() => { const m = html.match(/<form class="vv-inn"[\s\S]*?<\/form>/); return m ? m[0] : ''; })();

test('внизу /vse-vozmozhnosti/ — одна форма с полем id="inn-vv", после каталога и внутри <main>', () => {
  assert.ok(forma, 'нет формы .vv-inn');
  assert.strictEqual((html.match(/id="inn-vv"/g) || []).length, 1, 'id="inn-vv" — ровно один');
  const i = html.indexOf('<form class="vv-inn"');
  assert.ok(i > html.indexOf('<!--/vitrina-->'), 'форма — после каталога');
  assert.ok(i < html.indexOf('</main>'), 'форма — внутри <main>');
});

test('форма уходит на главную: GET «/», поле inn — как на главной (ИНН или название), обязательное', () => {
  assert.match(forma, /<form class="vv-inn" id="check-vv" action="\/" method="get" role="search"/);
  const inp = forma.match(/<input [^>]*>/)[0];
  for (const a of ['id="inn-vv"', 'name="inn"', 'type="text"', 'inputmode="search"', 'autocomplete="off"', ' required'])
    assert.ok(inp.includes(a), 'у поля нет ' + a);
  const gl = glav.match(/<input id="inn"[^>]*>/)[0];
  assert.strictEqual(inp.match(/placeholder="([^"]+)"/)[1], gl.match(/placeholder="([^"]+)"/)[1], 'подсказка — как у поля главной');
  assert.ok(!/pattern=/.test(inp), 'без pattern: главная принимает и название компании');
  assert.match(forma, /<label for="inn-vv" class="vh">ИНН или название компании<\/label>/, 'у поля есть подпись для читалки');
  assert.match(forma, /<button type="submit">Проверить<\/button>/);
  // главная читает /?inn=…: 10 или 12 цифр — сразу отчёт, иначе — текст в поле
  assert.ok(glav.includes("new URLSearchParams(location.search).get('inn')"), 'главная больше не читает ?inn= — форма потеряет ИНН');
});

test('под полем — строка ТЗ дословно (с неразрывными пробелами), та же, что под полем главной', () => {
  const s = '10&nbsp;проверок в&nbsp;день&nbsp;— бесплатно, без&nbsp;регистрации.';
  assert.ok(forma.includes('<p class="vv-inn__n">' + s + '</p>'));
  assert.ok(glav.includes(s), 'на главной строка другая — сверить с ТЗ');
  assert.ok(!/ссылк[аи] «?Проверить компанию по&nbsp;ИНН/.test(html) && !html.includes('href="/#inn">Проверить компанию по&nbsp;ИНН'), 'старая ссылка на /#inn вместо поля');
});

test('вид — токены ДС (тёмная тема без своих правил), касание ≥ 44 px, на телефоне столбиком', () => {
  const css = chitat('css/vitrina.css');
  const blok = css.slice(css.indexOf('/* inn-vv-v1'), css.indexOf('/* vse-vozmozhnosti-v1'));
  assert.ok(blok.length > 100, 'нет блока стилей inn-vv-v1 в css/vitrina.css');
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(blok.replace(/,#fff\)/g, ')')), 'цвета — только var(--…)');
  for (const m of blok.matchAll(/min-height:(\d+)px/g)) assert.ok(+m[1] >= 44, 'касание < 44 px');
  assert.match(blok, /@media \(max-width:520px\)\{\.vv-inn__f\{flex-direction:column\}/);
  assert.match(blok, /\.vv-inn__f:focus-within\{outline:2px solid var\(--accent\)/, 'видимый фокус');
});
