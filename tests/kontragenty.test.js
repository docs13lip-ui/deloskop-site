// Тесты движка «Кому вы платите». Запуск: node tests/kontragenty.test.js
'use strict';
const assert = require('assert');
const E = require('../kontragenty-iz-vypiski/engine.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ✓ ' + name); }

/* --- помощники: ИНН с верной контрольной цифрой и кодировка 1251 --- */
function inn10(p9) { const w = [2,4,10,3,5,9,4,6,8]; const d = p9.split('').map(Number); return p9 + ((w.reduce((a,x,i)=>a+x*d[i],0)%11)%10); }
function inn12(p10) {
  let d = p10.split('').map(Number);
  const w1=[7,2,4,10,3,5,9,4,6,8], w2=[3,7,2,4,10,3,5,9,4,6,8];
  d.push((w1.reduce((a,x,i)=>a+x*d[i],0)%11)%10);
  d.push((w2.reduce((a,x,i)=>a+x*d[i],0)%11)%10);
  return d.join('');
}
function cp1251(str) {
  const out = [];
  for (const ch of str) {
    const c = ch.codePointAt(0);
    if (c < 128) out.push(c);
    else if (c >= 0x410 && c <= 0x44F) out.push(c - 0x410 + 0xC0);
    else out.push({ 'Ё':0xA8,'ё':0xB8,'№':0xB9,'«':0xAB,'»':0xBB }[ch] || 0x3F);
  }
  return Uint8Array.from(out);
}

const SELF = inn10('770000001'), SELF_ACC = '40702810900000000001';
const A = inn10('500100001'), B = inn10('500100002'), C = inn12('5001000003');
const BAD = '7700000000'; // контрольная цифра неверная

function doc(o) {
  return ['СекцияДокумент=Платежное поручение',
    'Номер=' + (o.n || 1), 'Дата=' + o.date, 'Сумма=' + o.sum,
    'ПлательщикСчет=' + (o.pa || SELF_ACC), 'ПлательщикИНН=' + (o.pi || SELF), 'Плательщик1=ООО «Мы»',
    'ПолучательСчет=' + o.ra, 'ПолучательИНН=' + (o.ri || ''), 'Получатель1=' + (o.rn || ''),
    o.kbk ? 'ПоказательКБК=' + o.kbk : '',
    'ДатаСписано=' + o.date, 'НазначениеПлатежа=' + o.p, 'КонецДокумента'].filter(Boolean).join('\r\n');
}
function file(docs) {
  return ['1CClientBankExchange', 'ВерсияФормата=1.02', 'Кодировка=Windows', 'ДатаНачала=01.07.2026', 'ДатаКонца=30.09.2026',
    'РасчСчет=' + SELF_ACC, 'СекцияРасчСчет', 'РасчСчет=' + SELF_ACC, 'НачальныйОстаток=0', 'КонецРасчСчет']
    .concat(docs.map(doc)).concat(['КонецФайла']).join('\r\n');
}
const sample = file([
  { n:1, date:'01.07.2026', sum:'1220000.00', ra:'40702810100000000011', ri:A, rn:'ООО «Альфа»', p:'Оплата за поставку бетона по договору № 5. В т.ч. НДС 22% - 220000.00' },
  { n:2, date:'15.08.2026', sum:'610000.00', ra:'40702810100000000011', ri:A, rn:'ООО «Альфа»', p:'Оплата за поставку бетона по счёту 17, в том числе НДС 22 %' },
  { n:3, date:'05.07.2026', sum:'500000.00', ra:'40702810100000000022', ri:B, rn:'ООО «Бета»', p:'Оплата по счету № 44 от 01.07.2026. Без НДС' },
  { n:4, date:'06.07.2026', sum:'100000.00', ra:'40802810100000000033', ri:C, rn:'ИП Сидоров', p:'Оплата за ремонт оборудования. НДС не облагается' },
  { n:5, date:'07.07.2026', sum:'50000.00', ra:'40702810100000000044', ri:BAD, rn:'ООО «Призрак»', p:'Оплата по договору' },
  { n:6, date:'10.07.2026', sum:'30000.00', ra:'03100643000000017300', ri:'7727406020', rn:'Казначейство России (ФНС России)', kbk:'18201061201010000510', p:'Единый налоговый платеж' },
  { n:7, date:'11.07.2026', sum:'80000.00', ra:'40817810100000000055', ri:'', rn:'Иванов Иван', p:'Заработная плата за июнь 2026' },
  { n:8, date:'12.07.2026', sum:'2000.00', ra:'70601810000000000001', ri:'7707083893', rn:'ПАО Банк', p:'Комиссия банка за ведение счета' },
  { n:9, date:'13.07.2026', sum:'150000.00', ra:'40702810900000000999', ri:SELF, rn:'ООО «Мы»', p:'Перевод собственных средств' },
  { n:10, date:'14.07.2026', sum:'900000.00', pa:'40702810100000000011', pi:A, ra:SELF_ACC, ri:SELF, rn:'ООО «Мы»', p:'Оплата по договору' }
]);

console.log('Движок «Кому вы платите»');

test('ИНН: контрольные цифры', () => {
  assert.ok(E.innOk(A) && E.innOk(C) && E.innOk('7707083893'));
  assert.ok(!E.innOk(BAD) && !E.innOk('123') && !E.innOk(''));
});

test('кодировка: Windows-1251, DOS и UTF-8 с BOM', () => {
  assert.strictEqual(E.decode(cp1251('1CClientBankExchange\r\nПолучатель1=ООО «Ёж»')).split('\r\n')[1], 'Получатель1=ООО «Ёж»');
  const bom = Uint8Array.from([0xEF,0xBB,0xBF, ...Buffer.from('1CClientBankExchange\nСекцияДокумент=x')]);
  assert.ok(E.decode(bom).startsWith('1CClientBankExchange'));
  // cp866: «Кодировка=DOS», буква «А» = 0x80
  const head = Buffer.from('1CClientBankExchange\r\n');
  const kod = Uint8Array.from([0x8A,0xAE,0xA4,0xA8,0xE0,0xAE,0xA2,0xAA,0xA0]); // «Кодировка» в cp866
  const tail = Buffer.from('=DOS\r\n');
  const arr = Uint8Array.from([...head, ...kod, ...tail, 0x80]);
  assert.ok(E.decode(arr).endsWith('А'));
});

test('разбор: документы, секция счёта, многострочное назначение', () => {
  const p = E.parse(file([{ n:1, date:'01.07.2026', sum:'10.00', ra:'1', ri:A, p:'а' }]).replace('НазначениеПлатежа=а', 'НазначениеПлатежа1=за доставку\r\nНазначениеПлатежа2=бетона'));
  assert.strictEqual(p.docs.length, 1);
  assert.strictEqual(p.accounts[0].РасчСчет, SELF_ACC);
  assert.strictEqual(p.docs[0].НазначениеПлатежа, 'за доставку бетона');
  assert.ok(!E.parse('просто текст').ok);
});

test('кто мы: счёт и ИНН без секции счёта', () => {
  const noSect = sample.replace(/СекцияРасчСчет[\s\S]*?КонецРасчСчет/, '').replace('РасчСчет=' + SELF_ACC + '\r\n', '');
  const s = E.detectSelf(E.parse(noSect));
  assert.deepStrictEqual(s.accounts, [SELF_ACC]);
  assert.strictEqual(s.inn, SELF);
});

test('НДС из назначения: сумма, ставка, без НДС, не указан', () => {
  assert.deepStrictEqual(E.vatOf(1220000, 'В т.ч. НДС 22% - 220000.00'), { kind:'stated', amount:220000, rate:22 });
  assert.strictEqual(E.vatOf(610000, 'в том числе НДС 22 %').amount, 110000);
  assert.strictEqual(E.vatOf(122, 'НДС 22%-22-00').amount, 22);
  assert.strictEqual(E.vatOf(1000, 'Без НДС').kind, 'none');
  assert.strictEqual(E.vatOf(1000, 'НДС не облагается').kind, 'none');
  assert.strictEqual(E.vatOf(1070, 'в т.ч. НДС 7% 70,00').amount, 70);
  assert.strictEqual(E.vatOf(1000, 'Оплата по договору').kind, 'unknown');
  assert.strictEqual(E.vatOf(1000, 'в т.ч. НДС').kind, 'mentioned');
});

test('размытое назначение', () => {
  assert.ok(E.vaguePurpose('Оплата по счету № 44 от 01.07.2026. Без НДС'));
  assert.ok(E.vaguePurpose('Оплата по договору'));
  assert.ok(!E.vaguePurpose('Оплата за поставку бетона по договору № 5'));
  assert.ok(!E.vaguePurpose('Аренда офиса за июль'));
});

const r = E.analyze(E.parse(sample), { regime: 'osn' });

test('категории: налоги, зарплата, банк, свои счета, входящие', () => {
  assert.strictEqual(r.self.inn, SELF);
  assert.strictEqual(r.totals.budget, 30000);
  assert.strictEqual(r.totals.salary, 80000);
  assert.strictEqual(r.totals.bank, 2000);
  assert.strictEqual(r.totals.self, 150000);
  assert.strictEqual(r.totals.in, 900000);
  assert.strictEqual(r.totals.supplier, 1220000 + 610000 + 500000 + 100000 + 50000);
});

test('поставщики: группировка, доли, порядок по сумме', () => {
  assert.deepStrictEqual(r.suppliers.map(s => s.inn), [A, B, C, BAD]);
  const a = r.suppliers[0];
  assert.strictEqual(a.count, 2);
  assert.strictEqual(a.vat, 330000);
  assert.strictEqual(a.first, '2026-07-01');
  assert.strictEqual(a.last, '2026-08-15');
  assert.ok(Math.abs(r.suppliers.reduce((x, s) => x + s.share, 0) - 1) < 1e-9);
  assert.strictEqual(r.suppliers[2].kind, 'ip');
});

test('деньги на кону (ОСН): мягкий и жёсткий сценарий', () => {
  const a = r.suppliers[0].stake;
  assert.strictEqual(a.vat, 330000);
  assert.strictEqual(a.tax, 375000);                        // 25% от 1 500 000
  assert.strictEqual(a.soft, 396000);                       // НДС + 20%
  assert.strictEqual(a.hard, 987000);                       // (330 000 + 375 000) × 1,4
});

test('режимы: УСН 6% — налоговой суммы нет, УСН 15% — 15% от расходов', () => {
  const r6 = E.analyze(E.parse(sample), { regime: 'usn6' });
  assert.strictEqual(r6.suppliers[0].stake.hard, 0);
  const r15 = E.analyze(E.parse(sample), { regime: 'usn15' });
  assert.strictEqual(r15.suppliers[0].stake.tax, 274500);  // 15% от 1 830 000
  assert.strictEqual(r15.suppliers[0].stake.vat, 0);
});

test('сигналы: неверный ИНН, ключевой, разовый, размытое назначение, без НДС', () => {
  const codes = inn => r.suppliers.find(s => s.inn === inn).signals.map(x => x.code);
  assert.ok(codes(BAD).includes('inn_invalid'));
  assert.ok(codes(A).includes('key'));
  assert.ok(codes(B).includes('oneshot') && codes(B).includes('vague') && codes(B).includes('novat'));
  assert.ok(!codes(A).includes('vague'));
});

test('три дела на неделю: не больше трёх, первым — неверный ИНН', () => {
  assert.strictEqual(r.todo.length, 3);
  assert.ok(/неверным ИНН/.test(r.todo[0]));
});

test('экспозиция: без реестров считаем только неверный ИНН, с ответом API — высокий риск', () => {
  const e0 = E.exposure(r, null);
  assert.strictEqual(e0.risk.n, 1);
  const risk = {}; risk[B] = 'high'; risk[A] = 'medium';
  const e1 = E.exposure(r, risk);
  assert.strictEqual(e1.risk.n, 2);
  assert.strictEqual(e1.watch.n, 1);
  assert.strictEqual(e1.risk.checked, 2);
});

test('дубли документов из двух файлов не удваивают суммы', () => {
  const p = E.parse(sample);
  const r2 = E.analyze([p, p], { regime: 'osn' });
  assert.strictEqual(r2.totals.supplier, r.totals.supplier);
});

test('поток к физлицам и низкая доля налогов — сигналы для банка', () => {
  const f = file([
    { n:1, date:'01.07.2026', sum:'700000.00', ra:'40817810100000000001', rn:'Петров', p:'Возврат займа' },
    { n:2, date:'02.07.2026', sum:'600000.00', ra:'40702810100000000011', ri:A, rn:'ООО «Альфа»', p:'Оплата за материалы' },
    { n:3, date:'03.07.2026', sum:'1000.00', ra:'03100643000000017300', ri:'7727406020', kbk:'182', p:'ЕНП' }
  ]);
  const x = E.analyze(E.parse(f));
  const codes = x.flows.map(z => z.code);
  assert.ok(codes.includes('persons') && codes.includes('lowtax'));
});

test('формат: проценты слитно по «Ководству», деньги с пробелами', () => {
  assert.strictEqual(E.pct(0.3), '30%');
  assert.strictEqual(E.pct(0.021), '2,1%');
  assert.strictEqual(E.money(1234567.4), '1 234 567');
});

console.log('\nПройдено: ' + passed);
