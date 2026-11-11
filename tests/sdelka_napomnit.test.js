// Досье сделки, шаг 6 — «Перед оплатой проверьте заново — до …» и событие календаря, которое ведёт обратно
// в досье этой сделки (01.11.2026; Master 30.10: факт → действие → подтверждение → повторная проверка).
// Срок тот же, что у отчёта (js/perepoverit.js, 30 дней); прошёл — строки нет (обложка уже просит проверить заново).
// node --test tests/sdelka_napomnit.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const P = require('../js/perepoverit.js');
const S = require('../js/sdelka.js');

const R = { checked_at: '2026-11-01T06:10:00Z', company: { inn: '7814148471', name_short: 'ООО «Лента»' } };
const SEG = Date.UTC(2026, 10, 1, 9, 0);

test('срок и ссылка возврата — в досье этой сделки, с суммой', () => {
  const n = S.napominanie(R, 1250000.4, SEG);
  assert.strictEqual(n['do'], '01.12.2026');
  assert.strictEqual(n.ssylka, 'https://deloskop.ru/pasport/kontragent/?inn=7814148471&summa=1250000&utm_source=ics#sd');
  assert.match(n.zag, /^Перепроверить ООО «Лента» перед оплатой по сделке на 1[\s  ]250[\s  ]000[\s  ]₽$/);
  const t = P.ics(n, SEG);
  assert.match(t.replace(/\r\n /g, ''), /SUMMARY:Перепроверить ООО «Лента» перед оплатой по сделке на 1/);
  assert.match(t.replace(/\r\n /g, ''), /URL:https:\/\/deloskop\.ru\/pasport\/kontragent\/\?inn=7814148471&summa=1250000&utm_source=ics#sd/);
  assert.match(t, /DTSTART;VALUE=DATE:20261130/);
  assert.ok(t.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), 'строки .ics ≤ 75 октетов');
  // без суммы — ссылка без summa, заголовок без «на …»
  const b = S.napominanie(R, null, SEG);
  assert.strictEqual(b.ssylka, 'https://deloskop.ru/pasport/kontragent/?inn=7814148471&utm_source=ics#sd');
  assert.strictEqual(b.zag, 'Перепроверить ООО «Лента» перед оплатой по сделке');
});

test('срок прошёл, нет даты или ИНН — напоминания нет; отчёт по-прежнему ведёт на главную', () => {
  assert.strictEqual(S.napominanie(R, 0, Date.UTC(2026, 11, 1, 9, 0)), null, 'в день срока уже нет');
  assert.ok(S.napominanie(R, 0, Date.UTC(2026, 10, 30, 9, 0)), 'накануне — есть');
  assert.strictEqual(S.napominanie({ company: R.company }, 0, SEG), null);
  assert.strictEqual(S.napominanie({ checked_at: R.checked_at, company: { inn: '123' } }, 0, SEG), null);
  assert.strictEqual(S.napominanie(null, 0, SEG), null);
  const o = P.srok(R);
  assert.strictEqual(o.ssylka, 'https://deloskop.ru/?inn=7814148471&utm_source=ics');
  assert.match(P.ics(o, SEG).replace(/\r\n /g, ''), /SUMMARY:Перепроверить ООО «Лента» перед следующей оплатой/);
  // чужой адрес в ссылку не попадает
  assert.strictEqual(P.srok(R, { ssylka: 'https://evil.example/?x' }).ssylka, 'https://deloskop.ru/?inn=7814148471&utm_source=ics');
});

test('шаг 6: строка и кнопка — только при напоминании; кнопка не печатается; страница подключает perepoverit.js до sdelka.js', () => {
  const n = S.napominanie(R, 500000, SEG);
  const s = S.html({ it: { kod: 'predv', zagolovok: 'Досье не закрыто', tekst: '' }, inn: '7814148471', nazvanie: 'ООО «Лента»', napomnit: n });
  assert.match(s, /Перед оплатой проверьте заново\u00a0— до\u00a0<b>01\.12\.2026<\/b>/);
  const btn = s.match(/<div class="sd-btns noprint">.*?<\/div>/)[0];
  assert.match(btn, /data-sd-act="ics">Напомнить в календаре</);
  const bez = S.html({ it: { kod: 'predv', zagolovok: '', tekst: '' }, inn: '7814148471', nazvanie: 'ООО «Лента»' });
  assert.ok(!/data-sd-act="ics"|data-sd-pp/.test(bez));
  const st = fs.readFileSync(path.join(KOREN, 'pasport/kontragent/index.html'), 'utf8');
  const a = st.indexOf('<script src="/js/perepoverit.js"></script>'), b = st.indexOf('<script src="/js/sdelka.js"></script>');
  assert.ok(a > 0 && a < b, 'perepoverit.js раньше sdelka.js');
  assert.match(st, /napomnit:demo\?null:SDK\.napominanie\(d\.r,d\.summa\)/);
  assert.match(st, /a==='ics'.*Perepoverit\.skachat\(document,n\)/);
});
