// «Тариф основателя» — /osnovatel/ и полоса на /tarify/ (п. 4 «Очереди», claude/Арт-директор_основатель_26.09.md), 26.09.2026.
// Запуск: node --test tests/osnovatel.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const D = JSON.parse(chitat('tarify/tarify.json'));
const { platnyj, vidimoe } = require('./beta_vid.js'); // beta-v1: оплату проверяем в «платном» виде
const rub = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

test('tarify.json: «osnovatel» — разовый продукт 7 150 ₽, 300 мест, доступ «Про» на 12 месяцев (согласовано владельцем)', () => {
  const o = D.osnovatel;
  assert.ok(o && o.razovo === true);
  assert.strictEqual(o.cena_rub, 7150);
  assert.strictEqual(o.mest, 300);
  assert.strictEqual(o.dostup, 'pro');
  assert.strictEqual(o.mesyacev, 12);
});

test('/osnovatel/: цены — только из tarify.json, SEO и FAQ по правилам', () => {
  const t = vidimoe(platnyj(chitat('osnovatel/index.html')));
  const title = t.match(/<title>([^<]*)<\/title>/)[1];
  assert.ok(title.length <= 70);
  assert.ok(t.match(/<meta name="description" content="([^"]*)"/)[1].length <= 160);
  assert.ok(t.includes('<link rel="canonical" href="https://deloskop.ru/osnovatel/">'));
  assert.ok(chitat('sitemap.xml').includes('<loc>https://deloskop.ru/osnovatel/</loc>'));
  for (const m of t.matchAll(/data-cena="osnovatel">([^<]*)</g)) assert.strictEqual(m[1], rub(D.osnovatel.cena_rub));
  const pro = D.tarify.find(x => x.id === 'pro');
  assert.strictEqual(t.match(/data-cena="pro\.god">([^<]*)</)[1], rub(pro.god));
  // «Что входит» = список «Про» с /tarify/ (обещаем только то, что обещает тариф)
  for (const x of pro.chto) assert.ok(t.includes('<li>' + x.replace(/&/g, '&amp;') + '</li>'), 'нет пункта «' + x + '»');
  // FAQPage — только с видимыми вопросами
  const faq = JSON.parse(t.match(/<script type="application\/ld\+json">(\{"@context": "https:\/\/schema.org", "@type": "FAQPage"[\s\S]*?)<\/script>/)[1]);
  assert.strictEqual(faq.mainEntity.length, (t.match(/<details><summary>/g) || []).length);
  // счётчик скрыт, пока API не сказал «занято ≥ 10»; кнопка — счёт (не бронь: п. 3.8 (а)); окно счёта — js/schet.js
  assert.ok(/data-osn-seats hidden/.test(t));
  assert.ok(/<a [^>]*href="\/schet\/\?produkt=osnovatel" data-schet data-produkt="osnovatel"[^>]*>Получить счёт на(&nbsp;| )тариф основателя<\/a>/.test(t));
  const tt = t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  assert.ok(tt.includes('Место закрепляется в день, когда оплата поступит на наш счёт. Номер основателя — по дате зачисления (п. 3.8 оферты).'));
  assert.ok(t.includes('Да: счёт и акт на каждый оплаченный год — на дату открытия доступа (п. 6.2 оферты).'), 'FAQ «закрывающие документы» → п. 6.2');
  assert.ok(!/Условия — в(&nbsp;| )<a href="\/oferta\/#osnovatel">оферте, п/.test(t));
  assert.ok(t.includes('<script src="/js/schet.js" defer></script>') && t.includes('<script src="/js/osnovatel.js" defer></script>'));
  assert.ok(!/зачёркн|<s>|<del>|таймер|осталось \d+ (час|мин)/i.test(t), 'без зачёркнутых цен и таймеров');
  assert.ok(!/без НДС навсегда/.test(t));
});

test('js/osnovatel.js: порог показа счётчика 10, три состояния кнопки', () => {
  const j = chitat('js/osnovatel.js');
  assert.ok(/MIN_POKAZ = 10/.test(j));
  assert.ok(j.includes("'/api/osnovatel'"));
  for (const f of ['Места закончились', 'Получить счёт', "aria-disabled"]) assert.ok(j.includes(f), f);
});

test('/tarify/: полоса «Тариф основателя» над карточками, цена из tarify.json, ведёт на /osnovatel/', () => {
  const t = chitat('tarify/index.html');
  const i = t.indexOf('class="osn-band"'), k = t.indexOf('class="plans"');
  assert.ok(i > 0 && i < k, 'полоса — над карточками');
  assert.strictEqual(t.match(/<span data-cena="osnovatel">([^<]*)<\/span>/)[1], rub(D.osnovatel.cena_rub));
  assert.ok(t.slice(i, k).includes('href="/osnovatel/"'));
});

test('окно счёта: у «Основателя» своя первая строка (не про анкету и выписку «Скорой»)', () => {
  const j = chitat('js/schet.js');
  assert.ok(/osnovatel: "Тариф «Про» на 12 месяцев/.test(j));
});

test('без «брони»: /osnovatel/ (оба вида), /tarify/ и js/osnovatel.js не обещают бронь места (п. 3.8 (а) оферты)', () => {
  const zapret = /забронир|брон[ьиеяю]|зарезерв|резерв мест/i;
  const html = chitat('osnovatel/index.html');
  for (const [imya, t] of [['/osnovatel/ платный', vidimoe(platnyj(html))], ['/osnovatel/ бета', html], ['/tarify/', chitat('tarify/index.html')]]) {
    const vid = t.replace(/<script[\s\S]*?<\/script>/g, (m) => m.includes('FAQPage') ? m : '').replace(/<!--[\s\S]*?-->/g, '');
    assert.ok(!zapret.test(vid), imya + ': ' + (vid.match(zapret) || [])[0]);
  }
  const j = chitat('js/osnovatel.js').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.ok(!zapret.test(j), 'js/osnovatel.js');
});

test('оферта п. 3.8 (з): счёт 5 рабочих дней, мест нет — возврат или зачёт за 10 рабочих дней; окно счёта — «при наличии свободного места»', () => {
  const o = chitat('oferta/index.html').replace(/&nbsp;/g, ' ');
  const blok = o.slice(o.indexOf('<li id="osnovatel">'), o.indexOf('<h2 id="o4">'));
  assert.ok(blok.includes('(з) Счёт на Тариф основателя действует 5 рабочих дней с даты выставления.'));
  assert.ok(blok.includes('все 300 мест уже заняты') && blok.includes('10 рабочих дней'));
  assert.ok(/osnovatel: "[^"]*Место основателя — при наличии свободного места на дату зачисления \(п\. 3\.8 оферты\)/.test(chitat('js/schet.js')));
});
