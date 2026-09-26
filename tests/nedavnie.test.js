// Пустые состояния (дизайн-система §3.9) и «Недавние проверки» — п. 27 (г, д).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function sandbox(store, broken) {
  const ls = broken
    ? { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }
    : { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const w = { localStorage: ls };
  vm.runInNewContext(read('js/nedavnie.js'), { window: w, JSON, Date, String, Array });
  return w.Nedavnie;
}

test('Nedavnie: новые сверху, без повторов, не больше 5', () => {
  const store = {}, N = sandbox(store);
  for (let i = 0; i < 7; i++) N.add({ inn: '77070838' + (10 + i), name: 'ООО ' + i, level: 'low' });
  N.add({ inn: '7707083812', name: 'ООО 2 снова', level: 'high', id: 'abcDEF12' });
  const a = N.list();
  assert.strictEqual(a.length, 5);
  assert.strictEqual(a[0].inn, '7707083812');
  assert.strictEqual(a[0].level, 'high');
  assert.strictEqual(a[0].id, 'abcDEF12');
  assert.strictEqual(a.filter((x) => x.inn === '7707083812').length, 1);
});

test('Nedavnie: мусор и пример 0000000000 не сохраняются, чужой id и уровень отбрасываются', () => {
  const store = {}, N = sandbox(store);
  N.add({ inn: '0000000000', name: 'ООО «Пример»' });
  N.add({ inn: '123', name: 'x' });
  N.add(null);
  N.add({ inn: '500100732259', name: 'ИП', level: 'evil', id: '"><script>' });
  const a = N.list();
  assert.strictEqual(a.length, 1);
  assert.strictEqual(a[0].level, '');
  assert.strictEqual(a[0].id, '');
});

test('Nedavnie: без доступа к хранилищу не падает', () => {
  const N = sandbox({}, true);
  assert.doesNotThrow(() => N.add({ inn: '7707083893', name: 'ПАО' }));
  assert.deepStrictEqual(Array.from(N.list()), []);
});

test('Nedavnie: испорченные данные в хранилище → пустой список', () => {
  const N = sandbox({ dlk_nedavnie: '{не json' });
  assert.deepStrictEqual(Array.from(N.list()), []);
});

test('report.html: пустое состояние «Кого проверим?» с полем ИНН и без извинений', () => {
  const s = read('report.html');
  assert.match(s, /<h1 class="pusto__h"[^>]*>Кого проверим\?<\/h1>/);
  assert.match(s, /id="pustoInn"[^>]*inputmode="numeric"/);
  assert.match(s, /\/js\/nedavnie\.js/);
  assert.match(s, /\/css\/pusto\.css/);
  assert.match(s, />Повторить</);
  assert.doesNotMatch(s, /Упс|извините|Извините/);
  assert.match(s, /Nedavnie\.add\(/);
});

test('index.html: успешная проверка пишется в «Недавние»', () => {
  const s = read('index.html');
  assert.match(s, /Nedavnie\.add\(\{inn:c\.inn/);
  assert.match(s, /<script src="\/js\/nedavnie\.js" defer><\/script>/);
});

test('cabinet.html: «Проверить» — primary у вошедшего, поле ИНН, «Повторить», что работает без входа', () => {
  const s = read('cabinet.html');
  assert.match(s, /\$\('goCheck'\)\.className='btn primary'/);
  assert.match(s, /id="fCheck"[\s\S]{0,400}class="btn primary" type="submit">Проверить/);
  assert.match(s, /textContent='Повторить'/);
  assert.match(s, /Без входа работают 3 проверки в день/);
  // скрипт «Недавних» подключён до основного, иначе на тестовом адресе showLogin() его не увидит
  assert.ok(s.indexOf('/js/nedavnie.js') < s.indexOf("$('fCheck').onsubmit"));
});
