// «Что проверено» в досье (Ф5, Ночные 30.09): опись собирается из ответа, «не проверяли» ≠ «не нашли».
// node --test tests/chto_provereno.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'chto-provereno.js'));
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const E = require(path.join(ROOT, 'pasport', 'engine.js'));
const demo = () => Object.assign(JSON.parse(JSON.stringify(E.DEMO)), { checked_at: '2026-09-30T03:10:00+03:00', damia: {} });
const nazv = (a) => a.map((x) => x.nazv);

test('полный ответ: всё ожидаемое — «получено» с источником и датой; внешние реестры — «не проверяли»', () => {
  const o = C.sobrat(demo(), { razdely: P.RAZDELY });
  // в образце нет строки о спецрежиме, а «дисквалифицированные — нет» пришло без даты и не из реестра ФНС (Ф7) —
  // значит, честно «не проверяли», остальное получено
  C.OZHIDAEM.filter((p) => p.id !== 'rezhim' && p.id !== 'diskval').forEach((p) => assert.ok(o.polucheno.some((x) => x.id === p.id), 'нет в «получено»: ' + p.id));
  const dolgi = o.polucheno.find((x) => x.id === 'dolgi');
  assert.strictEqual(dolgi.ist, 'ФНС, открытые данные');
  assert.strictEqual(dolgi.data, '01.09.2026');
  assert.ok(o.polucheno.some((x) => x.nazv === 'Массовый адрес'), 'строка светофора сверх ожидаемых потерялась');
  assert.deepStrictEqual(o.ne_proveryali.map((x) => x.id), ['rezhim', 'diskval', 'sudy', 'scheta', 'pristavy', 'goszakaz', 'stoplisty']);
  assert.strictEqual(o.na, '30.09.2026');
});

test('источник не ответил — пункт уходит в «не проверяли», а не молча в «проверено»', () => {
  const r = demo();
  r.signals = r.signals.filter((s) => !/Долги|Дисквалиф/.test(s.title));
  const o = C.sobrat(r, { razdely: P.RAZDELY });
  assert.ok(nazv(o.ne_proveryali).includes('Задолженность по налогам'));
  assert.ok(nazv(o.ne_proveryali).includes('Реестр дисквалифицированных лиц'));
  assert.ok(!o.polucheno.some((x) => x.id === 'dolgi' || x.id === 'diskval'));
});

test('Ф7 дисквалификация: «нет» без даты или из DaData — не проверка; отметка источника или реестр ФНС — получено', () => {
  const s1 = (sig) => { const r = demo(); r.signals = r.signals.filter((s) => !/Дисквалиф/.test(s.title)).concat([Object.assign({ title: 'Дисквалифицированные руководители', detail: 'нет' }, sig)]); return C.sobrat(r, { razdely: P.RAZDELY }); };
  const ne = (o) => o.ne_proveryali.find((x) => x.id === 'diskval');
  const est = (o) => o.polucheno.find((x) => x.id === 'diskval');
  let o = s1({ status: 'ok', source: 'DaData', as_of: '2026-09-29' });
  assert.ok(ne(o) && !est(o), 'пустое поле DaData попало в «получено»');
  assert.deepStrictEqual(ne(o).sam.map((a) => a.url), ['https://service.nalog.ru/disqualified.do']);
  assert.ok(!o.polucheno.some((x) => /Дисквалиф/.test(x.nazv)), 'строка не должна вернуться «сверх ожидаемых»');
  o = s1({ status: 'bad', source: 'ЕГРЮЛ', as_of: '' });
  assert.ok(ne(o), 'без даты сведений — не проверка');
  o = s1({ status: 'bad', source: 'ЕГРЮЛ', as_of: '2026-09-29' });
  assert.strictEqual(est(o).data, '29.09.2026');
  o = s1({ status: 'ok', source: 'ФНС, реестр дисквалифицированных лиц', as_of: '2026-09-27' });
  assert.strictEqual(est(o).data, '27.09.2026');
});

test('пустой ответ сервера: «получено» только ЕГРЮЛ, остальное — «не проверяли»', () => {
  const r = { checked_at: '2026-09-30', company: { inn: '7707083893', status: 'ACTIVE', name_short: 'ООО «Пример»' }, signals: [] };
  const o = C.sobrat(r, { razdely: P.RAZDELY });
  assert.deepStrictEqual(o.polucheno.map((x) => x.id), ['egrul']);
  assert.strictEqual(o.ne_proveryali.length, C.OZHIDAEM.length - 1 + 5);
});

test('отчётность без строки светофора, но с цифрами досье — получена из ГИР БО', () => {
  const r = demo();
  r.signals = r.signals.filter((s) => !/отч[её]тност/i.test(s.title));
  r.dossier = { kpi: [{ label: 'Выручка', value: 1 }] };
  const x = C.sobrat(r).polucheno.find((p) => p.id === 'otchetnost');
  assert.strictEqual(x.ist, 'ГИР БО');
});

test('внешний реестр ответил (found / not_found) — «получено»; not_checked — нет', () => {
  const r = demo();
  r.damia = { fssp: { status: 'not_found', istochnik: 'ФССП', data_svedeniy: '2026-09-29' }, sudy: { status: 'not_checked' } };
  const o = C.sobrat(r, { razdely: P.RAZDELY });
  assert.ok(o.polucheno.some((x) => x.id === 'pristavy' && x.data === '29.09.2026'));
  assert.ok(o.ne_proveryali.some((x) => x.id === 'sudy'));
});

test('запасной список внешних реестров совпадает с разделами Паспорта (один источник правды)', () => {
  const vn = (a) => a.filter((x) => x.sam.length);
  const iz = vn(C.sobrat(demo(), { razdely: P.RAZDELY }).ne_proveryali);
  const bez = vn(C.sobrat(demo()).ne_proveryali);
  assert.deepStrictEqual(bez.map((x) => x.id), iz.map((x) => x.id));
  bez.forEach((x, i) => assert.deepStrictEqual(x.sam.map((a) => a.url), iz[i].sam.map((a) => a.url), x.id));
  iz.forEach((x) => x.sam.forEach((a) => assert.match(a.url, /^https:\/\/(kad\.arbitr\.ru|bankrot\.fedresurs\.ru|service\.nalog\.ru|pb\.nalog\.ru|bo\.nalog\.ru|egrul\.nalog\.ru|fssp\.gov\.ru|zakupki\.gov\.ru|cbr\.ru|www\.cbr\.ru|www\.fedsfm\.ru)\//)));
});

test('ИП: ЕГРИП вместо ЕГРЮЛ', () => {
  const r = { checked_at: '2026-09-30', company: { inn: '500100732259', kind: 'INDIVIDUAL', status: 'ACTIVE', name_full: 'ИП' }, signals: [] };
  assert.strictEqual(C.sobrat(r).polucheno[0].ist, 'ЕГРИП');
});

test('HTML: экранирование, «Проверьте сами» со ссылками, счётчики', () => {
  const r = demo();
  r.signals.push({ title: '<img src=x onerror=alert(1)>', status: 'info', source: 'ФНС' });
  const h = C.html(C.sobrat(r, { razdely: P.RAZDELY }));
  assert.ok(!h.includes('<img'));
  assert.match(h, /Получено при проверке 30\.09\.2026 — \d+/);
  assert.match(h, /Не проверяли — 7/);
  assert.match(h, /Это не значит, что там ничего нет/);
  assert.match(h, /Проверьте сами: <a href="https:\/\/kad\.arbitr\.ru\/"/);
});

test('report.html: постоянного списка «проверено» больше нет, опись — из ChtoProvereno; без «подтверждает осмотрительность»', () => {
  const s = fs.readFileSync(path.join(ROOT, 'report.html'), 'utf8');
  assert.ok(!s.includes('реестр дисквалифицированных лиц — по открытым данным ФНС России'));
  assert.ok(s.includes('ChtoProvereno.html(ChtoProvereno.sobrat(r,'));
  assert.ok(s.indexOf('/js/pasport-kontragenta.js') < s.indexOf('/js/chto-provereno.js') && s.indexOf('/js/chto-provereno.js') < s.indexOf('function render('));
  assert.ok(!/Досье подтверждает|проявление должной осмотрительности/.test(s));
  assert.ok(s.includes('может стать частью доказательств должной осмотрительности'));
});

test('15:05: у каждого пункта «не проверяли» в досье есть дорога к первоисточнику', () => {
  const r = { checked_at: '2026-09-30', company: { inn: '7707083893', status: 'ACTIVE', name_short: 'ООО «Пример»' }, signals: [] };
  [C.sobrat(r, { razdely: P.RAZDELY }), C.sobrat(demo(), { razdely: P.RAZDELY }), C.sobrat(r)].forEach((o) =>
    o.ne_proveryali.forEach((x) => assert.ok(x.sam && x.sam.length, 'без «проверьте сами»: ' + x.id)));
});

test('15:05: стоп-листы — красная группа ЗСК только самопроверкой; строка светофора с датой снимает «не проверяли»', () => {
  const o = C.sobrat(demo(), { razdely: P.RAZDELY });
  const st = o.ne_proveryali.find((x) => x.id === 'stoplisty');
  assert.ok(st.sam.some((a) => a.url === 'https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/'));
  assert.ok(st.sam.some((a) => a.url === 'https://www.cbr.ru/inside/warning-list/'));
  const r = demo();
  r.signals.push({ title: 'Список Банка России: признаки нелегальной деятельности', detail: 'не значится', status: 'ok', source: 'Банк России', as_of: '2026-09-29' });
  const o2 = C.sobrat(r, { razdely: P.RAZDELY });
  assert.ok(!o2.ne_proveryali.some((x) => x.id === 'stoplisty'));
  assert.ok(o2.polucheno.some((x) => /Банка России/.test(x.nazv) && x.data === '29.09.2026'));
  const r3 = demo();
  r3.signals.push({ title: 'Перечень Росфинмониторинга', detail: 'нет', status: 'ok', source: 'Росфинмониторинг' });
  assert.ok(C.sobrat(r3, { razdely: P.RAZDELY }).ne_proveryali.some((x) => x.id === 'stoplisty'), 'без даты — не проверка');
});
