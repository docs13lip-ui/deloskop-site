/* Делоскоп — «Динамика за 3–5 лет» и «Что изменилось с вашей прошлой проверки» на экране проверки по ИНН
 * (решение владельца 02.10, эталон экрана — п. 5 «Динамика и тренды»).
 * Данные — только из ответа /api/check: dossier.charts (ГИР БО ФНС, годовая бухотчётность), signals, company, zsk.
 * Снимки для «что изменилось» хранятся ТОЛЬКО в браузере (localStorage, ключ dlk_snimki): без ФИО, адресов и сумм,
 * кроме выручки и прибыли из открытой отчётности. Нет доступа к хранилищу — блока «что изменилось» нет.
 * Чистые функции (ryady, trendy, snimok, sravnit, html) — без DOM и сети, их проверяет tests/dinamika.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Dinamika = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = ' ';
  var KEY = 'dlk_snimki', MAKS_INN = 40, MAKS_SNIMKOV = 4, CHAS = 3600 * 1000;
  var POKAZATELI = [
    { k: 'revenue', nazv: 'Выручка', dengi: true },
    { k: 'profit', nazv: 'Чистая прибыль', dengi: true, znak: true },
    { k: 'income_tax', nazv: 'Налог на прибыль', dengi: true }
  ];
  var LVL = { low: 'низкий', medium: 'средний', high: 'высокий' };
  var STX = { ok: 'норма', info: 'справочно', warn: 'внимание', bad: 'риск' };
  var VES = { ok: 0, info: 0, warn: 1, bad: 2 };
  var STATUS = { ACTIVE: 'действующая', LIQUIDATING: 'ликвидируется или исключается из ЕГРЮЛ', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' };

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function chislo(v, zn) { return v.toFixed(zn).replace('.', ','); }
  function dengi(v) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e12) return s + chislo(a / 1e12, 1) + NB + 'трлн' + NB + '₽';
    if (a >= 1e9) return s + chislo(a / 1e9, 1) + NB + 'млрд' + NB + '₽';
    if (a >= 1e6) return s + chislo(a / 1e6, 1) + NB + 'млн' + NB + '₽';
    if (a >= 1e3) return s + Math.round(a / 1e3) + NB + 'тыс.' + NB + '₽';
    return s + Math.round(a) + NB + '₽';
  }
  function procent(p) {
    var r = Math.round(p);
    return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r) + NB + '%';
  }

  // Ряд по годам: числа, без повторов года, по возрастанию, последние 5 лет.
  function ryad(arr) {
    var po = {};
    (Array.isArray(arr) ? arr : []).forEach(function (x) {
      if (!x) return;
      var g = parseInt(x.year, 10), v = Number(x.value);
      if (g > 1990 && g < 2100 && x.value !== null && x.value !== '' && isFinite(v)) po[g] = v;
    });
    return Object.keys(po).map(Number).sort(function (a, b) { return a - b; }).slice(-5)
      .map(function (g) { return { year: g, value: po[g] }; });
  }

  // Показатели с рядом не короче 3 лет (иначе это не динамика).
  function ryady(r) {
    var ch = (r && r.dossier && r.dossier.charts) || {};
    return POKAZATELI.map(function (p) {
      return { k: p.k, nazv: p.nazv, znak: !!p.znak, ryad: ryad(ch[p.k]) };
    }).filter(function (p) { return p.ryad.length >= 3; });
  }

  // Одна строка: значение последнего года, изменение к прошлому году и за период — простыми словами.
  function stroka(p) {
    var a = p.ryad, n = a.length, posl = a[n - 1], pred = a[n - 2], perv = a[0];
    var o = { k: p.k, nazv: p.nazv, god: posl.year, znach: posl.value, ryad: a, kGodu: '', zaPeriod: '', ton: 'ro' };
    if (p.znak && posl.value < 0) o.znachTekst = 'убыток ' + dengi(-posl.value);
    else o.znachTekst = dengi(posl.value);
    if (p.znak && (pred.value < 0) !== (posl.value < 0)) {
      o.kGodu = posl.value < 0 ? 'в ' + pred.year + NB + '— прибыль' : 'в ' + pred.year + NB + '— убыток';
      o.ton = posl.value < 0 ? 'vniz' : 'vverh';
    } else if (pred.value > 0 && posl.value >= 0) {
      var d = (posl.value - pred.value) / pred.value * 100;
      o.kGodu = procent(d) + ' к' + NB + pred.year;
      o.ton = Math.round(d) > 0 ? 'vverh' : Math.round(d) < 0 ? 'vniz' : 'ro';
      if (p.znak && posl.value === 0) o.ton = 'ro';
    }
    if (perv.value > 0 && posl.value > 0) o.zaPeriod = procent((posl.value - perv.value) / perv.value * 100) + ' с' + NB + perv.year;
    if (p.znak) {
      var ub = a.filter(function (x) { return x.value < 0; }).map(function (x) { return x.year; });
      // убыток прошлого года уже назван в строке «в 2024 — убыток» — не повторяем
      if (ub.length && !(ub.length === 1 && ub[0] === pred.year && o.kGodu)) o.zaPeriod = 'убыток в' + NB + ub.join(', ');
      else if (ub.length) o.zaPeriod = '';
    }
    return o;
  }

  // Короткие выводы: не больше двух, только из чисел ряда.
  function trendy(r) {
    var rs = ryady(r), out = [];
    var v = rs.filter(function (p) { return p.k === 'revenue'; })[0];
    if (v) {
      var a = v.ryad, rost = 0, pad = 0;
      for (var i = 1; i < a.length; i++) { if (a[i].value > a[i - 1].value) rost++; else if (a[i].value < a[i - 1].value) pad++; }
      var m = a.length - 1;
      if (rost === m) out.push('Выручка росла каждый год с' + NB + a[0].year + ' по' + NB + a[m].year + '.');
      else if (pad === m) out.push('Выручка снижалась каждый год с' + NB + a[0].year + ' по' + NB + a[m].year + '.');
      else out.push('Выручка росла год к году ' + rost + ' ' + (rost >= 2 && rost <= 4 ? 'раза' : 'раз') + ' из' + NB + m + ' — с' + NB + a[0].year + ' по' + NB + a[m].year + '.');
    }
    var p = rs.filter(function (x) { return x.k === 'profit'; })[0];
    if (p) {
      var ub = p.ryad.filter(function (x) { return x.value < 0; }).length, n = p.ryad.length;
      if (!ub) out.push('Прибыль — в каждом из' + NB + n + ' лет отчётности.');
      else if (ub === n) out.push('Убыток — в каждом из' + NB + n + ' лет отчётности.');
      else out.push('Убыток — в' + NB + ub + ' из' + NB + n + ' лет отчётности.');
    }
    return out.slice(0, 2);
  }

  // Маленькие столбики (визуальная подсказка; числа — в тексте рядом).
  function stolbiki(a) {
    var W = 64, H = 24, mx = 0, mn = 0;
    a.forEach(function (x) { mx = Math.max(mx, x.value); mn = Math.min(mn, x.value); });
    var span = (mx - mn) || 1, nol = H * mx / span, bw = W / a.length;
    var g = a.map(function (x, i) {
      var h = Math.max(1, Math.abs(x.value) / span * H), y = x.value >= 0 ? nol - h : nol;
      return '<rect x="' + (i * bw + 1.5).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw - 3).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1.5"' +
        (x.value < 0 ? ' class="din__neg"' : i === a.length - 1 ? ' class="din__last"' : '') + '/>';
    }).join('');
    return '<svg class="din__sv" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">' + g + '</svg>';
  }

  var STRELKA = { vverh: '▲', vniz: '▼', ro: '' };

  function htmlDinamika(r) {
    var rs = ryady(r);
    if (!rs.length) return '';
    var st = rs.map(stroka), g0 = st[0].ryad[0].year, g1 = st[0].god;
    st.forEach(function (s) { g0 = Math.min(g0, s.ryad[0].year); g1 = Math.max(g1, s.god); });
    var tr = trendy(r);
    return '<section class="din" aria-label="Динамика по годам">' +
      '<div class="din__h"><b>Динамика за ' + g0 + '–' + g1 + '</b><span>по годовой бухотчётности</span></div>' +
      '<ul class="din__l">' + st.map(function (s) {
        return '<li class="din__r din__r--' + s.ton + '"><span class="din__n">' + esc(s.nazv) + '<small>за ' + s.god + '</small></span>' +
          stolbiki(s.ryad) +
          '<span class="din__v"><b>' + s.znachTekst + '</b>' +
          (s.kGodu ? '<small class="din__k">' + (STRELKA[s.ton] ? STRELKA[s.ton] + NB : '') + s.kGodu + '</small>' : '') +
          (s.zaPeriod ? '<small>' + s.zaPeriod + '</small>' : '') + '</span></li>';
      }).join('') + '</ul>' +
      (tr.length ? '<p class="din__t">' + tr.map(esc).join(' ') + '</p>' : '') +
      '<p class="din__src">Источник: ГИР БО ФНС, годовая бухгалтерская отчётность; последний год — ' + g1 + ' (на' + NB + '31.12.' + g1 + ').</p>' +
      '</section>';
  }

  // ---- «Что изменилось»: снимок существенных фактов, без персональных данных ----
  function snimok(r) {
    if (!r || !r.company) return null;
    var c = r.company, inn = String(c.inn || '');
    if (!/^\d{10}(\d{2})?$/.test(inn) || /^0+$/.test(inn)) return null;
    var t = Date.parse(r.checked_at || '');
    if (!isFinite(t)) return null;
    var s = { t: t, inn: inn, lvl: LVL[r.risk_level] ? r.risk_level : '', st: STATUS[c.status] ? c.status : '', sig: {} };
    (r.signals || []).forEach(function (x) {
      if (x && /^[a-z0-9_]{2,32}$/.test(x.id || '') && STX[x.status]) s.sig[x.id] = [x.status, String(x.title || '').slice(0, 80)];
    });
    if (r.zsk && LVL[r.zsk.level]) s.zsk = r.zsk.level;
    if (inn.length === 10) {
      if (c.director_since) s.dir = String(c.director_since).slice(0, 10);
      s.nedost = !!(c.invalid || c.address_invalid);
      var ch = (r.dossier && r.dossier.charts) || {}, v = ryad(ch.revenue), p = ryad(ch.profit);
      if (v.length) s.vyr = [v[v.length - 1].year, v[v.length - 1].value];
      if (p.length) s.prib = [p[p.length - 1].year, p[p.length - 1].value];
    }
    return s;
  }

  function dataRu(t) {
    var d = new Date(t), m = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return d.getDate() + NB + m[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function dmy(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }

  // Список изменений между двумя снимками одной компании: [{ton:'huzhe'|'luchshe'|'info', t:'…'}], хуже — первыми.
  function sravnit(a, b) {
    if (!a || !b || a.inn !== b.inn) return [];
    var out = [];
    function add(ton, t) { out.push({ ton: ton, t: t }); }
    if (a.st && b.st && a.st !== b.st) add(b.st === 'ACTIVE' ? 'luchshe' : 'huzhe', 'Статус в ЕГРЮЛ: ' + STATUS[a.st] + ' → ' + STATUS[b.st]);
    if (a.lvl && b.lvl && a.lvl !== b.lvl) {
      var o = ['low', 'medium', 'high'];
      add(o.indexOf(b.lvl) > o.indexOf(a.lvl) ? 'huzhe' : 'luchshe', 'Оценка риска: ' + LVL[a.lvl] + ' → ' + LVL[b.lvl]);
    }
    if (a.zsk && b.zsk && a.zsk !== b.zsk) {
      var z = ['low', 'medium', 'high'];
      add(z.indexOf(b.zsk) > z.indexOf(a.zsk) ? 'huzhe' : 'luchshe', 'Прогноз ЗСК (наша оценка): ' + LVL[a.zsk] + ' → ' + LVL[b.zsk]);
    }
    if (a.nedost === false && b.nedost === true) add('huzhe', 'Появилась отметка о недостоверности сведений в ЕГРЮЛ');
    if (a.nedost === true && b.nedost === false) add('luchshe', 'Отметка о недостоверности сведений в ЕГРЮЛ снята');
    if (a.dir && b.dir && a.dir !== b.dir) add('info', 'Руководитель сменился: новая запись в ЕГРЮЛ с' + NB + dmy(b.dir));
    Object.keys(b.sig || {}).forEach(function (id) {
      var x = (a.sig || {})[id], y = b.sig[id];
      if (!x) { if (VES[y[0]] > 0) add('huzhe', y[1] + ': ' + STX[y[0]]); return; }
      if (x[0] !== y[0]) add(VES[y[0]] > VES[x[0]] ? 'huzhe' : VES[y[0]] < VES[x[0]] ? 'luchshe' : 'info', y[1] + ': ' + STX[x[0]] + ' → ' + STX[y[0]]);
    });
    if (b.vyr && (!a.vyr || b.vyr[0] > a.vyr[0])) add('info', 'Появилась отчётность за ' + b.vyr[0] + ': выручка ' + dengi(b.vyr[1]) +
      (b.prib && b.prib[0] === b.vyr[0] ? ', ' + (b.prib[1] < 0 ? 'убыток ' + dengi(-b.prib[1]) : 'прибыль ' + dengi(b.prib[1])) : ''));
    var poryadok = { huzhe: 0, info: 1, luchshe: 2 };
    return out.sort(function (p, q) { return poryadok[p.ton] - poryadok[q.ton]; }).slice(0, 7);
  }

  // Хранилище: { inn: [снимки по возрастанию t] }. Ошибки хранилища — молча, блок просто не показывается.
  function chitat(ls) {
    try { var o = JSON.parse(ls.getItem(KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return null; }
  }
  function zapisat(ls, o) { try { ls.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; } }

  // Сравнивает с последним снимком, сделанным раньше этой проверки больше чем на час, и сохраняет текущий.
  // Возвращает { pervyj:true } | { s: предыдущий снимок, izm: [...] } | null (нет хранилища или данных).
  function zapomnit(r, ls) {
    var b = snimok(r);
    if (!b || !ls) return null;
    var vse = chitat(ls);
    if (!vse) return null;
    var spisok = (Array.isArray(vse[b.inn]) ? vse[b.inn] : []).filter(function (x) { return x && x.inn === b.inn && isFinite(x.t); });
    var rannie = spisok.filter(function (x) { return x.t <= b.t - CHAS; });
    var a = rannie.length ? rannie[rannie.length - 1] : null;
    if (!spisok.some(function (x) { return Math.abs(x.t - b.t) < CHAS; })) {
      spisok.push(b);
      spisok.sort(function (p, q) { return p.t - q.t; });
      vse[b.inn] = spisok.slice(-MAKS_SNIMKOV);
      var inns = Object.keys(vse).sort(function (p, q) {
        var tp = (vse[p][vse[p].length - 1] || {}).t || 0, tq = (vse[q][vse[q].length - 1] || {}).t || 0;
        return tq - tp;
      });
      inns.slice(MAKS_INN).forEach(function (k) { delete vse[k]; });
      if (!zapisat(ls, vse)) return null;
    }
    if (!a) return { pervyj: true };
    return { s: a, izm: sravnit(a, b) };
  }

  function htmlIzmeneniya(rez) {
    if (!rez) return '';
    if (rez.pervyj) return '<p class="izm izm--0">Запомнили эту проверку на вашем устройстве. Проверите компанию снова — покажем, что изменилось.</p>';
    var kogda = dataRu(rez.s.t);
    if (!rez.izm.length) return '<div class="izm"><b>С вашей проверки ' + kogda + ' существенных изменений нет</b>' +
      '<span>Статус, руководитель, долги, оценка риска и признаки светофора — прежние.</span></div>';
    return '<div class="izm izm--da"><b>Что изменилось с вашей проверки ' + kogda + '</b><ul>' +
      rez.izm.map(function (x) { return '<li class="izm--' + x.ton + '">' + esc(x.t) + '</li>'; }).join('') +
      '</ul><span>Сравниваем с проверкой на этом устройстве; снимок хранится только в вашем браузере.</span></div>';
  }

  var CSS = '.din{display:grid;gap:10px;padding:16px 18px;border-radius:16px;background:var(--bg,#F5F5F2)}' +
    '.din__h{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}.din__h b{font-size:15px;font-weight:600}.din__h span{font-size:13px;color:var(--muted,#6B6B70)}' +
    '.din__l{list-style:none;margin:0;padding:0;display:grid}' +
    '.din__r{display:grid;grid-template-columns:minmax(0,1fr) 64px minmax(0,1.3fr);gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--line,#E6E6E1)}' +
    '.din__r:first-child{border-top:0;padding-top:4px}' +
    '.din__n{font-size:15px;display:grid}.din__n small,.din__v small{font-size:12px;color:var(--muted,#6B6B70)}' +
    '.din__v{display:grid;justify-items:end;text-align:right}.din__v b{font-size:15px;font-weight:600;white-space:nowrap}' +
    '.din__r--vverh .din__k{color:var(--ok,#16723F)}.din__r--vniz .din__k{color:#B3261E}' +
    '.din__sv rect{fill:#B9C7DD}.din__sv .din__last{fill:var(--accent,#0B63E5)}.din__sv .din__neg{fill:#E5484D}' +
    '.din__t{margin:0;font-size:14px;color:var(--ink2,#48484C)}.din__src{margin:0;font-size:12px;color:var(--muted,#6B6B70)}' +
    '.izm{display:grid;gap:4px;padding:14px 18px;border-radius:16px;border:1px solid var(--line,#E6E6E1);font-size:14px}' +
    '.izm b{font-size:15px;font-weight:600}.izm span{font-size:12px;color:var(--muted,#6B6B70)}' +
    '.izm ul{margin:4px 0;padding:0;list-style:none;display:grid;gap:4px}.izm li{padding-left:18px;position:relative}' +
    '.izm li::before{content:"";position:absolute;left:2px;top:.55em;width:8px;height:8px;border-radius:50%;background:var(--muted,#6B6B70)}' +
    '.izm li.izm--huzhe::before{background:#E5484D}.izm li.izm--luchshe::before{background:#2FA36B}' +
    '.izm--0{margin:0;padding:0;border:0;font-size:13px;color:var(--muted,#6B6B70)}' +
    '#doc .izm,#doc .din{margin-top:14px}' +
    '@media (max-width:520px){.din{padding:14px}.din__r{grid-template-columns:minmax(0,1fr) auto}.din__sv{display:none}}' +
    '@media print{.din,.izm{break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}.izm--0{display:none}}';

  function stil(doc) {
    if (!doc || doc.getElementById('din-css')) return;
    var s = doc.createElement('style'); s.id = 'din-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Браузер: html(r) — блок «что изменилось» (если есть с чем сравнить) + «Динамика». Снимок сохраняется один раз на проверку.
  function html(r, opt) {
    opt = opt || {};
    var ls = null;
    try { ls = opt.ls || (typeof window !== 'undefined' && window.localStorage) || null; } catch (e) { ls = null; }
    try { if (typeof document !== 'undefined') stil(document); } catch (e) {}
    var izm = '';
    try { izm = htmlIzmeneniya(zapomnit(r, ls)); } catch (e) { izm = ''; }
    var din = '';
    try { din = htmlDinamika(r); } catch (e) { din = ''; }
    return izm + din;
  }

  return { ryad: ryad, ryady: ryady, stroka: stroka, trendy: trendy, dengi: dengi, htmlDinamika: htmlDinamika,
    snimok: snimok, sravnit: sravnit, zapomnit: zapomnit, htmlIzmeneniya: htmlIzmeneniya, html: html, KEY: KEY, CSS: CSS };
});
