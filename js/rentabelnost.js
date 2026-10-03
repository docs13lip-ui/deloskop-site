/* Делоскоп — «Рентабельность активов против отрасли» на экране проверки по ИНН и в Щите
 * (решение владельца 02.10, эталон экрана — п. 4 «Налоговая нагрузка против отрасли + рентабельность»).
 * Данные — только из ответа /api/check (dossier.charts: profit, income_tax, balance — ГИР БО) и справочника
 * /data/fns-normy-2025.json (приложение 4 к приказу ФНС № ММ-3-06/333@, Информация ФНС от 05.05.2026 и от 07.05.2025).
 * Правила (по образцу калькулятора нагрузки, js/nagruzka.js):
 *   1) только организации (ИНН из 10 цифр), без банков и страховщиков (ОКВЭД 64.1, 65) — они сдают отчётность в Банк России;
 *   2) числитель — прибыль до налогообложения как чистая прибыль плюс налог на прибыль того же года (у ФНС — сальдированный
 *      финансовый результат); налога в ответе нет — чистая прибыль, так и пишем; знаменатель — активы на 31.12 года баланса
 *      (капитал + долгосрочные + краткосрочные обязательства, строки 1300 + 1400 + 1500) → слово «оценка» всегда;
 *   3) год прибыли = год баланса = год нормы ФНС (2025 или 2024), иначе блока нет; активы меньше 1 млн ₽ — блока нет;
 *   4) «ниже средней на 10 % и более» — критерий 11 приложения 2 к Концепции; цвет — только «внимание», без красного;
 *   5) строка нормы — самая подробная, в которую входит ОКВЭД (DlkNagruzka.najti); не нашли — «Всего по РФ» НЕ подставляем.
 * Чистые функции (raschet, html) — без DOM и сети, их проверяет tests/rentabelnost.test.js. Считается в браузере.
 * v2 (03.10): тот же блок в PDF-досье (report.html — после «Финансов в цифрах», «Как посчитали» раскрыто) и в Паспорте
 * (pasport/kontragent/ — в конце раздела 6, после выпуска, в отпечаток SHA-256 не входит); tests/rentabelnost_v2.test.js. */
(function (root, factory) {
  var N = (typeof module === 'object' && module.exports) ? require('./nagruzka.js') : root.DlkNagruzka;
  var api = factory(N);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Rentabelnost = api;
})(typeof self !== 'undefined' ? self : this, function (N) {
  'use strict';

  var NB = '\u00a0';
  var MIN_AKTIVY = 1e6;
  var URL_NORM = '/data/fns-normy-2025.json';
  var SPRAVOCHNIK = '/nalogi/nagruzka-po-otraslyam-2025/';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function chislo(v) { return v !== null && v !== '' && typeof v !== 'boolean' && isFinite(Number(v)) ? Number(v) : NaN; }
  function zaGod(arr, g) {
    var x = (Array.isArray(arr) ? arr : []).filter(function (q) { return q && parseInt(q.year, 10) === g; })[0];
    return x ? chislo(x.value) : NaN;
  }
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

  // Норма рентабельности активов за год: 2025 — rentabelnost.stroki[].aktivy, 2024 — rentabelnost_2024.znacheniya[kod][1].
  function norma(stroka, god, dannye) {
    if (!stroka || !dannye) return undefined;
    var r = dannye.rentabelnost || {};
    if (god === r.god) return stroka.aktivy;
    var r24 = dannye.rentabelnost_2024;
    if (god === 2024 && r24 && r24.znacheniya && Array.isArray(r24.znacheniya[stroka.kod])) return r24.znacheniya[stroka.kod][1];
    return undefined;
  }
  function istochnikNormy(god, dannye) {
    var r24 = dannye && dannye.rentabelnost_2024;
    return god === 2024 && r24 && r24.istochnik && r24.istochnik.data === '2025-05-07'
      ? 'Информация ФНС от 07.05.2025' : 'Информация ФНС от 05.05.2026';
  }

  /* Возвращает null (блока нет) или { st, god, n, norma, stroka, pribyl, nalog, aktivy, sNalogom }.
   * st: 'nizhe' | 'chut-nizhe' | 'ne-nizhe' | 'otr' | 'net-normy'. */
  function raschet(r, dannye) {
    if (!r || !r.company || !dannye) return null;
    var c = r.company, inn = String(c.inn || ''), okved = String(c.okved || '');
    if (!/^\d{10}$/.test(inn)) return null;
    if (/^64\.1(\.|\d|$)/.test(okved) || /^65(\.|$)/.test(okved)) return null;
    var ch = (r.dossier && r.dossier.charts) || {}, b = ch.balance;
    if (!b || typeof b !== 'object') return null;
    var god = parseInt(b.year, 10);
    if (!isFinite(god)) return null;
    var kap = chislo(b.equity), dl = chislo(b.long_liab), kr = chislo(b.short_liab);
    if (!isFinite(kap) || !isFinite(dl) || !isFinite(kr) || dl < 0 || kr < 0) return null;
    var aktivy = kap + dl + kr;
    if (!(aktivy >= MIN_AKTIVY)) return null;
    var pribyl = zaGod(ch.profit, god);
    if (!isFinite(pribyl)) return null;
    var nalog = zaGod(ch.income_tax, god), sNalogom = isFinite(nalog) && nalog >= 0;
    var rez = sNalogom ? pribyl + nalog : pribyl;
    var o = { st: '', god: god, n: rez / aktivy * 100, norma: null, stroka: null, pribyl: pribyl, nalog: sNalogom ? nalog : null,
      rez: rez, aktivy: aktivy, sNalogom: sNalogom, istochnik: istochnikNormy(god, dannye) };
    var rs = dannye.rentabelnost || {};
    if (god !== rs.god && god !== 2024) return null; // норм ФНС за этот год в справочнике нет — не сравниваем с чужим годом
    var s = okved && N ? N.najti(okved, rs.stroki) : null;
    var nr = norma(s, god, dannye);
    if (!s || (nr !== 'отр' && typeof nr !== 'number')) { o.st = 'net-normy'; return o; }
    o.stroka = s;
    if (nr === 'отр') { o.st = 'otr'; return o; }
    o.norma = nr;
    var n1 = Math.round(o.n * 10) / 10;
    if (nr > 0 && n1 <= nr * 0.9) o.st = 'nizhe';
    else if (n1 < nr) o.st = 'chut-nizhe';
    else o.st = 'ne-nizhe';
    return o;
  }

  var VYVOD = {
    'nizhe': 'Ниже средней по отрасли на 10% и более.',
    'chut-nizhe': 'Ниже средней по отрасли, но меньше чем на 10%.',
    'ne-nizhe': 'Не ниже средней по отрасли.',
    'otr': 'У отрасли в целом за этот год, по данным ФНС, убыток — сравнивать не с чем.',
    'net-normy': 'Средней рентабельности для этого вида деятельности ФНС не публикует — со строкой «Всего» не сравниваем.'
  };
  // фразы — с сайта: /nalogi/nagruzka-po-otraslyam-2025/ (FAQ, сверено [Право · Налоговый] 02.10)
  var PRIZNAK = 'Признак отбора — рентабельность по бухучёту ниже среднеотраслевой на 10% и более (критерий 11 приложения 2 к Концепции). ' +
    'Это средние значения, а не порог: ФНС сравнивает с ними компании как с одним из 12 признаков при отборе на выездную проверку.';

  // opts.otkryto — «Как посчитали» раскрыто (PDF-досье: на бумаге свёрнутое не видно);
  // opts.primechanie — строка под блоком (Паспорт: «в отпечаток SHA-256 не входит»).
  function html(o, opts) {
    if (!o) return '';
    opts = opts || {};
    var ton = o.st === 'nizhe' ? 'warn' : o.st === 'ne-nizhe' || o.st === 'chut-nizhe' ? 'ok' : 'ro';
    var podpis = o.stroka ? N.podpisStroki(o.stroka) : '';
    var sr = o.norma != null
      ? 'Средняя по отрасли — <b class="n">' + pct(o.norma) + '</b> · ' + esc(podpis) + ', данные ФНС за' + NB + o.god + NB + 'год'
      : (o.st === 'otr' ? esc(podpis) : '');
    var kak = (o.sNalogom
      ? 'Прибыль до налогообложения — чистая прибыль ' + dengi(o.pribyl) + ' плюс налог на прибыль ' + dengi(o.nalog) + ' = ' + dengi(o.rez)
      : 'Налога на прибыль в ответе нет — взяли чистую прибыль ' + dengi(o.pribyl)) +
      ' (ГИР БО, ' + o.god + '). Активы на' + NB + '31.12.' + o.god + ' — ' + dengi(o.aktivy) +
      ': капитал, долгосрочные и краткосрочные обязательства (баланс, строки 1300 + 1400 + 1500). ' +
      'У ФНС — сальдированный финансовый результат к стоимости активов по всем организациям отрасли, поэтому это оценка, а не расчёт инспекции. ' +
      'Норма — приложение 4 к приказу ФНС № ММ-3-06/333@, ' + o.istochnik + '.';
    return '<section class="rnt rnt--' + ton + '" aria-label="Рентабельность активов против отрасли">' +
      '<div class="rnt__h"><b>Рентабельность активов против отрасли</b><span>оценка · ГИР БО и ФНС · ' + o.god + '</span></div>' +
      '<p class="rnt__v"><b class="n">' + pct(o.n) + '</b><span>за' + NB + o.god + NB + 'год</span></p>' +
      (sr ? '<p class="rnt__s">' + sr + '</p>' : '') +
      '<p class="rnt__z">' + esc(VYVOD[o.st]) + '</p>' +
      (o.st === 'nizhe' ? '<p class="rnt__p">' + esc(PRIZNAK) + '</p>' : '') +
      '<details class="rnt__k"' + (opts.otkryto ? ' open' : '') + '><summary>Как посчитали</summary><p>' + esc(kak) +
      ' <a href="' + SPRAVOCHNIK + '">Нормы по всем отраслям</a></p></details>' +
      (opts.primechanie ? '<p class="rnt__m">' + esc(opts.primechanie) + '</p>' : '') +
      '</section>';
  }

  var CSS = '.rnt{display:grid;gap:6px;padding:16px 18px;border-radius:16px;border:1px solid var(--line,#E6E6E1);border-left-width:3px}' +
    '.rnt--warn{border-left-color:#E0A100}.rnt--ok{border-left-color:#2FA36B}.rnt--ro{border-left-color:var(--line,#E6E6E1)}' +
    '.rnt__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px}.rnt__h b{font-size:15px;font-weight:600}' +
    '.rnt__h span{font-size:13px;color:var(--muted,#6B6B70)}' +
    '.rnt p{margin:0}.rnt__v{display:flex;align-items:baseline;gap:8px}.rnt__v b{font-size:24px;font-weight:600;letter-spacing:-.01em}' +
    '.rnt__v span{font-size:13px;color:var(--muted,#6B6B70)}.rnt .n{font-variant-numeric:tabular-nums}' +
    '.rnt__s{font-size:14px;color:var(--ink2,#48484C)}.rnt__s b{font-weight:600}.rnt__z{font-size:15px}' +
    '.rnt__p{font-size:13px;color:var(--ink2,#48484C)}' +
    '.rnt__k summary{cursor:pointer;font-size:13px;color:var(--muted,#6B6B70)}.rnt__k p{margin-top:6px;font-size:13px;line-height:1.5;color:var(--ink2,#48484C)}' +
    '.rnt__k a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
    '.rnt__m{font-size:12px;color:var(--muted,#6B6B70)}' +
    '#doc .rnt{margin-top:14px}.doc .rnt{margin:18px 0 0}.rz .rnt{margin-top:12px}' +
    '@media (max-width:520px){.rnt{padding:14px}}' +
    '@media print{.rnt{break-inside:avoid}.rnt__k p{display:block}}';

  function stil(doc) {
    if (!doc || doc.getElementById('rnt-css')) return;
    var s = doc.createElement('style'); s.id = 'rnt-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Ставит блок после «Динамики» (или после «что изменилось» / фактов). Повторный вызов заменяет блок.
  // opts.posle — список селекторов «после чего ставить» (первый найденный); opts.vKonec — узел, в конец которого ставить.
  function vstavit(report, h, opts) {
    opts = opts || {};
    var doc = report.ownerDocument, t = doc.createElement('div');
    t.innerHTML = h;
    var nov = t.firstChild, star = report.querySelector('.rnt');
    if (!nov) return null;
    if (star) { star.parentNode.replaceChild(nov, star); return nov; }
    if (opts.vKonec) { opts.vKonec.appendChild(nov); return nov; }
    var pos = null, sp = opts.posle || ['.din', '.izm', '.rows'];
    for (var i = 0; i < sp.length && !pos; i++) pos = report.querySelector(sp[i]);
    if (pos && pos.parentNode) pos.parentNode.insertBefore(nov, pos.nextSibling);
    else return null;
    return nov;
  }

  var obeshchanie = null;
  function zagruzit(url) {
    if (!obeshchanie) {
      obeshchanie = (typeof fetch === 'function' ? fetch(url || URL_NORM, { cache: 'no-cache' }).then(function (x) { return x.ok ? x.json() : null; }) : Promise.resolve(null))
        .catch(function () { obeshchanie = null; return null; });
    }
    return obeshchanie;
  }

  // Браузер: считаем только когда в ответе есть баланс и прибыль организации; нормы грузим один раз.
  // opts — как у html() и vstavit(): PDF-досье (report.html) и Паспорт (pasport/kontragent/) зовут с местом и видом.
  function mount(report, r, opts) {
    var c = r && r.company, ch = r && r.dossier && r.dossier.charts;
    if (!report || !c || !/^\d{10}$/.test(String(c.inn || '')) || !ch || !ch.balance || !ch.profit) return Promise.resolve(null);
    var metka = {}; report.__rnt = metka; // новая проверка до загрузки норм — старый расчёт не вставляем
    return zagruzit().then(function (d) {
      if (report.__rnt !== metka) return null;
      var o = raschet(r, d);
      if (!o) return null;
      try { stil(report.ownerDocument); } catch (e) {}
      vstavit(report, html(o, opts), opts);
      return o;
    });
  }

  var PRIMECHANIE_PASPORT = 'Рассчитано Делоскопом по бухотчётности этого раздела и нормам ФНС; в отпечаток SHA-256 не входит.';

  return { raschet: raschet, html: html, mount: mount, vstavit: vstavit, zagruzit: zagruzit, norma: norma, pct: pct, CSS: CSS, VYVOD: VYVOD, PRIZNAK: PRIZNAK,
    PRIMECHANIE_PASPORT: PRIMECHANIE_PASPORT };
});
