/* Делоскоп — «Налоги и взносы против отрасли» на экране проверки по ИНН
 * (решение команды 02.10, эталон экрана — п. 4 «Налоговая нагрузка против отрасли»; nagruzka-proverka-v1, Ночные-3 11.10).
 *
 * Почему «налоги и взносы», а не одна налоговая нагрузка: в ответе /api/check сумма уплаченного — набор ФНС «уплаченные
 * налоги» (paytax) ВМЕСТЕ со страховыми взносами, а норма приложения 3 к приказу ФНС № ММ-3-06/333@ — без взносов.
 * Взносы ФНС публикует той же таблицей отдельной колонкой («фискальная нагрузка по страховым взносам», поле `sv`
 * в data/fns-normy-2025.json) — с тем же знаменателем (оборот организаций по Росстату). Поэтому сравниваем сумму с суммой:
 *   компания: (налоги + взносы) / доходы  ↔  отрасль: налоговая нагрузка + нагрузка по взносам, тот же год.
 * Как только API отдаст налоги без взносов (`charts.taxes_paid_bez_vznosov`), блок сравнит их с одной налоговой нормой —
 * как калькулятор /nalogi/nagruzka/.
 *
 * Правила (документ команды, § 2 — четыре ловушки; js/nagruzka.js):
 *   1) в наборе ФНС нет НДФЛ за работников, в норме он есть → наша оценка ниже настоящей: цвет только «внимание», красного нет;
 *   2) знаменатель — доходы по набору ФНС «доходы и расходы» (как в калькуляторе ФНС), нет их — выручка ГИР БО → «оценка» всегда;
 *   3) УСН, ЕСХН, АУСН, патент — с общей нормой не сравниваем (так и пишем); режим не указан — сравниваем с оговоркой;
 *   4) только организации (ИНН из 10 цифр), без банков и страховщиков; доходы < 1 млн ₽ или год налогов ≠ году доходов —
 *      блока нет; норма за год — только 2025 и 2024, строка — самая подробная, в которую входит ОКВЭД; «Всего по РФ» не подставляем.
 * Вывод — только «ниже / не ниже средней»: без «вас проверят», «безопасный уровень», обещаний исхода (тест tests/nagruzka_proverka.test.js).
 * Чистые функции (dannye, raschet, html) — без DOM и сети. Считается в браузере, ничего не отправляем. */
(function (root, factory) {
  var N = (typeof module === 'object' && module.exports) ? require('./nagruzka.js') : root.DlkNagruzka;
  var api = factory(N);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NagruzkaProverka = api;
})(typeof self !== 'undefined' ? self : this, function (N) {
  'use strict';

  var NB = ' ';
  var MIN_DOHOD = 1e6;
  var URL_NORM = '/data/fns-normy-2025.json';
  var SPRAVOCHNIK = '/nalogi/nagruzka-po-otraslyam-2025/';
  var KALKULYATOR = '/nalogi/nagruzka/';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function chislo(v) { return v !== null && v !== '' && typeof v !== 'boolean' && isFinite(Number(v)) ? Number(v) : NaN; }
  function pct(x) {
    var r = Math.round(x * 10) / 10, s = String(Math.abs(r)).replace('.', ',');
    if (s.indexOf(',') < 0) s += ',0';
    return (r < 0 ? '−' : '') + s + NB + '%';
  }
  function dengi(v) {
    var a = Math.abs(v), s = v < 0 ? '−' : '';
    function c(x) { return x.toFixed(1).replace('.', ','); }
    if (a >= 1e12) return s + c(a / 1e12) + NB + 'трлн' + NB + '₽';
    if (a >= 1e9) return s + c(a / 1e9) + NB + 'млрд' + NB + '₽';
    if (a >= 1e6) return s + c(a / 1e6) + NB + 'млн' + NB + '₽';
    if (a >= 1e3) return s + Math.round(a / 1e3) + NB + 'тыс.' + NB + '₽';
    return s + Math.round(a) + NB + '₽';
  }
  function zaGod(arr, g) {
    var x = (Array.isArray(arr) ? arr : []).filter(function (q) { return q && parseInt(q.year, 10) === g; })[0];
    return x ? chislo(x.value) : NaN;
  }

  // Год набора из dossier.data_dates: строка «…; уплаченные налоги — на 31.12.2025; …» или объект {ключ: «31.12.2025»}.
  // Годен только конец года (31.12) — наборы paytax и revexp годовые.
  function godNabora(dd, re) {
    var parts = [];
    if (typeof dd === 'string') parts = dd.split(/;\s*/);
    else if (dd && typeof dd === 'object') Object.keys(dd).forEach(function (k) { parts.push(k + ' — ' + dd[k]); });
    for (var i = 0; i < parts.length; i++) {
      if (!re.test(parts[i])) continue;
      var m = /31\.12\.(\d{4})|(\d{4})-12-31/.exec(parts[i]);
      if (m) return +(m[1] || m[2]);
    }
    return NaN;
  }
  function kpi(r, re) {
    var a = (r && r.dossier && r.dossier.kpi) || [];
    for (var i = 0; i < a.length; i++) if (a[i] && re.test(String(a[i].label || ''))) return a[i];
    return null;
  }

  // Налоговый режим проверяемой компании: 'osn' | 'usn' | 'spec' (ЕСХН, АУСН, патент, СРП) | '' (в ответе не указан).
  // Строка «Налоговый режим» — в светофоре (signals) или в разделе досье (как js/bez-nds.js).
  function rezhim(r) {
    var v = '';
    ((r && r.signals) || []).forEach(function (s) { if (!v && s && s.title === 'Налоговый режим') v = String(s.detail || ''); });
    ((r && r.dossier && r.dossier.sections) || []).forEach(function (sec) {
      ((sec && sec.rows) || []).forEach(function (row) { if (!v && row && row[0] === 'Налоговый режим') v = String(row[1] || ''); });
    });
    if (!v) return '';
    if (/АУСН|ЕСХН|СРП|Патент|ПСН/i.test(v)) return 'spec';
    if (/УСН|упрощ/i.test(v)) return 'usn';
    if (/ОСН|Общ/i.test(v)) return 'osn';
    return '';
  }

  /* Что есть в ответе → null | { god, nalogi, sVznosami, dohody, vid: 'dohody' | 'vyruchka' }.
   * Налоги — ряд charts.taxes_paid_bez_vznosov (будущий, без взносов), ряд charts.taxes_paid или KPI «Налоги и взносы за год»
   * с годом набора; доходы — KPI «Доходы за год» (набор ФНС revexp) того же года, иначе выручка ГИР БО того же года. */
  function dannye(r) {
    if (!r || !r.company) return null;
    var c = r.company, okved = String(c.okved || '');
    if (!/^\d{10}$/.test(String(c.inn || ''))) return null;
    if (/^64\.1(\.|\d|$)/.test(okved) || /^65(\.|$)/.test(okved)) return null;
    var D = r.dossier || {}, ch = D.charts || {}, dd = D.data_dates;
    var kandidaty = [];
    function ryad(arr, sV) {
      (Array.isArray(arr) ? arr : []).forEach(function (q) {
        var g = parseInt(q && q.year, 10), v = chislo(q && q.value);
        if (isFinite(g) && isFinite(v) && v >= 0) kandidaty.push({ god: g, nalogi: v, sVznosami: sV });
      });
    }
    ryad(ch.taxes_paid_bez_vznosov, false);
    if (!kandidaty.length) ryad(ch.taxes_paid, true);
    if (!kandidaty.length) {
      var k = kpi(r, /^Налоги и взносы|^Уплачено налогов/i), gN = godNabora(dd, /уплаченные налоги/i);
      if (k && isFinite(chislo(k.value)) && chislo(k.value) >= 0 && isFinite(gN)) kandidaty.push({ god: gN, nalogi: chislo(k.value), sVznosami: true });
    }
    if (!kandidaty.length) return null;
    var kD = kpi(r, /^Доходы за год/i), gD = godNabora(dd, /доходы и расходы/i);
    kandidaty.sort(function (a, b) { return b.god - a.god; });
    for (var i = 0; i < kandidaty.length; i++) {
      var x = kandidaty[i], dohody = NaN, vid = '';
      if (kD && gD === x.god && isFinite(chislo(kD.value))) { dohody = chislo(kD.value); vid = 'dohody'; }
      else { dohody = zaGod(ch.revenue, x.god); vid = 'vyruchka'; }
      if (isFinite(dohody) && dohody >= MIN_DOHOD) { x.dohody = dohody; x.vid = vid; return x; }
    }
    return null;
  }

  /* → null (блока нет) | { st, god, n, norma, normaN, normaSv, stroka, nalogi, dohody, vid, sVznosami, rezhim }.
   * st: 'nizhe-vdvoe' (меньше половины средней) | 'nizhe' | 'ne-nizhe' | 'usn' | 'spec' | 'net-normy'. */
  // rentabelnost-status-v1 [команда] 11.10: компания в банкротстве или ликвидации (и ликвидированная) — блока нет, как у рентабельности
  function neDejstvuet(c) { return !!c && ['BANKRUPT', 'LIQUIDATING', 'LIQUIDATED'].indexOf(String(c.status || '').toUpperCase()) >= 0; }
  function raschet(r, normy) {
    if (!normy || !N) return null;
    if (neDejstvuet(r && r.company)) return null;
    var x = dannye(r);
    if (!x) return null;
    var g = String(x.god);
    if (x.god !== 2025 && x.god !== 2024) return null; // норм за другой год в справочнике нет — с чужим годом не сравниваем
    var o = { god: x.god, nalogi: x.nalogi, dohody: x.dohody, vid: x.vid, sVznosami: x.sVznosami, rezhim: rezhim(r) };
    o.n = x.nalogi / x.dohody * 100;
    if (o.rezhim === 'usn' || o.rezhim === 'spec') { o.st = o.rezhim; return o; }
    var s = N.najti(String(r.company.okved || ''), normy.nagruzka);
    var nn = s && s.nagruzka ? s.nagruzka[g] : undefined, nsv = s && s.sv ? s.sv[g] : undefined;
    if (!s || typeof nn !== 'number' || (x.sVznosami && typeof nsv !== 'number')) { o.st = 'net-normy'; return o; }
    o.stroka = s; o.normaN = nn; o.normaSv = x.sVznosami ? nsv : null;
    o.norma = Math.round((nn + (x.sVznosami ? nsv : 0)) * 10) / 10;
    var n1 = Math.round(o.n * 10) / 10;
    o.st = n1 >= o.norma ? 'ne-nizhe' : n1 < o.norma * 0.5 ? 'nizhe-vdvoe' : 'nizhe';
    return o;
  }

  // Фразы — из § 3.1 документа Налогового юриста (27.09) и FAQ /nalogi/nagruzka-po-otraslyam-2025/; новое — ✎ [команда].
  var VYVOD = {
    'ne-nizhe': 'Не ниже средней по отрасли.',
    'nizhe': 'Ниже средней по отрасли.',
    'nizhe-vdvoe': 'Ниже средней по отрасли более чем вдвое.',
    'usn': 'Компания на упрощённой системе. Общая отраслевая норма ФНС включает НДС и налог на прибыль, поэтому сравнивать с ней упрощенца некорректно — мы этого не делаем.',
    'spec': 'Компания на специальном налоговом режиме. Общая отраслевая норма ФНС рассчитана по всем налогам, поэтому сравнивать с ней некорректно — мы этого не делаем.',
    'net-normy': 'Средней нагрузки для этого вида деятельности ФНС не публикует — со строкой «Всего по РФ» не сравниваем.'
  };
  var NDFL = 'В открытых данных нет НДФЛ за работников, а в норме ФНС он есть, поэтому настоящая нагрузка, скорее всего, выше.';
  var PRIZNAK = 'Само по себе это не нарушение: ФНС сравнивает нагрузку с отраслью как один из 12 признаков при отборе на выездную проверку ' +
    '(приказ ФНС № ММ-3-06/333@). Возможны убытки, крупные вычеты или особенности бизнеса.';
  var REZHIM_NE_UKAZAN = 'Налоговый режим в ответе не указан: если компания на упрощёнке, сравнение с общей нормой некорректно.';

  // opts.otkryto — «Как посчитали» раскрыто (на бумаге свёрнутое не видно)
  function html(o, opts) {
    if (!o) return '';
    opts = opts || {};
    var sravn = o.st === 'ne-nizhe' || o.st === 'nizhe' || o.st === 'nizhe-vdvoe';
    var ton = o.st === 'nizhe' || o.st === 'nizhe-vdvoe' ? 'warn' : o.st === 'ne-nizhe' ? 'ok' : 'ro';
    var chto = o.sVznosami ? 'Налоги и взносы' : 'Налоговая нагрузка';
    var zag = chto + ' против отрасли';
    var podpis = o.stroka ? N.podpisStroki(o.stroka) : '';
    var sr = '';
    if (sravn) {
      sr = 'Средняя по отрасли — <b class="n">' + pct(o.norma) + '</b>' +
        (o.sVznosami ? ' (налоги ' + pct(o.normaN) + ' + взносы ' + pct(o.normaSv) + ')' : '') +
        ' · ' + esc(podpis) + ', данные ФНС за' + NB + o.god + NB + 'год';
    }
    var dop = [];
    if (sravn && o.st !== 'ne-nizhe') dop.push(NDFL, PRIZNAK);
    if (sravn && !o.rezhim) dop.push(REZHIM_NE_UKAZAN);
    var kak = (o.sVznosami ? 'Уплачено налогов и страховых взносов' : 'Уплачено налогов') + ' за' + NB + o.god + ' — ' + dengi(o.nalogi) +
      ' (ФНС, открытые данные: уплаченные налоги; без налогов при ввозе и без НДФЛ, который компания удерживает за работников). ' +
      (o.vid === 'dohody' ? 'Доходы за' + NB + o.god + ' — ' + dengi(o.dohody) + ' (ФНС, открытые данные: доходы и расходы по бухотчётности). '
        : 'Выручка за' + NB + o.god + ' — ' + dengi(o.dohody) + ' (ГИР БО, строка 2110; в калькуляторе ФНС — все доходы, поэтому это оценка). ') +
      'Отношение — ' + pct(o.n) + '. ' +
      (o.sVznosami && sravn
        ? 'Норма ФНС (приложение 3 к приказу № ММ-3-06/333@, Информация ФНС от ' + (o.god === 2025 ? '05.05.2026' : '07.05.2025') + ') дана без взносов, ' +
          'а нагрузку по взносам ФНС публикует той же таблицей отдельной колонкой — поэтому сравниваем сумму с суммой. '
        : '') +
      'У ФНС знаменатель — оборот организаций по данным Росстата, поэтому это оценка, а не расчёт инспекции.';
    return '<section class="ngo ngo--' + ton + '" aria-label="' + esc(zag) + '">' +
      '<div class="ngo__h"><b>' + esc(zag) + '</b><span>оценка · ФНС · ' + o.god + '</span></div>' +
      '<p class="ngo__v"><b class="n">' + pct(o.n) + '</b><span>от' + NB + (o.vid === 'dohody' ? 'доходов' : 'выручки') + ' за' + NB + o.god + NB + 'год</span></p>' +
      (sr ? '<p class="ngo__s">' + sr + '</p>' : '') +
      '<p class="ngo__z">' + esc(VYVOD[o.st]) + '</p>' +
      (dop.length ? '<p class="ngo__p">' + esc(dop.join(' ')) + '</p>' : '') +
      '<details class="ngo__k"' + (opts.otkryto ? ' open' : '') + '><summary>Как посчитали</summary><p>' + esc(kak) +
      ' <a href="' + SPRAVOCHNIK + '">Нормы по всем отраслям</a> · <a href="' + KALKULYATOR + '">Посчитать свою нагрузку</a></p></details>' +
      '</section>';
  }

  var CSS = '.ngo{display:grid;gap:6px;padding:16px 18px;border-radius:16px;border:1px solid var(--line,#E6E6E1);border-left-width:3px}' +
    '.ngo--warn{border-left-color:#E0A100}.ngo--ok{border-left-color:#2FA36B}.ngo--ro{border-left-color:var(--line,#E6E6E1)}' +
    '.ngo__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px}.ngo__h b{font-size:15px;font-weight:600}' +
    '.ngo__h span{font-size:13px;color:var(--muted,#6B6B70)}' +
    '.ngo p{margin:0}.ngo__v{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px}.ngo__v b{font-size:24px;font-weight:600;letter-spacing:-.01em}' +
    '.ngo__v span{font-size:13px;color:var(--muted,#6B6B70)}.ngo .n{font-variant-numeric:tabular-nums}' +
    '.ngo__s{font-size:14px;color:var(--ink2,#48484C)}.ngo__s b{font-weight:600}.ngo__z{font-size:15px}' +
    '.ngo__p{font-size:13px;line-height:1.5;color:var(--ink2,#48484C)}' +
    '.ngo__k summary{cursor:pointer;font-size:13px;color:var(--muted,#6B6B70)}.ngo__k p{margin-top:6px;font-size:13px;line-height:1.5;color:var(--ink2,#48484C)}' +
    '.ngo__k a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
    '.ngo+section,.ngo+div{margin-top:12px}' +
    '#doc .ngo{margin-top:14px}.doc .ngo{margin:18px 0 0}' +
    '@media (max-width:520px){.ngo{padding:14px}}' +
    '@media print{.ngo{break-inside:avoid}}';

  function stil(doc) {
    if (!doc || doc.getElementById('ngo-css')) return;
    var s = doc.createElement('style'); s.id = 'ngo-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Место: перед «Рентабельностью» (.rnt), если она уже стоит, иначе после «Динамики» / «что изменилось» / фактов.
  // js/rentabelnost.js ставит себя после .ngo — порядок «нагрузка → рентабельность» при любом порядке загрузки.
  function vstavit(report, h) {
    var doc = report.ownerDocument, t = doc.createElement('div');
    t.innerHTML = h;
    var nov = t.firstChild, star = report.querySelector('.ngo');
    if (!nov) return null;
    if (star) { star.parentNode.replaceChild(nov, star); return nov; }
    var rnt = report.querySelector('.rnt');
    if (rnt && rnt.parentNode) { rnt.parentNode.insertBefore(nov, rnt); return nov; }
    var pos = null, sp = ['.din', '.izm', '.rows'];
    for (var i = 0; i < sp.length && !pos; i++) pos = report.querySelector(sp[i]);
    if (!pos || !pos.parentNode) return null;
    pos.parentNode.insertBefore(nov, pos.nextSibling);
    return nov;
  }

  var obeshchanie = null;
  function zagruzit() {
    if (!obeshchanie) {
      obeshchanie = (typeof fetch === 'function' ? fetch(URL_NORM, { cache: 'no-cache' }).then(function (x) { return x.ok ? x.json() : null; }) : Promise.resolve(null))
        .catch(function () { obeshchanie = null; return null; });
    }
    return obeshchanie;
  }

  function mount(report, r, opts) {
    var stary = report && report.querySelector && report.querySelector('.ngo');
    if (stary && stary.parentNode) stary.parentNode.removeChild(stary); // новая проверка — старый блок не оставляем
    if (!report || !dannye(r)) return Promise.resolve(null);
    var metka = {}; report.__ngo = metka;
    return zagruzit().then(function (d) {
      if (report.__ngo !== metka) return null;
      var o = raschet(r, d);
      if (!o) return null;
      try { stil(report.ownerDocument); } catch (e) {}
      vstavit(report, html(o, opts));
      return o;
    });
  }

  return { dannye: dannye, rezhim: rezhim, godNabora: godNabora, raschet: raschet, html: html, mount: mount, vstavit: vstavit,
    VYVOD: VYVOD, NDFL: NDFL, PRIZNAK: PRIZNAK, CSS: CSS };
});
