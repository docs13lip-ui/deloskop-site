/* Делоскоп — «Реквизиты проверки» на экране проверки по ИНН (решение владельца 02.10 «солиднее»:
 * «шапка отчёта … номер проверки, дата и время, «данные на …» — как реквизиты документа; печатная версия без потерь»).
 * Строка реквизитов под названием компании — только из ответа /api/check, ничего не дорисовываем:
 *   Проверка № — report_id (если API его выдал; тот же номер, что в PDF-досье);
 *   Проверено — дата и время проверки, МСК; если API дал только дату («2026-10-04»), дата — как в ответе,
 *     а время — момент получения ответа (opt.polucheno) и только если по Москве это тот же день; иначе — без времени
 *     (раньше полночь UTC выходила «03:00 МСК» — время, которого не было; vremya-proverki-v1, 04.10.2026);
 *   Самые давние сведения — самая ранняя дата «на …» среди строк светофора и её источник
 *     (открытые наборы ФНС обновляются раз в месяц — человек видит, насколько свежи данные);
 *   Бухотчётность — последний год ряда ГИР БО (dossier.charts).
 * Печать: Ctrl+P (и кнопка «Распечатать», если нет PDF-досье) печатает только отчёт — без шапки сайта и формы.
 * Чистые функции (sobrat, html) — без DOM и сети, их проверяет tests/rekvizity_proverki.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RekvizityProverki = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = '\u00a0';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function z(n) { return (n < 10 ? '0' : '') + n; }
  // «2026-09-01», «2026-09-01T…», «01.09.2026» → { klyuch: 20260901, tekst: '01.09.2026' } | null
  function data(s) {
    if (!s) return null;
    var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(s).trim());
    if (m) return { klyuch: +(m[3] + m[2] + m[1]), tekst: m[1] + '.' + m[2] + '.' + m[3] };
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s).trim());
    if (m) return { klyuch: +(m[1] + m[2] + m[3]), tekst: m[3] + '.' + m[2] + '.' + m[1] };
    return null;
  }
  // номер проверки — только безопасные символы (буквы, цифры, дефис), не длиннее 40
  function chistyjNomer(id) {
    var s = String(id == null ? '' : id).trim();
    return /^[0-9A-Za-z-]{1,40}$/.test(s) ? s : '';
  }
  function poslednijGod(ch) {
    var g = 0;
    (Array.isArray((ch || {}).revenue) ? ch.revenue : []).forEach(function (x) {
      var y = parseInt(x && x.year, 10);
      if (isFinite(y) && x.value != null && x.value !== '' && isFinite(Number(x.value)) && y > g) g = y;
    });
    return g || null;
  }

  /* Реквизиты: { nomer, data, vremya, davnie: {data, istochnik} | null, otchetnost: год | null } или null */
  // момент (мс) → дата, время и ключ дня по Москве (UTC+3, без перехода на летнее время)
  function poMoskve(t) {
    var m = new Date(t + 3 * 3600 * 1000);
    return { data: z(m.getUTCDate()) + '.' + z(m.getUTCMonth() + 1) + '.' + m.getUTCFullYear(),
      vremya: z(m.getUTCHours()) + ':' + z(m.getUTCMinutes()),
      klyuch: +(m.getUTCFullYear() + z(m.getUTCMonth() + 1) + z(m.getUTCDate())) };
  }
  var TOLKO_DATA = /^\s*\d{4}-\d{2}-\d{2}\s*$/;
  // opt.polucheno — Date или мс: когда браузер получил ответ /api/check (нужен, только если API дал дату без времени)
  function sobrat(r, opt) {
    if (!r || !r.company) return null;
    opt = opt || {};
    var s = r.checked_at || '';
    var o = { nomer: chistyjNomer(r.report_id), data: '', vremya: '', davnie: null, otchetnost: null };
    var segodnya = 0;
    if (TOLKO_DATA.test(s)) {
      var d0 = data(s);
      o.data = d0.tekst; segodnya = d0.klyuch;
      var pt = opt.polucheno instanceof Date ? opt.polucheno.getTime() : Number(opt.polucheno);
      if (opt.polucheno != null && isFinite(pt)) {
        var p = poMoskve(pt);
        if (p.klyuch === segodnya) o.vremya = p.vremya;
      }
    } else {
      var t = Date.parse(s);
      if (isFinite(t)) {
        var m = poMoskve(t);
        o.data = m.data; o.vremya = m.vremya; segodnya = m.klyuch;
      }
    }
    // самая ранняя дата сведений среди строк светофора; даты позже проверки не берём (ошибка источника)
    (r.signals || []).forEach(function (x) {
      var d = x && data(x.as_of);
      if (!d || (segodnya && d.klyuch > segodnya)) return;
      if (!o.davnie || d.klyuch < o.davnie.klyuch) o.davnie = { klyuch: d.klyuch, data: d.tekst, istochnik: String(x.source || '').split(':')[0].trim() };
    });
    if (o.davnie && o.davnie.klyuch === segodnya) o.davnie = null; // всё на сегодня — строка не нужна
    if (o.davnie) delete o.davnie.klyuch;
    o.otchetnost = poslednijGod((r.dossier || {}).charts);
    if (!o.data && !o.nomer) return null;
    return o;
  }

  function html(r, opt) {
    var o = sobrat(r, opt);
    if (!o) return '';
    var p = [];
    if (o.nomer) p.push(['Проверка №', '<span class="rkv__nom">' + esc(o.nomer) + '</span>']);
    if (o.data) p.push(['Проверено', esc(o.data) + (o.vremya ? ', ' + esc(o.vremya) + NB + 'МСК' : '')]);
    if (o.davnie) p.push(['Самые давние сведения', esc(o.davnie.data) + (o.davnie.istochnik ? '<small>' + esc(o.davnie.istochnik) + '</small>' : '')]);
    if (o.otchetnost) p.push(['Бухотчётность', 'за ' + o.otchetnost + NB + 'год<small>ГИР БО</small>']);
    return '<dl class="rkv">' + p.map(function (x) {
      return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>';
    }).join('') + '</dl>';
  }

  // всегда 2 × 2: колонка отчёта на главной узкая (~460 px) — четыре в ряд не помещаются, три + одна выглядят обрывком
  var CSS = '.rkv{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:0;border-top:1px solid var(--line,#E6E6E1);border-bottom:1px solid var(--line,#E6E6E1)}' +
    '.rkv>div{padding:10px 12px 10px 0;min-width:0}.rkv>div:nth-child(even){border-left:1px solid #EFEFEA;padding-left:12px}' +
    '.rkv>div:nth-child(n+3){border-top:1px solid #EFEFEA}' +
    '.rkv dt{font-size:12px;color:var(--muted,#6B6B70);letter-spacing:.02em;margin:0 0 2px}' +
    '.rkv dd{margin:0;font-size:14px;font-weight:600;color:var(--ink,#1D1D1F);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}' +
    '.rkv dd small{display:block;font-size:12px;font-weight:400;color:var(--muted,#6B6B70)}' +
    '.rkv__nom{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;font-weight:500;letter-spacing:.02em}' +
    '@media print{@page{margin:14mm}html,body{background:#fff!important}.rkv-skryt{display:none!important}' +
    '.report{box-shadow:none!important;border-radius:0!important;padding:0!important;max-width:none!important;width:auto!important;grid-column:1/-1!important}' +
    '.report-actions,.otz{display:none!important}.rkv,.rows .row{break-inside:avoid}' +
    '.rkv,.pill,.row b{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';

  function stil(doc) {
    if (!doc || doc.getElementById('rkv-css')) return;
    var s = doc.createElement('style'); s.id = 'rkv-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Печать только отчёта: всё, что не лежит на пути от <body> к отчёту, при печати скрыто (класс rkv-skryt).
  function pechatTolkoOtchet(report) {
    var doc = report.ownerDocument || document;
    var n = report;
    while (n && n.parentNode && n !== doc.body) {
      var p = n.parentNode;
      for (var i = 0; i < p.children.length; i++) {
        var s = p.children[i];
        if (s !== n && !/^(SCRIPT|STYLE|LINK|META)$/.test(s.tagName)) s.classList.add('rkv-skryt');
      }
      n = p;
    }
  }

  // Браузер: реквизиты — сразу под шапкой отчёта; печать — только отчёт. Ошибка — отчёт остаётся как был.
  function mount(report, r, opt) {
    if (!report) return false;
    var h = '';
    try { h = html(r, opt); } catch (e) { h = ''; }
    var doc = report.ownerDocument || document;
    try { stil(doc); } catch (e) {}
    try { pechatTolkoOtchet(report); } catch (e) {}
    if (!h) return false;
    var head = report.querySelector('.report-head');
    // «Проверка на 02.10.2026» → дата ушла в реквизиты; ярлык — название документа
    var tag = report.querySelector('.report-head .tag');
    if (tag && /^Проверка на /.test(tag.textContent)) tag.textContent = 'Отчёт о проверке контрагента';
    var w = doc.createElement('div');
    w.innerHTML = h;
    if (head && head.parentNode) head.parentNode.insertBefore(w.firstChild, head.nextSibling);
    else report.insertBefore(w.firstChild, report.firstChild);
    var act = report.querySelector('.report-actions');
    if (act && !act.querySelector('.btn-doc') && typeof window !== 'undefined' && window.print) {
      var b = doc.createElement('button');
      b.type = 'button'; b.setAttribute('data-act', 'print'); b.textContent = 'Распечатать';
      b.onclick = function () { window.print(); };
      var again = act.querySelector('[data-act="again"]');
      act.insertBefore(b, again || null);
    }
    return true;
  }

  return { sobrat: sobrat, html: html, mount: mount, data: data, CSS: CSS };
});
