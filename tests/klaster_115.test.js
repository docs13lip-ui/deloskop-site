// klaster-115-v1 — статьи раздела /115-fz/ связаны между собой (кластер для поиска).
// Правило: на каждую статью /115-fz/<имя>/ ведут ссылки из <main> не меньше чем ЧЕТЫРЁХ других страниц
// (шапка и подвал не в счёт). До klaster-115-v1 «Однофамилец в перечне» держался на 2 ссылках, «115-ФЗ в цифрах» — на 3.
// И карточки «Читайте также» — живые: адрес существует, заголовок карточки = h1 статьи.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const MIN = 4;

function stranicy(dir, out = []) {
  for (const e of fs.readdirSync(path.join(KOREN, dir), { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'tests' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) stranicy(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const adres = (p) => '/' + p.replace(/\\/g, '/').replace(/index\.html$/, '');
const mainIz = (t) => { const a = t.indexOf('<main'); const b = t.indexOf('</main>'); return a < 0 || b < 0 ? '' : t.slice(a, b); };
const STATI = fs.readdirSync(path.join(KOREN, '115-fz'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(KOREN, '115-fz', e.name, 'index.html')))
  .map((e) => '/115-fz/' + e.name + '/');

test('в разделе 115-ФЗ есть статьи', () => {
  assert.ok(STATI.length >= 8, 'статей ' + STATI.length);
});

test('на каждую статью 115-ФЗ ведут ≥ ' + MIN + ' других страниц из текста (не шапка/подвал)', () => {
  const vhod = new Map(STATI.map((u) => [u, new Set()]));
  for (const p of stranicy('.')) {
    const me = adres(path.relative('.', p));
    const m = mainIz(chitat(p));
    for (const h of m.matchAll(/href="(\/115-fz\/[^"#?]+\/)/g)) {
      if (h[1] !== me && vhod.has(h[1])) vhod.get(h[1]).add(me);
    }
  }
  const malo = [...vhod].filter(([, s]) => s.size < MIN).map(([u, s]) => u + ' ← ' + s.size + ' (' + [...s].join(', ') + ')');
  assert.deepStrictEqual(malo, []);
});

test('карточки «Читайте также» в статьях 115-ФЗ: адрес живой, заголовок = h1 статьи', () => {
  const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-').replace(/\s+/g, ' ').trim();
  for (const u of STATI) {
    const t = chitat(u.slice(1) + 'index.html');
    const sec = (t.match(/<section class="more">[\s\S]*?<\/section>/) || [''])[0];
    assert.ok(sec, u + ': нет «Читайте также»');
    const k = [...sec.matchAll(/<a class="card" href="([^"]+)">[\s\S]*?<b>([\s\S]*?)<\/b>/g)];
    assert.ok(k.length >= 2, u + ': карточек ' + k.length);
    const vidali = new Set();
    for (const [, href, b] of k) {
      assert.ok(!vidali.has(href), u + ': карточка-дубль ' + href); vidali.add(href);
      assert.notStrictEqual(href, u, u + ': ссылка на саму себя');
      if (!href.startsWith('/115-fz/')) continue;
      const f = path.join(KOREN, href.slice(1), 'index.html');
      assert.ok(fs.existsSync(f), u + ': ' + href + ' не существует');
      const h1 = (fs.readFileSync(f, 'utf8').match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1];
      const a = plain(b); const z = plain(h1);
      assert.ok(z.startsWith(a.replace(/[.:].*$/, '')) || a.startsWith(z.replace(/[.:].*$/, '')), u + ': карточка «' + a + '» ≠ h1 «' + z + '»');
    }
  }
});
