// Перечень офшорных зон Минфина (ofshory-v1, [Ночные-3] 04.10.2026).
// Запуск: node --test tests/ofshory.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/ofshory-minfin.json'), 'utf8'));
const STR = fs.readFileSync(path.join(KOREN, 'nalogi/ofshornye-zony-perechen-minfina/index.html'), 'utf8');
const plain = (t) => t.replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
global.window = global.window || {};
require(path.join(KOREN, 'js/ofshory.js'));
const O = global.window.dlkOfshory;

test('перечень: пункты 1–91 по порядку, без повторов; действуют 90, п. 38 (ОАЭ) — утратил силу с 01.01.2026', () => {
  assert.strictEqual(D.spisok.length, 91);
  D.spisok.forEach((x, i) => {
    assert.strictEqual(x.n, i + 1);
    assert.ok(x.nazvanie && x.nazvanie.length > 3, 'пункт ' + x.n);
  });
  assert.strictEqual(new Set(D.spisok.map((x) => x.nazvanie)).size, 91);
  const isk = D.spisok.filter((x) => x.status !== 'dejstvuet');
  assert.deepStrictEqual(isk.map((x) => x.n), [38]);
  assert.strictEqual(isk[0].isklyuchen_s, '2026-01-01');
  assert.ok(isk[0].isklyuchen_prikaz.includes('187н'));
});

test('проверка страны: короткие и официальные названия, регистр и «ё»; не нашли — так и пишем', () => {
  const p = (q) => O.najti(D.spisok, q).tochno.map((x) => x.n);
  assert.deepStrictEqual(p('Кипр'), [49]);
  assert.deepStrictEqual(p('республика кипр'), [49]);
  assert.deepStrictEqual(p('США'), [76]);
  assert.deepStrictEqual(p('Соединённые Штаты Америки'), [76]);
  assert.deepStrictEqual(p('ОАЭ'), [38]);
  assert.deepStrictEqual(p('остров Мэн'), [42]);
  assert.strictEqual(p('Казахстан').length, 0);
  const t = plain(O.otvet(D.spisok, 'ОАЭ'));
  assert.ok(t.includes('Исключены из перечня с 1 января 2026'), t);
  assert.ok(plain(O.otvet(D.spisok, 'Кипр')).includes('пункт 49'));
  const net = plain(O.otvet(D.spisok, 'Казахстан'));
  assert.ok(net.includes('в перечне не нашли') && !/нет в перечне|не офшор/.test(net), net);
  assert.ok(!O.otvet(D.spisok, '<img>').includes('<img>'), 'ввод экранируется');
});

test('страница собрана из JSON, у каждого пункта — якорь #pN', () => {
  execFileSync('python3', [path.join(KOREN, 'tests/sobrat_ofshory.py'), '--check']);
  for (const x of D.spisok) assert.ok(STR.includes('<tr id="p' + x.n + '"'), 'нет #p' + x.n);
  assert.ok(STR.includes('class="of-t__isk"'));
  assert.ok(STR.includes('<script src="/js/ofshory.js" defer></script>'));
});

test('источник и дата сверки; сверке не больше 120 дней', () => {
  assert.ok(D.istochnik.prikaz.includes('86н') && D.istochnik.redakciya.includes('187н'));
  assert.ok(STR.includes('https://base.garant.ru/407043582/'));
  assert.ok(STR.includes('https://www.consultant.ru/law/hotdocs/92322.html'));
  assert.ok(STR.includes('href="/data/ofshory-minfin.json"'));
  const dni = (Date.now() - Date.parse(D.istochnik.data_sverki)) / 864e5;
  assert.ok(dni <= 120, 'перечень сверяли ' + Math.round(dni) + ' дн. назад — пересверьте (data/ofshory-minfin.json, istochnik.pravilo)');
});

test('без обещаний исхода и превосходных степеней; хаб, sitemap, без сырых NBSP', () => {
  const t = plain(STR).toLowerCase();
  for (const z of ['гарантир', 'лучш', 'самый ', 'надёжн', 'точно не', ' ии ', 'нейросет', 'искусственн', 'мошенни']) assert.ok(!t.includes(z), 'слово «' + z + '»');
  assert.ok(fs.readFileSync(path.join(KOREN, 'nalogi/index.html'), 'utf8').includes('href="/nalogi/ofshornye-zony-perechen-minfina/"'), 'нет карточки в хабе /nalogi/ — запустите posle_ofshory_v1.py');
  assert.ok(fs.readFileSync(path.join(KOREN, 'sitemap.xml'), 'utf8').includes('https://deloskop.ru/nalogi/ofshornye-zony-perechen-minfina/'));
  assert.ok(!/\u00a0/.test(STR), 'сырой NBSP — пишем &nbsp;');
});
