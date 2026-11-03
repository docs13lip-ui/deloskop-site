// razbor38-blok-v1 ([Ночные запуски] 03.11): Разбор № 38 — не новый адрес, а блок «Что решил Верховный суд 15 октября 2026 года»
// на живой странице КС 52-П (Очередь п. 453; дубль URL с той же темой Яндекс склеил бы). Текст — [Право] 03.11 разд. 6,
// сверен с полным текстом определения № 306-ЭС26-9423 на garant.ru (doc 414989893): даты актов, блокированная застройка, п. 7 ст. 3 НК.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/‑/g, '-');
const SLUG = 'zemelnyj-nalog-izhs-koefficienty-ks-52-p';

test('Разбор № 38: второе дело — ВС № 306-ЭС26-9423 от 15.10.2026, сверка «kopiya», адрес прежний', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data), ['№ 52-П 2026-07-21', '№ 306-ЭС26-9423 2026-10-15']);
  assert.strictEqual(r.dela[1].sverka_vid, 'kopiya', 'с сайтом ВС ещё не сверено — так и пишем');
  assert.ok(r.dela[1].delo.includes('А65-42007/2024'));
  assert.strictEqual(r.izmeneno, '2026-11-03');
  assert.ok(!D.razbory.some((x) => /zemlya-izhs-u-kompanii/.test(x.slug)), 'отдельного адреса-дубля нет');
});

test('Разбор № 38: страница — блок ВС, 2 карточки, FAQ 6, dateModified, честная строка «Сверено»', () => {
  const h = un(chitat('praktika/nalogi/' + SLUG + '/index.html'));
  assert.ok(h.includes('Что решил Верховный суд 15 октября 2026 года'));
  assert.strictEqual((h.match(/class="delo"/g) || []).length, 2);
  for (const d of ['2025-05-16', '2026-10-15']) assert.ok(h.includes('datetime="' + d + '"'), d);
  assert.ok(/Апелляция \(09\.02\.2026\) и суд округа \(04\.06\.2026\)/.test(h));
  assert.ok(h.includes('"dateModified": "2026-11-03"'));
  assert.strictEqual((h.match(/"@type": ?"Question"/g) || []).length, 6);
  assert.ok(h.includes('с сайтом Верховного суда ещё сверяем'));
  assert.ok(/блокированной застройки/.test(h) && /п\. 7 ст\. 3 НК/.test(h));
  assert.ok(!/вернём|гарантируем|Завьялова|Антонова|Грачева/.test(h), 'без обещаний и имён судей');
});
