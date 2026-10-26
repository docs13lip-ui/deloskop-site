// pravo-strochki-v1 ([Ночные запуски], 26.10.2026): строки [Право] 26.10 11:00
// (claude/Право_ответы_✎_26.10_ПП798_демо_входы_Разбор_29_залог.md): (1) ПП № 1624 → № 798 в «Нет бухотчётности» —
// «сейчас» № 1624, с 01.01.2027 № 798 (вступил 05.07.2026, ФНС применяет с 2027 — не «уже действует»);
// (2) «Запрос банка» → «Однофамилец в перечне» строкой в тексте.
// Запуск: node --test tests/pravo_strochki_2610.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const K = path.join(__dirname, '..');
const chit = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const vidno = (s) => s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<\/?(a|b|i|em|strong)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-').replace(/\s+/g, ' ');

const ST = vidno(chit('nalogi/net-otchetnosti-v-otkrytyh-dannyh/index.html'));
const SEJCHAS = 'Сейчас случаи и порядок закрытия отчётности определяет постановление Правительства от 16.09.2022 № 1624';
const S2027 = 'С 1 января 2027 года — постановление от 27.06.2026 № 798; ограничения, введённые раньше, сохраняются до конца своего срока.';

test('«Нет бухотчётности»: № 1624 — сейчас, № 798 — с 01.01.2027, прежние ограничения сохраняются', () => {
  const t = ST.slice(ST.indexOf('Доступ закрыт по закону'), ST.indexOf('Ещё рано'));
  assert.ok(t.includes(SEJCHAS), 'строка [Право] «Сейчас … № 1624»');
  assert.ok(t.includes(S2027), 'строка [Право] про № 798');
  assert.ok(!/Сейчас по постановлению Правительства от 16\.09\.2022/.test(ST), 'старая фраза ушла');
  assert.ok(!/798[^.]*(уже действует|действует с 05\.07)/.test(ST), '№ 798 ФНС применяет с 2027 — не «уже действует»');
});

test('FAQ «Можно ли законно закрыть свою отчётность» — те же две фразы, и в FAQPage', () => {
  const F = JSON.parse(chit('partials/faq.json'));
  const spisok = F.stranicy['nalogi/net-otchetnosti-v-otkrytyh-dannyh/index.html'];
  const q = spisok.find((x) => x.v === 'Можно ли законно закрыть свою отчётность от посторонних?');
  assert.ok(q, 'вопрос на месте');
  assert.ok(q.o[0].startsWith(SEJCHAS) && q.o[1] === S2027);
  const S = chit('nalogi/net-otchetnosti-v-otkrytyh-dannyh/index.html');
  const ld = JSON.parse(S.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.ok(ld[2].mainEntity[2].acceptedAnswer.text.replace(/ /g, ' ').includes('№ 798'));
});

test('Источники: № 798 — правила действуют с 01.01.2027 (вступило 05.07.2026, ФНС применяет с 2027)', () => {
  assert.ok(ST.includes('№ 798: новые правила ограничения доступа, действуют с 01.01.2027'));
});

test('«Запрос банка»: строка [Право] о совпадении с перечнем и ссылка на «Однофамилец в перечне» в тексте', () => {
  const S = chit('115-fz/zapros-banka-po-115-fz-kak-otvetit/index.html');
  const art = S.slice(S.indexOf('<article>'), S.indexOf('</article>'));
  assert.ok(vidno(art).includes('Если банк заблокировал деньги, потому что ваше имя совпало с именем из перечня Росфинмониторинга, — это не запрос документов, а другая процедура. Что делать — в статье «Однофамилец в перечне».'));
  assert.ok(art.includes('href="/115-fz/sovpadenie-s-perechnem-chto-delat/"'));
  assert.ok(fs.existsSync(path.join(K, '115-fz/sovpadenie-s-perechnem-chto-delat/index.html')));
});
