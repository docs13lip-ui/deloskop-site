// Справочник «Коды статуса компании в ЕГРЮЛ» (statusy-egryul-v1, [Ночные-3] 03.10.2026).
// Запуск: node --test tests/statusy_egryul.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/statusy-egryul.json'), 'utf8'));
const STR = fs.readFileSync(path.join(KOREN, 'nalogi/kody-statusa-egryul/index.html'), 'utf8');
const plain = (t) => t.replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('справочник: коды трёхзначные, без повторов, у каждого — группа из списка и расшифровка', () => {
  const gr = new Set(D.gruppy.map((g) => g.id));
  const vid = new Set();
  assert.ok(D.kody.length >= 60, 'кодов ' + D.kody.length);
  for (const k of D.kody) {
    assert.match(k.kod, /^\d{3}$/);
    assert.ok(!vid.has(k.kod), 'повтор ' + k.kod);
    vid.add(k.kod);
    assert.ok(gr.has(k.gruppa), k.kod + ': группа ' + k.gruppa);
    assert.ok(k.nazvanie && k.nazvanie.length > 5, k.kod + ': нет расшифровки');
  }
});

test('группы совпадают с кодами сайта: исключение 105–108, 110; исключена 407, 414, 415, 418, 420 (js/dinamika.js)', () => {
  const po = (g) => D.kody.filter((k) => k.gruppa === g).map((k) => k.kod).sort().join(',');
  assert.strictEqual(po('isklyuchenie'), '105,106,107,108,110');
  assert.strictEqual(po('isklyuchena'), '407,414,415,418,420');
  const din = fs.readFileSync(path.join(KOREN, 'js/dinamika.js'), 'utf8');
  assert.ok(din.includes("var ISKL = { '105': 1, '106': 1, '107': 1, '108': 1, '110': 1 }"));
  assert.ok(din.includes("var ISKLYUCHENA = { '407': 1, '414': 1, '415': 1, '418': 1, '420': 1 }"));
});

test('«Что сделать» — только утверждённые тексты [Право]: дословно из data/kommentarii.json', () => {
  const K = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/kommentarii.json'), 'utf8'));
  const ton = (id) => K.signaly.filter((s) => s.id === id)[0].tony.kras;
  const zhdem = {
    // «Новый договор не заключайте.» из sdelat убран: то же сказано в bank (✎ [Право] 03.10 23:50)
    isklyuchena: ton('isklyuchena').bank + ' ' + ton('isklyuchena').sdelat.replace('Новый договор не заключайте. ', ''),
    likvidaciya: ton('likvidaciya').bank + ' ' + ton('likvidaciya').sdelat,
    bankrotstvo: ton('bankrotstvo').bank + ' ' + ton('bankrotstvo').sdelat
  };
  for (const g of D.gruppy) {
    if (zhdem[g.id]) assert.strictEqual(g.sdelat, zhdem[g.id], g.id);
    if (g.sdelat) assert.ok(g.norma, g.id + ': нет нормы');
  }
  const iskl = D.gruppy.filter((g) => g.id === 'isklyuchenie')[0].sdelat;
  assert.ok(iskl.startsWith('Новых авансов не платите.') && iskl.includes('Дату публикации проверьте на vestnik-gosreg.ru.'));
  // у реорганизации и прочих — без советов
  for (const id of ['reorganizaciya', 'izmeneniya', 'prekrashchena', 'prekr_reorg', 'nedejstvitelna']) {
    assert.strictEqual(D.gruppy.filter((g) => g.id === id)[0].sdelat, null, id);
  }
});

test('страница собрана из JSON, каждый код — с якорем #kNNN', () => {
  execFileSync('python3', [path.join(KOREN, 'tests/sobrat_statusy.py'), '--check']);
  for (const k of D.kody) assert.ok(STR.includes('<tr id="k' + k.kod + '">'), 'нет #k' + k.kod);
});

test('источник, лицензия копии и дата сверки; сверке не больше 120 дней', () => {
  assert.ok(STR.includes('ММВ-7-6/433@'));
  assert.ok(STR.includes('https://github.com/hflabs/party-state') && /CC&nbsp;BY-SA&nbsp;4\.0/.test(STR));
  assert.ok(STR.includes('href="/data/statusy-egryul.json"'));
  const dni = (Date.now() - Date.parse(D.istochnik.data_sverki)) / 864e5;
  assert.ok(dni <= 120, 'справочник сверяли ' + Math.round(dni) + ' дн. назад — пересверьте (data/statusy-egryul.json, istochnik.pravilo)');
});

test('без обещаний исхода и превосходных степеней; есть входящие ссылки и sitemap', () => {
  const t = plain(STR).toLowerCase();
  for (const z of ['гарантир', 'лучш', 'самый ', 'надёжн', 'точно не', ' ии ', 'нейросет', 'искусственн']) assert.ok(!t.includes(z), 'слово «' + z + '»');
  assert.ok(fs.readFileSync(path.join(KOREN, 'nalogi/index.html'), 'utf8').includes('href="/nalogi/kody-statusa-egryul/"'), 'нет карточки в хабе /nalogi/');
  assert.ok(fs.readFileSync(path.join(KOREN, 'sitemap.xml'), 'utf8').includes('https://deloskop.ru/nalogi/kody-statusa-egryul/'));
  assert.ok(!/ /.test(STR), 'сырой NBSP — пишем &nbsp;');
});
