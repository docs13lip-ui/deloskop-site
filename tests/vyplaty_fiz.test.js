// vyplaty-fiz-v1 (11.11.2026): «Выплаты физлицам» в «Кому вы платите» — движок и тексты.
// Правила — [Право] 11.11 (в): 40802 (ИП) и 10-значный ИНН — не сюда; исключения по назначению;
// «до ≈ 52%» = (13 + 30) × 1,2; рамка дословно; законопроект № 1191451-8. Запуск: node --test tests/vyplaty_fiz.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../kontragenty-iz-vypiski/engine.js');

function inn10(p9) { const w = [2,4,10,3,5,9,4,6,8]; const d = p9.split('').map(Number); return p9 + ((w.reduce((a,x,i)=>a+x*d[i],0)%11)%10); }
function inn12(p10) {
  const d = p10.split('').map(Number); const w1=[7,2,4,10,3,5,9,4,6,8], w2=[3,7,2,4,10,3,5,9,4,6,8];
  d.push((w1.reduce((a,x,i)=>a+x*d[i],0)%11)%10); d.push((w2.reduce((a,x,i)=>a+x*d[i],0)%11)%10); return d.join('');
}
const SELF = inn10('770000001'), ACC = '40702810900000000001';
const ANNA = inn12('5001000071'), IP = inn12('5001000088'), ORG = inn10('500100009');
let n = 0;
function doc(date, sum, ra, ri, rn, p) {
  n++;
  return ['СекцияДокумент=Платежное поручение', 'Номер=' + n, 'Дата=' + date, 'Сумма=' + sum, 'ПлательщикСчет=' + ACC, 'ПлательщикИНН=' + SELF,
    'ПолучательСчет=' + ra, 'ПолучательИНН=' + (ri || ''), 'Получатель1=' + rn, 'ДатаСписано=' + date, 'НазначениеПлатежа=' + p, 'КонецДокумента'].join('\n');
}
function razbor(docs) { return E.analyze(E.parse(['1CClientBankExchange', 'РасчСчет=' + ACC].concat(docs, ['КонецФайла']).join('\n'))); }
const POST = doc('05.07.2026', '500000.00', '40702810100000000011', ORG, 'ООО «Поставщик»', 'Оплата за материалы по договору 1');

test('гражданин с ИНН на 40817: три месяца — «регулярно», на кону до ≈ 52%', () => {
  const r = razbor([POST,
    doc('10.07.2026', '50000.00', '40817810100000000001', ANNA, 'Примерова Анна', 'Оплата по договору оказания услуг № 3'),
    doc('10.08.2026', '50000.00', '40817810100000000001', ANNA, 'Примерова Анна', 'Оплата по договору оказания услуг № 3'),
    doc('10.09.2026', '50000.00', '40817810100000000001', ANNA, 'Примерова Анна', 'Оплата по договору оказания услуг № 3'),
    doc('11.09.2026', '30000.00', '40820810100000000002', '', 'Образцов Илья', 'Оплата по договору подряда № 5')]);
  assert.strictEqual(r.fiz.lyudi.length, 2);
  const a = r.fiz.lyudi[0];
  assert.strictEqual(a.inn, ANNA); assert.strictEqual(a.sum, 150000); assert.strictEqual(a.mesyacev, 3); assert.ok(a.regulyarno);
  assert.strictEqual(r.fiz.lyudi[1].inn, null); assert.strictEqual(r.fiz.lyudi[1].regulyarno, false);
  assert.strictEqual(E.fizStavka(), 0.516);
  const it = E.fizItog(r.fiz);
  assert.deepStrictEqual([it.n, it.reg, it.sum, it.naKonu], [2, 1, 180000, Math.round(180000 * 0.516)]);
  assert.ok(r.todo.some(t => /статус самозанятого/.test(t)) || r.todo.length === 3);
});

test('ИП на 40802 и организация с 10-значным ИНН — не в «Выплатах физлицам»', () => {
  const r = razbor([POST,
    doc('10.07.2026', '90000.00', '40802810100000000003', IP, 'ИП Примеров', 'Оплата за ремонт'),
    doc('11.07.2026', '70000.00', '40817810100000000004', ORG, 'ООО «Лично»', 'Оплата по счёту 5')]);
  assert.strictEqual(r.fiz.lyudi.length, 0);
  assert.ok(r.suppliers.some(s => s.inn === IP));
});

test('выплаты не за работу не считаем: зарплата, подотчёт, займ, аренда, дивиденды, алименты, возврат, НДФЛ удержан', () => {
  const p = ['Заработная плата за июль', 'Перечисление под отчёт на хознужды', 'Выдача займа по договору 2', 'Арендная плата за склад',
    'Дивиденды за 2025 год', 'Алименты по исполнительному листу', 'Возврат денежных средств покупателю', 'Вознаграждение по договору ГПХ, НДФЛ удержан',
    'Командировочные расходы', 'Материальная помощь'];
  const r = razbor([POST].concat(p.map((x, i) => doc('1' + i + '.07.2026', '10000.00', '40817810100000000005', '', 'Человек ' + i, x))));
  assert.strictEqual(r.fiz.lyudi.length, 0);
  assert.strictEqual(r.fiz.iskl.count, p.length);
  assert.strictEqual(r.fiz.iskl.sum, 100000);
});

test('окно — 12 месяцев до последней даты выписки', () => {
  const r = razbor([POST,
    doc('01.07.2025', '40000.00', '40817810100000000001', ANNA, 'Примерова Анна', 'Оплата услуг'),
    doc('02.07.2025', '40000.00', '40817810100000000001', ANNA, 'Примерова Анна', 'Оплата услуг'),
    doc('15.09.2026', '40000.00', '40817810100000000001', ANNA, 'Примерова Анна', 'Оплата услуг')]);
  assert.strictEqual(r.fiz.s, '2025-09-16');
  assert.strictEqual(r.fiz.lyudi[0].sum, 40000);
  assert.strictEqual(r.fiz.lyudi[0].count, 1);
});

test('отметка «сотрудник или учредитель» убирает получателя из итога', () => {
  const r = razbor([POST, doc('10.07.2026', '100000.00', '40817810100000000001', ANNA, 'Примерова Анна', 'Оплата услуг')]);
  const k = r.fiz.lyudi[0].key;
  const it = E.fizItog(r.fiz, { [k]: true });
  assert.deepStrictEqual([it.n, it.sum, it.naKonu, it.bez], [0, 0, 0, 1]);
});

test('ИНН граждан не попадают в список поставщиков, который уходит на проверку по реестрам', () => {
  const r = razbor([POST, doc('10.07.2026', '100000.00', '40817810100000000001', ANNA, 'Примерова Анна', 'Оплата услуг')]);
  assert.ok(!r.suppliers.some(s => s.inn === ANNA));
  assert.ok(r.suppliers.some(s => s.inn === ORG));
});

test('без выплат гражданам — блока нет', () => {
  assert.strictEqual(razbor([POST]).fiz.lyudi.length, 0);
});

test('страница: рамка [Право] дословно, № 1191451-8, флаг, ничего на сервер', () => {
  const h = fs.readFileSync(path.join(__dirname, '..', 'kontragenty-iz-vypiski', 'index.html'), 'utf8').replace(/&nbsp;/g, ' ').replace(/&#8209;/g, '-');
  assert.ok(h.includes('Оценка по ставкам Налогового кодекса 2026 года, если выплаты — оплата работ или услуг. Не прогноз и не вывод о ваших отношениях с получателями. Пени и штрафы по КоАП — сверх этой суммы.'));
  assert.ok(h.includes('№ 1191451-8 (внесён в Госдуму 30 марта 2026 года, не принят)'));
  assert.ok(h.includes('может увидеть ваших получателей'));
  assert.ok(!h.includes('1191986'));
  assert.ok(/var VYPLATY=\{vkl:(true|false)\}/.test(h));
  const ui = h.slice(h.indexOf('function fizHtml'), h.indexOf('function fizPerersovat'));
  assert.ok(ui.length > 500 && !/fetch\(|sendBeacon|localStorage|ym\(/.test(ui));
});
