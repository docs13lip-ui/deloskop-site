// Страница «На какую дату данные в проверке контрагента» (ТЗ [Продукт] 02.10 16:37, правки [Право · Налоговый] 02.10 17:25;
// п. 10 приказа ФНС № ЕД-7-14/1006@ сверен дословно 03.10). Запуск: node --test tests/svezhest.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const A = '/nalogi/svezhest-dannyh-proverki-kontragenta/';
const chit = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const S = chit('nalogi/svezhest-dannyh-proverki-kontragenta/index.html');
const T = S.replace(/&nbsp;/g, ' ').replace(/&#8209;/g, '-').replace(/ /g, ' ');
const VIDNO = T.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('мета: title ≤ 70, description ≤ 160, canonical, один H1, разметка Article + BreadcrumbList + FAQPage', () => {
  const t = S.match(/<title>([^<]*)<\/title>/)[1].replace(/ — Делоскоп$/, '');
  assert.strictEqual(t, 'На какую дату данные в проверке контрагента: сроки ФНС 2026');
  assert.ok(t.length <= 70);
  const d = S.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.ok(d.length <= 160, 'description ' + d.length);
  assert.ok(S.includes(`<link rel="canonical" href="https://deloskop.ru${A}">`));
  assert.strictEqual((S.match(/<h1>/g) || []).length, 1);
  const ld = JSON.parse(S.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepStrictEqual(ld.map((x) => x['@type']), ['Article', 'BreadcrumbList', 'FAQPage']);
  assert.strictEqual(ld[2].mainEntity.length, (S.match(/<details><summary>/g) || []).length);
});

test('ответ — первым абзацем после H1; «не проверяли», а не «нет»', () => {
  const posle = T.slice(T.indexOf('</h1>'));
  const lead = posle.match(/<div class="lead">([\s\S]*?)<\/div>/)[1].replace(/<[^>]+>/g, ' ');
  assert.ok(lead.includes('Долги по налогам налоговая публикует каждый месяц'));
  assert.ok(lead.includes('честный ответ — «не проверяли», а не «нет»'));
});

test('сроки — только сверенные: п. 10 приказа 1006@ и ст. 18 402-ФЗ; без порога «1 000 ₽» и без «ежемесячно» у не сверенных наборов', () => {
  assert.ok(VIDNO.includes('каждый месяц, 25-го числа'));
  assert.ok(VIDNO.includes('на 1-е число месяца'));
  assert.ok(VIDNO.includes('с 2026 года — 1 апреля (раньше — 1 октября)'));
  assert.ok(VIDNO.includes('раз в год, 1 декабря'));
  assert.ok(VIDNO.includes('штраф по которым не уплачен к 1 октября'));
  assert.ok(VIDNO.includes('не позднее трёх месяцев после окончания года'));
  assert.ok(VIDNO.includes('(ч. 4 ст. 18 закона о бухучёте)'));
  assert.ok(!/1 000 ₽/.test(VIDNO), 'порог не сверен — [Право] 02.10');
  // п. 10 «б», «в», «д» приказа ММВ-7-14/729@ (ред. 1006@): спецрежимы — п. 5, численность — п. 7, доходы и расходы — п. 9
  const ryad = (n) => T.match(new RegExp('<tr><td>' + n + '[\\s\\S]*?<\\/tr>'))[0].replace(/&nbsp;/g, ' ');
  assert.ok(ryad('Специальный налоговый режим').includes('каждый месяц, 25-го числа'));
  assert.ok(ryad('Численность сотрудников').includes('1 апреля, затем — 25-го числа каждого месяца'));
  assert.ok(ryad('Доходы и').includes('1 мая, затем — 25-го числа каждого месяца'));
  assert.ok(!/по графику ФНС|раз в год/.test(ryad('Численность сотрудников') + ryad('Доходы и')), 'численность и доходы — не «раз в год»');
  assert.ok(VIDNO.includes('Сроки — по приказу ФНС № ЕД-7-14/1006@ и ст. 18 закона о бухучёте; сверено командой Делоскопа'));
});

test('календарь: подпись для чтения с экрана совпадает с таблицей; 12 месяцев, 12 точек долгов', () => {
  const k = S.match(/<figure class="kal"[\s\S]*?<\/figure>/)[0];
  assert.ok(/role="img" aria-label="[^"]*долги по налогам — 25-го числа каждого месяца[^"]*1 апреля[^"]*1 декабря/.test(k));
  assert.strictEqual((k.match(/<i>/g) || []).length, 12);
  assert.strictEqual((k.match(/class="kal__s kal__kazhd">((?:<em><\/em>)+)/)[1].match(/<em>/g) || []).length, 12);
});

test('осмотрительность — формулировка [Право] с письмом ФНС; без обещаний и без «ИИ», названий сервисов, «самые свежие»', () => {
  assert.ok(VIDNO.includes('Налоговая оценивает проверку контрагента на момент его выбора и заключения сделки (письмо ФНС от 10.03.2021 № БВ-4-7/3060@), поэтому важны сведения на день решения, а не на сегодня.'));
  assert.ok(!/гарантир|самые свежие|лучши|надёжн|нейросет|\bИИ\b|kontur|контур\.|rusprofile|checko|zachestnyibiznes/i.test(VIDNO));
});

test('одно главное действие — проверка по ИНН с целью; Паспорт — вторичной ссылкой с целью', () => {
  assert.strictEqual((S.match(/data-goal="svezhest_check"/g) || []).length, 1);
  assert.ok(S.includes('<form action="/" method="get" data-goal="svezhest_check"'));
  assert.ok(S.includes('<a class="dalee" href="/pasport/" data-goal="svezhest_pasport">'));
  assert.ok(chit('js/metrika.js').includes('closest("form[data-goal]")'));
});

test('внешние ссылки — https, первоисточники, rel=noopener', () => {
  const v = [...S.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)].filter((m) => !m[1].startsWith('https://deloskop.ru'));
  assert.ok(v.length >= 3);
  for (const m of v) {
    assert.ok(/^https:\/\/www\.consultant\.ru\//.test(m[1]), 'не первоисточник: ' + m[1]);
    assert.ok(/rel="noopener"/.test(m[0]));
  }
});

test('перелинковка: хаб «Налоги», /indeks/, sitemap, «Как это решают суды», sroki.json', () => {
  assert.ok(chit('nalogi/index.html').includes(`href="${A}"`));
  assert.ok(chit('indeks/index.html').includes(`<a href="${A}">Как часто обновляется каждый источник</a>`));
  assert.ok(chit('sitemap.xml').includes(`<loc>https://deloskop.ru${A}</loc>`));
  assert.ok(S.includes('<!--praktika-ssylki-->') && S.includes('/praktika/nalogi/proverka-kontragenta-na-datu-sdelki/'));
  const sr = JSON.parse(chit('sroki.json')).sroki.find((x) => x.id === 'grafik_naborov_fns');
  assert.ok(sr && sr.istochnik.includes('LAW_522885'));
});

test('типографика: NBSP только сущностью, «№» без висячих', () => {
  assert.ok(!S.includes(' '));
  assert.ok(!/№ \d/.test(S.replace(/<script[\s\S]*?<\/script>/g, '')));
});
