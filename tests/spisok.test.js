// «Проверка справочника контрагентов» (spisok-iz-1s-v1, 19.11) — node --test tests/spisok.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const S = require(path.join(ROOT, 'js', 'spisok.js'));

// минимальный xlsx: zip с deflate, как сохраняет Excel и «Сохранить как → Лист Excel 2007»
function zip(fajly) {
  const loc = [], cen = []; let off = 0;
  for (const [imya, txt] of Object.entries(fajly)) {
    const raw = Buffer.from(txt, 'utf8'), d = zlib.deflateRawSync(raw), n = Buffer.from(imya, 'utf8');
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(d.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(d.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    loc.push(h, n, d); cen.push(c, n); off += 30 + n.length + d.length;
  }
  const cd = Buffer.concat(cen), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(cen.length / 2, 8); e.writeUInt16LE(cen.length / 2, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  const b = Buffer.concat([...loc, cd, e]); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

test('контрольная цифра ИНН: 10 и 12 цифр', () => {
  assert.ok(S.innOk('7707083893'));
  assert.ok(S.innOk('2309085638'));
  assert.ok(!S.innOk('7707083894'));
  assert.ok(S.innOk('500100732259'));
  assert.ok(!S.innOk('500100732258'));
  assert.ok(!S.innOk('12345'));
});

test('ИНН из ячейки: «ИНН/КПП», число Excel, пробелы', () => {
  assert.strictEqual(S.innIzYachejki('7707083893/770701001'), '7707083893');
  assert.strictEqual(S.innIzYachejki('7707083893.0'), '7707083893');
  assert.strictEqual(S.innIzYachejki(' 7707 083 893 '), '7707083893');
  assert.strictEqual(S.innIzYachejki('770701001'), null, 'КПП — не ИНН');
});

test('CSV из 1С: заголовок «ИНН», «;», кавычки, 12-значные и повторы', () => {
  const t = 'Наименование;ИНН;КПП\n"ООО ""Ромашка""";7707083893;770701001\nИП Иванов;500100732259;\nПАО «Магнит»;2309085638;230901001\nООО Ромашка (дубль);7707083893;\nОшибка;7707083894;\n';
  const sp = S.izTeksta(t);
  assert.deepStrictEqual(sp.org, [{ inn: '7707083893', imya: 'ООО "Ромашка"' }, { inn: '2309085638', imya: 'ПАО «Магнит»' }]);
  assert.strictEqual(sp.ip, 1, '12-значный не уходит в список');
  assert.strictEqual(sp.povtor, 1);
  assert.strictEqual(sp.neVerno, 1);
});

test('12-значные ИНН не попадают в запрос никогда', () => {
  const sp = S.izTeksta('500100732259\n7707083893\n');
  assert.ok(sp.org.every((x) => x.inn.length === 10));
  assert.strictEqual(sp.ip, 1);
});

test('вставленный столбец ИНН без заголовка', () => {
  const sp = S.izTeksta('7707083893\n2309085638\n\n7736050003');
  assert.deepStrictEqual(sp.org.map((x) => x.inn), ['7707083893', '2309085638', '7736050003']);
});

test('до 200 за раз: 201-я — «сверх 200»', () => {
  const inn = []; for (let i = 1000000; inn.length < 205; i++) { const s = String(770000000 + i).slice(0, 9); for (let k = 0; k < 10; k++) { if (S.innOk(s + k)) { inn.push(s + k); break; } } }
  const sp = S.izTeksta('ИНН\n' + inn.join('\n'));
  assert.strictEqual(sp.org.length, 200);
  assert.strictEqual(sp.lishnie, 5);
});

test('кодировка windows-1251 (старые выгрузки)', () => {
  const b = Buffer.from([0xc8, 0xcd, 0xcd, 0x3b, 0xcd, 0xe0, 0xe8, 0xec, 0x0a]); // «ИНН;Наим»
  assert.strictEqual(S.tekstIzBajtov(b).slice(0, 3), 'ИНН');
  assert.strictEqual(S.tekstIzBajtov(Buffer.from('﻿ИНН', 'utf8')), 'ИНН');
});

test('xlsx: общие строки, число-ИНН, столбец по заголовку', async () => {
  const buf = zip({
    'xl/sharedStrings.xml': '<sst><si><t>Наименование</t></si><si><t>ИНН</t></si><si><r><t>ПАО «</t></r><r><t>Магнит»</t></r></si><si><t>ООО &amp; Ко</t></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>2309085638</v></c></row>' +
      '<row r="3"><c r="A3" t="s"><v>3</v></c><c r="C3" t="inlineStr"><is><t>7707083893</t></is></c></row></sheetData></worksheet>'
  });
  const sp = S.spisok(await S.xlsx(buf));
  assert.deepStrictEqual(sp.org, [{ inn: '2309085638', imya: 'ПАО «Магнит»' }, { inn: '7707083893', imya: 'ООО & Ко' }]);
});

test('факты сервера: смена руководителя — без ФИО, налог меньше 500 ₽ — остаток', () => {
  const r = S.fakt('Руководитель сменился недавно: Иванов Иван Иванович — с 21.05.2026 — ЕГРЮЛ');
  assert.strictEqual(r.t, 'Руководитель сменился недавно: с 21.05.2026 — ЕГРЮЛ');
  assert.ok(!/Иван/.test(r.t));
  const o = S.fakt('Задолженность по налогам: 1 ₽ (недоимка, пени и штрафы) — ФНС, открытые данные на 01.10.2026');
  assert.strictEqual(o.minus, false);
  assert.strictEqual(o.t, 'Остаток: задолженность по\u00a0налогам по\u00a0набору ФНС на\u00a001.10.2026 — 1\u00a0₽');
  assert.strictEqual(S.fakt('Задолженность по налогам: 5 689 ₽ (недоимка, пени и штрафы) — ФНС, открытые данные на 01.10.2026').minus, true);
});

test('итог: порядок — статус, минусы, не проверили, без минусов; ФИО нет нигде', () => {
  const otvet = { stroki: [
    { inn: '7707083893', status: 'dejstvuet', itog: 'net_sushchestvennyh', fakty: [], data_svedeniy: '2026-11-18' },
    { inn: '3904087321', status: 'dejstvuet', itog: 'est_1', fakty: ['Задолженность по налогам: 1 ₽ (недоимка, пени и штрафы) — ФНС, открытые данные на 01.10.2026'], data_svedeniy: '2026-11-18' },
    { inn: '7725216105', status: 'dejstvuet', itog: 'est_1', fakty: ['Руководитель сменился недавно: Петрова Анна Сергеевна — с 21.05.2026 — ЕГРЮЛ'], data_svedeniy: '2026-11-18' },
    { inn: '5001000010', status: null, itog: 'ne_provereno', fakty: [], data_svedeniy: null },
    { inn: '2309085638', status: 'likvidirovana', itog: 'est_1', fakty: [], data_svedeniy: '2026-11-18' },
    { inn: '500100732259', oshibka: 'ne_yul' }
  ] };
  const it = S.itog(otvet, [{ inn: '7725216105', imya: 'ООО «Тест»' }]);
  assert.deepStrictEqual(it.stroki.map((x) => x.gruppa), ['stop', 'minus', 'ne', 'chisto', 'chisto']);
  assert.strictEqual(it.vsego, 5, '12-значный в итог не попадает');
  assert.strictEqual(it.stroki[0].itog, 'Ликвидирована');
  assert.strictEqual(it.stroki[1].imya, 'ООО «Тест»');
  const ekopet = it.stroki.find((x) => x.inn === '3904087321');
  assert.strictEqual(ekopet.gruppa, 'chisto', 'налог 1 ₽ — не минус');
  assert.strictEqual(ekopet.ostatok.length, 1);
  assert.ok(!/Петрова|Анна/.test(JSON.stringify(it)) && !/Петрова/.test(S.csvItoga(it)));
  assert.strictEqual(S.svodka(it), 'Проверили 5\u00a0организаций: у\u00a01 — ликвидация, банкротство или реорганизация, у\u00a01\u00a0есть минусы, 1\u00a0не\u00a0проверили, у\u00a02\u00a0минусов не\u00a0нашли.');
});

test('CSV итога: BOM, «;», ссылка на отчёт', () => {
  const it = S.itog({ stroki: [{ inn: '7707083893', status: 'dejstvuet', fakty: [], data_svedeniy: '2026-11-18' }] }, [{ inn: '7707083893', imya: 'ООО "А; Б"' }]);
  const c = S.csvItoga(it);
  assert.ok(c.startsWith('﻿ИНН;'));
  assert.ok(c.includes('"ООО ""А; Б"""'));
  assert.ok(c.includes('https://deloskop.ru/?inn=7707083893'));
});

test('страница: в меню «Проверка», файл только наш, без внешних адресов, «1С» — не в названии', () => {
  const h = fs.readFileSync(path.join(ROOT, 'proverka-spiska', 'index.html'), 'utf8');
  const shapka = fs.readFileSync(path.join(ROOT, 'partials', 'shapka.html'), 'utf8');
  assert.ok(shapka.includes('href="/proverka-spiska/"'));
  assert.ok(/<script src="\/js\/spisok\.js" defer><\/script>/.test(h));
  assert.ok(!/<script[^>]+src="https?:/.test(h), 'библиотек с чужих адресов нет');
  const t = /<title>([^<]*)<\/title>/.exec(h)[1], h1 = /<h1>([^<]*)<\/h1>/.exec(h)[1];
  assert.ok(!/1С/.test(t) && !/1С/.test(h1), 'название без «1С»');
  assert.ok(h.includes('1С&nbsp;— товарный знак ООО&nbsp;«1С». Делоскоп не&nbsp;связан с&nbsp;фирмой «1С».'));
  assert.ok(h.includes('accept=".xlsx,.csv,.txt'));
});
