// /115-fz/v-cifrah/ «115-ФЗ в цифрах» (v-cifrah-v1, [Ночные запуски] 05.10.2026; ТЗ [Продукт] 04.10 13:20 разд. 2, правка [Право] 04.10).
// Сторож: у каждой цифры — источник и дата; нет снятых цифр и формулировок; ответы FAQ — со страницы;
// страница в sitemap, входящие ссылки на месте; одно главное действие (форма проверки).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(K, '115-fz/v-cifrah/index.html'), 'utf8');
const txt = (s) => s.replace(/<\/?(?:a|b|strong|em|span|small)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');
const telo = txt(html.slice(html.indexOf('<main'), html.indexOf('</main>')));

test('v-cifrah: title, description, H1, canonical', () => {
  const t = html.match(/<title>([^<]+)<\/title>/)[1];
  assert.strictEqual(t, '115-ФЗ в цифрах 2026: ЗСК, ограничения счетов, жалобы — ЦБ');
  assert.ok(t.length <= 60, 'title ≤ 60');
  const d = html.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.ok(d.length >= 120 && d.length <= 160, 'description 120–160: ' + d.length);
  assert.match(html, /<h1>115-ФЗ в цифрах: что сообщает Банк России<\/h1>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/deloskop\.ru\/115-fz\/v-cifrah\/">/);
});

test('v-cifrah: четыре цифры, у каждой — источник «Банк России» и дата', () => {
  const bloki = html.match(/<div class="cifra"[\s\S]*?<\/div>/g) || [];
  assert.strictEqual(bloki.length, 4);
  for (const b of bloki) {
    const s = (b.match(/<p class="cifra__s">([^<]+)<\/p>/) || [])[1] || '';
    assert.match(s, /Банк России/, 'источник: ' + b.slice(0, 80));
    assert.match(s, /\d{2}\.\d{2}\.2026/, 'дата: ' + b.slice(0, 80));
  }
  for (const c of ['7,5 млн', '≈ 190 тыс.', '+32,7 %', '20,9 млрд ₽']) assert.ok(txt(html).includes(c), c);
});

test('v-cifrah: снятые цифры и формулировки не вернулись', () => {
  for (const z of ['23,8', 'в 6 раз', '4,1 тыс', 'высоким уровнем риска', 'Интерфакс', 'надёжн', 'надежн', 'гарантир', 'к переводам']) {
    assert.ok(!telo.includes(z), 'на странице «' + z + '»');
  }
  assert.ok(!/(^|[^«])недобросовестн/.test(telo), '«недобросовестных» — только в кавычках');
});

test('v-cifrah: письма Банка России — номер, дата и «рекомендация, а не обязанность»', () => {
  assert.ok(telo.includes('№ ИН-01-59/98'));
  assert.ok(telo.includes('от 25.09.2026 № ИН-03-45/32'));
  const i = telo.indexOf('интернет-банку или карте');
  assert.ok(i > 0, 'правка [Право]: «к интернет-банку или карте»');
  assert.ok(telo.slice(i, i + 300).includes('Это рекомендация, а не обязанность банка'));
});

test('v-cifrah: одно главное действие — форма проверки с целью cifry_check; Щит — cifry_shchit', () => {
  assert.strictEqual((html.match(/<form\b/g) || []).length, 1);
  assert.match(html, /<form action="\/" method="get" data-goal="cifry_check">/);
  assert.ok((html.match(/data-goal="cifry_shchit"/g) || []).length >= 1);
  assert.ok(!/btn-primary/.test(html.slice(html.indexOf('<main'))), 'вторых главных кнопок нет');
});

test('v-cifrah: разметка Article + BreadcrumbList + FAQPage, ответы — со страницы', () => {
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const tipy = ld.map((x) => x['@type']);
  for (const t of ['Article', 'BreadcrumbList', 'FAQPage']) assert.ok(tipy.includes(t), t);
  const faq = ld.find((x) => x['@type'] === 'FAQPage');
  assert.strictEqual(faq.mainEntity.length, 3);
  const statya = txt(html.slice(html.indexOf('<h1'), html.indexOf('</article>')));
  for (const q of faq.mainEntity) for (const pr of q.acceptedAnswer.text.split(/(?<=\.)\s+/)) {
    assert.ok(statya.includes(pr.replace(/ /g, ' ')), 'ответ не со страницы: ' + pr);
  }
});

test('v-cifrah: в sitemap, входящие ссылки из хаба и статей', () => {
  assert.ok(fs.readFileSync(path.join(K, 'sitemap.xml'), 'utf8').includes('<loc>https://deloskop.ru/115-fz/v-cifrah/</loc>'));
  for (const f of ['115-fz/index.html', '115-fz/zsk-zony-riska/index.html', '115-fz/zablokirovali-schet-chto-delat/index.html']) {
    assert.ok(fs.readFileSync(path.join(K, f), 'utf8').includes('href="/115-fz/v-cifrah/"'), f);
  }
  const hab = fs.readFileSync(path.join(K, '115-fz/index.html'), 'utf8');
  const kart = hab.slice(hab.indexOf('<div class="cards"'));
  assert.ok(kart.indexOf('/115-fz/v-cifrah/') < kart.indexOf('/praktika/115-fz/'), 'в хабе — карточкой первой');
});

test('v-cifrah: страница самостоятельная, не мягкая 404 (своё тело, не главная)', () => {
  assert.ok(!html.includes('id="check"'), 'это не копия главной');
  assert.ok(html.length > 20000);
});
