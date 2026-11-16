// pomoglo-v1: «Ответ помог?» под выводом отчёта — только вид события, один ответ на отчёт, без текста и хранилища
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../js/pomoglo.js');
const S = require('../js/schetchik.js');
const kor = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(kor, 'js/pomoglo.js'), 'utf8');

test('виды событий — ровно два, и счёт их принимает', () => {
  assert.strictEqual(P.vidSobytiya('da'), 'otvet_pomog_da');
  assert.strictEqual(P.vidSobytiya('net'), 'otvet_pomog_net');
  assert.strictEqual(P.vidSobytiya('x'), null);
  const okr = { host: 'deloskop.ru', pathname: '/', search: '?inn=7707083893', referrer: 'https://yandex.ru/x' };
  assert.deepStrictEqual(S.teloSobytiya('otvet_pomog_da', okr), { sobytie: 'otvet_pomog_da' });
  assert.deepStrictEqual(S.teloSobytiya('otvet_pomog_net', okr), { sobytie: 'otvet_pomog_net' });
  // на сервер — только вид: ни пути, ни ИНН
  assert.ok(!/7707083893|inn/.test(JSON.stringify(S.teloSobytiya('otvet_pomog_da', okr))));
  assert.strictEqual(S.teloSobytiya('otvet_pomog_da', Object.assign({}, okr, { dnt: '1' })), null);
});

test('тексты — по решению владельца: вопрос, «Да», «Нет», «Спасибо»; после «Нет» — «Чего не хватило?»', () => {
  assert.deepStrictEqual([P.T.vopros, P.T.da, P.T.net, P.T.spasibo, P.T.chego], ['Ответ помог?', 'Да', 'Нет', 'Спасибо', 'Чего не хватило?']);
  const h = P.html();
  assert.match(h, /Ответ помог\?/);
  assert.strictEqual((h.match(/<button type="button"/g) || []).length, 2);
  assert.ok(!/textarea|<input/.test(h), 'без поля для текста');
});

test('без хранилища, cookie и Метрики; в сеть — только счёт событий и строка «Чего не хватило?» в /api/otzyv', () => {
  const kod = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/localStorage|sessionStorage|document\.cookie|indexedDB/.test(kod));
  assert.ok(!/XMLHttpRequest|sendBeacon|dlkGoal|ym\(/.test(kod));
  assert.strictEqual((kod.match(/fetch\(/g) || []).length, 1, 'один запрос');
  assert.match(kod, /w\.fetch\(A \+ "\/api\/otzyv"/);
  assert.ok(/dlkSobytie/.test(kod));
});

test('pomoglo-v2: строка после «Нет» — одна, без почты, телефонов, ИНН и адреса страницы', () => {
  const h = P.htmlNet();
  assert.match(h, /Чего не хватило\?/);
  assert.strictEqual((h.match(/<input /g) || []).length, 1); assert.ok(!/textarea/.test(h));
  assert.match(h, /maxlength="300"/); assert.match(h, /анонимный/);
  const t = P.teloOtzyva(' нет выручки, звоните 8 (912) 345-67-89 или a@b.ru; ИНН 7707083893 ', '0123456789abcdef');
  assert.deepStrictEqual(Object.keys(t).sort(), ['id', 'ocenka', 'rezhim', 'stranica', 'tekst', 'vid'], 'та же форма, что у «Полезно?»');
  assert.strictEqual(t.id, '0123456789abcdef'); assert.strictEqual(t.stranica, '/'); assert.strictEqual(t.vid, 'otchet'); assert.strictEqual(t.ocenka, 'neponyal');
  assert.ok(!/912|a@b|7707083893/.test(t.tekst), t.tekst);
  assert.strictEqual(P.teloOtzyva('   '), null, 'пусто — ничего не шлём');
  assert.strictEqual(P.teloOtzyva('x'.repeat(900)).tekst.length, 300);
  assert.match(P.teloOtzyva('a').id, /^[0-9a-f]{16}$/);
});

// маленький DOM: хватает для mount (querySelector по классу/атрибуту, вставка, клики)
function uzel(tag, cls) {
  const u = { tagName: tag, className: cls || '', atr: {}, deti: [], parentNode: null, slush: {},
    classList: { add(c) { u.className += ' ' + c; } },
    setAttribute(k, v) { u.atr[k] = v; }, getAttribute(k) { return u.atr[k]; },
    appendChild(x) { x.parentNode = u; u.deti.push(x); return x; },
    insertBefore(x, pered) { x.parentNode = u; const i = pered ? u.deti.indexOf(pered) : -1; if (i < 0) u.deti.push(x); else u.deti.splice(i, 0, x); return x; },
    addEventListener(t, f) { u.slush[t] = f; },
    get nextSibling() { const p = u.parentNode; if (!p) return null; return p.deti[p.deti.indexOf(u) + 1] || null; },
    get firstChild() { return u.deti[0] || { focus() {} }; },
    set innerHTML(h) { u._html = h; u.deti = []; (h.match(/data-pmg="(da|net)"/g) || []).forEach((m) => { const b = uzel('button', 'pmg__b'); b.atr['data-pmg'] = m.slice(10, -1); u.appendChild(b); });
      if (/data-pmg-f/.test(h)) { const f = u.appendChild(uzel('form', 'pmg__f')); f.atr['data-pmg-f'] = ''; const i = f.appendChild(uzel('input', 'pmg__i')); i.value = ''; i.focus = () => {}; } },
    get innerHTML() { return u._html || ''; },
    matches(sel) {
      if (sel[0] === '.') return (' ' + u.className + ' ').includes(' ' + sel.slice(1) + ' ');
      const m = /^\[([\w-]+)(?:="?([\w-]+)"?)?\]$/.exec(sel); if (m) return m[1] in u.atr && (m[2] == null || u.atr[m[1]] === m[2]);
      return false;
    },
    vse(sel, acc) { u.deti.forEach((d) => { if (d.matches && d.matches(sel)) acc.push(d); if (d.vse) d.vse(sel, acc); }); return acc; },
    querySelector(sel) { return u.vse(sel, [])[0] || null; },
    querySelectorAll(sel) { return u.vse(sel, []); } };
  return u;
}
function okno(schitaem) {
  const ushlo = [];
  const w = { dlkSobytie: (v) => ushlo.push(v), dlkSchitaem: () => schitaem !== false,
    document: { createElement: (t) => uzel(t) } };
  return { w, ushlo };
}
function otchet() {
  const rep = uzel('section', 'report ot'); rep.ownerDocument = null;
  const vd = rep.appendChild(uzel('section', 'ot-vd'));
  const vt = vd.appendChild(uzel('div', 'ot-vt'));
  vt.appendChild(uzel('div', 'usl'));
  return { rep, vt };
}
const R = { company: { inn: '7707083893' } };

test('ставится под вывод, один ответ — одно событие, потом «Спасибо»', () => {
  const { w, ushlo } = okno();
  const { rep, vt } = otchet();
  const b = P.mount(rep, R, {}, w);
  assert.ok(b, 'блок поставлен');
  assert.strictEqual(vt.deti[vt.deti.length - 1], b, 'последним в колонке вывода');
  const [da, net] = b.querySelectorAll('[data-pmg]');
  assert.strictEqual(da.atr['data-pmg'], 'da'); assert.strictEqual(net.atr['data-pmg'], 'net');
  da.slush.click(); net.slush.click(); da.slush.click();
  assert.deepStrictEqual(ushlo, ['otvet_pomog_da']);
  assert.match(b.innerHTML, /Спасибо/);
  assert.ok(!/<button/.test(b.innerHTML), 'после ответа кнопок нет');
  assert.strictEqual(P.mount(rep, R, {}, w), null, 'второй раз в тот же отчёт не ставится');
});

test('«Нет» — своё событие, затем строка «Чего не хватило?»; отправка — один запрос в /api/otzyv', async () => {
  const { w, ushlo } = okno();
  const zaprosy = [];
  w.fetch = (url, o) => { zaprosy.push([url, JSON.parse(o.body)]); return Promise.resolve({ ok: true }); };
  w.location = { hostname: 'deloskop.ru', protocol: 'https:' };
  const b = P.mount(otchet().rep, R, {}, w);
  b.querySelectorAll('[data-pmg]')[1].slush.click();
  assert.deepStrictEqual(ushlo, ['otvet_pomog_net']);
  assert.match(b.innerHTML, /Чего не хватило/);
  const f = b.querySelector('[data-pmg-f]'), i = b.querySelector('.pmg__i');
  i.value = 'Нет выручки за 2025, ИНН 7707083893';
  f.slush.submit({ preventDefault() {} }); f.slush.submit({ preventDefault() {} });
  await new Promise((z) => setTimeout(z, 0));
  assert.strictEqual(zaprosy.length, 1, 'один раз');
  assert.strictEqual(zaprosy[0][0], 'https://api.deloskop.ru/api/otzyv');
  assert.ok(!/7707083893/.test(JSON.stringify(zaprosy[0][1])), 'ИНН не уходит');
  assert.match(b.innerHTML, /Спасибо/);
});

test('«Нет» и пустая строка — ничего не шлём, «Спасибо»; сервер не принял — «напишите на help@»', async () => {
  const { w } = okno(); let n = 0;
  w.fetch = () => { n++; return Promise.resolve({ ok: false }); };
  w.location = { hostname: 'deloskop.ru', protocol: 'https:' };
  const b = P.mount(otchet().rep, R, {}, w);
  b.querySelectorAll('[data-pmg]')[1].slush.click();
  b.querySelector('[data-pmg-f]').slush.submit({ preventDefault() {} });
  assert.strictEqual(n, 0); assert.match(b.innerHTML, /Спасибо/); assert.ok(!/help@/.test(b.innerHTML));
  const b2 = P.mount(otchet().rep, R, {}, w);
  b2.querySelectorAll('[data-pmg]')[1].slush.click();
  b2.querySelector('.pmg__i').value = 'мало про суды';
  b2.querySelector('[data-pmg-f]').slush.submit({ preventDefault() {} });
  await new Promise((z) => setTimeout(z, 0));
  assert.strictEqual(n, 1); assert.match(b2.innerHTML, /help@deloskop\.ru/);
});

test('pomoglo-v2: на телефоне — сразу под строкой «Ответ» (первый экран), на компьютере — под выводом', () => {
  const mk = () => {
    const rep = uzel('section', 'report ot'); rep.ownerDocument = null;
    const who = rep.appendChild(uzel('div', 'ot-who'));
    const lo = who.appendChild(uzel('a', 'lip-o'));
    const vd = rep.appendChild(uzel('section', 'ot-vd'));
    const vt = vd.appendChild(uzel('div', 'ot-vt')); vt.appendChild(uzel('div', 'usl'));
    return { rep, who, lo, vt };
  };
  const tel = okno(); tel.w.matchMedia = (q) => ({ matches: q === P.UZKO });
  const a = mk(); const b = P.mount(a.rep, R, {}, tel.w);
  assert.strictEqual(b.parentNode, a.who); assert.strictEqual(a.who.deti[1], b, 'сразу после «Ответ»');
  assert.match(b.className, /pmg--verh/);
  const k = okno(); k.w.matchMedia = () => ({ matches: false });
  const c = mk(); const b2 = P.mount(c.rep, R, {}, k.w);
  assert.strictEqual(b2.parentNode, c.vt); assert.ok(!/pmg--verh/.test(b2.className));
  // строка «Ответ» скрыта (вывода нет) — под вывод, как на компьютере
  const d = mk(); d.lo.hidden = true;
  assert.strictEqual(P.mount(d.rep, R, {}, tel.w).parentNode, d.vt);
  assert.strictEqual(P.UZKO, '(max-width: 600px)', 'та же граница, что у строки «Ответ» (js/lipkaya.js, css/perehod.css)');
});

test('не спрашиваем: своя компания, пример, нет ИНН, счёт выключен (DNT/GPC/робот)', () => {
  assert.strictEqual(P.mount(otchet().rep, R, { svoj: true }, okno().w), null);
  assert.strictEqual(P.mount(otchet().rep, { company: { inn: '0000000000' } }, {}, okno().w), null);
  assert.strictEqual(P.mount(otchet().rep, { company: {} }, {}, okno().w), null);
  assert.strictEqual(P.mount(otchet().rep, R, {}, okno(false).w), null);
  assert.strictEqual(P.mount(otchet().rep, R, {}, { document: {} }), null, 'нет счётчика событий');
});

test('лист не разложен — после блока вывода', () => {
  const rep = uzel('div', 'report'); rep.ownerDocument = null;
  const ver = rep.appendChild(uzel('div', 'verdict'));
  const akt = rep.appendChild(uzel('div', 'report-actions'));
  const b = P.mount(rep, R, {}, okno().w);
  assert.deepStrictEqual(rep.deti, [ver, b, akt]);
});

test('подключение: пакет «otchet», главная зовёт после раскладки листа, не для своей компании; стиль печать прячет', () => {
  const sb = JSON.parse(fs.readFileSync(path.join(kor, 'partials/sborka.json'), 'utf8'));
  assert.ok(sb.pakety.otchet.includes('js/pomoglo.js'));
  const ix = fs.readFileSync(path.join(kor, 'index.html'), 'utf8');
  const i1 = ix.indexOf('Otchet.razlozhit(report'), i2 = ix.indexOf('DlkPomoglo.mount(report');
  assert.ok(i1 > 0 && i2 > i1, 'после Otchet.razlozhit');
  assert.match(ix, /if\(!svoj&&window\.DlkPomoglo(&&!primer)?\)/);
  const css = fs.readFileSync(path.join(kor, 'css/otchet.css'), 'utf8');
  assert.match(css, /@media print\{\.pmg\{display:none\}\}/);
  assert.match(css, /\.pmg__b\{[^}]*min-height:44px/);
  assert.match(css, /\.pmg__i\{[^}]*min-height:44px[^}]*font-size:17px/, 'поле — 44 px и 17 px (без увеличения на iPhone)');
  assert.match(css, /\.pmg--verh\{[^}]*border-top:0/);
});
