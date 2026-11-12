// «Следить за компанией» в отчёте — форма почты за флагом SLEDIT (js/sledit.js, sledit-v1, решение владельца 13.11.2026 п. 1).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const S = require('../js/sledit.js');
const O = require('../js/otchet.js');

const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');

test('флаг выключен: модуль ничего не слушает, кнопка ведёт в кабинет', () => {
  assert.strictEqual(S.SLEDIT, false, 'включать только после ✎ [Право] и api-slezhenie-v1');
  let n = 0;
  const doc = { addEventListener: () => { n++; } };
  assert.strictEqual(S.slushat(doc, () => null), false);
  assert.strictEqual(n, 0);
  assert.strictEqual(S.slushat(doc, () => null, true), true, 'с флагом — два слушателя');
  assert.strictEqual(n, 2);
});

test('кнопка «Следить» в отчёте: ИНН организации в адресе, у ИП и своей компании — без формы', () => {
  const r = (inn) => ({ company: { inn: inn, name: 'ООО «Пример»' }, risk_level: 'low' });
  const a = O.dejstviya(r('7736050003'));
  assert.strictEqual(a[0].href, '/cabinet.html?inn=7736050003#watch');
  assert.strictEqual(a[0].cel, 'otchet_sled');
  assert.strictEqual(S.innIzSsylki(a[0].href), '7736050003');
  const ip = O.dejstviya(r('770000000012'));
  assert.strictEqual(ip[0].href, '/cabinet.html#watch', 'ИП — ИНН в адрес не ставим');
  assert.strictEqual(S.innIzSsylki(ip[0].href), '');
  const svoj = O.dejstviya(r('7736050003'), true);
  assert.strictEqual(svoj[0].cel, 'shchit_sled', 'своя компания — другой путь, форма не открывается');
  assert.strictEqual(S.innIzSsylki('/cabinet.html?inn=770000000012#watch'), '', '12 цифр — не организация');
  assert.strictEqual(S.innIzSsylki('/cabinet.html?inn=7736050003'), '7736050003');
});

test('адрес почты: простая проверка, без лишней строгости', () => {
  ['a@b.ru', 'ivan.petrov@mail.ru', 'buh+deloskop@firma.com', ' x@y.org '].forEach((v) => assert.ok(S.pochtaOk(v), v));
  ['', 'abc', 'a@b', 'a b@c.ru', 'a@@b.ru', '@b.ru', 'a@b.r', '<a@b.ru>', 'a@b.ru' + 'x'.repeat(260)].forEach((v) => assert.ok(!S.pochtaOk(v), v));
  assert.ok(!S.pochtaOk(null));
});

test('ошибки ввода — по-человечески, по одной', () => {
  assert.match(S.oshibka('', true), /Впишите адрес почты/);
  assert.match(S.oshibka('abc', true), /имя@почта\.ru/);
  assert.match(S.oshibka('a@b.ru', false), /Отметьте согласие/);
  assert.strictEqual(S.oshibka('a@b.ru', true), '');
});

test('серверу — ровно ИНН, почта и согласие; ничего лишнего', () => {
  assert.deepStrictEqual(S.telo('7736050003', ' a@b.ru '), { inn: '7736050003', email: 'a@b.ru', soglasie: true });
  assert.strictEqual(S.ADRES, '/api/slezhenie/zayavka');
  const js = chitat('js/sledit.js');
  assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|document\.cookie/, 'адрес почты не хранится в браузере');
  assert.doesNotMatch(js, /dlkGoal|ym\(|dlkSobytie/, 'ни Метрики, ни новых событий — счёт по data-cel');
});

test('ответ сервера → слова человеку', () => {
  const ok = S.itog(202, ' a@b.ru ');
  assert.ok(ok.ok);
  assert.match(ok.t, /Письмо отправлено на a@b\.ru\. Откройте ссылку/);
  assert.match(S.itog(429).t, /через час/);
  assert.match(S.itog(400).t, /не принял адрес/);
  const net = S.itog(0);
  assert.ok(!net.ok && net.kabinet, 'нет связи — путь в кабинет');
  assert.ok(!S.itog(503).ok);
});

test('форма: подпись, согласие отдельной галочкой (не отмечена), уникальные id, без цен и без «!»', () => {
  const h1 = S.htmlForma('7736050003'), h2 = S.htmlForma('7736050003');
  assert.match(h1, /data-sl-inn="7736050003"/);
  assert.match(h1, /type="email"[^>]*autocomplete="email"/);
  assert.match(h1, /<input type="checkbox" id="sl\d+s">/, 'галочка без checked');
  assert.doesNotMatch(h1, /checked/);
  assert.match(h1, /href="\/soglasie\/"/);
  assert.match(h1, /Без регистрации/);
  const id = (h) => /id="(sl\d+)e"/.exec(h)[1];
  assert.notStrictEqual(id(h1), id(h2), 'форма и её копия в липкой строке не делят id');
  assert.doesNotMatch(h1, /₽|!/);
  assert.doesNotMatch(chitat('js/sledit.js'), /гарантир|лучш|надёжн|искусствен|нейросет/i);
});

// Мини-DOM для otkryt/otpravit: достаточно того, что трогает модуль.
function miniDom() {
  const uzly = [];
  function uzel(tag, attrs) {
    const u = { tagName: tag, attrs: Object.assign({}, attrs), children: [], parentNode: null, value: '', checked: false, disabled: false, hidden: false, textContent: '', className: '',
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
      insertBefore(c, ref) { c.parentNode = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; },
      get nextElementSibling() { const p = this.parentNode; if (!p) return null; return p.children[p.children.indexOf(this) + 1] || null; },
      get nextSibling() { return this.nextElementSibling; },
      classList: { contains: (c) => (u.className || '').split(/\s+/).includes(c) },
      focus() { u.fokus = true; },
      querySelector(sel) { return u.najti(sel); },
      najti(sel) { for (const c of this.children) { if (c.sovpal(sel)) return c; const g = c.najti(sel); if (g) return g; } return null; },
      sovpal(sel) { if (sel === 'input[type=checkbox]') return this.tagName === 'input' && this.attrs.type === 'checkbox'; return sel[0] === '.' && this.classList.contains(sel.slice(1)); },
      ownerDocument: null };
    uzly.push(u);
    return u;
  }
  const doc = {
    createElement(tag) {
      const d = uzel(tag, {});
      Object.defineProperty(d, 'innerHTML', { set(h) {
        // собираем форму по разметке htmlForma: только нужные узлы
        const f = uzel('form', { 'data-sl-inn': /data-sl-inn="(\d*)"/.exec(h)[1] }); f.className = 'sl-f';
        const i = uzel('input', { type: 'email' }); i.className = 'sl-i';
        const s = uzel('input', { type: 'checkbox' });
        const b = uzel('button', {}); b.className = 'ot-btn p sl-b';
        const o = uzel('p', {}); o.className = 'sl-o';
        [i, s, b, o].forEach((x) => f.appendChild(x));
        d.children = [f]; f.parentNode = d;
      } });
      Object.defineProperty(d, 'firstChild', { get() { return d.children[0]; } });
      return d;
    }
  };
  uzly.forEach((u) => { u.ownerDocument = doc; });
  return { doc, uzel };
}

test('нажатие: форма встаёт под кнопкой один раз, фокус в поле почты', () => {
  const { doc, uzel } = miniDom();
  const ac = uzel('div', {}); ac.className = 'ot-act';
  const a = uzel('a', { href: '/cabinet.html?inn=7736050003#watch', 'data-cel': 'otchet_sled' });
  ac.appendChild(a); ac.appendChild(uzel('a', { href: '/pasport/kontragent/?inn=7736050003' }));
  const f = S.otkryt(doc, a);
  assert.ok(f && f.classList.contains('sl-f'));
  assert.strictEqual(ac.children[1], f, 'сразу после кнопки');
  assert.strictEqual(a.getAttribute('aria-expanded'), 'true');
  assert.ok(f.querySelector('.sl-i').fokus);
  assert.strictEqual(S.otkryt(doc, a), f, 'второе нажатие — та же форма');
  assert.strictEqual(ac.children.length, 3);
  const ip = uzel('a', { href: '/cabinet.html#watch' }); ac.appendChild(ip);
  assert.strictEqual(S.otkryt(doc, ip), null, 'без ИНН организации — обычная ссылка в кабинет');
});

test('отправка: без согласия запроса нет; с согласием — один POST и «Письмо отправлено»', async () => {
  const { doc, uzel } = miniDom();
  const ac = uzel('div', {}); const a = uzel('a', { href: '/cabinet.html?inn=7736050003#watch' }); ac.appendChild(a);
  const f = S.otkryt(doc, a);
  f.ownerDocument = doc;
  const zaprosy = [];
  const fetchFn = (u, o) => { zaprosy.push([u, o]); return Promise.resolve({ status: 202 }); };
  f.querySelector('.sl-i').value = 'buh@firma.ru';
  await S.otpravit(f, fetchFn);
  assert.strictEqual(zaprosy.length, 0);
  assert.match(f.querySelector('.sl-o').textContent, /Отметьте согласие/);
  f.querySelector('input[type=checkbox]').checked = true;
  const it = await S.otpravit(f, fetchFn);
  assert.ok(it.ok);
  assert.strictEqual(zaprosy.length, 1);
  assert.strictEqual(zaprosy[0][0], '/api/slezhenie/zayavka');
  assert.strictEqual(zaprosy[0][1].method, 'POST');
  assert.deepStrictEqual(JSON.parse(zaprosy[0][1].body), { inn: '7736050003', email: 'buh@firma.ru', soglasie: true });
  assert.match(f.querySelector('.sl-o').textContent, /Письмо отправлено на buh@firma\.ru/);
  assert.ok(f.querySelector('.sl-b').hidden && f.querySelector('.sl-i').disabled, 'после отправки — не отправить второй раз');
});

test('сборка: модуль в пакете отчёта после otchet.js и липкой строки; стили формы в css/otchet.css', () => {
  const k = JSON.parse(chitat('partials/sborka.json'));
  const p = k.pakety.otchet;
  assert.strictEqual(p.indexOf('js/sledit.js'), p.indexOf('js/lipkaya.js') + 1);
  assert.ok(p.indexOf('js/lipkaya.js') === p.indexOf('js/otchet.js') + 1, 'липкая строка — сразу за отчётом (tests/lipkaya.test.js)');
  const css = chitat('css/otchet.css');
  assert.match(css, /\.sl-f\{/);
  assert.match(css, /\.sl-i\{[^}]*font-size:17px/, 'на телефоне поле не увеличивает страницу');
  assert.match(css, /\.sl-s\{[^}]*min-height:44px/, 'галочка — в палец');
});

test('два ключа: SLEDIT и slezhenie_pisma в tarify.json; без писем форма не включается', async () => {
  const doc = () => { const d = { n: 0, addEventListener() { d.n++; } }; return d; };
  const tarify = (t) => (u) => Promise.resolve(u === '/tarify/tarify.json' ? { ok: true, json: () => Promise.resolve(t) } : null);
  let d = doc();
  assert.strictEqual(await S.zapusk(d, tarify({ slezhenie_pisma: true })), false, 'SLEDIT выключен — tarify.json даже не читаем');
  d = doc();
  assert.strictEqual(await S.zapusk(d, tarify({ slezhenie_pisma: false }), true), false);
  assert.strictEqual(d.n, 0);
  assert.strictEqual(await S.zapusk(d, tarify({ slezhenie_pisma: 'true' }), true), false, 'строка — не true');
  assert.strictEqual(await S.zapusk(d, () => Promise.reject(new Error('сеть')), true), false);
  assert.strictEqual(await S.zapusk(d, tarify({ slezhenie_pisma: true }), true), true);
  assert.strictEqual(d.n, 2);
  const T = JSON.parse(chitat('tarify/tarify.json'));
  if (T.slezhenie_pisma !== true) assert.strictEqual(S.SLEDIT, false, 'письма не идут — SLEDIT не включать');
});
