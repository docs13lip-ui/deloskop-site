// sravnit-vhody-v1 — у страниц сайта нет «сирот».
// Раньше /sravnit/ («Сравнить двух поставщиков») не имел ни одной ссылки из текста страниц: только лента и sitemap.
// Для Яндекса такая страница почти не существует. Сторож: (1) /sravnit/ — ссылкой из четырёх статей о выборе поставщика
// и обратно на три статьи; (2) у каждой страницы из sitemap.xml есть хотя бы одна ссылка из <main> другой страницы
// (шапка и подвал не в счёт — они одинаковы везде и вес не передают по смыслу).
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const glavnoe = (s) => {
  const a = s.indexOf('<main'), b = s.indexOf('</main>');
  return a < 0 || b < 0 ? '' : s.slice(a, b);
};

const STATI = [
  'nalogi/priznaki-tehnicheskoj-kompanii',
  'nalogi/statya-54-1-nk-prostymi-slovami',
  '115-fz/proverit-kontragenta-zsk-po-inn',
  'nalogi/kalkulyator-tehnicheskij-postavshchik',
];

test('статьи о выборе поставщика ведут на /sravnit/ — первой карточкой «Читайте также»', () => {
  for (const p of STATI) {
    const s = chitat(p + '/index.html');
    const more = s.match(/<section class="more"><h2>Читайте также<\/h2><div class="cards">(<a class="card" href="[^"]+")/);
    assert.ok(more, p);
    assert.strictEqual(more[1], '<a class="card" href="/sravnit/"', p);
    assert.strictEqual((s.match(/href="\/sravnit\/"/g) || []).length, p.endsWith('priznaki-tehnicheskoj-kompanii') ? 2 : 1, p);
  }
});

test('/sravnit/ ведёт обратно: три статьи «Перед выбором поставщика», адреса живые', () => {
  const s = glavnoe(chitat('sravnit/index.html'));
  const blok = s.slice(s.indexOf('<h2>Перед выбором поставщика</h2>'));
  const ssylki = [...blok.matchAll(/<li><a href="(\/[^"]+)">/g)].map((m) => m[1]);
  assert.strictEqual(ssylki.length, 3);
  for (const u of ssylki) assert.ok(fs.existsSync(path.join(KOREN, u, 'index.html')), u);
});

test('сирот нет: у каждой страницы sitemap.xml есть ссылка из <main> другой страницы', () => {
  const vhody = new Map();
  const obhod = (d) => {
    for (const e of fs.readdirSync(path.join(KOREN, d), { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (['node_modules', '.git', 'сайт', 'tests'].includes(e.name)) continue;
        obhod(p);
      } else if (e.name.endsWith('.html')) {
        const rel = p.split(path.sep).join('/');
        const ya = '/' + (rel.endsWith('index.html') ? rel.slice(0, -10) : rel);
        for (const m of glavnoe(chitat(p)).matchAll(/href="(\/[^"#?]*)/g)) {
          const u = m[1];
          if (u !== ya) {
            if (!vhody.has(u)) vhody.set(u, new Set());
            vhody.get(u).add(p);
          }
        }
      }
    }
  };
  obhod('.');
  const sirot = [...chitat('sitemap.xml').matchAll(/<loc>https:\/\/deloskop\.ru([^<]*)<\/loc>/g)]
    .map((m) => m[1]).filter((u) => !(vhody.get(u) || new Set()).size);
  assert.deepStrictEqual(sirot, []);
});
