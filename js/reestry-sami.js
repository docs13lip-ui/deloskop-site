/* Делоскоп — «Что ещё проверить самим» в свёрнутом разделе «Все данные из реестров» экрана проверки по ИНН
 * (эталон экрана 02.10, п. 6 «Глубина из баз»; полоса Ночных-3 «новые законные источники данных без API»).
 * Справочник — /data/reestry-sami.json: открытые государственные реестры, которые мы пока не опрашиваем сами,
 * у каждого — кто ведёт, когда это важно, как обновляется, норма и дата сверки. Ничего не утверждаем о компании:
 * только «где посмотреть» — «не проверяли ≠ не нашли». Только организации (10-значный ИНН): данные ИП не трогаем.
 * reestry-sami-v3 (05.10): записи «по виду деятельности» (поле okved) — СРО строителей и проектировщиков, реестр экспедиторов,
 * справочник участников финансового рынка ЦБ — показываем, только если основной ОКВЭД из ЕГРЮЛ (company.okved) подходит; они идут первыми.
 * Чистые функции (dlya, html) — без DOM и сети, их проверяет tests/reestry_sami.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReestrySami = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = '\u00a0';
  // только официальные сайты ведомств — ссылку на чужой домен справочник не выведет
  var DOMENY = /^https:\/\/(www\.)?(reestr-zalogov\.ru|rmsp\.nalog\.ru|fips\.ru|fedresurs\.ru|pub\.fsa\.gov\.ru|reestr\.nostroy\.ru|reestr\.nopriz\.ru|mintrans\.gov\.ru|cbr\.ru|[a-z0-9-]+\.nalog\.(ru|gov\.ru))\//;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function dmy(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
  }
  // «ст. 4.1 209-ФЗ», «п. 4 ст. 339.1 ГК РФ» — неразрывно после сокращений и перед номером закона
  function nb(t) {
    return String(t).replace(/(^|\s)(п\.|ч\.|ст\.|пп\.) /g, '$1$2' + NB).replace(/(\d) (тыс\.|млн|млрд) ₽/g, '$1' + NB + '$2' + NB + '₽').replace(/ (\d+-ФЗ|ГК РФ)/g, NB + '$1').replace(/ГК РФ/g, 'ГК' + NB + 'РФ');
  }

  // Основной ОКВЭД из ответа: «43.21» → '43.21'; нет или не код — ''
  function kodOkved(r) {
    var k = String((((r || {}).company) || {}).okved == null ? '' : r.company.okved).trim();
    return /^\d{2}(\.\d{1,2}){0,2}$/.test(k) ? k : '';
  }
  // код подходит под префикс ОКВЭД: '43' → 43, 43.21; '41.2' (группа) → 41.20; '52.29' → 52.29, 52.29.1, но не 52.2
  function podPrefiks(kod, pr) {
    pr = String(pr || '');
    if (!pr || !kod) return false;
    return kod === pr || kod.indexOf(/\.\d$/.test(pr) ? pr : pr + '.') === 0;
  }
  function poOkved(x, kod) {
    if (!Array.isArray(x.okved)) return true;
    if (!kod) return false;
    var da = x.okved.some(function (p) { return podPrefiks(kod, p); });
    var net = Array.isArray(x.okved_krome) && x.okved_krome.some(function (p) { return podPrefiks(kod, p); });
    return da && !net;
  }

  // r — ответ /api/check, sprav — data/reestry-sami.json → [] | записи для показа (по виду деятельности — первыми)
  function dlya(r, sprav) {
    var inn = String((((r || {}).company) || {}).inn || '');
    if (!/^\d{10}$/.test(inn) || !sprav || !Array.isArray(sprav.reestry)) return [];
    var kod = kodOkved(r);
    var vse = sprav.reestry.filter(function (x) {
      return x && x.id && x.nazv && x.chto && x.norma && DOMENY.test(x.ssylka || '') && poOkved(x, kod);
    }).map(function (x) {
      return Array.isArray(x.okved) ? Object.assign({}, x, { okvedKod: kod }) : x;
    });
    return vse.filter(function (x) { return x.okvedKod; }).concat(vse.filter(function (x) { return !x.okvedKod; }));
  }

  function html(spisok, sprav) {
    if (!spisok || !spisok.length) return '';
    var d = dmy((sprav || {}).svereno);
    return '<section class="sut__s rs" data-reestry-sami><h4>Что ещё проверить самим в открытых реестрах</h4><dl>' +
      spisok.map(function (x) {
        return '<div data-reestr="' + esc(x.id) + '"' + (x.okvedKod ? ' data-okved' : '') + '><dt>' + esc(nb(x.nazv)) + '<small>' + esc(nb(x.kogda || '')) + '</small></dt>' +
          '<dd>' + esc(nb(x.chto)) + ' <a href="' + esc(x.ssylka) + '" target="_blank" rel="noopener"' +
          (x.cel ? ' data-goal="' + esc(x.cel) + '"' : '') + '>проверьте сами</a>' +
          '<small class="rs__m">' + esc(nb([x.okvedKod ? 'по основному ОКВЭД' + NB + x.okvedKod : '', x.kto, x.obnovlenie ? 'обновление: ' + x.obnovlenie : '', x.norma,
            x.okvedKod && dmy(x.svereno) ? 'сверено ' + dmy(x.svereno) : ''].filter(Boolean).join(' · '))) + '</small></dd></div>';
      }).join('') + '</dl>' +
      '<p>Эти реестры Делоскоп пока не опрашивает — результат проверки их не учитывает.' + (d ? ' Ссылки и нормы сверены ' + d + '.' : '') + '</p></section>';
  }

  var CSS = '.rs dt{align-content:start}.rs dt small{margin-top:2px}.rs dd .rs__m{display:block;margin-top:4px;font-size:12px;color:var(--muted,#6B6B70)}.rs dd a{color:inherit;text-decoration:underline}';

  var obeshchanie = null;
  function zagruzit(url) {
    if (!obeshchanie) {
      obeshchanie = (typeof fetch === 'function' ? fetch(url || '/data/reestry-sami.json', { cache: 'no-cache' })
        .then(function (o) { return o.ok ? o.json() : null; }) : Promise.resolve(null))
        .catch(function () { return null; });
    }
    return obeshchanie;
  }

  // Браузер: g — <details class="sut__g"> из js/sushchestvennoe.js. Раздел встаёт последним перед «Даты наборов».
  function vstavit(g, sprav, r) {
    if (!g || g.querySelector('[data-reestry-sami]')) return false;
    var h = html(dlya(r, sprav), sprav);
    if (!h) return false;
    var doc = g.ownerDocument || document;
    if (!doc.getElementById('rs-css')) {
      var s = doc.createElement('style'); s.id = 'rs-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
    }
    var d = g.querySelector('.sut__d');
    if (d) d.insertAdjacentHTML('beforebegin', h); else g.insertAdjacentHTML('beforeend', h);
    return true;
  }

  return { dlya: dlya, html: html, podPrefiks: podPrefiks, zagruzit: zagruzit, vstavit: vstavit, DOMENY: DOMENY, CSS: CSS };
});
