// Перечень недружественных государств — распоряжение Правительства РФ № 430-р (nedruzh-430r-v1, [Ночные-3] 10.10.2026).
// Запуск: node --test tests/nedruzhestvennye.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/nedruzhestvennye-430r.json'), 'utf8'));
const OF = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/ofshory-minfin.json'), 'utf8'));
const STR = fs.readFileSync(path.join(KOREN, 'nalogi/nedruzhestvennye-gosudarstva-perechen/index.html'), 'utf8');
const plain = (t) => t.replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
global.window = global.window || {};
require(path.join(KOREN, 'js/nedruzhestvennye.js'));
const N = global.window.dlkNedruzh;

test('перечень: 23 строки по порядку приложения, без повторов; Багамы — с 23.07.2022 (№ 2018-р), Великобритания — ред. № 3216-р', () => {
  assert.strictEqual(D.spisok.length, 23);
  D.spisok.forEach((x, i) => assert.strictEqual(x.n, i + 1));
  assert.strictEqual(new Set(D.spisok.map((x) => x.nazvanie)).size, 23);
  assert.strictEqual(D.spisok[0].nazvanie, 'Австралия');
  assert.strictEqual(D.spisok[22].nazvanie, 'Япония');
  const bag = D.spisok.find((x) => x.vveden);
  assert.strictEqual(bag.nazvanie, 'Багамские Острова');
  assert.ok(bag.vveden.data === '2022-07-23' && bag.vveden.dokument.includes('2018-р'));
  const gb = D.spisok.find((x) => x.redakciya);
  assert.ok(gb.nazvanie.startsWith('Великобритания (включая коронные владения') && gb.redakciya.includes('3216-р'));
  const es = D.spisok.find((x) => x.chleny_es);
  assert.strictEqual(es.nazvanie, 'Государства - члены Европейского союза');
  assert.strictEqual(es.chleny_es.length, 27);
  assert.ok(es.chleny_es_pometka.includes('в самом распоряжении названий стран ЕС нет'));
});

test('проверка страны: официальные и короткие названия, страны ЕС, британские территории; не нашли — так и пишем', () => {
  const p = (q) => N.najti(D.spisok, q).tochno.map((r) => r.x.n);
  assert.deepStrictEqual(p('США'), [18]);
  assert.deepStrictEqual(p('Соединённые Штаты Америки'), [18]);
  assert.deepStrictEqual(p('германия'), [6]);
  assert.deepStrictEqual(p('Кипр'), [6]);
  assert.deepStrictEqual(p('Джерси'), [5]);
  assert.deepStrictEqual(p('Багамы'), [4]);
  assert.deepStrictEqual(p('Южная Корея'), [14]);
  assert.strictEqual(p('Казахстан').length, 0);
  assert.strictEqual(p('ОАЭ').length, 0);
  assert.strictEqual(p('Китай').length, 0, 'строка «Тайвань (Китай)» не должна находиться по «Китай»');
  const de = plain(N.otvet(D.spisok, 'Германия', OF.spisok));
  assert.ok(de.includes('строка 6') && de.includes('Германия — член Европейского союза'), de);
  assert.ok(de.includes('Перечень говорит о государстве, а не о конкретной компании'), de);
  // [Право · Юрист 115-ФЗ] 11.10: без этой строки «говорит о государстве» обещает больше, чем есть
  assert.ok(de.includes('Особый порядок может касаться и российских компаний, которые контролируют лица из этих государств.'), de);
  assert.ok(plain(STR).includes('конкретной компании. Особый порядок может касаться и российских компаний, которые контролируют лица из этих государств.'));
  const net = plain(N.otvet(D.spisok, 'Казахстан', OF.spisok));
  assert.ok(net.includes('в перечне не нашли') && !/дружествен(ная|ное)|можно работать|безопасн/.test(net), net);
  assert.ok(!N.otvet(D.spisok, '<img>', OF.spisok).includes('<img>'), 'ввод экранируется');
});

test('заодно — перечень офшорных зон Минфина: Кипр в обоих, ОАЭ (исключены) — нет', () => {
  const kipr = plain(N.otvet(D.spisok, 'Кипр', OF.spisok));
  assert.ok(kipr.includes('перечне офшорных зон Минфина') && kipr.includes('пункт 49'), kipr);
  assert.ok(!plain(N.otvet(D.spisok, 'ОАЭ', OF.spisok)).includes('офшорных зон Минфина, пункт'));
  assert.ok(!plain(N.otvet(D.spisok, 'Германия', null)).includes('офшорных'), 'без файла офшоров — без строки');
});

test('страница собрана из JSON, у каждой строки — якорь #pN; FAQ дословно; скрипт подключён', () => {
  execFileSync('python3', [path.join(KOREN, 'tests/sobrat_nedruzh.py'), '--check']);
  for (const x of D.spisok) assert.ok(STR.includes('<tr id="p' + x.n + '"'), 'нет #p' + x.n);
  assert.ok(STR.includes('Государства&nbsp;— члены Европейского союза'));
  assert.ok(STR.includes('<script src="/js/nedruzhestvennye.js" defer></script>'));
  assert.ok(!STR.includes('/js/ofshory.js'));
  assert.ok(STR.includes('<!--faq-->') && STR.includes('"FAQPage"'));
});

test('источник и дата сверки; сверке не больше 120 дней', () => {
  assert.ok(D.istochnik.rasporyazhenie.includes('№ 430-р') && D.istochnik.osnovanie.includes('№ 95'));
  assert.ok(D.istochnik.redakciya.includes('29.10.2022'));
  assert.ok(STR.includes('https://www.consultant.ru/document/cons_doc_LAW_411064/'));
  assert.ok(STR.includes('href="/data/nedruzhestvennye-430r.json"'));
  const dni = (Date.now() - Date.parse(D.istochnik.data_sverki)) / 864e5;
  assert.ok(dni <= 120, 'перечень сверяли ' + Math.round(dni) + ' дн. назад — пересверьте (data/nedruzhestvennye-430r.json, istochnik.pravilo)');
});

test('до «да» [Право]: noindex, не в sitemap и не в хабе; без обещаний исхода и превосходных степеней; без сырых NBSP', () => {
  assert.ok(STR.includes('<meta name="robots" content="noindex, follow">'), 'страница ждёт «да» [Право] — пока noindex');
  assert.ok(!fs.readFileSync(path.join(KOREN, 'sitemap.xml'), 'utf8').includes('nedruzhestvennye-gosudarstva-perechen'));
  const t = plain(STR).toLowerCase();
  for (const z of ['гарантир', 'лучш', 'самый ', 'надёжн', 'точно не', ' ии ', 'нейросет', 'искусственн', 'санкци', 'запрещ', 'разрешени']) assert.ok(!t.includes(z), 'слово «' + z + '»');
  assert.ok(!/\u00a0/.test(STR), 'сырой NBSP — пишем &nbsp;');
  assert.ok(!/\u00a0/.test(fs.readFileSync(path.join(KOREN, 'js/nedruzhestvennye.js'), 'utf8')));
});
