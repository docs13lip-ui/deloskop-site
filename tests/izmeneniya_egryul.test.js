// Статья «Изменения в ЕГРЮЛ у контрагента» — izmeneniya-egryul-v1, [Ночные запуски] 05.10.2026.
// ТЗ [Продукт · Маркетинг] 04.10 15:00 (claude/Продукт_изменения_ЕГРЮЛ_контрагента_30_дней_кредитора_04.10.md, разд. 2);
// правки [Право · Юрист 115-ФЗ] 04.10 14:50 (claude/Право_изменения_ЕГРЮЛ_ответы_✎_КС_17-П_04.10.md, разд. 1–6)
// и 04.10 17:40 (claude/Право_Разбор14_КС_17-П_реорганизация_АО_ст30_п6_ст20_04.10.md, разд. 2.3).
// Запуск: node --test tests/izmeneniya_egryul.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const K = path.join(__dirname, '..');
const A = '/nalogi/izmeneniya-egryul-kontragenta/';
const chit = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const S = chit('nalogi/izmeneniya-egryul-kontragenta/index.html');
const plain = (s) => s.replace(/&nbsp;/g, ' ').replace(/&#8209;/g, '-').replace(/\u00a0/g, ' ');
const T = plain(S);
const VIDNO = T.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const STATYA = VIDNO.slice(VIDNO.indexOf('У контрагента что-то поменялось'));

test('мета по ТЗ: title ≤ 70 с «— Делоскоп», description ≤ 160, canonical, один H1, Article + BreadcrumbList + FAQPage (5)', () => {
  const t = S.match(/<title>([^<]*)<\/title>/)[1];
  assert.strictEqual(t, 'Изменения в ЕГРЮЛ у контрагента: что проверить до оплаты — Делоскоп');
  assert.ok(t.length <= 70, 'title ' + t.length);
  const d = S.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.ok(d.length <= 160 && d.length >= 120, 'description ' + d.length);
  assert.ok(S.includes(`<link rel="canonical" href="https://deloskop.ru${A}">`));
  assert.strictEqual((S.match(/<h1>/g) || []).length, 1);
  const ld = JSON.parse(S.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepStrictEqual(ld.map((x) => x['@type']), ['Article', 'BreadcrumbList', 'FAQPage']);
  assert.strictEqual(ld[2].mainEntity.length, 5);
  const vidimye = [...S.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => plain(m[1]).replace(/<[^>]+>/g, ''));
  assert.deepStrictEqual(vidimye, ld[2].mainEntity.map((q) => q.name), 'FAQPage = видимым вопросам');
});

test('лид — ответ первым абзацем: смена сама по себе не признак риска; 7 изменений в таблице', () => {
  const lead = T.slice(T.indexOf('</h1>')).match(/<div class="lead">([\s\S]*?)<\/div>/)[1];
  assert.ok(lead.includes('обычная жизнь компании, а не признак риска'));
  assert.strictEqual((S.match(/<tr id="izm-\d"/g) || []).length, 7);
});

test('[Право] 14:50 п. 1: 7 рабочих дней, не 3 (п. 5 ст. 5 129-ФЗ); FAQ 1 — «не прекращает» и доверенность', () => {
  assert.ok(STATYA.includes('в течение 7 рабочих дней (п. 5 ст. 5 129-ФЗ)'));
  assert.ok(!/3 рабочих дн/.test(STATYA), 'устаревший срок');
  assert.ok(STATYA.includes('смена руководителя его не прекращает'));
  assert.ok(STATYA.includes('проверьте, что доверенность действует'));
  assert.ok(!/188 ГК|ст\. 188/.test(STATYA), 'ст. 188 не сверена — не ставим');
});

test('[Право] п. 2: недостоверность — «налоговая вправе исключить», как на живой статье об адресе', () => {
  assert.ok(STATYA.includes('налоговая вправе исключить компанию из ЕГРЮЛ (пп. «б» п. 5 ст. 21.1 129-ФЗ)'));
  assert.ok(chit('nalogi/nedostovernyj-adres-egryul/index.html').replace(/&nbsp;/g, ' ').includes('вправе исключить'));
});

test('[Право] п. 3 и 17:40 разд. 2.3: капитал — требование до первой публикации, 6 месяцев на суд, суд может отказать, АО', () => {
  assert.ok(STATYA.includes('Если ваше право требования возникло до первой публикации уведомления'));
  assert.ok(STATYA.includes('В суд с таким требованием — не позднее 6 месяцев с последней публикации'));
  assert.ok(STATYA.includes('Суд может отказать, если компания докажет, что ваши права не нарушены или что обеспечение достаточно (п. 6 ст. 20 14-ФЗ; для АО — п. 4 ст. 30 208-ФЗ)'));
  assert.ok(STATYA.includes('право требовать досрочно уходит; обычные права по договору остаются'));
  assert.ok(STATYA.includes('У ООО и АО сроки одинаковые'));
  assert.ok(!/участники отвечают/.test(STATYA), 'участники ООО по долгам общества не отвечают (п. 1 ст. 87 ГК)');
  assert.ok(!/если у компании перед вами долг/.test(STATYA));
});

test('[Право] п. 4: реорганизация — «через суд», КС № 17-П, обеспечение, преобразование — абз. 2 п. 5 ст. 58 ГК', () => {
  assert.ok(STATYA.includes('вы вправе потребовать через суд досрочного исполнения'));
  assert.ok(STATYA.includes('Постановление Конституционного Суда РФ от 24.03.2026 № 17-П'));
  assert.ok(STATYA.includes('если у вас уже есть достаточное обеспечение, права нет'));
  assert.ok(STATYA.includes('(абз. 2 п. 5 ст. 58 ГК РФ)'));
  assert.ok(!/п\. 5 ст\. 60/.test(STATYA), 'исключение для преобразования — не в ст. 60');
  assert.ok(!/вернут досрочно|суд обязан|гарантир/i.test(STATYA));
});

test('[Право] п. 5: ликвидация и предстоящее исключение — раздельно, 2 и 3 месяца', () => {
  assert.ok(STATYA.includes('Ликвидация — требования ликвидатору, срок в публикации, не меньше 2 месяцев (п. 1 ст. 63 ГК РФ)'));
  assert.ok(STATYA.includes('Предстоящее исключение — возражение в налоговую, 3 месяца со дня публикации решения (п. 3 ст. 21.1 129-ФЗ)'));
});

test('«Ваш срок» — три строки с тонкой линией; «30 дней» неразрывно', () => {
  assert.strictEqual((S.match(/<p class="srok__h">Ваш срок<\/p>/g) || []).length, 3);
  assert.ok(/<b class="srok__d">30&nbsp;дней<\/b>/.test(S));
});

test('словарь: нет «однодневк», «надёжн», «банк считает», «гарант»; писем слежения не обещаем', () => {
  assert.ok(!/однодневк|надёжн|надежн|банк считает|гарант/i.test(STATYA.slice(0, STATYA.indexOf('Источники'))));
  const slezh = STATYA.slice(STATYA.indexOf('Как не пропустить'), STATYA.indexOf('Частые вопросы'));
  assert.ok(slezh.length > 50);
  assert.ok(!/письм|пришлём|уведомим/i.test(slezh));
});

test('одна форма проверки (цель izm_check), «Следить» и «Паспорт» — с целями; ссылки только на живые страницы', () => {
  assert.strictEqual((S.match(/<form /g) || []).length, 1);
  assert.ok(S.includes('data-goal="izm_check"') && S.includes('data-goal="izm_slezh"') && S.includes('data-goal="izm_pasport"'));
  const sm = chit('sitemap.xml');
  const vnutr = [...new Set([...S.slice(S.indexOf('<main'), S.indexOf('</main>')).matchAll(/href="(\/nalogi\/[^"#]+)"/g)].map((m) => m[1]))];
  assert.ok(vnutr.length >= 6, 'ссылок на статьи ' + vnutr.length);
  for (const u of vnutr) assert.ok(sm.includes(`<loc>https://deloskop.ru${u}</loc>`), u);
});

test('страница настоящая: sitemap, хаб /nalogi/, входящие из «Коды статуса» и «Проверка перед договором»', () => {
  assert.ok(chit('sitemap.xml').includes(`<loc>https://deloskop.ru${A}</loc>`));
  for (const f of ['nalogi/index.html', 'nalogi/kody-statusa-egryul/index.html', 'nalogi/proverka-kontragenta-pered-dogovorom/index.html']) {
    assert.ok(chit(f).includes(`href="${A}"`), f);
  }
});
