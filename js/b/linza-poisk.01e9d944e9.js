/* Делоскоп · пакет «linza-poisk» — собран tests/sobrat_js.py из 1 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/linza-poisk.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else { root.DlkLinzaPoisk = api; if (root.document) api.start(root); }
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
function sostoyanie(R, q) {
var t = String(q == null ? '' : q).replace(/\s+/g, ' ').trim();
if (!t) return { sost: 'zhdet', F: 0 };
if (R && R.err && R.vid !== 'malo_cifr' && R.vid !== 'cifry') return { sost: 'opechatka', F: Math.min(0.85, 0.35 + t.length / 16) };
if (R && R.exact) return { sost: 'raspoznano', F: 1 };
return { sost: 'vvod', F: Math.min(0.9, 0.35 + t.length / 16) };
}
var TIHO_MS = 1600;
function start(win) {
var doc = win.document, el = doc.querySelector('.lp');
var input = doc.getElementById('inn'), form = doc.getElementById('check');
if (!el || el.getAttribute('data-lp-gotovo')) return;
el.setAttribute('data-lp-gotovo', '1');
var tiho = 0, volna = 0;
function obnovit(pechat) {
var P0 = win.DlkPoisk, v = input ? input.value : '';
var st = sostoyanie(P0 && v.trim() ? P0.razobrat(v, []) : null, v);
if (el.getAttribute('data-sost') !== st.sost) el.setAttribute('data-sost', st.sost);
if (pechat && st.sost === 'vvod') {
el.setAttribute('data-pechat', '');
win.clearTimeout(tiho);
tiho = win.setTimeout(function () { el.removeAttribute('data-pechat'); }, TIHO_MS);
} else if (st.sost !== 'vvod') el.removeAttribute('data-pechat');
}
function puls() {
el.classList.remove('lp--puls');
win.cancelAnimationFrame(volna);
volna = win.requestAnimationFrame(function () { el.classList.add('lp--puls'); });
}
if (input) {
input.addEventListener('input', function () { obnovit(true); });
input.addEventListener('keydown', function (e) { if (e.key === 'Enter') puls(); });
}
if (form) form.addEventListener('submit', puls, true);
el.addEventListener('animationend', function (e) { if (e.animationName === 'lp-volna') el.classList.remove('lp--puls'); });
obnovit(false);
}
return { sostoyanie: sostoyanie, start: start, TIHO_MS: TIHO_MS };
});
;
