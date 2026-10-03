// Статья «Однофамилец в перечне» (/115-fz/sovpadenie-s-perechnem-chto-delat/): ТЗ [Продукт · Маркетинг] 02.10 12:50,
// текст [Право · Юрист 115-ФЗ] 02.10 15:20 дословно. Запуск: node --test tests/odnofamilec.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const A = '/115-fz/sovpadenie-s-perechnem-chto-delat/';
const chit = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const S = chit('115-fz/sovpadenie-s-perechnem-chto-delat/index.html');
const T = S.replace(/&nbsp;/g, ' ').replace(/&#8209;/g, '-');
const VIDNO = T.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const RAZDEL = (id) => { const i = VIDNO.indexOf(id); return i; };

test('мета, canonical, один H1, разметка Article + HowTo + BreadcrumbList + FAQPage', () => {
  assert.ok(S.includes('<title>Однофамилец в перечне: банк остановил операцию — что делать — Делоскоп</title>'));
  assert.ok(S.includes(`<link rel="canonical" href="https://deloskop.ru${A}">`));
  assert.strictEqual((S.match(/<h1>/g) || []).length, 1);
  const d = S.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.ok(d.length <= 160, 'description ' + d.length);
  const ld = JSON.parse(S.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepStrictEqual(ld.map((x) => x['@type']), ['Article', 'HowTo', 'BreadcrumbList', 'FAQPage']);
  assert.strictEqual(ld[1].step.length, (S.match(/<ol class="pyat[^"]*">([\s\S]*?)<\/ol>/)[1].match(/<li>/g) || []).length, 'HowTo = видимые шаги');
  assert.strictEqual(ld[3].mainEntity.length, (S.match(/<details><summary>/g) || []).length, 'FAQPage = видимые вопросы');
  assert.strictEqual(ld[3].mainEntity.length, 5, '«Поможет ли смена банка?» убран по [Право]');
  assert.ok(!VIDNO.includes('смена банка'));
});

test('текст [Право] 15:20 — дословно: лид, норма, письмо РФМ, сроки, документы', () => {
  for (const f of [
    'Совпадение имени с человеком из перечня Росфинмониторинга ещё не значит, что вы в перечне',
    'Банк обязан проверять клиентов по перечню не реже раза в три месяца (пп. 7 п. 1 ст. 7 115-ФЗ) и замораживать деньги включённого в него лица не позднее 24 часов после того, как сведения появились на сайте Росфинмониторинга (пп. 6 п. 1 ст. 7).',
    'Росфинмониторинг в письме от 15.05.2020 № 01-01-40/9140 разъяснил',
    'Отдельного срока для «частичного совпадения» закон сейчас не устанавливает — он говорит только о лицах, включённых в перечень.',
    'Сроков ответа банка мы не обещаем.',
    'Для компании — выписка из ЕГРЮЛ с ИНН и ОГРН: в перечне организаций сверяют реквизиты, а не только название.',
  ]) assert.ok(VIDNO.includes(f), f);
});

test('законопроект 170956 на странице не публикуем (решение [Право] 02.10 11:15, тест zsk_primer) — только норма и письмо РФМ', () => {
  assert.ok(!/170956|частичном совпадении|Что может измениться/.test(S));
  assert.ok(!S.includes('regulation.gov.ru'));
});

test('без обещаний исхода, без ФИО из перечня, без упоминания ИИ', () => {
  assert.ok(!/разблокир|гарант|вернём|вернем|снимем/i.test(VIDNO));
  assert.ok(!/искусственн|нейросет|\bИИ\b/.test(VIDNO));
  assert.ok(!/надёжн/i.test(VIDNO), '222-ФЗ');
});

test('главная кнопка — одна, в «Скорую 115-ФЗ», с целью; вторая — проверка контрагента', () => {
  assert.strictEqual((S.match(/class="glavnoe__btn"/g) || []).length, 1);
  assert.ok(S.includes('<a class="glavnoe__btn" href="/skoraya-115-fz/" data-goal="odnofamilec_skoraya">'));
  assert.ok(S.includes('data-goal="odnofamilec_check"'));
});

test('внешние ссылки — https, первоисточники, rel=noopener', () => {
  const v = [...S.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)];
  assert.ok(v.length >= 4);
  for (const m of v) {
    assert.ok(/^https:\/\/(www\.consultant\.ru|www\.fedsfm\.ru|www\.cbr\.ru)\//.test(m[1]), 'не первоисточник: ' + m[1]);
    assert.ok(/rel="noopener"/.test(m[0]), m[1]);
  }
});

test('перелинковка: хаб, «Заблокировали счёт», sitemap, лента', () => {
  assert.ok(chit('115-fz/index.html').includes(`href="${A}"`));
  assert.ok(chit('115-fz/zablokirovali-schet-chto-delat/index.html').includes(`href="${A}"`));
  assert.ok(chit('sitemap.xml').includes(`<loc>https://deloskop.ru${A}</loc>`));
  const L = JSON.parse(chit('obnovleniya.json')).obnovleniya;
  assert.ok(L.some((x) => (x.chto_proverit || []).some((c) => c.ssylka === A)), 'запись ленты');
});

test('типографика: NBSP только сущностью, 115‑ФЗ неразрывно, «№» без висячих', () => {
  assert.ok(!S.includes(' '));
  assert.ok(!/№ \d/.test(S.replace(/<script[\s\S]*?<\/script>/g, '')));
  assert.ok(S.includes('115&#8209;ФЗ'));
});
