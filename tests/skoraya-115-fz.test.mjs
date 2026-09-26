import { readFileSync } from 'node:fs';
// Тесты движка «Скорой 115-ФЗ». Запуск: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../skoraya-115-fz/engine.js');

test('годовые нормы рабочих дней совпадают с производственными календарями', () => {
  for (const [y, norm] of [[2025, 247], [2026, 247], [2027, 247]]) {
    let n = 0;
    for (let t = Date.UTC(y, 0, 1); new Date(t).getUTCFullYear() === y; t += 86400000) if (S.isWorkday(t)) n++;
    assert.equal(n, norm, `год ${y}`);
  }
});

test('праздники и рабочие субботы', () => {
  assert.equal(S.isWorkday('2026-01-09'), false);
  assert.equal(S.isWorkday('2026-01-12'), true);
  assert.equal(S.isWorkday('2026-11-04'), false);
  assert.equal(S.isWorkday('2026-12-31'), false);
  assert.equal(S.isWorkday('2027-02-20'), true, 'рабочая суббота 2027');
  assert.equal(S.isWorkday('2027-02-22'), false);
  assert.equal(S.isWorkday('2025-11-01'), true, 'рабочая суббота 2025');
});

test('рабочие дни считаются со следующего дня и перепрыгивают праздники', () => {
  assert.equal(S.addWorkdays('2026-09-25', 5), '2026-10-02');
  assert.equal(S.addWorkdays('2026-10-30', 7), '2026-11-11', '4 ноября не считается');
  assert.equal(S.addWorkdays('2026-12-29', 3), '2027-01-12', 'новогодние каникулы');
  assert.equal(S.workdaysBetween('2026-09-25', '2026-10-02'), 5);
});

test('срок в 6 месяцев: соответствующее число, перенос с выходного, конец месяца', () => {
  assert.equal(S.addMonthsDeadline('2026-03-10', 6), '2026-09-10');
  assert.equal(S.addMonthsDeadline('2026-08-31', 6), '2027-03-01', '28 февраля 2027 — воскресенье → 1 марта');
  assert.equal(S.addMonthsDeadline('2026-05-07', 6), '2026-11-09', '7 ноября — суббота → понедельник 9 ноября');
});

test('отказ в операции: 5 дней банку, 7 после подачи, 20 комиссии, 6 месяцев', () => {
  const p = S.buildPlan({ scenario: 'otkaz', today: '2026-09-25', eventDate: '2026-09-24', turnover: 3000000 });
  const by = l => p.steps.find(s => s.label.includes(l));
  assert.equal(by('должен сообщить').date, '2026-10-01');
  assert.equal(by('Подать в банк').date, '2026-09-29');
  assert.equal(by('Банк обязан ответить').date, '2026-10-08');
  assert.equal(by('Последний день').date, '2027-03-24');
  assert.ok(p.money.fast.sum > 1e6 && p.money.slow.sum > p.money.fast.sum);
  assert.equal(p.money.fast.days, 9);
});

test('красная зона: разрешённые операции зависят от формы и зарплаты', () => {
  const ip = S.worksNow('zsk', { form: 'ip', payroll: 450000 });
  assert.ok(ip.items.some(x => x.includes('30' + ' ' + '000')));
  assert.ok(ip.items.some(x => x.includes('450 000')));
  const ooo = S.worksNow('zsk', { form: 'ooo' });
  assert.ok(!ooo.items.some(x => x.includes('на жизнь')));
  const p = S.buildPlan({ scenario: 'zsk', today: '2026-09-25', eventDate: '2026-09-25', zskBank: 'net_mer' });
  assert.ok(p.steps.some(s => s.basis.includes('п. 1.1 ст. 7.8')));
  const p2 = S.buildPlan({ scenario: 'zsk', today: '2026-09-25', eventDate: '2026-09-25', zskBank: 'mery' });
  assert.ok(p2.steps.some(s => s.label.includes('межведомственную')));
});

/* п. 40 очереди: ошибки в нормах (аудит Юриста 115-ФЗ, 26.09.2026) */
test('п. 40: остаток при расторжении — п. 5 ст. 859, не п. 3', () => {
  const src = readFileSync(new URL('../skoraya-115-fz/engine.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /не позднее 7 дней \(п\. 3 ст\. 859/);
  assert.doesNotMatch(src, /установленный п\. 3 ст\. 859/);
  assert.doesNotMatch(src, /остатка на новый счёт', 'п\. 3 ст\. 859/);
  const L = S.buildLetter('rastorzhenie', {});
  assert.match(L, /п\. 5 ст\. 859/);
  assert.doesNotMatch(L, /п\. 3 ст\. 859/);
  const p = S.buildPlan({ scenario: 'rastorzhenie', today: '2026-09-25', eventDate: '2026-09-25' });
  const ost = p.steps.find(s => s.label.includes('перечислении остатка'));
  assert.match(ost.basis, /п\. 5 ст\. 859/);
  assert.ok(p.steps.some(s => s.basis.includes('п. 3 и 6 ст. 859') && s.date === '2026-11-24'));
});

test('п. 40: после уведомления о расторжении зарплата не в «что работает»', () => {
  const w = S.worksNow('rastorzhenie', {});
  assert.ok(!w.items[0].includes('зарплата'));
  assert.match(w.items[0], /бюджет/);
  assert.ok(w.items.some(x => x.includes('другом банке')));
});

test('п. 40: меры ЗСК применены — только комиссия, без пересмотра в ЦБ за 15 дней', () => {
  for (const v of ['mery', undefined, 'cb', 'bank']) {
    const p = S.buildPlan({ scenario: 'zsk', today: '2026-09-25', eventDate: '2026-09-25', zskBank: v });
    assert.ok(!p.steps.some(s => s.basis.includes('п. 1.1 ст. 7.8') || /15 рабочих/.test(s.basis)), String(v));
    assert.ok(p.steps.some(s => s.basis.includes('п. 1 ст. 7.8')));
    assert.equal(p.money, null);
    const L = S.buildLetter('zsk', { zskBank: v });
    assert.match(L, /В межведомственную комиссию/);
  }
  assert.doesNotMatch(S.SCENARIOS.zsk.verdict, /Банк России или/);
  const n = S.buildPlan({ scenario: 'zsk', today: '2026-09-25', eventDate: '2026-09-25', zskBank: 'net_mer', turnover: 3000000 });
  assert.ok(n.steps.some(s => s.basis.includes('только пока меры не применены')));
  assert.equal(n.money.fast.days, 0);
  assert.match(n.info.verdict, /15 рабочих дней/);
  assert.doesNotMatch(S.buildPlan({ scenario: 'zsk', today: '2026-09-25', eventDate: '2026-09-25' }).info.verdict, /15 рабочих/);
  assert.match(S.buildLetter('zsk', { zskBank: 'net_mer' }), /^В Банк России/);
});

test('п. 40: статья ЗСК — п. 6 ст. 7.7 для разрешённых операций, пути развёдены', () => {
  const html = readFileSync(new URL('../115-fz/zsk-zony-riska/index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('пункте 5 статьи 7.7'));
  assert.ok(html.includes('пункте 6 статьи 7.7'));
  assert.ok(html.includes('Банк уже применил меры'));
  assert.ok(html.includes('банк меры ещё не применил'));
  assert.ok(!html.includes('проблемы сразу везде'));
});

test('дата события в будущем не ломает план', () => {
  const p = S.buildPlan({ scenario: 'dbo', today: '2026-09-25', eventDate: '2026-12-01' });
  assert.equal(p.eventDate, '2026-09-25');
});

test('даты за пределами календаря помечаются', () => {
  const p = S.buildPlan({ scenario: 'otkaz', today: '2027-11-20', eventDate: '2027-11-20' });
  assert.ok(p.calendarNote.length > 0);
});

test('типографика: неразрывные пробелы, короткие числа без пробела', () => {
  assert.equal(S.rub(1500), '1500 ₽');
  assert.equal(S.rub(1500000), '1 500 000 ₽');
  assert.equal(S.rubShort(2140000), '2,1 млн ₽');
  assert.equal(S.human('2026-10-02', true), '2 октября, пт');
});

test('письмо: подставляет поля и приложения, без полей — понятные заглушки', () => {
  const L = S.buildLetter('otkaz', { bank: 'АО «Банк»', company: 'ООО «Леон»', inn: '7700000000', opSum: 120000, opCounterparty: 'ООО «Ромашка»', opDate: '2026-09-24' }, ['Договор поставки', 'УПД']);
  assert.match(L, /п\. 13\.4 ст\. 7/);
  assert.match(L, /120 000 ₽/);
  assert.match(L, /Приложения:\n1\. Договор поставки\.\n2\. УПД\./);
  const E = S.buildLetter('zsk', {});
  assert.match(E, /\[ИНН\]/);
  assert.match(E, /В межведомственную комиссию при Банке России/);
});

test('выписка 1С: дубли, свой счёт, наличные, топ-3', () => {
  const doc = (n, sum, from, to, fromInn, toInn, name, purpose) =>
    `СекцияДокумент=Платежное поручение\nНомер=${n}\nДата=10.09.2026\nСумма=${sum}\nПлательщикСчет=${from}\nПлательщикИНН=${fromInn}\nПлательщик1=${from === OWN ? 'ООО Леон' : name}\nПолучательСчет=${to}\nПолучательИНН=${toInn}\nПолучатель1=${to === OWN ? 'ООО Леон' : name}\nДатаСписано=10.09.2026\nНазначениеПлатежа=${purpose}\nКонецДокумента`;
  const OWN = '40702810000000000001';
  const txt = ['1CClientBankExchange', 'ВерсияФормата=1.03', `РасчСчет=${OWN}`,
    doc(1, '100000.00', OWN, '40702810000000000002', '7700000000', '7711111111', 'ООО Альфа', 'Оплата по договору'),
    doc(1, '100000.00', OWN, '40702810000000000002', '7700000000', '7711111111', 'ООО Альфа', 'Оплата по договору'),
    doc(2, '50000,00', OWN, '40702810000000000003', '7700000000', '7722222222', 'ООО Бета', 'Оплата'),
    doc(3, '30000.00', OWN, '40702810000000000004', '7700000000', '', 'Касса', 'Выдача наличных по денежному чеку'),
    doc(4, '250000.00', '40702810000000000005', OWN, '7733333333', '7700000000', 'ООО Гамма', 'Оплата за товар'),
    'КонецФайла'].join('\r\n');
  const r = S.parseStatement(txt);
  assert.equal(r.ok, true);
  assert.equal(r.docs, 4, 'дубль отброшен');
  assert.equal(r.totalOut, 180000);
  assert.equal(r.totalIn, 250000);
  assert.equal(r.cash, 30000);
  assert.equal(r.topOut[0].name, 'ООО Альфа');
  assert.equal(r.topIn[0].inn, '7733333333');
  assert.equal(S.parseStatement('просто текст').ok, false);
});

test('декодирование выписки в 1251', () => {
  const txt = '1CClientBankExchange\r\nСекцияДокумент=Платежное поручение\r\nКонецДокумента';
  // кодируем вручную в windows-1251 (кириллица А-я → 0xC0-0xFF)
  const bytes = [];
  for (const ch of txt) {
    const c = ch.charCodeAt(0);
    if (c < 128) bytes.push(c); else if (c >= 0x410 && c <= 0x44F) bytes.push(c - 0x410 + 0xC0); else bytes.push(63);
  }
  assert.ok(S.decodeBytes(new Uint8Array(bytes)).includes('СекцияДокумент'));
});

test('шаги плана идут по возрастанию дат, шаги без даты — в конце', () => {
  for (const sc of Object.keys(S.SCENARIOS)) {
    for (const zskBank of ['mery', 'net_mer']) {
      const p = S.buildPlan({ scenario: sc, today: '2026-09-25', eventDate: '2026-09-21', zskBank });
      const ds = p.steps.map(s => s.date);
      const firstNull = ds.indexOf(null);
      if (firstNull >= 0) assert.ok(ds.slice(firstNull).every(d => d === null), sc);
      const dated = ds.filter(Boolean);
      assert.deepEqual(dated, [...dated].sort(), `${sc}/${zskBank}`);
    }
  }
});
