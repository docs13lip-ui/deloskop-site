/* Делоскоп · пакет «znak3d» — собран tests/sobrat_js.py из 1 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/znak3d.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else { root.DlkZnak3d = api; if (root.document) api.start(root); }
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var KOL = 6, RYADY = 4;
var OTKR = 7, OPECH = 8;
var KACH = [7, 6, 7, 9];
var PAR0 = 10, PARN = 13;
var SHAG_MS = 170, PRIMER_MS = 2800;
var PRIMERY = ['ИНН, название или реквизиты', 'ИНН — 10 или 12 цифр', 'Название компании', 'БИК банка', 'Реквизиты из счёта'];
function kadr(sost, shag, nx) {
if (sost === 'opechatka') return OPECH;
if (shag != null) return KACH[shag % KACH.length];
if (nx == null || sost === 'raspoznano') return OTKR;
return PAR0 + Math.round(Math.max(0, Math.min(1, nx)) * (PARN - 1));
}
function poziciya(n) {
return ((n % KOL) * 100 / (KOL - 1)).toFixed(2) + '% ' + (Math.floor(n / KOL) * 100 / (RYADY - 1)).toFixed(2) + '%';
}
function start(win) {
var doc = win.document, z = doc.querySelector('.z3'), lp = doc.querySelector('.lp'), input = doc.getElementById('inn');
if (!z || z.getAttribute('data-z3-gotovo')) return;
z.setAttribute('data-z3-gotovo', '1');
var mm = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
var tiho = !!(mm && mm.matches), sv = win.navigator && win.navigator.connection;
if (input && !tiho) {
var np = 0;
win.setInterval(function () {
if (input.value || doc.activeElement === input || doc.hidden) return;
np = (np + 1) % PRIMERY.length;
input.setAttribute('placeholder', PRIMERY[np]);
}, PRIMER_MS);
input.addEventListener('focus', function () { np = 0; input.setAttribute('placeholder', PRIMERY[0]); });
}
if (tiho || (sv && sv.saveData)) return;
var adres = z.getAttribute('data-z3-kadry');
if (!adres) return;
var list = new win.Image();
list.onload = function () {
var s = doc.createElement('span');
s.className = 'z3__s';
s.style.backgroundImage = 'url(' + adres + ')';
z.appendChild(s);
var nx = null, shag = null, tik = 0, kadrZhdet = 0, tek = -1;
function sost() { return (lp && lp.getAttribute('data-sost')) || 'zhdet'; }
function risovat() {
kadrZhdet = 0;
var st = sost(), n = kadr(st, shag, nx);
if (z.getAttribute('data-sost') !== st) z.setAttribute('data-sost', st);
if (n !== tek) { tek = n; s.style.backgroundPosition = poziciya(n); }
}
function zaprosit() { if (!kadrZhdet) kadrZhdet = win.requestAnimationFrame(risovat); }
function kachat(da) {
if (da && !tik) { shag = 0; tik = win.setInterval(function () { shag++; zaprosit(); }, SHAG_MS); }
if (!da && tik) { win.clearInterval(tik); tik = 0; shag = null; }
}
function izLp() {
kachat(!!lp && lp.hasAttribute('data-pechat') && sost() === 'vvod');
if (lp && lp.classList.contains('lp--puls')) {
z.classList.remove('z3--puls');
win.requestAnimationFrame(function () { z.classList.add('z3--puls'); });
}
zaprosit();
}
if (lp && win.MutationObserver) {
new win.MutationObserver(izLp).observe(lp, { attributes: true, attributeFilter: ['data-sost', 'data-pechat', 'class'] });
}
if (win.matchMedia && win.matchMedia('(hover: hover) and (pointer: fine)').matches) {
win.addEventListener('pointermove', function (e) {
var w = win.innerWidth || 1;
nx = e.clientX / w;
zaprosit();
}, { passive: true });
doc.addEventListener('pointerleave', function () { nx = null; zaprosit(); });
}
risovat();
z.classList.add('z3--zhiv');
};
list.src = adres;
}
return { kadr: kadr, poziciya: poziciya, start: start, KOL: KOL, RYADY: RYADY, PRIMERY: PRIMERY };
});
;
