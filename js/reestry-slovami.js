/* Делоскоп — «В реестрах» словами в шапке отчёта по ИНН (план 18.11, разд. 3 п. 7: «счётчики реестров словами»).
 * Пять строк — Суды · Приставы · Госконтракты · Банкротство · Приостановки — из тех же данных, что плитки
 * «Коротко по реестрам» (DlkPlitki.sobrat), одним столбцом справа от «Главного» под реквизитами проверки:
 * на компьютере эта колонка шапки пустовала (~300 px), плитки — только на третьем экране.
 * Слова — как у плиток (правовая сверка 16.11): «не нашли» с источником и датой, «сегодня не проверяли» — не «чисто»;
 * суммы исков — «требования», не долг. Строка — ссылка к своей плитке (а та — к разделу «подробно»).
 * Чистые функции stroki и html — без DOM и сети, их проверяет tests/reestry_slovami.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkReestrySlovami = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = '\u00a0';
  var PORYADOK = ['sudy', 'fssp', 'kontrakty', 'bankrotstvo', 'priostanovki'];

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function skl(n, a, b, c) {
    var k = Math.abs(n) % 100, d = k % 10;
    return k > 10 && k < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c;
  }
  function chislo(c) { var n = parseInt(String(c || '').replace(/\D/g, ''), 10); return isFinite(n) ? n : null; }
  function zaglav(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  // Плитка → одна фраза. x — объект DlkPlitki.sobrat: { k, c, e, pod, ton, ist, data }.
  function fraza(x) {
    var k = x.k, n = chislo(x.c), nol = x.c === '0', pod = x.pod || '';
    if (x.ton === 'ne') {
      var m = /сведения на\s(\d{2}\.\d{2}\.\d{4})/.exec(x.e || '');
      return m ? 'Сведения устарели — на' + NB + m[1] : 'Сегодня не' + NB + 'проверяли';
    }
    if (k === 'sudy') {
      if (nol) return 'Незавершённых дел, где компания — ответчик, не' + NB + 'нашли';
      if (/ответчик/.test(x.e || '')) return x.c + NB + x.e + (/^требования/.test(pod) ? '; ' + pod : '');
      return x.c + NB + x.e;
    }
    if (k === 'fssp') {
      if (nol) return 'Производств не' + NB + 'нашли';
      return (n !== null ? x.c + NB + skl(n, 'производство', 'производства', 'производств') : 'Производства есть') + (pod ? '; ' + pod : '');
    }
    if (k === 'kontrakty') {
      var rnp = /недобросовестных/.test(pod) ? '; ' + pod : '';
      if (nol) return 'Контрактов как поставщик не' + NB + 'нашли' + rnp;
      if (n === null) return 'Контракты как поставщик есть' + rnp;
      return x.c + NB + skl(n, 'контракт или договор', 'контракта или договора', 'контрактов и' + NB + 'договоров') + ' как поставщик' +
        (!rnp && /^на\s/.test(pod) ? ' ' + pod : '') + rnp;
    }
    if (k === 'bankrotstvo') {
      if (nol) return /ЕГРЮЛ/.test(x.e || '') ? 'Отметок о' + NB + 'банкротстве в' + NB + 'ЕГРЮЛ не' + NB + 'нашли' : 'Сообщений о' + NB + 'банкротстве не' + NB + 'нашли';
      return x.c === '!' ? zaglav(x.e) : x.c + NB + x.e;
    }
    if (k === 'priostanovki') {
      if (nol) return 'Решений ФНС о' + NB + 'приостановке счетов не' + NB + 'нашли';
      return (n !== null && n > 0 ? x.c + NB + x.e : 'Есть решения ФНС') + ' о' + NB + 'приостановке счетов';
    }
    return '';
  }

  // T — массив плиток DlkPlitki.sobrat(r) → [{ k, zag, t, meta, ton }] в порядке PORYADOK (Финансы и Связи — не здесь:
  // отчётность уже в реквизитах проверки, «Связи» приходят отдельным запросом позже).
  function stroki(T) {
    var po = {};
    (Array.isArray(T) ? T : []).forEach(function (x) { if (x && x.k) po[x.k] = x; });
    var S = [];
    PORYADOK.forEach(function (k) {
      var x = po[k];
      if (!x) return;
      var t = fraza(x).replace(/ — /g, NB + '— ');
      if (!t) return;
      S.push({ k: k, zag: x.zag || k, t: t, ton: x.ton || '', meta: [x.ist, x.data ? 'на' + NB + x.data : ''].filter(Boolean).join(' · ') });
    });
    return S;
  }

  function html(S) {
    if (!S || !S.length) return '';
    return '<section class="rs1" aria-labelledby="rs1-h"><h2 id="rs1-h" class="rs1__h">В' + NB + 'реестрах</h2><ul class="rs1__l">' +
      S.map(function (s) {
        return '<li class="rs1__s rs1__s--' + esc(s.ton) + '" data-rs="' + esc(s.k) + '"><a class="rs1__a" href="#pl-h">' +
          '<span class="rs1__z">' + esc(s.zag) + '</span><span class="rs1__t">' + esc(s.t) + '</span>' +
          (s.meta ? '<small class="rs1__i">' + esc(s.meta) + '</small>' : '') + '</a></li>';
      }).join('') + '</ul></section>';
  }

  var CSS =
    '.rs1{margin:16px 0 0}' +
    '.rs1__h{margin:0 0 4px;font-size:13px;line-height:1.4;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#5B6783)}' +
    '.rs1__l{list-style:none;margin:0;padding:0}' +
    '.rs1__s{margin:0;border-bottom:1px solid var(--line,#E3DDCD)}' +
    '.rs1__a{display:grid;grid-template-columns:112px minmax(0,1fr);column-gap:12px;padding:8px 0 8px 10px;color:inherit;text-decoration:none;border-left:2px solid transparent}' +
    '.rs1__s--vnim .rs1__a{border-left-color:var(--mat-zhdu,#7A5C14)}' +
    '[data-theme=dark] .rs1__s--vnim .rs1__a{border-left-color:var(--mat-zhdu-t,#D9B45A)}' +
    '.rs1__a:hover .rs1__t{text-decoration:underline;text-decoration-color:var(--line,#E3DDCD);text-underline-offset:.2em}' +
    '.rs1__a:focus-visible{outline:2px solid var(--mat-fokus,#A07A28);outline-offset:2px;border-radius:4px}' +
    '[data-theme=dark] .rs1__a:focus-visible{outline-color:var(--mat-fokus-t,#D9B45A)}' +
    '.rs1__z{grid-row:1/3;font-size:13px;line-height:1.45;font-weight:600;color:var(--ink-2,#3A4868)}' +
    '.rs1__t{font-size:15px;line-height:1.4;color:var(--ink,#0B1B3A);font-variant-numeric:tabular-nums;text-wrap:pretty}' +
    '.rs1__s--ne .rs1__t{color:var(--muted,#5B6783)}' +
    '.rs1__i{grid-column:2;font-size:12px;line-height:1.4;color:var(--muted,#5B6783)}' +
    '@media (max-width:640px){.rs1{margin-top:12px}.rs1__a{grid-template-columns:96px minmax(0,1fr);column-gap:10px;min-height:44px;box-sizing:border-box}}' +
    '@media print{.rs1{break-inside:avoid}.rs1__a{border-left-color:transparent!important}}';

  function stil(doc) {
    if (!doc || doc.getElementById('rs1-css')) return;
    var s = doc.createElement('style'); s.id = 'rs1-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Нажатие строки — та же плитка ниже (у неё своя ссылка к разделу, вспышка и цель plitka_perehod); плитки нет — к заголовку плиток.
  function perehod(report, li, e) {
    var k = li.getAttribute('data-rs'), pa = report.querySelector('.pl li[data-pl="' + k + '"] a.pl__b');
    try { if (self.dlkGoal) self.dlkGoal('reestry_slovami', { k: k }); } catch (x) {}
    if (pa) { e.preventDefault(); pa.click(); return; }
    var h = report.querySelector('#pl-h');
    if (h) { e.preventDefault(); try { h.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (x) { h.scrollIntoView(); } }
  }

  // mount(report, r) — после DlkPlitki.mount: в правую колонку шапки листа (.ot-rq) под реквизиты проверки.
  function mount(report, r) {
    if (!report) return null;
    var star = report.querySelector('.rs1'), P = (typeof self !== 'undefined' && self.DlkPlitki) || null;
    var h = P ? html(stroki(P.sobrat(r))) : '';
    if (star && star.parentNode) star.parentNode.removeChild(star);
    var rq = report.querySelector('.ot-hd .ot-rq');
    if (!h || !rq) return null;
    var doc = report.ownerDocument, t = doc.createElement('div');
    t.innerHTML = h;
    var nov = t.firstChild;
    try { stil(doc); } catch (e) {}
    rq.appendChild(nov);
    Array.prototype.forEach.call(nov.querySelectorAll('li[data-rs]'), function (li) {
      var a = li.querySelector('a');
      if (a) a.onclick = function (e) { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return; perehod(report, li, e); };
    });
    return nov;
  }

  return { stroki: stroki, fraza: fraza, html: html, mount: mount, stil: stil, CSS: CSS, PORYADOK: PORYADOK };
});
