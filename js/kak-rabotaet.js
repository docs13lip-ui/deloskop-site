/* demo-vitrina-v1: «Как это работает» — показ продукта сценой по шагам (страница /kak-rabotaet/).
   Шаг n: элементы экрана [data-ot<=n] видны (.on), [data-do<n] уходят; [data-pech] «печатается» на своём шаге.
   Запуск — когда показ на экране; ушёл с экрана — пауза. Кнопка шага — перейти к нему, «Повторить» — с начала.
   [data-zam] — до своего шага не занимает места; [data-po] — пункты списка появляются по одному.
   «Меньше движения» — сразу итог, шаги переключаются без анимации. Без скрипта — итог и обычный список шагов. */
(function () {
  "use strict";
  var MALO = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function cel(c, p) { try { if (window.dlkGoal) window.dlkGoal(c, p); } catch (e) {} }

  function Pokaz(d) {
    var ekr = d.querySelector(".kr-ekr"), kn = [].slice.call(d.querySelectorAll(".kr-sh button")),
      el = [].slice.call(ekr.querySelectorAll("[data-ot]")), pech = [].slice.call(ekr.querySelectorAll("[data-pech]")),
      ist = [].slice.call(ekr.querySelectorAll(".kr-ist li, [data-po] > li")), pole = ekr.querySelector(".kr-pole"),
      n = 0, tajm = [], vidno = false, konec = false, imya = d.getAttribute("data-demo");
    d.classList.add("kr-js");

    function stop() { tajm.forEach(clearTimeout); tajm = []; d.classList.remove("idet"); }
    function pozzhe(f, ms) { tajm.push(setTimeout(f, ms)); }

    function napechatat(x, srazu) {
      var t = x.getAttribute("data-pech");
      if (srazu || MALO) { x.textContent = t; x.classList.remove("kr-pech"); return; }
      x.textContent = ""; x.classList.add("kr-pech");
      var i = 0, shag = Math.max(45, Math.min(110, 900 / t.length));
      (function dalshe() {
        x.textContent = t.slice(0, ++i);
        if (i < t.length) pozzhe(dalshe, shag); else x.classList.remove("kr-pech");
      })();
    }

    function pokazat(k, anim) {
      n = k;
      kn.forEach(function (b, i) {
        if (i + 1 === k) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
        b.classList.toggle("byl", i + 1 < k);
      });
      el.forEach(function (x) {
        var ot = +x.getAttribute("data-ot"), dO = x.getAttribute("data-do");
        x.classList.toggle("on", ot <= k);
        // [data-zam] — элемент на смену ушедшему: до своего шага места не держит (demo-vitrina-v2)
        x.classList.toggle("von", (dO !== null && k > +dO) || (ot > k && x.hasAttribute("data-zam")));
      });
      pech.forEach(function (x) {
        var ot = +x.closest("[data-ot]").getAttribute("data-ot");
        if (ot < k || (ot === k && !anim)) napechatat(x, true);
        else if (ot === k) napechatat(x, false);
        else x.textContent = "";
      });
      if (pole) pole.classList.remove("zhmi");
      ist.forEach(function (li) {
        var ot = +li.parentNode.getAttribute("data-ot");
        if (k > ot || !anim || MALO) li.classList.toggle("on", k >= ot);
        else if (k === ot) { li.classList.remove("on"); var j = [].indexOf.call(li.parentNode.children, li); pozzhe(function () { li.classList.add("on"); }, 350 + j * 450); }
      });
      // кнопка «Проверить» нажимается в конце шага ввода
      if (pole && anim && k === 1 && !MALO) pozzhe(function () { pole.classList.add("zhmi"); }, 1700);
    }

    function idti(k) {
      stop();
      if (k > kn.length) { konec = true; return; }
      konec = false;
      var t = +kn[k - 1].getAttribute("data-t") || 3000;
      d.style.setProperty("--t", t + "ms");
      pokazat(k, true);
      void d.offsetWidth; d.classList.add("idet");
      pozzhe(function () { if (k < kn.length) idti(k + 1); else { d.classList.remove("idet"); konec = true; } }, t);
    }

    kn.forEach(function (b, i) {
      b.addEventListener("click", function () {
        cel("demo_shag", { demo: imya, shag: i + 1 });
        if (MALO) { stop(); pokazat(i + 1, false); } else idti(i + 1);
      });
    });
    var pv = d.querySelector("[data-povtor]");
    if (pv) pv.addEventListener("click", function () {
      cel("demo_povtor", { demo: imya });
      if (MALO) pokazat(1, false); else idti(1);
    });
    var go = d.querySelector("[data-demo-go]");
    if (go) go.addEventListener("click", function () { cel("demo_k_proverke", { demo: imya }); });

    // «меньше движения» или старый браузер — сразу итог; иначе пустой экран до показа (он начнётся, когда экран виден)
    var bylo = false;
    if (MALO || !("IntersectionObserver" in window)) { pokazat(kn.length, false); konec = true; return; }
    // высота экрана — по самому высокому шагу: шаги не сдвигают страницу, пока показ идёт
    var mera = function () {
      ekr.style.minHeight = ""; var v = n, h = 0;
      for (var k = 1; k <= kn.length; k++) { pokazat(k, false); h = Math.max(h, ekr.offsetHeight); }
      ekr.style.minHeight = h + "px"; pokazat(v, false);
    };
    mera(); pokazat(0, false);
    var shir = innerWidth;
    addEventListener("resize", function () { if (innerWidth !== shir) { shir = innerWidth; stop(); mera(); if (vidno && !konec) idti(n || 1); } });
    new IntersectionObserver(function (z) {
      vidno = z[0].isIntersecting;
      if (vidno && !bylo) { bylo = true; cel("demo_pokaz", { demo: imya }); idti(1); }
      else if (vidno && !konec) idti(n);
      else if (!vidno) stop();
    }, { threshold: 0.45 }).observe(ekr);
  }

  function zapusk() { [].forEach.call(document.querySelectorAll(".kr-d[data-demo]"), Pokaz); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", zapusk); else zapusk();
})();
