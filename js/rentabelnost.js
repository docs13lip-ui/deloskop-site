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

  // Оценка без норм: только организации (не банки и не страховщики), баланс и прибыль того же года, активы ≥ 1 млн ₽.
  // → null | { god, n, pribyl, nalog, rez, aktivy, sNalogom }. Её же хранит снимок «Что изменилось» (js/dinamika.js).
  function ocenka(r) {
    if (!r || !r.company) return null;
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
    return { god: god, n: rez / aktivy * 100, pribyl: pribyl, nalog: sNalogom ? nalog : null, rez: rez, aktivy: aktivy, sNalogom: sNalogom };
  }

  // Сравнение оценки n (%) за год god с нормой ФНС для ОКВЭД. → { st, stroka, norma } | null (норм за этот год нет).
  // st: 'nizhe' | 'chut-nizhe' | 'ne-nizhe' | 'otr' | 'net-normy'.
  function sravnenie(n, god, okved, dannye) {
    var rs = (dannye && dannye.rentabelnost) || {};
    if (god !== rs.god && god !== 2024) return null; // норм ФНС за этот год в справочнике нет — не сравниваем с чужим годом
    var s = okved && N ? N.najti(String(okved), rs.stroki) : null;
    var nr = norma(s, god, dannye);
    if (!s || (nr !== 'отр' && typeof nr !== 'number')) return { st: 'net-normy', stroka: null, norma: null };
    if (nr === 'отр') return { st: 'otr', stroka: s, norma: null };
    var n1 = Math.round(n * 10) / 10;
    return { st: nr > 0 && n1 <= nr * 0.9 ? 'nizhe' : n1 < nr ? 'chut-nizhe' : 'ne-nizhe', stroka: s, norma: nr };
  }

  /* Возвращает null (блока нет) или { st, god, n, norma, stroka, pribyl, nalog, aktivy, sNalogom }.
   * st: 'nizhe' | 'chut-nizhe' | 'ne-nizhe' | 'otr' | 'net-normy'. */
  function raschet(r, dannye) {
    if (!dannye) return null;
    var o = ocenka(r);
    if (!o) return null;
    var sr = sravnenie(o.n, o.god, String(r.company.okved || ''), dannye);
    if (!sr) return null;
    o.st = sr.st; o.stroka = sr.stroka; o.norma = sr.norma; o.istochnik = istochnikNormy(o.god, dannye);
    return o;
  }

  /* «Что изменилось с вашей проверки» (rentabelnost-izm-v1): a, b — снимки js/dinamika.js с полем rn = [год, оценка %].
   * Только новая отчётность (год b больше года a) и только переход через «ниже средней на 10% и более» —
   * обе оценки сравниваем с нормой ФНС своего года для ТЕКУЩЕГО ОКВЭД. → { ton, t } | null. */
  function izmenenie(a, b, okved, dannye) {
    if (!a || !b || !Array.isArray(a.rn) || !Array.isArray(b.rn) || !(b.rn[0] > a.rn[0])) return null;
    var x = sravnenie(a.rn[1], a.rn[0], okved, dannye), y = sravnenie(b.rn[1], b.rn[0], okved, dannye);
    if (!x || !y || typeof x.norma !== 'number' || typeof y.norma !== 'number') return null;
    var hvost = ': за' + NB + b.rn[0] + ' — ' + pct(b.rn[1]) + ' при средней ' + pct(y.norma) + ' (оценка; ГИР' + NB + 'БО и ФНС)';
    if (x.st !== 'nizhe' && y.st === 'nizhe') return { ton: 'huzhe', t: 'Рентабельность активов стала ниже средней по отрасли на 10% и более' + hvost };
    if (x.st === 'nizhe' && y.st !== 'nizhe') return { ton: 'luchshe', t: 'Рентабельность активов больше не ниже средней по отрасли на 10% и более' + hvost };
    return null;
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
      // «Что изменилось»: строка о переходе через норму — в блок Динамики, если он на странице (js/dinamika.js)
      try {
        var Dn = typeof self !== 'undefined' ? self.Dinamika : null, okv = String(c.okved || '');
        if (Dn && Dn.dobavit) Dn.dobavit(report, r, function (a, b) { return izmenenie(a, b, okv, d); });
      } catch (e) {}
      return o;
    });
  }

  var PRIMECHANIE_PASPORT = 'Рассчитано Делоскопом по бухотчётности этого раздела и нормам ФНС; в отпечаток SHA-256 не входит.';

  return { raschet: raschet, ocenka: ocenka, sravnenie: sravnenie, izmenenie: izmenenie, html: html, mount: mount, vstavit: vstavit, zagruzit: zagruzit, norma: norma, pct: pct, CSS: CSS, VYVOD: VYVOD, PRIZNAK: PRIZNAK,
    PRIMECHANIE_PASPORT: PRIMECHANIE_PASPORT };
});
