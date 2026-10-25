// dostupnost-v3 (25.10.2026, [Ночные запуски]): ориентиры страниц по аудиту axe-core 4.10 (86 страниц × 1280/390).
// 1) У каждой страницы сайта (кроме /company/ и служебных) ровно один <main> —
//    отчёт, Паспорт контрагента, проверка Паспорта и 404 раньше были без основной области (landmark-one-main, region).
// 2) Карточки покупки внутри <main> — <section>, не <aside> (landmark-complementary-is-top-level).
// 3) Имена областей на одной странице не повторяются (/partneram/: «Открытая бета» — у полосы беты).
// 4) Форма счёта (js/schet.js) — заголовок h2: на /schet/ он идёт сразу за h1 (heading-order).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const MIMO = new Set(['company', 'tests', 'node_modules', 'сайт', 'partials', 'deploy', '.git']);

function stranicy(d = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(K, d), { withFileTypes: true })) {
    if (e.name.startsWith('.') || MIMO.has(e.name)) continue;
    const rel = d ? d + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...stranicy(rel));
    else if (e.name.endsWith('.html') && !/^yandex_/.test(e.name)) out.push(rel);
  }
  return out;
}

test('у каждой страницы ровно один <main>; цель «Перейти к содержанию» (#main) на месте', () => {
  const plohie = [];
  for (const f of stranicy()) {
    const t = chitat(f).replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
    const m = t.match(/<main(?=[\s>])[^>]*>/g) || [];
    const skip = /href="#main"/.test(t);
    if (m.length !== 1 || (skip && !/id="main"/.test(t))) plohie.push(f + ' (' + m.length + ')');
  }
  assert.deepStrictEqual(plohie, []);
});

test('отчёт и Паспорт: содержимое внутри <main>, подвал и скрипты страницы — снаружи', () => {
  for (const [f, vnutri] of [['report.html', 'id="doc"'], ['pasport/kontragent/index.html', 'id="pk"'], ['pasport/proverka/index.html', 'id="pvf"'], ['404.html', 'Такой страницы нет']]) {
    const t = chitat(f);
    const a = t.indexOf('<main id="main"'), b = t.indexOf('</main>');
    assert.ok(a > 0 && b > a, f);
    assert.ok(t.slice(a, b).includes(vnutri), f + ': ' + vnutri);
    assert.ok(!t.slice(a, b).includes('class="podval"'), f + ': подвал внутри main');
  }
});

test('карточки покупки — <section> с заголовком, а не <aside>', () => {
  const sk = chitat('skoraya-115-fz/index.html'), os = chitat('osnovatel/index.html');
  assert.ok(sk.includes('<section class="pkg__card" aria-labelledby="pkg-card-h" data-pkg-card>') && !/<aside class="pkg__card"/.test(sk));
  assert.ok(os.includes('<section class="osn-card" aria-labelledby="osn-card-h">') && !/<aside class="osn-card"/.test(os));
  for (const [t, id] of [[sk, 'pkg-card-h'], [os, 'osn-card-h']]) assert.ok(t.includes('id="' + id + '"'), id);
});

test('имена областей (aria-label у region/section) на странице не повторяются', () => {
  const plohie = [];
  for (const f of stranicy()) {
    const t = chitat(f).replace(/<template[\s\S]*?<\/template>/g, '');
    const vse = [...t.matchAll(/<(section|div)\b([^>]*)>/g)]
      .filter((m) => m[1] === 'section' || /role="region"/.test(m[2]))
      .map((m) => (m[2].match(/aria-label="([^"]+)"/) || [])[1]).filter(Boolean);
    const dubli = vse.filter((x, i) => vse.indexOf(x) !== i);
    if (dubli.length) plohie.push(f + ': ' + [...new Set(dubli)].join(', '));
  }
  assert.deepStrictEqual(plohie, []);
});

test('форма счёта: заголовок h2 (на /schet/ — сразу за h1), h3 в js/schet.js нет', () => {
  const s = chitat('js/schet.js');
  assert.ok(!/h3/.test(s), 'h3 в schet.js');
  assert.ok(s.includes('<h2 tabindex="-1">В бете счета не выставляем</h2>'));
  assert.ok(s.includes('.sf h2{font-size:24px'), 'стиль заголовка формы — тот же');
});
