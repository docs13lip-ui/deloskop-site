// Страница «Почему у компании нет бухотчётности в открытых данных» — net-otchetnosti-v1, [Ночные запуски] 04.10.2026.
// ТЗ [Продукт · Маркетинг] 04.10 10:50 (claude/Продукт_статья_нет_отчётности_ГИРБО_ответы_✎_хаб20_04.10.md, разд. 2);
// правки [Право · Налоговый] 04.10 11:07 (claude/Право_ГИРБО_ответы_Разбор10_штраф115_Разбор11_Красцветмет_04.10.md, разд. 1.1–1.4).
// Запуск: node --test tests/net_otchetnosti.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const K = path.join(__dirname, '..');
const A = '/nalogi/net-otchetnosti-v-otkrytyh-dannyh/';
const chit = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const S = chit('nalogi/net-otchetnosti-v-otkrytyh-dannyh/index.html');
const plain = (s) => s.replace(/&nbsp;/g, ' ').replace(/&#8209;/g, '-').replace(/ /g, ' ');
const T = plain(S);
const VIDNO = T.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const STATYA = VIDNO.slice(VIDNO.indexOf('Почему у компании нет бухотчётности'));

test('мета по ТЗ: title 67 с «— Делоскоп», description ≤ 160, canonical, один H1, Article + BreadcrumbList + FAQPage', () => {
  assert.ok(S.includes('<title>Нет бухотчётности в открытых данных: почему и что делать — Делоскоп</title>'));
  const d = S.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.ok(d.length <= 160 && d.length >= 120, 'description ' + d.length);
  assert.ok(S.includes(`<link rel="canonical" href="https://deloskop.ru${A}">`));
  assert.strictEqual((S.match(/<h1>/g) || []).length, 1);
  const ld = JSON.parse(S.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepStrictEqual(ld.map((x) => x['@type']), ['Article', 'BreadcrumbList', 'FAQPage']);
  assert.strictEqual(ld[2].mainEntity.length, 4);
  assert.strictEqual(ld[2].mainEntity[1].name, 'Почему у банка может не быть отчётности в ГИР БО?', '[Право] 1.4: «может не быть»');
});

test('ответ — первым абзацем после H1: причина чаще законная, попросите отчётность у компании', () => {
  const lead = T.slice(T.indexOf('</h1>')).match(/<div class="lead">([\s\S]*?)<\/div>/)[1];
  assert.ok(lead.includes('Чаще всего причина законная'));
  assert.ok(lead.includes('попросите отчётность у самой компании'));
});

test('[Право] 1.4: банки — Банк России передаёт отчётность в ГИР БО (ч. 9 ст. 18), а не «её там нет»', () => {
  assert.ok(STATYA.includes('Годовую отчётность туда передаёт Банк России (ч. 9 ст. 18), но доступ к ней может быть ограничен.'));
  assert.ok(STATYA.includes('(ч. 4 ст. 18 402-ФЗ)') && STATYA.includes('(ч. 12 ст. 18 402-ФЗ)'));
});

test('[Право] 1.1 и 1.3: исключение — про налоговую отчётность и оба условия; срок — ч. 5 ст. 18', () => {
  assert.ok(STATYA.includes('не сдала ни одного документа налоговой отчётности и не провела ни одной операции по банковским счетам'));
  assert.ok(STATYA.includes('одной пустой строки в открытых данных о бухотчётности для исключения мало'));
  assert.ok(!/12 месяцев не сдаёт налоговую отчётность и не проводит/.test(STATYA), 'старая формулировка ТЗ заменена');
  assert.ok(STATYA.includes('не позднее трёх месяцев после окончания года (ч. 5 ст. 18 402-ФЗ)'));
});

test('[Право] 1.2: без «Минфин посоветовал» и без «без заявления — новость 2027 года»; «1102» нигде', () => {
  assert.ok(!/посоветовал|заранее/.test(STATYA), 'совет Минфина первоисточником не подтверждён');
  assert.ok(!/без заявления компании/.test(STATYA), 'пп. «д» п. 1 ПП № 1624 — уже действует, не новость');
  assert.ok(STATYA.includes('Минфин напомнил об этих правилах в информационном сообщении от 13.07.2026 № ИС-учет-67.'));
  assert.ok(STATYA.includes('лицензия на разработку или производство вооружения и военной техники'));
  assert.ok(!/1102/.test(S));
  assert.ok(!/гарантир|успейте/i.test(STATYA));
});

test('одна кнопка проверки (цель girbo_check), исходящие ссылки по ТЗ', () => {
  assert.strictEqual((S.match(/<form /g) || []).length, 1);
  assert.ok(S.includes('data-goal="girbo_check"'));
  for (const u of ['/nalogi/dokumenty-kontragenta-po-summe-sdelki/', '/company/', '/pasport/']) {
    assert.ok(S.slice(S.indexOf('<article>'), S.indexOf('</article>')).includes(`href="${u}"`), u);
  }
});

test('страница настоящая: sitemap, хаб /nalogi/, «Документы по сумме сделки», экран проверки', () => {
  assert.ok(chit('sitemap.xml').includes(`<loc>https://deloskop.ru${A}</loc>`));
  const vhod = ['nalogi/index.html', 'nalogi/dokumenty-kontragenta-po-summe-sdelki/index.html'].filter((f) => chit(f).includes(`href="${A}"`));
  assert.strictEqual(vhod.length, 2);
  const js = chit('js/sushchestvennoe.js');
  assert.ok(js.includes(`SPRAVKA_GIRBO = '${A}'`));
});

test('экран проверки: у «Нет в ответе ГИР БО» — ссылка «почему так бывает» с целью girbo_pochemu; у банка — нет', () => {
  const Sj = require('../js/sushchestvennoe.js');
  const otvet = (okved) => ({ company: { inn: '7700000001', ogrn: '1027700000001', okved, status: 'ACTIVE', name: 'ООО «Тест»' },
    dossier: { charts: {} }, checks: [], data_dates: '' });
  const f = Sj.fakty(otvet('46.19'));
  const b = f.spisok.find((x) => x.k === 'otchetnost');
  assert.strictEqual(b.znach, 'Нет в ответе ГИР БО');
  assert.strictEqual(b.spravka, A);
  assert.strictEqual(b.spravkaCel, 'girbo_pochemu');
  const h = Sj.html(otvet('46.19'));
  assert.ok(h.includes(`<a href="${A}" data-goal="girbo_pochemu">почему так бывает</a>`), 'ссылка в строке');
  const bk = Sj.fakty(otvet('64.19')).spisok.find((x) => x.k === 'otchetnost');
  assert.ok(!bk.spravka, 'у банка своя строка и ссылка на ЦБ');
  // цель по умолчанию у справки о статусах не изменилась
  assert.ok(js_bez_izm());
});

function js_bez_izm() {
  return chit('js/sushchestvennoe.js').includes("esc(x.spravkaCel || 'statusy_iz_proverki')");
}
