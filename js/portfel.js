/* Делоскоп — «Ваши контрагенты» на главной: последние проверки в этом браузере одним списком, один светофор
 * (ТЗ [Продукт] 02.10 19:37, разд. 1). Данные — ТОЛЬКО то, что уже лежит в браузере:
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
    var imya = r.ip ? 'Индивидуальный предприниматель' : (r.nm || 'Компания');
    return '<li class="pf__r" data-inn="' + r.inn + '">' +
      '<div class="pf__a"><b class="pf__nm">' + esc(imya) + '</b><span class="pf__pill pf__pill--' + r.ur + '">' + UR[r.ur].t + '</span></div>' +
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
