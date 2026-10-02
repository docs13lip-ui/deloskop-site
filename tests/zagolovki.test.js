// SEO-гигиена заголовков ([Ночные запуски] 02.10.2026 07:05; решение владельца 02.10 «качество прежде всего», п. 3).
// На каждой открытой для индекса странице — ровно один H1 в разметке и ни одного повторяющегося H2:
// два одинаковых H2 («Проверьте себя» в статье и в блоке формы) путают оглавление сниппета и читателя.
// H1/H2, которые рисует JavaScript (строки внутри <script>), не считаем — это состояния экрана, а не разметка.
// Запуск: node --test tests/zagolovki.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');

const PROPUSK = new Set(['node_modules', '.git', 'tests', '_skrinshoty_ne_vykladyvat', 'partials']);
const stranicy = (dir) => fs.readdirSync(path.join(KOREN, dir), { withFileTypes: true }).flatMap((x) =>
  x.isDirectory() ? (PROPUSK.has(x.name) ? [] : stranicy(path.join(dir, x.name)))
    : (x.name.endsWith('.html') ? [path.join(dir, x.name)] : []));

const razmetka = (t) => t.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
const tekst = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;|\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const zakryta = (t) => /<meta[^>]+name="robots"[^>]+noindex/i.test(t);

const VSE = stranicy('.').filter((f) => !/^(yandex_\w+|google\w+)\.html$/.test(path.basename(f))); // файлы подтверждения прав, не страницы

test('страниц для проверки достаточно (обход папок не сломался)', () => {
  assert.ok(VSE.length >= 50, 'найдено страниц: ' + VSE.length);
});

test('на странице нет двух одинаковых H2', () => {
  const plohie = [];
  for (const f of VSE) {
    const h2 = [...razmetka(fs.readFileSync(path.join(KOREN, f), 'utf8')).matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => tekst(m[1]));
    const povtor = [...new Set(h2.filter((h, i) => h2.indexOf(h) !== i))];
    if (povtor.length) plohie.push(f + ': «' + povtor.join('», «') + '»');
  }
  assert.deepStrictEqual(plohie, []);
});

test('открытая для индекса страница — ровно один H1 в разметке', () => {
  const plohie = [];
  for (const f of VSE) {
    const t = fs.readFileSync(path.join(KOREN, f), 'utf8');
    if (zakryta(t)) continue;
    const n = (razmetka(t).match(/<h1[\s>]/g) || []).length;
    if (n !== 1) plohie.push(f + ': H1 — ' + n);
  }
  assert.deepStrictEqual(plohie, []);
});
