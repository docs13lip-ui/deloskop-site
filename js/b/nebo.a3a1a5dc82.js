/* Делоскоп · пакет «nebo» — собран tests/sobrat_js.py из 1 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/nebo.js --- */
/*
 * Делоскоп — «Живое небо» тёмной темы (nebo-v1, 18.10.2026).
 * Отдельный слой, который ничего не знает о страницах: <canvas class="nebo"> position:fixed под всем содержимым
 * (z-index -3 — ниже «дыхания» glubina.css), pointer-events:none, вёрстку не трогает (CLS 0).
 * Слои: глубина (градиент на <html>), туманности и галактика (медленно поворачиваются), дальние звёзды
 * (тысячи точек, часть мерцает), созвездия героев Делоскопа (кольцо, документ, печать, щит, сеть, лупа, рост),
 * ближние звёзды с ореолом и параллаксом от курсора; события — метеоры (раз в 8–20 с) и кометы (раз в 1–3 мин, не на телефоне).
 * Грузит js/shapka.js (tema) только в тёмной теме и только после load; светлая — гаснет и выгружается.
 * reduce-motion, экономия трафика, слабая батарея — один неподвижный кадр; скрытая вкладка — пауза.
 * Кадр замеряется: дольше 3 мс в среднем — детализация падает сама (меньше мерцающих звёзд, 30 → 20 кадров/с).
 * Небо одно на весь сайт (тот же посев) и повёрнуто по часам — при переходе между страницами оно не «прыгает».
 */
(function (W, d) {
  'use strict';
  if (W.DlkNebo) return;
  var mm = function (q) { return !!W.matchMedia && W.matchMedia(q).matches; };

  // посев — одно небо на всех страницах
  function sluch(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // созвездия — герои Делоскопа; точки в долях (−1…1), рёбра — пары индексов
  var FIGURY = [
    { t: 'kolco', p: [[0, -1], [0.7, -0.7], [1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]] },
    { t: 'dokument', p: [[-0.7, -1], [0.35, -1], [0.7, -0.6], [0.7, 1], [-0.7, 1], [-0.35, -0.25], [0.35, -0.25], [-0.35, 0.3], [0.35, 0.3]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [5, 6], [7, 8]] },
    { t: 'pechat', p: [[0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1], [-0.87, 0.5], [-0.87, -0.5], [0, 0]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 2], [6, 4]] },
    { t: 'shchit', p: [[-0.8, -0.9], [0, -1], [0.8, -0.9], [0.75, 0.15], [0, 1], [-0.75, 0.15]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]] },
    { t: 'set', p: [[-1, -0.3], [-0.3, -0.9], [0.5, -0.5], [1, 0.3], [0.2, 0.9], [-0.5, 0.5], [0, 0]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 1], [6, 3], [6, 5]] },
    { t: 'lupa', p: [[-0.2, -1], [0.45, -0.75], [0.6, -0.15], [0.25, 0.35], [-0.4, 0.4], [-0.75, -0.25], [0.6, 0.65], [1, 1]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [3, 6], [6, 7]] },
    { t: 'rost', p: [[-1, 0.8], [-0.4, 0.2], [0, 0.5], [0.8, -0.6], [0.45, -0.65], [0.85, -0.25]], r: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5]] }
  ];
  // цвета — ДС v1 §2.5 (тёмная тема): холодный белый, синий акцент, редкие тёплые звёзды
  var BELYJ = '245,245,242', HOLOD = '200,216,255', SINIJ = '91,155,255', TEPLO = '255,217,160';
  var FON = 'radial-gradient(120% 90% at 50% -12%,#18223A 0%,#121320 42%,#111113 70%),linear-gradient(180deg,#111113 0%,#0C0C10 100%)';

  var cv = null, cx = null, stil = null, idet = 0, zhivo = false, staticno = false, gasnu = 0;
  var w = 0, h = 0, dpr = 1, uzko = false, mysh = false;
  var sloj = { daljnie: null, tumannost: null }, MER = [], BLIZ = [], SOZ = [], meteory = [], komety = [];
  var px = 0, py = 0, cpx = 0, cpy = 0, tPosl = 0, sledMeteor = 0, sledKometa = 0;
  var zamer = [], uroven = 2, shag = 1000 / 30; // уровень детализации 2 → 1 → 0
  var dbg = /(?:^|[?&])debug=nebo\b/.test(W.location.search || '') || !!W.__neboDbg;

  function holst(ww, hh) { var c = d.createElement('canvas'); c.width = ww; c.height = hh; return c; }

  // ---- построение слоёв (один раз на размер окна) ----
  function postroit() {
    var R = sluch(1810), i, n, x, y, r, a, k, c, g;
    uzko = w <= 600;
    var W2 = Math.round(w * dpr), H2 = Math.round(h * dpr);
    // дальние звёзды — в неподвижный слой
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
    // туманности и галактика — в слой вчетверо меньше (мягкость даёт масштаб), поворачиваем целиком
    var S = Math.ceil(Math.hypot(w, h) / 4), T = holst(S, S), tc = T.getContext('2d');
    var tum = [[0.28, 0.3, 0.42, SINIJ, 0.10], [0.74, 0.62, 0.36, '140,110,220', 0.07], [0.55, 0.85, 0.3, TEPLO, 0.035]];
    tum.forEach(function (q) {
      g = tc.createRadialGradient(q[0] * S, q[1] * S, 0, q[0] * S, q[1] * S, q[2] * S);
      g.addColorStop(0, 'rgba(' + q[3] + ',' + q[4] + ')'); g.addColorStop(1, 'rgba(' + q[3] + ',0)');
      tc.fillStyle = g; tc.fillRect(0, 0, S, S);
    });
    // спиральная галактика: два рукава из точек и ядро
    var gx = S * 0.7, gy = S * 0.28, gr = S * 0.11;
    g = tc.createRadialGradient(gx, gy, 0, gx, gy, gr * 0.5);
    g.addColorStop(0, 'rgba(' + TEPLO + ',.06)'); // ядро галактики — не ярче 0,06: текст поверх него ≥ 4,5 : 1 g.addColorStop(1, 'rgba(' + TEPLO + ',0)');
    tc.fillStyle = g; tc.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    for (i = 0; i < 420; i++) {
      var ruk = i % 2, t = R() * 3.4, sp = 0.12 + t / 3.4;
      a = t * 1.9 + ruk * Math.PI + (R() - 0.5) * 0.5;
      x = gx + Math.cos(a) * sp * gr; y = gy + Math.sin(a) * sp * gr * 0.45;
      tc.fillStyle = 'rgba(' + (R() > 0.7 ? SINIJ : HOLOD) + ',' + (0.05 + R() * 0.16).toFixed(3) + ')';
      tc.fillRect(x, y, 1, 1);
    }
    sloj.tumannost = T;
    // мерцающие звёзды (рисуются каждый кадр)
    MER = [];
    for (i = 0; i < (uzko ? 70 : 160); i++) MER.push({ x: R() * w, y: R() * h, r: 0.6 + R() * 0.7, f: R() * 6.28, s: 0.6 + R() * 1.6, c: R() > 0.85 ? TEPLO : BELYJ });
    // ближние звёзды с ореолом — двигаются от курсора сильнее всех
    BLIZ = [];
    for (i = 0; i < (uzko ? 18 : 42); i++) BLIZ.push({ x: R() * w, y: R() * h, r: 0.9 + R() * 1.1, f: R() * 6.28, g: 0.35 + R() * 0.65, c: R() > 0.8 ? HOLOD : BELYJ });
    // созвездия: раскладка по клеткам сетки (каждое — в своей клетке), на телефоне — четыре
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
      SOZ.push({ t: f.t, p: tochki, r: f.r, f: R() * 6.28 });
    });
    W.__neboSoz = SOZ.length;
  }

  function razmer() {
    dpr = Math.min(1.5, W.devicePixelRatio || 1);
    w = W.innerWidth; h = W.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    postroit();
  }

  // ---- события ----
  function novyjMeteor(t, R) {
    var a = 0.35 + R * 0.5, dl = 120 + R * 160;
    meteory.push({ x: w * (0.1 + R * 0.8), y: h * (0.05 + R * 0.35), a: a, dl: dl, v: 900 + R * 500, t0: t, zh: 700 + R * 500 });
  }
  function novayaKometa(t, R) {
    var sl = R > 0.5, y = h * (0.12 + R * 0.4);
    komety.push({ x0: sl ? -80 : w + 80, y0: y, vx: (sl ? 1 : -1) * (w + 160) / 14, vy: h * 0.02, t0: t, zh: 14000 });
  }

  // ---- кадр ----
  function kadr(t) {
    var a = dbg ? W.performance.now() : 0, i, s, al;
    cx.clearRect(0, 0, w, h);
    // параллакс: туманности 0,3, дальние 0,5, созвездия 0,8, ближние 1,6 (в px от курсора)
    cpx += (px - cpx) * 0.05; cpy += (py - cpy) * 0.05;
    // туманности и галактика — поворот по часам (полный оборот за ~70 мин), одинаковый на всех страницах
    var ug = (Date.now() / 1000) * 0.0015, T = sloj.tumannost, S = T.width;
    cx.save(); cx.translate(w / 2 + cpx * 0.3, h / 2 + cpy * 0.3); cx.rotate(ug); cx.drawImage(T, -S * 2, -S * 2, S * 4, S * 4); cx.restore();
    cx.drawImage(sloj.daljnie, cpx * 0.5, cpy * 0.5, w, h);
    // мерцание
    var nm = uroven === 2 ? MER.length : uroven === 1 ? MER.length >> 1 : 0;
    for (i = 0; i < nm; i++) {
      s = MER[i]; al = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t / 1000 * s.s + s.f));
      cx.fillStyle = 'rgba(' + s.c + ',' + al.toFixed(3) + ')';
      cx.fillRect(s.x + cpx * 0.5, s.y + cpy * 0.5, s.r, s.r);
    }
    // созвездия — тонкие линии и звёзды поярче, медленно «дышат»
    cx.lineWidth = 0.6;
    for (i = 0; i < SOZ.length; i++) {
      var z = SOZ[i], dy = 0.6 + 0.4 * Math.sin(t / 5200 + z.f), ox = cpx * 0.8, oy = cpy * 0.8;
      cx.strokeStyle = 'rgba(' + SINIJ + ',' + (0.16 * dy).toFixed(3) + ')';
      cx.beginPath();
      for (var j = 0; j < z.r.length; j++) { var A = z.p[z.r[j][0]], B = z.p[z.r[j][1]]; cx.moveTo(A[0] + ox, A[1] + oy); cx.lineTo(B[0] + ox, B[1] + oy); }
      cx.stroke();
      cx.fillStyle = 'rgba(' + BELYJ + ',' + (0.55 + 0.3 * dy).toFixed(3) + ')';
      for (j = 0; j < z.p.length; j++) { cx.beginPath(); cx.arc(z.p[j][0] + ox, z.p[j][1] + oy, z.p[j][2], 0, 6.283); cx.fill(); }
    }
    // ближние звёзды с ореолом
    for (i = 0; i < BLIZ.length; i++) {
      s = BLIZ[i];
      var X = s.x + cpx * 1.6, Y = s.y + cpy * 1.6, mig = 0.75 + 0.25 * Math.sin(t / 1700 + s.f);
      if (uroven) {
        var g = cx.createRadialGradient(X, Y, 0, X, Y, s.r * 6);
        g.addColorStop(0, 'rgba(' + s.c + ',' + (0.14 * s.g * mig).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + s.c + ',0)');
        cx.fillStyle = g; cx.fillRect(X - s.r * 6, Y - s.r * 6, s.r * 12, s.r * 12);
      }
      cx.fillStyle = 'rgba(' + s.c + ',' + (0.6 + 0.35 * s.g * mig).toFixed(3) + ')';
      cx.beginPath(); cx.arc(X, Y, s.r, 0, 6.283); cx.fill();
    }
    // метеоры
    if (!staticno) {
      if (!sledMeteor) sledMeteor = t + 3000 + Math.random() * 6000;
      if (t > sledMeteor) { novyjMeteor(t, Math.random()); sledMeteor = t + 8000 + Math.random() * 12000; }
      if (!uzko) {
        if (!sledKometa) sledKometa = t + 25000 + Math.random() * 35000;
        if (t > sledKometa && !komety.length) { novayaKometa(t, Math.random()); sledKometa = t + 60000 + Math.random() * 120000; }
      }
    }
    for (i = meteory.length - 1; i >= 0; i--) {
      var m = meteory[i], k = (t - m.t0) / m.zh;
      if (k >= 1) { meteory.splice(i, 1); continue; }
      var put = m.v * (t - m.t0) / 1000, hx = m.x + Math.cos(m.a) * put, hy = m.y + Math.sin(m.a) * put;
      var tx = hx - Math.cos(m.a) * m.dl, ty = hy - Math.sin(m.a) * m.dl, sv = Math.sin(Math.PI * k);
      var gm = cx.createLinearGradient(hx, hy, tx, ty);
      gm.addColorStop(0, 'rgba(' + BELYJ + ',' + (0.85 * sv).toFixed(3) + ')'); gm.addColorStop(1, 'rgba(' + HOLOD + ',0)');
      cx.strokeStyle = gm; cx.lineWidth = 1.3; cx.beginPath(); cx.moveTo(hx, hy); cx.lineTo(tx, ty); cx.stroke();
    }
    for (i = komety.length - 1; i >= 0; i--) {
      var ko = komety[i], kk = (t - ko.t0) / ko.zh;
      if (kk >= 1) { komety.splice(i, 1); continue; }
      var sek = (t - ko.t0) / 1000, kx = ko.x0 + ko.vx * sek, ky = ko.y0 + ko.vy * sek + Math.sin(kk * 3.1) * 12;
      var nap = Math.atan2(ko.vy, ko.vx), dh = 150, ex = kx - Math.cos(nap) * dh, ey = ky - Math.sin(nap) * dh - 10;
      var sk = Math.min(1, Math.sin(Math.PI * kk) * 2.5);
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

  // самоконтроль: дороже 3 мс в среднем за 60 кадров — уровень детализации ниже, при 0 — ещё и 20 кадров/с
  var sumK = 0, nK = 0;
  function cikl(t) {
    idet = 0;
    if (!zhivo || d.hidden) return;
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
      px = (e.clientX / w - 0.5) * -10; py = (e.clientY / h - 0.5) * -8; // ±5 px, против движения — глубина
    }, { passive: true });
    // батарея: не заряжается и меньше 20 % — неподвижный кадр
    if (W.navigator && W.navigator.getBattery) W.navigator.getBattery().then(function (b) {
      var p = function () { var nado = !b.charging && b.level < 0.2; if (nado !== staticno && cv) { staticno = nado; if (nado) stop(); else pusk(); } };
      b.addEventListener('levelchange', p); b.addEventListener('chargingchange', p); p();
    }).catch(function () {});
  }
  var gotovo = false;

  function vkl() {
    if (cv) { cv.style.opacity = '1'; clearTimeout(gasnu); zhivo = true; pusk(); return; }
    staticno = mm('(prefers-reduced-motion: reduce)') || mm('(prefers-reduced-data: reduce)') || !!(W.navigator && W.navigator.connection && W.navigator.connection.saveData);
    mysh = !staticno && mm('(hover:hover) and (pointer:fine)');
    stil = d.createElement('style');
    stil.setAttribute('data-nebo', '');
    // глубина — фоном <html>; тело страницы прозрачно, пока небо включено (иначе фон тела закрыл бы слой)
    stil.textContent = 'html[data-nebo]{background:' + FON + ';background-attachment:fixed}' +
      'html[data-nebo] body{background:transparent!important}' +
      '.nebo{position:fixed;inset:0;width:100%;height:100%;z-index:-3;pointer-events:none;display:block;opacity:0;transition:opacity .9s ease}' +
      '@media print{.nebo{display:none}html[data-nebo]{background:none}}';
    d.head.appendChild(stil);
    cv = d.createElement('canvas'); cv.className = 'nebo'; cv.setAttribute('aria-hidden', 'true');
    cx = cv.getContext('2d');
    if (!cx) { cv = null; return; }
    d.documentElement.setAttribute('data-nebo', '');
    d.body.insertBefore(cv, d.body.firstChild);
    razmer();
    kadr(W.performance.now());
    W.requestAnimationFrame(function () { if (cv) cv.style.opacity = '1'; });
    zhivo = true;
    if (!gotovo) { gotovo = true; sobyt(); }
    pusk();
  }
  // светлая тема: гаснет за 0,9 с и уходит со страницы целиком (холст, стиль, слои)
  function vykl() {
    if (!cv) return;
    zhivo = false; stop();
    cv.style.opacity = '0';
    clearTimeout(gasnu);
    gasnu = setTimeout(function () {
      if (zhivo || !cv) return;
      cv.remove(); if (stil) stil.remove();
      d.documentElement.removeAttribute('data-nebo');
      cv = cx = stil = null; sloj.daljnie = sloj.tumannost = null; MER = BLIZ = SOZ = []; meteory = []; komety = [];
    }, staticno ? 0 : 950);
  }
  W.DlkNebo = { vkl: vkl, vykl: vykl, FIGURY: FIGURY };
  if (d.documentElement.getAttribute('data-theme') === 'dark') vkl();
})(window, document);
;
