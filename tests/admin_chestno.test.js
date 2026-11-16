// admin-chestno-v1 — [Ночные запуски] 16.11.2026 (✎ Штаба 16.11, пп. 1 и 6).
// 1) Отказ одного блока админки (16.11: /api/admin/feedback — 404) не выдаётся за отказ входа: #denyText пуст,
//    админка открыта, в блоке «Отзывы» — «Список отзывов сейчас не загрузился». Вход решает только /api/admin/summary.
// 2) «Стена ВКонтакте»: «не подключена» / «подключена до …» / «не загрузилось», одна кнопка — переход на начало входа;
//    ключей и адресов возврата на странице нет.
// Запуск: node --test tests/admin_chestno.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const ADMIN = fs.readFileSync(path.join(KOREN, 'admin.html'), 'utf8');
const VK = fs.readFileSync(path.join(KOREN, 'js/admin-vk-stena.js'), 'utf8');
const SKRIPT = ADMIN.match(/<script>\n\(function\(\)\{([\s\S]*?)\}\)\(\);\n<\/script>/)[0]
  .replace(/^<script>/, '').replace(/<\/script>$/, '');

function element(id) {
  const el = { id, textContent: '', innerHTML: '', hidden: id !== 'loading', className: '', value: '', disabled: false,
    elements: [], dataset: {}, addEventListener() {}, querySelector() { return null; } };
  return el;
}

// Прогоняем встроенный скрипт админки с подменой fetch: otvety — {путь: [код, тело]}
function admin(otvety, okno) {
  const el = {};
  for (const id of ['loading', 'deny', 'denyText', 'adm', 'fb', 'log', 'uNote', 'dNote']) el[id] = element(id);
  const document = { getElementById: id => (el[id] = el[id] || element(id)) };
  const zaprosy = [];
  const fetch = (url) => {
    const put = url.replace('https://api.deloskop.ru', '').split('?')[0];
    zaprosy.push(put);
    const [kod, telo] = otvety[put] || [404, { detail: 'Not Found' }];
    return Promise.resolve({ ok: kod >= 200 && kod < 300, status: kod, json: () => Promise.resolve(telo) });
  };
  const window = Object.assign({}, okno || {});
  const ctx = { window, document, fetch, navigator: { onLine: true }, location: { hostname: 'deloskop.ru' },
    setTimeout: () => 0, clearTimeout() {}, encodeURIComponent, Promise, Date, Number, String, Object, Array, JSON };
  vm.runInNewContext(SKRIPT, ctx);
  return { el, zaprosy, gotovo: () => new Promise(r => setImmediate(() => setImmediate(() => setImmediate(r)))) };
}

const SVODKA = [200, { me: { email: 'a@deloskop.ru', role: 'admin' },
  summary: { users: 3, users_7d: 1, active_1d: 1, checks_today: 15, checks_7d: 40, feedback_new: 2 } }];
const VSE_OK = {
  '/api/admin/summary': SVODKA,
  '/api/admin/data': [200, { datasets: [], loaded: 0, total: 0, running: false }],
  '/api/admin/users': [200, { users: [] }],
  '/api/admin/feedback': [200, { feedback: [] }],
  '/api/admin/log': [200, { log: [] }],
};

test('404 у отзывов: админка открыта, #denyText пуст, в блоке «Отзывы» — «не загрузился»', async () => {
  const o = Object.assign({}, VSE_OK, { '/api/admin/feedback': [404, { detail: 'Not Found' }] });
  const { el, gotovo } = admin(o);
  await gotovo();
  assert.strictEqual(el.adm.hidden, false, 'админка открыта');
  assert.strictEqual(el.deny.hidden, true, 'карточка «нет доступа» скрыта');
  assert.strictEqual(el.denyText.textContent, '', '#denyText не тронут');
  assert.match(el.fb.innerHTML, /Список отзывов сейчас не загрузился \(ответ сервера 404\)/);
  assert.doesNotMatch(el.fb.innerHTML + el.denyText.textContent, /Not Found/);
  assert.strictEqual(el.sToday.textContent, 15, 'сводка на месте');
});

test('каждый блок отказывает сам за себя: журнал и пользователи — в своих местах', async () => {
  const o = Object.assign({}, VSE_OK, { '/api/admin/log': [500, {}], '/api/admin/users': [502, {}] });
  const { el, gotovo } = admin(o);
  await gotovo();
  assert.strictEqual(el.denyText.textContent, '');
  assert.match(el.log.innerHTML, /Журнал сейчас не загрузился \(ответ сервера 500\)/);
  assert.match(el.uNote.textContent, /Список пользователей сейчас не загрузился \(ответ сервера 502\)/);
  assert.strictEqual(el.fb.innerHTML, '<p class="empty">Отзывов пока нет.</p>');
});

test('вход решает сводка: 401 — «войдите в кабинет», 404 сводки — по-русски, без «Not Found»', async () => {
  let r = admin({ '/api/admin/summary': [401, { detail: 'Войдите в кабинет, чтобы открыть админку' }] });
  await r.gotovo();
  assert.strictEqual(r.el.deny.hidden, false);
  assert.strictEqual(r.el.adm.hidden, true);
  assert.match(r.el.denyText.textContent, /Сначала войдите в кабинет/);
  r = admin({});
  await r.gotovo();
  assert.strictEqual(r.el.denyText.textContent, 'Ошибка 404. Повторите через минуту.');
});

test('сбой модуля (Базы бросили исключение) не закрывает админку', async () => {
  const okno = { DlkBazy: { start() { throw new Error('сломался'); } } };
  const { el, gotovo } = admin(VSE_OK, okno);
  await gotovo();
  assert.strictEqual(el.adm.hidden, false);
  assert.strictEqual(el.denyText.textContent, '');
});

// ---------- «Стена ВКонтакте» ----------
function stena(okno) {
  const el = {};
  const document = { getElementById: id => (el[id] = el[id] || { textContent: '', innerHTML: '', hidden: true, className: '' }) };
  const window = Object.assign({ location: { pathname: '/admin.html', search: '', hash: '' }, history: null, addEventListener() {} }, okno || {});
  const ctx = { window, document, Date, Number, String, Promise, isNaN };
  vm.runInNewContext(VK, ctx);
  return { api: ctx.window.DlkVkStena, el, window };
}
const API = 'https://api.deloskop.ru';

test('стена: три состояния словами и одна кнопка', () => {
  const { api } = stena();
  const box = { innerHTML: '', className: '' };
  // не подключена
  api._risovat(box, { podklyuchena: false }, true, API);
  assert.match(box.innerHTML, /<b>Стена не подключена<\/b>/);
  assert.match(box.className, /vk-net\b/);
  assert.strictEqual((box.innerHTML.match(/<a /g) || []).length, 1, 'одна кнопка');
  assert.match(box.innerHTML, /<a class="btn primary" id="vkPodkl" href="https:\/\/api\.deloskop\.ru\/api\/admin\/vk\/stena\/podklyuchit" rel="nofollow">Подключить стену<\/a>/);
  // подключена до … (по Москве)
  api._risovat(box, { podklyuchena: true, do: '2026-12-16T11:30:00+00:00' }, true, API);
  assert.match(box.innerHTML, /<b>Стена подключена до 16\.12\.2026 в 14:30<\/b>/);
  assert.match(box.innerHTML, />Подключить заново</);
  assert.match(box.className, /vk-da/);
  // подключена, срок сервер не назвал — без выдуманной даты
  api._risovat(box, { podklyuchena: true }, true, API);
  assert.match(box.innerHTML, /<b>Стена подключена<\/b>/);
  // не загрузилось
  api._risovat(box, null, true, API, '404');
  assert.match(box.innerHTML, /<b>Состояние стены сейчас не загрузилось<\/b>/);
  assert.match(box.innerHTML, /Ответ сервера: 404/);
  assert.match(box.className, /vk-net-svyazi/);
});

test('стена: тестировщику — без кнопки', () => {
  const { api } = stena();
  const box = { innerHTML: '', className: '' };
  api._risovat(box, { podklyuchena: false }, false, API);
  assert.doesNotMatch(box.innerHTML, /<a /);
  assert.match(box.innerHTML, /Подключить стену может только администратор/);
});

test('стена: ключей и адресов на странице нет — подсказка сервера с адресом или ключом отбрасывается', () => {
  const { api } = stena();
  const box = { innerHTML: '', className: '' };
  api._risovat(box, { podklyuchena: false, prichina: 'Нет переменной VK_STENA_KLYUCH_SHIFROVANIYA_ZNACHENIE', token: 'vk1.a.SEKRET' }, true, API);
  assert.doesNotMatch(box.innerHTML, /VK_STENA|SEKRET|token/);
  api._risovat(box, { podklyuchena: false, chto_nuzhno: 'Добавьте https://deloskop.ru/admin.html в доверенные адреса' }, true, API);
  assert.doesNotMatch(box.innerHTML, /admin\.html|https:\/\/deloskop/);
  api._risovat(box, { podklyuchena: false, chto_nuzhno: 'Нужна переменная шифрования на сервере.' }, true, API);
  assert.match(box.innerHTML, /Нужна переменная шифрования на сервере\./);
  assert.strictEqual(api._bezopasno('<b>x</b>'), '<b>x</b>');
  api._risovat(box, { podklyuchena: false, prichina: '<img src=x onerror=1>' }, true, API);
  assert.doesNotMatch(box.innerHTML, /<img/, 'текст сервера экранируется');
});

test('стена: после возврата из VK ID — параметры сняты из адреса, состояние спрошено заново', async () => {
  const zamena = [];
  const okno = { location: { pathname: '/admin.html', search: '?vk_stena=ok&code=abc', hash: '' },
    history: { replaceState: (a, b, url) => zamena.push(url) } };
  const { api, el } = stena(okno);
  const vyzovy = [];
  const call = p => { vyzovy.push(p); return Promise.resolve({ podklyuchena: true, deystvuet_do: '2027-01-10T09:00:00Z' }); };
  await api.start(call, () => true, API);
  assert.deepStrictEqual(zamena, ['/admin.html']);
  assert.deepStrictEqual(vyzovy, ['/api/admin/vk/stena/status']);
  assert.strictEqual(el.vkSek.hidden, false);
  assert.match(el.vkBox.innerHTML, /подключена до 10\.01\.2027 в 12:00/);
});

test('стена: ошибка адреса состояния — блок виден с «не загрузилось», исключения наружу нет', async () => {
  const { api, el } = stena();
  const call = () => { const e = new Error('x'); e.status = 404; return Promise.reject(e); };
  await api.start(call, () => true, API);
  assert.strictEqual(el.vkSek.hidden, false);
  assert.match(el.vkBox.innerHTML, /Состояние стены сейчас не загрузилось/);
});

test('админка: блок «Стена ВКонтакте» подключён, скрыт до ответа, стоит после «Баз»', () => {
  assert.match(ADMIN, /<section class="card" id="vkSek" hidden>\s*<h2>Стена ВКонтакте<\/h2>/);
  assert.match(ADMIN, /<script src="\/js\/admin-vk-stena\.js"><\/script>/);
  assert.ok(ADMIN.indexOf('id="bzSek"') < ADMIN.indexOf('id="vkSek"'));
  assert.ok(ADMIN.indexOf('id="vkSek"') < ADMIN.indexOf('<h2>Данные ФНС</h2>'));
  assert.match(ADMIN, /DlkVkStena\.start\(call,A,API\)/);
});
