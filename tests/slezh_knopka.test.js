// [Ночные запуски] slezh-knopka-v1 (04.10.2026): вторая кнопка «Следить за должником» в Разборе № 9 —
// только когда «Слежение» пишет письма (tarify.json → slezhenie_pisma: true). Пока писем нет — ни кнопки, ни скрытого текста.
// node --test tests/slezh_knopka.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../js/slezh-knopka.js');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');

// Мини-DOM: секция с главной кнопкой — ровно столько, сколько трогает модуль.
function uzel(tag, attrs) {
  const u = { tagName: tag.toUpperCase(), attrs: Object.assign({}, attrs || {}), children: [], parentNode: null, className: '', textContent: '' };
  u.getAttribute = (k) => (k in u.attrs ? u.attrs[k] : null);
  u.setAttribute = (k, v) => { u.attrs[k] = String(v); };
  u.appendChild = (c) => { c.parentNode = u; u.children.push(c); return c; };
  u.insertBefore = (c, ref) => { c.parentNode = u; const i = ref ? u.children.indexOf(ref) : -1; if (i < 0) u.children.push(c); else u.children.splice(i, 0, c); return c; };
  Object.defineProperty(u, 'nextSibling', { get: () => (u.parentNode ? u.parentNode.children[u.parentNode.children.indexOf(u) + 1] || null : null) });
  u.querySelector = (sel) => {
    if (sel === 'a[data-slezh-knopka]') return u.children.find((c) => c.tagName === 'A' && 'data-slezh-knopka' in c.attrs) || null;
    if (sel === 'a.btn') return u.children.find((c) => c.tagName === 'A' && /(^|\s)btn(\s|$)/.test(c.className)) || null;
    return null;
  };
  return u;
}
function sekciya(attrs) {
  const s = uzel('section', Object.assign({ 'data-slezh': 'Следить за должником', 'data-slezh-url': '/cabinet.html#watch', 'data-slezh-cel': 'razbor9_slezh' }, attrs || {}));
  s.appendChild(uzel('h2'));
  const a = uzel('a', { href: '/', 'data-goal': 'razbor9_check' }); a.className = 'btn';
  s.appendChild(a);
  s.appendChild(uzel('p'));
  return s;
}
const doc = (sekcii) => ({
  createElement: (t) => uzel(t),
  querySelectorAll: (sel) => (sel === '[data-slezh]' ? sekcii : []),
});
const otvet = (j, ok) => () => Promise.resolve({ ok: ok !== false, json: () => Promise.resolve(j) });

test('флаг: кнопка только при slezhenie_pisma === true', () => {
  assert.strictEqual(S.pokazat({ slezhenie_pisma: true }), true);
  for (const x of [null, undefined, {}, { slezhenie_pisma: false }, { slezhenie_pisma: 'true' }, { slezhenie_pisma: 1 }]) assert.strictEqual(S.pokazat(x), false, JSON.stringify(x));
  assert.strictEqual(S.TARIFY_URL, '/tarify/tarify.json');
});

test('адрес — только свой сайт', () => {
  assert.ok(S.svoj('/cabinet.html#watch'));
  for (const u of ['//evil.ru/', 'https://evil.ru/', 'javascript:alert(1)', 'cabinet.html', '/a"b', '', null]) assert.strictEqual(S.svoj(u), false, String(u));
});

test('кнопка встаёт сразу после главной, с целью Метрики; второй раз не дублируется', () => {
  const s = sekciya(); const d = doc([s]);
  const a = S.postavit(d, s);
  assert.ok(a);
  assert.strictEqual(s.children.indexOf(a), 2, 'после главной кнопки');
  assert.strictEqual(a.className, 'btn btn--vtor');
  assert.strictEqual(a.href, '/cabinet.html#watch');
  assert.strictEqual(a.textContent, 'Следить за должником');
  assert.strictEqual(a.getAttribute('data-goal'), 'razbor9_slezh');
  assert.strictEqual(S.postavit(d, s), null);
  assert.strictEqual(s.children.filter((c) => 'data-slezh-knopka' in c.attrs).length, 1);
});

test('чужой адрес, пустой текст, плохая цель — без кнопки или без цели', () => {
  assert.strictEqual(S.postavit(doc([]), sekciya({ 'data-slezh-url': 'https://evil.ru/' })), null);
  assert.strictEqual(S.postavit(doc([]), sekciya({ 'data-slezh': '' })), null);
  const a = S.postavit(doc([]), sekciya({ 'data-slezh-cel': 'x" onclick="1' }));
  assert.ok(a); assert.strictEqual(a.getAttribute('data-goal'), null);
});

test('запуск: писем нет / файла нет / сеть упала — кнопки нет; письма идут — есть', async () => {
  const s1 = sekciya();
  assert.strictEqual(await S.zapusk(doc([s1]), otvet({ slezhenie_pisma: false })), 0);
  assert.strictEqual(await S.zapusk(doc([s1]), otvet(null, false)), 0);
  assert.strictEqual(await S.zapusk(doc([s1]), () => Promise.reject(new Error('сеть'))), 0);
  assert.strictEqual(s1.children.length, 3, 'секция не тронута');
  let zvali = 0;
  assert.strictEqual(await S.zapusk(doc([]), () => { zvali++; return otvet({})(); }), 0);
  assert.strictEqual(zvali, 0, 'нет секций — tarify.json не запрашиваем');
  const s2 = sekciya(), s3 = sekciya();
  assert.strictEqual(await S.zapusk(doc([s2, s3]), otvet({ slezhenie_pisma: true })), 2);
});

test('Разбор № 9: секция с атрибутами и скрипт; текста кнопки на странице нет (без скрытого текста)', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const spisok = Array.isArray(D) ? D : (D.razbory || D.dela || Object.values(D).find(Array.isArray));
  const sl = spisok.filter((r) => r.knopka && r.knopka.slezh);
  assert.ok(sl.length >= 1);
  for (const r of sl) {
    const f = fs.readdirSync(path.join(K, 'praktika')).map((raz) => path.join('praktika', raz, r.slug, 'index.html')).find((p) => fs.existsSync(path.join(K, p)));
    assert.ok(f, r.slug);
    const h = chitat(f);
    assert.ok(h.includes('data-slezh="' + r.knopka.slezh.knopka + '" data-slezh-url="/cabinet.html#watch"'), f);
    assert.ok(h.includes('<script src="/js/slezh-knopka.js" defer></script>'), f);
    const tekst = h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
    assert.ok(!tekst.includes(r.knopka.slezh.knopka), 'текст кнопки только в атрибуте: ' + f);
  }
  // на остальных разборах скрипта нет
  const bez = spisok.filter((r) => !(r.knopka && r.knopka.slezh));
  for (const r of bez) {
    const f = fs.readdirSync(path.join(K, 'praktika')).map((raz) => path.join('praktika', raz, r.slug, 'index.html')).find((p) => fs.existsSync(path.join(K, p)));
    if (f) assert.ok(!chitat(f).includes('slezh-knopka.js'), f);
  }
});

test('стиль второй кнопки: контур на тёмном блоке, на телефоне — под главной', () => {
  const css = chitat('css/praktika.css');
  assert.ok(/\.pr \.btn--vtor\{[^}]*background:transparent/.test(css));
  assert.ok(/@media \(max-width:520px\)\{\.pr \.btn--vtor\{[^}]*margin:12px 0 0/.test(css));
});
