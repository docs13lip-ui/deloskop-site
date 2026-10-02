/* Делоскоп — подсказки к терминам на экране проверки и в досье (решение владельца 02.10 «понятнее»:
 * «термины с подсказкой по наведению/тапу (ЗСК, 54.1, РНП…)»; claude/Решения_владельца_02.10_верстка_солиднее_техничнее_понятнее.md).
 * Справочник — /data/terminy.json: у каждого термина определение — дословные предложения из статьи сайта
 * (их уже сверило [Право]) и ссылка на эту статью. Новых правовых утверждений модуль не добавляет —
 * это держит tests/terminy.test.js. Подсказка — у первого упоминания термина в блоке; ссылки, кнопки,
 * заголовок компании и <summary> не трогаем. Чистые функции (sobrat, razmetit) — без DOM и сети. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Terminy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BUKVA = /[0-9A-Za-zА-Яа-яЁё]/;
  // заголовки разделов не трогаем: кнопка в строке заголовка Паспорта не переносится и выталкивает значок вбок на 390 px
  var NE_TROGAT = { A: 1, BUTTON: 1, SUMMARY: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, LABEL: 1 };
  var CSS =
    '.termin{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:help;text-align:inherit;' +
    'text-decoration:underline dotted;text-decoration-thickness:1px;text-underline-offset:.22em;text-decoration-color:currentColor}' +
    '.termin:hover,.termin[aria-expanded=true]{color:#0B63E5}' +
    '#termin-pop{position:absolute;z-index:70;box-sizing:border-box;max-width:320px;background:#fff;color:#1D1D1F;border:1px solid #E6E6E1;' +
    'border-radius:14px;padding:12px 14px;font:400 13.5px/1.5 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;' +
    'box-shadow:0 12px 36px rgba(0,0,0,.16);text-align:left}' +
    '#termin-pop b{display:block;font-weight:600;margin-bottom:4px}#termin-pop p{margin:0}' +
    '#termin-pop a{display:inline-block;margin-top:8px;color:#0B63E5}' +
    '@media print{#termin-pop{display:none!important}.termin{text-decoration:none}}';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // справочник → термины с готовыми выражениями (без lookbehind — старые Safari его не понимают)
  function sobrat(spr) {
    var out = [];
    ((spr && spr.terminy) || []).forEach(function (t) {
      if (!t || !t.id || !t.shablon || !t.opredelenie || !t.stranica) return;
      try { out.push({ t: t, re: new RegExp(t.shablon, 'g' + (t.flagi || '').replace(/g/g, '')) }); } catch (e) { /* битый шаблон — без подсказки */ }
    });
    return out;
  }

  // первое вхождение термина в строке с границами слова: [начало, конец] или null
  function najti(re, s) {
    re.lastIndex = 0;
    var m;
    while ((m = re.exec(s))) {
      if (!m[0]) { re.lastIndex++; continue; }
      var a = m.index, b = a + m[0].length;
      if ((a === 0 || !BUKVA.test(s.charAt(a - 1))) && (b >= s.length || !BUKVA.test(s.charAt(b)))) return [a, b];
      re.lastIndex = a + 1;
    }
    return null;
  }

  // строка → куски [{tekst}] и [{tekst, id}]; uzhe — id терминов, уже размеченных в этом блоке (дополняется)
  function razmetit(s, terminy, uzhe) {
    uzhe = uzhe || {};
    var kuski = [{ tekst: String(s == null ? '' : s) }];
    terminy.forEach(function (x) {
      if (uzhe[x.t.id]) return;
      for (var i = 0; i < kuski.length; i++) {
        var k = kuski[i];
        if (k.id) continue;
        var p = najti(x.re, k.tekst);
        if (!p) continue;
        var nov = [];
        if (p[0] > 0) nov.push({ tekst: k.tekst.slice(0, p[0]) });
        nov.push({ tekst: k.tekst.slice(p[0], p[1]), id: x.t.id });
        if (p[1] < k.tekst.length) nov.push({ tekst: k.tekst.slice(p[1]) });
        kuski.splice.apply(kuski, [i, 1].concat(nov));
        uzhe[x.t.id] = true;
        break;
      }
    });
    return kuski;
  }

  // содержимое всплывающей подсказки (HTML)
  function podskazka(t) {
    return '<b>' + esc(t.nazvanie) + '</b><p>' + esc(t.opredelenie) + '</p>' +
      '<a href="' + esc(t.stranica) + '">Подробнее: ' + esc(t.stranica_nazvanie || 'статья') + ' →</a>';
  }

  /* ---------- DOM ---------- */
  var zagruzka = null, SPR = null, svyazano = false, pop = null, tek = null;

  function zagruzit(url) {
    if (!zagruzka) {
      zagruzka = (typeof fetch === 'function' ? fetch(url || '/data/terminy.json', { cache: 'no-cache' })
        .then(function (o) { return o.ok ? o.json() : null; }) : Promise.resolve(null))
        .then(function (j) { SPR = j; return j; })
        .catch(function () { return null; });
    }
    return zagruzka;
  }

  function stil(doc) {
    if (doc.getElementById('termin-css')) return;
    var s = doc.createElement('style'); s.id = 'termin-css'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function zakryt() {
    if (pop) { pop.parentNode && pop.parentNode.removeChild(pop); pop = null; }
    if (tek) { tek.setAttribute('aria-expanded', 'false'); tek = null; }
  }

  function otkryt(btn) {
    var doc = btn.ownerDocument, win = doc.defaultView;
    var t = null;
    ((SPR && SPR.terminy) || []).forEach(function (x) { if (x.id === btn.getAttribute('data-termin')) t = x; });
    if (!t) return;
    zakryt();
    pop = doc.createElement('div');
    pop.id = 'termin-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Что значит «' + t.nazvanie + '»');
    pop.innerHTML = podskazka(t);
    doc.body.appendChild(pop);
    var r = btn.getBoundingClientRect(), w = pop.offsetWidth, sx = win.pageXOffset || 0, sy = win.pageYOffset || 0;
    var vw = doc.documentElement.clientWidth || win.innerWidth;
    pop.style.left = Math.max(sx + 8, Math.min(r.left + sx - 12, sx + vw - w - 8)) + 'px';
    pop.style.top = (r.bottom + sy + 8) + 'px';
    btn.setAttribute('aria-expanded', 'true'); tek = btn;
  }

  function svyazat(doc) {
    if (svyazano) return; svyazano = true;
    doc.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.termin') : null;
      if (b) { e.preventDefault(); if (tek === b && !b.hasAttribute('data-navedenie')) zakryt(); else otkryt(b); b.removeAttribute('data-navedenie'); return; }
      if (pop && !(e.target.closest && e.target.closest('#termin-pop'))) zakryt();
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tek) { var b = tek; zakryt(); b.focus(); } });
    // наведение — только там, где есть мышь; уход с термина и подсказки закрывает её через 300 мс
    var win = doc.defaultView, mysh = !!(win && win.matchMedia && win.matchMedia('(hover: hover) and (pointer: fine)').matches), tajmer = null;
    if (!mysh) return;
    doc.addEventListener('mouseover', function (e) {
      var b = e.target.closest ? e.target.closest('.termin, #termin-pop') : null;
      if (!b) return;
      clearTimeout(tajmer);
      if (b.classList.contains('termin') && tek !== b) { otkryt(b); b.setAttribute('data-navedenie', ''); }
    });
    doc.addEventListener('mouseout', function (e) {
      var b = e.target.closest ? e.target.closest('.termin, #termin-pop') : null;
      if (!b || !tek) return;
      var kuda = e.relatedTarget;
      if (kuda && kuda.closest && kuda.closest('.termin, #termin-pop')) return;
      clearTimeout(tajmer); tajmer = setTimeout(zakryt, 300);
    });
  }

  function mozhno(uzel, kont) {
    for (var p = uzel.parentNode; p && p !== kont; p = p.parentNode) {
      if (NE_TROGAT[p.nodeName] || (p.classList && (p.classList.contains('termin') || p.classList.contains('q'))) ||
          (p.hasAttribute && p.hasAttribute('data-bez-terminov'))) return false;
    }
    return true;
  }

  // размечает первые упоминания терминов в блоке kont; возвращает число подсказок
  function razmetitBlok(kont, spr) {
    if (!kont || !spr) return 0;
    var doc = kont.ownerDocument, terminy = sobrat(spr);
    if (!terminy.length) return 0;
    stil(doc); svyazat(doc);
    var uzhe = {}, n = 0, uzly = [];
    kont.querySelectorAll('.termin').forEach(function (b) { uzhe[b.getAttribute('data-termin')] = true; });
    var w = doc.createTreeWalker(kont, 4, null), u;
    while ((u = w.nextNode())) if (u.nodeValue && u.nodeValue.trim() && mozhno(u, kont)) uzly.push(u);
    uzly.forEach(function (uz) {
      var kuski = razmetit(uz.nodeValue, terminy, uzhe);
      // термин может занимать весь текстовый узел («ГИР БО» в <small>) — размечаем и его
      if (!kuski.some(function (k) { return k.id; })) return;
      var fr = doc.createDocumentFragment();
      kuski.forEach(function (k) {
        if (!k.id) { fr.appendChild(doc.createTextNode(k.tekst)); return; }
        var b = doc.createElement('button');
        b.type = 'button'; b.className = 'termin'; b.setAttribute('data-termin', k.id);
        b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-haspopup', 'dialog');
        b.textContent = k.tekst; fr.appendChild(b); n++;
      });
      uz.parentNode.replaceChild(fr, uz);
    });
    return n;
  }

  // главный вход: загрузить справочник и разметить блок; без справочника страница не меняется
  function mount(kont, url) {
    return zagruzit(url).then(function (spr) { try { return razmetitBlok(kont, spr); } catch (e) { return 0; } });
  }

  return { sobrat: sobrat, najti: najti, razmetit: razmetit, podskazka: podskazka, razmetitBlok: razmetitBlok, mount: mount, zagruzit: zagruzit };
});
