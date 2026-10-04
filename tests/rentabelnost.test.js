// rentabelnost-v1 (Ночные-3, 03.10): «Рентабельность активов против отрасли» на экране проверки и в Щите
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = require('../js/rentabelnost.js');

const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'fns-normy-2025.json'), 'utf8'));
const KOREN = path.join(__dirname, '..');

function otvet(over) {
  const o = {
    company: { inn: '7700000001', okved: '41.20', name_short: 'ООО «Пример»' },
    dossier: { charts: {
      profit: [{ year: 2024, value: 4e6 }, { year: 2025, value: 2e6 }],
      income_tax: [{ year: 2025, value: 0.5e6 }],
      balance: { year: 2025, equity: 40e6, long_debt: 10e6, short_debt: 50e6 }
    } }
  };
  return Object.assign(o, over || {});
}
function norma(okved, god) {
  const R2 = require('../js/nagruzka.js');
  const s = R2.najti(okved, D.rentabelnost.stroki);
  return god === 2025 ? s.aktivy : D.rentabelnost_2024.znacheniya[s.kod][1];
}

test('считает прибыль до налога к активам и находит строку ОКВЭД', () => {
  const o = R.raschet(otvet(), D);
  assert.ok(o);
  assert.strictEqual(o.god, 2025);
  assert.strictEqual(o.aktivy, 100e6);
  assert.strictEqual(o.rez, 2.5e6);
  assert.ok(Math.abs(o.n - 2.5) < 1e-9);
  assert.strictEqual(o.stroka.kod, 'F');
  assert.strictEqual(o.norma, norma('41.20', 2025));
});

test('ниже средней на 10 % и более — «внимание» и фраза критерия 11', () => {
  const nr = norma('41.20', 2025);
  assert.ok(typeof nr === 'number' && nr > 2.8, 'тест рассчитан на норму раздела F выше 2,8 %');
  const o = R.raschet(otvet(), D);
  assert.strictEqual(o.st, 'nizhe');
  const h = R.html(o);
  assert.match(h, /rnt--warn/);
  assert.match(h, /критерий 11 приложения 2 к Концепции/);
  assert.match(h, /оценка/);
  assert.match(h, /раздел F/);
});

test('не ниже и «чуть ниже» — без фразы о признаке отбора', () => {
  const nr = norma('41.20', 2025);
  const vys = otvet(); vys.dossier.charts.income_tax = []; vys.dossier.charts.profit = [{ year: 2025, value: nr * 1e6 * 1.5 }];
  const o1 = R.raschet(vys, D);
  assert.strictEqual(o1.st, 'ne-nizhe');
  assert.doesNotMatch(R.html(o1), /критерий 11/);
  const chut = otvet(); chut.dossier.charts.income_tax = []; chut.dossier.charts.profit = [{ year: 2025, value: nr * 1e6 * 0.95 }];
  const o2 = R.raschet(chut, D);
  assert.strictEqual(o2.st, 'chut-nizhe');
  assert.match(R.html(o2), /меньше чем на 10%/);
  assert.match(R.html(o2), /Налога на прибыль в ответе нет/);
});

test('убыток — ниже средней; минус пишется знаком «−»', () => {
  const r = otvet(); r.dossier.charts.profit = [{ year: 2025, value: -3e6 }]; r.dossier.charts.income_tax = [];
  const o = R.raschet(r, D);
  assert.strictEqual(o.st, 'nizhe');
  assert.match(R.html(o), /−3,0\u00a0%/);
});

test('2024 год — норма из rentabelnost_2024 и Информация ФНС от 07.05.2025', () => {
  const r = otvet(); r.dossier.charts.balance = { year: 2024, equity: 40e6, long_debt: 10e6, short_debt: 50e6 };
  const o = R.raschet(r, D);
  assert.strictEqual(o.norma, norma('41.20', 2024));
  assert.match(R.html(o), /07\.05\.2025/);
});

test('нет блока: ИП, банк, страховщик, малые активы, год без нормы, нет прибыли за год баланса, плохой баланс', () => {
  assert.strictEqual(R.raschet(otvet({ company: { inn: '770000000012', okved: '41.20' } }), D), null);
  assert.strictEqual(R.raschet(otvet({ company: { inn: '7707083893', okved: '64.19' } }), D), null);
  assert.strictEqual(R.raschet(otvet({ company: { inn: '7700000002', okved: '65.12' } }), D), null);
  const mal = otvet(); mal.dossier.charts.balance = { year: 2025, equity: 1e5, long_debt: 0, short_debt: 2e5 };
  assert.strictEqual(R.raschet(mal, D), null);
  const g23 = otvet(); g23.dossier.charts.balance = { year: 2023, equity: 40e6, long_debt: 10e6, short_debt: 50e6 };
  g23.dossier.charts.profit = [{ year: 2023, value: 1e6 }];
  assert.strictEqual(R.raschet(g23, D), null);
  const np = otvet(); np.dossier.charts.profit = [{ year: 2024, value: 1e6 }];
  assert.strictEqual(R.raschet(np, D), null);
  const pl = otvet(); pl.dossier.charts.balance = { year: 2025, equity: 40e6, long_debt: null, short_debt: 50e6 };
  assert.strictEqual(R.raschet(pl, D), null);
  assert.strictEqual(R.raschet(otvet(), null), null);
});

test('отрасль убыточна или нормы нет — сравнение не делаем, «Всего» не подставляем', () => {
  const otr = otvet({ company: { inn: '7700000003', okved: '02.20' } });
  const o = R.raschet(otr, D);
  assert.strictEqual(o.st, 'otr');
  assert.strictEqual(o.norma, null);
  const net = otvet({ company: { inn: '7700000004', okved: '' } });
  const o2 = R.raschet(net, D);
  assert.strictEqual(o2.st, 'net-normy');
  assert.match(R.html(o2), /со строкой «Всего» не сравниваем/);
  assert.doesNotMatch(R.html(o2), /Средняя по отрасли —/);
});

test('тексты: без обещаний исхода и превосходных степеней, источник и дата нормы', () => {
  const vse = Object.keys(R.VYVOD).map(k => R.VYVOD[k]).join(' ') + ' ' + R.PRIZNAK + ' ' + R.html(R.raschet(otvet(), D));
  assert.doesNotMatch(vse, /гарант|безопасн|надёжн|надежн|лучш|не проверят|не придут/i);
  assert.match(vse, /ММ-3-06\/333@/);
  assert.match(vse, /05\.05\.2026/);
  assert.match(vse, /ГИР БО/);
});

test('index.html: модуль подключён после nagruzka.js и вызывается в render', () => {
  const s = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  const a = s.indexOf('/js/nagruzka.js'), b = s.indexOf('/js/rentabelnost.js');
  assert.ok(a > 0 && b > a);
  assert.match(s, /Rentabelnost\.mount\(report,r\)/);
});
