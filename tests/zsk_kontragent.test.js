// Статья «ЗСК контрагента по ИНН» (п. 167/214): текст [Продукт · Маркетинг] 01.10 в редакции [Право] 02.10 11:15.
// Запуск: node --test tests/zsk_kontragent.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const A = '/115-fz/proverit-kontragenta-zsk-po-inn/';
const chit = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const S = chit('115-fz/proverit-kontragenta-zsk-po-inn/index.html');
const T = S.replace(/&nbsp;/g, ' ').replace(/&#8209;/g, '-').replace(/ /g, ' ').replace(/‑/g, '-');
const VIDNO = T.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const CBR = 'https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/';

test('мета, canonical, один H1 и разметка Article + HowTo + FAQPage + BreadcrumbList', () => {
  assert.match(S, /<link rel="canonical" href="https:\/\/deloskop\.ru\/115-fz\/proverit-kontragenta-zsk-po-inn\/">/);
  assert.ok(S.includes('<title>ЗСК контрагента по ИНН: проверить поставщика перед оплатой — Делоскоп</title>'));
  assert.strictEqual((S.match(/<h1>/g) || []).length, 1);
  const ld = JSON.parse(S.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepStrictEqual(ld.map((x) => x['@type']), ['Article', 'HowTo', 'FAQPage', 'BreadcrumbList']);
  assert.strictEqual(ld[1].step.length, (S.match(/<ol class="pyat[^"]*">([\s\S]*?)<\/ol>/)[1].match(/<li>/g) || []).length, 'HowTo = видимые шаги');
  assert.strictEqual(ld[2].mainEntity.length, (S.match(/<details><summary>/g) || []).length, 'FAQPage = видимые вопросы');
  for (const c of ld[0].citation) assert.ok(/^https:\/\/(cbr\.ru|www\.consultant\.ru)\//.test(c), c);
});

test('правки [Право] 02.10: средний уровень, «платить ли», заголовок без «надёжн», FAQ 2 и 5', () => {
  assert.ok(VIDNO.includes('Публично — никто. Обязанность сообщить клиенту прямо названа только для высокого уровня: банк сообщает о нём в течение 5 рабочих дней.'));
  assert.ok(VIDNO.includes('Закон запрещает банку проводить у клиента из группы высокого риска списания со счёта и выдачу наличных; зачисления он не запрещает (п. 5 ст. 7.7 закона № 115-ФЗ).'));
  assert.ok(VIDNO.includes('кроме узкого списка исключений — налогов, зарплаты и некоторых других платежей (п. 6 ст. 7.7)'));
  assert.ok(VIDNO.includes('а аванс, возможно, придётся возвращать через суд'));
  assert.ok(VIDNO.includes('«Высокий уровень не найден» — значит, с поставщиком всё в порядке?'));
  assert.ok(VIDNO.includes('Свою зону поставщик может узнать в своём банке — спросите его.'));
  assert.ok(VIDNO.includes('Ваш платёж он получит, но распорядиться им почти не сможет — платите только по факту поставки.'));
  assert.ok(!/надёжн/i.test(VIDNO), '222-ФЗ: без «надёжн»');
});

test('без обещаний исхода и без утверждения статуса ЗСК от имени Делоскопа', () => {
  assert.ok(!/суд примет|докаж|гарантир/i.test(VIDNO));
  assert.ok(!/подтвержд/i.test(VIDNO), 'Делоскоп ЗСК не подтверждает — проверяет сам клиент');
  assert.ok(VIDNO.includes('Это наша оценка, а не решение Банка России.'));
  assert.ok(VIDNO.includes('Обходить это мы не будем.'));
  assert.ok(!/искусственн|нейросет|\bИИ\b/.test(VIDNO));
});

test('главная кнопка — одна, в Паспорт контрагента, с целью Метрики; сервис ЦБ — ссылкой рядом', () => {
  assert.strictEqual((S.match(/class="glavnoe__btn"/g) || []).length, 1);
  assert.ok(S.includes('<a class="glavnoe__btn" href="/pasport/kontragent/" data-goal="zsk_kontragent_pasport">'));
  assert.ok(S.includes(`<a class="glavnoe__vn" href="${CBR}" rel="noopener" target="_blank">`));
  assert.ok(chit('js/metrika.js').includes('closest("a[data-goal]")'), 'цель по клику на ссылку с data-goal');
});

test('внешние ссылки — https, только первоисточники и с rel=noopener', () => {
  const vneshnie = [...S.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)];
  assert.ok(vneshnie.length >= 5);
  for (const m of vneshnie) {
    assert.ok(m[1].startsWith('https://'), m[1]);
    assert.ok(/^https:\/\/(cbr\.ru|www\.consultant\.ru)\//.test(m[1]), 'не первоисточник: ' + m[1]);
    assert.ok(/rel="noopener"/.test(m[0]), 'без noopener: ' + m[1]);
  }
});

test('перелинковка: хаб, sitemap, «ЗСК простыми словами» (#osporit), Паспорт, лента', () => {
  assert.ok(chit('115-fz/index.html').includes(`href="${A}"`));
  assert.ok(chit('sitemap.xml').includes(`<loc>https://deloskop.ru${A}</loc>`));
  const Z = chit('115-fz/zsk-zony-riska/index.html');
  assert.ok(Z.includes('<h2 id="osporit">Как оспорить высокую оценку</h2>'));
  assert.ok(Z.includes(`<a href="${A}">Как проверить поставщика и что делать, если он в красной зоне`));
  assert.ok(S.includes('href="/115-fz/zsk-zony-riska/#osporit"'));
  assert.ok(chit('pasport/kontragent/index.html').includes(`x.id==='stoplisty'?'<a class="sam-zsk noprint" href="${A}#platit-li">`));
  assert.ok(S.includes('id="platit-li"'));
  const L = JSON.parse(chit('obnovleniya.json')).obnovleniya;
  assert.ok(L.some((x) => (x.chto_proverit || []).some((c) => c.ssylka === A)));
});

test('типографика: NBSP только сущностью, 115‑ФЗ неразрывно, ₽/% и «№» без висячих', () => {
  assert.ok(!S.includes(' '), 'NBSP символом — только &nbsp;');
  assert.ok(!/№ \d/.test(S.replace(/<script[\s\S]*?<\/script>/g, '')));
  assert.ok(S.includes('115&#8209;ФЗ'));
});
