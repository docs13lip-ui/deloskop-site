// kpi-izm-v1 [Ночные-3] 11.10: подпись «изменение за год» под KPI PDF-досье (js/kpi-izm.js, report.html)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const K = require('../js/kpi-izm.js');

const NB = '\u00a0';
const money = (v) => (v / 1e9).toFixed(1).replace('.', ',') + ' млрд ₽';

// живой ответ /api/check 11.10 (крупная компания, ряды ГИР БО — как пришли)
const CH = {
  profit: [
    { year: 2023, value: 695570288000 },
    { year: 2024, value: -1076329869000 },
    { year: 2025, value: 11284564000 }
  ]
};

test('прибыль после убытка — «из убытка в прибыль», а не «+101 %»', () => {
  const z = K.izm({ label: 'Чистая прибыль за 2025', value: 11284564000, delta: 101, good_up: true }, CH);
  assert.deepStrictEqual(z, { tekst: '▲' + NB + 'из убытка в' + NB + 'прибыль', ton: 'up' });
  assert.ok(!/%/.test(z.tekst));
});

test('убыток после прибыли — «из прибыли в убыток»; значение — словом «убыток»', () => {
  const x = { label: 'Чистая прибыль за 2024', value: -1076329869000, delta: -255, good_up: true };
  assert.deepStrictEqual(K.izm(x, CH), { tekst: '▼' + NB + 'из прибыли в' + NB + 'убыток', ton: 'down' });
  assert.strictEqual(K.znachenie(x, money), 'убыток 1076,3 млрд ₽');
});

test('убыток два года подряд — «убыток больше / меньше на N %»', () => {
  const ch = { profit: [{ year: 2024, value: -100 }, { year: 2025, value: -150 }] };
  assert.deepStrictEqual(K.izm({ label: 'Чистая прибыль за 2025', value: -150, delta: -50, good_up: true }, ch),
    { tekst: '▼' + NB + 'убыток больше на' + NB + '50' + NB + '%', ton: 'down' });
  const ch2 = { profit: [{ year: 2024, value: -200 }, { year: 2025, value: -50 }] };
  assert.deepStrictEqual(K.izm({ label: 'Чистая прибыль за 2025', value: -50, delta: 75, good_up: true }, ch2),
    { tekst: '▲' + NB + 'убыток меньше на' + NB + '75' + NB + '%', ton: 'up' });
});

test('обычный случай: настоящий минус и неразрывный пробел перед %', () => {
  assert.deepStrictEqual(K.izm({ label: 'Выручка за 2025', value: 5, delta: -7, good_up: true }, CH),
    { tekst: '▼' + NB + '−7' + NB + '%' + ' за' + NB + 'год', ton: 'down' });
  assert.deepStrictEqual(K.izm({ label: 'Активы', value: 5, delta: 12, good_up: true }, {}),
    { tekst: '▲' + NB + '+12' + NB + '% за' + NB + 'год', ton: 'up' });
  // рост долга — «плохо», красным
  assert.strictEqual(K.izm({ label: 'Кредиты и займы', value: 5, delta: 30, good_up: false }, {}).ton, 'down');
  assert.strictEqual(K.izm({ label: 'Выручка за 2025', value: 5, delta: 0.3, good_up: true }, {}).tekst, 'без изменений за' + NB + 'год');
  assert.strictEqual(K.izm({ label: 'Выручка за 2025', value: 5, delta: null }, {}), null);
});

test('прибыль без ряда: убыток — без процента, прибыль — как пришло', () => {
  assert.strictEqual(K.izm({ label: 'Чистая прибыль за 2025', value: -10, delta: 40, good_up: true }, {}), null);
  assert.strictEqual(K.izm({ label: 'Чистая прибыль за 2025', value: 10, delta: 40, good_up: true }, {}).tekst,
    '▲' + NB + '+40' + NB + '% за' + NB + 'год');
  // обе прибыли в ряду — процент считаем по ряду, не по delta
  const ch = { profit: [{ year: 2024, value: 100 }, { year: 2025, value: 250 }] };
  assert.strictEqual(K.izm({ label: 'Чистая прибыль за 2025', value: 250, delta: 999, good_up: true }, ch).tekst,
    '▲' + NB + '+150' + NB + '% за' + NB + 'год');
});

test('report.html подключает модуль и не собирает процент сам', () => {
  const t = fs.readFileSync(path.join(__dirname, '..', 'report.html'), 'utf8');
  assert.ok(t.includes('<script src="/js/kpi-izm.js"></script>'));
  assert.ok(t.includes('kpiHtml(D.kpi,D.charts)'));
  assert.ok(!t.includes("' % за год</div>'"), 'старая сборка «+N % за год» осталась');
  assert.ok(t.indexOf('/js/kpi-izm.js') < t.indexOf('function kpiHtml'));
});

test('report.html: триллионы — «трлн ₽», как на экране проверки', () => {
  const t = fs.readFileSync(path.join(__dirname, '..', 'report.html'), 'utf8');
  assert.ok(/if\(a>=1e12\)return sg\+\(a\/1e12\)[^\n]*трлн/.test(t));
});
