/* Делоскоп · пакет «nebo» — собран tests/sobrat_js.py из 1 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/nebo.js --- */
(function (W, d) {
'use strict';
if (W.DlkNebo) return;
var mm = function (q) { return !!W.matchMedia && W.matchMedia(q).matches; };
function sluch(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var FIGURY = [
{ t: 'kolco', p: [[0, -1], [0.7, -0.7], [1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]] },
{ t: 'dokument', p: [[-0.7, -1], [0.35, -1], [0.7, -0.6], [0.7, 1], [-0.7, 1], [-0.35, -0.25], [0.35, -0.25], [-0.35, 0.3], [0.35, 0.3]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [5, 6], [7, 8]] },
{ t: 'pechat', p: [[0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1], [-0.87, 0.5], [-0.87, -0.5], [0, 0]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 2], [6, 4]] },
{ t: 'shchit', p: [[-0.8, -0.9], [0, -1], [0.8, -0.9], [0.75, 0.15], [0, 1], [-0.75, 0.15]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]] },
{ t: 'set', p: [[-1, -0.3], [-0.3, -0.9], [0.5, -0.5], [1, 0.3], [0.2, 0.9], [-0.5, 0.5], [0, 0]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 1], [6, 3], [6, 5]] },
{ t: 'lupa', p: [[-0.2, -1], [0.45, -0.75], [0.6, -0.15], [0.25, 0.35], [-0.4, 0.4], [-0.75, -0.25], [0.6, 0.65], [1, 1]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [3, 6], [6, 7]] },
{ t: 'rost', p: [[-1, 0.8], [-0.4, 0.2], [0, 0.5], [0.8, -0.6], [0.45, -0.65], [0.85, -0.25]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5]] }
];
var BELYJ = '245,245,242', HOLOD = '200,216,255', SINIJ = '91,155,255', TEPLO = '255,217,160';
var FON = 'radial-gradient(120% 90% at 50% -12%,#18223A 0%,#121320 42%,#111113 70%),linear-gradient(180deg,#111113 0%,#0C0C10 100%)';
var cv = null, cx = null, stil = null, idet = 0, zhivo = false, staticno = false, gasnu = 0;
var w = 0, h = 0, dpr = 1, uzko = false, mysh = false;
var MS = null, sloj = { daljnie: null, tumannost: null, galaktika: null, maska: null, fon: null }, MER = [], BLIZ = [], SOZ = [], meteory = [], komety = [], vspyshki = [];
var tihij = false, prokr = 0, tPred = 0, sledVspyshka = 0, sMaskoj = true, ukaz = null;
var px = 0, py = 0, cpx = 0, cpy = 0, tPosl = 0, sledMeteor = 0, sledKometa = 0;
var zamer = [], uroven = 2, shag = 1000 / 30;
var dbg = /(?:^|[?&])debug=nebo\b/.test(W.location.search || '') || !!W.__neboDbg;
function holst(ww, hh) { var c = d.createElement('canvas'); c.width = ww; c.height = hh; return c; }
var OREOL = {};
function oreol(c) {
if (OREOL[c]) return OREOL[c];
var o = holst(32, 32), oc = o.getContext('2d'), g = oc.createRadialGradient(16, 16, 0, 16, 16, 16);
g.addColorStop(0, 'rgba(' + c + ',1)'); g.addColorStop(1, 'rgba(' + c + ',0)');
oc.fillStyle = g; oc.fillRect(0, 0, 32, 32);
return (OREOL[c] = o);
}
function maskaGrad(c, k) {
var g = c.createLinearGradient(MS.x0 * k, 0, MS.x1 * k, 0);
MS.st.forEach(function (q) { g.addColorStop(q[0], 'rgba(0,0,0,' + q[1] + ')'); });
return g;
}
function mx(x) {
if (!MS) return 1;
var u = (x - MS.x0) / (MS.x1 - MS.x0), st = MS.st, i;
if (u <= 0) return 1 - st[0][1];
if (u >= 1) return 1 - st[st.length - 1][1];
for (i = 1; u > st[i][0]; i++);
var a = st[i - 1], b = st[i];
return 1 - (a[1] + (b[1] - a[1]) * (u - a[0]) / (b[0] - a[0]));
}
function postroit() {
var R = sluch(1810), i, n, x, y, r, a, k, c, g;
uzko = w <= 600;
var W2 = Math.round(w * dpr), H2 = Math.round(h * dpr);
var D = holst(W2, H2), dc = D.getContext('2d');
n = Math.round((uzko ? 700 : 1700) * Math.min(1.6, (w * h) / (1440 * 900)) + (uzko ? 0 : 200));
for (i = 0; i < n; i++) {
x = R() * W2; y = R() * H2; k = R();
r = (k < 0.92 ? 0.35 + R() * 0.5 : 0.8 + R() * 0.6) * dpr;
c = k > 0.97 ? TEPLO : k > 0.6 ? HOLOD : BELYJ;
dc.fillStyle = 'rgba(' + c + ',' + (0.18 + R() * 0.5).toFixed(3) + ')';
dc.fillRect(x, y, r, r);
}
sloj.daljnie = D;
var S = Math.ceil(Math.hypot(w, h) / 4), T = holst(S, S), tc = T.getContext('2d');
var tum = [[0.28, 0.3, 0.42, SINIJ, 0.10], [0.74, 0.62, 0.36, '140,110,220', 0.07], [0.55, 0.85, 0.3, TEPLO, 0.035]];
tum.forEach(function (q) {
g = tc.createRadialGradient(q[0] * S, q[1] * S, 0, q[0] * S, q[1] * S, q[2] * S);
g.addColorStop(0, 'rgba(' + q[3] + ',' + q[4] + ')'); g.addColorStop(1, 'rgba(' + q[3] + ',0)');
tc.fillStyle = g; tc.fillRect(0, 0, S, S);
});
sloj.tumannost = T;
var G = holst(Math.ceil(S * 0.24), Math.ceil(S * 0.24)), gc = G.getContext('2d'), gr = S * 0.11, gx = G.width / 2, gy = G.height / 2;
g = gc.createRadialGradient(gx, gy, 0, gx, gy, gr * 0.5);
g.addColorStop(0, 'rgba(' + TEPLO + ',.06)');
g.addColorStop(1, 'rgba(' + TEPLO + ',0)');
gc.fillStyle = g; gc.fillRect(0, 0, G.width, G.height);
tc = gc;
for (i = 0; i < 420; i++) {
var ruk = i % 2, t = R() * 3.4, sp = 0.12 + t / 3.4;
a = t * 1.9 + ruk * Math.PI + (R() - 0.5) * 0.5;
x = gx + Math.cos(a) * sp * gr; y = gy + Math.sin(a) * sp * gr * 0.45;
tc.fillStyle = 'rgba(' + (R() > 0.7 ? SINIJ : HOLOD) + ',' + (0.05 + R() * 0.16).toFixed(3) + ')';
tc.fillRect(x, y, 1, 1);
}
sloj.galaktika = G;
var kol0 = Math.min(1180, w - 32);
MS = uzko ? { x0: 0, x1: w, st: [[0, 0.35], [0.5, 0.6], [1, 0.35]] }
: { x0: Math.max(0, (w - kol0) / 2 - 80), x1: Math.min(w, (w + kol0) / 2 + 80), st: [[0, 0], [0.25, 0.5], [0.5, 0.6], [0.75, 0.5], [1, 0]] };
if (!sMaskoj) MS = null;
if (MS) { dc.globalCompositeOperation = 'destination-out'; dc.fillStyle = maskaGrad(dc, dpr); dc.fillRect(0, 0, W2, H2); dc.globalCompositeOperation = 'source-over'; }
sloj.fon = holst(Math.ceil(w / 4), Math.ceil(h / 4));
sloj.maska = MS ? maskaGrad(sloj.fon.getContext('2d'), 0.25) : null;
MER = [];
for (i = 0; i < (uzko ? 70 : 160); i++) { x = R() * w; MER.push({ x: x, y: R() * h, r: 0.6 + R() * 0.7, f: R() * 6.28, s: 0.6 + R() * 1.6, c: R() > 0.85 ? TEPLO : BELYJ, m: mx(x) }); }
MER.sort(function (u, v) { return u.c < v.c ? -1 : u.c > v.c ? 1 : 0; });
BLIZ = [];
for (i = 0; i < (uzko ? 18 : 42); i++) { x = R() * w; BLIZ.push({ x: x, y: R() * h, r: 0.9 + R() * 1.1, f: R() * 6.28, g: 0.35 + R() * 0.65, c: R() > 0.8 ? HOLOD : BELYJ, m: mx(x) }); }
SOZ = [];
var figury = uzko ? FIGURY.slice(0, 4) : FIGURY, kol = uzko ? 2 : 4, str = Math.ceil(figury.length / kol);
figury.forEach(function (f, j) {
var ci = j % kol, ri = Math.floor(j / kol), cw = w / kol, ch = h / str;
var raz = (uzko ? 34 : 52) + R() * (uzko ? 14 : 26), ug = (R() - 0.5) * 0.9;
var ox = cw * (ci + 0.25 + R() * 0.5), oy = ch * (ri + 0.25 + R() * 0.5);
var tochki = f.p.map(function (p) {
var X = p[0] * Math.cos(ug) - p[1] * Math.sin(ug), Y = p[0] * Math.sin(ug) + p[1] * Math.cos(ug);
return [ox + X * raz, oy + Y * raz, 0.9 + R() * 0.8];
});
SOZ.push({ t: f.t, p: tochki, r: f.r, f: R() * 6.28, c: [ox, oy], raz: raz, v: 0, cel: 0, do: 0, sx: 0, sy: 0, m: mx(ox) });
});
W.__neboSoz = SOZ.length;
if (dbg) W.__neboZ = SOZ;
}
function razmer() {
dpr = Math.min(1.5, W.devicePixelRatio || 1);
w = W.innerWidth; h = W.innerHeight;
cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
cx.setTransform(dpr, 0, 0, dpr, 0, 0);
postroit();
}
function novyjMeteor(t, R) {
var a = 0.35 + R * 0.5, dl = 120 + R * 160;
meteory.push({ x: w * (0.1 + R * 0.8), y: h * (0.05 + R * 0.35), a: a, dl: dl, v: 900 + R * 500, t0: t, zh: 700 + R * 500 });
}
function novayaKometa(t, R) {
var sl = R > 0.5, y = h * (0.12 + R * 0.4);
komety.push({ x0: sl ? -80 : w + 80, y0: y, vx: (sl ? 1 : -1) * (w + 160) / (uzko ? 9 : 14), vy: h * 0.02, t0: t, zh: uzko ? 9000 : 14000, dh: uzko ? 90 : 150 });
}
function novayaVspyshka(t, R) {
var s = MER[Math.floor(R * MER.length)];
if (s) vspyshki.push({ s: s, t0: t, zh: 700 });
}
function gxy(ug, ww, hh) { return ww < 1100 ? [ww * (1 + Math.cos(ug * 2) * 0.012), hh * (0.24 + Math.sin(ug * 2) * 0.08)] : [ww * (0.84 + Math.cos(ug * 2) * 0.06), hh * (0.24 + Math.sin(ug * 2) * 0.08)]; }
function krug(v, n) { v %= n; return v < 0 ? v + n : v; }
function sKrugom(img, off, dx) {
var k = img.height / h, o = krug(off, h), s0 = o * k;
if (s0 < img.height - 1) cx.drawImage(img, 0, s0, img.width, img.height - s0, dx, 0, w, h - o);
if (s0 > 1) cx.drawImage(img, 0, 0, img.width, s0, dx, h - o, w, o);
}
function kadr(t) {
var a = dbg ? W.performance.now() : 0, i, s, al, dt = tPred ? Math.min(100, t - tPred) : 0;
tPred = t;
if (sMaskoj) cx.clearRect(0, 0, w, h);
cpx += (px - cpx) * 0.05; cpy += (py - cpy) * 0.05;
var pr = prokr;
var ug = (Date.now() / 1000) * 0.0015, T = sloj.tumannost, S = T.width, tsd = Math.max(-120, Math.min(120, pr * 0.01));
var F = sloj.fon, fc = F.getContext('2d'), G = sloj.galaktika, gp = gxy(ug, w, h), gW = G.width * (w < 1100 ? 2.4 : 4);
var gY = krug(gp[1] - pr * 0.015 + gW, h + gW * 2) - gW, kl = [ug, tsd, cpx, cpy, gY], pk = sloj.fonKl;
if (!pk || Math.abs(kl[0] - pk[0]) > 0.002 || Math.abs(kl[1] - pk[1]) > 2 || Math.abs(kl[2] - pk[2]) > 1.5 || Math.abs(kl[3] - pk[3]) > 1.5 || Math.abs(kl[4] - pk[4]) > 2) {
sloj.fonKl = kl;
fc.clearRect(0, 0, F.width, F.height);
fc.save(); fc.scale(0.25, 0.25);
fc.save(); fc.translate(w / 2 + cpx * 0.3, h / 2 + cpy * 0.3 - tsd); fc.rotate(ug); fc.drawImage(T, -S * 2, -S * 2, S * 4, S * 4); fc.restore();
fc.translate(gp[0] + cpx * 0.3, gY + cpy * 0.3); fc.rotate(ug * 3); fc.drawImage(G, -gW / 2, -gW / 2, gW, gW);
fc.restore();
if (sloj.maska) { fc.globalCompositeOperation = 'destination-out'; fc.fillStyle = sloj.maska; fc.fillRect(0, 0, F.width, F.height); fc.globalCompositeOperation = 'source-over'; }
}
cx.drawImage(F, 0, 0, w, h);
sKrugom(sloj.daljnie, pr * 0.02 - cpy * 0.5, cpx * 0.5);
var nm = uroven === 2 ? MER.length : uroven === 1 ? MER.length >> 1 : 0, mo = pr * 0.03;
var cvet = '';
for (i = 0; i < nm; i++) {
s = MER[i]; al = (0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t / 1000 * s.s + s.f))) * s.m;
if (s.c !== cvet) { cvet = s.c; cx.fillStyle = 'rgb(' + cvet + ')'; }
cx.globalAlpha = al;
cx.fillRect(s.x + cpx * 0.5, krug(s.y - mo, h) + cpy * 0.5, s.r, s.r);
}
cx.globalAlpha = 1;
for (i = vspyshki.length - 1; i >= 0; i--) {
var vs = vspyshki[i], vk = (t - vs.t0) / vs.zh;
if (vk >= 1) { vspyshki.splice(i, 1); continue; }
var vx = vs.s.x + cpx * 0.5, vy = krug(vs.s.y - mo, h) + cpy * 0.5, vsv = Math.sin(Math.PI * vk), vd = 2 + 5 * vsv;
cx.strokeStyle = 'rgba(' + BELYJ + ',' + (0.5 * vsv * vs.s.m).toFixed(3) + ')'; cx.lineWidth = 0.8;
cx.beginPath(); cx.moveTo(vx - vd, vy); cx.lineTo(vx + vd, vy); cx.moveTo(vx, vy - vd); cx.lineTo(vx, vy + vd); cx.stroke();
}
cx.lineWidth = 0.6;
var so = pr * 0.05;
for (i = 0; i < SOZ.length; i++) {
var z = SOZ[i], dy = 0.6 + 0.4 * Math.sin(t / 5200 + z.f), ox = cpx * 0.8, m2 = z.raz * 1.6;
var oy = krug(z.c[1] - so + m2, h + m2 * 2) - m2 - z.c[1] + cpy * 0.8;
z.sx = z.c[0] + ox; z.sy = z.c[1] + oy;
if (z.do && t > z.do) { z.do = 0; z.cel = 0; }
if (ukaz) z.cel = Math.hypot(ukaz[0] - z.sx, ukaz[1] - z.sy) < z.raz * 2.2 ? 1 : (z.do ? z.cel : 0);
z.v = staticno ? z.cel : Math.max(0, Math.min(1, z.v + (z.cel ? 1 : -1) * dt / 400));
cx.strokeStyle = 'rgba(' + SINIJ + ',' + ((0.05 + 0.37 * z.v) * dy * z.m).toFixed(3) + ')';
cx.beginPath();
for (var j = 0; j < z.r.length; j++) { var A = z.p[z.r[j][0]], B = z.p[z.r[j][1]]; cx.moveTo(A[0] + ox, A[1] + oy); cx.lineTo(B[0] + ox, B[1] + oy); }
cx.stroke();
cx.fillStyle = 'rgba(' + BELYJ + ',' + ((0.55 + 0.3 * dy + 0.15 * z.v) * z.m).toFixed(3) + ')';
cx.beginPath();
for (j = 0; j < z.p.length; j++) { cx.moveTo(z.p[j][0] + ox + z.p[j][2], z.p[j][1] + oy); cx.arc(z.p[j][0] + ox, z.p[j][1] + oy, z.p[j][2], 0, 6.283); }
cx.fill();
}
var bo = pr * 0.08;
for (i = 0; i < BLIZ.length; i++) {
s = BLIZ[i];
var X = s.x + cpx * 1.6, Y = krug(s.y - bo, h) + cpy * 1.6, mig = 0.75 + 0.25 * Math.sin(t / 1700 + s.f);
if (uroven) {
cx.globalAlpha = 0.14 * s.g * mig * s.m;
cx.drawImage(oreol(s.c), X - s.r * 6, Y - s.r * 6, s.r * 12, s.r * 12);
}
cx.globalAlpha = (0.6 + 0.35 * s.g * mig) * s.m;
cx.fillStyle = 'rgb(' + s.c + ')';
cx.beginPath(); cx.arc(X, Y, s.r, 0, 6.283); cx.fill();
}
cx.globalAlpha = 1;
if (!staticno) {
if (!sledMeteor) sledMeteor = t + 3000 + Math.random() * 6000;
if (t > sledMeteor) { novyjMeteor(t, Math.random()); sledMeteor = t + 8000 + Math.random() * 12000; }
if (!sledKometa) sledKometa = t + 25000 + Math.random() * 35000;
if (t > sledKometa && !komety.length) { novayaKometa(t, Math.random()); sledKometa = t + (uzko ? 120000 : 60000) + Math.random() * 120000; }
if (!sledVspyshka) sledVspyshka = t + 6000 + Math.random() * 10000;
if (t > sledVspyshka) { novayaVspyshka(t, Math.random()); sledVspyshka = t + 12000 + Math.random() * 18000; }
}
for (i = meteory.length - 1; i >= 0; i--) {
var m = meteory[i], k = (t - m.t0) / m.zh;
if (k >= 1) { meteory.splice(i, 1); continue; }
var put = m.v * (t - m.t0) / 1000, hx = m.x + Math.cos(m.a) * put, hy = m.y + Math.sin(m.a) * put;
var tx = hx - Math.cos(m.a) * m.dl, ty = hy - Math.sin(m.a) * m.dl, sv = Math.sin(Math.PI * k) * mx(hx);
var gm = cx.createLinearGradient(hx, hy, tx, ty);
gm.addColorStop(0, 'rgba(' + BELYJ + ',' + (0.85 * sv).toFixed(3) + ')'); gm.addColorStop(1, 'rgba(' + HOLOD + ',0)');
cx.strokeStyle = gm; cx.lineWidth = 1.3; cx.beginPath(); cx.moveTo(hx, hy); cx.lineTo(tx, ty); cx.stroke();
}
for (i = komety.length - 1; i >= 0; i--) {
var ko = komety[i], kk = (t - ko.t0) / ko.zh;
if (kk >= 1) { komety.splice(i, 1); continue; }
var sek = (t - ko.t0) / 1000, kx = ko.x0 + ko.vx * sek, ky = ko.y0 + ko.vy * sek + Math.sin(kk * 3.1) * 12;
var nap = Math.atan2(ko.vy, ko.vx), dh = ko.dh, ex = kx - Math.cos(nap) * dh, ey = ky - Math.sin(nap) * dh - 10;
var sk = Math.min(1, Math.sin(Math.PI * kk) * 2.5) * mx(kx);
var gk = cx.createLinearGradient(kx, ky, ex, ey);
gk.addColorStop(0, 'rgba(' + HOLOD + ',' + (0.45 * sk).toFixed(3) + ')'); gk.addColorStop(1, 'rgba(' + SINIJ + ',0)');
cx.strokeStyle = gk; cx.lineCap = 'round'; cx.lineWidth = 5; cx.beginPath(); cx.moveTo(kx, ky); cx.quadraticCurveTo((kx + ex) / 2, (ky + ey) / 2 + 6, ex, ey); cx.stroke();
cx.lineWidth = 1.5; cx.stroke(); cx.lineCap = 'butt';
var gg = cx.createRadialGradient(kx, ky, 0, kx, ky, 9);
gg.addColorStop(0, 'rgba(' + BELYJ + ',' + (0.95 * sk).toFixed(3) + ')'); gg.addColorStop(1, 'rgba(' + HOLOD + ',0)');
cx.fillStyle = gg; cx.fillRect(kx - 9, ky - 9, 18, 18);
}
if (a) {
zamer.push(W.performance.now() - a);
if (zamer.length === 90) {
var sr = zamer.reduce(function (u, v) { return u + v; }, 0) / zamer.length;
W.__nebo = { kadr_ms: +sr.toFixed(3), uroven: uroven, zvezd: MER.length + BLIZ.length, soz: SOZ.length };
zamer = [];
}
}
}
var sumK = 0, nK = 0;
function cikl(t) {
idet = 0;
if (!zhivo || d.hidden) return;
prokr = W.scrollY || 0;
if (t - tPosl >= shag - 2 || meteory.length || komety.length) {
tPosl = t;
var a = W.performance.now();
kadr(t);
sumK += W.performance.now() - a; nK++;
if (nK === 60) {
if (sumK / nK > 3 && uroven > 0) { uroven--; if (!uroven) shag = 1000 / 20; }
sumK = 0; nK = 0;
}
}
idet = W.requestAnimationFrame(cikl);
}
function pusk() { if (zhivo && !staticno && !idet && !d.hidden) idet = W.requestAnimationFrame(cikl); }
function stop() { if (idet) { W.cancelAnimationFrame(idet); idet = 0; } }
function sobyt() {
var tr;
W.addEventListener('resize', function () { if (!cv) return; clearTimeout(tr); tr = setTimeout(function () { if (!cv) return; razmer(); kadr(W.performance.now()); }, 200); });
d.addEventListener('visibilitychange', function () { if (d.hidden) stop(); else pusk(); });
if (mysh) W.addEventListener('pointermove', function (e) {
if (e.pointerType !== 'mouse') return;
px = (e.clientX / w - 0.5) * -10; py = (e.clientY / h - 0.5) * -8;
ukaz = [e.clientX, e.clientY];
}, { passive: true });
if (mysh) d.addEventListener('mouseleave', function () { ukaz = null; });
W.addEventListener('pointerdown', function (e) {
if (e.pointerType === 'mouse' || !cv) return;
var t = W.performance.now();
SOZ.forEach(function (z) { if (Math.hypot(e.clientX - z.sx, e.clientY - z.sy) < z.raz * 2.6) { z.cel = 1; z.do = t + 2500; } });
if (staticno) { kadr(t); setTimeout(function () { if (cv) kadr(W.performance.now()); }, 2600); }
}, { passive: true });
if (!mysh && !staticno && W.DeviceOrientationEvent && typeof W.DeviceOrientationEvent.requestPermission !== 'function') {
W.addEventListener('deviceorientation', function (e) {
if (e.gamma == null || e.beta == null) return;
var o = function (v) { return Math.max(-1, Math.min(1, v)); };
px = o(e.gamma / 30) * -4; py = o((e.beta - 45) / 30) * -4;
}, { passive: true });
}
if (W.navigator && W.navigator.getBattery) W.navigator.getBattery().then(function (b) {
var p = function () { var nado = tihij || (!b.charging && b.level < 0.2); if (nado !== staticno && cv) { staticno = nado; if (nado) stop(); else pusk(); } };
b.addEventListener('levelchange', p); b.addEventListener('chargingchange', p); p();
}).catch(function () {});
}
var gotovo = false;
function vkl() {
if (cv) { cv.style.opacity = '1'; clearTimeout(gasnu); zhivo = true; pusk(); return; }
staticno = tihij = mm('(prefers-reduced-motion: reduce)') || mm('(prefers-reduced-data: reduce)') || !!(W.navigator && W.navigator.connection && W.navigator.connection.saveData);
mysh = !staticno && mm('(hover:hover) and (pointer:fine)');
stil = d.createElement('style');
stil.setAttribute('data-nebo', '');
stil.textContent = 'html[data-nebo]{background:' + FON + ';background-attachment:fixed}' +
'html[data-nebo] body{background:transparent!important}' +
'.nebo{position:fixed;inset:0;width:100%;height:100%;z-index:-3;pointer-events:none;display:block;opacity:0;transition:opacity .9s ease}' +
'@media print{.nebo{display:none}html[data-nebo]{background:none}}' +
'html[data-nebo] .card{background-color:rgba(28,28,31,.74);-webkit-backdrop-filter:blur(12px) saturate(1.15);backdrop-filter:blur(12px) saturate(1.15)}' +
'@media (prefers-reduced-transparency:reduce){html[data-nebo] .card{background-color:#1C1C1F;-webkit-backdrop-filter:none;backdrop-filter:none}}';
d.head.appendChild(stil);
cv = d.createElement('canvas'); cv.className = 'nebo'; cv.setAttribute('aria-hidden', 'true');
cx = cv.getContext('2d');
if (!cx) { cv = null; return; }
d.documentElement.setAttribute('data-nebo', '');
d.body.insertBefore(cv, d.body.firstChild);
razmer();
prokr = W.scrollY || 0;
kadr(W.performance.now());
W.requestAnimationFrame(function () { if (cv) cv.style.opacity = '1'; });
zhivo = true;
if (!gotovo) { gotovo = true; sobyt(); }
pusk();
}
function vykl() {
if (!cv) return;
zhivo = false; stop();
cv.style.opacity = '0';
clearTimeout(gasnu);
gasnu = setTimeout(function () {
if (zhivo || !cv) return;
cv.remove(); if (stil) stil.remove();
d.documentElement.removeAttribute('data-nebo');
cv = cx = stil = null; sloj.daljnie = sloj.tumannost = sloj.galaktika = sloj.fon = null; MER = BLIZ = SOZ = []; meteory = []; komety = [];
}, staticno ? 0 : 950);
}
function kadrNa(ww, hh) {
var sv = [w, h, dpr, cx, sloj, MER, BLIZ, SOZ, cpx, cpy, prokr, sMaskoj, uzko, MS];
var c = holst(ww, hh), k = c.getContext('2d');
w = ww; h = hh; dpr = 1; cx = k; sMaskoj = false; sloj = { daljnie: null, tumannost: null, galaktika: null, maska: null, fon: null };
var g = k.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, '#111113'); g.addColorStop(1, '#0C0C10'); k.fillStyle = g; k.fillRect(0, 0, ww, hh);
k.save(); k.translate(ww / 2, -0.12 * hh); k.scale(1.2 * ww, 0.9 * hh);
g = k.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, '#18223A'); g.addColorStop(0.42, '#121320'); g.addColorStop(0.7, 'rgba(17,17,19,0)');
k.fillStyle = g; k.fillRect(-1, 0, 2, 1.4); k.restore();
var sk = cv; cv = c;
postroit(); cpx = cpy = 0; prokr = 0;
SOZ.forEach(function (z) { z.cel = 1; });
var mt = meteory, ko = komety, vsp = vspyshki; meteory = []; komety = []; vspyshki = [];
var st = staticno; staticno = true; kadr(0); staticno = st;
meteory = mt; komety = ko; vspyshki = vsp; cv = sk;
w = sv[0]; h = sv[1]; dpr = sv[2]; cx = sv[3]; sloj = sv[4]; MER = sv[5]; BLIZ = sv[6]; SOZ = sv[7]; cpx = sv[8]; cpy = sv[9]; prokr = sv[10]; sMaskoj = sv[11]; uzko = sv[12]; MS = sv[13];
W.__neboSoz = SOZ.length;
return c;
}
W.DlkNebo = { vkl: vkl, vykl: vykl, kadr: kadrNa, FIGURY: FIGURY };
if (d.documentElement.getAttribute('data-theme') === 'dark') vkl();
})(window, document);
;
