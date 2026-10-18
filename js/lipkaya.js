/* Делоскоп — липкая строка «Что делать завтра утром» (vizual-v3.1b «Инструмент», 18.10.2026).
   Визуал v3 §7, волна 3.1 (в): на телефоне, когда вывод отчёта ушёл за верх экрана, снизу держится одна строка —
   уровень вывода и кнопка «Что делать завтра утром». Кнопка открывает <dialog> с тем же выводом и теми же действиями.
   Новых утверждений нет: текст берётся из уже нарисованного вывода отчёта (Условия сделки / Щит) в момент открытия —
   сумма сделки и «кто кому платит», поменянные выше, попадают в окно как есть. Кнопки окна — ссылки вывода (их цели Метрики те же).
   Шире 600 px строки нет: вывод и так рядом. Нет IntersectionObserver или <dialog> — ничего не делаем. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkLipkaya = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ZAG = 'Что делать завтра утром';
  var UZKO = '(max-width: 600px)';
  var sostoyanie = null; // { bar, dlg, io, ro, report, doc, slushat }

  function tekst(e) { return e ? String(e.textContent || '').replace(/\s+/g, ' ').trim() : ''; }

  // vyvod(report) — что показать: { kratko, abzacy[], ssylki[] } из вывода отчёта; нечего — null.
  // Условия сделки: .usl-t (итог), .usl-r (почему), .usl-a (что сделать). Щит (своя компания): .ot-vt__p.
  // Запасной итог — уровень Индекса (.ot-ix__lv).
  function vyvod(report) {
    var vd = report && report.querySelector && report.querySelector('.ot-vd');
    if (!vd) return null;
    var vt = vd.querySelector('.ot-vt');
    var kratko = tekst(vt && vt.querySelector('.usl-t')) || tekst(vd.querySelector('.ot-ix__lv')) || tekst(vd.querySelector('.ot-pill'));
    var abzacy = [];
    if (vt) {
      ['.usl-t', '.usl-r', '.usl-a', '.ot-vt__p'].forEach(function (s) {
        var t = tekst(vt.querySelector(s));
        if (t && abzacy.indexOf(t) < 0) abzacy.push(t);
      });
    }
    var ssylki = [];
    Array.prototype.forEach.call(vd.querySelectorAll('.ot-act a[href]'), function (a) {
      var t = tekst(a);
      if (t) ssylki.push({ t: t, href: a.getAttribute('href'), glavnaya: a.classList.contains('p'), ist: a });
    });
    if (!kratko && !abzacy.length) return null;
    return { kratko: kratko, abzacy: abzacy, ssylki: ssylki, ton: (vd.className.match(/ot-vd--(\w+)/) || [])[1] || '' };
  }

  function el(doc, tag, cls, txt) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function zapolnitOkno(s) {
    var v = vyvod(s.report), dlg = s.dlg, doc = s.doc;
    var telo = dlg.querySelector('.lip-d__t'), act = dlg.querySelector('.lip-d__act');
    telo.textContent = ''; act.textContent = '';
    if (!v) return false;
    v.abzacy.forEach(function (t, i) { telo.appendChild(el(doc, 'p', i === 0 && v.abzacy.length > 1 ? 'lip-d__itog' : null, t)); });
    v.ssylki.forEach(function (x) {
      var a = el(doc, 'a', 'ot-btn ' + (x.glavnaya ? 'p' : 's'), x.t);
      a.href = x.href;
      if (x.ist.target) { a.target = x.ist.target; a.rel = 'noopener'; }
      // цель Метрики и особое поведение (Паспорт, «Следить») — у ссылки вывода: нажимаем её саму
      a.addEventListener('click', function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
        e.preventDefault();
        try { dlg.close(); } catch (er) {}
        x.ist.click();
      });
      act.appendChild(a);
    });
    return true;
  }

  function obnovitStroku(s) {
    var v = vyvod(s.report);
    var t = s.bar.querySelector('.lip__t');
    t.textContent = v ? v.kratko : '';
    s.bar.setAttribute('data-ton', v ? v.ton : '');
    return !!v;
  }

  // окно cookie внизу экрана — строка садится над ним
  function niz(s) {
    var ck = s.doc.querySelector('.ck-bar'), hgt = 0;
    if (ck && !ck.hidden) hgt = ck.getBoundingClientRect().height;
    s.doc.documentElement.style.setProperty('--lip-niz', Math.round(hgt) + 'px');
  }

  function pokazat(s, da) {
    var w = s.doc.defaultView;
    niz(s);
    var uzko = !!(w.matchMedia && w.matchMedia(UZKO).matches);
    var on = !!(da && uzko && !(s.dlg.open) && obnovitStroku(s));
    s.bar.classList.toggle('is-on', on);
    s.bar.inert = !on;
    s.doc.body.classList.toggle('lip-on', on);
  }

  function snyat() {
    var s = sostoyanie;
    if (!s) return;
    sostoyanie = null;
    try { if (s.io) s.io.disconnect(); if (s.ro) s.ro.disconnect(); } catch (e) {}
    try { if (s.dlg.open) s.dlg.close(); } catch (e) {}
    if (s.bar.parentNode) s.bar.parentNode.removeChild(s.bar);
    if (s.dlg.parentNode) s.dlg.parentNode.removeChild(s.dlg);
    if (s.mq && s.mq.removeEventListener) s.mq.removeEventListener('change', s.naMq);
    s.doc.body.classList.remove('lip-on');
    s.doc.documentElement.style.removeProperty('--lip-niz');
  }

  // mount(report) — после Otchet.razlozhit; повторный вызов (новая проверка) пересобирает строку.
  function mount(report) {
    snyat();
    var doc = report && report.ownerDocument, w = doc && doc.defaultView;
    if (!w || typeof w.IntersectionObserver !== 'function' || typeof w.HTMLDialogElement !== 'function') return false;
    var vd = report.querySelector('.ot-vd');
    if (!vd || !vyvod(report)) return false;

    var bar = el(doc, 'div', 'lip');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', ZAG);
    bar.inert = true;
    var kn = el(doc, 'button', 'lip__b');
    kn.type = 'button';
    kn.setAttribute('aria-haspopup', 'dialog');
    kn.appendChild(el(doc, 'span', 'lip__z', ZAG));
    kn.appendChild(el(doc, 'span', 'lip__t'));
    var str = el(doc, 'span', 'lip__s');
    str.setAttribute('aria-hidden', 'true');
    str.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l5-5 5 5"/></svg>';
    kn.appendChild(str);
    bar.appendChild(kn);

    var dlg = el(doc, 'dialog', 'lip-d');
    dlg.setAttribute('aria-labelledby', 'lip-d-h');
    var h = el(doc, 'h2', 'lip-d__h', ZAG); h.id = 'lip-d-h';
    var zakr = el(doc, 'button', 'lip-d__x', 'Закрыть'); zakr.type = 'button';
    dlg.appendChild(h); dlg.appendChild(el(doc, 'div', 'lip-d__t')); dlg.appendChild(el(doc, 'div', 'lip-d__act')); dlg.appendChild(zakr);

    var s = sostoyanie = { bar: bar, dlg: dlg, report: report, doc: doc, ushel: false };
    kn.addEventListener('click', function () {
      if (!zapolnitOkno(s)) return;
      try { dlg.showModal(); } catch (e) { return; }
      pokazat(s, false);
      try { if (w.dlkGoal) w.dlkGoal('lipkaya_otkryta'); } catch (e) {}
    });
    zakr.addEventListener('click', function () { dlg.close(); });
    // нажатие на затемнение вокруг окна — закрыть (само окно — без отступов, поэтому цель = dialog только снаружи содержимого)
    dlg.addEventListener('click', function (e) {
      if (e.target !== dlg) return;
      var r = dlg.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) dlg.close();
    });
    dlg.addEventListener('close', function () { if (sostoyanie === s) { pokazat(s, s.ushel); kn.focus({ preventScroll: true }); } });

    doc.body.appendChild(bar);
    doc.body.appendChild(dlg);

    // вывод ушёл за верх экрана — строка видна; вернулся или ниже — прячем
    s.io = new w.IntersectionObserver(function (z) {
      var e = z[z.length - 1];
      s.ushel = !e.isIntersecting && e.boundingClientRect.bottom <= 0;
      pokazat(s, s.ushel);
    });
    s.io.observe(vd);
    var ck = doc.querySelector('.ck-bar');
    if (ck && typeof w.ResizeObserver === 'function') {
      s.ro = new w.ResizeObserver(function () { niz(s); });
      s.ro.observe(ck);
    }
    if (w.matchMedia) {
      s.mq = w.matchMedia(UZKO);
      s.naMq = function () { pokazat(s, s.ushel); };
      if (s.mq.addEventListener) s.mq.addEventListener('change', s.naMq);
    }
    return true;
  }

  return { mount: mount, snyat: snyat, vyvod: vyvod, ZAG: ZAG, UZKO: UZKO };
});
