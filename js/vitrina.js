/* vitrina-v1/v2: витрина экосистемы на главной.
   1) Глубина сцены: курсор (ноутбук) и наклон телефона (deviceorientation — только где браузер не спрашивает разрешения)
      задают --px/--py (−0,5…0,5) и поворот --rx/--ry; слои сцены сдвигаются на разную глубину (css/vitrina.css).
   2) Частицы — слой точек в сцене (CSS-анимация), идут только пока сцена в средней части экрана; «меньше движения» — нет.
   3) «Что умеет» — на узком экране факты экспоната свёрнуты, кнопка раскрывает (без скрипта — всё открыто).
   4) Бабл «Отзыв» прячется, пока у нижнего края экрана (120 px) видна кнопка действия; возвращается через 600 мс.
   5) «Камера едет» (v2b): индикатор «03 / 13 · название» внутри зала и подсветка текущего пункта карты.
   Один кадр на событие, только transform/translate/opacity; без JS и при reduce — сцены стоят, всё читается. */
(function (W, d) {
  'use strict';
  if (!W.matchMedia || !W.requestAnimationFrame) return;
  var vit = d.getElementById('vitrina');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var uzko = matchMedia('(max-width: 860px)');
  var sceny = d.querySelectorAll('.vit-e__scena');
  var IO = 'IntersectionObserver' in W;

  /* --- 3) факты --- */
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

  /* --- 4) бабл «Отзыв» --- */
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

  /* --- 5) «камера едет» (vitrina-v2b): индикатор «03 / 13 · название» и подсветка карты витрины.
     Текущий экспонат — тот, что пересекает середину экрана (на телефоне — чей заголовок последним ушёл под таблетку). Широкий экран с полем слева — шкала у края,
     иначе — таблетка под шапкой во время прокрутки. Индикатор только для глаз (aria-hidden); для чтения с экрана —
     aria-current в карте. --- */
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
    // priemka-1910-v1: таблетка (телефон) не спорит с текстом — пока в её полосе (≈ 56–110 px от верха) заголовок
    // витрины, она спрятана и возвращается через 300 мс после его ухода; гаснет через 0,8 с покоя.
    // Текущий экспонат на телефоне — тот, чей заголовок последним ушёл под таблетку (а не тот, что в середине экрана).
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
      if (li === tek || (li && tek && li.offsetTop === tek.offsetTop)) return;   // пара в одной строке — номер не прыгает
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

  /* --- 1) глубина: курсор --- */
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

  /* --- видимые сцены (для наклона и частиц) --- */
  var naEkrane = new Set();
  var chastica = new Map();   // сцена → слой частиц

  /* --- 1) глубина: наклон телефона (без запроса разрешения; iOS со своим вопросом — не трогаем) --- */
  if (!mysh && W.DeviceOrientationEvent && typeof W.DeviceOrientationEvent.requestPermission !== 'function') {
    var b0 = null, g0 = null, rafO = 0, ox = 0, oy = 0;
    W.addEventListener('deviceorientation', function (e) {
      if (e.beta == null || e.gamma == null) return;
      if (b0 === null) { b0 = e.beta; g0 = e.gamma; }
      b0 += (e.beta - b0) * 0.01; g0 += (e.gamma - g0) * 0.01;  // медленно «забываем» исходное положение руки
      ox = Math.max(-0.5, Math.min(0.5, (e.gamma - g0) / 40));
      oy = Math.max(-0.5, Math.min(0.5, (e.beta - b0) / 40));
      if (!rafO) rafO = requestAnimationFrame(function () { rafO = 0; naEkrane.forEach(function (s) { postavit(s, ox * 0.5, oy * 0.5); }); });
    }, { passive: true });
  }

  /* --- 2) частицы: точки-пылинки в луче света — CSS-анимация (только transform/opacity, идёт вне основного потока);
     создаются при первом показе сцены, вне экрана стоят на паузе --- */
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
    }, { rootMargin: '-15% 0px' });   // рисуем только сцены в средней части экрана
    Array.prototype.forEach.call(sceny, function (s) { io.observe(s); });
  }
})(window, document);
