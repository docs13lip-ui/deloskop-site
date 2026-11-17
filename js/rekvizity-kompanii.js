/* Делоскоп — «Реквизиты компании» в отчёте по ИНН (rekvizity-otcheta-v1; план команды 18.11, разд. 3 п. 4).
 * Замер 18.11: у справочников реквизиты — на первом экране и копируются одной кнопкой; у нас ИНН и ОГРН были в строке
 * под названием, а КПП, адрес, капитал и вид деятельности — только в свёрнутых «Все данные из реестров».
 * Что: справа от основного (на компьютере — в пустой правой колонке листа, сразу под шапкой; на телефоне — после
 * основных разделов) — полное наименование, ИНН, КПП, ОГРН, дата регистрации, статус, адрес, основной вид деятельности
 * с кодом ОКВЭД, уставный капитал; подпись «ЕГРЮЛ, сведения на …» и кнопка «Скопировать реквизиты».
 * Только то, что уже пришло в ответе /api/check (company и dossier.sections) — новых запросов нет; поля, которых нет,
 * не показываем (и не пишем «нет»). Только организации: у ИП в реквизитах — ФИО и адрес человека, их не выводим.
 * Руководителя и участников здесь нет — по рамке юриста 18.11 п. 1 (ФИО — после условий).
 * Чистые функции sobrat, tekst и html — без DOM и сети, их проверяет tests/rekvizity_kompanii.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkRekvizity = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = ' ';
  var STATUS = { ACTIVE: 'действующая', LIQUIDATING: 'в процессе ликвидации', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'в процессе реорганизации' };

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function dmy(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function chist(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function stroki(r) {
    var o = {};
    ((r && r.dossier && Array.isArray(r.dossier.sections)) ? r.dossier.sections : []).forEach(function (s) {
      (s && Array.isArray(s.rows) ? s.rows : []).forEach(function (x) { if (Array.isArray(x) && x[0] && !(x[0] in o)) o[chist(x[0])] = chist(x[1]); });
    });
    return o;
  }
  function kavychki(t) {
    var I = typeof self !== 'undefined' ? self.DlkImya || self.Imya : null;
    try { if (I && I.kavychki) return I.kavychki(t); } catch (e) {}
    return t;
  }
  // «ЕГРЮЛ/ЕГРИП — на 18.11.2026» из dossier.data_dates; нет — дата проверки
  function naDatu(r) {
    var m = /ЕГРЮЛ[^;]*?на\s+(\d{2}\.\d{2}\.\d{4})/.exec(String((r && r.dossier && r.dossier.data_dates) || ''));
    if (m) return m[1];
    return dmy(r && r.checked_at);
  }

  // sobrat(r) → { polya: [[подпись, значение, ключ]], na: 'ДД.ММ.ГГГГ' } или null (ИП, нет ИНН)
  function sobrat(r) {
    var c = (r && r.company) || {}, inn = String(c.inn || '').replace(/\D/g, '');
    if (inn.length !== 10 || c.kind === 'INDIVIDUAL') return null;
    var S = stroki(r), P = [];
    function add(k, t, v) { v = chist(v); if (v) P.push([t, v, k]); }
    add('nazv', 'Полное наименование', kavychki(chist(c.name_full || S['Полное наименование'] || c.name_short)));
    add('inn', 'ИНН', inn);
    var kpp = /^\d{9}$/.test(String(c.kpp || '')) ? c.kpp : (/\/\s*(\d{9})/.exec(S['ИНН / КПП'] || '') || [])[1];
    add('kpp', 'КПП', kpp);
    add('ogrn', 'ОГРН', /^\d{13}$/.test(String(c.ogrn || '')) ? c.ogrn : (/^(\d{13})/.exec(S['ОГРН'] || '') || [])[1]);
    add('reg', 'Дата регистрации', dmy(c.reg_date) || S['Дата регистрации']);
    var st = '';
    try { st = typeof self !== 'undefined' && self.StatusKod ? self.StatusKod.izOtveta(c) : ''; } catch (e) { st = ''; }
    add('status', 'Статус', st || STATUS[c.status] || S['Статус']);
    add('adres', 'Юридический адрес', c.address || S['Юридический адрес']);
    var ok = S['Основной вид деятельности'] || '';
    if (!ok && c.okved) ok = c.okved + (c.okved_name ? ' — ' + c.okved_name : '');
    add('okved', 'Основной вид деятельности (ОКВЭД)', ok.replace(/^(\d{2}(?:\.\d{1,2}){0,2})\s+[—–-]\s+/, '$1' + NB + '— '));
    add('kapital', 'Уставный капитал', /\d/.test(S['Уставный капитал'] || '') ? S['Уставный капитал'] : '');
    add('ifns', 'Налоговая инспекция', S['Налоговая инспекция']);
    if (P.length < 3) return null;
    return { polya: P, na: naDatu(r) };
  }

  // Текст для буфера обмена — как в карточке контрагента у бухгалтера: «Подпись: значение», в конце — откуда и на какую дату
  function tekst(R) {
    if (!R) return '';
    return R.polya.map(function (x) { return x[0] + ': ' + x[1].replace(/ /g, ' '); }).join('\n') +
      '\nИсточник: ЕГРЮЛ' + (R.na ? ', сведения на ' + R.na : '') + ' (deloskop.ru)';
  }

  function html(R) {
    if (!R) return '';
    return '<section class="ot-sc rq1" id="rekvizity" aria-labelledby="rq1-h"><h3 id="rq1-h">Реквизиты компании</h3>' +
      '<dl class="rq1__l">' + R.polya.map(function (x) {
        return '<div class="rq1__s rq1__s--' + x[2] + '"><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>';
      }).join('') + '</dl>' +
      '<p class="rq1__ist">ЕГРЮЛ' + (R.na ? ', сведения на' + NB + esc(R.na) : '') + '</p>' +
      '<button type="button" class="rq1__k" data-rq1-kop>Скопировать реквизиты</button>' +
      '<span class="rq1__ok" role="status" aria-live="polite"></span></section>';
  }

  var CSS =
    '.rq1 h3{margin:0 0 8px}' +
    '.rq1__l{margin:0;display:grid;gap:0}' +
    '.rq1__s{display:grid;grid-template-columns:minmax(96px,38%) 1fr;gap:2px 12px;padding:6px 0;border-top:1px solid var(--line,#E3DDCD)}' +
    '.rq1__s:first-child{border-top:0}' +
    '.rq1__s dt{font-size:13px;line-height:1.4;color:var(--muted,#5B6783)}' +
    '.rq1__s dd{margin:0;font-size:13px;line-height:1.4;color:var(--ink,#0B1B3A);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}' +
    '.rq1__s--inn dd,.rq1__s--kpp dd,.rq1__s--ogrn dd{font-weight:600;letter-spacing:.02em}' +
    '.ot-sc.rq1 .rq1__ist{margin:8px 0 0;font-size:12px;line-height:1.4;color:var(--muted,#5B6783)}' +
    '.rq1__k{margin:12px 0 0;min-height:44px;padding:0 16px;border-radius:10px;border:1px solid var(--line,#E3DDCD);background:var(--card,#fff);' +
      'color:var(--ink,#0B1B3A);font:inherit;font-size:15px;cursor:pointer}' +
    '.rq1__k:hover{border-color:currentColor}' +
    '.rq1__k:focus-visible{outline:2px solid var(--mat-fokus,#A07A28);outline-offset:2px}' +
    '[data-theme=dark] .rq1__k:focus-visible{outline-color:var(--mat-fokus-t,#D9B45A)}' +
    '.rq1__ok{display:block;min-height:18px;margin-top:4px;font-size:12px;color:var(--muted,#5B6783)}' +
    '@media (max-width:860px){.rq1__s{grid-template-columns:minmax(110px,34%) 1fr}.rq1__s dt,.rq1__s dd{font-size:15px}}' +
    '@media print{.rq1__k,.rq1__ok{display:none}}';

  function stil(doc) {
    if (!doc || doc.getElementById('rq1-css')) return;
    var s = doc.createElement('style'); s.id = 'rq1-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // mount(report, r) — после Otchet.razlozhit: первым в правой колонке листа (.ot-side)
  function mount(report, r) {
    if (!report || !r) return null;
    var side = report.querySelector('.ot-side'), star = report.querySelector('.rq1');
    if (star && star.parentNode) star.parentNode.removeChild(star);
    var R = sobrat(r);
    if (!side || !R) return null;
    var doc = report.ownerDocument;
    try { stil(doc); } catch (e) {}
    var t = doc.createElement('div');
    t.innerHTML = html(R);
    var nov = t.firstChild;
    side.insertBefore(nov, side.firstChild);
    var k = nov.querySelector('[data-rq1-kop]'), ok = nov.querySelector('.rq1__ok'), txt = tekst(R);
    k.addEventListener('click', function () {
      var gotovo = function () { ok.textContent = 'Скопировано'; setTimeout(function () { ok.textContent = ''; }, 2500); };
      var ruchnoj = function () {
        try {
          var a = doc.createElement('textarea'); a.value = txt; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0';
          doc.body.appendChild(a); a.select(); var y = doc.execCommand('copy'); doc.body.removeChild(a);
          ok.textContent = y ? 'Скопировано' : 'Не удалось скопировать — выделите строки вручную';
        } catch (e) { ok.textContent = 'Не удалось скопировать — выделите строки вручную'; }
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(gotovo, ruchnoj);
        else ruchnoj();
      } catch (e) { ruchnoj(); }
      try { if (self.dlkGoal) self.dlkGoal('rekvizity_kopiya'); } catch (e) {}
    });
    return nov;
  }

  return { sobrat: sobrat, tekst: tekst, html: html, mount: mount, stil: stil, CSS: CSS };
});
