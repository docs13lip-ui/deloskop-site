// [Ночные-3] slezhenie-chestno-v1: «Слежение» без обещаний, пока API не шлёт писем (флаг slezhenie_pisma в tarify/tarify.json).
// ТЗ [Продукт · Стратег] 03.10.2026 19:40 (claude/Продукт_слежение_минимум_14.10_03.10.md, разд. 3) и тексты
// [Право · Юрист 115-ФЗ] 03.10.2026 20:07 (claude/Право_слежение_письмо_S1_код110_пилюля_03.10.md, разд. 2.4–2.5): риск ч. 3 и 7 ст. 5 38-ФЗ.
// Плюс якорь #indeks у колонки Индекса в отчёте (✎ [Ночные-2] 03.10 20:50). node --test tests/slezhenie_chestno.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const T = JSON.parse(chitat('tarify/tarify.json'));

// Все страницы и скрипты сайта, кроме тестов, карточек компаний и истории ленты.
function fajly(dir, out) {
  for (const x of fs.readdirSync(path.join(K, dir), { withFileTypes: true })) {
    const p = path.join(dir, x.name);
    if (x.isDirectory()) {
      if (/^(\.|node_modules|tests|company|deploy|сайт)/.test(x.name)) continue;
      fajly(p, out);
    } else if (/\.(html|js)$/.test(x.name) && !/^obnovleniya\.js$/.test(x.name)) out.push(p);
  }
  return out;
}
// Текст для поиска: без JSON с ценами (там — служебные пояснения флага), без тегов; JSON-LD FAQ остаётся.
const tekst = (s) => s.replace(/<script type="application\/json" id="tarify-data">[\s\S]*?<\/script>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\u00a0/g, ' ').replace(/\s+/g, ' ');
// /rassylki/ — перечень видов служебных писем, не обещание ([Право] 20:07, разд. 2.5).
const MOZHNO = new Set(['rassylki/index.html']);
const OBESHCHANIE = /сообщ(им|ит)|пришл[её]м|узнаете|чтобы узнать|уведомим|напишем/i;

test('флаг slezhenie_pisma есть и булев; тексты на оба случая — в tarify.json', () => {
  assert.strictEqual(typeof T.slezhenie_pisma, 'boolean');
  assert.ok(T._slezhenie_pisma && /slezhenie_chestno/.test(T._slezhenie_pisma));
  assert.ok(T.slezhenie_pri_pismah.includes('{N}'));
  assert.ok(T.slezhenie_pri_pismah.includes('ИП на слежение не ставим'), '[Право] 2.4: о 12-значных ИНН не молчим');
  assert.ok(T.slezhenie_pri_pismah.includes('по сведениям ЕГРЮЛ'));
  assert.ok(!/открытым данным ФНС/.test(T.slezhenie_pri_pismah + T.dopolneniya.storozh.chto), '[Право] 2.4: только ЕГРЮЛ');
});

test('тарифы: строка слежения соответствует флагу', () => {
  const ploho = (n) => (n % 10 === 1 && n % 100 !== 11) ? 'компанию' : ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'компании' : 'компаний');
  for (const t of T.tarify) {
    const s = t.chto.filter((x) => /лежени/i.test(x));
    if (!t.slezhenie) { assert.strictEqual(s.length, 0, t.id); continue; }
    assert.strictEqual(s.length, 1, t.id);
    if (T.slezhenie_pisma) assert.strictEqual(s[0], T.slezhenie_pri_pismah.replace('{N}', t.slezhenie));
    else assert.strictEqual(s[0], 'Список слежения на ' + t.slezhenie + ' ' + ploho(t.slezhenie) + ' в кабинете', t.id);
  }
  assert.strictEqual(T.dopolneniya.storozh.pokazyvat, T.slezhenie_pisma, '«Сторож» показываем только когда письма идут');
});

test('писем нет — нигде на сайте нет «сообщим / узнаете» рядом со «слежением»', { skip: T.slezhenie_pisma }, () => {
  const plohie = [];
  for (const f of fajly('.', [])) {
    if (MOZHNO.has(f)) continue;
    const t = tekst(chitat(f));
    for (const pr of t.split(/(?<=[.!?…])\s+|\\n|['"]\s*[,+]\s*['"]/)) {
      if (/лежени/i.test(pr) && OBESHCHANIE.test(pr)) plohie.push(f + ': ' + pr.trim().slice(0, 140));
    }
  }
  assert.deepStrictEqual(plohie, []);
});

test('писем нет — тексты [Продукт] разд. 3 и [Право] разд. 2.5 стоят', { skip: T.slezhenie_pisma }, () => {
  const kab = chitat('cabinet.html');
  assert.ok(kab.includes("'Добавили. Статус компании — в списке; обновить — «Проверить».'"));
  assert.ok(!/Сообщим, если/.test(kab));
  assert.ok(tekst(chitat('indeks/index.html')).includes('а при повторной проверке вы видите причину: «72 → 45'));
  assert.ok(tekst(chitat('nalogi/nedostovernyj-adres-egryul/index.html')).includes('добавьте его в список слежения в кабинете и перепроверяйте перед оплатой: так вы увидите, когда отметка появится или исчезнет.'));
  for (const f of ['nalogi/priznaki-tehnicheskoj-kompanii/index.html', 'nalogi/svezhest-dannyh-proverki-kontragenta/index.html']) {
    assert.match(tekst(chitat(f)), /в список слежения в ?кабинете и проверяйте перед каждой оплатой\./, f);
  }
  for (const f of ['pasport/index.html', 'osnovatel/index.html', 'rekvizity/index.html']) {
    const t = tekst(chitat(f));
    assert.ok(t.includes('список слежения'), f);
    assert.ok(!/слежение за (изменениями|компаниями)/.test(t), f);
  }
  const tar = tekst(chitat('tarify/index.html'));
  assert.ok(!/Сторож/.test(tar), '«Сторож» скрыт до писем');
  assert.ok(tar.includes('Список слежения на 3 компании в кабинете'));
});

test('отчёт: колонка Индекса с якорем #indeks; по «#indeks» прокрутка к ней, иначе — к отчёту', () => {
  const src = chitat('js/otchet.js');
  assert.ok(src.includes("ix.id = 'indeks';"));
  assert.match(chitat('css/otchet.css'), /#ot-kak,#indeks\{scroll-margin-top:140px\}/);
  const O = require('../js/otchet.js');
  const mkDoc = (hash) => {
    const kuda = [];
    const ix = { getBoundingClientRect: () => ({ top: 900 }) };
    const w = { location: { hash }, pageYOffset: 0, scrollTo: (o) => kuda.push(o.top), matchMedia: () => ({ matches: true }), getComputedStyle: () => ({ position: 'static' }) };
    const doc = { defaultView: w, getElementById: (id) => (id === 'indeks' ? ix : null), querySelector: () => null, querySelectorAll: () => [] };
    return { report: { ownerDocument: doc, getBoundingClientRect: () => ({ top: 300 }) }, kuda };
  };
  const a = mkDoc('#indeks'); O.prokrutit(a.report);
  const b = mkDoc(''); O.prokrutit(b.report);
  assert.ok(a.kuda[0] > b.kuda[0], 'с #indeks — ниже, к колонке Индекса');
});
