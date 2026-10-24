// celi-v2 (24.10.2026, план [Маркетинг] 24.10 разд. 6 п. 4): article_to_tool (ссылка и форма «Проверить» из статьи и разбора),
// company_to_check (с карточки /company/ к проверке), vk_click (в сообщество ВК; «Поделиться» — share_click, не vk_click).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const KOD = fs.readFileSync(path.join(KOREN, 'js', 'metrika.js'), 'utf8');
const O = 'https://deloskop.ru';

function zapustit(href) {
  const u = new URL(href);
  const handlers = {};
  const vyzovy = [];
  const hran = { dlk_cookies: JSON.stringify({ v: 'all', t: Date.now() }) };
  const uzel = () => ({ parentNode: { insertBefore() {} }, setAttribute() {}, addEventListener() {}, remove() {} });
  const document = {
    readyState: 'complete', referrer: '', title: 'т', body: { appendChild() {} },
    createElement: uzel, getElementsByTagName: () => [uzel()],
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener(t, f) { (handlers[t] = handlers[t] || []).push(f); }
  };
  const window = { document };
  const sb = { window, document, location: { href: u.href, pathname: u.pathname, search: u.search, origin: u.origin },
    localStorage: { getItem: (k) => hran[k] || null, setItem() {} }, JSON, Date, String, Object, URL };
  window.localStorage = sb.localStorage; window.location = sb.location;
  vm.createContext(sb); vm.runInContext(KOD, sb);
  window.ym = function () { vyzovy.push(JSON.parse(JSON.stringify(Array.from(arguments)))); };
  // элемент с closest() по списку «предков»: [{tag, cls, attr}]
  function el(tag, attr, predki) {
    const cep = [{ tag, attr: attr || {} }].concat(predki || []);
    const sovpad = (n, sel) => sel.split(',').map((s) => s.trim()).some((s) => {
      let m;
      if ((m = /^(\w+)?(?:\.([\w-]+))?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/.exec(s)) === null) return false;
      const [, t, c, a, v] = m;
      if (t && t.toLowerCase() !== n.tag) return false;
      if (c && !String((n.attr || {}).class || '').split(' ').includes(c)) return false;
      if (a && !(a in (n.attr || {}))) return false;
      if (a && v !== undefined && n.attr[a] !== v) return false;
      return !!(t || c || a);
    });
    const mk = (i) => ({
      tagName: cep[i].tag.toUpperCase(),
      getAttribute: (k) => (k in cep[i].attr ? cep[i].attr[k] : null),
      closest(sel) { for (let j = i; j < cep.length; j++) if (sovpad(cep[j], sel)) return mk(j); return null; }
    });
    return mk(0);
  }
  const klik = (target) => (handlers.click || []).forEach((f) => f({ target }));
  const otpravit = (target) => (handlers.submit || []).forEach((f) => f({ target }));
  const celi = () => vyzovy.filter((v) => v[1] === 'reachGoal').map((v) => [v[2], v[3]]);
  return { window, el, klik, otpravit, celi };
}

test('(1) perehod: статья, разбор, карточка, ВК — и что не считается', () => {
  const { window } = zapustit(O + '/');
  const P = (s, h, f) => JSON.parse(JSON.stringify(window.dlkPerehod(s, h, O, f)));
  assert.deepStrictEqual(P('/nalogi/kak-proverit-schet-pered-oplatoj/', '/proverit-schet/'),
    { cel: 'article_to_tool', p: { statya: '/nalogi/kak-proverit-schet-pered-oplatoj/', kuda: '/proverit-schet/', sposob: 'ssylka' } });
  assert.strictEqual(P('/praktika/115-fz/x/', '/?inn=7707083893').cel, 'article_to_tool');
  assert.strictEqual(P('/115-fz/zapros/', '/', 'forma').p.sposob, 'forma');
  assert.strictEqual(P('/115-fz/zapros/', '/pasport/kontragent/?inn=7707083893').p.kuda, '/pasport/kontragent/');
  assert.strictEqual(P('/115-fz/zapros/', '/sravnit/').cel, 'article_to_tool');
  assert.strictEqual(window.dlkPerehod('/115-fz/zapros/', '/nalogi/drugaya/', O), null, 'статья → статья — не инструмент');
  assert.strictEqual(window.dlkPerehod('/115-fz/', '/proverit-schet/', O), null, 'хаб раздела — не статья');
  const K = '/company/0274110679-farmstandart/';
  assert.deepStrictEqual(P(K, '/?inn=0274110679'), { cel: 'company_to_check', p: { kuda: '/' } });
  assert.strictEqual(P(K, '/pasport/kontragent/?inn=0274110679').cel, 'company_to_check');
  assert.strictEqual(P(K, '/proverit-schet/').cel, 'company_to_check');
  assert.strictEqual(window.dlkPerehod(K, '/', O), null, '«/» без ИНН с карточки — переход на главную, не проверка');
  assert.strictEqual(window.dlkPerehod(K, '/nalichnye/', O), null);
  assert.strictEqual(window.dlkPerehod('/company/otrasl/energetika/', '/?inn=0274110679', O), null, 'хаб — не карточка');
  assert.deepStrictEqual(P('/o-proekte/', 'https://vk.com/deloskop_ru?utm_source=site'), { cel: 'vk_click', p: { stranica: '/o-proekte/' } });
  assert.strictEqual(P('/', 'https://m.vk.ru/deloskop_ru').cel, 'vk_click');
  assert.strictEqual(window.dlkPerehod('/nalogi/x/', 'https://vk.com/share.php?url=https%3A%2F%2Fdeloskop.ru', O), null, '«Поделиться» — share_click');
  assert.strictEqual(window.dlkPerehod('/nalogi/x/', 'https://t.me/share/url?url=x', O), null);
});

test('(2) клик: в тексте статьи — цель; в шапке, меню, крошках и подвале — нет', () => {
  const S = zapustit(O + '/nalogi/kak-proverit-schet-pered-oplatoj/');
  S.klik(S.el('a', { href: '/proverit-schet/' }, [{ tag: 'p' }, { tag: 'article' }, { tag: 'main' }]));
  assert.deepStrictEqual(S.celi(), [['article_to_tool', { statya: '/nalogi/kak-proverit-schet-pered-oplatoj/', kuda: '/proverit-schet/', sposob: 'ssylka' }]]);
  for (const predok of [{ tag: 'nav', attr: { class: 'crumbs' } }, { tag: 'header', attr: { class: 'shapka', 'data-shapka': '' } }, { tag: 'div', attr: { class: 'podval' } }]) {
    S.klik(S.el('a', { href: '/proverit-schet/' }, [predok]));
  }
  assert.strictEqual(S.celi().length, 1);
});

test('(3) форма «Проверить» в статье → article_to_tool {sposob: forma}; калькулятор со своей article_to_tool — один раз', () => {
  const S = zapustit(O + '/115-fz/zapros-banka/');
  S.otpravit(S.el('form', { action: '/', method: 'get' }, [{ tag: 'main' }]));
  S.otpravit(S.el('form', { action: '/', method: 'get', 'data-goal': 'article_to_tool', 'data-otkuda': 'kalkulyator' }, [{ tag: 'main' }]));
  const c = S.celi().filter((x) => x[0] === 'article_to_tool');
  assert.strictEqual(c.length, 2, 'форма без цели — 1, калькулятор — 1 (его data-goal), без дубля');
  assert.deepStrictEqual(c[0][1], { statya: '/115-fz/zapros-banka/', kuda: '/', sposob: 'forma' });
  S.otpravit(S.el('form', { class: 'ras__f', 'data-ras': '' }, [{ tag: 'main' }])); // подписка без action — не инструмент
  assert.strictEqual(S.celi().filter((x) => x[0] === 'article_to_tool').length, 2);
});

test('(4) карточка: company_to_check с разделом, ИНН в параметры не уходит', () => {
  const S = zapustit(O + '/company/0274110679-farmstandart/');
  S.klik(S.el('a', { href: '/?inn=0274110679' }, [{ tag: 'p' }, { tag: 'section', attr: { 'aria-labelledby': 'pered' } }, { tag: 'main' }]));
  S.klik(S.el('a', { href: '/pasport/kontragent/?inn=0274110679' }, [{ tag: 'aside', attr: { class: 'co-side', 'aria-labelledby': 'pasport-h' } }]));
  S.klik(S.el('a', { href: '/?inn=0274110679', class: 'btn' }, [{ tag: 'header', attr: { class: 'co-head' } }, { tag: 'main' }]));
  S.klik(S.el('a', { href: '/proverit-schet/' }, [{ tag: 'nav', attr: { class: 'shapka__nav' } }]));
  assert.deepStrictEqual(S.celi(), [
    ['company_to_check', { kuda: '/', mesto: 'pered' }],
    ['company_to_check', { kuda: '/pasport/kontragent/', mesto: 'pasport-h' }],
    ['company_to_check', { kuda: '/', mesto: 'verh' }]
  ]);
  assert.ok(!JSON.stringify(S.celi()).match(/\d{10}/));
});

test('(5) vk_click — из подвала и со страницы; на карточке путь с ИНН не уходит', () => {
  const S = zapustit(O + '/o-proekte/');
  S.klik(S.el('a', { href: 'https://vk.com/deloskop_ru?utm_source=site' }, [{ tag: 'nav', attr: { class: 'podval__col' } }, { tag: 'div', attr: { class: 'podval' } }]));
  S.klik(S.el('a', { href: 'https://vk.com/deloskop_ru' }, [{ tag: 'main' }]));
  assert.deepStrictEqual(S.celi(), [['vk_click', { stranica: '/o-proekte/', mesto: 'podval' }], ['vk_click', { stranica: '/o-proekte/', mesto: 'stranica' }]]);
  const K = zapustit(O + '/company/0274110679-farmstandart/');
  K.klik(K.el('a', { href: 'https://vk.com/deloskop_ru?utm_source=site' }, [{ tag: 'div', attr: { class: 'podval' } }]));
  assert.deepStrictEqual(K.celi(), [['vk_click', { mesto: 'podval' }]]);
});

// По собранному сайту: каждая форма «Проверить» в статьях и разборах и каждая карточка дают цель
function bezNav(h) { return h.replace(/<nav[\s\S]*?<\/nav>/g, ''); }
function main(h) { const i = h.indexOf('<main'), j = h.indexOf('</main>'); return i < 0 ? '' : h.slice(i, j); }
function stranicy(re) {
  const out = [];
  (function obhod(d) {
    for (const f of fs.readdirSync(path.join(KOREN, d), { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { if (!/^(node_modules|tests|js|css|\.git)/.test(p)) obhod(p); }
      else if (f.name === 'index.html') { const put = '/' + d.replace(/\\/g, '/') + '/'; if (re.test(put)) out.push(put); }
    }
  })('');
  return out;
}

test('(6) сайт: формы «Проверить» статей и разборов → article_to_tool; ссылки на инструменты из текста есть', () => {
  const { window } = zapustit(O + '/');
  const st = stranicy(/^\/((115-fz|nalogi)\/[^/]+|praktika\/[^/]+\/[^/]+)\/$/);
  assert.ok(st.length >= 40, 'статей и разборов ' + st.length);
  let form = 0, ssyl = 0;
  for (const s of st) {
    const h = bezNav(main(fs.readFileSync(path.join(KOREN, s, 'index.html'), 'utf8')));
    for (const m of h.matchAll(/<form\b([^>]*)>/g)) {
      const a = /action="([^"]*)"/.exec(m[1]);
      if (!a || /data-goal="article_to_tool"/.test(m[1])) continue;
      const r = window.dlkPerehod(s, a[1], O, 'forma');
      if (r) { assert.strictEqual(r.cel, 'article_to_tool', s); form++; }
    }
    for (const m of h.matchAll(/<a\b[^>]*href="([^"]+)"/g)) { const r = window.dlkPerehod(s, m[1], O); if (r && r.cel === 'article_to_tool') ssyl++; }
  }
  assert.ok(form >= 17, 'форм «Проверить» без своей цели — ' + form);
  assert.ok(ssyl >= st.length, 'ссылок из текста к инструментам — ' + ssyl);
});

test('(7) сайт: на каждой карточке /company/ есть переход к проверке вне навигации; vk_click — ссылка на сообщество на /o-proekte/', () => {
  const { window } = zapustit(O + '/');
  const k = stranicy(/^\/company\/\d{10}[^/]*\/$/);
  assert.ok(k.length >= 100, 'карточек ' + k.length);
  for (const s of k) {
    const h = bezNav(main(fs.readFileSync(path.join(KOREN, s, 'index.html'), 'utf8')));
    const n = [...h.matchAll(/<a\b[^>]*href="([^"]+)"/g)].filter((m) => (window.dlkPerehod(s, m[1], O) || {}).cel === 'company_to_check').length;
    assert.ok(n >= 2, s + ': ' + n);
  }
  const h = fs.readFileSync(path.join(KOREN, 'o-proekte', 'index.html'), 'utf8');
  const vk = [...h.matchAll(/href="(https:\/\/vk\.com\/[^"]+)"/g)].map((m) => window.dlkPerehod('/o-proekte/', m[1].replace(/&amp;/g, '&'), O));
  assert.ok(vk.some((r) => r && r.cel === 'vk_click'));
});
