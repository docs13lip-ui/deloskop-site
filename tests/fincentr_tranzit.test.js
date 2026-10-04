// Финцентр-лайт, спайк за флагом `fincentr`: правило «пришло — ушло», доли по всем счетам, вывод и лист.
// Запуск: node --test tests/fincentr_tranzit.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../kontragenty-iz-vypiski/engine.js');
const F = require('../kontragenty-iz-vypiski/fincentr.js');

function inn10(p9) { const w = [2,4,10,3,5,9,4,6,8]; const d = p9.split('').map(Number); return p9 + ((w.reduce((a,x,i)=>a+x*d[i],0)%11)%10); }
const SELF = inn10('770000001');
const ACC_A = '40702810900000000001', ACC_B = '40702810500000000002';
const KLIENT = inn10('500100009'), POST = inn10('500100001');

let n = 0;
function doc(o) {
  n++;
  return ['СекцияДокумент=Платежное поручение', 'Номер=' + n, 'Дата=' + o.date, 'Сумма=' + o.sum,
    'ПлательщикСчет=' + o.pa, 'ПлательщикИНН=' + o.pi, 'Плательщик1=' + (o.pn || 'ООО «Плательщик»'),
    o.pbank ? 'ПлательщикБанк1=' + o.pbank : '',
    'ПолучательСчет=' + o.ra, 'ПолучательИНН=' + (o.ri || ''), 'Получатель1=' + (o.rn || ''),
    o.rbank ? 'ПолучательБанк1=' + o.rbank : '', o.kbk ? 'ПоказательКБК=' + o.kbk : '',
    o.out ? 'ДатаСписано=' + o.date : 'ДатаПоступило=' + o.date,
    'НазначениеПлатежа=' + o.p, 'КонецДокумента'].filter(Boolean).join('\r\n');
}
function vypiska(acc, docs) {
  return E.parse(['1CClientBankExchange', 'ВерсияФормата=1.03', 'РасчСчет=' + acc,
    'СекцияРасчСчет', 'РасчСчет=' + acc, 'КонецРасчСчет'].concat(docs).join('\r\n'));
}
function data(day) { const d = new Date(Date.UTC(2026, 8, 1) + day * 864e5); return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear(); }
const vyruchka = (acc, day, sum, bank) => doc({ date: data(day), sum, pa: '40702810100000000099', pi: KLIENT, pn: 'ООО «Покупатель»', ra: acc, ri: SELF, rn: 'ООО «Мы»', rbank: bank, p: 'Оплата по договору поставки, НДС 22%' });
const sebe = (from, to, day, sum, fb, tb) => doc({ date: data(day), sum, pa: from, pi: SELF, pbank: fb, ra: to, ri: SELF, rn: 'ООО «Мы»', rbank: tb, out: true, p: 'Перевод собственных средств' });
const postavshchiku = (acc, day, sum) => doc({ date: data(day), sum, pa: acc, pi: SELF, ra: '40702810300000000077', ri: POST, rn: 'ООО «Поставщик»', out: true, p: 'Оплата за материалы по договору 5, НДС 22%' });
const nalog = (acc, day, sum) => doc({ date: data(day), sum, pa: acc, pi: SELF, ra: '03100643000000017300', ri: '7727406020', rn: 'Казначейство России (ФНС России)', kbk: '18201061201010000510', out: true, p: 'Единый налоговый платёж' });
const zarplata = (acc, day, sum) => doc({ date: data(day), sum, pa: acc, pi: SELF, ra: '40817810000000000555', ri: '', rn: 'Иванов И. И.', out: true, p: 'Заработная плата за сентябрь' });

test('1. выручка в А, в тот же день себе в Б, из Б поставщику через 10 дней: счёт А — warn, все вместе — ok', () => {
  const a = [], b = [];
  for (let i = 0; i < 4; i++) {
    const day = i * 12;
    a.push(vyruchka(ACC_A, day, 900000, 'АО «АЛЬФА-БАНК» г. Москва'));
    const t = sebe(ACC_A, ACC_B, day, 880000, 'АО «АЛЬФА-БАНК» г. Москва', 'ПАО Бета г. Москва');
    a.push(t); b.push(t);                                  // один документ в двух выписках — дубль
    b.push(postavshchiku(ACC_B, day + 10, 850000));
  }
  const s = F.svodka([vypiska(ACC_A, a), vypiska(ACC_B, b)]);
  const scA = s.scheta.find(x => x.acc === ACC_A), scB = s.scheta.find(x => x.acc === ACC_B);
  assert.strictEqual(s.schetov, 2);
  assert.strictEqual(scA.tranzit.uroven, 'warn');
  assert.ok(scA.tranzit.dolya > 0.95);
  assert.strictEqual(s.tranzit.uroven, 'ok');
  assert.ok(scA.huzhe.tranzit);
  assert.strictEqual(scB.huzhe.tranzit, false);
  assert.strictEqual(s.dengi.self, 3520000, 'перевод себе посчитан один раз, хоть и в двух выписках');
  assert.strictEqual(s.vyvod.kod, 'raznye');
  assert.match(s.vyvod.tekst, /^Банк «АО АЛЬФА-БАНК» по своему счёту видит «пришло — ушло» 98%: выручка сразу уходит на ваш счёт в «ПАО Бета»\. По всем счетам вместе — 0%\.$/);
});

test('2. пришло 1 млн, на следующий день ушло 950 тыс. поставщику, 15 раз: все вместе — warn, доля 0,95', () => {
  const a = [];
  for (let i = 0; i < 15; i++) { a.push(vyruchka(ACC_A, i * 2, 1000000)); a.push(postavshchiku(ACC_A, i * 2 + 1, 950000)); }
  const s = F.svodka([vypiska(ACC_A, a)]);
  assert.strictEqual(s.tranzit.uroven, 'warn');
  assert.ok(Math.abs(s.tranzit.dolya - 0.95) < 1e-9);
  assert.strictEqual(s.vyvod.kod, 'tranzit');
  assert.match(s.vyvod.tekst, /По всем счетам вместе 95% поступлений уходят дальше за 2 дня/);
});

test('3. приход 600 тыс. — «мало данных», без цвета', () => {
  const s = F.svodka([vypiska(ACC_A, [vyruchka(ACC_A, 0, 600000), postavshchiku(ACC_A, 0, 590000), nalog(ACC_A, 40, 1000)])]);
  assert.strictEqual(s.tranzit.uroven, 'malo');
  assert.strictEqual(s.vyvod.kod, 'malo');
  assert.match(F.html(s, null), /мало данных/);
});

test('4. только зарплата и налоги — спокойно, 4 признака из 4', () => {
  const a = [vyruchka(ACC_A, 0, 2000000), zarplata(ACC_A, 1, 900000), nalog(ACC_A, 1, 300000), vyruchka(ACC_A, 30, 500000)];
  const s = F.svodka([vypiska(ACC_A, a)]);
  assert.strictEqual(s.tranzit.uroven, 'ok');
  assert.strictEqual(s.tranzit.bystro, 0);
  assert.strictEqual(s.vyvod.kod, 'spokojno');
  assert.strictEqual(s.vyvod.tekst, 'По 4 признакам из 4 по всем счетам — сигналов нет.');
});

test('5. доли по всем счетам — от «списано без переводов себе»', () => {
  const t = { prishlo: 0, vznos: 0, out: 1000, self: 600, cash: 100, budget: 40 };
  const vse = F.doli(t, true), odin = F.doli(t, false);
  assert.strictEqual(vse.baza, 400);
  assert.strictEqual(vse.nal, 0.25);
  assert.strictEqual(odin.nal, 0.1);
  assert.strictEqual(vse.nalUroven, 'warn');
  assert.strictEqual(odin.nalUroven, 'ok');
});

test('6. LIFO, а не FIFO: хвосты по 5 % не съедают транзит', () => {
  const ev = [];
  for (let i = 0; i < 10; i++) {
    const d = '2026-09-' + String(i * 3 + 1).padStart(2, '0');
    ev.push({ d, acc: 'x', dir: 'in', sum: 1000000, cat: 'ext' }, { d, acc: 'x', dir: 'out', sum: 950000, cat: 'supplier' });
  }
  const r = F.schitat(ev, { ext: 1 }, { supplier: 1 });
  assert.ok(Math.abs(r.dolya - 0.95) < 1e-9);
});

test('7. лист: вывод, 4 блока, одно действие, оговорка; без «18-МР», «0,9» и порогов', () => {
  const a = [];
  for (let i = 0; i < 15; i++) { a.push(vyruchka(ACC_A, i * 2, 1000000, 'ПАО <Банк>')); a.push(postavshchiku(ACC_A, i * 2 + 1, 950000)); }
  const p = [vypiska(ACC_A, a)];
  const res = E.analyze(p);
  const h = F.html(F.svodka(p), res);
  for (const t of ['Деньги', 'Глазами каждого банка', 'Кому вы платите', 'Что сделать']) assert.ok(h.includes('<h3>' + t + '</h3>'), t);
  assert.strictEqual((h.match(/class="fc-akt"/g) || []).length, 1);
  assert.ok(h.includes('Ориентиры Делоскопа, а не решение банка.'));
  assert.ok(h.includes('ПАО &lt;Банк&gt;'), 'название банка экранировано');
  assert.doesNotMatch(h, /18-МР|0,9|80%|60%|искусствен|нейросет|гарантир/i);
  assert.doesNotMatch(h, new RegExp(SELF), 'ИНН клиента в листе не выводим');
});

test('8. флаг: в data/fincentr.json vklyuchen = false, без флага лист не показывается', async () => {
  const fl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'fincentr.json'), 'utf8'));
  assert.strictEqual(fl.vklyuchen, false);
  const html = fs.readFileSync(path.join(__dirname, '..', 'kontragenty-iz-vypiski', 'index.html'), 'utf8');
  assert.ok(html.includes('<script src="/kontragenty-iz-vypiski/fincentr.js"></script>'));
  assert.ok(html.indexOf('fincentr.js') > html.indexOf('engine.js'), 'после движка');
  assert.match(html, /DeloFincentr\.pokazat\(out,state\.parsed,r\)/);
  const staryj = global.fetch;
  let zvali = 0;
  global.fetch = () => { zvali++; return Promise.resolve({ ok: true, json: () => Promise.resolve({ vklyuchen: false }) }); };
  try {
    const out = { querySelector() { throw new Error('не должен трогать DOM'); } };
    const pokazal = await F.pokazat(out, [vypiska(ACC_A, [vyruchka(ACC_A, 0, 2000000)])], null);
    assert.strictEqual(pokazal, false);
    assert.strictEqual(zvali, 1);
  } finally { global.fetch = staryj; }
});
