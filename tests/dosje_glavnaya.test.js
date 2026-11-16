// dosje-glavnaya-v1 [Ночные запуски] 16.11: «Досье» — главное действие рядом с выводом (план отчёта 15.11, п. 1.4).
// У организации: главная кнопка — «Досье сделки» (с номером проверки) или «Паспорт контрагента», «Следить» — второй;
// у ИП и своей компании — как было. Плитки «Коротко по реестрам» — оглавление досье: ссылка «Всё одним документом» ведёт туда же.
// node --test tests/dosje_glavnaya.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const O = require('../js/otchet.js');
const P = require('../js/plitki.js');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const r = (o) => Object.assign({ company: { inn: '7736050003', name_short: 'ООО «Пример»' }, risk_level: 'low' }, o || {});

test('организация: первая и единственная главная — досье, «Следить» второй, «Сравнить» тихой ссылкой', () => {
  const a = O.dejstviya(r({ report_id: 'R0xQzpOGTyjt' }));
  assert.deepStrictEqual(a.map((x) => x.cel), ['otchet_pasport', 'otchet_sled', 'otchet_sravnit']);
  assert.deepStrictEqual(a.filter((x) => x.glavnaya).map((x) => x.t), ['Досье сделки'], 'одна главная кнопка на экране');
  assert.strictEqual(a[0].href, '/pasport/kontragent/?id=R0xQzpOGTyjt#sd');
  assert.strictEqual(a[1].href, '/cabinet.html?inn=7736050003#watch', 'форма слежения — по тому же адресу (js/sledit.js)');
  assert.ok(a[2].tihaya);
  const bez = O.dejstviya(r());
  assert.strictEqual(bez[0].t, 'Паспорт контрагента', 'без номера проверки — Паспорт по ИНН');
  assert.ok(bez[0].glavnaya && bez[0].dosje);
});

test('ИП и своя компания — без изменений: одна кнопка «Следить» / первый шаг Щита', () => {
  const ip = O.dejstviya(r({ company: { inn: '770000000012' } }));
  assert.deepStrictEqual(ip.map((x) => [x.t, x.glavnaya]), [['Следить за компанией', true]]);
  assert.deepStrictEqual(O.dejstviya(r(), true).map((x) => [x.t, x.glavnaya]), [['Следить за своей компанией', true]]);
  const g = O.dejstviya(r(), true, { href: '/nalogi/x/', knopka: 'Как снять недостоверность' });
  assert.deepStrictEqual(g.map((x) => x.cel), ['shchit_shag']);
  assert.ok(O.dejstviya({}).every((x) => !x.dosje), 'без ИНН — досье не предлагаем');
});

test('разметка полосы: досье — .ot-btn.p с классом латунного канта, «Следить» — .ot-btn.s', () => {
  const src = chitat('js/otchet.js');
  assert.ok(src.includes("(d.dosje ? ' ot-btn--dosje' : '')"), 'класс канта ставит htmlDejstviya');
  const css = chitat('css/otchet.css');
  assert.match(css, /:root:not\(\[data-theme=dark\]\) \.ot-btn--dosje\{box-shadow:inset 0 -2px 0 var\(--mat-zhdu-t,#D9B45A\)\}/,
    'на светлой — латунь только кантом (палитра 14.11: латунь на светлом — украшение, не фон и не текст)');
  assert.doesNotMatch(css, /\.ot-btn--dosje\{[^}]*background/, 'фон кнопки — из токена акцента, свой не задаём');
});

// Мини-DOM: ровно то, чем пользуется Plitki.dosje
function uzel(tag, at) {
  const n = { tagName: tag.toUpperCase(), attrs: Object.assign({}, at || {}), children: [], parentNode: null, className: '', textContent: '', kliki: 0,
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { if (c.parentNode) c.parentNode.children.splice(c.parentNode.children.indexOf(c), 1); c.parentNode = this; this.children.push(c); return c; },
    insertBefore(c, ref) { if (c.parentNode) c.parentNode.children.splice(c.parentNode.children.indexOf(c), 1); c.parentNode = this; this.children.splice(this.children.indexOf(ref), 0, c); return c; },
    click() { this.kliki++; } };
  Object.defineProperty(n, 'href', { get() { return n.attrs.href; }, set(v) { n.attrs.href = v; } });
  return n;
}
function sobrat(sPa) {
  const doc = { createElement: (t) => uzel(t) };
  const pa = sPa ? Object.assign(uzel('a', { href: '/pasport/kontragent/?id=R0xQzpOGTyjt#sd', 'data-cel': 'otchet_pasport' }), { textContent: 'Досье сделки' }) : null;
  const sek = uzel('section'), h = uzel('h2');
  h.className = 'pl__h'; sek.appendChild(h);
  const najti = (koren, cls) => { const st = [koren]; while (st.length) { const x = st.shift(); if (x.className === cls) return x; st.push(...x.children); } return null; };
  sek.querySelector = (q) => q === '.pl__h' ? najti(sek, 'pl__h') : q === '.pl__d' ? najti(sek, 'pl__d') : null;
  const report = { ownerDocument: doc, querySelector: (q) => q === '.ot-act a[data-cel="otchet_pasport"]' ? pa : null };
  return { report, sek, pa, h };
}

test('плитки — оглавление досье: «Всё одним документом» рядом с заголовком, нажатие — сама главная кнопка', () => {
  const { report, sek, pa, h } = sobrat(true);
  const a = P.dosje(report, sek);
  assert.ok(a, 'ссылка поставлена');
  assert.strictEqual(a.parentNode.className, 'pl__hh');
  assert.strictEqual(h.parentNode, a.parentNode, 'заголовок и ссылка — в одной строке');
  assert.strictEqual(a.href, pa.getAttribute('href'));
  assert.strictEqual(a.textContent.replace(/ /g, ' '), 'Всё одним документом →');
  assert.strictEqual(a.getAttribute('aria-label'), 'Всё одним документом: Досье сделки');
  let otm = 0;
  a.onclick({ preventDefault() { otm++; }, button: 0 });
  assert.strictEqual(otm, 1);
  assert.strictEqual(pa.kliki, 1, 'переход — через кнопку: сумма из «Условий сделки» и счётчики остаются её');
  a.onclick({ preventDefault() { otm++; }, ctrlKey: true, button: 0 });
  assert.strictEqual(pa.kliki, 1, 'Ctrl/⌘ — обычная ссылка в новой вкладке');
  assert.strictEqual(P.dosje(report, sek), null, 'второй раз не ставим');
});

test('нет кнопки досье (ИП, своя компания) — ссылки нет; mount зовёт dosje', () => {
  const { report, sek } = sobrat(false);
  assert.strictEqual(P.dosje(report, sek), null);
  assert.strictEqual(sek.children.length, 1);
  assert.match(chitat('js/plitki.js'), /svyazatVse\(report, nov\);\n\s+try \{ dosje\(report, nov\); \} catch \(e\) \{\}/);
  assert.ok(P.CSS.includes('.pl__d{') && P.CSS.includes('var(--accent,#12305F)'), 'цвет ссылки — токен акцента');
});
