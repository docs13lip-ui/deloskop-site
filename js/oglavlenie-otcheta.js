/* Делоскоп — оглавление отчёта по ИНН на телефоне (oglavlenie-otcheta-v1; план команды 18.11, разд. 3 п. (г)).
 * Замер 18.11 (живой ответ ПАО «Магнит», 390×844): отчёт — 11 500 px, почти 14 экранов; «Деньги на кону» — на 6-м,
 * «Динамика» — на 9-м, «Реквизиты компании» — на 11-м. Дойти до нужного раздела можно было только прокруткой.
 * Что: как только шапка листа («Главное» и реквизиты проверки) ушла вверх, под шапкой сайта появляется тонкая строка
 * разделов — «Вывод · Плюсы и минусы · Реестры · Суды и приставы · Деньги на кону · … · Реквизиты». Нажатие — переход
 * к разделу с подсветкой; раздел, который сейчас на экране, отмечен латунной чертой, строка сама держит его в поле зрения.
 * В строке — только разделы, которые есть в этом отчёте и видны; разделы, дорисованные позже («Кто рядом», налоги
 * к отрасли), добавляются сами. Только телефон и планшет (≤ 860 px — одна колонка листа); на компьютере две колонки и
 * без того короче — строку не показываем. На печати её нет.
 * Чистые функции punkty и aktivnyj — без DOM, их проверяет tests/oglavlenie_otcheta.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkOglavlenie = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Разделы листа: селектор корня раздела → подпись в строке. Подписи — короткие, как на плитках «Коротко по реестрам».
  var RAZDELY = [
    ['.gl1', 'Главное'],
    ['.ot-vd', 'Вывод'],
    ['.pm', 'Плюсы и минусы'],
    ['.pl', 'Реестры'],
    ['.dl', 'Суды и приставы'],
    ['.dnk', 'Деньги на кону'],
    ['.ex-flip', 'Факты'],
    ['.pk-izm', 'Что изменилось'],
    ['.din', 'Финансы'],
    ['.ngo', 'Налоги к отрасли'],
    ['.rnt', 'Рентабельность'],
    ['.ndp', 'НДС'],
    ['.ulo', 'Лимит УСН'],
    ['.krug', 'Связи'],
    ['.rq1', 'Реквизиты'],
    ['#ot-kak', 'Как посчитали'],
    ['.sut__g', 'Все данные']
  ];
  var SHIRINA = 860; // одна колонка листа (css/otchet.css)

  // punkty(spisok) — spisok: [{kl, podpis, top, h}] (top — от начала страницы). Видимые (h > 0), без повторов подписи,
  // по порядку на странице. Меньше трёх — оглавление не нужно (пустой список).
  function punkty(spisok) {
    var vid = {}, out = [];
    (spisok || []).filter(function (x) { return x && x.h > 0 && isFinite(x.top); })
      .sort(function (a, b) { return a.top - b.top; })
      .forEach(function (x) { if (!vid[x.podpis]) { vid[x.podpis] = 1; out.push(x); } });
    return out.length >= 3 ? out : [];
  }
  // aktivnyj(punkty, y) — номер раздела, верх которого уже прошёл линию y (низ шапки сайта и строки + запас); до первого — 0.
  function aktivnyj(p, y) {
    var k = 0;
    for (var i = 0; i < (p || []).length; i++) if (p[i].top <= y) k = i;
    return k;
  }

  var CSS =
    '.og1{position:fixed;left:0;right:0;top:var(--header-h,56px);z-index:39;display:none;' +
      'background:color-mix(in srgb,var(--bg,#F5F1E6) 94%,transparent);-webkit-backdrop-filter:saturate(180%) blur(12px);backdrop-filter:saturate(180%) blur(12px);' +
      'border-bottom:1px solid var(--line,#E3DDCD);transform:translateY(-6px);opacity:0;visibility:hidden;transition:opacity .18s,transform .18s,visibility .18s}' +
    '.og1.og1--vid{opacity:1;transform:none;visibility:visible}' +
    '.og1__l{display:flex;gap:4px;margin:0;padding:0 12px;list-style:none;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;' +
      '-webkit-mask-image:linear-gradient(90deg,transparent,#000 12px,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(90deg,transparent,#000 12px,#000 calc(100% - 28px),transparent)}' +
    '.og1__l::-webkit-scrollbar{display:none}' +
    '.og1__l li{flex:none}' +
    '.og1__a{position:relative;display:flex;align-items:center;min-height:44px;padding:0 10px;font-size:15px;line-height:1;white-space:nowrap;' +
      'color:var(--muted,#5B6783);text-decoration:none;border-radius:8px}' +
    '.og1__a[aria-current=true]{color:var(--ink,#0B1B3A);font-weight:600}' +
    '.og1__a[aria-current=true]::before{content:"";position:absolute;left:10px;right:10px;bottom:0;height:2px;border-radius:1px;background:var(--mat-fokus,#A07A28)}' +
    '[data-theme=dark] .og1__a[aria-current=true]::before{background:var(--mat-fokus-t,#D9B45A)}' +
    '.og1__a:focus-visible{outline:2px solid var(--mat-fokus,#A07A28);outline-offset:-2px}' +
    '[data-theme=dark] .og1__a:focus-visible{outline-color:var(--mat-fokus-t,#D9B45A)}' +
    '.og1-vspyshka{outline:2px solid var(--mat-fokus,#A07A28);outline-offset:4px;border-radius:8px;transition:outline-color 1.2s}' +
    '[data-theme=dark] .og1-vspyshka{outline-color:var(--mat-fokus-t,#D9B45A)}' +
    '@media (max-width:860px){.og1{display:block}}' +
    '@media (prefers-reduced-motion:reduce){.og1,.og1-vspyshka{transition:none}}' +
    '@media print{.og1{display:none!important}}';

  function stil(doc) {
    if (!doc || doc.getElementById('og1-css')) return;
    var s = doc.createElement('style'); s.id = 'og1-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  var tekushchij = null; // одно оглавление на страницу: новый отчёт снимает прежнее

  function snyat() {
    if (!tekushchij) return;
    var t = tekushchij; tekushchij = null;
    try { t.win.removeEventListener('scroll', t.naScroll); t.win.removeEventListener('resize', t.naRazmer); } catch (e) {}
    try { if (t.mo) t.mo.disconnect(); } catch (e) {}
    try { clearTimeout(t.tm); } catch (e) {}
    if (t.nav && t.nav.parentNode) t.nav.parentNode.removeChild(t.nav);
  }

  // mount(report) — после всех модулей листа (Otchet.razlozhit и разделы); только чужая компания
  function mount(report) {
    snyat();
    if (!report || !report.querySelector || !report.querySelector('.ot-hd')) return null;
    var doc = report.ownerDocument, win = doc.defaultView;
    if (!win || !doc.body) return null;
    try { stil(doc); } catch (e) {}
    var nav = doc.createElement('nav');
    nav.className = 'og1'; nav.id = 'og1'; nav.setAttribute('aria-label', 'Разделы отчёта');
    var ul = doc.createElement('ul'); ul.className = 'og1__l'; nav.appendChild(ul);
    doc.body.appendChild(nav);
    var t = { win: win, nav: nav, p: [], klyuch: '', tm: null, mo: null, akt: -1, cel: false };
    tekushchij = t;

    var reduce = false;
    try { reduce = win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    var shapkaH = function () {
      var v = 56;
      try { var s = parseFloat(win.getComputedStyle(doc.documentElement).getPropertyValue('--header-h')); if (s > 0) v = s; } catch (e) {}
      return v;
    };
    var liniya = function () { return shapkaH() + (nav.offsetHeight || 45) + 16; };

    var sobrat = function () {
      var sy = win.pageYOffset || 0, spisok = [];
      RAZDELY.forEach(function (rz) {
        var u = report.querySelector(rz[0]);
        if (!u) return;
        var b = u.getBoundingClientRect();
        spisok.push({ kl: rz[0], podpis: rz[1], top: Math.round(b.top + sy), h: Math.round(b.height), uzel: u });
      });
      var p = punkty(spisok), k = p.map(function (x) { return x.podpis; }).join('|');
      t.p = p;
      if (k === t.klyuch) return;
      t.klyuch = k; t.akt = -1;
      ul.innerHTML = '';
      p.forEach(function (x, i) {
        var li = doc.createElement('li'), a = doc.createElement('a');
        a.className = 'og1__a'; a.href = '#'; a.textContent = x.podpis; a.setAttribute('data-og', String(i));
        li.appendChild(a); ul.appendChild(li);
      });
    };

    var otmetit = function (i) {
      if (i === t.akt) return;
      t.akt = i;
      var ss = ul.querySelectorAll('.og1__a');
      for (var j = 0; j < ss.length; j++) {
        if (j === i) ss[j].setAttribute('aria-current', 'true'); else ss[j].removeAttribute('aria-current');
      }
      var a = ss[i];
      if (a) {
        // держим отмеченный пункт в поле зрения строки — только по горизонтали, страницу не двигаем
        var l = a.offsetLeft - 12, r = a.offsetLeft + a.offsetWidth + 28;
        if (l < ul.scrollLeft || r > ul.scrollLeft + ul.clientWidth) {
          var x = Math.max(0, a.offsetLeft - (ul.clientWidth - a.offsetWidth) / 2);
          try { ul.scrollTo({ left: x, behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { ul.scrollLeft = x; }
        }
      }
    };

    var obnovit = function () {
      if (!report.isConnected || !report.querySelector('.ot-hd')) { snyat(); return; }
      var uzko = win.innerWidth <= SHIRINA;
      var hd = report.querySelector('.ot-hd'), hb = hd.getBoundingClientRect(), rb = report.getBoundingClientRect();
      var vid = uzko && t.p.length > 0 && hb.bottom < shapkaH() && rb.bottom > shapkaH() + 120;
      // скрытая строка — visibility:hidden: не ловит нажатия и не попадает в Tab и читалку
      if (vid !== nav.classList.contains('og1--vid')) nav.classList.toggle('og1--vid', vid);
      if (vid) {
        var sy = win.pageYOffset || 0, y = sy + liniya();
        // верх разделов пересчитываем: выше могли раскрыться «Ещё N» или дорисоваться блоки
        t.p.forEach(function (x) { var b = x.uzel.getBoundingClientRect(); x.top = Math.round(b.top + sy); });
        otmetit(aktivnyj(t.p, y));
      }
    };
    var zhdet = false;
    t.naScroll = function () {
      if (zhdet) return;
      zhdet = true;
      (win.requestAnimationFrame || setTimeout)(function () { zhdet = false; obnovit(); });
    };

    ul.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('.og1__a') : null;
      if (!a) return;
      e.preventDefault();
      var x = t.p[+a.getAttribute('data-og')];
      if (!x || !x.uzel) return;
      var b = x.uzel.getBoundingClientRect(), y = Math.max(0, b.top + (win.pageYOffset || 0) - shapkaH() - (nav.offsetHeight || 45) - 8);
      try { win.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); } catch (er) { win.scrollTo(0, y); }
      x.uzel.classList.add('og1-vspyshka');
      setTimeout(function () { x.uzel.classList.remove('og1-vspyshka'); }, 1600);
      if (!t.cel) { t.cel = true; try { if (win.dlkGoal) win.dlkGoal('oglavlenie_otcheta'); } catch (er) {} }
    });

    sobrat();
    obnovit();
    win.addEventListener('scroll', t.naScroll, { passive: true });
    // поворот экрана и смена ширины меняют раскладку листа (две колонки ↔ одна) — порядок разделов собираем заново
    t.naRazmer = function () { clearTimeout(t.tm); t.tm = setTimeout(function () { if (tekushchij === t) { t.klyuch = ''; sobrat(); obnovit(); } }, 200); };
    win.addEventListener('resize', t.naRazmer, { passive: true });
    // разделы, которые приходят позже (/api/krug, нормы ФНС, комментарии), — пересобрать строку, не чаще раза в 300 мс
    if (win.MutationObserver) {
      t.mo = new win.MutationObserver(function () {
        clearTimeout(t.tm);
        t.tm = setTimeout(function () { if (tekushchij === t) { sobrat(); obnovit(); } }, 300);
      });
      t.mo.observe(report, { childList: true, subtree: true });
    }
    return nav;
  }

  return { RAZDELY: RAZDELY, punkty: punkty, aktivnyj: aktivnyj, mount: mount, snyat: snyat, stil: stil, CSS: CSS };
});
