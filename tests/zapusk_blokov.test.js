// zapusk-blokov-v1 — [Ночные запуски] 17.11.2026 (✎ Штаба 17.11 п. 17, срочно).
// Админка: блоки «Сейчас» (DlkPult) и «Сегодня» (DlkSegodnya), счета, базы, документы, стена ВК — во внешних файлах ПОСЛЕ
// встроенного сценария. Если ответ /api/admin/summary приходит раньше, чем браузер дочитал эти файлы, блок раньше не стартовал
// никогда («собираем сводку…» навсегда). Теперь блоки стартуют после DOMContentLoaded, в каком бы порядке ни пришли ответ и файлы.
// Заодно: цели Метрики `registration` (кабинет, вход через Яндекс ID / VK ID) и `report_opened` (report.html) не теряются,
// если сценарий исполнился раньше defer-файла с dlkGoal.
// Запуск: node --test tests/zapusk_blokov.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const ADMIN = fs.readFileSync(path.join(KOREN, 'admin.html'), 'utf8');
const KABINET = fs.readFileSync(path.join(KOREN, 'cabinet.html'), 'utf8');
const OTCHET = fs.readFileSync(path.join(KOREN, 'report.html'), 'utf8');
const SKRIPT = ADMIN.match(/<script>\n\(function\(\)\{([\s\S]*?)\}\)\(\);\n<\/script>/)[0]
  .replace(/^<script>/, '').replace(/<\/script>$/, '');

function element(id) {
  return { id, textContent: '', innerHTML: '', hidden: id !== 'loading', className: '', value: '', disabled: false,
    elements: [], dataset: {}, addEventListener() {}, querySelector() { return null; } };
}

const SVODKA = { me: { email: 'a@deloskop.ru', role: 'admin' },
  summary: { users: 3, users_7d: 1, active_1d: 1, checks_today: 15, checks_7d: 40, feedback_new: 2 } };
const OTVETY = {
  '/api/admin/summary': SVODKA,
  '/api/admin/data': { datasets: [], loaded: 0, total: 0, running: false },
  '/api/admin/users': { users: [] }, '/api/admin/feedback': { feedback: [] }, '/api/admin/log': { log: [] },
};
const tik = () => new Promise(r => setImmediate(() => setImmediate(() => setImmediate(r))));

// Страница «ещё грузится»: readyState = loading, внешние файлы появляются позже, DOMContentLoaded — вручную.
function stranica() {
  const el = {};
  const slushateli = [];
  const document = { readyState: 'loading', getElementById: id => (el[id] = el[id] || element(id)),
    addEventListener(t, f) { if (t === 'DOMContentLoaded') slushateli.push(f); } };
  const fetch = (url) => {
    const put = url.replace('https://api.deloskop.ru', '').split('?')[0];
    const telo = OTVETY[put];
    return Promise.resolve({ ok: !!telo, status: telo ? 200 : 404, json: () => Promise.resolve(telo || {}) });
  };
  const ctx = { document, fetch, navigator: { onLine: true }, location: { hostname: 'deloskop.ru' },
    setTimeout: () => 0, clearTimeout() {}, encodeURIComponent, Promise, Date, Number, String, Object, Array, JSON };
  const window = ctx.window = ctx; // в браузере window — это и есть глобальный объект (сценарий зовёт DlkPult.start без window.)
  vm.runInNewContext(SKRIPT, ctx);
  const zapuski = [];
  const blok = (imya) => ({ start: (...a) => { zapuski.push(imya); return Promise.resolve(); } });
  return {
    el, zapuski,
    dochitalFajly() { // так делают js/admin-*.js, когда браузер их исполнил
      window.DlkPult = blok('pult'); window.DlkSegodnya = blok('segodnya');
      window.DlkScheta = blok('scheta'); window.DlkBazy = blok('bazy'); window.DlkVkStena = blok('vk');
    },
    domGotov() { document.readyState = 'interactive'; slushateli.splice(0).forEach(f => f()); },
  };
}

test('сводка пришла РАНЬШЕ файлов: «Сейчас» и «Сегодня» всё равно стартуют (гонка 17.11)', async () => {
  const s = stranica();
  await tik(); // ответ сводки уже обработан, а DlkPult / DlkSegodnya ещё не определены
  assert.strictEqual(s.el.sToday.textContent, 15, 'цифры сводки на месте сразу');
  assert.deepStrictEqual(s.zapuski, [], 'до DOMContentLoaded ничего не запускаем');
  s.dochitalFajly();
  s.domGotov();
  await tik();
  for (const b of ['pult', 'segodnya', 'scheta', 'bazy', 'vk']) assert.ok(s.zapuski.includes(b), 'стартовал ' + b);
  assert.strictEqual(s.zapuski.filter(b => b === 'pult').length, 1, 'Пульт — один раз');
  assert.strictEqual(s.el.adm.hidden, false, 'админка открыта');
});

test('файлы дочитаны РАНЬШЕ ответа сводки: тоже стартуют, по одному разу', async () => {
  const s = stranica();
  s.dochitalFajly();
  s.domGotov();
  await tik();
  assert.deepStrictEqual(s.zapuski.filter(b => b === 'pult' || b === 'segodnya').sort(), ['pult', 'segodnya']);
});

test('в разметке: внешние файлы блоков — обычные <script src> (не async/defer), иначе DOMContentLoaded их не ждёт', () => {
  for (const f of ['admin-pult', 'admin-segodnya', 'admin-scheta', 'admin-bazy', 'admin-vk-stena', 'admin-dokumenty']) {
    const m = ADMIN.match(new RegExp('<script src="/js/' + f + '\\.js"([^>]*)>'));
    assert.ok(m, f + ' подключён');
    assert.doesNotMatch(m[1], /async|defer/, f + ' без async/defer');
  }
  assert.doesNotMatch(SKRIPT, /if\(window\.DlkPult&&!window\.DlkPult\._started\)\{window\.DlkPult\._started=true;try\{DlkPult\.start\(API,s\)\}catch\(_\)\{\}\}\n\s*if\(window\.DlkSegodnya[^\n]*\n\s*Array/,
    'запуск блоков не стоит прямо в ответе сводки');
});

// Кабинет: цель регистрации через Яндекс ID / VK ID — после того как defer-пакет «yadro» определил dlkGoal
function kabinetCel(dlkGoalSrazu) {
  const kusok = KABINET.match(/ {2}if\(vhodItog&&vhodItog\.novyj\)\{[\s\S]*?\{once:true\}\)\}/);
  assert.ok(kusok, 'кусок с целью регистрации найден');
  const celi = []; const slushateli = [];
  const window = {};
  const goal = (c, p) => celi.push([c, p && p.vid]);
  if (dlkGoalSrazu) window.dlkGoal = goal;
  const ctx = { window, vhodItog: { novyj: true, cherez: 'yandex' },
    document: { addEventListener(t, f) { if (t === 'DOMContentLoaded') slushateli.push(f); } } };
  ctx.dlkGoal = (...a) => window.dlkGoal(...a);
  vm.runInNewContext(kusok[0], ctx);
  return { celi, poyavilsya() { window.dlkGoal = goal; slushateli.splice(0).forEach(f => f()); } };
}

test('кабинет: dlkGoal ещё нет (yadro — defer) → цель registration уходит после DOMContentLoaded', () => {
  const k = kabinetCel(false);
  assert.deepStrictEqual(k.celi, [], 'сразу — некуда');
  k.poyavilsya();
  assert.deepStrictEqual(k.celi, [['registration', 'yandex']], 'цель не потерялась');
});

test('кабинет: dlkGoal уже есть → цель сразу и один раз', () => {
  const k = kabinetCel(true);
  k.poyavilsya();
  assert.deepStrictEqual(k.celi, [['registration', 'yandex']]);
});

test('отчёт: report_opened — через celOtkryt, которая ждёт DOMContentLoaded, если dlkGoal ещё нет', () => {
  const f = OTCHET.match(/function celOtkryt\(\)\{[^\n]*\}/);
  assert.ok(f, 'celOtkryt есть');
  assert.match(OTCHET, /\.then\(function\(d\)\{celOtkryt\(\);/, 'ответ отчёта зовёт celOtkryt');
  assert.doesNotMatch(OTCHET, /then\(function\(d\)\{if\(window\.dlkGoal\)dlkGoal\('report_opened'\)/, 'старого прямого вызова нет');
  const celi = []; const sl = []; const window = {};
  const ctx = { window, document: { addEventListener(t, g) { if (t === 'DOMContentLoaded') sl.push(g); } } };
  ctx.dlkGoal = c => celi.push(c);
  vm.runInNewContext(f[0] + ';celOtkryt();', ctx);
  assert.deepStrictEqual(celi, []);
  window.dlkGoal = ctx.dlkGoal; sl.forEach(g => g());
  assert.deepStrictEqual(celi, ['report_opened']);
});
