// shchit-finansy-v1 (04.10.2026, [Ночные-3]): Щит видит финансы из того же ответа /api/check (ГИР БО).
// Найдено отрисовкой живого ответа (7736050003): Щит писал «Заметных признаков в открытых данных нет», а ниже на том же
// экране стояли «Текущая ликвидность 0,82» и «Рентабельность ниже средней по отрасли — признак отбора на выездную проверку».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../js/shchit.js');
const R = require('../js/rentabelnost.js');

const chitat = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const NORMY = JSON.parse(chitat('data/fns-normy-2025.json'));
const K = JSON.parse(chitat('data/kommentarii.json'));
const zhel = (id) => K.signaly.find((x) => x.id === id).tony.zhel;

// Форма и числа — живой ответ /api/check по 7736050003 (04.10.2026), только нужные поля
function zhivoj() {
  return {
    checked_at: '2026-10-04',
    company: { inn: '7736050003', kind: 'LEGAL', status: 'ACTIVE', name_short: 'ПАО "ГАЗПРОМ"', okved: '46.71.4', reg_date: '1993-02-25', director_since: '2007-04-12' },
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая' },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет' },
      { id: 'age', title: 'Возраст компании', status: 'ok', detail: 'С 25.02.1993' },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', as_of: '01.09.2026' }
    ],
    zsk: { level: 'low', title: 'Низкая вероятность' },
    dossier: {
      sections: [{ id: 'dynamics', title: 'Финансовая динамика по годам', rows: [['Текущая ликвидность', '0.82']] }],
      charts: {
        revenue: [{ year: 2024, value: 6256645316000 }, { year: 2025, value: 5846351786000 }],
        profit: [{ year: 2024, value: -1076270574000 }, { year: 2025, value: 11284564000 }],
        income_tax: [{ year: 2024, value: 96466375000 }, { year: 2025, value: 152751487000 }],
        balance: { year: 2025, equity: 16432222886000, long_debt: 6386347532000, short_debt: 2917757718000 },
        debts: { year: 2025, receivables: 1144646095000, payables: 1172282674000, loans: 4425697799000 }
      }
    }
  };
}
const vse = (X) => [...X.banki, ...X.nalogovaya];

test('тексты «почему» — дословно утверждённые [Право] (data/kommentarii.json, тон zhel)', () => {
  for (const [kind, id, kto] of [['ubytki', 'ubytok', 'bank'], ['kapital', 'kapital', 'bank'], ['likvidnost', 'likvidnost', 'bank'], ['rentabelnost', 'ubytok', 'nalog']]) {
    const z = zhel(id);
    assert.strictEqual(z.status, 'utverzhdeno', id);
    const t = S.T[kind][kto === 'bank' ? 'b' : 'n'].t;
    assert.strictEqual(t, z[kto], kind);
  }
  // налоговая у капитала и ликвидности не пишется: [Право] — «не критерий отбора» / «критерий — убытки, а не сам минус»
  assert.ok(!S.T.kapital.n && !S.T.likvidnost.n);
});

test('живой ответ: без норм — ликвидность у банка, Щит больше не «чистый»', () => {
  const X = S.razbor(zhivoj());
  assert.strictEqual(X.chisto, false);
  const lk = X.banki.find((x) => x.kind === 'likvidnost');
  assert.ok(lk, 'нет ликвидности');
  assert.match(lk.priznak, /^Текущая ликвидность на\u00a031\.12\.2025 — 0,82: краткосрочные долги больше оборотных средств$/);
  assert.ok(!X.nalogovaya.some((x) => x.kind === 'likvidnost'));
  // у ликвидности шага нет — и не «Скорая»
  assert.ok(!X.shagi.some((s) => s.kind === 'skoraya' || s.kind === 'likvidnost'));
  assert.ok(!/Заметных признаков/.test(S.kratko(X)));
});

test('живой ответ + нормы ФНС: рентабельность — у налоговой, с цифрами блока ниже; шаг — объяснение для инспекции', () => {
  const X = S.razbor(zhivoj(), { normy: NORMY });
  const rn = X.nalogovaya.find((x) => x.kind === 'rentabelnost');
  assert.ok(rn, 'нет рентабельности');
  const o = R.raschet(zhivoj(), NORMY);
  assert.strictEqual(o.st, 'nizhe');
  assert.ok(rn.priznak.includes(R.pct(o.n)) && rn.priznak.includes(R.pct(o.norma)), rn.priznak);
  assert.match(rn.priznak, /\(оценка; ГИР\u00a0БО и ФНС\)$/);
  assert.strictEqual(X.shagi[0].kind, 'nagruzka');
  assert.strictEqual(X.shagi[0].t, S.T.nagruzka.s.t);
  assert.strictEqual(X.shagi.filter((s) => s.kind === 'nagruzka').length, 1);
  assert.match(S.kratko(X), /Признаков: 2\./);
});

test('рентабельность не ниже средней — строки нет; нормы без строки ОКВЭД — строки нет', () => {
  const r = zhivoj(); r.dossier.charts.profit[1].value = 900000000000; r.dossier.charts.income_tax[1].value = 200000000000;
  assert.ok(!vse(S.razbor(r, { normy: NORMY })).some((x) => x.kind === 'rentabelnost'));
  const r2 = zhivoj(); r2.company.okved = '99.99';
  assert.ok(!vse(S.razbor(r2, { normy: NORMY })).some((x) => x.kind === 'rentabelnost'));
});

test('убыток 2 года подряд и капитал меньше нуля — у банка; у капитала шага нет, у убытка — объяснение', () => {
  const r = zhivoj();
  r.dossier.charts.profit = [{ year: 2023, value: 5e6 }, { year: 2024, value: -2e6 }, { year: 2025, value: -3e6 }];
  r.dossier.charts.balance.equity = -1500000;
  r.dossier.sections = [];
  const X = S.razbor(r);
  const ub = X.banki.find((x) => x.kind === 'ubytki'), kp = X.banki.find((x) => x.kind === 'kapital');
  assert.strictEqual(ub.priznak, 'Убыток 2\u00a0года подряд — по годовой отчётности за 2024 и 2025');
  assert.strictEqual(kp.priznak, 'Собственный капитал на\u00a031.12.2025 — минус 1,5\u00a0млн\u00a0₽: обязательства больше активов');
  assert.deepStrictEqual(X.shagi.map((s) => s.kind), ['nagruzka', 'sled']);
  // один убыточный год — не признак (как в «Существенных фактах»)
  const r1 = zhivoj(); r1.dossier.charts.profit = [{ year: 2024, value: 7e6 }, { year: 2025, value: -5 }];
  assert.ok(!vse(S.razbor(r1)).some((x) => x.kind === 'ubytki'));
});

test('ИП и пустой ответ — финансовых строк нет; запрещённых слов нет', () => {
  const ip = zhivoj(); ip.company.inn = '771234567890'; ip.company.kind = 'INDIVIDUAL';
  assert.deepStrictEqual(S.finansy(ip, { normy: NORMY }), {});
  assert.deepStrictEqual(S.finansy({ company: { inn: '7707083893' } }, { normy: NORMY }), {});
  const r = zhivoj(); r.dossier.charts.profit = [{ year: 2024, value: -2e6 }, { year: 2025, value: -3e6 }]; r.dossier.charts.balance.equity = -1;
  const X = S.razbor(r, { normy: NORMY });
  const tekst = vse(X).map((x) => x.priznak + ' ' + x.pochemu).join(' ') + ' ' + X.shagi.map((s) => s.t).join(' ');
  assert.ok(!/предоплат|поставщик|\bМожно\b|надёжн|гарантир|безопасн/i.test(tekst), tekst);
});

function fakeEl() {
  return { innerHTML: '', ownerDocument: { getElementById: () => ({}), head: { appendChild() {} } }, addEventListener() {} };
}
test('mount: нормы пришли позже — разбор обновлён на месте (тот же объект для «Скопировать разбор»)', async () => {
  const el = fakeEl();
  const X = S.mount(el, zhivoj(), { rentabelnost: { zagruzit: () => Promise.resolve(NORMY), raschet: R.raschet, pct: R.pct } });
  assert.ok(!/Рентабельность активов/.test(el.innerHTML));
  const Y = await X.gotovo;
  assert.strictEqual(Y, X);
  assert.ok(/Рентабельность активов за 2025/.test(el.innerHTML));
  assert.match(S.kratko(X), /Признаков: 2\./);
});

test('mount: новая проверка до загрузки норм — старый разбор не вставляется', async () => {
  const el = fakeEl();
  let otdat; const zhdem = new Promise((res) => { otdat = res; });
  const X = S.mount(el, zhivoj(), { rentabelnost: { zagruzit: () => zhdem, raschet: R.raschet, pct: R.pct } });
  const vtoroj = zhivoj(); vtoroj.company.inn = '7707083893'; vtoroj.company.name_short = 'ООО «Другая»'; vtoroj.dossier.charts.balance = null; vtoroj.dossier.sections = [];
  S.mount(el, vtoroj, { normy: NORMY });
  const posle = el.innerHTML;
  otdat(NORMY); await X.gotovo;
  assert.strictEqual(el.innerHTML, posle);
});

test('шапка листа Щита («Признаков: N») пересчитывается, когда пришли нормы', () => {
  const s = chitat('js/otchet.js');
  assert.match(s, /o\.shR\.gotovo\.then\(shKr/);
});
