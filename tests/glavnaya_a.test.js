'use strict';
// glavnaya-a-v1 ([Ночные запуски] 31.10.2026): главная по схеме А — решение владельца 30.10 ~22:55 «а»,
// ТЗ claude/Продукт_ТЗ_главная_схема_А_30.10.md (блоки 1, 3, 4, 5, 7 и приёмка разд. 4).
// Сторож: таблица «Откуда данные» — из data/istochniki.json (подключат источник — тест покраснеет, пока строку не обновят),
// на главной нет обещаний и цен, которые ТЗ снимает (разд. 0), якоря входов с других страниц живы.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const G = fs.readFileSync(path.join(K, 'index.html'), 'utf8');
const R = JSON.parse(fs.readFileSync(path.join(K, 'data/istochniki.json'), 'utf8'));
const MAIN = G.slice(G.indexOf('<main'), G.indexOf('</main>'));
const tekst = (h) => h.replace(/<template[\s\S]*?<\/template>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-').replace(/\s+/g, ' ');
const dmy = (s) => s.split('-').reverse().join('.');
const sekciya = (id) => { const i = G.indexOf('id="' + id + '"'); return G.slice(i, G.indexOf('</section>', i)); };

test('главная А: одна H1 в два уровня, лид по ТЗ', () => {
  assert.strictEqual((G.match(/<h1\b/g) || []).length, 1);
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(G)[1];
  assert.match(tekst(h1).trim(), /^Проверка контрагента по ИНН Проверьте контрагента\. Поймите, что сделать до оплаты\.$/);
  assert.match(tekst(MAIN), /Открытые госреестры — простыми словами: что известно о компании, насколько полна проверка и что запросить до оплаты\./);
});

test('главная А: снятое ТЗ (разд. 0) не возвращается', () => {
  const t = tekst(MAIN);
  for (const [re, pochemu] of [[/можно работать или нет/i, 'Ж1 [Право]'], [/обезопас/i, '38-ФЗ'], [/открытая бета/i, 'бета закрыта 12.10'],
    [/₽ в месяц/, 'цен в публичных текстах нет (0яи)'], [/1 490|4 990/, 'цены тарифов'], [/сверены юристом/i, '[Право] 30.10'],
    [/Работать можно/, 'Ж1'], [/пока не проверяем/, 'отчёт показывает дела на 12.10 — «не обновляем»'],
    [/Источники, которые уже сводим/, 'список заменён таблицей реестра (Master № 3)']]) {
    assert.ok(!re.test(t), pochemu + ': ' + (t.match(re) || [''])[0]);
  }
});

test('главная А: таблица «Откуда данные» = data/istochniki.json (без ЗСК — у неё своя строка)', () => {
  const blok = /<!--istochniki-glavnaya-->([\s\S]*?)<!--\/istochniki-glavnaya-->/.exec(G)[1];
  const stroki = [...blok.matchAll(/<tr data-ist="([a-z_]+)">([\s\S]*?)<\/tr>/g)];
  const ozhid = R.istochniki.filter((x) => x.id !== 'zsk_cbr');
  assert.deepStrictEqual(stroki.map((m) => m[1]), ozhid.map((x) => x.id));
  for (const [, id, html] of stroki) {
    const x = R.istochniki.find((y) => y.id === id);
    const t = tekst(html);
    assert.ok(x.chto_daet && t.includes(x.chto_daet), id + ': «Что даёт» из реестра');
    assert.ok(html.includes('href="' + x.proverit_samim + '"'), id + ': ссылка «Проверить самим»');
    if (x.sostoyanie === 'podklyuchen') {
      assert.match(html, /ist-s--ok/, id);
      if (/^\d{4}-\d\d-\d\d$/.test(x.data_nabora)) assert.ok(t.includes('работает, набор на ' + dmy(x.data_nabora)), id + ': дата набора');
      else assert.ok(t.includes(x.data_nabora), id + ': ' + x.data_nabora);
    } else if (x.sostoyanie === 'zamorozhen') {
      assert.match(html, /ist-s--zam/, id);
      assert.ok(t.includes('не обновляется с ' + dmy(x.zamorozhen_s)), id + ': дата заморозки');
    } else {
      assert.match(html, /ist-s--net/, id);
      assert.ok(t.includes('не подключён'), id);
    }
  }
  const zsk = R.istochniki.find((x) => x.id === 'zsk_cbr');
  assert.ok(sekciya('doverie').includes(zsk.proverit_samim.replace('https://www.', 'https://')), 'ЗСК — ссылка на проверку Банка России');
  assert.match(tekst(sekciya('doverie')), /Мы её не получаем и не подменяем/);
});

test('главная А: «Что вы увидите в отчёте» — 4 вопроса по порядку, даты из реестра', () => {
  const s = sekciya('shield');
  assert.deepStrictEqual([...s.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1].replace(/&nbsp;/g, ' ')),
    ['Что найдено', 'Насколько полна проверка', 'Что это значит', 'Что сделать']);
  const d = tekst(/<p data-chetyre-daty>([\s\S]*?)<\/p>/.exec(s)[1]);
  const fns = R.istochniki.find((x) => x.id === 'fns_open'), gb = R.istochniki.find((x) => x.id === 'girbo');
  assert.ok(d.includes('открытые данные ФНС — на ' + dmy(fns.data_nabora)), 'дата набора ФНС = реестр');
  assert.ok(d.includes('отчётность — ' + gb.data_nabora), 'год отчётности = реестр');
});

test('главная А: «Условия» без цен; кабинет — по коду на почту; якоря входов живы', () => {
  const p = tekst(sekciya('price'));
  assert.ok(!/₽/.test(p));
  assert.match(p, /10 проверок в день — бесплатно, без регистрации\./);
  assert.match(p, /вход по коду на почту, без пароля/);
  for (const id of ['inn', 'vhody', 'shield', 'praktika', 'doverie', 'price', 'faq', 'vitrina']) {
    assert.ok(new RegExp('id="' + id + '"').test(G), 'нет якоря #' + id);
  }
  assert.ok(!/Как оплатить\?/.test(tekst(MAIN)), 'вопрос «Как оплатить?» — только с включением оплат');
});
