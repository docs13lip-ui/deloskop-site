// Статья «Письмо о смене реквизитов» (текст [Продукт · Маркетинг] 01.10, только абзацы, согласованные [Право]).
// Запуск: node --test tests/pismo_smena.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const A = '/nalogi/pismo-o-smene-rekvizitov-kak-proverit/';
const chit = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const S = chit('nalogi/pismo-o-smene-rekvizitov-kak-proverit/index.html');
const T = S.replace(/&nbsp;/g, ' ').replace(/ /g, ' ');

test('мета, canonical и разметка Article + FAQPage + BreadcrumbList', () => {
  assert.match(S, /<link rel="canonical" href="https:\/\/deloskop\.ru\/nalogi\/pismo-o-smene-rekvizitov-kak-proverit\/">/);
  const ld = JSON.parse(S.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepStrictEqual(ld.map((x) => x['@type']), ['Article', 'FAQPage', 'BreadcrumbList']);
  const vidimye = (S.match(/<details><summary>/g) || []).length;
  assert.strictEqual(ld[1].mainEntity.length, vidimye, 'FAQPage = видимые вопросы');
  assert.strictEqual((S.match(/<h1>/g) || []).length, 1);
});

test('главное: звонок по известному номеру, 5 проверок, кнопка в «Сравнить реквизиты»', () => {
  assert.ok(T.includes('по номеру, который знали раньше'));
  assert.strictEqual((S.match(/<ol class="pyat">([\s\S]*?)<\/ol>/)[1].match(/<li>/g) || []).length, 5);
  assert.ok(S.includes('href="/proverit-schet/#smena"'));
  assert.ok(T.includes('40702') && T.includes('40802') && T.includes('40817'));
  assert.ok(T.includes('п. 1 ст. 385 ГК'));
});

test('без обещаний исхода; ◐-абзацы — только в редакции [Право] 01.10 18:15', () => {
  assert.ok(!/гарантированно вернём|вернуть деньги можно всегда|вернём деньги/i.test(T));
  assert.ok(T.includes('Гарантий нет'));
  // ст. 312 ГК — дословно по [Право], «как правило» оставлено
  assert.ok(T.includes('долг перед поставщиком, как правило, остаётся'));
  assert.ok(T.includes('и плательщик несёт риск, если этого не сделал (п. 1 ст. 312 ГК РФ)'));
  // 161-ФЗ: перевод безотзывный после списания — «отозвать платёж» не советуем
  assert.ok(T.includes('Отменить перевод после списания со счёта уже нельзя (ч. 7 ст. 5 161‑ФЗ)') || T.includes('Отменить перевод после списания со счёта уже нельзя (ч. 7 ст. 5 161-ФЗ)'));
  assert.ok(!/отозвать платёж|отзовите платёж/i.test(T.replace(/<summary>[^<]*<\/summary>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')), 'совет «отозвать платёж» — после списания нельзя');
  // полиция — без обещаний возбуждения дела
  assert.ok(T.includes('Сохраните талон-уведомление о приёме заявления: он понадобится банку и суду.'));
  assert.ok(!/возбуд/i.test(T));
  // ВС 304-ЭС23-9987: банк получателя отвечал один, не «вместе с мошенником»
  assert.ok(T.includes('Верховный суд взыскал убытки с банка получателя'));
  assert.ok(T.includes('№ 304-ЭС23-9987, дело № А67-1408/2022'));
  assert.ok(!/вместе с мошенник|солидарно/i.test(T));
  assert.ok(!/искусственн|нейросет|\bИИ\b/.test(T));
});

test('пункт в договор X.1–X.3 — дословно, и он же в Делописи', () => {
  for (const p of ['X.1. Об изменении банковских реквизитов Сторона сообщает другой Стороне только письмом за подписью уполномоченного лица',
    'X.2. Новые реквизиты применяются после того, как получившая Сторона подтвердит их по телефону',
    'До подтверждения платёж по прежним реквизитам считается надлежащим исполнением.',
    'X.3. Сообщения об изменении реквизитов, полученные иным способом, не порождают обязанности платить по новым реквизитам.']) {
    assert.ok(T.includes(p), p);
  }
  assert.ok(S.includes('id="v-dogovor"') && S.includes('href="/delopis/"'));
  const D = chit('delopis/index.html');
  assert.ok(D.includes("S('Изменение банковских реквизитов'"));
  assert.ok(D.includes('До подтверждения платёж по прежним реквизитам считается надлежащим исполнением.'));
  assert.ok(D.includes("['Телефон', '']"), 'в реквизитах сторон есть строка «Телефон» — на неё ссылается пункт');
  assert.ok(D.includes('href="' + A + '"'), 'Делопись → статья');
});

test('Клерк в источниках — только как пересказ; первоисточники — ГК, 809-П, 161-ФЗ, определение ВС', () => {
  const src = T.match(/<section class="src">([\s\S]*?)<\/section>/)[1];
  assert.ok(/klerk\.ru[^<]*<\/a>|Клерк[^<]*пересказ, не первоисточник/.test(src) && src.includes('пересказ, не первоисточник'));
  assert.ok(src.includes('cons_doc_LAW_5142') && src.includes('cons_doc_LAW_436264'));
  assert.ok(src.includes('cons_doc_LAW_115625') && src.includes('garant.ru/products/ipo/prime/doc/407759423/'));
});

test('перелинковка: статья о счёте, «Проверь счёт», хаб, sitemap, лента', () => {
  assert.ok(chit('nalogi/kak-proverit-schet-pered-oplatoj/index.html').includes('href="' + A + '"'));
  const ps = chit('proverit-schet/index.html');
  const smena = ps.slice(ps.indexOf('id="smena"'), ps.indexOf('</section>', ps.indexOf('id="smena"')));
  assert.ok(smena.includes('href="' + A + '"'), 'ссылка в #smena');
  assert.ok(chit('nalogi/index.html').includes('href="' + A + '"'));
  assert.ok(chit('sitemap.xml').includes('<loc>https://deloskop.ru' + A + '</loc>'));
  const l = JSON.parse(chit('obnovleniya.json')).obnovleniya;
  const z = l.find((x) => x.id === '2026-10-01-13');
  assert.ok(z && z.chto_proverit.some((c) => c.ssylka === A));
  assert.strictEqual(l.filter((x) => x.id === '2026-10-01-13').length, 1);
});
