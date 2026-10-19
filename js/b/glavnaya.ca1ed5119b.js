/* Делоскоп · пакет «glavnaya» — собран tests/sobrat_js.py из 9 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/vhody.js --- */
/* Делоскоп — «Три входа» на главной (Стратег 27.09 §1.2; приёмка 13.10, стр. 6).
   Считаем, как делятся клики между входами: цели entry_pay / entry_watch / entry_bank
   (только с согласия на Метрику — window.dlkGoal сам это проверяет).
   Вход «Перед оплатой» не уводит со страницы: прокручивает к полю ИНН и ставит в него курсор. */
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
;
/* --- /js/vizual2.js --- */
/* Делоскоп — визуал, волна 2 (vizual-v2, 18.10.2026): переворот примера отчёта, «сеть связей», микродвижения формы.
   А. Пример отчёта на главной (.report.ex[data-oborot]): таблетки «Все факты / Глазами банка / Глазами налоговой» над фактами;
      переворачивается блок фактов (кольцо и вывод остаются на виду). Оборот собирается из тех же строк фактов (.ex-r[data-vid]) — узлы переезжают, текст не копируется;
      высота карточки — по большей стороне, страница не прыгает. Без JS таблетки скрыты, лицо — как было.
   Б. «Сеть связей» (canvas.set, только первый экран главной и /pasport/): 24–60 точек, у точки не больше 2 нитей;
      кадры — только пока первый экран виден и вкладка активна; фокус в поле ИНН подтягивает 12 ближайших точек к рамке поля.
   В. Кнопка формы чуть тянется к курсору (мышь), полоска под полем ИНН: 10 или 12 долей, контрольная цифра — DlkInn.ok (js/inn.js).
   prefers-reduced-motion: reduce — без вращения и без движения (сеть — один кадр). Логику отправки и тексты #note не трогаем. */
(function (W, d) {
  'use strict';
  var tiho = !W.matchMedia || !W.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  var mysh = !!W.matchMedia && W.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var raf = W.requestAnimationFrame.bind(W);
  function vse(s, f, k) { [].forEach.call((k || d).querySelectorAll(s), f); }
  function el(t, c) { var e = d.createElement(t); if (c) e.className = c; return e; }

  // ---------- А. переворот ----------
  // tabs — таблетки (role=tablist), f — блок фактов (лицо), rows — строки с data-vid, p — приставка id
  function oborot(tabs, f, rows, p) {
    var kn = [].slice.call(tabs.querySelectorAll('[role=tab]'));
    var flip = el('div', 'ex-flip'), vn = el('div', 'ex-flip__in'), lico = el('div', 'ex-lico'), zad = el('div', 'ex-zad');
    var zh = el('div', 'ex-f__h'), zb = el('b');
    zh.appendChild(zb); zad.appendChild(zh);
    var spis = el('div', 'ex-zad__r'); zad.appendChild(spis);
    f.parentNode.insertBefore(flip, f);
    lico.appendChild(f);
    vn.appendChild(lico); vn.appendChild(zad); flip.appendChild(vn);
    lico.id = p + '-lico'; zad.id = p + '-zad';
    lico.setAttribute('role', 'tabpanel'); zad.setAttribute('role', 'tabpanel');
    // строки по месту: вернуть — перед якорем-комментарием, который ставим вместо каждой
    var mesto = rows.map(function (r) { var m = d.createComment(''); r.parentNode.insertBefore(m, r); return m; });
    function nazad() { if (W.Svyazi) Svyazi.ubrat(spis); rows.forEach(function (r, i) { if (r.parentNode !== f) mesto[i].parentNode.insertBefore(r, mesto[i].nextSibling); }); }
    function vpered(v, zhivo) {
      nazad();
      rows.forEach(function (r) { if ((' ' + r.getAttribute('data-vid') + ' ').indexOf(' ' + v + ' ') >= 0) spis.appendChild(r); });
      if (v === 'svyazi' && W.Svyazi) Svyazi.pokazat(spis, f, zhivo); // vizual-v3.2: оборот «Связи» — граф/список из js/svyazi.js
    }
    function podpis(b) { return b.getAttribute('data-zag') || ''; }
    // высота — по большей стороне (лицо целиком или любой из оборотов)
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
    // vizual-v3.2b: «Связи» меняют высоту сами (граф по кнопке на телефоне, длинный список) — карточка растёт вместе с оборотом,
    // а не накрывает то, что ниже; сначала база (оборот мог и уменьшиться), потом высота содержимого
    var vys0 = 0;
    if (W.ResizeObserver) new W.ResizeObserver(function () {
      if (!vys0) return;
      vn.style.minHeight = vys0 + 'px'; // ушли со «Связей» — база
      if (vn.getAttribute('data-vid') !== 'svyazi') return;
      vn.style.minHeight = Math.max(vys0, Math.ceil(zad.scrollHeight)) + 'px';
    }).observe(spis);
    function vybrat(b, fokus) {
      var v = b.getAttribute('data-vid'), na = v !== 'svodka';
      kn.forEach(function (x) { var s = x === b; x.setAttribute('aria-selected', s ? 'true' : 'false'); x.tabIndex = s ? 0 : -1; });
      if (fokus) b.focus();
      var bylo = vn.getAttribute('data-vid') || 'svodka';
      if (bylo === v) return;
      if (bylo === 'svodka') vysota(); // лицо могло вырасти (раскрытые «Все данные») — высоту берём перед поворотом
      vn.setAttribute('data-vid', v);
      zad.setAttribute('aria-labelledby', b.id);
      if (na) {
        var smena = function () { zb.textContent = podpis(b); vpered(v, true); };
        // банк ↔ налоговая: оборот уже повёрнут — меняем строки мягко, без второго вращения
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
    W.addEventListener('beforeprint', function () { if (flip.isConnected) vybrat(kn[0]); }); // на бумаге — лицо
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(vysota);
  }
  function primer(rep) {
    var tabs = rep.querySelector('.ex-vid'), f = rep.querySelector('.ex-f');
    if (tabs && f) oborot(tabs, f, [].slice.call(f.querySelectorAll('.ex-r[data-vid]')), 'ex');
  }
  // настоящий отчёт: «Существенные факты» (.rows.sut, js/sushchestvennoe.js) — угол зрения по ключу факта data-fakt.
  // Ключ не из списка — строка остаётся только во «Всех фактах»; угол без строк — без таблетки.
  var VID = {
    bank: /^(status|address|age|rukovoditel|zsk|employees|damia_priostanovki|damia_bankrotstvo)$/,
    nalog: /^(status|address|tax_debt|otchetnost|kapital|likvidnost|ubytki|skachok|damia_fssp|damia_bankrotstvo)$/
  };
  // подписи таблеток — из примера на главной (тот же HTML, ни одного своего слова); примера нет — отчёт без таблеток
  var ZAG = [], ZAG_ARIA = '';
  function otchet(f) {
    if (f.getAttribute('data-v2') || f.closest('.ex-flip') || !f.closest('.ot-main')) return; // после раскладки листа (js/otchet.js)
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
    if (W.Svyazi && Svyazi.est(f)) vid.push(['svyazi', 'Связи', 'Связи компании']); // vizual-v3.2: третья вкладка — из ответа /api/check
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

  // ---------- Б. «сеть связей» ----------
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
    // цели на рамке поля: 12 точек по периметру, в координатах холста
    function celi() {
      var a = cv.getBoundingClientRect(), b = pole.getBoundingClientRect(), out = [];
      for (var i = 0; i < 12; i++) out.push([b.left - a.left + (i % 6 + 0.5) / 6 * b.width, (i < 6 ? b.top : b.bottom) - a.top]); // 6 сверху, 6 снизу
      return out;
    }
    function shag(dt, t) {
      T.forEach(function (p) {
        var u = p.a + Math.sin(t / 3000 + p.f) * 0.9; // направление плавно гуляет — инерция без рывков
        p.x += Math.cos(u) * p.s * dt; p.y += Math.sin(u) * p.s * dt;
        if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20;
      });
      // подтяжка к полю: 400 мс ease-out туда и обратно
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
      ox += (cxp - ox) * 0.08; oy += (cyp - oy) * 0.08; // параллакс с лёгкой инерцией
      shag(dt, t); risovat();
      idet = raf(kadr);
    }
    function pusk() { if (!tiho && !idet && vidno && !d.hidden) { t0 = 0; idet = raf(kadr); } }
    razmer();
    // vizual-v3.0b: сменилась тема (переключатель в подвале или система) — цвет точек из нового --ink, кадр заново
    if (W.MutationObserver) new W.MutationObserver(function () { rgb = cvet(); risovat(); }).observe(d.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    risovat(); // один кадр сразу — и единственный при reduce
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
        cel.forEach(function (c) { // каждой цели — ближайшая свободная точка
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
        cxp = ((e.clientX - r.left) / r.width - 0.5) * 12; cyp = ((e.clientY - r.top) / r.height - 0.5) * 12; // ±6 px
      }, { passive: true });
      host.addEventListener('pointerleave', function () { cxp = cyp = 0; });
    }
    pusk();
  }

  // ---------- В. микродвижения формы ----------
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
      ZAG_ARIA = t.getAttribute('aria-label');
      vse('[role=tab]', function (b) { ZAG.push([b.getAttribute('data-vid'), b.textContent, b.getAttribute('data-zag') || '']); }, t);
    });
    vse('.report.ex[data-oborot]', primer);
    // отчёт рисуется после ответа API и заново на каждую проверку — ждём строки фактов
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
/* Делоскоп — подключённые источники в ответе проверки (комплект istochniki-v1, решение команды 11.10 16:25:
 * «не урезать, а подключить суды, банкротство, приставов» — документ команды).
 *
 * dopolnit(r) — общая точка: вызывается из DlkImya.ispravitOtvet (главная, Паспорт, Проверь счёт, PDF-досье, Делопись, кабинет)
 * до всех модулей отчёта. Меняет ответ на месте и возвращает его же.
 *
 * 1) Банкротство — из ЕГРЮЛ. Статус компании в ЕГРЮЛ (company.status от DaData: BANKRUPT — введена процедура банкротства)
 *    уже есть в каждом ответе. Если API не прислал блок damia.bankrotstvo с ответом (found / not_found / not_applicable),
 *    ставим его сами: источник «ЕГРЮЛ ФНС», дата сведений — дата проверки, оговорка «сообщения ЕФРСБ не проверяли»
 *    (намерения кредиторов и ход процедуры в ЕГРЮЛ не попадают). Ответ API с проверкой ЕФРСБ никогда не перетираем.
 *    У ИП — не ставим: банкротство гражданина в ЕГРИП не отражается до прекращения статуса ИП.
 *    В полноту Индекса такой блок НЕ идёт (источник методики «Федресурс и ЕФРСБ» не проверен) — флаг iz_egryul;
 *    стоп-фактор «Введена процедура банкротства» Индекс и так берёт из статуса ЕГРЮЛ (js/indeks-otvet.js).
 * 2) Приставы — блок damia.fssp приходит от API (загрузчик открытых данных ФССП, комплект API istochniki-v1):
 *    status found / not_found, summa_ostatka, chislo, tochnost ('inn' | 'naimenovanie_adres'), data_svedeniy.
 *    Здесь только приводим словарь: sostoyanie = status, чтобы «Условия сделки» и Индекс читали одно и то же.
 * Чистые функции, без DOM и сети — tests/istochniki_bankrotstvo_fssp.test.js. */
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

  // дата проверки по Москве → «2026-10-11» (как «Существенные факты»: ЕГРЮЛ — на дату проверки)
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

  // r → блок «Банкротство» по ЕГРЮЛ | null (нечего сказать честно)
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
      b.dubl_statusa = true; // строка «Статус» уже говорит об этом — в «Существенных фактах» не повторяем
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

  // sudy-v1 [команда] 11.10: словарь API → словарь сайта. API (damia v1.4) отдаёт status «polucheno» / «ne_provereno»
  // и отдельно sostoyanie found / not_found / not_checked / not_applicable, а модули отчёта (Паспорт, «Откуда данные»,
  // «Существенные факты», Индекс) читают status как found / not_found. Без этого шага, когда ключ DaMIA заработает, найденные
  // дела суда показались бы как «ответа нет». Прежнее слово API сохраняем в status_api.
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

  // sudy-v1: «Арбитражные суды» — одна строка-вывод из analitika API (кто и сколько судится, доля выручки, тренд) вместо
  // общего итога. Прежний итог — в itog_prezhnij. Советы «что сделать» — только согласованные [команда] (soglasovano: true).
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

  // otchet-detali-v1 (19.10): «не завершены 2 на 0 ₽» читалось как ошибка — у таких дел сумма иска в картотеке не указана
  // (неимущественные требования или сумма не внесена). Говорим это словами; ненулевую сумму не трогаем.
  function sudyNol(b) {
    if (!b || typeof b !== 'object' || typeof b.itog !== 'string') return;
    var t = b.itog.replace(/(\d+)\s+на\s+0\s*₽/g, '$1; сумма исков в' + NB + 'картотеке не' + NB + 'указана');
    if (t !== b.itog) { if (!b.itog_prezhnij) b.itog_prezhnij = b.itog; b.itog = t; }
  }

  // otchet-detali-v1: подпись ссылки на первоисточник по адресу — «проверить в картотеке арбитражных дел» вместо семи
  // одинаковых «проверьте сами» (доверие: видно, куда ведём; WCAG 2.4.4 — у ссылок с разной целью разный текст).
  // Неизвестный адрес — «проверить на <домен>». Порядок важен: сначала точные пути, потом домены.
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

  function dopolnit(r) {
    if (!r || typeof r !== 'object' || !r.company) return r;
    var dm = r.damia && typeof r.damia === 'object' ? r.damia : null;
    if (dm) { privestiSlovar(dm); sudyItog(dm.sudy); sudyNol(dm.sudy); }
    var est = dm && dm.bankrotstvo && typeof dm.bankrotstvo === 'object' ? dm.bankrotstvo : null;
    // ЕГРЮЛ говорит «банкротство», а картотека API — «дел, где компания должник, не нашли»: верим ЕГРЮЛ (запись о процедуре
    // вносит налоговая по решению суда; картотека по роли «должник» могла не сопоставиться)
    var bankrotEgryul = String((r.company || {}).status || '').toUpperCase() === 'BANKRUPT';
    if (!est || !OTVETIL[est.status] || (bankrotEgryul && est.status === 'not_found')) {
      var b = bankrotstvoIzEgryul(r);
      if (b) {
        if (!dm) { dm = {}; r.damia = dm; }
        if (est && est.proverit_samim) b.proverit_samim = est.proverit_samim;
        dm.bankrotstvo = b;
        if (dm.polnota && typeof dm.polnota === 'object' && isFinite(dm.polnota.provereno) && !(est && OTVETIL[est.status])) {
          dm.polnota = { provereno: Number(dm.polnota.provereno) + 1, iz: dm.polnota.iz };
        }
      }
    }
    // приставы: один словарь для вывода и Индекса
    var f = dm && dm.fssp;
    if (f && typeof f === 'object' && OTVETIL[f.status] && f.sostoyanie !== f.status) f.sostoyanie = f.status;
    return r;
  }

  // Для Индекса: реестр учтён в полноте — ответ API с проверкой самого реестра (не подстановка из ЕГРЮЛ)
  function uchten(b) {
    if (!b || typeof b !== 'object' || b.iz_egryul) return false;
    return b.status === 'provereno' || b.status === 'found' || b.status === 'not_found';
  }

  return { dopolnit: dopolnit, bankrotstvoIzEgryul: bankrotstvoIzEgryul, uchten: uchten, privestiSlovar: privestiSlovar, sudyItog: sudyItog, sudyNol: sudyNol, samiTekst: samiTekst, OGOVORKA_EFRSB: OGOVORKA_EFRSB };
});
;
/* --- /js/imya.js --- */
/* Делоскоп — названия компаний с типографскими кавычками (kavychki-v1, [команда] 10.10.2026).
 * ЕГРЮЛ отдаёт названия с прямыми кавычками: ПАО "РОССЕТИ ЮГ", АО "АВИАКОМПАНИЯ "СИБИРЬ" (вложенная часто без закрывающей).
 * На экране проверки, в PDF-досье и в Паспорте показываем: ПАО «РОССЕТИ ЮГ», АО «АВИАКОМПАНИЯ „СИБИРЬ“».
 * Меняем ТОЛЬКО кавычки: буквы, регистр и порядок слов — как в реестре (это документ для дела сделки,
 * название должно совпадать с выпиской ЕГРЮЛ буква в букву). Регистр «как пишет сама компания» — только
 * на карточках /company/ (tests/kartochka_render.py, imya()), там своё правило и словарь.
 * Правило: внешние кавычки — «ёлочки», вложенные — „лапки“; незакрытые закрываем в конце; повторный вызов
 * ничего не меняет. Апостроф и обратный апостроф (О`КЕЙ) не трогаем.
 * upravlyayushchaya-v1 ([команда] 10.10.2026): у части компаний полномочия руководителя переданы другой компании
 * (п. 1 ст. 69 208-ФЗ, ст. 42 14-ФЗ). API кладёт её название в director_name, должность пустая — и сайт писал
 * «Руководитель: ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "…"», а Делопись сокращала название как ФИО. Теперь ispravitOtvet
 * ставит director_org = true и должность «Управляющая организация», название — в «ёлочках».
 * Чистые функции, без DOM и сети — их проверяет tests/imya.test.js и tests/upravlyayushchaya.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkImya = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KAV = /["\u201C\u201D\u201E\u00AB\u00BB]/; // " “ ” „ « »
  var PROBEL = /[\s\u00A0(\[\/]/;

  function kavychki(s) {
    if (s == null) return s;
    s = String(s);
    if (!KAV.test(s)) return s;
    var out = '', glub = 0, predOtkr = false; // predOtkr — предыдущий знак был открывающей кавычкой
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (!KAV.test(ch)) { out += ch; predOtkr = false; continue; }
      var pred = i > 0 ? s.charAt(i - 1) : '', sled = i + 1 < s.length ? s.charAt(i + 1) : '';
      var otkr;
      if (ch === '\u00AB' || ch === '\u201E') otkr = true;          // « „ — всегда открывают
      else if (ch === '\u00BB') otkr = false;                       // » — всегда закрывает
      else if (glub === 0) otkr = true;                             // снаружи любая прямая — открывающая
      else otkr = (pred === '' || PROBEL.test(pred) || predOtkr) && sled !== '' && !/\s/.test(sled);
      if (otkr) { out += glub === 0 ? '\u00AB' : '\u201E'; glub++; }
      else if (glub > 0) { glub--; out += glub === 0 ? '\u00BB' : '\u201C'; }
      predOtkr = otkr;
      // лишняя закрывающая без пары — выбрасываем
    }
    while (glub > 0) { glub--; out += glub === 0 ? '\u00BB' : '\u201C'; }
    return out;
  }

  // Название организации, а не ФИО: организационно-правовая форма словом или сокращением, либо кавычки.
  // В ФИО таких слов и кавычек не бывает; ИП-управляющего («Иванов Иван Иванович») не трогаем — это ФИО.
  // Слова — целиком (фамилии «Фондов», «Компаниец» — не организации).
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

  // Ответ /api/check или /api/report/{id}: название в company и строки «…наименование» в разделах досье.
  // Меняет объект на месте и возвращает его же; чужие поля не трогает.
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
      // «Руководство и собственники»: «Руководитель — ПАО "…"» → «Управляющая организация — ПАО «…»», «Руководит с» → «Управляет с»
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
    // istochniki-v1: банкротство из ЕГРЮЛ и единый словарь приставов — здесь же, до всех модулей отчёта (js/istochniki.js)
    var ist = typeof DlkIstochniki !== 'undefined' ? DlkIstochniki : (typeof require === 'function' ? (function () { try { return require('./istochniki.js'); } catch (e) { return null; } })() : null);
    if (ist && ist.dopolnit) ist.dopolnit(r);
    return r;
  }

  return { kavychki: kavychki, ispravitOtvet: ispravitOtvet, organizaciya: organizaciya };
});
;
/* --- /js/kanaly.js --- */
/* Делоскоп — кнопки «Написать в MAX / ВКонтакте / Telegram» (kanaly-v1, [команда] 10.10.2026).
 * Ссылки — только из /data/kanaly.json. Пустая ссылка — кнопка остаётся скрытой: пока бот не прошёл модерацию,
 * на сайте нет кнопки, которая ведёт в никуда. [data-kanal="max|vk|tg"] — кнопка; [data-kanaly-blok] — обёртка,
 * показывается, если есть хоть одна ссылка; [data-kanaly-net] — текст «ссылка появится здесь», прячется, когда ссылки есть.
 * Чистая функция ssylki() проверяет адрес (https, нужный домен) — её зовёт tests/kanaly_sait.test.js. */
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
/* Делоскоп — «Ваши контрагенты» на главной: последние проверки в этом браузере одним списком, один светофор
 * (ТЗ [команда] 02.10 19:37, разд. 1). Данные — ТОЛЬКО то, что уже лежит в браузере:
 * снимки «что изменилось» (localStorage dlk_snimki, js/dinamika.js) и «Недавние проверки» (dlk_nedavnie, js/nedavnie.js).
 * В сеть при показе — ничего; запрос к API идёт, только когда человек сам нажал «Перепроверить» (обычная проверка, тот же лимит).
 * Для ИНН из 12 цифр (ИП) имя не выводим никогда — «Индивидуальный предприниматель».
 * Чистые функции (sobrat, uroven, kogda, html) — без DOM, их проверяет tests/portfel.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Portfel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = '\u00a0';
  var K_SNIMKI = 'dlk_snimki', K_NEDAVNIE = 'dlk_nedavnie';
  var DEN = 864e5, STARYJ_DNEJ = 30, POKAZ = 10;
  // уровни по 222-ФЗ (как на /indeks/): хуже — меньше номер порядка
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
  // 407, 414, 415, 418, 420 — уже исключена из ЕГРЮЛ (как ISKLYUCHENA в js/dinamika.js)
  var ISKLYUCHENA = { '407': 1, '414': 1, '415': 1, '418': 1, '420': 1 };

  // kavychki-v1: снимки на устройстве хранят название как в ЕГРЮЛ — показываем «ёлочками» (js/imya.js)
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

  // Уровень записи: число Индекса (когда API начнёт его отдавать и снимок его сохранит) → 4 уровня; иначе risk_level → 3 уровня.
  function uroven(x) {
    if (!x) return 'net';
    var ix = Number(x.ix);
    if (x.ix != null && isFinite(ix) && ix >= 1 && ix <= 99) return ix >= 70 ? 'bez' : ix >= 50 ? 'vopr' : ix >= 30 ? 'ser' : 'mnogo';
    return IZ_API[x.lvl] || IZ_API[x.level] || 'net';
  }

  // Один ИНН — одна строка, по последней проверке. snimki — объект {inn: [снимки]}, nedavnie — массив.
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
    // «ФНС готовит исключение из ЕГРЮЛ» — по коду состояния в последнем снимке, если он не старше строки больше чем на час
    // (коды 105–108, 110 — как в js/dinamika.js; более поздняя проверка без снимка отметку снимает)
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
  // {t:'Проверено вчера · 01.10', staryj:false} | {t:'Сведения на 12.08 — перед платежом перепроверьте', staryj:true}
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

  // Весь блок. opt.vse — показать все строки (иначе первые 10).
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

  // ---- хранилище: только два ключа Делоскопа ----
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

  // ---- браузер ----
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
    // пока открыт настоящий отчёт — блок не показываем (режим отчёта на всю ширину не трогаем)
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

  // opt: { form, input, ls? }
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
/* Делоскоп — переход «пример → отчёт» на главной (vizual-v3.1a «Инструмент», 18.10.2026).
   Визуал v3 §7, волна 3.1 (а): после «Проверить» карточка-пример превращается в отчёт той же формы на том же месте —
   View Transitions одного документа. Общие элементы: кольцо Индекса, название компании, вывод и первые три факта —
   браузер сам переводит каждый из старого места в новое; остальное — мягкая смена.
   Деградация: нет document.startViewTransition или стоит «уменьшить движение» — смена мгновенная, как раньше.
   Тексты не меняются: модуль только ставит view-transition-name на время перехода и снимает его после. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkPerehod = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // пары «пример ↔ отчёт»: имя перехода → [селектор в примере, селектор в отчёте]
  var PARY = [
    ['dlk-kolco', '.zhi__kolco', '.ot-vd .zhi__kolco'],
    ['dlk-kompaniya', '.ex-hd .company', '.ot-hd .company'],
    ['dlk-vyvod', '.ex-vt', '.ot-vt']
  ];
  var FAKTOV = 3; // первые строки фактов: .ex-f .row ↔ .sut__r
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

  // mozhno(doc) — будет ли настоящий переход (а не мгновенная смена)
  function mozhno(doc) {
    var w = doc && doc.defaultView;
    return !!(w && typeof doc.startViewTransition === 'function' && !tiho(w));
  }

  // smena(rep, fn) — fn() меняет содержимое rep; если можно — внутри View Transition с общими элементами.
  // Возвращает Promise: выполняется, когда новое содержимое уже в DOM (до конца анимации; без перехода — сразу).
  // Ошибка внутри fn не теряется: уходит в window.onerror, как без перехода.
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
/* --- /js/vitrina.js --- */
/* vitrina-v1/v2: витрина экосистемы на главной.
   1) Глубина сцены: курсор (ноутбук) и наклон телефона (deviceorientation — только где браузер не спрашивает разрешения)
      задают --px/--py (−0,5…0,5) и поворот --rx/--ry; слои сцены сдвигаются на разную глубину (css/vitrina.css).
   2) Частицы — слой точек в сцене (CSS-анимация), идут только пока сцена в средней части экрана; «меньше движения» — нет.
   3) «Что умеет» — на узком экране факты экспоната свёрнуты, кнопка раскрывает (без скрипта — всё открыто).
   4) Бабл «Отзыв» прячется, пока у нижнего края экрана (120 px) видна кнопка действия; возвращается через 600 мс.
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
;
