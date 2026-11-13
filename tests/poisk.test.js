// Строка, которая понимает (poisk-v2-a, решение владельца 13.11.2026 «Поиск нового поколения»): js/poisk.js + главная.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const P = require('../js/poisk.js');

const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const RAZ = JSON.parse(chitat('data/poisk-razdely.json')).razdely;
const razbor = (q) => P.razobrat(q, RAZ);
const pervoe = (R) => R.rows[P.pervoe(R.rows)];

test('ИНН организации и ИП: контрольная цифра, первое действие — проверка', () => {
  let R = razbor('7707083893');
  assert.strictEqual(R.vid, 'inn'); assert.strictEqual(R.chip, 'ИНН организации'); assert.ok(R.exact && !R.err);
  assert.strictEqual(pervoe(R).inn, '7707083893');
  assert.ok(R.rows.some((r) => r.href === '/pasport/kontragent/?inn=7707083893'));
  R = razbor('500100732259');
  assert.strictEqual(R.vid, 'inn_ip'); assert.match(R.hint, /только сведения реестра/);
  assert.ok(!R.rows.some((r) => /Паспорт/.test(r.t)), 'Паспорт — только организациям');
  R = razbor('7707083894');
  assert.ok(R.err); assert.strictEqual(R.chip, 'ИНН с опечаткой'); assert.strictEqual(P.pervoe(R.rows), -1, 'опечатка — Enter ничего не открывает');
  assert.match(razbor('7707 083 893').chip, /ИНН организации/, 'ИНН с пробелами из договора');
});

test('мало цифр, КПП, ОГРН, БИК, счёт — называет, что это и чего не хватает', () => {
  assert.match(razbor('770708').hint, /10 цифр\s— сейчас 6/);
  assert.strictEqual(razbor('123').vid, 'malo_cifr', 'короткие цифры — не в подсказки ЕГРЮЛ');
  assert.strictEqual(razbor('770701001').vid, 'kpp');
  assert.strictEqual(razbor('1027700132195').vid, 'ogrn');
  assert.strictEqual(razbor('1027700132196').vid, 'ogrn_oshibka');
  assert.strictEqual(razbor('044525225').vid, 'bik');
  const R = razbor('40702810000000000001');
  assert.strictEqual(R.vid, 'schet');
  assert.ok(R.rows.some((r) => r.t === 'Принадлежность счёта поставщику не подтверждается'), 'правило [Право] 27.09 п. 6.2');
});

test('кусок счёта целиком: счёт + БИК + ИНН → «Проверить счёт», проверка ИНН и строка о принадлежности', () => {
  const kusok = P.PRIMERY.find((p) => p[0] === 'Кусок счёта')[1];
  assert.doesNotMatch(kusok, /ООО|ПАО|АО\s/, 'в примере нет названия — не смешиваем название и ИНН');
  assert.ok(kusok.includes(P.PRIMER_INN));
  const R = razbor(kusok);
  assert.strictEqual(R.vid, 'schet_bik'); assert.ok(R.exact); assert.strictEqual(R.chip, 'Счёт и БИК: ключ сходится');
  assert.strictEqual(pervoe(R).href, '/proverit-schet/');
  assert.ok(R.rows.some((r) => r.inn === P.PRIMER_INN));
  assert.ok(R.rows.some((r) => /Принадлежность счёта поставщику не подтверждается/.test(r.t)));
  const plohoj = kusok.replace(/(\d{19})(\d)/, (m, a, b) => a + ((+b + 1) % 10));
  assert.ok(razbor(plohoj).err, 'ключ не сходится — опечатка');
  assert.strictEqual(P.vstavka('Поставщик\nИНН 7707083893\r\nКПП\t770701001'), 'Поставщик ИНН 7707083893 КПП 770701001');
  assert.strictEqual(razbor('ИНН 7707083893 КПП 770701001').vid, 'inn_kpp');
  assert.strictEqual(razbor('ПАО Сбербанк ИНН 7707083893').vid, 'rekvizity');
});

test('раскладка, название, вопрос словами', () => {
  let R = razbor('c,th,fyr');
  assert.strictEqual(R.vid, 'raskladka'); assert.strictEqual(R.nazvanie, 'сбербанк');
  assert.strictEqual(pervoe(R).q, 'сбербанк', 'Enter — «Проверить «сбербанк»», а не английский текст');
  R = razbor('ромашка');
  assert.strictEqual(R.vid, 'nazvanie'); assert.strictEqual(R.nazvanie, 'ромашка');
  R = razbor('банк запросил документы');
  assert.strictEqual(R.rows.find((r) => r.razdel).href, '/skoraya-115-fz/');
  R = razbor('как снять наличные?');
  assert.strictEqual(R.vid, 'vopros'); assert.strictEqual(R.nazvanie, '', 'вопрос — не в ЕГРЮЛ');
  assert.strictEqual(pervoe(R).href, '/nalichnye/');
});

test('порядок: действие → компании → разделы; с компаниями «Проверить «текст»» уходит', () => {
  const R = razbor('банк запросил документы');
  const k = P.stroki([{ inn: '7707083893', name: 'ПАО СБЕРБАНК', address: '117312, г Москва, ул Вавилова, д 19', status: 'ACTIVE' },
    { inn: '500100732259', name: 'ИП Тест', address: 'г Москва' }, { inn: '1234567890', name: 'ООО "Закрыто"', status: 'LIQUIDATED', god_s: 2008, god_po: 2023, okved_tekst: 'Торговля оптовая пищевыми продуктами, напитками и табачными изделиями' }]);
  assert.strictEqual(k.length, 2, 'ИП в списке нет — только организации');
  assert.strictEqual(k[0].s, 'Москва · ИНН 7707083893');
  assert.strictEqual(k[1].tag, 'ликвидирована');
  assert.match(k[1].s, /2008–2023/); assert.match(k[1].s, /…/, 'вид деятельности — до 38 знаков');
  const vse = P.sobrat(R, k);
  assert.strictEqual(vse[0].inn, '7707083893');
  assert.ok(!vse.some((r) => r.q), '«Проверить «текст»» не нужна, когда есть компании');
  assert.ok(vse[vse.length - 1].razdel);
  assert.strictEqual(P.sobrat(R, [])[0].q, 'банк запросил документы');
});

test('«скоро» — словами, без внутренней кухни; ФИО не печатаем; телефон — скоро', () => {
  for (const q of ['Иванов Иван Иванович', 'А40-123456/2026', 'yandex.ru', 'info@firma.ru', '+7 (495) 123-45-67']) {
    const R = razbor(q);
    assert.ok(R.rows.some((r) => r.tag === 'скоро'), q);
    const vse = JSON.stringify(R);
    assert.doesNotMatch(vse, /юрист|выкладк|сервер/i, q);
  }
  const f = razbor('Иванов Иван Иванович');
  assert.strictEqual(f.vid, 'rukovoditel');
  assert.ok(!f.rows.some((r) => r.t.includes('Иванов') && r.tag === 'скоро'), 'ФИО в строке «скоро» не печатаем');
  assert.strictEqual(razbor('+7 (495) 123-45-67').vid, 'telefon');
});

test('разметка списка: что распознано, группы, Enter — только у выбранной, экранирование', () => {
  const R = razbor('7707083893'), h = P.html(R, R.rows, 0);
  assert.match(h, /class="ps-seen"/); assert.match(h, /ИНН организации/);
  assert.strictEqual((h.match(/Enter ↵/g) || []).length, 1);
  assert.match(h, /role="option" id="ps0"[^>]*aria-selected="true"/);
  const x = P.html({ chip: '<b>', hint: '"' }, [{ g: 'A', t: '<img>', s: '&', inn: '1' }], 0);
  assert.doesNotMatch(x, /<img>|<i><\/i><b>/);
  const p = P.htmlPusto([{ inn: '7707083893', name: 'ПАО «Сбербанк»' }, { inn: '500100732259', name: 'ИП' }]);
  assert.match(p, /Недавние на этом устройстве/); assert.doesNotMatch(p, /500100732259/, 'ИП в недавних не показываем');
  assert.ok(P.PRIMERY.every((x) => !/!|₽/.test(x[0] + x[1])));
});

test('разделы: файл собран сборщиком, все адреса есть на сайте', () => {
  execFileSync('python3', [path.join(KOREN, 'tests/sobrat_poisk.py'), '--check'], { cwd: KOREN });
  assert.ok(RAZ.length >= 15);
  for (const r of RAZ) {
    const f = r.u === '/' ? 'index.html' : r.u.replace(/^\//, '') + 'index.html';
    assert.ok(fs.existsSync(path.join(KOREN, f)), r.u);
    assert.ok(r.t && r.s && r.k, r.u);
  }
});

test('главная: строка подключена; текст запроса не в адрес, не в Метрику; /politika/ — строки юриста', () => {
  const g = chitat('index.html');
  assert.match(g, /placeholder="ИНН, название или реквизиты из счёта"/);
  assert.match(g, /dlkGoal\('poisk_tip',\{vid:PR\.vid\}\)/, 'в Метрику — только вид');
  assert.doesNotMatch(g, /history\.(push|replace)State\([^)]*(input\.value|q\b)/, 'текст запроса не в адрес');
  assert.match(g, /location\.href=r\.href/, 'разделы — в этой же вкладке');
  assert.doesNotMatch(chitat('js/poisk.js'), /localStorage\.setItem|sessionStorage|target="_blank"/, 'запрос не храним');
  const sb = JSON.parse(chitat('partials/sborka.json'));
  assert.ok(sb.pakety.glavnaya.includes('js/poisk.js'));
  const pol = chitat('politika/index.html');
  assert.ok(pol.includes('ИНН компании или текст, который вы&nbsp;ввели в&nbsp;строку поиска'));
  assert.ok(pol.includes('показываем действующих индивидуальных предпринимателей из&nbsp;ЕГРИП и&nbsp;организации, где этот человек сейчас указан в&nbsp;ЕГРЮЛ руководителем или участником. Текст запроса не&nbsp;храним.'), '/politika/ — строка «Поиск» [Право] ✎ 8 п. 7');
  assert.doesNotMatch(pol, /Индивидуальных предпринимателей по&nbsp;ФИО не&nbsp;ищем/);
  assert.doesNotMatch(pol, /только ИНН компании для&nbsp;получения сведений/);
  assert.doesNotMatch(chitat('js/poisk.js'), /искусствен|нейросет|лучш|гарантир/i);
});
