// vozrast-segodnya-v1: возраст компании на карточке — на сегодня (Очередь п. 287).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const V = require('../js/vozrast.js');

const KOREN = path.join(__dirname, '..');
const PAPKA = path.join(KOREN, 'company');
const MS = (s) => Date.parse(s);

test('vozrast.js: склонение', () => {
  assert.deepStrictEqual([1, 2, 5, 11, 21, 24, 25, 101, 112].map(V.slovo),
    ['год', 'года', 'лет', 'лет', 'год', 'года', 'лет', 'год', 'лет']);
});

test('vozrast.js: день по Москве, а не по часам посетителя', () => {
  assert.deepStrictEqual(V.segodnyaMsk(MS('2026-10-09T21:30:00Z')), [2026, 10, 10]);
  assert.deepStrictEqual(V.segodnyaMsk(MS('2026-10-09T20:59:00Z')), [2026, 10, 9]);
});

test('vozrast.js: полных лет — годовщина считается с самого дня', () => {
  assert.strictEqual(V.let_('2001-10-10', [2026, 10, 9]), 24);
  assert.strictEqual(V.let_('2001-10-10', [2026, 10, 10]), 25);
  assert.strictEqual(V.let_('2000-02-29', [2026, 2, 28]), 25);
  assert.strictEqual(V.let_('2000-02-29', [2026, 3, 1]), 26);
  assert.strictEqual(V.let_('2030-01-01', [2026, 10, 10]), null);
  assert.strictEqual(V.let_('плохо', [2026, 10, 10]), null);
});

function el(tekst, s) {
  return { textContent: tekst, getAttribute: (a) => (a === 'data-s' ? s : null) };
}

test('vozrast.js: только вперёд и не больше чем на 2 года', () => {
  const a = el('24 года', '2001-10-10');
  assert.strictEqual(V.obnovit(a, MS('2026-10-12T09:00:00Z')), true);
  assert.strictEqual(a.textContent, '25 лет');
  const nazad = el('25 лет', '2001-10-10');  // часы посетителя отстают на год
  assert.strictEqual(V.obnovit(nazad, MS('2025-10-12T09:00:00Z')), false);
  assert.strictEqual(nazad.textContent, '25 лет');
  const daleko = el('25 лет', '2001-10-10');  // часы убежали на 10 лет
  assert.strictEqual(V.obnovit(daleko, MS('2036-10-12T09:00:00Z')), false);
  assert.strictEqual(daleko.textContent, '25 лет');
});

function kartochki() {
  return fs.readdirSync(PAPKA).filter((d) => /^\d{10}-/.test(d))
    .map((d) => ({ d, t: fs.readFileSync(path.join(PAPKA, d, 'index.html'), 'utf8') }));
}

function lety(s, na) {
  const [g, m, d] = s.split('-').map(Number);
  return na[0] - g - ((na[1] < m || (na[1] === m && na[2] < d)) ? 1 : 0);
}

test('карточки: возраст — в span с датой регистрации из JSON-LD, везде одно число, скрипт подключён', () => {
  const k = kartochki();
  assert.ok(k.length > 0);
  const segodnya = V.segodnyaMsk(Date.now());
  let s_vozrastom = 0;
  for (const { d, t } of k) {
    const ld = /"foundingDate": "(\d{4}-\d{2}-\d{2})"/.exec(t);
    const spany = [...t.matchAll(/<span class="vozr" data-s="([\d-]+)">(\d+)&nbsp;(год|года|лет)<\/span>/g)];
    if (!spany.length) continue;
    s_vozrastom++;
    assert.ok(ld, d + ': span возраста без foundingDate');
    const chisla = new Set(spany.map((m) => m[2]));
    assert.strictEqual(chisla.size, 1, d + ': на странице разный возраст — ' + [...chisla].join(', '));
    for (const m of spany) {
      assert.strictEqual(m[1], ld[1], d + ': data-s не равна foundingDate');
      assert.strictEqual(m[3], V.slovo(+m[2]), d + ': склонение');
    }
    const n = +spany[0][2];
    assert.ok(n <= lety(ld[1], segodnya), d + ': возраст больше, чем на сегодня');
    assert.ok(t.includes('<script src="/js/vozrast.js" defer></script>'), d + ': нет js/vozrast.js');
  }
  assert.ok(s_vozrastom >= k.length * 0.9, 'возраст в span — у ' + s_vozrastom + ' из ' + k.length);
});

test('карточки: возраст без обёртки не остался, старой подписи даты реестра нет', () => {
  for (const { d, t } of kartochki()) {
    if (!t.includes('class="vozr"')) continue;
    assert.ok(!/<p>Работает \d+&nbsp;(год|года|лет) —/.test(t), d + ': «Работает N» без span');
    assert.ok(!/co-daty__p">— \d+&nbsp;(год|года|лет) назад/.test(t), d + ': «N назад» без span');
    assert.ok(!/в реестре с&nbsp;\d{4}&nbsp;года \(\d+&nbsp;/.test(t), d + ': «в реестре с» без span');
  }
  for (const { d, t } of kartochki()) assert.ok(!t.includes('реестре актуальны на'), d + ': старая подпись');
});
