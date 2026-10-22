// pravo-2310-v1 ([Ночные запуски] 23.10.2026): ответы [Право] 23.10 00:30 (claude/Право_ответы_✎_23.10_ЗСК_Разбор24_тоны_цены.md)
// разд. 1 — ЗСК по ст. 7.7, 7.8 115-ФЗ (ред. 04.08.2026), разд. 4 — цены без «справочные» (п. 4 ч. 3 ст. 5 38-ФЗ).
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const norm = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-').replace(/\s+/g, ' ');
const vidimoe = (h) => norm(h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<template[\s\S]*?<\/template>/g, ' ').replace(/<[^>]+>/g, ''));

// Все тексты о ЗСК, где могут жить сроки: источники и собранные страницы (вкл. JSON-LD).
const ZSK = ['partials/faq.json', 'tarify/tarify.json', 'skoraya-115-fz/engine.js', 'skoraya-115-fz/index.html',
  '115-fz/zsk-zony-riska/index.html', '115-fz/zablokirovali-schet-chto-delat/index.html', 'tarify/index.html'];

test('ЗСК: «не позднее 10 рабочих дней» не стоит рядом с решением комиссии (п. 4 ст. 7.8)', () => {
  for (const f of ZSK) {
    const t = norm(chitat(f));
    assert.ok(!/не позднее 10 рабочих дней передаёт/.test(t), f);
    for (const m of t.matchAll(/решени[еяю] комиссии/g)) {
      const okno = t.slice(Math.max(0, m.index - 200), m.index + 200);
      assert.ok(!/не позднее 10 рабочих дней/.test(okno), f + ': ' + okno);
    }
  }
});

test('ЗСК: «20 рабочих дней» комиссии — только со словами «Банка России» (в законе срока нет)', () => {
  let n = 0;
  for (const f of ZSK) {
    const t = norm(chitat(f));
    for (const m of t.matchAll(/20 рабочих дней/g)) {
      const pered = t.slice(Math.max(0, m.index - 160), m.index);
      if (/блокировке счёта на $/.test(pered)) continue; // калькулятор простоя: «при блокировке счёта на 20 рабочих дней»
      if (/MVK_DAYS|dnej_prostoya_po_umolchaniyu/.test(pered.slice(-40))) continue;
      n++;
      assert.ok(/Банка России/.test(pered), f + ': …' + pered + '20 рабочих дней');
    }
  }
  assert.ok(n >= 8, 'мест с 20 рабочими днями: ' + n);
});

test('ЗСК: зарплата в красной зоне — только прежним работникам (п. 6 ст. 7.7)', () => {
  for (const f of ['partials/faq.json', '115-fz/zsk-zony-riska/index.html']) {
    const t = norm(chitat(f));
    for (const m of t.matchAll(/зарплат[аую][^.;]{0,90}(предыдущий месяц|прошлом месяце)/g))
      assert.match(m[0], /прежним работникам|кому её платили до попадания в красную зону/, f + ': ' + m[0]);
  }
});

test('ЗСК: с какого дня считать 6 месяцев (п. 8 ст. 7.7) и исключение — только на пути «меры применены»', () => {
  const STR = 'Днём получения считается следующий день после того, как банк отправил уведомление в интернет-банк или на почту, или шестой день после заказного письма (п. 8 ст. 7.7).';
  for (const f of ['115-fz/zsk-zony-riska/index.html', 'partials/faq.json', 'skoraya-115-fz/engine.js']) assert.ok(norm(chitat(f)).includes(STR), f);
  const t = vidimoe(chitat('115-fz/zsk-zony-riska/index.html'));
  assert.ok(t.includes('Это путь, когда банк уже применил меры.'));
  assert.ok(t.includes('Шесть месяцев после отказа Банка России в пересмотре (п. 1.2 ст. 7.8) к исключению не ведут.'));
  // Скорая: на пути «ЦБ, мер нет» об исключении из ЕГРЮЛ ни слова
  const e = chitat('skoraya-115-fz/engine.js');
  const netMer = e.slice(e.indexOf("if (inp.zskBank === 'net_mer') {"), e.indexOf('/* меры применены: только комиссия */'));
  assert.ok(netMer.length > 100 && !/ЕГРЮЛ|ЕГРИП/.test(netMer), 'путь п. 1.1–1.2 без исключения');
  assert.match(e.slice(e.indexOf('/* меры применены: только комиссия */')), /п\. 4 ст\. 7\.8/);
});

test('38-ФЗ: в бете цена рядом с оговоркой — главная «Сколько стоит» и калькулятор техпоставщика', () => {
  const OG = 'Цены — справочные, сейчас по ним ничего не продаём. О начале оплат и их условиях объявим на странице тарифов не позже чем за 3 дня.';
  const g = chitat('index.html');
  const ceny = g.slice(g.indexOf('id="ceny-h"'), g.indexOf('</section>', g.indexOf('id="ceny-h"')));
  const bet = norm((ceny.match(/<!--v-bete-->([\s\S]*?)<!--\/v-bete-->/) || [])[1] || '');
  assert.ok(bet.includes(OG), 'главная: оговорка [Право] в бетовой половине');
  const k = chitat('nalogi/kalkulyator-tehnicheskij-postavshchik/index.html');
  const vs = k.slice(k.indexOf('<div class="vs">'), k.indexOf('</div>', k.indexOf('<div class="vs">')));
  const opl = (vs.match(/<!--oplata-->([\s\S]*?)<!--\/oplata-->/) || [])[1] || '';
  const vb = (vs.match(/<!--v-bete-->([\s\S]*?)<!--\/v-bete-->/) || [])[1] || '';
  assert.match(opl, /data-cena="pro\.god"/, 'строка с ценой «Про» — в половине оплаты');
  assert.ok(!/₽/.test(vb) && norm(vb).includes('Сейчас проверка бесплатна — ') && vb.includes('href="#proverka"'), 'в бете — без цены, ссылка к проверке');
  assert.ok(k.includes('<section class="check" id="proverka"'));
  if (JSON.parse(chitat('tarify/tarify.json')).beta === true) {
    assert.ok(!vidimoe(k).includes('Год тарифа'), 'бета: цены «Про» на странице не видно');
    assert.ok(/<template data-oplata>[^]*?data-cena="pro\.god"/.test(vs), 'бета: строка с ценой спрятана в <template>');
  }
  assert.match(k, /var sx=\$\('sv-x'\); if\(sx\)/, 'скрипт не падает, когда строки нет');
});
