/* Делоскоп — «Динамика за 3–5 лет» и «Что изменилось с вашей прошлой проверки» на экране проверки по ИНН
 * (решение владельца 02.10, эталон экрана — п. 5 «Динамика и тренды»).
 * Данные — только из ответа /api/check: dossier.charts (ГИР БО ФНС, годовая бухотчётность), signals, company, zsk.
 * Снимки для «что изменилось» хранятся ТОЛЬКО в браузере (localStorage, ключ dlk_snimki): без ФИО, адресов и сумм,
 * кроме выручки, прибыли, собственного капитала, кредитов и займов, текущей ликвидности и оценки рентабельности активов из открытой отчётности (ГИР БО);
 * у организаций — ещё код и название основного вида деятельности из ЕГРЮЛ. Нет доступа к хранилищу — блока «что изменилось» нет.
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
    { k: 'income_tax', nazv: 'Налог на прибыль', dengi: true },
    // ряды наборов ФНС по годам (ответ [Продукт · Данные] 02.10: charts.staff — sshr, charts.taxes_paid — paytax, со взносами);
    // пока API их не отдаёт или лет меньше трёх — строки нет
    { k: 'taxes_paid', nazv: 'Уплачено налогов и взносов', dengi: true, fns: true },
    { k: 'staff', nazv: 'Численность', chel: true, fns: true }
  ];
  var LVL = { low: 'низкий', medium: 'средний', high: 'высокий' };
  var STX = { ok: 'норма', info: 'справочно', warn: 'внимание', bad: 'риск' };
  var VES = { ok: 0, info: 0, warn: 1, bad: 2 };
  var STATUS = { ACTIVE: 'действующая', LIQUIDATING: 'ликвидируется или исключается из ЕГРЮЛ', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' };
  // Код состояния ЕГРЮЛ (company.state_code, API status-kody-api-v1; DaData кладёт эти коды в LIQUIDATING):
  // 105–107, 110 — ФНС готовит исключение из ЕГРЮЛ; 108 — по сведениям Банка России (заголовки [Право] 03.10 08:11 и 12:07).
  // Нет кода в ответе (API до выкладки, старые снимки) — сравниваем по одному статусу, как раньше.
  var ISKL = { '105': 1, '106': 1, '107': 1, '108': 1, '110': 1 };
  function kodSost(v) { var k = String(v == null ? '' : v).trim(); return /^\d{3}$/.test(k) ? k : ''; }
  function iskl(k) { return !!(k && ISKL[k]); }
  function nazvIskl(k) { return 'ФНС готовит исключение из ЕГРЮЛ' + (k === '108' ? ' по' + NB + 'сведениям Банка России' : ''); }
  // 407, 414, 415, 418, 420 — компания уже исключена из ЕГРЮЛ (заголовок [Право] 03.10 14:30, разд. 1 п. 3)
  var ISKLYUCHENA = { '407': 1, '414': 1, '415': 1, '418': 1, '420': 1 };
  function isklyuchena(k) { return !!(k && ISKLYUCHENA[k]); }
  // Срок возражения кредитора: 3 месяца со дня публикации в «Вестнике», по 108 — 6 месяцев (п. 4 и 7 ст. 21.1 129-ФЗ).
  // Публикации в снимке нет — считаем от даты записи и пишем «ориентировочно» ([Право] 03.10 14:30, разд. 1 п. 1).
  function plusMes(iso, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return '';
    var g = +m[1], me = +m[2] - 1 + n, d = +m[3];
    g += Math.floor(me / 12); me = me % 12;
    var posl = new Date(Date.UTC(g, me + 1, 0)).getUTCDate();
    return g + '-' + ('0' + (me + 1)).slice(-2) + '-' + ('0' + Math.min(d, posl)).slice(-2);
  }
  // Подстрочник к строке «ФНС готовит исключение» — текст «Истории» [Право] 14:30 (разд. 1 п. 4) + дата и «Вестник» (п. 1)
  function podIskl(k, kodd) {
    var mes = k === '108' ? 6 : 3, do_ = kodd ? dmy(plusMes(kodd, mes)) : '';
    return 'Новых авансов не платите. Если компания вам должна — возражение в налоговую нужно подать в течение ' + mes + NB + 'месяцев ' +
      'со дня публикации в «Вестнике государственной регистрации».' + (do_ ? ' Ориентировочно до' + NB + do_ + '.' : '') +
      ' Дату публикации проверьте на vestnik-gosreg.ru.';
  }
  // подпись статуса для строки «Статус в ЕГРЮЛ: … → …»: с кодом — точнее, чем «ликвидируется или исключается»
  function nazvSt(st, kod) {
    if (isklyuchena(kod)) return 'исключена из' + NB + 'ЕГРЮЛ';
    if (st === 'LIQUIDATING' && kod) return iskl(kod) ? 'готовится исключение из' + NB + 'ЕГРЮЛ' : 'ликвидируется';
    return STATUS[st];
  }

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
  function chel(v) {
    if (v == null || !isFinite(v)) return '—';
    var n = Math.round(v), t = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    return (n < 0 ? '−' : '') + t + NB + 'чел.';
  }
  function procent(p) {
    var r = Math.round(p);
    return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r) + NB + '%';
  }
  // Рост в 3 раза и больше — «в 28 раз», а не «+2680 %»: так читается с первого взгляда.
  // Ниже трёх раз и при снижении — проценты, как раньше. was и stalo — положительные числа.
  function izmenenie(was, stalo) {
    var k = stalo / was;
    if (k < 3) return procent((stalo - was) / was * 100);
    if (k < 10) {
      var t = chislo(Math.round(k * 10) / 10, 1).replace(/,0$/, '');
      return 'в' + NB + t + NB + (/,/.test(t) ? 'раза' : skl(+t, 'раз', 'раза', 'раз'));
    }
    var n = Math.round(k);
    return 'в' + NB + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + skl(n, 'раз', 'раза', 'раз');
  }
  function skl(n, a, b, c) {
    var m = n % 100, d = n % 10;
    return m > 10 && m < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c;
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
      return { k: p.k, nazv: p.nazv, znak: !!p.znak, chel: !!p.chel, fns: !!p.fns, ryad: ryad(ch[p.k]) };
    }).filter(function (p) { return p.ryad.length >= 3; });
  }

  // Одна строка: значение последнего года, изменение к прошлому году и за период — простыми словами.
  function stroka(p) {
    var a = p.ryad, n = a.length, posl = a[n - 1], pred = a[n - 2], perv = a[0];
    var o = { k: p.k, nazv: p.nazv, god: posl.year, znach: posl.value, ryad: a, kGodu: '', zaPeriod: '', ton: 'ro', fns: !!p.fns };
    o.fmt = p.chel ? chel : dengi;
    if (p.znak && posl.value < 0) o.znachTekst = 'убыток ' + dengi(-posl.value);
    else o.znachTekst = o.fmt(posl.value);
    if (p.znak && (pred.value < 0) !== (posl.value < 0)) {
      o.kGodu = posl.value < 0 ? 'в ' + pred.year + NB + '— прибыль' : 'в ' + pred.year + NB + '— убыток';
      o.ton = posl.value < 0 ? 'vniz' : 'vverh';
      o.smena = true;
    } else if (pred.value > 0 && posl.value >= 0) {
      var d = (posl.value - pred.value) / pred.value * 100;
      o.kGodu = izmenenie(pred.value, posl.value) + ' к' + NB + pred.year;
      o.ton = Math.round(d) > 0 ? 'vverh' : Math.round(d) < 0 ? 'vniz' : 'ro';
      if (p.znak && posl.value === 0) o.ton = 'ro';
    }
    if (perv.value > 0 && posl.value > 0) o.zaPeriod = izmenenie(perv.value, posl.value) + ' с' + NB + perv.year;
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

  // Спарклайн (макет [Арт-директора] 02.10, токены v1.1): линия 96 × 20, 1,5 px, без осей и точек.
  // Только визуальная подсказка — числа стоят рядом в таблице. Ряд с убытком — нулевая черта пунктиром.
  function sparklajn(a) {
    var W = 96, H = 20, P = 2, mx = -Infinity, mn = Infinity;
    a.forEach(function (x) { mx = Math.max(mx, x.value); mn = Math.min(mn, x.value); });
    var span = (mx - mn) || 1, n = a.length;
    function y(v) { return mx === mn ? H / 2 : P + (mx - v) / span * (H - 2 * P); }
    var pts = a.map(function (x, i) { return (n > 1 ? i * W / (n - 1) : W / 2).toFixed(1) + ',' + y(x.value).toFixed(1); }).join(' ');
    var nol = mn < 0 && mx > 0 ? '<line x1="0" x2="' + W + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" class="din__0"/>' : '';
    return '<svg class="din__sv" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true" focusable="false">' + nol +
      '<polyline points="' + pts + '"/></svg>';
  }

  // Значение строки за год (для колонок таблицы); убыток — словом, чтобы не путать минус с тире.
  function zaGod(s, g) {
    var x = s.ryad.filter(function (q) { return q.year === g; })[0];
    if (!x) return '<span class="din__na">нет данных</span>';
    if (s.k === 'profit' && x.value < 0) return 'убыток ' + dengi(-x.value);
    return s.fmt(x.value);
  }

  var STRELKA = { vverh: '▲', vniz: '▼', ro: '' };

  // Таблица «Показатель · спарклайн · прошлый год · последний год · Изм.» (блок E макета).
  function htmlDinamika(r, opt) {
    var rs = ryady(r);
    if (!rs.length) return '';
    var st = rs.map(stroka), g0 = st[0].ryad[0].year, g1 = st[0].god;
    st.forEach(function (s) { g0 = Math.min(g0, s.ryad[0].year); g1 = Math.max(g1, s.god); });
    var gp = g1 - 1, tr = trendy(r), fns = st.some(function (s) { return s.fns; });
    var rows = st.map(function (s) {
      // «Изм.» — только если у строки есть оба последних года таблицы; иначе честное «—»
      var izm = s.god === g1 && s.ryad.length > 1 && s.ryad[s.ryad.length - 2].year === gp && s.kGodu
        ? (STRELKA[s.ton] ? STRELKA[s.ton] + NB : '') + (s.smena ? (s.ton === 'vverh' ? 'из убытка' : 'в убыток') : s.kGodu.replace(/\sк\s\d{4}$/, '')) : '—';
      return '<tr class="din__r din__r--' + s.ton + '">' +
        '<th scope="row" class="din__n">' + esc(s.nazv) + (s.zaPeriod ? '<small>' + s.zaPeriod + '</small>' : '') + '</th>' +
        '<td class="din__g">' + sparklajn(s.ryad) + '</td>' +
        '<td class="din__v din__p n">' + zaGod(s, gp) + '</td>' +
        '<td class="din__v n"><b>' + zaGod(s, g1) + '</b></td>' +
        '<td class="din__v din__k n">' + izm + '</td></tr>';
    }).join('');
    return '<section class="din" aria-label="Динамика по годам">' +
      '<div class="din__h"><b>Динамика за ' + g0 + '–' + g1 + '</b><span>' + (fns ? 'ГИР БО и наборы ФНС' : 'ГИР БО ФНС') + ' · ' + g0 + '–' + g1 + '</span></div>' +
      '<div class="din__w"><table class="din__t"><caption class="din__cap">Показатели по годам, ' + g0 + '–' + g1 + '</caption>' +
      '<thead><tr><th scope="col">Показатель</th><th scope="col" class="din__g"><span class="din__cap">График </span>' + g0 + '–' + g1 + '</th>' +
      '<th scope="col" class="din__v din__p n">' + gp + '</th><th scope="col" class="din__v n">' + g1 + '</th><th scope="col" class="din__v">Изм.</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
      (tr.length ? '<p class="din__tr">' + tr.map(esc).join(' ') + '</p>' : '') +
      (opt && opt.balans === false ? '' : htmlBalans(r)) +
      '<p class="din__src">Источник: ГИР БО ФНС, годовая бухгалтерская отчётность; последний год — ' + g1 + ' (на' + NB + '31.12.' + g1 + ').' +
      (fns ? ' Численность и уплаченные налоги — открытые наборы ФНС за год.' : '') + '</p>' +
      '</section>';
  }

  // ---- «Баланс на 31.12»: на чём держится компания и кто кому должен (balans-ekran-v1) ----
  // Только факты годовой отчётности (ГИР БО): dossier.charts.balance (капитал, долгосрочные и краткосрочные обязательства)
  // и dossier.charts.debts (дебиторка, кредиторка, кредиты и займы). Без оценок — их даёт «Комментарий команды».
  // В PDF-досье (report.html) свои графики баланса — там html(r, {balans: false}).
  function chisl(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function dolya(v, tot) { var p = Math.round(v / tot * 100); return p < 1 ? '<1' + NB + '%' : p + NB + '%'; }
  function balans(r) {
    var ch = (r && r.dossier && r.dossier.charts) || {};
    var b = ch.balance && typeof ch.balance === 'object' ? ch.balance : null, d = ch.debts && typeof ch.debts === 'object' ? ch.debts : null;
    var out = { god: null, chasti: [], kapitalMinus: null, raschety: [], godR: null, zajmyKVyr: null };
    if (b) {
      var gb = parseInt(b.year, 10), eq = chisl(b.equity), ld = chisl(b.long_debt), sd = chisl(b.short_debt);
      if (isFinite(gb) && (eq != null || ld != null || sd != null)) {
        out.god = gb;
        var ch3 = [{ k: 'kap', nazv: 'Собственный капитал', v: eq }, { k: 'dol', nazv: 'Долгосрочные обязательства', v: ld }, { k: 'kor', nazv: 'Краткосрочные обязательства', v: sd }]
          .filter(function (x) { return x.v != null && x.v > 0; });
        var tot = ch3.reduce(function (a, x) { return a + x.v; }, 0);
        out.chasti = tot > 0 ? ch3.map(function (x) { return { k: x.k, nazv: x.nazv, v: x.v, dolya: dolya(x.v, tot), w: x.v / tot * 100 }; }) : [];
        if (eq != null && eq < 0) out.kapitalMinus = eq;
      }
    }
    if (d) {
      var gd = parseInt(d.year, 10);
      if (isFinite(gd)) {
        [['rec', 'Фирме должны покупатели', d.receivables], ['pay', 'Фирма должна поставщикам', d.payables], ['loan', 'Кредиты и займы', d.loans]].forEach(function (x) {
          var v = chisl(x[2]); if (v != null && v > 0) out.raschety.push({ k: x[0], nazv: x[1], v: v });
        });
        if (out.raschety.length) out.godR = gd;
        var vy = (Array.isArray(ch.revenue) ? ch.revenue : []).filter(function (x) { return x && parseInt(x.year, 10) === gd; })[0];
        var zl = chisl(d.loans);
        if (zl != null && zl > 0 && vy && chisl(vy.value) != null && vy.value > 0) out.zajmyKVyr = Math.round(zl / vy.value * 100);
      }
    }
    return out.chasti.length || out.kapitalMinus != null || out.raschety.length ? out : null;
  }
  function htmlBalans(r) {
    var b = balans(r);
    if (!b) return '';
    var h = '<div class="din__bal" data-blok="balans">';
    if (b.god != null) {
      h += '<div class="din__bh"><b>На чём держится компания</b><span>баланс на' + NB + '31.12.' + b.god + '</span></div>';
      if (b.chasti.length) {
        h += '<div class="din__bar" role="img" aria-label="' + esc(b.chasti.map(function (x) { return x.nazv + ' — ' + x.dolya.replace(NB, ' '); }).join(', ')) + '">' +
          b.chasti.map(function (x) { return '<i class="din__b--' + x.k + '" style="width:' + x.w.toFixed(1) + '%"></i>'; }).join('') + '</div>';
      }
      h += '<ul class="din__leg">' + b.chasti.map(function (x) {
        return '<li><i class="din__b--' + x.k + '"></i><span>' + esc(x.nazv) + '</span><b class="n">' + dengi(x.v) + '</b><em class="n">' + x.dolya + '</em></li>';
      }).join('') + (b.kapitalMinus != null ? '<li class="din__minus"><i></i><span>Собственный капитал</span><b class="n">' + dengi(b.kapitalMinus) + '</b><em>меньше нуля</em></li>' : '') + '</ul>';
    }
    if (b.raschety.length) {
      h += '<div class="din__bh"><b>Кто кому должен</b><span>на' + NB + '31.12.' + b.godR + '</span></div><ul class="din__leg din__ras">' + b.raschety.map(function (x) {
        return '<li><span>' + esc(x.nazv) + '</span><b class="n">' + dengi(x.v) + '</b><em class="n">' +
          (x.k === 'loan' && b.zajmyKVyr != null ? b.zajmyKVyr + NB + '% выручки за' + NB + b.godR : '') + '</em></li>';
      }).join('') + '</ul>';
    }
    return h + '</div>';
  }
  function htmlBalansOtdelno(r) {
    var bh = htmlBalans(r);
    if (!bh) return '';
    return '<section class="din" aria-label="Баланс по годовой отчётности">' + bh +
      '<p class="din__src">Источник: ГИР БО ФНС, годовая бухгалтерская отчётность (баланс).</p></section>';
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
      // название — только у организаций (для «Ваших контрагентов» на главной, js/portfel.js); у ИП имя = ФИО — не храним
      var nm = String(c.name_short || c.name_full || '').trim();
      if (nm) s.nm = nm.slice(0, 120);
      if (c.director_since) s.dir = String(c.director_since).slice(0, 10);
      s.nedost = !!(c.invalid || c.address_invalid);
      var ch = (r.dossier && r.dossier.charts) || {}, v = ryad(ch.revenue), p = ryad(ch.profit);
      if (v.length) s.vyr = [v[v.length - 1].year, v[v.length - 1].value];
      if (p.length) s.prib = [p[p.length - 1].year, p[p.length - 1].value];
      // собственный капитал (строка 1300 баланса, dossier.charts.balance) — для «ушёл в минус / вышел из минуса»
      var bl = ch.balance, kg = bl && typeof bl === 'object' ? parseInt(bl.year, 10) : NaN, ke = bl ? bl.equity : null;
      if (isFinite(kg) && ke !== null && ke !== '' && typeof ke !== 'boolean' && isFinite(Number(ke))) s.kap = [kg, Number(ke)];
      // текущая ликвидность (строка раздела досье dynamics, ГИР БО) — для «опустилась ниже 1 / снова 1 и выше»
      var lk = likvidnost(r);
      if (lk) s.lk = lk;
      // убыток подряд (та же серия, что факт «Убыток N лет подряд» в js/sushchestvennoe.js) — [последний год, лет подряд]
      var u = ubSerija(ch.profit);
      if (u) s.ub = u;
      // оценка рентабельности активов (js/rentabelnost.js, без норм) — для «стала ниже средней по отрасли / больше не ниже»
      var R = rent(), ro = R && R.ocenka ? R.ocenka(r) : null;
      if (ro && isFinite(ro.n)) s.rn = [ro.god, Math.round(ro.n * 10) / 10];
      // кредиты и займы (баланс, dossier.charts.debts.loans; та же строка «Кредиты и займы» в досье) — для «стали больше годовой выручки» и «выросли в 2 раза»
      var db = ch.debts, zg = db && typeof db === 'object' ? parseInt(db.year, 10) : NaN, zl = db ? db.loans : null;
      if (isFinite(zg) && zl !== null && zl !== '' && typeof zl !== 'boolean' && isFinite(Number(zl)) && Number(zl) >= 0) s.zm = [zg, Number(zl)];
      // основной вид деятельности (ЕГРЮЛ): код и название — для «основной вид деятельности сменился»
      var ok = okved(r);
      if (ok) { s.ok = ok.kod; if (ok.nazv) s.okn = ok.nazv; }
      // Индекс (сервер или браузер по открытой методике, js/indeks-otvet.js) — для «Индекс: 64 → 58 с проверки 01.10»
      var ix = ixChislo(r);
      if (ix != null) s.ix = ix;
      // код состояния ЕГРЮЛ и дата записи — для «ФНС начала готовить исключение / отметки больше нет»
      var kd = kodSost(c.state_code);
      if (kd) {
        s.kod = kd;
        var kdd = /^(\d{4}-\d{2}-\d{2})/.exec(String(c.state_actuality_date || ''));
        if (kdd) s.kodd = kdd[1];
      }
    }
    return s;
  }

  // Основной ОКВЭД: код из company.okved, название — из company.okved_name или строки досье «Основной вид деятельности»
  // («46.71.4 — Торговля оптовая…», только если код в строке тот же). → {kod, nazv} | null
  function okved(r) {
    var c = (r && r.company) || {}, kod = String(c.okved == null ? '' : c.okved).trim();
    if (!/^\d{2}(\.\d{1,2}){0,2}$/.test(kod)) return null;
    var nazv = String(c.okved_name == null ? '' : c.okved_name).trim();
    if (!nazv) {
      var D = (r && r.dossier) || {};
      (Array.isArray(D.sections) ? D.sections : []).forEach(function (sk) {
        if (!sk || !Array.isArray(sk.rows)) return;
        sk.rows.forEach(function (row) {
          if (nazv || !Array.isArray(row) || !/^Основной вид деятельности$/i.test(String(row[0] || '').trim())) return;
          var m = /^\s*(\d{2}(?:\.\d{1,2}){0,2})\s*[—–-]\s*(.+?)\s*$/.exec(String(row[1] == null ? '' : row[1]));
          if (m && m[1] === kod) nazv = m[2];
        });
      });
    }
    nazv = nazv.replace(/\s+/g, ' ');
    return { kod: kod, nazv: nazv.length > 90 ? nazv.slice(0, 89).replace(/\s+\S*$/, '') + '…' : nazv };
  }

  // Во сколько раз: «в 2 раза», «в 2,4 раза», «в 12 раз» (k ≥ 2)
  function vRaz(k) {
    if (k >= 10) { var n = Math.round(k); return 'в' + NB + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + skl(n, 'раз', 'раза', 'раз'); }
    var t = chislo(Math.floor(k * 10) / 10, 1).replace(/,0$/, '');
    return 'в' + NB + t + NB + (/,/.test(t) ? 'раза' : skl(+t, 'раз', 'раза', 'раз'));
  }

  // Серия убыточных лет от последнего года ряда назад, только соседние годы; меньше 2 лет — null. → [год, n] | null
  function ubSerija(arr) {
    var po = {};
    (Array.isArray(arr) ? arr : []).forEach(function (x) {
      var g = x ? parseInt(x.year, 10) : NaN;
      if (isFinite(g) && x.value !== null && x.value !== '' && typeof x.value !== 'boolean' && isFinite(Number(x.value))) po[g] = Number(x.value);
    });
    var gody = Object.keys(po).map(Number).sort(function (a, b) { return a - b; });
    if (!gody.length) return null;
    var g1 = gody[gody.length - 1], n = 0;
    while (po.hasOwnProperty(g1 - n) && po[g1 - n] < 0) n++;
    return n >= 2 ? [g1, n] : null;
  }

  // Модуль рентабельности ищем в момент вызова: на странице он может загрузиться позже (defer), в node — require
  function rent() {
    try {
      if (typeof self !== 'undefined' && self.Rentabelnost) return self.Rentabelnost;
      if (typeof module === 'object' && module.exports && typeof require === 'function') return require('./rentabelnost.js');
    } catch (e) {}
    return null;
  }

  // Модуль Индекса в браузере (indeks-v-otchete-v1) — как rent(): на странице может загрузиться позже, в node — require
  function ixModul() {
    try {
      if (typeof self !== 'undefined' && self.IndeksOtvet) return self.IndeksOtvet;
      if (typeof module === 'object' && module.exports && typeof require === 'function') return require('./indeks-otvet.js');
    } catch (e) {}
    return null;
  }
  // Число Индекса для снимка: серверное (целое 1–99) главнее; иначе — браузерное, только если прошло ворота
  function ixChislo(r) {
    var v = r && r.indeks;
    if (v !== undefined && v !== null && v !== '') {
      if (typeof v === 'object') v = v.znachenie != null ? v.znachenie : v.ball;
      v = typeof v === 'string' && /^\d{1,2}$/.test(v) ? +v : v;
      return typeof v === 'number' && v >= 1 && v <= 99 && Math.round(v) === v ? v : null;
    }
    var IO = ixModul();
    try { return IO && IO.gotov && IO.gotov() ? IO.ball(r) : null; } catch (e) { return null; }
  }
  function ddmm(t) { var q = new Date(t + 3 * 3600 * 1000); return ('0' + q.getUTCDate()).slice(-2) + '.' + ('0' + (q.getUTCMonth() + 1)).slice(-2); }

  // Текущая ликвидность: строка «Текущая ликвидность» раздела досье «Финансовая динамика» (тот же разбор, что в
  // js/sushchestvennoe.js), год — из charts.balance или charts.debts. Ноль и пусто — не значение. → [год, число] | null
  function likvidnost(r) {
    var D = (r && r.dossier) || {}, ch = D.charts || {}, v = null;
    (Array.isArray(D.sections) ? D.sections : []).forEach(function (sk) {
      if (!sk || sk.id !== 'dynamics' || !Array.isArray(sk.rows)) return;
      sk.rows.forEach(function (row) {
        if (!Array.isArray(row) || !/^Текущая ликвидность$/i.test(String(row[0] || '').trim())) return;
        var m = /^\s*(\d+(?:[.,]\d+)?)\s*$/.exec(String(row[1] == null ? '' : row[1]));
        if (m) v = Number(m[1].replace(',', '.'));
      });
    });
    var g = parseInt(((ch.balance || {}).year) || ((ch.debts || {}).year), 10);
    if (v === null || !isFinite(v) || !(v > 0) || !isFinite(g)) return null;
    return [g, Math.round(v * 100) / 100];
  }

  function dataRu(t) {
    var d = new Date(t), m = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return d.getDate() + NB + m[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function dmy(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }

  // Список изменений между двумя снимками одной компании: [{ton:'huzhe'|'luchshe'|'info', t:'…'}], хуже — первыми.
  // dop(a, b) → {ton, t} | null — строка, которой нужны внешние данные (нормы ФНС для рентабельности, js/rentabelnost.js).
  function sravnit(a, b, dop) {
    if (!a || !b || a.inn !== b.inn) return [];
    var out = [];
    function add(ton, t, pod) { var x = { ton: ton, t: t }; if (pod) x.pod = pod; out.push(x); }
    // предстоящее исключение из ЕГРЮЛ (код состояния): одна строка вместо «Статус в ЕГРЮЛ: …» и «Статус: норма → риск»
    var iA = iskl(a.kod), iB = iskl(b.kod), xA = isklyuchena(a.kod), xB = isklyuchena(b.kod), bezSt = false;
    var zapis = function (s) { return s.kodd ? ': запись в' + NB + 'ЕГРЮЛ от' + NB + dmy(s.kodd) : ''; };
    var ranshe = a.st ? ' (на' + NB + 'прошлой проверке — ' + nazvSt(a.st, a.kod) + ')' : '';
    if (xB && !xA && (a.kod || a.st === 'ACTIVE' || a.st === 'LIQUIDATING')) {
      // уже исключена: тон — стоп; подстрочник — [Право] 16:07 разд. 2 («последствия — как при ликвидации»: норма говорит о последствиях)
      add('huzhe', 'Компания исключена из' + NB + 'ЕГРЮЛ' + zapis(b) + ranshe,
        'Последствия — как при' + NB + 'ликвидации (п.' + NB + '2 ст.' + NB + '64.2 ГК' + NB + 'РФ): договор с' + NB + 'ней не' + NB + 'заключайте и' + NB + 'не' + NB + 'платите.');
      bezSt = true;
    } else if (iB && !iA && (a.kod || a.st === 'ACTIVE')) {
      add('huzhe', nazvIskl(b.kod) + zapis(b) + ranshe, podIskl(b.kod, b.kodd));
      bezSt = true;
    } else if (iA && !iB && b.st === 'ACTIVE') {
      add('luchshe', 'Отметки о' + NB + 'предстоящем исключении из' + NB + 'ЕГРЮЛ больше нет: компания действующая');
      bezSt = true;
    }
    if (!bezSt && a.st && b.st && (a.st !== b.st || (a.kod && b.kod && iskl(a.kod) !== iskl(b.kod))) && nazvSt(a.st, a.kod) !== nazvSt(b.st, b.kod))
      add(b.st === 'ACTIVE' ? 'luchshe' : 'huzhe', 'Статус в ЕГРЮЛ: ' + nazvSt(a.st, a.kod) + ' → ' + nazvSt(b.st, b.kod));
    if (a.lvl && b.lvl && a.lvl !== b.lvl) {
      var o = ['low', 'medium', 'high'];
      add(o.indexOf(b.lvl) > o.indexOf(a.lvl) ? 'huzhe' : 'luchshe', 'Оценка риска: ' + LVL[a.lvl] + ' → ' + LVL[b.lvl]);
    }
    if (a.ix && b.ix && a.ix !== b.ix && isFinite(a.t))
      add(b.ix < a.ix ? 'huzhe' : 'luchshe', 'Индекс: ' + a.ix + ' → ' + b.ix + ' с' + NB + 'проверки ' + ddmm(a.t));
    if (a.zsk && b.zsk && a.zsk !== b.zsk) {
      var z = ['low', 'medium', 'high'];
      add(z.indexOf(b.zsk) > z.indexOf(a.zsk) ? 'huzhe' : 'luchshe', 'Прогноз ЗСК (наша оценка): ' + LVL[a.zsk] + ' → ' + LVL[b.zsk]);
    }
    if (a.nedost === false && b.nedost === true) add('huzhe', 'Появилась отметка о недостоверности сведений в ЕГРЮЛ');
    if (a.nedost === true && b.nedost === false) add('luchshe', 'Отметка о недостоверности сведений в ЕГРЮЛ снята');
    if (a.dir && b.dir && a.dir !== b.dir) add('info', 'Руководитель сменился: новая запись в ЕГРЮЛ с' + NB + dmy(b.dir));
    Object.keys(b.sig || {}).forEach(function (id) {
      if (bezSt && id === 'status') return;
      var x = (a.sig || {})[id], y = b.sig[id];
      if (!x) { if (VES[y[0]] > 0) add('huzhe', y[1] + ': ' + STX[y[0]]); return; }
      if (x[0] !== y[0]) add(VES[y[0]] > VES[x[0]] ? 'huzhe' : VES[y[0]] < VES[x[0]] ? 'luchshe' : 'info', y[1] + ': ' + STX[x[0]] + ' → ' + STX[y[0]]);
    });
    // капитал: только смена знака и только между двумя снимками, где он есть (старый снимок без капитала — «не сравнивали»)
    if (a.kap && b.kap && b.kap[0] >= a.kap[0]) {
      if (a.kap[1] >= 0 && b.kap[1] < 0) add('huzhe', 'Собственный капитал ушёл в минус: на' + NB + '31.12.' + b.kap[0] +
        ' — минус ' + dengi(-b.kap[1]) + ', обязательства больше активов (ГИР' + NB + 'БО)');
      else if (a.kap[1] < 0 && b.kap[1] >= 0) add('luchshe', 'Собственный капитал больше не отрицательный: на' + NB + '31.12.' + b.kap[0] +
        ' — ' + (b.kap[1] > 0 ? dengi(b.kap[1]) : '0' + NB + '₽') + ' (ГИР' + NB + 'БО)');
    }
    // ликвидность: только переход через 1 и только между двумя снимками, где она есть (как капитал)
    if (a.lk && b.lk && b.lk[0] >= a.lk[0]) {
      if (a.lk[1] >= 1 && b.lk[1] < 1) add('huzhe', 'Текущая ликвидность опустилась ниже 1: на' + NB + '31.12.' + b.lk[0] +
        ' — ' + chislo(b.lk[1], 2) + ', краткосрочные долги больше оборотных средств (ГИР' + NB + 'БО)');
      else if (a.lk[1] < 1 && b.lk[1] >= 1) add('luchshe', 'Оборотные средства снова покрывают краткосрочные долги: текущая ликвидность на' +
        NB + '31.12.' + b.lk[0] + ' — ' + chislo(b.lk[1], 2) + ' (ГИР' + NB + 'БО)');
    }
    // новая отчётность: прибыль сменилась убытком — красная точка, убыток прибылью — зелёная, иначе — справочно
    var novPrib = b.prib && b.vyr && b.prib[0] === b.vyr[0];
    var tonOtch = !novPrib || !a.prib || !(b.prib[0] > a.prib[0]) ? 'info'
      : a.prib[1] >= 0 && b.prib[1] < 0 ? 'huzhe' : a.prib[1] < 0 && b.prib[1] > 0 ? 'luchshe' : 'info';
    if (b.vyr && (!a.vyr || b.vyr[0] > a.vyr[0])) add(tonOtch, 'Появилась отчётность за ' + b.vyr[0] + ': выручка ' + dengi(b.vyr[1]) +
      (b.prib && b.prib[0] === b.vyr[0] ? ', ' + (b.prib[1] < 0 ? 'убыток ' + dengi(-b.prib[1]) : 'прибыль ' + dengi(b.prib[1])) : ''));
    // убыток подряд: только с новой годовой отчётностью, в которой серия убытков дошла до 2 лет и больше
    // (старый снимок без поля ub — сравниваем по году его прибыли; без года — молчим)
    var gA = a.prib ? a.prib[0] : a.ub ? a.ub[0] : null;
    if (b.ub && gA !== null && b.ub[0] > gA) {
      var n = b.ub[1], ot = b.ub[0] - n + 1;
      add('huzhe', 'Убыток ' + n + NB + skl(n, 'год', 'года', 'лет') + ' подряд: по годовой отчётности за ' +
        (n === 2 ? ot + ' и ' + b.ub[0] : ot + '–' + b.ub[0]) + ' (ГИР' + NB + 'БО)');
    }
    // основной вид деятельности: смена кода в ЕГРЮЛ — справочно (факт, без оценки)
    if (a.ok && b.ok && a.ok !== b.ok) add('info', 'Основной вид деятельности в ЕГРЮЛ сменился: ' + a.ok + ' → ' + b.ok + (b.okn ? ' — ' + b.okn : ''));
    // кредиты и займы: только с новой годовой отчётностью (год баланса новее) и только между снимками, где они есть
    if (a.zm && b.zm && b.zm[0] > a.zm[0]) {
      var vA = a.vyr && a.vyr[0] === a.zm[0] && a.vyr[1] > 0 ? a.vyr[1] : null, vB = b.vyr && b.vyr[0] === b.zm[0] && b.vyr[1] > 0 ? b.vyr[1] : null;
      var nd = 'на' + NB + '31.12.' + b.zm[0] + ' — ' + dengi(b.zm[1]);
      if (vA !== null && vB !== null && a.zm[1] <= vA && b.zm[1] > vB) add('huzhe', 'Кредиты и займы стали больше годовой выручки: ' + nd +
        ', выручка за ' + b.zm[0] + ' — ' + dengi(vB) + ' (ГИР' + NB + 'БО)');
      else if (vA !== null && vB !== null && a.zm[1] > vA && b.zm[1] <= vB) add('luchshe', 'Кредиты и займы больше не превышают годовую выручку: ' + nd +
        ', выручка за ' + b.zm[0] + ' — ' + dengi(vB) + ' (ГИР' + NB + 'БО)');
      else if (a.zm[1] > 0 && b.zm[1] >= 2 * a.zm[1]) add('info', 'Кредиты и займы выросли ' + vRaz(b.zm[1] / a.zm[1]) + ': ' + nd +
        ', на' + NB + '31.12.' + a.zm[0] + ' — ' + dengi(a.zm[1]) + ' (ГИР' + NB + 'БО)');
    }
    if (typeof dop === 'function') { try { var dx = dop(a, b); if (dx && dx.t) add(dx.ton, dx.t); } catch (e) {} }
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

  // rez.id — сравнение с досье проверки из кабинета (любое устройство); иначе — со снимком в этом браузере.
  function htmlIzmeneniya(rez) {
    if (!rez) return '';
    if (rez.pervyj) return '<p class="izm izm--0">Запомнили эту проверку на вашем устройстве. Проверите компанию снова — покажем, что изменилось.</p>';
    var kogda = dataRu(rez.s.t);
    var dosje = rez.id ? '<a href="/report.html?id=' + encodeURIComponent(rez.id) + '" target="_blank" rel="noopener">досье от' + NB + dmyT(rez.s.t) + '</a>' : '';
    if (!rez.izm.length) return '<div class="izm"' + (rez.id ? ' data-izm="kabinet"' : '') + '><b>С вашей проверки ' + kogda + ' существенных изменений нет</b>' +
      '<span>Статус, руководитель, долги, оценка риска и признаки светофора — прежние.' + (rez.id ? ' Сравнили с ' + dosje + ' в вашем кабинете.' : '') + '</span></div>';
    return '<div class="izm izm--da"' + (rez.id ? ' data-izm="kabinet"' : '') + '><b>Что изменилось с вашей проверки ' + kogda + '</b><ul>' +
      rez.izm.map(function (x) {
        return '<li class="izm--' + x.ton + '">' + esc(x.t) + (x.pod ? '<small class="izm__pod">' + esc(x.pod).replace('vestnik-gosreg.ru',
          '<a href="https://vestnik-gosreg.ru/" target="_blank" rel="noopener">vestnik-gosreg.ru</a>') + '</small>' : '') + '</li>';
      }).join('') +
      '</ul><span>' + (rez.id ? 'Сравниваем с ' + dosje + ' из вашего кабинета — проверка с любого устройства.'
        : 'Сравниваем с проверкой на этом устройстве; снимок хранится только в вашем браузере.') + '</span></div>';
  }
  // ДД.ММ.ГГГГ по Москве (UTC+3)
  function dmyT(t) {
    var d = new Date(t + 3 * CHAS);
    return ('0' + d.getUTCDate()).slice(-2) + '.' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '.' + d.getUTCFullYear();
  }

  // ---- «Что изменилось» по кабинету: прошлая проверка с другого устройства (ответы /api/me/checks и /api/report/{id}) ----
  // rows — ответ /api/me/checks ({inn, created_at, risk_level, report_id}); t — время текущей проверки; tekId — её report_id.
  // → самая поздняя проверка той же компании раньше текущей больше чем на час, у которой есть досье: {id, t} | null.
  function predydushchaya(rows, inn, t, tekId) {
    var best = null;
    (Array.isArray(rows) ? rows : []).forEach(function (x) {
      if (!x || String(x.inn || '').trim() !== inn || !x.report_id) return;
      var tx = Date.parse(String(x.created_at || ''));
      if (!isFinite(tx) || tx > t - CHAS || String(x.report_id) === String(tekId || '')) return;
      if (!best || tx > best.t) best = { id: String(x.report_id), t: tx };
    });
    return best;
  }
  // Кабинет нужен, только если там проверка новее снимка этого браузера (больше чем на час) или снимка нет.
  function nuzhenKabinet(lokal, server) {
    if (!server) return false;
    var tl = lokal && lokal.s && isFinite(lokal.s.t) ? lokal.s.t : -Infinity;
    return server.t > tl + CHAS;
  }

  var poslednij = null; // последний результат zapomnit() на этой странице: {inn, t, rez}
  var pokazan = null;   // что сейчас в блоке «что изменилось»: {kl: 'ИНН:t', rez, b}
  var dopolnenie = null; // {kl, fn} — строка с внешними данными (рентабельность против нормы), пришла позже отрисовки

  // Пересобирает показанный блок с дополнительной строкой; повторно ту же строку не добавляет.
  function sDop(rez, b, fn) {
    if (!rez || !rez.s || !Array.isArray(rez.izm) || typeof fn !== 'function') return null;
    var x = null;
    try { x = fn(rez.s, b); } catch (e) { x = null; }
    if (!x || !x.t || rez.izm.some(function (q) { return q.t === x.t; })) return null;
    var dx = { ton: x.ton, t: x.t }; if (x.pod) dx.pod = x.pod;
    var poryadok = { huzhe: 0, info: 1, luchshe: 2 }, izm = rez.izm.concat([dx]);
    izm.sort(function (p, q) { return poryadok[p.ton] - poryadok[q.ton]; });
    var nov = {}; Object.keys(rez).forEach(function (k) { nov[k] = rez[k]; });
    nov.izm = izm.slice(0, 7);
    return nov;
  }
  // Браузер: модуль с внешними данными (js/rentabelnost.js) отдаёт функцию сравнения двух снимков после загрузки норм.
  // Блок «что изменилось» этой же проверки — пересобираем со строкой; кабинет (dogruzit) применит её сам, если ответит позже.
  function dobavit(report, r, fn) {
    var b = snimok(r);
    if (!report || !b || typeof fn !== 'function') return null;
    var kl = b.inn + ':' + b.t;
    dopolnenie = { kl: kl, fn: fn };
    if (!pokazan || pokazan.kl !== kl) return null;
    var nov = sDop(pokazan.rez, b, fn);
    if (!nov) return null;
    pokazan.rez = nov;
    try { vstavit(report, htmlIzmeneniya(nov)); } catch (e) { return null; }
    return nov;
  }

  // Браузер: после отрисовки отчёта. Только для вошедших (dlk_voshel = 1); любые ошибки — молча, остаётся блок браузера.
  // opt: { api, fetch, voshel } — для тестов. Возвращает Promise<rez|null>.
  function dogruzit(report, r, opt) {
    opt = opt || {};
    var f = opt.fetch || (typeof fetch === 'function' ? fetch : null);
    var b = snimok(r), voshel = opt.voshel;
    if (voshel == null) { try { voshel = window.localStorage.getItem('dlk_voshel') === '1'; } catch (e) { voshel = false; } }
    if (!report || !b || !f || !voshel || opt.api == null) return Promise.resolve(null);
    var lokal = poslednij && poslednij.inn === b.inn && poslednij.t === b.t ? poslednij.rez : null;
    var api = String(opt.api), kl = b.inn + ':' + b.t;
    // пока ждём ответа, на странице могли проверить другую компанию — тогда ничего не вставляем
    try { report.setAttribute('data-izm-k', kl); } catch (e) { return Promise.resolve(null); }
    function json(u, cr) {
      return f(api + u, cr ? { credentials: 'include' } : {}).then(function (x) { if (!x || !x.ok) throw 0; return x.json(); });
    }
    return json('/api/me/checks', true).then(function (j) {
      var srv = predydushchaya(j && (j.checks || j), b.inn, b.t, r.report_id);
      if (!nuzhenKabinet(lokal, srv)) return null;
      return json('/api/report/' + encodeURIComponent(srv.id)).then(function (pr) {
        var a = snimok(pr);
        if (!a || a.inn !== b.inn || !(a.t <= b.t - CHAS) || report.getAttribute('data-izm-k') !== kl) return null;
        var rez = { s: a, izm: sravnit(a, b, dopolnenie && dopolnenie.kl === kl ? dopolnenie.fn : null), id: srv.id };
        vstavit(report, htmlIzmeneniya(rez));
        pokazan = { kl: kl, rez: rez, b: b };
        try { if (typeof window !== 'undefined' && window.dlkGoal) window.dlkGoal('izm_kabinet'); } catch (e) {}
        return rez;
      });
    }).catch(function () { return null; });
  }
  // Заменяет блок «что изменилось» в отчёте; если его нет — ставит перед «Динамикой» или после фактов.
  function vstavit(report, h) {
    var doc = report.ownerDocument, t = doc.createElement('div');
    t.innerHTML = h;
    var nov = t.firstChild, star = report.querySelector('.izm');
    if (!nov) return;
    if (star) { star.parentNode.replaceChild(nov, star); return; }
    var din = report.querySelector('.din');
    if (din) { din.parentNode.insertBefore(nov, din); return; }
    var rows = report.querySelector('.rows');
    if (rows && rows.parentNode) rows.parentNode.insertBefore(nov, rows.nextSibling);
  }

  var CSS = '.din{display:grid;gap:10px;padding:16px 18px;border-radius:16px;background:var(--bg,#F5F5F2)}' +
    '.din__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px}.din__h b{font-size:15px;font-weight:600}.din__h span{font-size:13px;color:var(--muted,#6B6B70)}' +
    '.din__w{overflow-x:auto}.din__t{width:100%;border-collapse:collapse;font-size:15px}' +
    '.din__cap{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
    '.din__t th,.din__t td{padding:10px 0 10px 16px;border-top:1px solid var(--line,#E6E6E1);vertical-align:middle;text-align:left;font-weight:400}' +
    '.din__t th:first-child{padding-left:0}' +
    '.din__t thead th{border-top:0;padding-top:2px;padding-bottom:6px;font-size:12px;color:var(--muted,#6B6B70)}' +
    '.din__n small{display:block;font-size:12px;color:var(--muted,#6B6B70)}' +
    '.din__v{text-align:right!important;white-space:nowrap}.din__v b{font-weight:600}' +
    '.n{font-variant-numeric:tabular-nums}.din__p{color:var(--ink2,#48484C)}.din__na{font-size:12px;color:var(--muted,#6B6B70)}' +
    '.din__k{font-size:13px;color:var(--muted,#6B6B70)}.din__r--vverh .din__k{color:var(--ok,#16723F)}.din__r--vniz .din__k{color:#B3261E}' +
    '.din__g{width:96px}.din__sv{display:block}.din__sv polyline{fill:none;stroke:var(--accent,#0B63E5);stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}' +
    '.din__sv .din__0{stroke:#C9C9C4;stroke-width:1;stroke-dasharray:2 2}' +
    '.din__tr{margin:0;font-size:14px;color:var(--ink2,#48484C)}.din__src{margin:0;font-size:12px;color:var(--muted,#6B6B70)}' +
    '.din__bal{display:grid;gap:8px;padding-top:6px;border-top:1px solid var(--line,#E6E6E1)}' +
    '.din__bh{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 10px;margin-top:6px}.din__bh b{font-size:14px;font-weight:600}.din__bh span{font-size:12px;color:var(--muted,#6B6B70)}' +
    '.din__bar{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;background:var(--surface-2,#EEEEEA)}.din__bar i{display:block;height:100%;min-width:2px}' +
    '.din__b--kap{background:var(--accent,#0B63E5)}.din__b--dol{background:#7FA8F0}.din__b--kor{background:#C9C9C4}' +
    '.din__leg{margin:0;padding:0;list-style:none;display:grid;gap:2px;font-size:14px}' +
    '.din__leg li{display:grid;grid-template-columns:auto 1fr auto 10em;align-items:baseline;gap:8px;padding:5px 0;border-top:1px solid var(--line,#E6E6E1)}.din__leg li:first-child{border-top:0}' +
    '.din__leg li>i{width:8px;height:8px;border-radius:2px;align-self:center}.din__ras li{grid-template-columns:1fr auto 10em}' +
    '.din__leg b{font-weight:600;text-align:right;white-space:nowrap}.din__leg em{font-style:normal;font-size:12px;color:var(--muted,#6B6B70);text-align:right;white-space:nowrap}' +
    '.din__minus>i{background:#B3261E}.din__minus b{color:#B3261E}' +
    '@media (max-width:520px){.din__leg li{grid-template-columns:auto 1fr auto}.din__ras li{grid-template-columns:1fr auto}.din__leg em{grid-column:2/-1;text-align:left;margin-top:-4px}.din__ras em{grid-column:1/-1}.din__leg em:empty{display:none}}' +
    '.izm{display:grid;gap:4px;padding:14px 18px;border-radius:16px;border:1px solid var(--line,#E6E6E1);font-size:14px}' +
    '.izm b{font-size:15px;font-weight:600}.izm span{font-size:12px;color:var(--muted,#6B6B70)}.izm span a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
    '.izm ul{margin:4px 0;padding:0;list-style:none;display:grid;gap:4px}.izm li{padding-left:18px;position:relative}' +
    '.izm li::before{content:"";position:absolute;left:2px;top:.55em;width:8px;height:8px;border-radius:50%;background:var(--muted,#6B6B70)}' +
    '.izm__pod{display:block;margin-top:2px;font-size:12.5px;line-height:1.45;color:var(--muted,#6B6B70)}.izm__pod a{white-space:nowrap;color:inherit;text-decoration:underline;text-underline-offset:2px}' +
    '.izm li.izm--huzhe::before{background:#E5484D}.izm li.izm--luchshe::before{background:#2FA36B}' +
    '.izm--0{margin:0;padding:0;border:0;font-size:13px;color:var(--muted,#6B6B70)}' +
    '#doc .izm,#doc .din{margin-top:14px}' +
    '@media (max-width:640px){.din__t .din__g{display:none}}' +
    '@media (max-width:520px){.din{padding:14px}.din__t{font-size:14px}.din__t th,.din__t td{padding-left:10px}.din__t .din__p{display:none}}' +
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
    try {
      var rez = zapomnit(r, ls), b = snimok(r);
      poslednij = b ? { inn: b.inn, t: b.t, rez: rez } : null;
      pokazan = b ? { kl: b.inn + ':' + b.t, rez: rez, b: b } : null;
      izm = htmlIzmeneniya(rez);
    } catch (e) { izm = ''; }
    var din = '';
    try { din = htmlDinamika(r, opt); if (!din && opt.balans !== false) din = htmlBalansOtdelno(r); } catch (e) { din = ''; }
    return izm + din;
  }

  return { ryad: ryad, ryady: ryady, stroka: stroka, izmenenie: izmenenie, trendy: trendy, dengi: dengi, htmlDinamika: htmlDinamika, balans: balans, htmlBalans: htmlBalans,
    snimok: snimok, sravnit: sravnit, likvidnost: likvidnost, okved: okved, vRaz: vRaz, zapomnit: zapomnit, htmlIzmeneniya: htmlIzmeneniya, html: html, KEY: KEY, CSS: CSS,
    iskl: iskl, isklyuchena: isklyuchena, ixChislo: ixChislo, plusMes: plusMes, kodSost: kodSost, predydushchaya: predydushchaya, nuzhenKabinet: nuzhenKabinet, dogruzit: dogruzit, dobavit: dobavit, sDop: sDop };
});
