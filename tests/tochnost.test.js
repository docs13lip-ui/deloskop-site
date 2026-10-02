// /tochnost/ — «Точность Индекса: как мы проверяем себя» (п. 215 «Очереди»).
// Текст: claude/Продукт_ЗСК_контрагента_по_ИНН_п167_и_tochnost_01.10.md, разд. 2; правки [Право] 02.10 11:15
// (claude/Право_ответы_✎_Паспорт_ЗСК_tochnost_партнёры_02.10.md, разд. 4): уровни — по 222-ФЗ, «Будем публиковать».
// Числа правил и названия уровней сверяются с indeks/metodika-v1.json — поменяли методику, страница покраснеет.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const T = chitat('tochnost/index.html');
const M = JSON.parse(chitat('indeks/metodika-v1.json'));
const tekst = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

test('мета: title, description «будем публиковать», canonical, в sitemap', () => {
  assert.match(T, /<title>Точность Индекса Делоскопа: как мы проверяем себя — Делоскоп<\/title>/);
  assert.match(T, /content="[^"]*Будем публиковать и удачи, и промахи/);
  assert.ok(!/Публикуем и удачи/.test(T), 'пока отчёта нет — только «будем публиковать» ([Право] 11:15)');
  assert.match(T, /<link rel="canonical" href="https:\/\/deloskop\.ru\/tochnost\/">/);
  assert.match(chitat('sitemap.xml'), /<loc>https:\/\/deloskop\.ru\/tochnost\/<\/loc>/);
});

test('уровни — как в методике, без «Надёжная» и «Опасно»', () => {
  const t = tekst(T);
  for (const u of M.urovni) {
    assert.ok(t.includes(u.nazvanie), 'нет уровня ' + u.nazvanie);
    assert.ok(t.includes(`${u.ot}–${u.do}`), 'нет баллов ' + u.ot + '–' + u.do);
  }
  assert.ok(!/Надёжн|Опасно|Высокий риск/.test(t));
});

test('правила «шанса» = методика: AUC 0,75, 20%, 200 событий', () => {
  assert.match(M.samoobuchenie.kriterij_procentov, /AUC не ниже 0,75/);
  assert.match(M.samoobuchenie.kriterij_procentov, /больше чем на 20%/);
  assert.strictEqual(M.samoobuchenie.min_plohih_iskhodov, 200);
  assert.match(T, /data-auc>0,75</);
  assert.match(T, /data-rashozhdenie>20%</);
  assert.match(T, /data-sobytij>200</);
  assert.strictEqual(M.samoobuchenie.gorizont_dney, 365);
});

test('события: три из методики + РНП только «после подключения реестра»', () => {
  const li = T.match(/data-sobytie="[a-z]+"/g) || [];
  assert.strictEqual(li.length, M.samoobuchenie.plohoj_iskhod.length + 1);
  assert.match(T, /data-sobytie="rnp"[\s\S]*?после подключения реестра/);
  for (const ne of M.samoobuchenie.ne_uchityvaem_v_obuchenii) assert.ok(tekst(T).toLowerCase().includes(ne.toLowerCase().split(' ').pop().slice(0, 8)), 'не сказано, что не считаем: ' + ne);
});

test('честность: нет цифр отчёта и вероятностей; 38-ФЗ без сравнений', () => {
  const t = tekst(T);
  assert.ok(!/\d+(,\d+)?\s?%\s+компаний/.test(t), 'цифр отчёта ещё нет');
  assert.ok(!/впервые|единственн|точнее всех|лучш|гарантир|у конкурентов/i.test(t));
  assert.match(t, /ждём выборку/);
  assert.match(t, /не кредитный рейтинг/);
});

test('/indeks/ ведёт на /tochnost/, /tochnost/ — обратно на методику', () => {
  const I = chitat('indeks/index.html');
  assert.ok((I.match(/href="\/tochnost\/"/g) || []).length >= 2, 'обе фразы «отчёт точности» на /indeks/ — ссылками');
  assert.match(I, /<h2 id="uchitsya">Как индекс учится<\/h2>/);
  assert.match(T, /href="\/indeks\/#uchitsya"/);
  assert.match(T, /href="\/indeks\/"/);
});
