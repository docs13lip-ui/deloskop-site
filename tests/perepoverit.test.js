// «Перепроверить до…» + напоминание в календаре (js/perepoverit.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../js/perepoverit.js');
const KOREN = path.join(__dirname, '..');

const R = { checked_at: '2026-10-23T05:10:00Z', company: { inn: '7814148471', name_short: 'ООО «Лента»' } };

test('срок: проверка + 30 дней, напоминание — за день, по московскому дню', () => {
  const s = P.srok(R);
  assert.strictEqual(s.proveren, '23.10.2026');
  assert.strictEqual(s['do'], '22.11.2026');
  assert.strictEqual(s.napomnit, '20261121');
  assert.strictEqual(s.konec, '20261122');
  assert.strictEqual(s.ssylka, 'https://deloskop.ru/?inn=7814148471&utm_source=ics');
  // 22:30 UTC 23.10 — по Москве уже 24.10
  assert.strictEqual(P.srok({ checked_at: '2026-10-23T22:30:00Z', company: R.company }).proveren, '24.10.2026');
  // только дата — как в ответе; переход через год
  assert.strictEqual(P.srok({ checked_at: '2026-12-15', company: R.company })['do'], '14.01.2027');
});

test('без ИНН, без даты, без компании — строки нет', () => {
  assert.strictEqual(P.srok(null), null);
  assert.strictEqual(P.srok({ checked_at: '2026-10-23' }), null);
  assert.strictEqual(P.srok({ checked_at: 'вчера', company: R.company }), null);
  assert.strictEqual(P.srok({ checked_at: '2026-10-23', company: { inn: '12345' } }), null);
  assert.strictEqual(P.html(null), '');
});

test('ics по RFC 5545: CRLF, строки ≤ 75 октетов, экранирование, событие на весь день', () => {
  const s = P.srok({ checked_at: '2026-10-23', company: { inn: '7707083893', name_short: 'ПАО Сбербанк; «Сбер», банк' } });
  const t = P.ics(s, Date.UTC(2026, 9, 23, 5, 0, 0));
  assert.ok(t.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(t.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(t), 'все переводы строк — CRLF');
  for (const line of t.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, line);
  const raz = t.replace(/\r\n /g, ''); // развернуть продолжения
  assert.ok(raz.includes('DTSTART;VALUE=DATE:20261121\r\nDTEND;VALUE=DATE:20261122'));
  assert.ok(raz.includes('DTSTAMP:20261023T050000Z'));
  assert.ok(raz.includes('UID:perepoverit-7707083893-20261122@deloskop.ru'));
  assert.ok(raz.includes('SUMMARY:Перепроверить ПАО Сбербанк\\; «Сбер»\\, банк перед следующей оплатой'));
  assert.ok(raz.includes('URL:https://deloskop.ru/?inn=7707083893&utm_source=ics'));
  assert.ok(/DESCRIPTION:Проверка в Делоскопе от 23\.10\.2026\. Перепроверить до 22\.11\.2026[^\r]*\\nhttps:\/\/deloskop\.ru\/\?inn=7707083893&utm_source=ics/.test(raz));
  assert.strictEqual((raz.match(/BEGIN:VEVENT/g) || []).length, 1);
});

test('свёртка не режет символ UTF-8 и эмодзи', () => {
  const dl = 'X:' + 'ж'.repeat(100) + '😀' + 'я'.repeat(50);
  const f = P.slozhit(dl);
  for (const line of f.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  assert.strictEqual(f.replace(/\r\n /g, ''), dl);
  assert.ok(!f.includes('�'));
});

test('в файле нет ничего, кроме названия, ИНН и ссылки (без данных отчёта)', () => {
  const r = Object.assign({}, R, { signals: [{ title: 'Недоимка', detail: '1 000 ₽' }], report_id: 'A1', zsk: { level: 'high' } });
  const t = P.ics(P.srok(r), 0);
  assert.ok(!t.includes('Недоимка') && !t.includes('A1'));
});

test('строка на странице: дата, кнопка 44 px, неразрывные пробелы, без цен', () => {
  const h = P.html(P.srok(R));
  assert.ok(h.includes('Перепроверить до <b>22.11.2026</b>'));
  assert.ok(h.includes('data-act="ics"'));
  assert.ok(h.includes('Напомнить в календаре'));
  assert.ok(!/₽/.test(h));
  assert.ok(/\.pp__b\{min-height:44px/.test(P.CSS));
});

test('главная: модуль в пакете отчёта после реквизитов, вызов — после RekvizityProverki.mount и не для своей компании', () => {
  const sb = JSON.parse(fs.readFileSync(path.join(KOREN, 'partials/sborka.json'), 'utf8'));
  const o = sb.pakety.otchet;
  assert.ok(o.indexOf('js/perepoverit.js') === o.indexOf('js/rekvizity-proverki.js') + 1);
  const s = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  const i = s.indexOf('RekvizityProverki.mount(report,r,{polucheno:new Date()})');
  const j = s.indexOf('if(!svoj&&window.Perepoverit){try{Perepoverit.mount(report,r)}catch(e){}}');
  assert.ok(i > 0 && j > i);
});

test('клетка реквизитов: «Перепроверить до» с датой, «через 30 дней», кнопка календаря', () => {
  const k = P.kletka(P.srok(R));
  assert.ok(k.startsWith('<div class="rkv__pp" data-pp><dt'));
  assert.ok(k.includes('>Перепроверить до</dt><dd>22.11.2026<small>через 30 дней после проверки</small>'));
  assert.ok(k.includes('data-act="ics"'));
  assert.strictEqual(P.kletka(null), '');
  // цель касания у кнопки-ссылки тоже 44 px
  assert.ok(/\.rkv__pp \.pp__b\{[^}]*min-height:44px/.test(P.CSS));
});
