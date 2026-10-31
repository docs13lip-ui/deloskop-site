/* Делоскоп · пакет «glavnaya» — собран tests/sobrat_js.py из 11 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/vhody.js --- */
(function () {
"use strict";
function cel(el) {
var v = el.closest ? el.closest("[data-vhod]") : null;
return v ? v.getAttribute("data-vhod") : null;
}
document.addEventListener("click", function (e) {
var a = e.target.closest ? e.target.closest(".vhod a") : null;
if (!a) return;
var c = cel(a);
if (c && typeof window.dlkGoal === "function") {
window.dlkGoal(c, { kuda: a.getAttribute("href") });
}
if (a.hasAttribute("data-vhod-inn")) {
var inp = document.getElementById("inn");
if (!inp) return;
e.preventDefault();
var tiho = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
inp.scrollIntoView({ behavior: tiho ? "auto" : "smooth", block: "center" });
try { inp.focus({ preventScroll: true }); } catch (x) { inp.focus(); }
try { history.replaceState(null, "", "#inn"); } catch (x) {}
}
});
})();
;
/* --- /js/zhivoj-indeks.js --- */
(function (W, d) {
'use strict';
var tiho = !W.matchMedia || !W.matchMedia('(prefers-reduced-motion: no-preference)').matches;
var IO = W.IntersectionObserver, raf = W.requestAnimationFrame, kolca = [];
function zona(n) { return n >= 70 ? 'ok' : n >= 50 ? 'warn' : n >= 30 ? 'high' : 'bad'; }
function el(c, v) { var e = d.createElement('div'); e.className = c; if (v) e.appendChild(v); return e; }
function vse(s, f) { [].forEach.call(d.querySelectorAll(s), f); }
function kolco(n, zn, centr, uzel, gotovo) {
var z = gotovo;
if (!z) {
var k = el('zhi__kolco');
z = el('zhi', el('zhi__scena', k));
'svet fon duga strelka'.split(' ').forEach(function (c) { k.appendChild(el('zhi__' + c)); });
k.appendChild(el('zhi__chislo', centr));
}
z.setAttribute('data-zona', zn);
kolca.push(z);
if (tiho || uzel.nodeType === 3) z.style.setProperty('--p', n);
if (tiho) return z;
z.addEventListener('pointermove', function (e) {
var r = z.getBoundingClientRect();
if (e.pointerType == 'mouse') kadr(z, ((e.clientY - r.top) / r.height - 0.5) * -16, ((e.clientX - r.left) / r.width - 0.5) * 20);
}, { passive: true });
z.addEventListener('pointerleave', function () { kadr(z, 0, 0); });
function itog() { uzel.nodeValue = String(n); z.style.setProperty('--p', n); }
function start() {
if (z.idet || !z.isConnected) return;
z.idet = 1;
var t0;
z.style.setProperty('--p', 0);
uzel.nodeValue = '0';
void z.offsetWidth;
z.classList.add('is-idet');
raf(function () { z.style.setProperty('--p', n); });
raf(function shag(t) {
t0 = t0 || t;
var x = Math.min(1, (t - t0) / 1200);
uzel.nodeValue = String(Math.round(n * x * (2 - x)));
if (x < 1) raf(shag);
});
setTimeout(itog, 1500);
}
function posle(f) { var vt = d.activeViewTransition; if (vt && vt.finished) vt.finished.then(f, f); else f(); }
if (!IO) { posle(start); return z; }
var io = new IO(function (e) { if (e[e.length - 1].isIntersecting) { io.disconnect(); posle(start); } }, { threshold: 0.4 });
io.observe(z);
setTimeout(function () { io.disconnect(); }, 1200);
return z;
}
function primery() {
vse('.ex-ix[data-zhi]', function (b) {
var n = +b.getAttribute('data-zhi'), g = b.firstElementChild;
g = g && g.classList.contains('zhi') ? g : null;
var z = kolco(n, zona(n), d.createTextNode(''), {}, g);
b.removeAttribute('data-zhi');
if (g) return;
z.setAttribute('role', 'img');
z.setAttribute('aria-label', b.getAttribute('data-zhi-aria'));
z.appendChild(el('zhi__pod'));
b.insertBefore(z, b.firstChild);
});
}
function otchety() {
vse('.ot-ix .ot-ix__big', function (big) {
var t = big.firstChild, n = +(t && t.nodeValue), ix = big.parentNode;
if (!(n >= 1 && n <= 99) || big.closest('.zhi')) return;
var lv = ix.querySelector('[class*="ot-ix__lv--"]'), m = lv && /ot-ix__lv--(ok|warn|bad)\b/.exec(lv.className);
var za = big.nextSibling;
ix.insertBefore(kolco(n, m ? m[1] : zona(n), big, t), za);
ix.classList.add('ot-ix--zhi');
});
}
var zhdu;
function kadr(zz, rx, ry) {
[].concat(zz).forEach(function (z) { z.r = [rx, ry]; });
zhdu = zhdu || raf(function () {
zhdu = 0;
kolca.forEach(function (z) { if (z.r) { z.style.setProperty('--rx', z.r[0] + 'deg'); z.style.setProperty('--ry', z.r[1] + 'deg'); z.r = 0; } });
});
}
if (!tiho) {
var DO = W.DeviceOrientationEvent;
if (DO && !DO.requestPermission) W.addEventListener('deviceorientation', function (e) {
var c = function (v, m) { return Math.max(-m, Math.min(m, v * 0.4)); };
if (e.beta != null) kadr(kolca, c(45 - e.beta, 8), c(e.gamma, 10));
}, { passive: true });
}
var css = W.CSS && CSS.supports('animation-timeline', 'view()');
var io = !css && IO && new IO(function (e) {
e.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-vidno'); io.unobserve(x.target); } });
}, { threshold: 0.15 });
function sobrat() {
if (tiho || !(css || io)) return;
if (io) d.documentElement.classList.add('zhi-io');
vse('[data-sobir]>*,.pr-gl>a,.report:not(.ex) .row', function (b) {
if (b.classList.contains('sobir')) return;
b.style.setProperty('--i', Math.min([].indexOf.call(b.parentNode.children, b), 3));
var r = b.getBoundingClientRect();
if (io) { if (r.top < innerHeight && r.bottom > 0) b.classList.add('is-vidno'); else io.observe(b); }
b.classList.add('sobir');
});
}
function vsyo() { primery(); otchety(); sobrat(); }
vsyo();
if (W.MutationObserver) {
var zh = 0;
new MutationObserver(function () { otchety(); if (!zh) zh = setTimeout(function () { zh = 0; vsyo(); }, 50); })
.observe(d.body, { childList: true, subtree: true });
}
})(window, document);
;
/* --- /js/vizual2.js --- */
(function (W, d) {
'use strict';
var tiho = !W.matchMedia || !W.matchMedia('(prefers-reduced-motion: no-preference)').matches;
var mysh = !!W.matchMedia && W.matchMedia('(hover:hover) and (pointer:fine)').matches;
var raf = W.requestAnimationFrame.bind(W);
function vse(s, f, k) { [].forEach.call((k || d).querySelectorAll(s), f); }
function el(t, c) { var e = d.createElement(t); if (c) e.className = c; return e; }
function oborot(tabs, f, rows, p) {
var kn = [].slice.call(tabs.querySelectorAll('[role=tab]'));
var flip = el('div', 'ex-flip'), vn = el('div', 'ex-flip__in'), lico = el('div', 'ex-lico'), zad = el('div', 'ex-zad');
var zh = el('div', 'ex-f__h'), zb = el('b');
zh.appendChild(zb); zad.appendChild(zh);
var spis = el('div', 'ex-zad__r'); zad.appendChild(spis);
var pod = el('p', 'ex-zad__pod'); pod.textContent = tabs.getAttribute('data-pod') || ZAG_POD; pod.hidden = true; if (pod.textContent) zad.appendChild(pod);
f.parentNode.insertBefore(flip, f);
lico.appendChild(f);
vn.appendChild(lico); vn.appendChild(zad); flip.appendChild(vn);
lico.id = p + '-lico'; zad.id = p + '-zad';
lico.setAttribute('role', 'tabpanel'); zad.setAttribute('role', 'tabpanel');
var mesto = rows.map(function (r) { var m = d.createComment(''); r.parentNode.insertBefore(m, r); return m; });
function nazad() { if (W.Svyazi) Svyazi.ubrat(spis); rows.forEach(function (r, i) { if (r.parentNode !== f) mesto[i].parentNode.insertBefore(r, mesto[i].nextSibling); }); }
function vpered(v, zhivo) {
nazad();
rows.forEach(function (r) { if ((' ' + r.getAttribute('data-vid') + ' ').indexOf(' ' + v + ' ') >= 0) spis.appendChild(r); });
pod.hidden = v === 'svyazi';
if (v === 'svyazi' && W.Svyazi) Svyazi.pokazat(spis, f, zhivo);
}
function podpis(b) { return b.getAttribute('data-zag') || ''; }
function vysota() {
var tek = vn.getAttribute('data-vid'), h = 0;
vn.style.minHeight = '';
nazad(); h = lico.offsetHeight;
kn.forEach(function (b) {
var v = b.getAttribute('data-vid');
if (v === 'svodka') return;
zb.textContent = podpis(b); vpered(v);
h = Math.max(h, zad.scrollHeight);
});
nazad();
if (tek && tek !== 'svodka') { var b = tabs.querySelector('[data-vid="' + tek + '"]'); zb.textContent = podpis(b); vpered(tek); }
vn.style.minHeight = Math.ceil(h) + 'px';
vys0 = Math.ceil(h);
}
var vys0 = 0;
if (W.ResizeObserver) new W.ResizeObserver(function () {
if (!vys0) return;
vn.style.minHeight = vys0 + 'px';
if (vn.getAttribute('data-vid') !== 'svyazi') return;
vn.style.minHeight = Math.max(vys0, Math.ceil(zad.scrollHeight)) + 'px';
}).observe(spis);
function vybrat(b, fokus) {
var v = b.getAttribute('data-vid'), na = v !== 'svodka';
kn.forEach(function (x) { var s = x === b; x.setAttribute('aria-selected', s ? 'true' : 'false'); x.tabIndex = s ? 0 : -1; });
if (fokus) b.focus();
var bylo = vn.getAttribute('data-vid') || 'svodka';
if (bylo === v) return;
if (bylo === 'svodka') vysota();
vn.setAttribute('data-vid', v);
zad.setAttribute('aria-labelledby', b.id);
if (na) {
var smena = function () { zb.textContent = podpis(b); vpered(v, true); };
if (bylo !== 'svodka' && !tiho) { zad.classList.add('is-smena'); setTimeout(function () { smena(); zad.classList.remove('is-smena'); }, 160); }
else smena();
} else if (!tiho) setTimeout(function () { if (vn.getAttribute('data-vid') === 'svodka') nazad(); }, 600);
else nazad();
vn.classList.toggle('is-oborot', na);
skryt(lico, na); skryt(zad, !na);
}
function skryt(x, s) {
if (s) { x.setAttribute('aria-hidden', 'true'); x.setAttribute('inert', ''); } else { x.removeAttribute('aria-hidden'); x.removeAttribute('inert'); }
}
kn.forEach(function (b, i) {
b.id = b.id || p + '-vid-' + b.getAttribute('data-vid');
b.setAttribute('aria-controls', b.getAttribute('data-vid') === 'svodka' ? lico.id : zad.id);
b.addEventListener('click', function () { vybrat(b); });
b.addEventListener('keydown', function (e) {
var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
if (!k) return;
e.preventDefault();
vybrat(kn[(i + k + kn.length) % kn.length], true);
});
});
lico.setAttribute('aria-labelledby', kn[0].id);
skryt(zad, true);
tabs.hidden = false;
vysota();
var t, rz = function () { if (!flip.isConnected) return W.removeEventListener('resize', rz); clearTimeout(t); t = setTimeout(vysota, 150); };
W.addEventListener('resize', rz);
W.addEventListener('beforeprint', function () { if (flip.isConnected) vybrat(kn[0]); });
if (d.fonts && d.fonts.ready) d.fonts.ready.then(vysota);
}
function primer(rep) {
var tabs = rep.querySelector('.ex-vid'), f = rep.querySelector('.ex-f');
if (tabs && f) oborot(tabs, f, [].slice.call(f.querySelectorAll('.ex-r[data-vid]')), 'ex');
}
var VID = {
bank: /^(status|address|age|rukovoditel|zsk|employees|damia_priostanovki|damia_bankrotstvo)$/,
nalog: /^(status|address|tax_debt|otchetnost|kapital|likvidnost|ubytki|skachok|damia_priostanovki|damia_bankrotstvo)$/
};
var ZAG = [], ZAG_ARIA = '', ZAG_POD = '';
function otchet(f) {
if (f.getAttribute('data-v2') || f.closest('.ex-flip') || !f.closest('.ot-main')) return;
var rows = [].slice.call(f.querySelectorAll(':scope > .sut__r[data-fakt]'));
if (!rows.length) return;
f.setAttribute('data-v2', '1');
var est = {};
rows.forEach(function (r) {
var k = r.getAttribute('data-fakt'), v = [];
for (var x in VID) if (VID[x].test(k)) { v.push(x); est[x] = 1; }
r.setAttribute('data-vid', v.join(' '));
});
var vid = ZAG.filter(function (z) { return z[0] === 'svodka' || est[z[0]]; });
if (W.Svyazi && Svyazi.est(f)) vid.push(['svyazi', 'Связи', 'Связи компании']);
if (vid.length < 2) return;
var tabs = el('div', 'ex-vid ot-vid');
tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', ZAG_ARIA);
vid.forEach(function (z, i) {
var b = el('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('data-vid', z[0]);
b.setAttribute('aria-selected', i ? 'false' : 'true'); if (i) b.tabIndex = -1;
if (z[2]) b.setAttribute('data-zag', z[2]);
b.textContent = z[1]; tabs.appendChild(b);
});
f.parentNode.insertBefore(tabs, f);
oborot(tabs, f, rows, 'ot');
}
function otchety() { vse('.report:not(.ex) .rows.sut:not(.sut--svoj)', otchet); }
function cvet() {
var c = (W.getComputedStyle(d.documentElement).getPropertyValue('--ink') || '').trim(), m = /^#?([\da-f]{6})$/i.exec(c);
var n = parseInt(m ? m[1] : '1D1D1F', 16);
return [n >> 16, (n >> 8) & 255, n & 255].join(',');
}
function set(host, pole) {
var nc = W.navigator && W.navigator.connection;
if ((nc && nc.saveData) || (W.matchMedia && W.matchMedia('(prefers-reduced-data: reduce)').matches)) return;
var cv = el('canvas', 'set'), cx = cv.getContext && cv.getContext('2d');
if (!cx) return;
cv.setAttribute('aria-hidden', 'true');
host.classList.add('set-host');
host.insertBefore(cv, host.firstChild);
var dbg = /(?:^|[?&])debug=set\b/.test(W.location.search), rgb = cvet();
var T = [], w = 0, h = 0, dpr = 1, vidno = true, idet = 0, t0 = 0, tyaga = 0, tyagaK = 0, tyagaS = 0, ox = 0, oy = 0, cxp = 0, cyp = 0;
var zamer = [], cel = [];
function razmer() {
var r = cv.getBoundingClientRect();
w = Math.round(r.width); h = Math.round(r.height);
dpr = Math.min(2, W.devicePixelRatio || 1);
cv.width = w * dpr; cv.height = h * dpr;
cx.setTransform(dpr, 0, 0, dpr, 0, 0);
var n = dbg ? 60 : w < 560 ? 24 : Math.max(40, Math.min(60, Math.round(w * h / 16000)));
while (T.length < n) T.push({ x: Math.random() * w, y: Math.random() * h, a: Math.random() * 6.283, s: 6 + Math.random() * 4, f: Math.random() * 6.283, r: 1.5 + Math.random(), o: 0.10 + Math.random() * 0.08, k: 0 });
T.length = n;
T.forEach(function (p) { p.x = Math.min(p.x, w); p.y = Math.min(p.y, h); });
host.setAttribute('data-set-n', n);
}
function celi() {
var a = cv.getBoundingClientRect(), b = pole.getBoundingClientRect(), out = [];
for (var i = 0; i < 12; i++) out.push([b.left - a.left + (i % 6 + 0.5) / 6 * b.width, (i < 6 ? b.top : b.bottom) - a.top]);
return out;
}
function shag(dt, t) {
T.forEach(function (p) {
var u = p.a + Math.sin(t / 3000 + p.f) * 0.9;
p.x += Math.cos(u) * p.s * dt; p.y += Math.sin(u) * p.s * dt;
if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20;
});
var k = Math.max(0, Math.min(1, (t - tyagaS) / 400)), e = 1 - Math.pow(1 - k, 3);
tyaga = tyagaK ? e : (1 - e) * tyaga0;
if (!tyagaK && k >= 1) { T.forEach(function (p) { p.k = 0; p.c = null; }); }
}
var tyaga0 = 0;
function risovat() {
var a = dbg ? performance.now() : 0, i, j, p, q, n = T.length, X = [], Y = [], st = [], par = [];
cx.clearRect(0, 0, w, h);
for (i = 0; i < n; i++) {
p = T[i]; var k = p.c ? tyaga : 0;
X[i] = (p.c ? p.x + (p.c[0] - p.x) * k : p.x) + ox; Y[i] = (p.c ? p.y + (p.c[1] - p.y) * k : p.y) + oy; st[i] = 0;
}
for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
var dx = X[i] - X[j], dy = Y[i] - Y[j], r2 = dx * dx + dy * dy;
if (r2 < 19600) par.push([r2, i, j]);
}
par.sort(function (u, v) { return u[0] - v[0]; });
cx.lineWidth = 1;
for (i = 0; i < par.length; i++) {
p = par[i];
if (st[p[1]] > 1 || st[p[2]] > 1) continue;
st[p[1]]++; st[p[2]]++;
cx.strokeStyle = 'rgba(' + rgb + ',' + (0.14 * (1 - Math.sqrt(p[0]) / 140)).toFixed(3) + ')';
cx.beginPath(); cx.moveTo(X[p[1]], Y[p[1]]); cx.lineTo(X[p[2]], Y[p[2]]); cx.stroke();
}
for (i = 0; i < n; i++) {
q = T[i];
cx.fillStyle = 'rgba(' + rgb + ',' + q.o.toFixed(3) + ')';
cx.beginPath(); cx.arc(X[i], Y[i], q.r, 0, 6.283); cx.fill();
}
if (dbg && a) {
zamer.push(performance.now() - a);
if (zamer.length === 120) {
var s = zamer.reduce(function (u, v) { return u + v; }, 0) / 120;
W.__set = { tochek: n, kadr_ms: +s.toFixed(3) };
if (W.console) W.console.log('[set] n=' + n + ' kadr_ms=' + s.toFixed(3));
}
}
}
function kadr(t) {
idet = 0;
if (!vidno || d.hidden) return;
var dt = t0 ? Math.min(0.05, (t - t0) / 1000) : 0; t0 = t;
ox += (cxp - ox) * 0.08; oy += (cyp - oy) * 0.08;
shag(dt, t); risovat();
idet = raf(kadr);
}
function pusk() { if (!tiho && !idet && vidno && !d.hidden) { t0 = 0; idet = raf(kadr); } }
razmer();
if (W.MutationObserver) new W.MutationObserver(function () { rgb = cvet(); risovat(); }).observe(d.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
risovat();
if (tiho) {
var tr; W.addEventListener('resize', function () { clearTimeout(tr); tr = setTimeout(function () { razmer(); risovat(); }, 150); });
return;
}
var tm; W.addEventListener('resize', function () { clearTimeout(tm); tm = setTimeout(razmer, 150); });
if (W.IntersectionObserver) new W.IntersectionObserver(function (e) { vidno = e[0].isIntersecting; pusk(); }).observe(host);
d.addEventListener('visibilitychange', pusk);
if (pole) {
pole.addEventListener('focus', function () {
cel = celi();
var zan = {};
cel.forEach(function (c) {
var best = -1, bd = 1e12;
T.forEach(function (p, i) { var dx = p.x - c[0], dy = p.y - c[1], r = dx * dx + dy * dy; if (!zan[i] && r < bd) { bd = r; best = i; } });
if (best >= 0) { zan[best] = 1; T[best].c = c; }
});
tyagaK = 1; tyagaS = performance.now();
});
pole.addEventListener('blur', function () { tyaga0 = tyaga; tyagaK = 0; tyagaS = performance.now(); });
}
if (mysh) {
host.addEventListener('pointermove', function (e) {
if (e.pointerType !== 'mouse') return;
var r = host.getBoundingClientRect();
cxp = ((e.clientX - r.left) / r.width - 0.5) * 12; cyp = ((e.clientY - r.top) / r.height - 0.5) * 12;
}, { passive: true });
host.addEventListener('pointerleave', function () { cxp = cyp = 0; });
}
pusk();
}
function forma(f) {
var inp = f.querySelector('input'), kn = f.querySelector('button[type=submit],button:not([type])');
if (!inp || !kn) return;
f.classList.add('v2-forma');
var pol = el('span', 'inn-pol'), i = el('i');
pol.setAttribute('aria-hidden', 'true'); pol.appendChild(i); f.appendChild(pol);
function mesto() { pol.style.left = inp.offsetLeft + 'px'; pol.style.width = inp.offsetWidth + 'px'; pol.style.top = (inp.offsetTop + inp.offsetHeight - 4) + 'px'; }
function obnovit() {
var v = inp.value, c = v.replace(/\D/g, '');
var bukvy = /[^\d\s-]/.test(v);
f.classList.remove('is-inn-ok', 'is-inn-ne');
if (!c.length || bukvy || c.length > 12) { pol.removeAttribute('data-vid'); i.style.transform = 'scaleX(0)'; return; }
var L = c.length > 10 ? 12 : 10;
pol.setAttribute('data-vid', '1');
i.style.transform = 'scaleX(' + (c.length / L).toFixed(3) + ')';
if (c.length === L) {
var ok = W.DlkInn ? W.DlkInn.ok(c) : null;
if (ok === true) f.classList.add('is-inn-ok'); else if (ok === false) f.classList.add('is-inn-ne');
}
}
mesto(); obnovit();
inp.addEventListener('input', obnovit);
var t; W.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(mesto, 150); });
if (tiho || !mysh) return;
var zhdu = 0, ex = 0, ey = 0;
d.addEventListener('pointermove', function (e) {
if (e.pointerType !== 'mouse') return;
ex = e.clientX; ey = e.clientY;
zhdu = zhdu || raf(function () {
zhdu = 0;
var r = kn.getBoundingClientRect(), dx = Math.max(r.left - ex, 0, ex - r.right), dy = Math.max(r.top - ey, 0, ey - r.bottom);
if (Math.sqrt(dx * dx + dy * dy) > 24) { if (kn.classList.contains('is-magnit')) { kn.classList.remove('is-magnit'); kn.style.transform = ''; } return; }
var mx = (ex - (r.left + r.width / 2)) / (r.width / 2 + 24), my = (ey - (r.top + r.height / 2)) / (r.height / 2 + 24);
kn.classList.add('is-magnit');
kn.style.transform = 'translate(' + (Math.max(-1, Math.min(1, mx)) * 4).toFixed(2) + 'px,' + (Math.max(-1, Math.min(1, my)) * 4).toFixed(2) + 'px)';
});
}, { passive: true });
}
function start() {
vse('.report.ex .ex-vid', function (t) {
ZAG_ARIA = t.getAttribute('aria-label'); ZAG_POD = t.getAttribute('data-pod') || '';
vse('[role=tab]', function (b) { ZAG.push([b.getAttribute('data-vid'), b.textContent, b.getAttribute('data-zag') || '']); }, t);
});
vse('.report.ex[data-oborot]', primer);
var rep = d.querySelector('.report');
if (rep && W.MutationObserver) { var mt; new W.MutationObserver(function () { clearTimeout(mt); mt = setTimeout(otchety, 60); }).observe(rep, { childList: true, subtree: true }); }
otchety();
vse('[data-set]', function (h) { set(h, d.getElementById(h.getAttribute('data-set-pole'))); });
vse('form.check, form.ask', forma);
}
if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(window, document);
;
/* --- /js/istochniki.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.DlkIstochniki = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var NB = ' ';
var OTVETIL = { found: 1, not_found: 1, not_applicable: 1 };
var EFRSB = 'https://fedresurs.ru/';
var OGOVORKA_EFRSB = 'сообщения ЕФРСБ не проверяли';
function dataProverki(r) {
var x = Date.parse((r && r.checked_at) || '');
if (!isFinite(x)) return null;
var q = new Date(x + 3 * 3600 * 1000);
function z(n) { return (n < 10 ? '0' : '') + n; }
return q.getUTCFullYear() + '-' + z(q.getUTCMonth() + 1) + '-' + z(q.getUTCDate());
}
function statusSignal(r) {
var S = Array.isArray(r && r.signals) ? r.signals : [];
for (var i = 0; i < S.length; i++) {
var s = S[i];
if (s && String(s.title || '').replace(/ /g, ' ').trim() === 'Статус') return s;
}
return null;
}
function bankrotstvoIzEgryul(r) {
var c = r && r.company;
if (!c || typeof c !== 'object' || !c.inn) return null;
if (c.kind === 'INDIVIDUAL' || String(c.inn).length === 12) return null;
var st = String(c.status || '').toUpperCase(), sg = statusSignal(r);
var det = sg ? String(sg.detail || '').replace(/ /g, ' ') : '';
if (!st && !sg) return null;
var data = dataProverki(r);
var b = { nazvanie: 'Банкротство', istochnik: 'ЕГРЮЛ ФНС', data_svedeniy: data, iz_egryul: true,
ogovorka: OGOVORKA_EFRSB, proverit_samim: EFRSB };
if (st === 'BANKRUPT' || /банкрот/i.test(det)) {
b.status = 'found'; b.uroven = 'bad';
b.itog = 'Процедура банкротства — отметка в' + NB + 'ЕГРЮЛ';
b.dubl_statusa = true;
} else if (st === 'LIQUIDATED') {
b.status = 'not_applicable';
b.prichina = 'Компания прекратила деятельность — см.' + NB + '«Статус»';
} else if (st === 'ACTIVE' || st === 'LIQUIDATING' || st === 'REORGANIZING') {
b.status = 'not_found';
b.itog = 'Отметки о банкротстве в' + NB + 'ЕГРЮЛ нет; ' + OGOVORKA_EFRSB;
} else return null;
b.sostoyanie = b.status;
return b;
}
var SLOVAR_API = { polucheno: 1, ne_provereno: 1 };
function privestiSlovar(dm) {
Object.keys(dm).forEach(function (k) {
var b = dm[k];
if (!b || typeof b !== 'object' || !SLOVAR_API[b.status]) return;
var s = b.sostoyanie;
b.status_api = b.status;
b.status = OTVETIL[s] ? s : 'not_checked';
if (!b.sostoyanie) b.sostoyanie = b.status;
});
}
function sudyItog(b) {
var a = b && b.analitika;
if (!a || typeof a !== 'object' || a.oshibka || !a.svodka || b.status !== 'found') return;
var t = [String(a.svodka)];
if (a.dolya_vyruchki && a.dolya_vyruchki.tekst) t.push(String(a.dolya_vyruchki.tekst));
if (a.trend && a.trend.rost && a.trend.tekst) t.push(String(a.trend.tekst));
if (!b.itog_prezhnij) b.itog_prezhnij = b.itog || '';
b.itog = t.join(' ');
if (a.dolya_vyruchki && a.dolya_vyruchki.ton === 'bad') b.uroven = 'bad';
b.chto_sdelat = (Array.isArray(a.chto_sdelat) ? a.chto_sdelat : []).filter(function (x) { return x && x.soglasovano === true && x.tekst; });
}
function sudyNol(b) {
if (!b || typeof b !== 'object' || typeof b.itog !== 'string') return;
var t = b.itog.replace(/(\d+)\s+на\s+0\s*₽/g, '$1; сумма исков в' + NB + 'картотеке не' + NB + 'указана');
if (t !== b.itog) { if (!b.itog_prezhnij) b.itog_prezhnij = b.itog; b.itog = t; }
}
var SAMI = [
[/^service\.nalog\.ru\/bi/, 'в' + NB + 'сервисе ФНС о' + NB + 'приостановлениях'],
[/^egrul\.nalog\.ru/, 'в' + NB + 'ЕГРЮЛ'], [/^pb\.nalog\.ru/, 'в' + NB + '«Прозрачном бизнесе» ФНС'],
[/^bo\.nalog\.ru/, 'в' + NB + 'ГИР' + NB + 'БО'], [/^rmsp\.nalog\.ru/, 'в' + NB + 'реестре МСП'],
[/^m4d\.nalog\.gov\.ru/, 'в' + NB + 'реестре доверенностей ФНС'],
[/^(?:www\.)?cbr\.ru\/fmp_check/, 'в' + NB + 'справочнике Банка России'],
[/^(?:www\.)?cbr\.ru\/finorg/, 'в' + NB + 'карточке Банка России'], [/^(?:www\.)?cbr\.ru/, 'на' + NB + 'сайте Банка России'],
[/^bankrot\.fedresurs\.ru/, 'в' + NB + 'ЕФРСБ'], [/^(?:www\.)?fedresurs\.ru/, 'на' + NB + 'Федресурсе'],
[/^kad\.arbitr\.ru/, 'в' + NB + 'картотеке арбитражных дел'], [/^(?:www\.)?fssp\.gov\.ru/, 'в' + NB + 'банке данных ФССП'],
[/^zakupki\.gov\.ru/, 'в' + NB + 'ЕИС закупок'], [/^(?:www\.)?reestr-zalogov\.ru/, 'в' + NB + 'реестре залогов'],
[/^(?:www\.)?reestr-dover\.ru/, 'в' + NB + 'реестре нотариальных доверенностей'],
[/^(?:www\.)?fips\.ru/, 'в' + NB + 'реестрах Роспатента'], [/^pub\.fsa\.gov\.ru/, 'в' + NB + 'реестре Росаккредитации'],
[/^(?:www\.)?nalog\.(?:gov\.)?ru/, 'на' + NB + 'сайте ФНС']
];
function samiTekst(url) {
var m = /^https?:\/\/([^?#]+)/i.exec(String(url || ''));
if (!m) return 'проверьте сами';
var put = m[1].toLowerCase();
for (var i = 0; i < SAMI.length; i++) if (SAMI[i][0].test(put)) return 'проверить ' + SAMI[i][1];
return 'проверить на' + NB + put.split('/')[0].replace(/^www\./, '');
}
var REESTR = {
kad: { damia: ['sudy', 'bankrotstvo'], ustarelo_dney: 7, sostoyanie: 'zamorozhen', s: '2026-10-12' },
fssp: { damia: ['fssp'], ustarelo_dney: 7, sostoyanie: 'zamorozhen', s: '2026-10-12' },
eis: { damia: ['rnp', 'kontrakty'], ustarelo_dney: 30, sostoyanie: 'zamorozhen', s: '2026-10-12' },
nalog_bi: { damia: ['priostanovki', 'mery'], ustarelo_dney: 1, sostoyanie: 'zamorozhen', s: '2026-10-12' }
};
var PO_BLOKU = {};
Object.keys(REESTR).forEach(function (id) { REESTR[id].damia.forEach(function (k) { PO_BLOKU[k] = id; }); });
var STATUSY = ['found', 'not_found', 'not_connected', 'error', 'stale', 'not_applicable', 'user'];
function dmyIz(v) {
var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
}
function dniMezhdu(a, b) {
var x = Date.parse(String(a || '').slice(0, 10)), y = Date.parse(String(b || '').slice(0, 10));
return isFinite(x) && isFinite(y) ? Math.floor((y - x) / 864e5) : null;
}
function statusIstochnika(b) {
if (!b || typeof b !== 'object') return 'not_connected';
if (b.otmetka_polzovatelya || b.status === 'user') return 'user';
if (b.status === 'stale' || b.ustarelo) return b.status === 'found' ? 'found' : 'stale';
if (b.status === 'found' || b.status === 'not_found' || b.status === 'not_applicable') return b.status;
if (b.oshibka || b.status === 'error') return 'error';
return 'not_connected';
}
function statusTekst(b) {
var k = statusIstochnika(b), ist = (b && (b.istochnik || b.nazvanie)) || 'источник', d = dmyIz(b && b.data_svedeniy);
if (k === 'found') return (b.ustarelo ? 'Данные на' + NB + d + ' — могли измениться. ' : '') + (b.itog || 'Сведения найдены');
if (k === 'not_found') return 'В' + NB + 'источнике записей нет' + (d ? ' — на' + NB + d : '') + '.';
if (k === 'stale') return 'Данные устарели: сведения на' + NB + d + ' — могли измениться. Это не значит, что записей нет.';
if (k === 'not_applicable') return b.prichina || 'Не применяется.';
if (k === 'user') return 'Со слов пользователя · Делоскоп не проверял.';
if (k === 'error') return 'Не удалось проверить: ' + ist + ' не ответил. Повторите позже.';
return 'Не проверяли: ' + (b && b.zamorozhen ? 'источник сейчас не обновляется.' : ist + ' пока не подключён.');
}
function ustarevanie(r) {
var dm = r && r.damia;
if (!dm || typeof dm !== 'object') return r;
var na = (r.checked_at || '').slice(0, 10), snyato = 0;
Object.keys(PO_BLOKU).forEach(function (k) {
var b = dm[k], ist = REESTR[PO_BLOKU[k]];
if (!b || typeof b !== 'object' || b.iz_egryul) return;
if (ist.sostoyanie === 'zamorozhen' && (b.status === 'not_checked' || b.sostoyanie === 'not_checked')) {
b.zamorozhen = true;
if (b.prichina && !b.prichina_api) b.prichina_api = b.prichina;
b.prichina = 'источник сейчас не' + NB + 'обновляется';
b.itog_ne_provereno = 'Не проверяли: источник сейчас не' + NB + 'обновляется.';
return;
}
if (b.status !== 'found' && b.status !== 'not_found') return;
var dn = dniMezhdu(b.data_svedeniy, na);
if (dn == null || dn <= ist.ustarelo_dney) return;
b.ustarelo = true; b.ustarelo_dney = dn; snyato++;
if (b.status === 'not_found') {
b.status_do = 'not_found'; b.status = 'stale'; b.sostoyanie = 'stale';
b.prichina = 'данные на' + NB + dmyIz(b.data_svedeniy) + ' устарели — сведения могли измениться';
b.itog_ne_provereno = 'Данные устарели: сведения на' + NB + dmyIz(b.data_svedeniy) + '.';
}
});
if (snyato && dm.polnota && typeof dm.polnota === 'object' && isFinite(dm.polnota.provereno)) {
dm.polnota = { provereno: Math.max(0, Number(dm.polnota.provereno) - snyato), iz: dm.polnota.iz, ustarelo: snyato };
}
return r;
}
function dopolnit(r) {
if (!r || typeof r !== 'object' || !r.company) return r;
var dm = r.damia && typeof r.damia === 'object' ? r.damia : null;
if (dm) { privestiSlovar(dm); sudyItog(dm.sudy); sudyNol(dm.sudy); ustarevanie(r); }
var est = dm && dm.bankrotstvo && typeof dm.bankrotstvo === 'object' ? dm.bankrotstvo : null;
var bankrotEgryul = String((r.company || {}).status || '').toUpperCase() === 'BANKRUPT';
if (!est || !OTVETIL[est.status] || (bankrotEgryul && est.status === 'not_found')) {
var b = bankrotstvoIzEgryul(r);
if (b) {
if (!dm) { dm = {}; r.damia = dm; }
if (est && est.proverit_samim) b.proverit_samim = est.proverit_samim;
dm.bankrotstvo = b;
if (dm.polnota && typeof dm.polnota === 'object' && isFinite(dm.polnota.provereno) && !(est && OTVETIL[est.status]) && !(est && est.ustarelo)) {
dm.polnota = { provereno: Number(dm.polnota.provereno) + 1, iz: dm.polnota.iz };
}
}
}
var f = dm && dm.fssp;
if (f && typeof f === 'object' && OTVETIL[f.status] && f.sostoyanie !== f.status) f.sostoyanie = f.status;
if (dm) Object.keys(dm).forEach(function (k) { var b = dm[k]; if (b && typeof b === 'object' && k !== 'polnota') { b.status_edinyj = statusIstochnika(b); b.status_edinyj_tekst = statusTekst(b); } });
return r;
}
function uchten(b) {
if (!b || typeof b !== 'object' || b.iz_egryul || b.ustarelo) return false;
return b.status === 'provereno' || b.status === 'found' || b.status === 'not_found';
}
return { dopolnit: dopolnit, ustarevanie: ustarevanie, statusIstochnika: statusIstochnika, statusTekst: statusTekst, STATUSY: STATUSY, REESTR: REESTR, bankrotstvoIzEgryul: bankrotstvoIzEgryul, uchten: uchten, privestiSlovar: privestiSlovar, sudyItog: sudyItog, sudyNol: sudyNol, samiTekst: samiTekst, OGOVORKA_EFRSB: OGOVORKA_EFRSB };
});
;
/* --- /js/imya.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.DlkImya = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var KAV = /["\u201C\u201D\u201E\u00AB\u00BB]/;
var PROBEL = /[\s\u00A0(\[\/]/;
function kavychki(s) {
if (s == null) return s;
s = String(s);
if (!KAV.test(s)) return s;
var out = '', glub = 0, predOtkr = false;
for (var i = 0; i < s.length; i++) {
var ch = s.charAt(i);
if (!KAV.test(ch)) { out += ch; predOtkr = false; continue; }
var pred = i > 0 ? s.charAt(i - 1) : '', sled = i + 1 < s.length ? s.charAt(i + 1) : '';
var otkr;
if (ch === '\u00AB' || ch === '\u201E') otkr = true;
else if (ch === '\u00BB') otkr = false;
else if (glub === 0) otkr = true;
else otkr = (pred === '' || PROBEL.test(pred) || predOtkr) && sled !== '' && !/\s/.test(sled);
if (otkr) { out += glub === 0 ? '\u00AB' : '\u201E'; glub++; }
else if (glub > 0) { glub--; out += glub === 0 ? '\u00BB' : '\u201C'; }
predOtkr = otkr;
}
while (glub > 0) { glub--; out += glub === 0 ? '\u00BB' : '\u201C'; }
return out;
}
var OPF_SLOVA = ['ОБЩЕСТВО', 'ТОВАРИЩЕСТВО', 'КОРПОРАЦИЯ', 'КОМПАНИЯ', 'ПРЕДПРИЯТИЕ', 'УЧРЕЖДЕНИЕ', 'КООПЕРАТИВ',
'ПАРТНЕРСТВО', 'ПАРТНЁРСТВО', 'ОРГАНИЗАЦИЯ', 'ФОНД', 'ХОЛДИНГ', 'ГОСКОРПОРАЦИЯ'];
var OPF_SOKR = /^(ООО|ОАО|ЗАО|ПАО|НАО|АО|АНО|ГУП|МУП|ФГУП|УК)(\s|["\u00AB\u201E]|$)/;
function organizaciya(s) {
if (typeof s !== 'string') return false;
s = s.trim();
if (!s) return false;
if (OPF_SOKR.test(s) || KAV.test(s)) return true;
return s.toUpperCase().split(/[^А-ЯЁA-Z]+/).some(function (w) { return OPF_SLOVA.indexOf(w) >= 0; });
}
function ispravitOtvet(r) {
if (!r || typeof r !== 'object') return r;
var c = r.company;
if (c && typeof c === 'object') {
if (typeof c.name_short === 'string') c.name_short = kavychki(c.name_short);
if (typeof c.name_full === 'string') c.name_full = kavychki(c.name_full);
if (c.kind !== 'INDIVIDUAL' && organizaciya(c.director_name)) {
c.director_org = true;
c.director_name = kavychki(c.director_name.trim());
if (!c.director_post || !String(c.director_post).trim()) c.director_post = 'Управляющая организация';
}
}
var sek = r.dossier && r.dossier.sections;
if (Array.isArray(sek)) sek.forEach(function (x) {
(x && Array.isArray(x.rows) ? x.rows : []).forEach(function (row) {
if (Array.isArray(row) && typeof row[0] === 'string' && typeof row[1] === 'string' && /наименовани/i.test(row[0])) row[1] = kavychki(row[1]);
});
var rows = x && Array.isArray(x.rows) ? x.rows : [], org = false;
rows.forEach(function (row) {
if (Array.isArray(row) && row[0] === 'Руководитель' && organizaciya(row[1]) && !(c && c.kind === 'INDIVIDUAL')) {
row[0] = 'Управляющая организация'; row[1] = kavychki(row[1].trim()); org = true;
}
});
if (org) {
rows.forEach(function (row) { if (Array.isArray(row) && row[0] === 'Руководит с') row[0] = 'Управляет с'; });
if (x.comment === 'Руководитель стабилен.') x.comment = 'Управляющая организация не менялась.';
}
});
var ist = typeof DlkIstochniki !== 'undefined' ? DlkIstochniki : (typeof require === 'function' ? (function () { try { return require('./istochniki.js'); } catch (e) { return null; } })() : null);
if (ist && ist.dopolnit) ist.dopolnit(r);
return r;
}
return { kavychki: kavychki, ispravitOtvet: ispravitOtvet, organizaciya: organizaciya };
});
;
/* --- /js/kanaly.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.DlkKanaly = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var DOMENY = { max: /^https:\/\/max\.ru\/[A-Za-z0-9_.\-\/?=&]+$/, vk: /^https:\/\/vk\.me\/[A-Za-z0-9_.\-]+$/, tg: /^https:\/\/t\.me\/[A-Za-z0-9_]+$/ };
function ssylki(d) {
var out = {};
Object.keys(DOMENY).forEach(function (k) {
var u = d && typeof d[k] === 'string' ? d[k].trim() : '';
if (u && DOMENY[k].test(u)) out[k] = u;
});
return out;
}
function primenit(doc, s) {
var est = false;
Array.prototype.forEach.call(doc.querySelectorAll('[data-kanal]'), function (a) {
var u = s[a.getAttribute('data-kanal')];
if (u) { a.href = u + (u.indexOf('?') < 0 ? '?' : '&') + 'start=sait'; a.hidden = false; a.rel = 'noopener'; est = true; }
else a.hidden = true;
});
Array.prototype.forEach.call(doc.querySelectorAll('[data-kanaly-blok]'), function (b) { b.hidden = !est; });
Array.prototype.forEach.call(doc.querySelectorAll('[data-kanaly-net]'), function (b) { b.hidden = est; });
return est;
}
if (typeof document !== 'undefined' && typeof fetch === 'function') {
var go = function () {
fetch('/data/kanaly.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; })
.then(function (d) { primenit(document, ssylki(d)); }).catch(function () {});
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}
return { ssylki: ssylki, primenit: primenit, DOMENY: DOMENY };
});
;
/* --- /js/portfel.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.Portfel = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var NB = '\u00a0';
var K_SNIMKI = 'dlk_snimki', K_NEDAVNIE = 'dlk_nedavnie';
var DEN = 864e5, STARYJ_DNEJ = 30, POKAZ = 10;
var UR = {
mnogo: { p: 0, t: 'Много признаков риска', s: 'много признаков риска' },
ser: { p: 1, t: 'Есть серьёзные сигналы', s: 'есть серьёзные сигналы' },
vopr: { p: 2, t: 'Есть вопросы', s: 'есть вопросы' },
bez: { p: 3, t: 'Без серьёзных сигналов', s: 'без серьёзных сигналов' },
net: { p: 4, t: 'Итог не сохранён', s: '' }
};
var IZ_API = { high: 'ser', medium: 'vopr', low: 'bez' };
var INN_RE = /^\d{10}(\d{2})?$/;
var ISKL = { '105': 1, '106': 1, '107': 1, '108': 1, '110': 1 };
var ISKLYUCHENA = { '407': 1, '414': 1, '415': 1, '418': 1, '420': 1 };
function kav(t) { var D = typeof window !== 'undefined' && window.DlkImya; return D ? D.kavychki(t) : t; }
function esc(t) {
return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
});
}
function mn(n, f1, f2, f5) {
var a = Math.abs(n) % 100, b = a % 10;
if (a > 10 && a < 20) return f5;
if (b > 1 && b < 5) return f2;
if (b === 1) return f1;
return f5;
}
function uroven(x) {
if (!x) return 'net';
var ix = Number(x.ix);
if (x.ix != null && isFinite(ix) && ix >= 1 && ix <= 99) return ix >= 70 ? 'bez' : ix >= 50 ? 'vopr' : ix >= 30 ? 'ser' : 'mnogo';
return IZ_API[x.lvl] || IZ_API[x.level] || 'net';
}
function sobrat(snimki, nedavnie) {
var po = {};
function vzyat(inn, t, ur, nm) {
inn = String(inn || '');
if (!INN_RE.test(inn) || /^0+$/.test(inn) || !isFinite(t) || t <= 0) return;
var ip = inn.length === 12, imya = ip ? '' : String(nm || '').trim().slice(0, 120);
var b = po[inn];
if (!b) { po[inn] = { inn: inn, ip: ip, t: t, ur: ur, nm: imya }; return; }
if (t > b.t) { b.t = t; b.ur = ur; if (imya) b.nm = imya; }
else if (!b.nm && imya) b.nm = imya;
if (b.ur === 'net' && ur !== 'net' && Math.abs(t - b.t) < 3600 * 1000) b.ur = ur;
}
if (snimki && typeof snimki === 'object' && !Array.isArray(snimki)) {
Object.keys(snimki).forEach(function (inn) {
var a = Array.isArray(snimki[inn]) ? snimki[inn] : [];
a.forEach(function (s) { if (s && String(s.inn) === inn) vzyat(inn, Number(s.t), uroven(s), s.nm); });
});
}
(Array.isArray(nedavnie) ? nedavnie : []).forEach(function (x) {
if (x) vzyat(x.inn, Number(x.t), uroven(x), x.name);
});
if (snimki && typeof snimki === 'object' && !Array.isArray(snimki)) {
Object.keys(po).forEach(function (inn) {
var a = Array.isArray(snimki[inn]) ? snimki[inn].filter(function (s) { return s && String(s.inn) === inn && isFinite(Number(s.t)); }) : [];
if (!a.length || po[inn].ip) return;
var z = a.reduce(function (m, s) { return Number(s.t) > Number(m.t) ? s : m; });
var k = String(z.kod || '');
if ((ISKL[k] || ISKLYUCHENA[k]) && Number(z.t) >= po[inn].t - 3600 * 1000) po[inn].isk = k;
});
}
return Object.keys(po).map(function (k) { return po[k]; }).sort(function (a, b) {
return (UR[a.ur].p - UR[b.ur].p) || (a.t - b.t);
});
}
function dm(t, now) {
var d = new Date(t), n = new Date(now);
var s = ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2);
return d.getFullYear() !== n.getFullYear() ? s + '.' + d.getFullYear() : s;
}
function dnej(t, now) {
var a = new Date(t), b = new Date(now);
a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
return Math.max(0, Math.round((b - a) / DEN));
}
function kogda(t, now) {
var n = dnej(t, now), d = dm(t, now);
if (n > STARYJ_DNEJ) return { staryj: true, t: 'Сведения на' + NB + d + ' — перед платежом перепроверьте' };
var s = n === 0 ? 'сегодня' : n === 1 ? 'вчера' : n + NB + mn(n, 'день', 'дня', 'дней') + ' назад';
return { staryj: false, t: 'Проверено ' + s + ' · ' + d };
}
function svetofor(rows) {
var c = { mnogo: 0, ser: 0, vopr: 0, bez: 0 };
rows.forEach(function (r) { if (r.ur in c) c[r.ur]++; });
return ['mnogo', 'ser', 'vopr', 'bez'].filter(function (k) { return c[k]; }).map(function (k) {
return '<span class="pf__s pf__s--' + k + '"><b class="n">' + c[k] + '</b>' + NB + '— ' + UR[k].s + '</span>';
}).join(' · ');
}
var KREST = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function stroka(r, now) {
var k = kogda(r.t, now);
var imya = r.ip ? 'Индивидуальный предприниматель' : (r.nm ? kav(r.nm) : 'Компания');
return '<li class="pf__r" data-inn="' + r.inn + '">' +
'<div class="pf__a"><b class="pf__nm">' + esc(imya) + '</b><span class="pf__pill pf__pill--' + r.ur + '">' + UR[r.ur].t + '</span>' +
(r.isk ? '<span class="pf__isk">' + (ISKLYUCHENA[r.isk] ? 'Компания исключена из' + NB + 'ЕГРЮЛ' : 'ФНС готовит исключение из' + NB + 'ЕГРЮЛ' + (r.isk === '108' ? ' по' + NB + 'сведениям Банка России' : '')) + '</span>' : '') + '</div>' +
'<div class="pf__b"><span class="pf__inn n">ИНН' + NB + r.inn + '</span><span class="pf__d n' + (k.staryj ? ' pf__d--star' : '') + '">' + k.t + '</span></div>' +
'<div class="pf__c"><button type="button" class="pf__go" data-pf-go="' + r.inn + '">Перепроверить</button>' +
'<button type="button" class="pf__x" data-pf-x="' + r.inn + '" aria-label="Убрать из списка">' + KREST + '</button></div></li>';
}
function html(rows, now, opt) {
opt = opt || {};
var n = rows.length;
if (!n) return '';
var vid = opt.vse ? rows : rows.slice(0, POKAZ);
var sv = svetofor(rows);
return '<h2 class="pf__h" id="pf-h">Ваши контрагенты</h2>' +
'<p class="pf__pod">Последние проверки в' + NB + 'этом браузере — ' + n + NB + mn(n, 'компания', 'компании', 'компаний') +
'. Список хранится только у' + NB + 'вас и' + NB + 'не' + NB + 'уходит на' + NB + 'наш сервер.</p>' +
(sv ? '<p class="pf__sv">' + sv + '</p><p class="pf__nb">По последней проверке каждой компании, а' + NB + 'не' + NB + 'на' + NB + 'сегодня.</p>' : '') +
'<ul class="pf__list">' + vid.map(function (r) { return stroka(r, now); }).join('') + '</ul>' +
(n > POKAZ && !opt.vse ? '<button type="button" class="pf__vse" data-pf-vse>Показать все ' + n + '</button>' : '') +
'<div class="pf__niz"><button type="button" class="pf__clr" data-pf-clr>Очистить список</button>' +
'<div class="pf__conf" data-pf-conf hidden role="alertdialog" aria-label="Очистить список"><span>Удалить из' + NB + 'этого браузера все ' + n + NB +
mn(n, 'проверку', 'проверки', 'проверок') + '? Отменить нельзя.</span>' +
'<button type="button" class="pf__da" data-pf-da>Удалить</button><button type="button" class="pf__net" data-pf-net>Оставить</button></div></div>';
}
function chitat(ls) {
var s = {}, n = [];
try { var o = JSON.parse(ls.getItem(K_SNIMKI) || '{}'); if (o && typeof o === 'object' && !Array.isArray(o)) s = o; } catch (e) {}
try { var a = JSON.parse(ls.getItem(K_NEDAVNIE) || '[]'); if (Array.isArray(a)) n = a; } catch (e) {}
return { s: s, n: n };
}
function ubrat(ls, inn) {
var d = chitat(ls);
delete d.s[inn];
try { ls.setItem(K_SNIMKI, JSON.stringify(d.s)); } catch (e) {}
try { ls.setItem(K_NEDAVNIE, JSON.stringify(d.n.filter(function (x) { return !x || x.inn !== inn; }))); } catch (e) {}
}
function ochistit(ls) {
try { ls.removeItem(K_SNIMKI); } catch (e) {}
try { ls.removeItem(K_NEDAVNIE); } catch (e) {}
}
var st = { el: null, opt: null, vse: false, pokazan: false };
function cel(c, p) { try { if (typeof window !== 'undefined' && window.dlkGoal) window.dlkGoal(c, p); } catch (e) {} }
function hranilishche() { try { return st.opt.ls || window.localStorage || null; } catch (e) { return null; } }
function skryt() {
if (!st.el) return;
st.el.hidden = true;
var h = st.el.closest ? st.el.closest('.hero') : null;
if (h) h.classList.remove('pf-on');
}
function narisovat() {
var el = st.el, ls = hranilishche();
if (!el) return 0;
var d = ls ? chitat(ls) : { s: {}, n: [] };
var rows = sobrat(d.s, d.n);
var h = el.closest ? el.closest('.hero') : null;
var report = h ? h.querySelector('.report') : null;
if (!rows.length || (report && !report.classList.contains('ex'))) { el.innerHTML = ''; skryt(); return 0; }
el.innerHTML = html(rows, Date.now(), { vse: st.vse });
el.hidden = false;
if (h) h.classList.add('pf-on');
if (!st.pokazan) { st.pokazan = true; cel('portfel_pokaz', { n: rows.length }); }
return rows.length;
}
function klik(e) {
var b = e.target.closest ? e.target.closest('button') : null;
if (!b || !st.el.contains(b)) return;
var ls = hranilishche(), o = st.opt;
if (b.hasAttribute('data-pf-go')) {
var inn = b.getAttribute('data-pf-go');
cel('portfel_pereproverit');
if (o.input) o.input.value = inn;
try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
if (o.form) { if (o.form.requestSubmit) o.form.requestSubmit(); else o.form.dispatchEvent(new Event('submit', { cancelable: true })); }
return;
}
if (b.hasAttribute('data-pf-x')) { if (ls) ubrat(ls, b.getAttribute('data-pf-x')); cel('portfel_ubrat'); narisovat(); return; }
if (b.hasAttribute('data-pf-vse')) { st.vse = true; narisovat(); return; }
var conf = st.el.querySelector('[data-pf-conf]');
if (b.hasAttribute('data-pf-clr') && conf) { conf.hidden = false; b.hidden = true; var da = conf.querySelector('[data-pf-da]'); if (da) da.focus(); return; }
if (b.hasAttribute('data-pf-net') && conf) { conf.hidden = true; var c = st.el.querySelector('[data-pf-clr]'); if (c) { c.hidden = false; c.focus(); } return; }
if (b.hasAttribute('data-pf-da')) { if (ls) ochistit(ls); cel('portfel_ochistit'); narisovat(); }
}
function mount(el, opt) {
if (!el) return 0;
st.el = el; st.opt = opt || {};
if (!el.dataset.pf) { el.dataset.pf = '1'; el.addEventListener('click', klik); }
try { return narisovat(); } catch (e) { skryt(); return 0; }
}
return { sobrat: sobrat, uroven: uroven, kogda: kogda, html: html, ubrat: ubrat, ochistit: ochistit, chitat: chitat,
mount: mount, skryt: skryt, obnovit: function () { return narisovat(); }, UR: UR, K_SNIMKI: K_SNIMKI, K_NEDAVNIE: K_NEDAVNIE };
});
;
/* --- /js/perehod.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.DlkPerehod = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var PARY = [
['dlk-kolco', '.zhi__kolco', '.ot-vd .zhi__kolco'],
['dlk-kompaniya', '.ex-hd .company', '.ot-hd .company'],
['dlk-vyvod', '.ex-vt', '.ot-vt']
];
var FAKTOV = 3;
var FAKT_PRIMER = '.ex-f .row', FAKT_OTCHET = '.rows.sut .sut__r';
function elementy(rep) {
if (!rep || !rep.querySelectorAll) return [];
var ex = rep.classList.contains('ex'), out = [];
PARY.forEach(function (p) {
var e = rep.querySelector(ex ? p[1] : p[2]);
if (e) out.push([p[0], e]);
});
var f = rep.querySelectorAll(ex ? FAKT_PRIMER : FAKT_OTCHET);
for (var i = 0; i < f.length && i < FAKTOV; i++) out.push(['dlk-fakt-' + (i + 1), f[i]]);
return out;
}
function nazvat(rep) {
var sp = elementy(rep);
sp.forEach(function (x) { x[1].style.viewTransitionName = x[0]; });
return sp;
}
function snyat(sp) { (sp || []).forEach(function (x) { x[1].style.viewTransitionName = ''; }); }
function tiho(w) {
try { return !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}
function mozhno(doc) {
var w = doc && doc.defaultView;
return !!(w && typeof doc.startViewTransition === 'function' && !tiho(w));
}
function smena(rep, fn, doc) {
doc = doc || (rep && rep.ownerDocument);
if (!mozhno(doc)) { fn(); return Promise.resolve(false); }
var staroe = nazvat(rep), novoe = [];
var vt;
try {
vt = doc.startViewTransition(function () {
snyat(staroe);
try { fn(); } catch (e) { setTimeout(function () { throw e; }, 0); }
novoe = nazvat(rep);
});
} catch (e) { snyat(staroe); fn(); return Promise.resolve(false); }
var konec = function () { snyat(novoe); snyat(staroe); };
if (vt.finished) vt.finished.then(konec, konec);
var gotovo = vt.updateCallbackDone || vt.finished || Promise.resolve();
return gotovo.then(function () { return true; }, function () { return true; });
}
return { smena: smena, mozhno: mozhno, elementy: elementy, PARY: PARY, FAKTOV: FAKTOV };
});
;
/* --- /js/zhivoj-otchet.js --- */
(function (W, d) {
'use strict';
function tiho() { return !W.matchMedia || !W.matchMedia('(prefers-reduced-motion: no-preference)').matches; }
function reestry(q) {
var ip = /^\d{12}$/.test(String(q || '').replace(/\s/g, ''));
return (ip ? ['ЕГРИП'] : ['ЕГРЮЛ', 'ГИР БО']).concat(['суды', 'ФССП', 'ФНС', 'ЕИС']);
}
function zhdu(note, q) {
note.className = 'note zh-ist';
note.textContent = '';
var p = d.createElement('span');
p.className = 'zh-ist__p';
p.textContent = 'Проверяем по реестрам: ';
note.appendChild(p);
reestry(q).forEach(function (t, i) {
if (i) {
var r = d.createElement('span');
r.className = 'zh-ist__r';
r.setAttribute('aria-hidden', 'true');
r.textContent = '\u00a0· ';
note.appendChild(r);
}
var s = d.createElement('span');
s.className = 'zh-ist__i';
s.setAttribute('data-t', t);
s.style.setProperty('--i', i);
s.textContent = t;
note.appendChild(s);
});
}
function pojav(report) {
var vd = report && report.querySelector('.ot-vd');
if (!vd || tiho()) return;
var i = 0;
[].forEach.call(vd.querySelectorAll('.ot-vt>*,.ot-act>*'), function (e) { e.style.setProperty('--zh-i', Math.min(i++, 6)); });
vd.classList.add('ot-vd--pojav');
setTimeout(function () { vd.classList.remove('ot-vd--pojav'); }, 1400);
}
W.DlkZhivoj = { zhdu: zhdu, pojav: pojav, reestry: reestry };
})(window, document);
;
/* --- /js/vitrina.js --- */
(function (W, d) {
'use strict';
if (!W.matchMedia || !W.requestAnimationFrame) return;
var vit = d.getElementById('vitrina');
var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
var uzko = matchMedia('(max-width: 860px)');
var sceny = d.querySelectorAll('.vit-e__scena');
var IO = 'IntersectionObserver' in W;
if (vit) {
vit.classList.add('vit--js');
var kn = vit.querySelectorAll('.vit-e__fb');
var pokazat = function () { for (var i = 0; i < kn.length; i++) kn[i].hidden = !uzko.matches; };
pokazat();
if (uzko.addEventListener) uzko.addEventListener('change', pokazat);
vit.addEventListener('click', function (e) {
var b = e.target.closest && e.target.closest('.vit-e__fb');
if (!b) return;
var li = b.closest('.vit-e, .vit-b'), otkr = !li.classList.contains('is-f');
li.classList.toggle('is-f', otkr);
b.setAttribute('aria-expanded', otkr ? 'true' : 'false');
});
}
var fb = d.getElementById('fbOpen');
if (fb && IO) {
var vidny = new Set(), tajmer = 0, nabl = null;
var KNOPKI = '.vit-btn, .vit-lnk, .vit-e__fb, .ot-btn, .lip, .btn, .check button';
var obnovit = function () {
if (vidny.size) { clearTimeout(tajmer); tajmer = 0; d.body.classList.add('fb-ukryt'); }
else if (!tajmer) tajmer = setTimeout(function () { tajmer = 0; d.body.classList.remove('fb-ukryt'); }, 600);
};
var sledit = function () {
if (nabl) nabl.disconnect();
vidny.clear();
var verh = Math.max(0, (W.innerHeight || 800) - 120);
nabl = new IntersectionObserver(function (zap) {
for (var i = 0; i < zap.length; i++) { if (zap[i].isIntersecting) vidny.add(zap[i].target); else vidny.delete(zap[i].target); }
obnovit();
}, { rootMargin: '-' + verh + 'px 0px 0px 0px' });
var s = d.querySelectorAll(KNOPKI);
for (var i = 0; i < s.length; i++) if (s[i] !== fb) nabl.observe(s[i]);
};
sledit();
var rt = 0;
W.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(sledit, 200); }, { passive: true });
}
var zal = vit && vit.querySelector('.vit__zal');
if (zal && IO) {
var ex = zal.querySelectorAll('.vit-e'), vsego = ex.length, dd = function (n) { return (n < 10 ? '0' : '') + n; };
var ind = d.createElement('div');
ind.className = 'vit-ind'; ind.setAttribute('aria-hidden', 'true');
ind.innerHTML = '<b class="vit-ind__n"></b><span class="vit-ind__sl">/ ' + dd(vsego) + '</span><span class="vit-ind__dor"><i></i></span>' +
'<span class="vit-ind__vs">' + dd(vsego) + '</span><span class="vit-ind__ns"></span>';
d.body.appendChild(ind);
var nN = ind.querySelector('.vit-ind__n'), nS = ind.querySelector('.vit-ind__ns'), dor = ind.querySelector('.vit-ind__dor i');
var karta = {}, kl = vit.querySelectorAll('.vit-k');
for (var j = 0; j < kl.length; j++) karta[(kl[j].getAttribute('href') || '').slice(1)] = kl[j];
var tek = null, vZale = false, shk = false, pokaz = 0, rafI = 0, tm = 0, zagl = [], podZag = false, svob = 0;
var zagolovki = function () { zagl = Array.prototype.slice.call(vit.querySelectorAll('h2,h3')); };
var rezhim = function () {
var r = ex[0] && ex[0].getBoundingClientRect();
shk = !!r && W.innerWidth >= 1100 && r.left >= 76;
ind.classList.toggle('vit-ind--shk', shk); ind.classList.toggle('vit-ind--tab', !shk);
zagolovki();
};
var vidno = function () {
var t = Date.now();
ind.classList.toggle('is-vid', vZale && !!tek && (shk || (t - pokaz < 800 && !podZag && t - svob >= 300)));
};
var vybrat = function (li) {
if (li === tek || (li && tek && li.offsetTop === tek.offsetTop)) return;
if (tek && karta[tek.id]) karta[tek.id].removeAttribute('aria-current');
tek = li;
if (!li) return vidno();
var n = Array.prototype.indexOf.call(ex, li) + 1;
nN.textContent = dd(n); nS.textContent = li.getAttribute('data-kratko') || '';
if (karta[li.id]) karta[li.id].setAttribute('aria-current', 'location');
vidno();
};
var hod = function () {
rafI = 0;
var r = zal.getBoundingClientRect(), c = W.innerHeight / 2;
dor.style.setProperty('--hod', Math.max(0, Math.min(1, (c - r.top) / (r.height || 1))).toFixed(3));
if (!shk) {
var R = ind.getBoundingClientRect(), v = R.top - 8, n = R.top + 46, byl = podZag, posl = null;
podZag = false;
for (var i = 0; i < zagl.length; i++) {
var q = zagl[i].getBoundingClientRect();
if (q.height && q.bottom > v && q.top < n) podZag = true;
if (q.height && q.top < n) { var li = zagl[i].closest('.vit-e'); if (li) posl = li; }
}
if (byl && !podZag) { svob = Date.now(); setTimeout(vidno, 310); }
if (posl) vybrat(posl);
}
vidno();
};
var sered = new IntersectionObserver(function (zap) {
var luch = null;
for (var i = 0; i < zap.length; i++) {
var li = zap[i].target;
if (zap[i].isIntersecting && (!luch || Array.prototype.indexOf.call(ex, li) < Array.prototype.indexOf.call(ex, luch))) luch = li;
}
if (luch && shk) vybrat(luch);
}, { rootMargin: '-50% 0px -49% 0px' });
for (var k = 0; k < ex.length; k++) sered.observe(ex[k]);
new IntersectionObserver(function (zap) {
vZale = zap[zap.length - 1].isIntersecting;
if (!vZale) vybrat(null);
vidno();
}, { rootMargin: '-50% 0px -49% 0px' }).observe(zal);
W.addEventListener('scroll', function () {
if (!vZale) return;
pokaz = Date.now();
if (!rafI) rafI = requestAnimationFrame(hod);
if (!shk) { clearTimeout(tm); tm = setTimeout(vidno, 820); }
}, { passive: true });
rezhim();
W.addEventListener('resize', function () { rezhim(); vidno(); }, { passive: true });
}
if (reduce || !sceny.length) return;
var mysh = matchMedia('(hover: hover) and (pointer: fine)').matches;
function postavit(s, x, y) {
s.style.setProperty('--px', x.toFixed(3));
s.style.setProperty('--py', y.toFixed(3));
var t = s.querySelector('.vit-e__tilt');
if (t) { t.style.setProperty('--ry', (x * 16).toFixed(2) + 'deg'); t.style.setProperty('--rx', (-y * 12).toFixed(2) + 'deg'); }
}
if (mysh) {
Array.prototype.forEach.call(sceny, function (s) {
var b = s.querySelector('.vit-e__blik'), raf = 0, x = 0, y = 0;
function kadr() {
raf = 0; postavit(s, x, y);
if (b) b.style.transform = 'translate3d(' + ((x + 0.5) * 166).toFixed(1) + '%,' + ((y + 0.5) * 166).toFixed(1) + '%,0)';
}
s.addEventListener('pointermove', function (e) {
var r = s.getBoundingClientRect();
if (!r.width || !r.height) return;
x = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
y = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
if (!raf) raf = requestAnimationFrame(kadr);
}, { passive: true });
s.addEventListener('pointerleave', function () { x = 0; y = 0; if (!raf) raf = requestAnimationFrame(kadr); }, { passive: true });
});
}
var naEkrane = new Set();
var chastica = new Map();
if (!mysh && W.DeviceOrientationEvent && typeof W.DeviceOrientationEvent.requestPermission !== 'function') {
var b0 = null, g0 = null, rafO = 0, ox = 0, oy = 0;
W.addEventListener('deviceorientation', function (e) {
if (e.beta == null || e.gamma == null) return;
if (b0 === null) { b0 = e.beta; g0 = e.gamma; }
b0 += (e.beta - b0) * 0.01; g0 += (e.gamma - g0) * 0.01;
ox = Math.max(-0.5, Math.min(0.5, (e.gamma - g0) / 40));
oy = Math.max(-0.5, Math.min(0.5, (e.beta - b0) / 40));
if (!rafO) rafO = requestAnimationFrame(function () { rafO = 0; naEkrane.forEach(function (s) { postavit(s, ox * 0.5, oy * 0.5); }); });
}, { passive: true });
}
function sozdat(s) {
var c = d.createElement('div'), n = s.offsetHeight < 140 ? 6 : 14, h = '';
c.className = 'vit-e__ch'; c.setAttribute('aria-hidden', 'true');
for (var i = 0; i < n; i++) {
h += '<i style="left:' + (8 + Math.random() * 84).toFixed(1) + '%;top:' + (20 + Math.random() * 70).toFixed(1) + '%;--r:' +
(2 + Math.random() * 3).toFixed(1) + 'px;animation-delay:-' + (Math.random() * 9).toFixed(2) + 's;animation-duration:' + (7 + Math.random() * 6).toFixed(1) + 's"></i>';
}
c.innerHTML = h;
s.insertBefore(c, s.querySelector('.vit-e__blik'));
chastica.set(s, c);
}
function zapusk() {
Array.prototype.forEach.call(sceny, function (s) {
var v = naEkrane.has(s);
if (v && !chastica.has(s)) sozdat(s);
s.classList.toggle('vit-e__scena--zhivaya', v);
});
}
if (IO) {
var io = new IntersectionObserver(function (zap) {
for (var i = 0; i < zap.length; i++) { if (zap[i].isIntersecting) naEkrane.add(zap[i].target); else naEkrane.delete(zap[i].target); }
zapusk();
}, { rootMargin: '-15% 0px' });
Array.prototype.forEach.call(sceny, function (s) { io.observe(s); });
}
})(window, document);
;
/* --- /js/skladnoj.js --- */
(function () {
"use strict";
if (typeof document === "undefined") return;
var MQ = window.matchMedia ? window.matchMedia("(max-width:640px)") : null;
function primenit() {
var tel = !!(MQ && MQ.matches);
var D = document.querySelectorAll("details[data-skl]");
for (var i = 0; i < D.length; i++) D[i].open = !tel;
}
function start() {
primenit();
if (MQ) {
if (MQ.addEventListener) MQ.addEventListener("change", primenit);
else if (MQ.addListener) MQ.addListener(primenit);
}
window.addEventListener("hashchange", function () {
var id = (location.hash || "").slice(1);
var el = id && document.getElementById(id);
var d = el && el.closest ? el.closest("details[data-skl]") : null;
if (d && d !== el) d.open = true;
});
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
})();
;
