// «Динамика за 3–5 лет» и «Что изменилось с вашей проверки» (js/dinamika.js) — экран проверки по ИНН.
// node --test tests/dinamika.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../js/dinamika.js');
const KOREN = path.join(__dirname, '..');
const NB = ' ';

// Форма живого ответа /api/check 02.10 (ПАО, ряды ГИР БО; суммы округлены)
function otvet(over) {
  const r = {
    company: { inn: '7736050003', kind: 'LEGAL', status: 'ACTIVE', director_since: '2007-04-12', director_name: 'Иванов Иван Иванович', invalid: false, address_invalid: false, address: 'г Москва' },
    risk_level: 'low', risk_title: 'Низкий риск', checked_at: '2026-10-02T03:30:00Z',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая' },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет' },
    ],
    zsk: { level: 'low' },
    dossier: { charts: {
      revenue: [{ year: 2020, value: 4061e9 }, { year: 2021, value: 6389e9 }, { year: 2022, value: 7979e9 }, { year: 2023, value: 5620e9 }, { year: 2024, value: 6257e9 }, { year: 2025, value: 5846e9 }],
      profit: [{ year: 2021, value: 2684e9 }, { year: 2022, value: 747e9 }, { year: 2023, value: 696e9 }, { year: 2024, value: -1076e9 }, { year: 2025, value: 11.3e9 }],
      income_tax: [{ year: 2024, value: 96e9 }, { year: 2025, value: 153e9 }],
    } },
  };
  return Object.assign(r, over || {});
}
function hran() {
  const st = {};
  return { st, getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); } };
}

test('ряд: по возрастанию, без повторов и мусора, последние 5 лет', () => {
  const a = D.ryad([{ year: 2025, value: 5 }, { year: 2019, value: 1 }, { year: 2020, value: 2 }, { year: 2021, value: null }, { year: '2022', value: '3' }, { year: 2023, value: 4 }, { year: 2024, value: 'x' }, null, { year: 2018, value: 0 }]);
  assert.deepStrictEqual(a.map((x) => x.year), [2018, 2019, 2020, 2022, 2023, 2025].slice(-5));
  assert.strictEqual(D.ryad(undefined).length, 0);
});

test('динамика: только показатели с рядом от 3 лет; налог на прибыль за 2 года не показываем', () => {
  const rs = D.ryady(otvet());
  assert.deepStrictEqual(rs.map((x) => x.k), ['revenue', 'profit']);
  assert.strictEqual(rs[0].ryad.length, 5, 'выручка — последние 5 лет');
  assert.strictEqual(D.htmlDinamika(otvet({ dossier: { charts: { revenue: [{ year: 2024, value: 1 }, { year: 2025, value: 2 }] } } })), '');
  assert.strictEqual(D.htmlDinamika({}), '');
});

test('строки: изменение к прошлому году, за период, переход убыток → прибыль', () => {
  const [v, p] = D.ryady(otvet()).map(D.stroka);
  assert.strictEqual(v.znachTekst, '5,8' + NB + 'трлн' + NB + '₽');
  assert.strictEqual(v.kGodu, '−7' + NB + '% к' + NB + '2024');
  assert.strictEqual(v.ton, 'vniz');
  assert.strictEqual(v.zaPeriod, '−8' + NB + '% с' + NB + '2021', 'с первого года в окне 5 лет (6389 → 5846)');
  assert.strictEqual(p.kGodu, 'в 2024' + NB + '— убыток');
  assert.strictEqual(p.ton, 'vverh');
  assert.strictEqual(p.zaPeriod, '', 'убыток 2024 уже назван — без повтора');
  const p2 = D.stroka({ k: 'profit', nazv: 'Чистая прибыль', znak: true, ryad: [{ year: 2022, value: -5 }, { year: 2023, value: 3 }, { year: 2024, value: 4 }] });
  assert.strictEqual(p2.zaPeriod, 'убыток в' + NB + '2022');
});

test('выводы: из чисел ряда, не больше двух, без оценочных слов', () => {
  const t = D.trendy(otvet());
  assert.deepStrictEqual(t, ['Выручка росла год к году 2 раза из' + NB + '4 — с' + NB + '2021 по' + NB + '2025.', 'Убыток — в' + NB + '1 из' + NB + '5 лет отчётности.']);
  const rost = D.trendy(otvet({ dossier: { charts: { revenue: [1, 2, 3].map((v, i) => ({ year: 2023 + i, value: v })) } } }));
  assert.deepStrictEqual(rost, ['Выручка росла каждый год с' + NB + '2023 по' + NB + '2025.']);
});

test('html динамики: заголовок с годами, источник с датой, стрелки, экранирование', () => {
  const h = D.htmlDinamika(otvet());
  assert.match(h, /Динамика за 2021–2025/);
  assert.match(h, /Источник: ГИР БО ФНС, годовая бухгалтерская отчётность; последний год — 2025 \(на 31\.12\.2025\)/);
  assert.match(h, /▼ −7/);
  assert.ok(!/NaN|undefined|Infinity/.test(h));
});

test('снимок: без ФИО и адреса; у ИП — без руководителя и финансов', () => {
  const s = D.snimok(otvet());
  const json = JSON.stringify(s);
  assert.ok(!/Иванов|Москва/.test(json), 'нет персональных данных и адреса');
  assert.strictEqual(s.dir, '2007-04-12');
  assert.deepStrictEqual(s.vyr, [2025, 5846e9]);
  const ip = D.snimok(otvet({ company: { inn: '500100732259', kind: 'INDIVIDUAL', status: 'ACTIVE', director_name: 'Петров П. П.', director_since: '2020-01-01' } }));
  assert.ok(!('dir' in ip) && !('vyr' in ip) && !/Петров/.test(JSON.stringify(ip)));
  assert.strictEqual(D.snimok(otvet({ company: { inn: '0000000000' } })), null, 'пример на главной не запоминаем');
  assert.strictEqual(D.snimok(otvet({ checked_at: 'вчера' })), null);
});

test('сравнение: хуже — первыми; смена руководителя, долг, новый год отчётности', () => {
  const a = D.snimok(otvet({ checked_at: '2026-09-12T10:00:00Z', dossier: { charts: { revenue: [{ year: 2024, value: 6257e9 }] } } }));
  const b = D.snimok(otvet({
    risk_level: 'medium', company: Object.assign(otvet().company, { director_since: '2026-09-20', invalid: true }),
    signals: [{ id: 'status', title: 'Статус', status: 'ok' }, { id: 'tax_debt', title: 'Задолженность по налогам', status: 'bad' }, { id: 'fssp', title: 'ФССП', status: 'warn' }],
  }));
  const izm = D.sravnit(a, b).map((x) => x.ton + ': ' + x.t);
  assert.deepStrictEqual(izm, [
    'huzhe: Оценка риска: низкий → средний',
    'huzhe: Появилась отметка о недостоверности сведений в ЕГРЮЛ',
    'huzhe: Задолженность по налогам: норма → риск',
    'huzhe: ФССП: внимание',
    'info: Руководитель сменился: новая запись в ЕГРЮЛ с 20.09.2026',
    'info: Появилась отчётность за 2025: выручка 5,8 трлн ₽, прибыль 11,3 млрд ₽',
  ]);
  assert.deepStrictEqual(D.sravnit(D.snimok(otvet()), D.snimok(otvet())), []);
  assert.deepStrictEqual(D.sravnit(a, D.snimok(otvet({ company: { inn: '7707083893', status: 'ACTIVE' } }))), [], 'разные компании не сравниваем');
});

test('хранилище: первая проверка → «запомнили»; повтор в течение часа — не новый снимок; через неделю — изменения', () => {
  const ls = hran();
  const r1 = otvet({ checked_at: '2026-09-25T10:00:00Z' });
  assert.deepStrictEqual(D.zapomnit(r1, ls), { pervyj: true });
  assert.deepStrictEqual(D.zapomnit(otvet({ checked_at: '2026-09-25T10:20:00Z' }), ls), { pervyj: true });
  assert.strictEqual(JSON.parse(ls.st[D.KEY])['7736050003'].length, 1, 'повтор в течение часа не копит снимки');
  const r2 = otvet({ checked_at: '2026-10-02T10:00:00Z', risk_level: 'high' });
  const rez = D.zapomnit(r2, ls);
  assert.strictEqual(rez.izm[0].t, 'Оценка риска: низкий → высокий');
  const h = D.htmlIzmeneniya(rez);
  assert.match(h, /Что изменилось с вашей проверки 25 сентября/);
  assert.match(h, /хранится только в вашем браузере/);
  for (let i = 0; i < 6; i++) D.zapomnit(otvet({ checked_at: '2026-10-0' + (3 + i) + 'T10:00:00Z' }), ls);
  assert.strictEqual(JSON.parse(ls.st[D.KEY])['7736050003'].length, 4, 'не больше 4 снимков на компанию');
});

test('хранилище: сломано или недоступно — блока «что изменилось» нет, динамика есть', () => {
  const plohoe = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.strictEqual(D.zapomnit(otvet(), plohoe), null);
  assert.strictEqual(D.zapomnit(otvet(), { getItem: () => '[1,2]', setItem() { throw new Error('full'); } }), null);
  const h = D.html(otvet(), { ls: plohoe });
  assert.ok(!/class="izm/.test(h));
  assert.match(h, /Динамика за/);
  const musor = hran(); musor.st[D.KEY] = '{"7736050003":[{"t":"x"},null,5]}';
  assert.deepStrictEqual(D.zapomnit(otvet(), musor), { pervyj: true });
});

test('без изменений — честная строка; тексты модуля без запрещённых слов', () => {
  const h = D.htmlIzmeneniya({ s: { t: Date.parse('2026-09-12T10:00:00Z') }, izm: [] });
  assert.match(h, /С вашей проверки 12 сентября существенных изменений нет/);
  const src = fs.readFileSync(path.join(KOREN, 'js/dinamika.js'), 'utf8');
  assert.ok(!/надёжн|надежн|гарант|лучш|однодневк|искусственн|нейросет|(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)/i.test(src.replace(/^\s*\/\*[\s\S]*?\*\//m, '')));
});

test('страницы: модуль подключён на главной и в досье, вызов при отрисовке', () => {
  const ind = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  const rep = fs.readFileSync(path.join(KOREN, 'report.html'), 'utf8');
  assert.match(ind, /<script src="\/js\/dinamika\.js" defer><\/script>/);
  assert.match(ind, /window\.Dinamika\?Dinamika\.html\(r\):''/);
  assert.match(rep, /<script src="\/js\/dinamika\.js"><\/script>/);
  assert.match(rep, /if\(window\.Dinamika\)h\+=Dinamika\.html\(R\);/);
});

test('Условия сделки: вывод API с точкой не даёт «..» (найдено на живом ответе 02.10)', () => {
  // с vyvod-chisto-v1 — через Usloviya.bezPovtora (ещё и без повтора самого вывода)
  const U = require('../js/usloviya.js');
  assert.strictEqual(U.bezPovtora('Вывод: Есть вопросы к адресу.', 'Работать можно'), 'Есть вопросы к адресу');
  assert.strictEqual(U.bezPovtora('Признаков не найдено..', ''), 'Признаков не найдено');
});

// dinamika-v2 (макет [Арт-директора] 02.10, блок E): таблица со спарклайном
test('таблица динамики: колонки «прошлый год · последний год · Изм.», спарклайн 96 × 20 без точек', () => {
  const h = D.htmlDinamika(otvet());
  assert.match(h, /<table class="din__t">/);
  assert.match(h, /<th scope="col" class="din__v din__p n">2024<\/th><th scope="col" class="din__v n">2025<\/th>/);
  assert.match(h, /<svg class="din__sv" viewBox="0 0 96 20" width="96" height="20" aria-hidden="true"/);
  assert.ok(!/<circle|<rect/.test(h), 'без точек и столбиков');
  assert.strictEqual((h.match(/<polyline /g) || []).length, 2, 'выручка и прибыль');
  assert.match(h, /din__0/, 'у прибыли с убытком — нулевая черта');
  assert.match(h, new RegExp('▲' + NB + 'из убытка'), 'прибыль 2025 после убытка 2024');
  assert.match(h, new RegExp('убыток 1,1' + NB + 'трлн'));
  assert.ok(!/NaN|undefined|Infinity/.test(h));
});

test('таблица динамики: численность и уплаченные налоги из наборов ФНС — только при рядах от 3 лет', () => {
  const ch = otvet().dossier.charts;
  const r = otvet({ dossier: { charts: Object.assign({}, ch, {
    staff: [{ year: 2023, value: 1200 }, { year: 2024, value: 1310 }, { year: 2025, value: 1290 }],
    taxes_paid: [{ year: 2024, value: 5e9 }, { year: 2025, value: 6e9 }],
  }) } });
  const h = D.htmlDinamika(r);
  assert.match(h, /Численность/);
  assert.match(h, new RegExp('1' + NB + '290' + NB + 'чел\\.'));
  assert.ok(!/Уплачено налогов/.test(h), 'два года налогов — не динамика');
  assert.match(h, /ГИР БО и наборы ФНС/);
  assert.match(h, /Численность и уплаченные налоги — открытые наборы ФНС/);
  assert.ok(!/ГИР БО и наборы ФНС/.test(D.htmlDinamika(otvet())), 'без рядов ФНС — только ГИР БО');
});

test('таблица динамики: года нет в ряду — «нет данных» и «—», а не ноль', () => {
  const r = otvet({ dossier: { charts: {
    revenue: [{ year: 2021, value: 10e6 }, { year: 2022, value: 12e6 }, { year: 2023, value: 13e6 }, { year: 2025, value: 15e6 }],
  } } });
  const h = D.htmlDinamika(r);
  assert.match(h, /<td class="din__v din__p n"><span class="din__na">нет данных<\/span><\/td>/);
  assert.match(h, /<td class="din__v din__k n">—<\/td>/);
});

// kapital-izm-v1 (Ночные-3, 03.10): собственный капитал (dossier.charts.balance, строка 1300) — в снимке и в «что изменилось»
function sKap(t, god, eq) {
  const ch = Object.assign({}, otvet().dossier.charts, { balance: { year: god, equity: eq, long_liab: 1, short_liab: 2 } });
  return D.snimok(otvet({ checked_at: t, dossier: { charts: ch } }));
}

test('капитал: в снимке — год и сумма; у ИП и без баланса — нет; мусор не берём', () => {
  assert.deepStrictEqual(sKap('2026-10-02T03:30:00Z', 2025, -12.4e6).kap, [2025, -12.4e6]);
  assert.ok(!('kap' in D.snimok(otvet())), 'нет balance — нет капитала');
  for (const eq of [null, '', true, 'x']) assert.ok(!('kap' in sKap('2026-10-02T03:30:00Z', 2025, eq)), 'equity = ' + eq);
  const ip = D.snimok(otvet({ company: { inn: '500100732259', kind: 'INDIVIDUAL', status: 'ACTIVE' },
    dossier: { charts: { balance: { year: 2025, equity: -5 } } } }));
  assert.ok(!('kap' in ip));
});

test('капитал: ушёл в минус — «хуже» первым; вышел из минуса — «лучше»; без смены знака и со старым снимком — молчим', () => {
  const plus = sKap('2026-09-12T10:00:00Z', 2024, 3e6), minus = sKap('2026-10-02T03:30:00Z', 2025, -12.4e6);
  const v = D.sravnit(plus, minus);
  assert.strictEqual(v[0].ton, 'huzhe');
  assert.strictEqual(v[0].t, 'Собственный капитал ушёл в минус: на' + NB + '31.12.2025 — минус 12,4' + NB + 'млн' + NB + '₽, обязательства больше активов (ГИР' + NB + 'БО)');
  const l = D.sravnit(sKap('2026-09-12T10:00:00Z', 2024, -1e6), sKap('2026-10-02T03:30:00Z', 2025, 0));
  assert.deepStrictEqual(l.filter((x) => /капитал/.test(x.t)), [{ ton: 'luchshe', t: 'Собственный капитал больше не отрицательный: на' + NB + '31.12.2025 — 0' + NB + '₽ (ГИР' + NB + 'БО)' }]);
  assert.deepStrictEqual(D.sravnit(sKap('2026-09-12T10:00:00Z', 2025, -1e6), sKap('2026-10-02T03:30:00Z', 2025, -2e6)).filter((x) => /капитал/.test(x.t)), [], 'минус → минус');
  assert.deepStrictEqual(D.sravnit(D.snimok(otvet({ checked_at: '2026-09-12T10:00:00Z' })), minus).filter((x) => /капитал/.test(x.t)), [], 'старый снимок без капитала');
  assert.deepStrictEqual(D.sravnit(sKap('2026-09-12T10:00:00Z', 2025, -1e6), sKap('2026-10-02T03:30:00Z', 2024, 5e6)).filter((x) => /капитал/.test(x.t)), [], 'баланс старше прошлого — не сравниваем');
});

test('капитал: строка проходит в html «что изменилось» с экранированием и без NaN', () => {
  const ls = hran();
  D.zapomnit(otvet({ checked_at: '2026-09-12T10:00:00Z', dossier: { charts: Object.assign({}, otvet().dossier.charts, { balance: { year: 2024, equity: 1e6 } }) } }), ls);
  const r = otvet({ checked_at: '2026-10-02T03:30:00Z', dossier: { charts: Object.assign({}, otvet().dossier.charts, { balance: { year: 2025, equity: -7e5 } }) } });
  const rez = D.zapomnit(r, ls);
  const h = D.htmlIzmeneniya(rez);
  assert.match(h, /<li class="izm--huzhe">Собственный капитал ушёл в минус/);
  assert.match(h, new RegExp('минус 700' + NB + 'тыс\\.' + NB + '₽'));
  assert.ok(!/NaN|undefined|Infinity/.test(h));
});
