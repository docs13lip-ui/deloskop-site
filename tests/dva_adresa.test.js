// dva-adresa-v1 (решение владельца 16.11 «везде дублировать адрес делоскоп.рф»): сторож второго адреса.
// Правило: «deloskop.ru · делоскоп.рф» — оба рядом, латинский первым. Основной адрес для поиска — deloskop.ru:
// canonical, og:url, sameAs, "url" и "@id" разметки делоскоп.рф не содержат.
// Запуск: node --test tests/dva_adresa.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const PARA = 'deloskop.ru · делоскоп.рф';
const podval = (t) => (t.match(/<!--podval-->[\s\S]*?<!--\/podval-->/) || [''])[0];

test('подвал: оба адреса, латинский первым, в строке «© 2026 Делоскоп»', () => {
  for (const f of ['index.html', 'rekvizity/index.html', 'o-proekte/index.html', 'tarify/index.html']) {
    const p = podval(chitat(f)).replace(/&nbsp;| /g, ' ');
    assert.ok(p.includes('© 2026 Делоскоп · ' + PARA), f + ': в подвале нет «' + PARA + '» — python3 tests/sobrat_shapku.py');
  }
  assert.ok(chitat('tests/sobrat_shapku.py').includes('stroka = "© 2026 Делоскоп · ' + PARA + '"'), 'источник подвала — сборщик');
});

test('реквизиты и «О проекте» — строка «Сайт»', () => {
  assert.match(chitat('rekvizity/index.html'), /<tr><td>Сайт<\/td><td><a href="https:\/\/deloskop\.ru\/">deloskop\.ru<\/a> · делоскоп\.рф<\/td><\/tr>/);
  assert.ok(chitat('o-proekte/index.html').includes('<p class="svyaz__sajt">Сайт: ' + PARA + '</p>'));
});

test('печатные документы: Паспорт, Досье сделки, письма и счета админки', () => {
  for (const f of ['pasport/kontragent/index.html', 'pasport/proverka/index.html']) {
    assert.ok(chitat(f).includes('@bottom-left{content:"Делоскоп · Паспорт контрагента · ' + PARA + '"'), f + ': колонтитул печати');
  }
  assert.ok(chitat('report.html').includes('<br>Делоскоп · ' + PARA + '</div>'), 'report.html: низ документа');
  const adm = chitat('js/admin-dokumenty.js');
  const n = adm.split('help@deloskop.ru · ' + PARA).length - 1;
  assert.ok(n >= 4, 'admin-dokumenty.js: шапки, низ и подпись писем — с двумя адресами, найдено ' + n);
  assert.ok(!/help@deloskop\.ru · deloskop\.ru(?! · делоскоп\.рф)/.test(adm), 'admin-dokumenty.js: остался один адрес');
});

test('разметка для поиска — только deloskop.ru', () => {
  for (const f of ['index.html', 'rekvizity/index.html', 'o-proekte/index.html', 'report.html']) {
    const t = chitat(f);
    const ld = (t.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []).join('');
    assert.ok(!/делоскоп\.рф|xn--d1acpdpbhn/.test(ld), f + ': делоскоп.рф в JSON-LD');
    const head = (t.match(/<head>[\s\S]*?<\/head>/) || [''])[0].replace(/<script[\s\S]*?<\/script>/g, '');
    assert.ok(!/(canonical|og:url)[^>]*(делоскоп\.рф|xn--d1acpdpbhn)/.test(head), f + ': второй адрес в canonical/og:url');
  }
});
