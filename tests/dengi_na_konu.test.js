// dengi-na-konu-v1 (12.11.2026): «Деньги на кону», шаг 1 — подписи, пороги и запреты по [Право] 12.11 п. 3.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const D = require('../js/dengi-na-konu.js');
const SEG = new Date('2026-11-12T12:00:00+03:00');
const NB = ' ';

// форма поля dengi — как в живом ответе /api/check 12.11 (числа условные)
function otvet(o) {
  o = o || {};
  const sost = [
    { vid: 'iski_otvetchik', summa: o.iski != null ? o.iski : 300e6, chislo: 149, ohvat: 'vse', istochnik: 'Картотека', data_svedeniy: '2026-11-12T20:08+03:00' },
    { vid: 'fssp_ostatok', summa: o.fssp != null ? o.fssp : 1.6e6, chislo: 497, ohvat: 'pervye_100_iz_497', istochnik: 'ФССП', data_svedeniy: '2026-11-12T20:08+03:00' },
    { vid: 'nedoimka', summa: o.ned != null ? o.ned : 0, istochnik: 'ФНС', data_nabora: '2026-10-01' }
  ].filter((x) => !(o.bez || []).includes(x.vid));
  return {
    company: { inn: o.inn || '7800000000', kind: o.kind || 'LEGAL', name_short: 'ООО «Пример»' },
    dengi: { vyruchka: o.vyr === null ? { summa: null, god: null } : { summa: o.vyr || 80e9, god: o.god || 2025, istochnik: 'ГИР БО' },
      sostavlyayushchie: sost, na_konu: 0, dolya: null, ne_uchteno: o.ne || [], nepolno: true, nepolno_vidy: ['fssp_ostatok'] }
  };
}
const tekst = (h) => h.replace(/<[^>]+>/g, ' ').replace(/[ \t\n]+/g, ' ').replace(/ ([,.:)])/g, '$1');

test('меньше 10 %: подпись без строки действия, источники «— через Checko, на дату»', () => {
  const o = D.raschet(otvet(), SEG);
  assert.strictEqual(o.porog, 'malaya');
  assert.strictEqual(o.dejstvie, '');
  const t = tekst(D.html(o));
  assert.ok(t.includes('меньше 10' + NB + '% годовой выручки'));
  assert.ok(t.includes('Иски к компании без итогового решения'));
  assert.ok(t.includes('Остаток долга по открытым исполнительным производствам'));
  assert.ok(t.includes('Недоимка и задолженность по пеням и штрафам'));
  assert.ok(t.includes('Картотека арбитражных дел — через Checko, на 12.11.2026'));
  assert.ok(t.includes('ФССП, банк данных исполнительных производств — через Checko, на 12.11.2026'));
  assert.ok(t.includes('ФНС, открытые данные, на 01.10.2026'));
  assert.ok(t.includes('497 производств · в сумме — первые 100, по всем она может быть больше'));
  assert.ok(t.includes('выручка за 2025' + NB + 'год по бухгалтерской отчётности (ГИР' + NB + 'БО)'));
  assert.ok(!/Что сделать/.test(t));
});

test('10–50 %: «N % годовой выручки» и действие частями', () => {
  const o = D.raschet(otvet({ iski: 23e6, fssp: 0, vyr: 100e6 }), SEG);
  assert.strictEqual(o.porog, 'srednyaya');
  assert.strictEqual(o.podpis, '23' + NB + '% годовой выручки');
  assert.ok(tekst(D.html(o)).includes('Что сделать: Предоплату — частями, под отгрузку; проверьте снова перед следующим платежом.'));
});

test('больше 50 % и больше 100 %: словами, без «340 %»', () => {
  const a = D.raschet(otvet({ iski: 60e6, fssp: 0, vyr: 100e6 }), SEG);
  assert.strictEqual(a.podpis, 'больше половины годовой выручки');
  const b = D.raschet(otvet({ iski: 340e6, fssp: 0, vyr: 100e6 }), SEG);
  assert.strictEqual(b.podpis, 'больше годовой выручки');
  const t = tekst(D.html(b));
  assert.ok(!/\d{3}\s?%/.test(t));
  assert.ok(t.includes('Без предоплаты или с обеспечением: оплата по факту, аккредитив, банковская гарантия'));
});

test('нет выручки, выручка 0 или отчёт старше 2 лет — процента нет', () => {
  for (const o of [{ vyr: null }, { vyr: 0.0001, god: 2025, iski: 5 }, { god: 2023 }]) {
    const r = otvet(o); if (o.vyr === 0.0001) r.dengi.vyruchka.summa = 0;
    const x = D.raschet(r, SEG);
    assert.strictEqual(x.porog, 'bez_vyruchki');
    assert.strictEqual(x.dolya, null);
    const t = tekst(D.html(x));
    assert.ok(t.includes('Сравнить не с чем: нет свежей отчётности'));
    assert.ok(!/%/.test(t.replace(/Доля/g, '')));
  }
  assert.strictEqual(D.raschet(otvet({ god: 2024 }), SEG).porog, 'malaya');
});

test('сумм нет — «не нашли на дату»; не ответивший источник — «не проверено», не ноль', () => {
  const o = D.raschet(otvet({ iski: 0, fssp: 0, ned: 0 }), SEG);
  assert.strictEqual(o.porog, 'net');
  assert.ok(tekst(D.html(o)).includes('Исков, долгов у приставов и недоимки на 12.11.2026 не нашли'));
  const p = D.raschet(otvet({ iski: 0, ned: 0, fssp: 0, bez: ['iski_otvetchik'] }), SEG);
  assert.ok(tekst(D.html(p)).includes('(иски — не проверено)'));
  const q = D.raschet(otvet({ ne: ['fssp_ostatok'] }), SEG);
  assert.deepStrictEqual(q.stroki.map((x) => x.vid), ['iski_otvetchik', 'nedoimka']);
  assert.ok(tekst(D.html(q)).includes('Не проверено: производства у приставов — источник не ответил, в сумму не вошло.'));
});

test('ИП, нет поля dengi, ни один источник не ответил — блока нет', () => {
  assert.strictEqual(D.raschet(otvet({ kind: 'INDIVIDUAL' }), SEG), null);
  assert.strictEqual(D.raschet(otvet({ inn: '780000000000' }), SEG), null);
  assert.strictEqual(D.raschet({ company: { inn: '7800000000' } }, SEG), null);
  assert.strictEqual(D.raschet(otvet({ bez: ['iski_otvetchik', 'fssp_ostatok', 'nedoimka'] }), SEG), null);
  assert.strictEqual(D.html(null), '');
});

test('обязательная оговорка — в каждом варианте; запрещённых слов [Право] п. 3 нет', () => {
  const ZAPRET = [/неплат[её]жеспособн/i, /на грани банкротства/i, /высокий риск/i, /опасн/i, /не платите/i, /долги\b/i,
    /потеряете/i, /\bвернут\b/i, /не вернут/i, /вероятност/i];
  const vse = [otvet(), otvet({ iski: 23e6, vyr: 100e6 }), otvet({ iski: 340e6, vyr: 100e6 }), otvet({ vyr: null }),
    otvet({ iski: 0, fssp: 0 }), otvet({ ne: ['nedoimka'] })];
  for (const r of vse) {
    const h = D.html(D.raschet(r, SEG)), t = tekst(h);
    assert.ok(t.includes(D.OGOVORKA), 'оговорка');
    for (const z of ZAPRET) assert.ok(!z.test(t), 'запрещено: ' + z + ' в ' + t);
  }
  // и в самом исходнике — ни одной запрещённой формулировки в строках (кроме комментария о запрете)
  const src = fs.readFileSync(path.join(KOREN, 'js', 'dengi-na-konu.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  for (const z of ZAPRET) assert.ok(!z.test(src), 'в исходнике: ' + z);
});

test('суммы — по-русски, с неразрывными пробелами', () => {
  assert.strictEqual(D.rub(24542188319.38), '24,5' + NB + 'млрд' + NB + '₽');
  assert.strictEqual(D.rub(4239775.13), '4,2' + NB + 'млн' + NB + '₽');
  assert.strictEqual(D.rub(856300), '856' + NB + '300' + NB + '₽');
  assert.strictEqual(D.rub(0), '0' + NB + '₽');
});

test('где стоит: экран проверки (не «своя компания»), /report.html, пакет «otchet»; на карточках и Паспорте — нет', () => {
  const ind = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  assert.match(ind, /if\(!svoj&&window\.DengiNaKonu\)\{try\{DengiNaKonu\.mount\(report,r\)\}catch\(e\)\{\}\}/);
  assert.ok(ind.indexOf('Otchet.razlozhit(report') < ind.indexOf('DengiNaKonu.mount(report'), 'после раскладки листа — в .ot-main');
  const rep = fs.readFileSync(path.join(KOREN, 'report.html'), 'utf8');
  assert.ok(rep.includes('<script src="/js/dengi-na-konu.js"></script>'));
  assert.match(rep, /DengiNaKonu\.mount\(doc,r\)/);
  const karta = JSON.parse(fs.readFileSync(path.join(KOREN, 'partials', 'sborka.json'), 'utf8'));
  assert.ok(karta.pakety.otchet.includes('js/dengi-na-konu.js'));
  const pas = fs.readFileSync(path.join(KOREN, 'pasport', 'kontragent', 'index.html'), 'utf8');
  assert.ok(!pas.includes('DengiNaKonu'));
  const co = path.join(KOREN, 'company');
  if (fs.existsSync(co)) {
    const odna = fs.readdirSync(co).find((x) => fs.existsSync(path.join(co, x, 'index.html')));
    if (odna) assert.ok(!fs.readFileSync(path.join(co, odna, 'index.html'), 'utf8').includes('DengiNaKonu'));
  }
});
