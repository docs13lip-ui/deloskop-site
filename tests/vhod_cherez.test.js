// vhody-v2-sait: вход через Яндекс ID / VK ID в кабинете — кнопки только при ключах, без скриптов площадок.
// Запуск: node --test tests/vhod_cherez.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const V = require('../js/vhod-cherez.js');
const API = 'https://api.deloskop.ru';

// крошечный DOM: createElement, appendChild, textContent, атрибуты, querySelectorAll('[data-cherez]')
function uzel(tag) {
  const u = {
    tag, deti: [], attrs: {}, hidden: false, className: '', href: '', _t: '',
    appendChild(d) { this.deti.push(d); return d; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener() {},
    get textContent() { return this._t + this.deti.map((d) => d.textContent).join(''); },
    set textContent(v) { this._t = v; this.deti = []; },
    vse() { return [this, ...this.deti.flatMap((d) => d.vse())]; },
    querySelectorAll(s) { return s === '[data-cherez]' ? this.vse().filter((d) => 'data-cherez' in d.attrs) : []; },
  };
  u.ownerDocument = { createElement: uzel };
  return u;
}
const otvet = (j, ok = true) => () => Promise.resolve({ ok, json: () => Promise.resolve(j) });

test('без ключей кнопок нет: 404, обрыв связи, false, мусор — экран входа прежний', async () => {
  for (const f of [otvet({}, false), () => Promise.reject(new Error('x')), otvet({ yandex: false, vk: false }),
    otvet({ yandex: 'true', vk: 1 }), otvet(null)]) {
    const el = uzel('div'); el.hidden = true;
    assert.strictEqual(await V.mount(el, { api: API, fetch: f }), 0);
    assert.strictEqual(el.hidden, true);
    assert.strictEqual(el.deti.length, 0);
  }
});

test('ключ Яндекса есть, VK нет — одна кнопка, ссылка на наш API с безопасным next', async () => {
  const el = uzel('div'); el.hidden = true;
  let zapros = '';
  const f = (u) => { zapros = u; return otvet({ yandex: true, vk: false })(); };
  assert.strictEqual(await V.mount(el, { api: API, fetch: f, next: '/cabinet.html' }), 1);
  assert.strictEqual(zapros, API + '/api/auth/vhody');
  assert.strictEqual(el.hidden, false);
  const [a] = el.querySelectorAll('[data-cherez]');
  assert.strictEqual(a.href, API + '/api/auth/yandex?next=%2Fcabinet.html');
  assert.match(el.textContent, /Войти с Яндекс ID/);
  assert.match(el.textContent.replace(/\u00a0/g, ' '), /Пароль от Яндекс ID мы не видим\. Яндекс ID передаст нам имя, почту и номер профиля — по почте найдём ваш кабинет или создадим новый\./);
  assert.doesNotMatch(el.textContent, /только имя/); // приходит и номер профиля
  assert.doesNotMatch(el.textContent, /VK ID/);
});

test('обе кнопки — в порядке решения владельца: Яндекс → VK', async () => {
  const el = uzel('div');
  assert.strictEqual(await V.mount(el, { api: API, fetch: otvet({ vk: true, yandex: true }) }), 2);
  assert.deepStrictEqual(el.querySelectorAll('[data-cherez]').map((a) => a.attrs['data-cherez']), ['yandex', 'vk']);
  assert.match(el.textContent.replace(/\u00a0/g, ' '), /Яндекс ID и VK ID/);
  assert.match(el.textContent.replace(/\u00a0/g, ' '), /VK ID мы не видим\. Площадка передаст нам имя, почту и номер профиля/);
});

test('next — только свой путь: чужие сайты и «//» не пропускаем (нет открытого редиректа)', () => {
  for (const plohoj of ['https://evil.ru/', '//evil.ru', '/\\evil.ru', 'javascript:alert(1)', '', null, 'cabinet.html', '/a b'])
    assert.strictEqual(V.svoj(plohoj), '/cabinet.html', String(plohoj));
  assert.strictEqual(V.svoj('/report.html?id=5'), '/report.html?id=5');
  assert.strictEqual(V.ssylka(API, V.PROVAJDERY[1], '//evil.ru'), API + '/api/auth/vk?next=%2Fcabinet.html');
});

test('возврат с сервера: понятный текст ошибки по причине, метки убраны из адреса', () => {
  let novyj = null;
  const hist = { replaceState: (a, b, u) => { novyj = u; } };
  const loc = (q) => ({ search: q, pathname: '/cabinet.html', hash: '#watch' });
  let r = V.itog(loc('?vhod=oshibka&cherez=yandex&prichina=pochta&inn=7707083893'), hist);
  assert.strictEqual(r.ok, false);
  assert.match(r.tekst, /^Яндекс\sID\sне\sпередал адрес почты/);
  assert.strictEqual(novyj, '/cabinet.html?inn=7707083893#watch');
  r = V.itog(loc('?vhod=oshibka&cherez=vk&prichina=neznayu'), hist);
  assert.strictEqual(r.tekst, V.nb(V.PRICHINY.oshibka.replace(/\{p\}/g, 'VK ID')));
  r = V.itog(loc('?vhod=ok&cherez=vk&novyj=1'), hist);
  assert.deepStrictEqual([r.ok, r.novyj, r.tekst], [true, true, '']);
  assert.strictEqual(novyj, '/cabinet.html#watch');
  assert.strictEqual(V.itog(loc('?vhod=ok&cherez=google'), hist), null, 'чужой провайдер — не наш возврат');
  assert.strictEqual(V.itog(loc('?rassylki=ok'), hist), null);
});

test('тексты — по-человечески: без слов API/OAuth/токен, ёлочки и тире, без обещаний, короткие слова не висят', async () => {
  const el = uzel('div');
  await V.mount(el, { api: API, fetch: otvet({ yandex: true, vk: true }) });
  const hist = { replaceState() {} };
  const oshibki = Object.keys(V.PRICHINY).map((k) => V.itog({ search: '?vhod=oshibka&cherez=vk&prichina=' + k, pathname: '/' }, hist).tekst);
  const vse = [el.textContent, ...oshibki].join(' | ');
  assert.doesNotMatch(vse, /\bAPI\b|OAuth|токен|endpoint|redirect|ошибка \d/i);
  assert.doesNotMatch(vse, /"|\s-\s|гарант|безопасн|\{p\}/i);
  assert.doesNotMatch(vse, /(^|[\s\u00a0])(в|и|с|о|по|на|не|до|от|мы) /, 'висячее короткое слово');
  assert.doesNotMatch(vse, / —/, 'перед тире — обычный пробел');
});

test('кабинет: место под кнопки скрыто, модуль подключён, никаких скриптов и адресов площадок', () => {
  const kab = chitat('cabinet.html');
  const vhod = (kab.match(/<section class="card" id="login"[\s\S]*?<\/section>/) || [''])[0];
  assert.match(vhod, /<div id="cherez" hidden><\/div>\s*<p class="oferta-vhod">/, 'кнопки — под почтой, над строкой об оферте');
  assert.ok(vhod.indexOf('id="fEmail"') < vhod.indexOf('id="cherez"'), 'главное действие — почта, кнопки площадок ниже');
  assert.match(kab, /<script src="\/js\/vhod-cherez\.js"><\/script>/);
  assert.match(kab, /DlkVhodCherez\.mount\(\$\('cherez'\),\{api:API,next:'\/cabinet\.html'\}\)/);
  const js = chitat('js/vhod-cherez.js');
  assert.doesNotMatch(js, /innerHTML|document\.cookie|localStorage/);
  for (const t of [js, kab]) assert.doesNotMatch(t, /id\.vk\.(com|ru)|oauth\.yandex|passport\.yandex|vk\.com\/js|unpkg|sdk/i);
});

test('цели Метрики: ключ параметра vid есть в белом списке metrika.js', () => {
  const m = chitat('js/metrika.js');
  assert.match(m, /KLYUCHI = \{[^}]*\bvid: 1/);
  assert.match(chitat('js/vhod-cherez.js'), /dlkGoal\("vhod_cherez", \{ vid:/);
  assert.match(chitat('cabinet.html'), /dlkGoal\('registration',\{vid:vhodItog\.cherez\}\)/);
});
