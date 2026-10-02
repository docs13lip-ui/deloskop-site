// [Ночные-3] predoplata-v1 — /indeks/#predoplata: открытая формула предела предоплаты (ТЗ [Продукт] 02.10, разд. 3).
// Главное: текст страницы и пример совпадают с кодом отчёта (js/usloviya.js), иначе разойдутся при первой правке.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const U = require('../js/usloviya.js');
const P = require('../indeks/predoplata.js');
const S = fs.readFileSync(path.join(KOREN, 'indeks/index.html'), 'utf8');
const NB = '\u00a0';
const tekst = (h) => h.replace(/&nbsp;/g, NB).replace(/<[^>]+>/g, '');
const sek = (() => {
  const a = S.indexOf('<h2 id="predoplata">'), b = S.indexOf('<h2>Как считается</h2>');
  assert.ok(a > 0 && b > a, 'раздел #predoplata стоит перед «Как считается»');
  return S.slice(a, b);
})();
const rub = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽';

test('константы кода — в тексте страницы: делитель и потолки по возрасту', () => {
  const t = tekst(sek), M = U.METODIKA;
  assert.ok(t.includes('выручка ÷' + NB + M.DELITEL), 'делитель ' + M.DELITEL);
  const sroki = { 6: 'до' + NB + '6' + NB + 'месяцев', 12: 'до' + NB + 'года', 36: 'до' + NB + '3' + NB + 'лет', Infinity: 'старше' };
  M.POTOLKI.forEach(([m, sum]) => assert.ok(t.includes(sroki[m] + ' — ' + rub(sum)), 'потолок ' + m + ' → ' + sum));
  assert.strictEqual(M.OSTOROZHNO, false, 'правило «долги не проверены → половина» включили — допишите его в формулу на /indeks/');
  assert.ok(U.prepayCap({ revenue: null, ageMonths: null }, 'go').cap === 1000000 && t.includes('Возраст тоже неизвестен — ' + rub(1000000)));
});

test('округление в тексте = niceFloor', () => {
  const t = tekst(sek);
  assert.ok(t.includes('шагом 10' + NB + '000' + NB + '₽') && t.includes('шагом 50' + NB + '000' + NB + '₽') && t.includes('шагом 100' + NB + '000' + NB + '₽'));
  assert.strictEqual(U.niceFloor(87400), 80000);
  assert.strictEqual(U.niceFloor(461538), 450000);
  assert.strictEqual(U.niceFloor(3846), 10000, 'минимум 10 000 ₽ — в тексте «меньше 10 000 ₽ ориентир не ставим»');
  assert.ok(t.includes('меньше 10' + NB + '000' + NB + '₽ ориентир не' + NB + 'ставим'));
});

test('пример на странице посчитан кодом отчёта', () => {
  const t = tekst(sek);
  const go = U.prepayCap({ revenue: 12e6, ageMonths: 60 }, 'go').cap;
  const cap = U.prepayCap({ revenue: 12e6, ageMonths: 60 }, 'cap').cap;
  const mal = U.prepayCap({ revenue: 12e6, ageMonths: 8 }, 'go').cap;
  assert.deepStrictEqual([go, cap, mal], [450000, 200000, 300000]);
  [go, cap, mal].forEach((n) => assert.ok(t.includes(rub(n)), 'в примере ' + n));
  assert.strictEqual(U.prepayCap({ revenue: 12e6, ageMonths: 60 }, 'post').cap, 0);
});

test('мини-расчёт = код отчёта, «Только по факту» — 0', () => {
  for (const voz of Object.keys(P.VOZRAST)) for (const vyv of Object.keys(P.VYVOD)) for (const vyr of [null, 100000, 2.6e6, 12e6, 9e9]) {
    const r = P.raschet({ vyruchka: vyr, vozrast: voz, vyvod: vyv });
    assert.strictEqual(r.itog, U.prepayCap({ revenue: vyr, ageMonths: P.VOZRAST[voz].m }, vyv).cap, [voz, vyv, vyr].join(' '));
    assert.ok(r.shagi.length >= 1 && r.shagi.every((x) => !/NaN|undefined/.test(x)));
  }
  assert.strictEqual(P.raschet({ vyruchka: 12e6, vozrast: 'starshe', vyvod: 'post' }).itog, 0);
  assert.strictEqual(P.chislo('12 000 000'), 12e6);
  assert.strictEqual(P.chislo('12 млн'), 12e6);
  assert.strictEqual(P.chislo(''), null);
});

test('страница: форма, скрипты по порядку, оговорка, без обещаний', () => {
  assert.ok(/<form class="pk" id="pk"/.test(sek) && /name="vyruchka"/.test(sek) && /name="vozrast"/.test(sek) && /name="vyvod"/.test(sek));
  const a = S.indexOf('src="/js/usloviya.js"'), b = S.indexOf('src="predoplata.js"');
  assert.ok(a > 0 && b > a, 'usloviya.js раньше predoplata.js (оба defer)');
  const t = tekst(sek);
  assert.ok(t.includes('не' + NB + 'норма закона'));
  assert.ok(sek.includes('href="/nalogi/skolko-platit-vpered-neznakomoj-kompanii/"'));
  assert.ok(!/гарантир|безопасн|лучш|самый/i.test(t));
});

test('FAQ: вопрос в разметке и на странице — одним текстом', () => {
  const v = 'Сколько можно заплатить вперёд новому поставщику?';
  const ld = JSON.parse(S.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const q = ld.find((x) => x['@type'] === 'FAQPage').mainEntity.find((x) => x.name === v);
  assert.ok(q, 'вопрос в FAQPage');
  assert.ok(S.includes('<details><summary>' + v + '</summary><p>' + q.acceptedAnswer.text + '</p></details>'));
  assert.ok(q.acceptedAnswer.text.includes('выручка ÷ ' + U.METODIKA.DELITEL));
});

test('отчёт ведёт на формулу: «Условия сделки» и лист отчёта', () => {
  assert.strictEqual(U.FORMULA, '/indeks/#predoplata');
  const usl = fs.readFileSync(path.join(KOREN, 'js/usloviya.js'), 'utf8');
  const ot = fs.readFileSync(path.join(KOREN, 'js/otchet.js'), 'utf8');
  assert.ok(usl.includes("'<p class=\"usl-cap\">Ориентир Делоскопа, не норма закона. <a href=\"' + FORMULA + '\">"));
  assert.ok(ot.includes('<a href="/indeks/#predoplata">Открытая формула предела</a>'));
});
