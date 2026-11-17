// zajmy-raz-v1 (17.11.2026): кредиты к выручке в 3 раза и больше — «в 33 раза больше выручки за 2025», а не «3306 %»,
// на экране проверки (js/dinamika.js), в Паспорте (js/pasport-kontragenta.js) и на карточке компании — одними словами.
// node --test tests/zajmy_raz.test.js
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/dinamika.js');
const P = require('../js/pasport-kontragenta.js');
const U = require('../js/usloviya.js');
const IV = require('../js/indeks-vorota.js');
const opt = { usloviya: U, indeksVorota: IV };
const kredity = (p) => p.razdely.find((x) => x.id === 'finansy').fakty.find((f) => f.tekst === 'Кредиты и займы');
const NB = ' ';
const tekst = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function otvet(loans, vyr) {
  return { checked_at: '2026-11-17T11:00:00+03:00', company: { inn: '7709463989', kind: 'LEGAL', status: 'ACTIVE', name_short: 'ООО «Образец»' },
    risk_level: 'low', signals: [], dossier: { charts: {
    revenue: [{ year: 2024, value: vyr }, { year: 2025, value: vyr }],
    balance: { year: 2025, equity: 2e10, long_debt: 9e10, short_debt: 4e9 },
    debts: { year: 2025, receivables: 4.51e10, payables: 3.6e9, loans: loans },
  } } };
}

test('экран: 3306 % → «в 33 раза больше выручки за 2025»; число процентов в данных остаётся', () => {
  const b = D.balans(otvet(9.6e10, 2.904e9));
  assert.strictEqual(b.zajmyKVyr, 3306);
  assert.strictEqual(b.zajmyTekst, 'в' + NB + '33' + NB + 'раза больше выручки за' + NB + '2025');
  const h = tekst(D.htmlBalans(otvet(9.6e10, 2.904e9)));
  assert.match(h, /Кредиты и займы 96,0 млрд ₽ в 33 раза больше выручки за 2025/);
  assert.doesNotMatch(h, /3306/);
});

test('экран: ниже трёх раз — проценты, как было; 3,4 раза и 12 раз — по правилам склонения', () => {
  assert.strictEqual(D.balans(otvet(2.5e9, 1e9)).zajmyTekst, '250' + NB + '% выручки за' + NB + '2025');
  assert.strictEqual(D.balans(otvet(3.44e9, 1e9)).zajmyTekst, 'в' + NB + '3,4' + NB + 'раза больше выручки за' + NB + '2025');
  assert.strictEqual(D.balans(otvet(5e9, 1e9)).zajmyTekst, 'в' + NB + '5' + NB + 'раз больше выручки за' + NB + '2025');
  assert.strictEqual(D.balans(otvet(1.2e10, 1e9)).zajmyTekst, 'в' + NB + '12' + NB + 'раз больше выручки за' + NB + '2025');
  assert.strictEqual(D.balans(otvet(2.2e10, 1e9)).zajmyTekst, 'в' + NB + '22' + NB + 'раза больше выручки за' + NB + '2025');
});

test('Паспорт: те же слова, что на экране', () => {
  const f = kredity(P.sobrat(otvet(9.6e10, 2.904e9), opt));
  assert.ok(f, 'строка «Кредиты и займы» есть');
  assert.match(f.znachenie, new RegExp('— в' + NB + '33' + NB + 'раза больше выручки за' + NB + '2025$'));
  const f2 = kredity(P.sobrat(otvet(2.5e9, 1e9), opt));
  assert.match(f2.znachenie, new RegExp('— 250' + NB + '% выручки за' + NB + '2025$'));
});
