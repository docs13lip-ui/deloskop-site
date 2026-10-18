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
