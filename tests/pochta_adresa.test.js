// pochta-adresa-v1: у каждого вопроса — свой адрес; чужих и выдуманных адресов на сайте нет
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const ADRESA = ['help@deloskop.ru', 'sales@deloskop.ru', 'partner@deloskop.ru', 'buh@deloskop.ru'];

test('«Реквизиты и контакты»: четыре адреса, у каждого — для чего он', () => {
  const t = chitat('rekvizity/index.html');
  const blok = t.slice(t.indexOf('<h2>Как с нами связаться</h2>'), t.indexOf('<!--podval-->'));
  for (const a of ADRESA) assert.ok(blok.includes('mailto:' + a), 'нет адреса ' + a);
  for (const s of ['Вопросы, счета, акты, возврат', 'Подключение компании', 'Партнёрам', 'Бухгалтерии', 'передадим сами']) {
    assert.ok(blok.includes(s), 'нет строки: ' + s);
  }
});

test('подвал: вопросы — help@, сотрудничество — partner@; источник — сборщик', () => {
  const s = chitat('tests/sobrat_shapku.py');
  assert.ok(s.includes('mailto:partner@deloskop.ru') && s.includes('mailto:help@deloskop.ru'));
  for (const f of ['index.html', 'tarify/index.html', 'indeks/index.html']) {
    const p = chitat(f).match(/<!--podval-->[\s\S]*?<!--\/podval-->/)[0];
    assert.ok(p.includes('mailto:partner@deloskop.ru'), f);
  }
});

test('«Стать партнёром» пишет на partner@', () => {
  assert.match(chitat('partneram/index.html'), /href="mailto:partner@deloskop\.ru\?subject=[^"]+" data-goal="partner_start"/);
});

test('в ссылках «написать» — только существующие ящики', () => {
  for (const f of ['index.html', 'rekvizity/index.html', 'partneram/index.html', 'tarify/index.html', 'o-proekte/index.html']) {
    const m = chitat(f).match(/mailto:[a-z0-9._-]+@deloskop\.ru/g) || [];
    for (const a of m) assert.ok(ADRESA.includes(a.slice(7)), f + ': ' + a);
  }
});
