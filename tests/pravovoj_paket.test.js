// Правовой пакет ИП (п. 51 (е), claude/ИП_правовой_пакет_v1.md, раздел 14) — 26.09.2026.
// Партнёры, цель 6 политики, п. 6.2/6.6/6.7/10.3 оферты — claude/Юрист115_pravo-v1_партнёры_Термометр_карточки_26.09.md.
// Формулировки юриста 115-ФЗ закреплены тестом: менять только через [Юрист 115-ФЗ].
// Запуск: node --test tests/pravovoj_paket.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const bezTegov = t => t.replace(/<[^>]+>/g, '').replace(/&#8209;/g, '‑').replace(/&nbsp;/g, ' ');
const skolko = (s, f) => s.split(f).length - 1;
const DOKI = ['oferta', 'politika', 'soglasie', 'rassylki', 'cookies', 'partneram/usloviya', 'vozvrat', 'rekvizity'];

test('страницы пакета: title ≤ 70, description ≤ 160, canonical, JSON-LD, sitemap, без noindex и своих стилей', () => {
  const sitemap = chitat('sitemap.xml');
  for (const d of DOKI) {
    const t = chitat(d + '/index.html');
    const title = t.match(/<title>([^<]*)<\/title>/)[1];
    const desc = t.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.ok(title.length <= 70, d + ' title ' + title.length);
    assert.ok(desc.length <= 160, d + ' description ' + desc.length);
    assert.ok(t.includes(`<link rel="canonical" href="https://deloskop.ru/${d}/">`), d + ' canonical');
    JSON.parse(t.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.ok(!/noindex/.test(t), d + ' noindex');
    assert.ok(sitemap.includes(`<loc>https://deloskop.ru/${d}/</loc>`), d + ' нет в sitemap');
    assert.ok(t.includes('/css/ds.css') && (d === 'cookies' || !/<style/.test(t)), d + ' — только ds.css');
    assert.strictEqual((t.match(/<h1[\s>]/g) || []).length, 1, d + ' — один h1');
    assert.ok(t.includes('href="/partneram/usloviya/"') && t.includes('href="/rassylki/"'), d + ' — список документов');
  }
});

test('в подвале — все документы и строка help@ 24/7; запрещённых обещаний нет', () => {
  const p = chitat('index.html').match(/<!--podval-->[\s\S]*?<!--\/podval-->/)[0];
  for (const u of ['/oferta/', '/politika/', '/soglasie/', '/rassylki/', '/cookies/', '/vozvrat/', '/partneram/usloviya/', '/rekvizity/']) {
    assert.ok(p.includes(`href="${u}"`), 'в подвале нет ' + u);
  }
  assert.ok(bezTegov(p).includes('Сотрудничество, отзывы и предложения — help@deloskop.ru. Принимаем 24/7'));
  for (const d of DOKI.concat(['.'])) {
    const s = bezTegov(chitat((d === '.' ? '' : d + '/') + 'index.html'));
    for (const r of [/поддержка 24\/7/i, /круглосуточн[а-я]* поддержк/i, /мониторим 24/i, /ответим за \d/i])
      assert.ok(!r.test(s), d + ': ' + r);
  }
});

test('оферта: раздел «Скорая под ключ» #skoraya и формулировки юриста', () => {
  const t = chitat('oferta/index.html');
  const s = bezTegov(t);
  assert.ok(/<h2 id="skoraya">5\. Услуга «Скорая под ключ»<\/h2>/.test(t), 'нет раздела 5 с id="skoraya"');
  for (const f of [
    'Услуга считается оказанной в момент выдачи Пакета',
    'Мы не представляем Пользователя, не подаём документы от его имени',
    'Решение банка, Банка России, комиссии или суда мы не гарантируем',
    'возврат за вычетом фактически понесённых нами расходов',
    'До начала формирования Пакета — возврат 100%',
    'Автопродление включается только отдельной галочкой при оплате картой (по умолчанию снята)',
    'не позднее чем за 3 дня',
    'п. 4.2 ст. 16.1 Закона «О защите прав потребителей»',
    'поручает нам обработку персональных данных третьих лиц',
    'простой неисключительной лицензии', 'п. 1 ст. 145 НК РФ', 'на дату открытия доступа',
    'по «Скорой под ключ» — на дату выдачи Пакета',
    'п. 1 ст. 450.1 ГК РФ',
    'Если Исполнитель станет плательщиком НДС',
    'ст. 37 АПК РФ; претензионный порядок — ч. 5 ст. 4 АПК РФ',
  ]) assert.ok(s.includes(f), 'в оферте нет: ' + f);
  assert.ok(t.includes('data-cena="skoraya_pod_klyuch"'), 'цена «Скорой» — через data-cena, из tarify.json');
  assert.ok(!/НДС 2[02]\s?%/.test(t));
  assert.ok(!/\[(ФИО|ИНН|ОГРНИП|адрес|город|дата)\]/.test(t), 'остался заполнитель в квадратных скобках');
  assert.ok(t.includes('<!--r:ispolnitel-->') && t.includes('<!--rekvizity-->'));
  for (const m of t.matchAll(/<ol class="toc">([\s\S]*?)<\/ol>/g)) {
    for (const a of m[1].matchAll(/href="#([^"]+)"/g)) assert.ok(t.includes(`id="${a[1]}"`), 'якорь #' + a[1]);
  }
});

test('«Скорая под ключ»: «Условия оферты» в карточке #paket ведут на /oferta/#skoraya', () => {
  const t = chitat('skoraya-115-fz/index.html');
  assert.ok(/<p class="pkg__cap">[^\n]*href="\/oferta\/#skoraya"/.test(t));
});

test('политика: 6 целей, цель 6 — партнёры всех типов, хранение в России, 24/72 часа', () => {
  const t = chitat('politika/index.html');
  const s = bezTegov(t);
  assert.strictEqual((t.match(/<h3 id="cel\d">\d\. /g) || []).length, 6, 'целей не 6');
  for (const f of ['п. 11 ч. 1 ст. 6 152-ФЗ', 'ч. 3 ст. 6 152-ФЗ', 'Трансграничной передачи нет',
    'в течение 24 часов', 'в течение 72 часов', 'без Вебвизора', 'Физлиц из выписок во внешние сервисы не передаём',
    'только перед первой выплатой', 'Социальному фонду России', 'срок договора + 6 лет'])
    assert.ok(s.includes(f), 'в политике нет: ' + f);
  assert.ok(t.includes('<!--r:ispolnitel-->') && t.includes('<!--rekvizity-->'));
});

test('согласия: ПДн — отдельно от оферты; рассылки — отдельная снятая галочка и подтверждение', () => {
  const s = bezTegov(chitat('soglasie/index.html'));
  assert.ok(s.includes('Согласие оформлено отдельно от оферты и политики (ч. 1 ст. 9 152-ФЗ)'));
  assert.ok(s.includes('ч. 5 ст. 21 152-ФЗ'));
  const r = bezTegov(chitat('rassylki/index.html'));
  assert.ok(r.includes('по умолчанию снята и не является условием оплаты'));
  assert.ok(r.includes('«Подтвердить подписку»'));
  assert.ok(r.includes('сервисные письма'));
});

test('партнёрам: все типы (гражданин, НПД, ИП/организация), услуги ст. 779, НДФЛ и НДС, реклама с erid', () => {
  const t = chitat('partneram/usloviya/index.html');
  const s = bezTegov(t);
  for (const f of ['ст. 779 ГК РФ', 'не агентский', 'до удержания налога', 'включают НДС', 'erid', '«Реклама»', '25%',
    'ч. 3 ст. 14 Федерального закона № 422-ФЗ', 'до 15‑го числа', 'гражданин, самозанятый', 'налоговый агент'])
    assert.ok(s.includes(f), 'в условиях партнёров нет: ' + f);
  for (const id of ['grazhdanin', 'npd', 'ip-org']) {
    assert.ok(t.includes(`<section id="${id}" data-partner-blok>`), 'нет блока #' + id);
    assert.ok(t.includes(`data-tip="${id}"`), 'нет кнопки ' + id);
  }
  assert.ok(t.includes('<script src="/js/partneram.js" defer></script>'));
  assert.ok(!s.includes('условия готовим'), 'старая строка «условия готовим»');
  assert.ok(!/гарантир(ую|уем)\s+разблок/i.test(s));
});

test('возврат: строки «Скорой под ключ» — по одному разу и совпадают с офертой п. 5.11', () => {
  const s = bezTegov(chitat('vozvrat/index.html'));
  for (const f of ['«Скорая под ключ» — до начала формирования пакета', '«Скорая под ключ» — после начала формирования, до выдачи', '«Скорая под ключ» — после выдачи пакета'])
    assert.strictEqual(skolko(s, f), 1, 'строка не один раз: ' + f);
  assert.ok(s.includes('за вычетом фактически понесённых нами расходов'));
  assert.ok(s.includes('п. 6.6 и 5.11 оферты'));
});

test('лента: запись 2026-09-26-13 про правовой пакет, id уникальны', () => {
  const d = JSON.parse(chitat('obnovleniya.json'));
  const e = d.obnovleniya.find(x => x.id === '2026-09-26-13');
  assert.ok(e && e.stranicy.some(s => s.url === '/oferta/'));
  const ids = d.obnovleniya.map(x => x.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});
