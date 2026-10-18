/* Делоскоп — «Живой Индекс» и сборка при прокрутке (vizual-v1, части Б и В, 17.10.2026).
   Кольцо 1–99: пример на главной (.ex-ix[data-zhi]) и Индекс в отчёте (.ot-ix__big — тот же узел переезжает в центр
   кольца, текст отчёта не меняется). Зона — из разметки отчёта (ot-ix__lv--ok|warn|bad — как цвет уровня), иначе по порогам методики v1
   (70 / 50 / 30 — /indeks/metodika-v1.json, сверяет tests/vizual.test.js). Слова зоны для экранного диктора — из плашки
   примера (data-zhi-aria), своих не придумываем; в примере числа нет — компания вымышленная. Наклон — за курсором и за наклоном телефона (разрешение на iOS не запрашиваем).
   Сборка: CSS view(), иначе IntersectionObserver. prefers-reduced-motion: reduce — кольцо сразу заполнено, ничего не движется. */
(function (W, d) {
  'use strict';
  var tiho = !W.matchMedia || !W.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  var IO = W.IntersectionObserver, raf = W.requestAnimationFrame, kolca = [];
  function zona(n) { return n >= 70 ? 'ok' : n >= 50 ? 'warn' : n >= 30 ? 'high' : 'bad'; }
  function el(c, v) { var e = d.createElement('div'); e.className = c; if (v) e.appendChild(v); return e; }
  function vse(s, f) { [].forEach.call(d.querySelectorAll(s), f); }

  // кольцо вокруг centr; uzel — текстовый узел числа для докрутки (в примере — пустышка {});
  // gotovo — кольцо уже в разметке (пример на главной, vizual-v3.1c: место под него с первого кадра, CLS) — его только оживляем
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
    if (tiho) { z.style.setProperty('--p', n); return z; }
    uzel.nodeValue = '0';
    z.addEventListener('pointermove', function (e) {
      var r = z.getBoundingClientRect();
      if (e.pointerType == 'mouse') kadr(z, ((e.clientY - r.top) / r.height - 0.5) * -16, ((e.clientX - r.left) / r.width - 0.5) * 20);
    }, { passive: true });
    z.addEventListener('pointerleave', function () { kadr(z, 0, 0); });
    function start() {
      var t0;
      z.classList.add('is-idet');
      raf(function () { z.style.setProperty('--p', n); });
      raf(function shag(t) {
        t0 = t0 || t;
        var x = Math.min(1, (t - t0) / 1200);
        uzel.nodeValue = Math.round(n * x * (2 - x));
        if (x < 1) raf(shag);
      });
    }
    if (!IO) start();
    else { var io = new IO(function (e) { if (e[0].isIntersecting) { io.disconnect(); start(); } }, { threshold: 0.4 }); io.observe(z); }
    return z;
  }

  // пример: <div class="ex-ix" data-zhi="72" data-zhi-aria="…"> — компания вымышленная, поэтому ЧИСЛА в центре нет
  // (честность примера, tests/glavnaya_primer.test.js): дуга доходит до зоны, в центре — знак зоны; подпись — из разметки.
  // Кольцо примера лежит в index.html готовым (пустая дуга) — JS только заполняет; нет разметки — строим, как раньше
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
      var za = big.nextSibling; // до kolco(): оно переносит big внутрь кольца
      ix.insertBefore(kolco(n, m ? m[1] : zona(n), big, t), za);
      ix.classList.add('ot-ix--zhi');
    });
  }

  // наклон: мышь — до ±8° / ±10°, телефон — те же пределы, коэффициент 0,4; не чаще кадра
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

  // сборка при прокрутке: не больше 4 блоков в каскаде
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
    new MutationObserver(function () { if (!zh) zh = setTimeout(function () { zh = 0; vsyo(); }, 50); })
      .observe(d.body, { childList: true, subtree: true });
  }
})(window, document);
