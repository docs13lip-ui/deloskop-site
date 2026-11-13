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

test('тексты — по решению владельца: вопрос, «Да», «Нет», «Спасибо»', () => {
  assert.deepStrictEqual(P.T, { vopros: 'Ответ помог?', da: 'Да', net: 'Нет', spasibo: 'Спасибо' });
  const h = P.html();
  assert.match(h, /Ответ помог\?/);
  assert.strictEqual((h.match(/<button type="button"/g) || []).length, 2);
  assert.ok(!/textarea|<input/.test(h), 'без поля для текста');
});

test('без хранилища, cookie, Метрики и своего запроса в сеть', () => {
  const kod = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/localStorage|sessionStorage|document\.cookie|indexedDB/.test(kod));
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|dlkGoal|ym\(/.test(kod));
  assert.ok(/dlkSobytie/.test(kod));
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
    set innerHTML(h) { u._html = h; u.deti = []; (h.match(/data-pmg="(da|net)"/g) || []).forEach((m) => { const b = uzel('button', 'pmg__b'); b.atr['data-pmg'] = m.slice(10, -1); u.appendChild(b); }); },
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

test('«Нет» — своё событие', () => {
  const { w, ushlo } = okno();
  const b = P.mount(otchet().rep, R, {}, w);
  b.querySelectorAll('[data-pmg]')[1].slush.click();
  assert.deepStrictEqual(ushlo, ['otvet_pomog_net']);
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
});
