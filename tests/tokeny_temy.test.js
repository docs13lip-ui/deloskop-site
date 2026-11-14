// oshibka-svet-v1 (01.11.2026) — токены, которые задаёт только тёмная тема, не должны оставлять светлую без цвета.
// Урок: «Сколько стоит ошибка» переехала с главной на /vse-vozmozhnosti/ вместе со стилями, а --dark и --ink2
// на главной задаёт её собственный :root; на новой странице в светлой теме var(--dark) пуст → белый текст на белом.
// Правило: если страница пишет var(--x) без запасного значения, --x должен быть задан в светлой теме —
// в ДС (css/b/ds.*.css), в подключённом /css/*.css или в стилях самой страницы. Иначе — var(--x,#цвет) или токен ДС.
// node --test tests/tokeny_temy.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const KOR = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOR, f), 'utf8');
const svetlaya = (css) => css.split('[data-theme=dark]')[0];
const tokeny = (css) => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

const ds = fs.readdirSync(path.join(KOR, 'css/b')).find((f) => /^ds\.[0-9a-f]+\.css$/.test(f));
const SVET = tokeny(svetlaya(chitat('css/b/' + ds)));
const TEMNYE = [...tokeny(chitat('css/tema.css').split('}')[0])].filter((t) => !SVET.has(t));

function stranicy(dir = '', out = []) {
  for (const e of fs.readdirSync(path.join(KOR, dir), { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/^(company|node_modules|tests|\.git)$/.test(f)) stranicy(f, out); }
    else if (e.name.endsWith('.html')) out.push(f);
  }
  return out;
}

function pustye(f) {
  const s = chitat(f);
  const stil = [...s.matchAll(/<style(?![^>]*data-tema)[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const est = tokeny(stil);
  for (const [, href] of s.matchAll(/href="\/(css\/[^"]+\.css)"/g)) {
    if (href.includes('tema') || !fs.existsSync(path.join(KOR, href))) continue;
    for (const t of tokeny(svetlaya(chitat(href)))) est.add(t);
  }
  return TEMNYE.filter((t) => !est.has(t) && stil.includes('var(' + t + ')'));
}

test('список «только тёмных» токенов не пуст (иначе сторож ничего не сторожит)', () => {
  assert.ok(TEMNYE.includes('--dark'), TEMNYE.join(' '));
});

test('ни одна страница не берёт без запасного значения токен, которого нет в светлой теме', () => {
  const plohie = stranicy().map((f) => [f, pustye(f)]).filter(([, t]) => t.length);
  assert.deepStrictEqual(plohie, []);
});

test('/vse-vozmozhnosti/: плашка «Сколько стоит ошибка» тёмная в обеих темах, рамку кнопки тема не перекрашивает', () => {
  const s = chitat('vse-vozmozhnosti/index.html');
  assert.match(s, /\.oshibka__in\{[^}]*background:var\(--dark,#0A1733\)/);
  assert.doesNotMatch(s, /\[data-theme=dark\] \.oshibka__go/);
});
