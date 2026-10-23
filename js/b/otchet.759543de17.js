/* Делоскоп · пакет «otchet» — собран tests/sobrat_js.py из 25 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/sushchestvennoe.js --- */
/* Делоскоп — «Только существенные факты» и свёрнутая «Все данные из реестров» на экране проверки по ИНН
 * (решение команды 02.10, эталон экрана — п. 2 и п. 6: документ команды).
 * Существенные факты — не больше 7 строк, у каждой — источник и дата. Сначала то, что мешает платить (риск, внимание),
 * затем базовые факты: статус, недостоверность, долги, отчётность, руководитель, возраст, прогноз ЗСК.
 * Всё остальное из ответа /api/check (разделы досье, внешние реестры, из чего сложился прогноз ЗСК) — в <details>.
 * «Не проверяли ≠ не нашли»: источник, который не ответил, называется прямо, со ссылкой «проверьте сами».
 * У ИП не показываем адрес и руководителя (данные человека). Чистые функции (fakty, glubina, html) — без DOM и сети,
 * их проверяет tests/sushchestvennoe.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Sushchestvennoe = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = '\u00a0', MAKS = 7;

  var BANK_GIRBO = 'Организация сдаёт в' + NB + 'Банк России; в' + NB + 'ГИР' + NB + 'БО её передаёт Банк России, доступ может быть ограничен (ч.' + NB + '9 и' + NB + '12 ст.' + NB + '18' + NB + '402-ФЗ)';
  // «402-ФЗ)» на 390 px рвался по дефису («402-» / «ФЗ)») — номер закона со скобкой одним куском (после esc)
  function nwFz(h) { return String(h).replace(/(\d+-ФЗ\)?)/g, '<span class="nw">$1</span>'); }
  var VES = { bad: 0, warn: 1, ok: 2, neutral: 2 };
  // порядок базовых фактов, когда замечаний нет
  // poryadok-faktov-v1 [команда]: «Сотрудники» без замечаний — после прогноза ЗСК (живой ответ 05.10: «367 чел.» стояло первым
  // и вытесняло прогноз ЗСК в «Все данные»). При «нет сотрудников» (warn) строка по-прежнему среди первых — её поднимает тон.
  var PORYADOK = ['status', 'address', 'tax_debt', 'kapital', 'likvidnost', 'ubytki', 'skachok', 'otchetnost', 'rukovoditel', 'age', 'zsk', 'employees'];
  var NAZV = { status: 'Статус', address: 'Отметки о недостоверности', age: 'На рынке', tax_debt: 'Долги по налогам' };
  var SEKCII = { profile: 'reestr', history: 'reestr', management: 'reestr', activity: 'reestr', taxes: 'ФНС, открытые данные', dynamics: 'ГИР БО ФНС, годовая бухгалтерская отчётность' };
  var KRATKO = { sudy: 'арбитражные суды', bankrotstvo: 'банкротство', fssp: 'приставы', priostanovki: 'приостановки счетов', mery: 'обеспечительные меры ФНС', rnp: 'РНП', kontrakty: 'госконтракты' };
  var DAMIA_PORYADOK = ['sudy', 'bankrotstvo', 'fssp', 'priostanovki', 'mery', 'rnp', 'kontrakty'];
  // prichina-nep-v1 [команда] 11.10: реестр, который API пометил sostoyanie = not_checked («Не проверяли»), с причиной-обещанием
  // из ответа API («сегодня источник недоступен — обновите отчёт завтра», «…или откройте его в платном тарифе») — на сайте
  // словами [команда] 10.10: «эти реестры мы пока не проверяем» (как на главной и в ленте 2026-10-11-47). Суды, банкротство
  // и приставов не включает ни один тариф — экран не обещает их ни завтра, ни за деньги (38-ФЗ). Причину без обещания
  // («в открытой бете не подключён») оставляем как есть; у сбоя (не not_checked) — причина API без «платного тарифа».
  var POKA_NE = 'эти реестры мы пока не проверяем';
  var OBESHCHANIE = /завтра|тариф|сегодн|запас|временно|позже/i;
  var PLATNYJ = /[\s,;—-]*(?:или\s+)?(?:откройте|откроется)[^.;]*тариф[^.;]*/gi;
  function prichinaReestra(b) {
    if (!b) return '';
    if (b.sostoyanie === 'not_checked' && (!b.prichina || OBESHCHANIE.test(b.prichina))) return POKA_NE;
    return String(b.prichina || '').replace(PLATNYJ, '').replace(/\s+$/, '');
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function z(n) { return (n < 10 ? '0' : '') + n; }
  function dmy(s) {
    if (!s) return '';
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return m[3] + '.' + m[2] + '.' + m[1];
    var d = new Date(s);
    return isNaN(d) ? '' : z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear();
  }
  function dataIz(s) { // Date из ISO или ДД.ММ.ГГГГ
    var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s || '');
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function mesyacev(ot, na) {
    if (!ot || !na) return null;
    var m = (na.getFullYear() - ot.getFullYear()) * 12 + na.getMonth() - ot.getMonth();
    if (na.getDate() < ot.getDate()) m--;
    return m < 0 ? null : m;
  }
  function skl(n, a, b, c) {
    var k = n % 100, d = n % 10;
    return k > 10 && k < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c;
  }
  function srok(m) {
    if (m < 1) return 'меньше месяца';
    if (m < 12) return m + NB + skl(m, 'месяц', 'месяца', 'месяцев');
    var g = Math.floor(m / 12);
    return g + NB + skl(g, 'год', 'года', 'лет');
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
  function ton(st) { return st === 'bad' ? 'bad' : st === 'warn' ? 'warn' : st === 'ok' ? 'ok' : 'neutral'; }
  function poslednij(arr) {
    var a = (Array.isArray(arr) ? arr : []).filter(function (x) { return x && isFinite(parseInt(x.year, 10)) && x.value !== null && x.value !== '' && isFinite(Number(x.value)); });
    a.sort(function (p, q) { return p.year - q.year; });
    return a.length ? { year: +a[a.length - 1].year, value: Number(a[a.length - 1].value) } : null;
  }
  // Кредитная организация — по основному ОКВЭД 64.1 (денежное посредничество): банки и НКО.
  var CBR_BANK = 'https://www.cbr.ru/finorg/foinfo/';
  var SPRAVKA_STATUSY = '/nalogi/kody-statusa-egryul/';
  var SPRAVKA_GIRBO = '/nalogi/net-otchetnosti-v-otkrytyh-dannyh/';
  function bank(c) { return /^64\.1(\.|\d|$)/.test(String((c || {}).okved || '')); }
  function ip(r) { return String(((r || {}).company || {}).inn || '').length === 12; }

  // ---- отчётность: последний год выручки и прибыли (ГИР БО), без запроса к сети ----
  function otchetnost(r) {
    var D = (r && r.dossier) || {}, ch = D.charts || {}, kpi = Array.isArray(D.kpi) ? D.kpi : [];
    var v = poslednij(ch.revenue), p = null;
    if (!v) kpi.forEach(function (k) {
      var m = /^Выручка за (\d{4})$/.exec((k && k.label) || '');
      if (m && k.value != null && isFinite(k.value)) v = { year: +m[1], value: Number(k.value) };
    });
    if (!v) return null;
    (Array.isArray(ch.profit) ? ch.profit : []).forEach(function (x) { if (x && +x.year === v.year && x.value != null && isFinite(Number(x.value))) p = Number(x.value); });
    if (p === null) kpi.forEach(function (k) {
      if (k && k.label === 'Чистая прибыль за ' + v.year && k.value != null && isFinite(k.value)) p = Number(k.value);
    });
    return { god: v.year, vyruchka: v.value, pribyl: p };
  }

  // ---- staraya-otchetnost-v1 [команда] 10.10 (ТЗ [команда] 10.10 01:40, разд. 2.2 и 3 п. Б): последняя открытая отчётность
  // старше (год проверки по Москве − 2) — показываем её как «последнюю открытую», а не как текущую. Живой ответ 10.10:
  // у крупной торговой сети — «Выручка за 2021» рядом с «проверено 10.10.2026», строки о 2022–2025 не было.
  // Последний год — наибольший по всем рядам ГИР БО ответа (выручка, прибыль, налог, баланс, расчёты, KPI «за ГГГГ»).
  // Нет ни одного года — null (это другой случай: «Нет в ответе ГИР БО»). Причину не пишем — её не знаем, только факт.
  // Та же функция — в js/sushchestvennoe.js, js/dinamika.js, js/pasport-kontragenta.js (tests/staraya_otchetnost.test.js сверяет).
  function poslGodOtchetnosti(r) {
    var D = (r && r.dossier) || {}, ch = D.charts || {}, g = null;
    function vz(y) { y = parseInt(y, 10); if (isFinite(y) && y > 1990 && y < 2200 && (g === null || y > g)) g = y; }
    ['revenue', 'profit', 'income_tax'].forEach(function (k) {
      (Array.isArray(ch[k]) ? ch[k] : []).forEach(function (x) { if (x && x.value != null && x.value !== '' && isFinite(Number(x.value))) vz(x.year); });
    });
    ['balance', 'debts'].forEach(function (k) { if (ch[k] && typeof ch[k] === 'object' && !Array.isArray(ch[k])) vz(ch[k].year); });
    (Array.isArray(D.kpi) ? D.kpi : []).forEach(function (k) {
      var m = /за (\d{4})$/.exec((k && k.label) || '');
      if (m && k.value != null && isFinite(Number(k.value))) vz(m[1]);
    });
    return g;
  }
  function godProverki(r, segodnya) {
    var t = Date.parse((r && r.checked_at) || '');
    var ms = isFinite(t) ? t : (segodnya || new Date()).getTime();
    return new Date(ms + 3 * 3600 * 1000).getUTCFullYear();
  }
  // → { god, tekst } | null
  function staraya(r, segodnya) {
    var g = poslGodOtchetnosti(r);
    if (g === null || g >= godProverki(r, segodnya) - 2) return null;
    return { god: g, tekst: 'Последняя открытая отчётность — за' + NB + g + NB + 'год. Более свежей в' + NB + 'открытых данных ГИР' + NB + 'БО нет — запросите отчётность у' + NB + 'компании.' };
  }
  // ---- год сданной отчётности без выручки (otchet-bez-vyruchki-v1 [команда] 05.10) ----
  // Живой ответ (ООО, 16 лет): dossier.charts.revenue пуст, «Выручка за 2025» = null, но прибыль и баланс за 2025 есть.
  // Экран писал «Бухотчётность · Нет в ответе ГИР БО» рядом с «Собственным капиталом на 31.12.2025» из того же ГИР БО.
  // Отчёт есть, если есть баланс с годом или ненулевая чистая прибыль за год (0 — чаще пустая строка, чем факт).
  function godBezVyruchki(r) {
    var D = (r && r.dossier) || {}, ch = D.charts || {}, g = null;
    function vzyat(y) { y = parseInt(y, 10); if (isFinite(y) && y > 1990 && (g === null || y > g)) g = y; }
    if (ch.balance && typeof ch.balance === 'object') vzyat(ch.balance.year);
    (Array.isArray(ch.profit) ? ch.profit : []).forEach(function (x) {
      if (x && x.value != null && x.value !== '' && isFinite(Number(x.value)) && Number(x.value) !== 0) vzyat(x.year);
    });
    (Array.isArray(D.kpi) ? D.kpi : []).forEach(function (k) {
      var m = /^Чистая прибыль за (\d{4})$/.exec((k && k.label) || '');
      if (m && k.value != null && isFinite(k.value) && Number(k.value) !== 0) vzyat(m[1]);
    });
    if (g === null) return null;
    var p = null;
    (Array.isArray(ch.profit) ? ch.profit : []).forEach(function (x) { if (x && +x.year === g && x.value != null && isFinite(Number(x.value))) p = Number(x.value); });
    if (p === null) (Array.isArray(D.kpi) ? D.kpi : []).forEach(function (k) {
      if (k && k.label === 'Чистая прибыль за ' + g && k.value != null && isFinite(k.value)) p = Number(k.value);
    });
    return { god: g, pribyl: p };
  }
  // Год сданного отчёта — для «Условий сделки» (predel-bez-vyruchki-v1 [команда] 05.10, ТЗ [команда] 05.10 разд. 1):
  // тот же признак, что у строки «Выручка за … · В отчёте не указана», чтобы экран не расходился сам с собой.
  function otchetGod(r) { var b = godBezVyruchki(r); return b ? b.god : null; }

  // ---- собственный капитал: dossier.charts.balance (ГИР БО, строка 1300), без запроса к сети ----
  function kapital(r) {
    var b = r && r.dossier && r.dossier.charts && r.dossier.charts.balance;
    if (!b || typeof b !== 'object') return null;
    var g = parseInt(b.year, 10), e = b.equity;
    if (!isFinite(g) || e === null || e === '' || typeof e === 'boolean' || !isFinite(Number(e))) return null;
    return { god: g, znach: Number(e) };
  }

  // ---- текущая ликвидность: строка раздела досье «Финансовая динамика по годам» (оборотные активы / краткосрочные
  // обязательства, ГИР БО), год — из dossier.charts.balance или charts.debts. Нет года — нет факта (у факта всегда дата).
  function likvidnost(r) {
    var D = (r && r.dossier) || {}, ch = D.charts || {}, v = null;
    (Array.isArray(D.sections) ? D.sections : []).forEach(function (s) {
      if (!s || s.id !== 'dynamics' || !Array.isArray(s.rows)) return;
      s.rows.forEach(function (row) {
        if (!Array.isArray(row) || !/^Текущая ликвидность$/i.test(String(row[0] || '').trim())) return;
        var m = /^\s*(\d+(?:[.,]\d+)?)\s*$/.exec(String(row[1] == null ? '' : row[1]));
        if (m) v = Number(m[1].replace(',', '.'));
      });
    });
    var g = parseInt(((ch.balance || {}).year) || ((ch.debts || {}).year), 10);
    if (v === null || !isFinite(v) || !isFinite(g)) return null;
    return { god: g, znach: v };
  }

  // ---- убытки подряд: dossier.charts.profit (ГИР БО, чистая прибыль по годам), без запроса к сети ----
  // Серия считается от последнего года ряда назад, только по соседним годам (пропуск года рвёт серию: «не знаем» ≠ «убыток»).
  // Ноль — не убыток. Факт — только при 2 годах и больше: один убыточный год уже виден в строке «Выручка за …».
  // → { god: последний год, n: лет подряд, ot: первый год серии } | null
  function ubytki(r) {
    var ch = (r && r.dossier && r.dossier.charts) || {}, po = {};
    (Array.isArray(ch.profit) ? ch.profit : []).forEach(function (x) {
      var g = x ? parseInt(x.year, 10) : NaN;
      if (isFinite(g) && x.value !== null && x.value !== '' && typeof x.value !== 'boolean' && isFinite(Number(x.value))) po[g] = Number(x.value);
    });
    var gody = Object.keys(po).map(Number).sort(function (a, b) { return a - b; });
    if (!gody.length) return null;
    var g1 = gody[gody.length - 1], n = 0;
    while (po.hasOwnProperty(g1 - n) && po[g1 - n] < 0) n++;
    return n >= 2 ? { god: g1, n: n, ot: g1 - n + 1 } : null;
  }
  // ---- skachok-fakty-v1 [команда] 10.10: «Скачок в отчётности» — в существенные факты ТОЛЬКО падение ----
  // Расчёт один на весь экран — Dinamika.skachok (js/dinamika.js, skachok-v1): выручка за соседние годы (база от 1 млн ₽)
  // или KPI «Активы» за последний год −50 % и больше. Рост в факты не выносим: решения о предоплате он не меняет,
  // он виден в «Динамике» с оговоркой о причинах. Нет модуля «Динамики» — нет строки (без своего второго расчёта).
  function modDinamika(opt) {
    if (opt && opt.Dinamika) return opt.Dinamika;
    if (typeof self !== 'undefined' && self.Dinamika) return self.Dinamika;
    if (typeof module === 'object' && module.exports && typeof require === 'function') { try { return require('./dinamika.js'); } catch (e) { return null; } }
    return null;
  }
  function skachokVniz(r, opt) {
    var D = modDinamika(opt), s = D && typeof D.skachok === 'function' ? D.skachok(r) : null;
    if (!s) return null;
    var vniz = (s.fakty || []).filter(function (f) { return f && f.kRaz <= 0.5; });
    if (!vniz.length) return null;
    var god = vniz.reduce(function (g, f) { return f.god > g ? f.god : g; }, 0);
    return { god: god || null, tekst: vniz.map(function (f) { return f.tekst; }).join(' ') };
  }

  function godySerii(u) { return u.n === 2 ? u.ot + ' и ' + u.god : u.ot + '–' + u.god; }

  // ---- существенные факты ----
  // tipografika-proverka-v1 (05.10): сумма в строке факта — с разрядами, как во всём экране: «2000000 ₽» → «2 000 000 ₽».
  // Только целое из 5+ цифр прямо перед «₽» (не часть дроби, не номер документа); остальной текст строки не трогаем.
  function razryady(t) {
    return String(t == null ? '' : t).replace(/(^|[^\d,.\u2116])(\d{5,})(?=[ \u00a0]?₽)/g, function (_, a, d) {
      return a + d.replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    });
  }

  function fakty(r, opt) {
    opt = opt || {};
    if (!r || !r.company) return { spisok: [], eshche: [], neProvereno: [] };
    var c = r.company, fl = ip(r), reestr = fl ? 'ЕГРИП' : 'ЕГРЮЛ';
    // дата проверки — по Москве (UTC+3), как на экране
    var t = Date.parse(r.checked_at || ''), msk = new Date((isFinite(t) ? t : (opt.segodnya || new Date()).getTime()) + 3 * 3600 * 1000);
    var na = new Date(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate());
    var dataPr = z(msk.getUTCDate()) + '.' + z(msk.getUTCMonth() + 1) + '.' + msk.getUTCFullYear();
    var vse = [], est = {};
    function add(f) { if (f && !est[f.k]) { est[f.k] = 1; vse.push(f); } }

    (r.signals || []).forEach(function (s, i) {
      if (!s || !s.title) return;
      var k = s.id || ('sig' + i), znach = razryady(s.detail || '');
      var ist = s.source ? String(s.source).replace('ЕГРЮЛ/ЕГРИП', reestr) : reestr;
      if (k === 'age' && c.reg_date) {
        var m = mesyacev(dataIz(c.reg_date), na);
        if (m != null) znach = srok(m) + ' · с' + NB + dmy(c.reg_date);
      }
      if (k === 'address' && fl) return; // у ИП адрес — место жительства
      if (k === 'address' && s.status === 'ok' && /^Отметок о недостоверности нет$/.test(znach)) znach = 'Нет';
      var tn = ton(s.status);
      // [команда] 02.10: не «Нет», а «Нет в списке ФНС на [дата]»; набор старше 3 месяцев — как непроверенный
      if (k === 'tax_debt' && s.status === 'ok' && /^нет$/i.test(String(znach).trim())) {
        var dn = dataIz(dmy(s.as_of)), mn = dn ? mesyacev(dn, na) : null;
        if (!dn) { znach = 'Не проверяли — нет даты набора ФНС'; tn = 'neutral'; }
        else if (mn > 3 || (mn === 3 && na.getDate() > dn.getDate())) { znach = 'Не проверяли — набор ФНС на' + NB + dmy(s.as_of) + ' старше 3' + NB + 'месяцев'; tn = 'neutral'; }
        else znach = 'Нет в списке ФНС на' + NB + dmy(s.as_of);
      }
      var f = { k: k, nazv: NAZV[k] || s.title, znach: znach, ton: tn, ist: ist, data: dmy(s.as_of) || dataPr };
      // справочник «Коды статуса компании в ЕГРЮЛ» (/nalogi/kody-statusa-egryul/, приказ ФНС ММВ-7-6/433@, СЮЛСТ):
      // есть код состояния (company.state_code, API status-kody) — ссылка на его строку; кода нет, а статус не «норма» — на страницу.
      // У ИП — нет: справочник только для юрлиц.
      if (k === 'status' && !fl) {
        var kd = String(c.state_code == null ? '' : c.state_code).trim();
        if (/^\d{3}$/.test(kd)) { f.spravka = SPRAVKA_STATUSY + '#k' + kd; f.spravkaT = 'что значит код' + NB + kd; }
        else if (s.status && s.status !== 'ok') { f.spravka = SPRAVKA_STATUSY; f.spravkaT = 'что значат коды статуса'; }
      }
      add(f);
    });

    var o = otchetnost(r), st = fl ? null : staraya(r, opt.segodnya);
    // строка отчётности за старый год: «· последняя открытая», тон «внимание» (поднимается к замечаниям) и подстрочник-факт
    function starayaFakt(f, s) {
      if (!s) return f;
      f.nazv += ' · последняя открытая'; f.ton = 'warn'; f.pod = s.tekst.replace(/^.*?год\. /, ''); // год уже в названии строки — подстрочник без повтора
      f.spravka = SPRAVKA_GIRBO; f.spravkaT = 'почему так бывает'; f.spravkaCel = 'girbo_pochemu';
      return f;
    }
    if (!fl) {
      if (o) {
        var pr = o.pribyl == null ? '' : o.pribyl < 0 ? ' · убыток ' + dengi(-o.pribyl) : ' · прибыль ' + dengi(o.pribyl);
        add(starayaFakt({ k: 'otchetnost', nazv: 'Выручка за ' + o.god, znach: dengi(o.vyruchka) + pr, ton: 'neutral', ist: 'ГИР БО ФНС', data: '31.12.' + o.god }, st));
      } else if (bank(c)) {
        // банк сдаёт отчётность в Банк России; в ГИР БО её передаёт Банк России (ч. 9 ст. 18 402-ФЗ), доступ может быть
        // ограничен (ч. 12; v1.1 — [команда] 04.10 12:30 разд. 1). Есть она в ответе — считаем как у всех (ветка выше); нет — пишем, как устроено, без «её нет».
        // Текст — [команда] 04.10 11:30 разд. 1.4 дословно.
        add({ k: 'otchetnost', nazv: 'Бухотчётность', znach: BANK_GIRBO, ton: 'neutral',
          ist: reestr + ', ОКВЭД ' + c.okved, data: dataPr, ssylka: CBR_BANK + (/^\d{13}$/.test(String(c.ogrn || '')) ? '?ogrn=' + c.ogrn : '') });
      } else if (godBezVyruchki(r)) {
        // Отчёт за год сдан, а выручки в нём нет (0 или строка 2110 не заполнена) — пишем это, а не «нет в ответе ГИР БО».
        var bv = godBezVyruchki(r);
        var pv = bv.pribyl == null || bv.pribyl === 0 ? '' : bv.pribyl < 0 ? ' · убыток ' + dengi(-bv.pribyl) : ' · прибыль ' + dengi(bv.pribyl);
        add(starayaFakt({ k: 'otchetnost', nazv: 'Выручка за ' + bv.god, znach: 'В' + NB + 'отчёте не' + NB + 'указана' + pv, ton: 'neutral',
          ist: 'ГИР БО ФНС', data: '31.12.' + bv.god }, st));
      } else {
        // «Почему так бывает» — статья о законных причинах (net-otchetnosti-v1, ТЗ [команда] 04.10 10:50 разд. 2):
        // пустое место у крупного поставщика ≠ «техническая» компания. Цель Метрики — girbo_pochemu.
        add({ k: 'otchetnost', nazv: 'Бухотчётность', znach: 'Нет в ответе ГИР БО', ton: 'neutral', ist: 'ГИР БО ФНС', data: dataPr,
          spravka: SPRAVKA_GIRBO, spravkaT: 'почему так бывает', spravkaCel: 'girbo_pochemu' });
      }
      // Собственный капитал (строка 1300 баланса) меньше нуля — обязательства больше активов. Показываем только минус:
      // плюс решения не меняет, а нулевая или пустая строка — не факт. У банков в ГИР БО баланса нет — сюда не попадут.
      var kp = kapital(r);
      if (kp && kp.znach < 0) add({ k: 'kapital', nazv: 'Собственный капитал на' + NB + '31.12.' + kp.god, ton: 'warn',
        znach: 'Минус ' + dengi(-kp.znach) + ': обязательства больше активов', ist: 'ГИР БО ФНС, баланс', data: '31.12.' + kp.god });
      // Текущая ликвидность меньше 1 — краткосрочные обязательства больше оборотных активов: при предоплате это прямой
      // вопрос «хватит ли им денег поставить товар». 1 и выше — решения не меняет, в факты не выносим (есть в «Всех данных»).
      // Ноль — чаще пустая строка баланса, чем факт: не показываем.
      var lk = likvidnost(r);
      if (lk && lk.znach > 0 && lk.znach < 1) add({ k: 'likvidnost', nazv: 'Текущая ликвидность', ton: 'warn',
        znach: chislo(lk.znach, 2) + ': краткосрочные долги больше оборотных средств', ist: 'ГИР БО ФНС, баланс', data: '31.12.' + lk.god });
      // Убыток 2 года подряд и больше — по годовой отчётности; сам по себе минус одного года решения не меняет.
      var ub = ubytki(r);
      if (ub) add({ k: 'ubytki', nazv: 'Убыток ' + ub.n + NB + skl(ub.n, 'год', 'года', 'лет') + ' подряд', ton: 'warn',
        znach: 'По годовой отчётности за ' + godySerii(ub), ist: 'ГИР БО ФНС, отчёт о финансовых результатах', data: '31.12.' + ub.god });
      // Скачок вниз: выручка или активы за последний год упали вдвое и больше — вопрос до аванса (текст skachok-v1).
      var sk = skachokVniz(r, opt);
      if (sk) add({ k: 'skachok', nazv: 'Скачок в' + NB + 'отчётности', ton: 'warn', znach: sk.tekst,
        pod: 'Перед авансом спросите компанию, что изменилось.', ist: 'ГИР БО ФНС', data: sk.god ? '31.12.' + sk.god : dataPr });
      var estRuk = (r.signals || []).some(function (s) { return s && /director|rukovod/i.test(s.id || ''); });
      var ot = dataIz(c.director_since);
      if (!estRuk && ot) {
        var mr = mesyacev(ot, na);
        // upravlyayushchaya-v1: полномочия руководителя у другой компании — так и называем строку
        if (mr != null) add({ k: 'rukovoditel', nazv: c.director_org ? 'Управляющая организация' : 'Руководитель', ton: mr < 6 ? 'warn' : 'ok',
          znach: (c.director_org ? (mr < 12 ? 'Сменилась ' + srok(mr) + ' назад' : 'Не менялась ' + srok(mr))
            : (mr < 12 ? 'Сменился ' + srok(mr) + ' назад' : 'Не менялся ' + srok(mr))) + ' · с' + NB + dmy(c.director_since),
          ist: 'ЕГРЮЛ', data: dataPr });
      }
    }
    if (r.zsk && r.zsk.title) {
      var zl = r.zsk.level;
      add({ k: 'zsk', nazv: 'Прогноз ЗСК · наша оценка, не статус Банка России', znach: r.zsk.title,
        ton: zl === 'high' ? 'bad' : zl === 'medium' ? 'warn' : 'ok', ist: 'Делоскоп по открытым данным', data: dataPr, ssylka: r.zsk.cbr_url || '' });
    }

    vse.sort(function (a, b) {
      var d = VES[a.ton] - VES[b.ton];
      if (d) return d;
      // незнакомый признак API с замечанием (bad/warn) — раньше базовых: его могли добавить как новый риск;
      // без замечаний (ok/neutral) — после базовых: «всё хорошо» по новому признаку решения не меняет и не должно вытеснять статус или ЗСК
      var nz = a.ton === 'bad' || a.ton === 'warn' ? -1 : PORYADOK.length;
      var pa = PORYADOK.indexOf(a.k), pb = PORYADOK.indexOf(b.k);
      return (pa < 0 ? nz : pa) - (pb < 0 ? nz : pb);
    });

    var ne = [];
    var dm = r.damia || {};
    DAMIA_PORYADOK.concat(Object.keys(dm).filter(function (k) { return DAMIA_PORYADOK.indexOf(k) < 0; })).forEach(function (k) {
      var b = dm[k];
      if (!b || typeof b !== 'object' || !b.nazvanie || !b.status) return;
      if (b.status === 'found' && b.dubl_statusa && (r.company || {}).status === 'BANKRUPT') {
        // istochniki-v1: банкротство из ЕГРЮЛ — строка «Статус» уже говорит об этом; второй раз не пишем (в «Все данные» — есть)
      } else if (b.status === 'found') {
        add({ k: 'damia_' + k, nazv: b.nazvanie, znach: bezDaty(b.itog, b.data_svedeniy) || b.znachenie || 'Сведения найдены',
          ton: b.uroven === 'bad' || b.uroven === 'high' ? 'bad' : 'warn', ist: b.istochnik || '', data: dmy(b.data_svedeniy) || dataPr });
        var f = vse.pop(); // найденное — среди первых
        var i = 0; while (i < vse.length && VES[vse[i].ton] <= VES[f.ton]) i++;
        vse.splice(i, 0, f);
      } else if (b.status !== 'not_found' && b.status !== 'not_applicable') {
        ne.push({ k: k, nazv: b.nazvanie, kratko: KRATKO[k] || b.nazvanie, prichina: prichinaReestra(b), sam: b.proverit_samim || '', nep: b.sostoyanie === 'not_checked' });
      }
    });
    return { spisok: vse.slice(0, MAKS), eshche: vse.slice(MAKS), neProvereno: ne, dataPr: dataPr };
  }

  // ---- вся глубина: разделы досье, внешние реестры, из чего сложился прогноз ЗСК ----
  var LICHNOE = /адрес|паспорт|рожден|снилс|телефон|почт/i;
  function glubina(r, f) {
    f = f || fakty(r);
    var D = (r && r.dossier) || {}, fl = ip(r), reestr = fl ? 'ЕГРИП' : 'ЕГРЮЛ', out = [];
    if (f.eshche.length) out.push({ zag: 'Ещё признаки', ist: 'по ответу проверки на ' + f.dataPr,
      stroki: f.eshche.map(function (x) { return [x.nazv, x.znach, x.ton]; }) });
    (Array.isArray(D.sections) ? D.sections : []).forEach(function (s) {
      if (!s || !s.title || !Array.isArray(s.rows)) return;
      var ist = SEKCII[s.id] === 'reestr' ? reestr + ', на ' + f.dataPr : (SEKCII[s.id] || '');
      var st = [];
      s.rows.forEach(function (row) {
        if (!Array.isArray(row) || row.length < 2) return;
        var k = String(row[0]), v = String(row[1] == null ? '' : row[1]);
        if (k === 'Источник') { ist = v; return; }
        if (fl && (LICHNOE.test(k) || s.id === 'management')) return;
        if (v) st.push([k, v]);
      });
      if (st.length) out.push({ zag: s.title, ist: ist, stroki: st });
    });
    var dm = r && r.damia || {}, reestry = [];
    DAMIA_PORYADOK.concat(Object.keys(dm).filter(function (k) { return DAMIA_PORYADOK.indexOf(k) < 0; })).forEach(function (k) {
      var b = dm[k];
      if (!b || typeof b !== 'object' || !b.nazvanie || !b.status) return;
      var v, t = 'neutral';
      if (b.status === 'found') { v = b.itog || b.znachenie || 'Сведения найдены'; t = b.uroven === 'bad' || b.uroven === 'high' ? 'bad' : 'warn'; }
      else if (b.status === 'not_found') { v = (b.itog || 'Сведений не найдено') + (b.data_svedeniy ? ' · на ' + dmy(b.data_svedeniy) : ''); t = 'ok'; }
      else if (b.status === 'not_applicable') v = b.prichina || 'Не применяется к этой компании';
      else if (b.sostoyanie === 'not_checked') v = 'Не проверяли: ' + prichinaReestra(b);
      else v = 'Не ответили в' + NB + 'этот раз' + (prichinaReestra(b) ? ': ' + prichinaReestra(b) : '');
      // istochniki-v1: банкротство из ЕГРЮЛ — ссылка на ЕФРСБ остаётся (сообщения ЕФРСБ мы не проверяли);
      // приставы, сопоставленные по названию и адресу (в наборе ФССП нет ИНН), — тоже со ссылкой и пометкой точности
      var nePoInn = b.tochnost && b.tochnost !== 'inn';
      if (nePoInn && (b.status === 'found' || b.status === 'not_found')) v += ' · сопоставили по' + NB + 'названию и' + NB + 'адресу';
      reestry.push([b.nazvanie, v, t, (b.status !== 'found' && b.status !== 'not_found') || b.iz_egryul || nePoInn ? (b.proverit_samim || '') : '', b.istochnik || '']);
    });
    if (reestry.length) out.push({ zag: 'Внешние реестры', ist: 'источник — у каждой строки', stroki: reestry });
    var z = r && r.zsk;
    if (z && Array.isArray(z.groups) && z.groups.length) {
      out.push({ zag: 'Из чего сложился прогноз ЗСК', ist: 'Делоскоп по открытым данным; не статус Банка России',
        stroki: z.groups.filter(function (g) { return g && g.typology; }).map(function (g) {
          return [g.typology, (Array.isArray(g.items) ? g.items : []).join('; ')];
        }) });
    }
    return { razdely: out, daty: D.data_dates ? String(D.data_dates) : '' };
  }

  // otchet-detali-v1: подпись ссылки на первоисточник называет его (js/istochniki.js → samiTekst); нет модуля — как было
  function samiT(url) {
    var I = typeof self !== 'undefined' && self.DlkIstochniki;
    try { return I && I.samiTekst ? I.samiTekst(url) : 'проверьте сами'; } catch (e) { return 'проверьте сами'; }
  }
  // otchet-detali-v1: дата сведений уже стоит в подписи строки («Картотека … · на 12.10.2026») — хвост «Сведения на 12.10.2026, 11:40.»
  // в тексте факта второй раз не повторяем (только если дата та же; в «Все данные из реестров» текст — полностью)
  function bezDaty(t, iso) {
    if (!t) return t;
    var d = dmy(iso);
    if (!d) return t;
    var x = String(t).replace(new RegExp('\\s*Сведения на\\s+' + d.replace(/\./g, '\\.') + '(?:,\\s*\\d{1,2}:\\d{2})?\\.?\\s*$'), '');
    return x || t;
  }

  // ---- разметка ----
  function rowHtml(x) {
    var meta = [x.ist, x.data ? 'на' + NB + x.data : ''].filter(Boolean).join(' · ');
    return '<div class="row sut__r" data-fakt="' + esc(x.k) + '"><span>' + esc(x.nazv) +
      '<small>' + esc(meta) + (x.ssylka ? ' · <a href="' + esc(x.ssylka) + '" target="_blank" rel="noopener">проверить в' + NB + 'ЦБ</a>' : '') +
      (x.spravka ? ' · <a href="' + esc(x.spravka) + '" data-goal="' + esc(x.spravkaCel || 'statusy_iz_proverki') + '">' + esc(x.spravkaT) + '</a>' : '') + '</small>' +
      (x.pod ? '<small class="sut__pod">' + esc(x.pod) + '</small>' : '') + '</span>' +
      '<b class="d ' + x.ton + '">' + nwFz(esc(x.znach)) + '</b></div>';
  }
  function glubinaHtml(g, podpis, dop) {
    if (!g.razdely.length) return '';
    var n = g.razdely.length;
    return '<details class="sut__g"><summary><span>Все данные из реестров</span><small>' + (podpis || n + NB + skl(n, 'раздел', 'раздела', 'разделов')) + '</small></summary>' + (dop || '') +
      g.razdely.map(function (s) {
        return '<section class="sut__s"><h4>' + esc(s.zag) + '</h4><dl>' + s.stroki.map(function (row) {
          var dop = row[4] ? '<small>' + esc(row[4]) + '</small>' : '';
          var sam = row[3] ? ' <a href="' + esc(row[3]) + '" target="_blank" rel="noopener">' + esc(samiT(row[3])) + '</a>' : '';
          return '<div><dt>' + esc(row[0]) + dop + '</dt><dd' + (row[2] && row[2] !== 'neutral' ? ' class="' + row[2] + '"' : '') + '>' + esc(row[1]) + sam + '</dd></div>';
        }).join('') + '</dl>' + (s.ist ? '<p>Источник: ' + esc(s.ist) + '</p>' : '') + '</section>';
      }).join('') +
      (g.daty ? '<p class="sut__d">Даты наборов: ' + esc(g.daty) + '</p>' : '') + '</details>';
  }
  // «Не проверяли» по причине ([команда] 11.10, разд. 2): «в этот раз» — только о сбое или лимите.
  // Все — «пока не проверяем» (API: sostoyanie = not_checked) → «Не проверяли: …»; все — не ответили → «Не ответили в этот раз: …»;
  // причины разные → две строки: «Пока не проверяем: …» и «Не ответили в этот раз: …».
  // ne-povtor-v1 [команда] 11.10: uzhe — ключи реестров, которые уже названы в выводе «Условий сделки» (Usloviya.vVyvode):
  // их не повторяем, остальное — «Кроме того, …»; названы все — строки нет (ссылки «проверьте сами» остаются в глубине).
  function neStroka(spisok, sPrichinoj, razdel, uzhe) {
    var bylo = spisok.length;
    if (uzhe && uzhe.length) spisok = spisok.filter(function (x) { return uzhe.indexOf(x.k) < 0; });
    if (!spisok.length) return '';
    function chast(xs) {
      var pr = xs.map(function (x) { return x.prichina; });
      var odna = sPrichinoj && pr[0] && pr.every(function (x) { return x === pr[0]; }) ? ' — ' + pr[0] : '';
      return esc(xs.map(function (x) { return x.kratko; }).join(', ') + odna);
    }
    var poka = spisok.filter(function (x) { return x.nep; }), net = spisok.filter(function (x) { return !x.nep; });
    var t = !net.length ? 'Не проверяли: ' + chast(poka) + '.'
      : !poka.length ? 'Не ответили в' + NB + 'этот раз: ' + chast(net) + '.'
      : 'Пока не проверяем: ' + chast(poka) + '. Не ответили в' + NB + 'этот раз: ' + chast(net) + '.';
    if (spisok.length < bylo) t = 'Кроме того, ' + t.charAt(0).toLowerCase() + t.slice(1);
    return '<p class="sut__ne">' + t + ' Не проверено — не значит «не обнаружено»; ссылки, где проверить самим, — в разделе «' + razdel + '».</p>';
  }
  function html(r, opt) {
    var f = fakty(r);
    if (!f.spisok.length) return '';
    var ne = neStroka(f.neProvereno, true, 'Все данные из реестров', opt && opt.uzhe);
    return '<div class="sut__h"><b>Существенные факты</b><span>' + (f.eshche.length ? 'ещё ' + f.eshche.length + ' — в' + NB + 'разделе «Все данные из реестров»' : 'у каждого — источник и дата') + '</span></div>' +
      f.spisok.map(rowHtml).join('') + ne + glubinaHtml(glubina(r, f));
  }

  // ---- Щит (своя компания): разбор «глазами банка и налоговой» — главное, строки проверки — свёрнуто ----
  // Те же признаки, что в разборе, не повторяем открытыми строками: всё — в одном свёрнутом разделе,
  // первым — «Признаки из проверки» (у каждого источник и дата), дальше — разделы досье и внешние реестры.
  function htmlSvoj(r) {
    var f = fakty(r);
    var vse = f.spisok.concat(f.eshche);
    if (!vse.length) return '';
    var g = glubina(r, f);
    var prizn = { zag: 'Признаки из проверки', ist: '',
      stroki: vse.map(function (x) {
        return [x.nazv, x.znach, x.ton, x.ssylka || '', [x.ist, x.data ? 'на' + NB + x.data : ''].filter(Boolean).join(' · ')];
      }) };
    var razdely = [prizn].concat(g.razdely.filter(function (s) { return s.zag !== 'Ещё признаки'; }));
    var n = vse.length, m = razdely.length;
    var ne = neStroka(f.neProvereno, false, 'Внешние реестры');
    return glubinaHtml({ razdely: razdely, daty: g.daty },
      n + NB + skl(n, 'признак', 'признака', 'признаков') + ' · ' + m + NB + skl(m, 'раздел', 'раздела', 'разделов'), ne);
  }

  var CSS = '.sut__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px;padding-bottom:10px}' +
    '.sut__h b{font-size:15px;font-weight:600}.sut__h span{font-size:13px;color:var(--muted,#6B6B70)}' +
    '.sut__r>span{display:block}.sut__r small{display:block;margin-top:2px;font-size:12px;color:var(--muted,#6B6B70);font-weight:400}' +
    '.sut__r small a{color:inherit;text-decoration:underline}.sut__r small.sut__pod{color:var(--warn,#8A5A00)}' +
    '.sut__ne{margin:0;padding:12px 0 0;border-top:1px solid #EFEFEA;font-size:13px;color:var(--ink2,#48484C)}' +
    '.sut__g{margin-top:12px;border:1px solid var(--line,#E6E6E1);border-radius:16px;padding:0 16px}' +
    '.sut__g summary{cursor:pointer;display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:14px 0;font-size:15px;font-weight:600;list-style:none}' +
    '.sut__g summary::-webkit-details-marker{display:none}' +
    '.sut__g summary span::after{content:"";display:inline-block;width:7px;height:7px;margin-left:10px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-3px) rotate(45deg);transition:transform .2s}' +
    '.sut__g[open] summary span::after{transform:translateY(0) rotate(225deg)}' +
    '.sut__g summary small{font-size:13px;font-weight:400;color:var(--muted,#6B6B70)}' +
    '.sut__s{padding:4px 0 14px;border-top:1px solid #EFEFEA}.sut__s h4{margin:12px 0 6px;font-size:15px;font-weight:600}' +
    '.sut__s dl{margin:0;display:grid}.sut__s dl div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:12px;padding:6px 0;font-size:15px}' +
    '.sut__s dt{color:var(--ink2,#48484C);display:grid}.sut__s dt small{font-size:12px;color:var(--muted,#6B6B70)}.sut__s dd{margin:0;overflow-wrap:anywhere}' +
    '.sut__s dd.ok{color:var(--ok,#16723F)}.sut__s dd.warn{color:var(--warn,#8A5A00)}.sut__s dd.bad{color:#B3261E}' +
    '.sut--svoj .sut__g{margin-top:0}.sut--svoj .sut__ne{border-top:1px solid #EFEFEA;padding:12px 0}' +
    '.sut__s p,.sut__d{margin:6px 0 0;font-size:12px;color:var(--muted,#6B6B70)}.sut__d{padding-bottom:14px}' +
    '@media (max-width:520px){.sut__s dl div{grid-template-columns:1fr;gap:2px}.sut__r{flex-direction:column;gap:4px}.sut__r b.d{text-align:left;max-width:none}}' +
    '@media print{.sut__g{border:0}.sut__g:not([open])>*:not(summary){display:block}}';

  function stil(doc) {
    if (!doc || doc.getElementById('sut-css')) return;
    var s = doc.createElement('style'); s.id = 'sut-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Браузер: заменяет строки светофора в быстром отчёте на существенные факты + свёрнутую глубину.
  // Ошибка или пустой ответ — строки остаются как были.
  function mount(el, r, opt) {
    if (!el) return false;
    var h = '';
    try { h = html(r, opt); } catch (e) { h = ''; }
    if (!h) return false;
    try { stil(el.ownerDocument || document); } catch (e) {}
    el.innerHTML = h;
    el.classList.add('sut');
    // порядок экрана (эталон 02.10): факты → динамика → глубина. Есть блок «Динамика» (js/dinamika.js) — глубину ставим после него
    try {
      var g = el.querySelector('.sut__g'), din = el.parentNode && el.parentNode.querySelector('.din');
      if (g && din) din.parentNode.insertBefore(g, din.nextSibling);
    } catch (e) {}
    return true;
  }

  // Браузер, режим «Щит»: строки светофора сворачиваются в «Все данные из реестров» и встают после разбора (el = .rows).
  // Порядок: разбор Щита → «Что изменилось» и «Динамика» (js/dinamika.js) → свёрнутые данные. Ошибка или пустой ответ — строки остаются как были.
  function mountSvoj(el, r, posle) {
    if (!el) return false;
    var h = '';
    try { h = htmlSvoj(r); } catch (e) { h = ''; }
    if (!h) return false;
    try { stil(el.ownerDocument || document); } catch (e) {}
    el.innerHTML = h;
    el.classList.add('sut', 'sut--svoj');
    try {
      if (posle && posle.parentNode) {
        var par = el.parentNode, izm = par && par.querySelector(':scope > .izm'), din = par && par.querySelector('.din');
        posle.parentNode.insertBefore(el, posle.nextSibling);
        if (izm) posle.parentNode.insertBefore(izm, el);
        if (din) posle.parentNode.insertBefore(din, el);
      }
    } catch (e) {}
    return true;
  }

  return { prichinaReestra: prichinaReestra, POKA_NE: POKA_NE, razryady: razryady, fakty: fakty, godBezVyruchki: godBezVyruchki, otchetGod: otchetGod, bank: bank, kapital: kapital, likvidnost: likvidnost, ubytki: ubytki, skachokVniz: skachokVniz, glubina: glubina, otchetnost: otchetnost, poslGodOtchetnosti: poslGodOtchetnosti, staraya: staraya, html: html, mount: mount, htmlSvoj: htmlSvoj, mountSvoj: mountSvoj, dengi: dengi, srok: srok, MAKS: MAKS, CSS: CSS };
});
;
/* --- /js/kommentarii.js --- */
/* Делоскоп — «Комментарий команды Делоскопа» под строками светофора (решения команды 02.10).
 * Библиотека текстов — /data/kommentarii.json: id сигнала → по тону (zel / zhel / kras) три фразы:
 * что видит банк (115-ФЗ, ЗСК) · что видит налоговая (ст. 54.1 НК) · что сделать до оплаты, + норма.
 * Тексты пишет [команда]; на сайт выходит только тон со status «utverzhdeno», кем и когда проверен.
 * Нет утверждённого текста — блока нет совсем (без заглушек «скоро»).
 * Чистые функции najti/html — без DOM и сети; zagruzit/vstavit — браузерная часть. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Kommentarii = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TON = { ok: "zel", info: "zel", warn: "zhel", bad: "kras" };
  var MAKS = 300;

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (x) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x];
    });
  }
  function dataRu(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
    return m ? m[3] + "." + m[2] + "." + m[1] : "";
  }
  function dlina(t) { return ["bank", "nalog", "sdelat"].reduce(function (s, k) { return s + String(t[k] || "").length; }, 0); }

  // Тон годится для показа: утверждён, проверен (роль + дата), есть хотя бы «что сделать», укладывается в 300 знаков.
  function gotov(t) {
    return !!(t && t.status === "utverzhdeno" && t.proveril && dataRu(t.data_proverki) &&
      t.sdelat && (t.bank || t.nalog) && dlina(t) <= MAKS);
  }

  // Запись библиотеки для строки светофора: первое совпадение сверху вниз.
  // re — по заголовку строки; uslovie (необязательно) — ещё и по «заголовок · деталь»: так «Адрес» с
  // недостоверностью в детали получает текст о недостоверности, а неясный «Статус» — ничего.
  // kak — запись берёт тексты другой записи (один текст [команда] — несколько заголовков API).
  function rx(s) { try { return new RegExp(s, "i"); } catch (e) { return null; } }
  function zapis(sprav, signal) {
    var list = (sprav && sprav.signaly) || [];
    var title = String((signal && signal.title) || "");
    if (!title) return null;
    var vse = title + " · " + String((signal && signal.detail) || "");
    for (var i = 0; i < list.length; i++) {
      var re = rx(list[i].re);
      if (!re || !re.test(title)) continue;
      if (list[i].uslovie) { var u = rx(list[i].uslovie); if (!u || !u.test(vse)) continue; }
      if (!list[i].kak) return list[i];
      for (var j = 0; j < list.length; j++) if (list[j].id === list[i].kak && !list[j].kak) return list[j];
      return null;
    }
    return null;
  }

  // [команда] 02.10 08:20: зелёный текст — только если источник ответил («не проверяли ≠ не нашли»):
  // строка со статусом ok, и ни в заголовке, ни в детали нет признаков неответа источника.
  var NE_OTVETIL = /не\s*провер|недоступ|не\s*ответ|нет\s*ответа|нет\s*данных|нет\s*сведений|не\s*получ|ошибк|временно|не\s*удалось/i;
  function istochnikOtvetil(signal) {
    if (!signal || signal.status !== "ok") return false;
    return !NE_OTVETIL.test(String(signal.title || "") + " · " + String(signal.detail || ""));
  }

  // Готовый комментарий к строке светофора или null.
  function najti(sprav, signal) {
    var z = zapis(sprav, signal);
    var ton = TON[signal && signal.status];
    if (!z || !ton || !z.tony) return null;
    if (ton === "zel" && !istochnikOtvetil(signal)) return null;
    var t = z.tony[ton];
    if (!gotov(t)) return null;
    // uslovie у тона: тон только для своей детали (дисквалификация «Внимание» — совпадение лишь по ФИО, [команда] 02.10 21:25)
    if (t.uslovie) {
      var ut = rx(t.uslovie);
      if (!ut || !ut.test(String(signal.title || "") + " · " + String(signal.detail || ""))) return null;
    }
    // norma у тона (если задана, хоть пустой строкой) важнее нормы записи
    var norma = t.norma != null ? t.norma : z.norma;
    return { id: z.id, ton: ton, bank: t.bank || "", nalog: t.nalog || "", sdelat: t.sdelat,
      norma: norma || "", podpis: (sprav && sprav.podpis) || "Команда Делоскопа", data: dataRu(t.data_proverki) };
  }

  function html(k) {
    if (!k) return "";
    var str = function (l, t) { return t ? '<p><span class="kom__l">' + l + "</span> " + esc(t) + "</p>" : ""; };
    return '<div class="kom kom--' + esc(k.ton) + '" data-kom="' + esc(k.id) + '">' +
      '<div class="kom__h">Комментарий команды Делоскопа</div>' +
      str("Банк:", k.bank) + str("Налоговая:", k.nalog) + str("Что сделать:", k.sdelat) +
      '<div class="kom__p">' + esc(k.podpis) + (k.norma ? " · " + esc(k.norma) : "") + (k.data ? " · нормы сверены " + esc(k.data) : "") + "</div></div>";
  }

  // Номера норм («ст. 76 НК», «№ ММ-3-06/333@») не рвутся на переносе — общая обёртка шапки (js/shapka.js), если она есть.
  function nerazryv(uzel) {
    try { var w = typeof window !== "undefined" ? window : null; if (uzel && w && w.dlkNerazryv) w.dlkNerazryv.obernut(uzel); } catch (e) {}
  }

  // Браузер: библиотека загружается один раз; при ошибке — пусто (отчёт работает как раньше).
  var obeshchanie = null;
  function zagruzit(url) {
    if (!obeshchanie) {
      obeshchanie = (typeof fetch === "function" ? fetch(url || "/data/kommentarii.json", { cache: "no-cache" })
        .then(function (o) { return o.ok ? o.json() : null; }) : Promise.resolve(null))
        .catch(function () { return null; });
    }
    return obeshchanie;
  }

  // Под каждой строкой tr[data-sig=i] таблицы светофора — строка с комментарием, если он утверждён.
  function vstavit(tablica, signals, sprav) {
    if (!tablica || !sprav) return 0;
    var n = 0;
    (signals || []).forEach(function (s, i) {
      var k = najti(sprav, s);
      var tr = tablica.querySelector('tr[data-sig="' + i + '"]');
      if (!k || !tr || (tr.nextSibling && tr.nextSibling.className === "kom-tr")) return;
      var nov = tr.ownerDocument.createElement("tr");
      nov.className = "kom-tr";
      nov.innerHTML = '<td colspan="2">' + html(k) + "</td>";
      tr.parentNode.insertBefore(nov, tr.nextSibling);
      nerazryv(nov);
      n++;
    });
    // оговорка [команда] — один раз под таблицей, если в ней есть комментарий
    if (tablica.querySelector(".kom-tr") && tablica.parentNode && tablica.parentNode.querySelector) postavitOgovorku(tablica.parentNode, tablica, "p");
    return n;
  }

  // Паспорт контрагента: строки разделов (fakty) собраны из тех же строк светофора — заголовок строки = заголовок признака.
  // Чистая функция: [{ f: "razdel:i", k: комментарий }] для строк, к которым есть утверждённый текст.
  // Служебные и расчётные разделы (Итог, предел, что запросить, чего не знаем) — без комментариев.
  var BEZ = { predel: 1, zaprosit: 1, ne_znaem: 1, podlinnost: 1, indeks: 1 };
  var TON_FAKTA = { ok: "ok", warn: "warn", bad: "bad" };
  function dlyaFaktov(razdely, signals, sprav) {
    if (!sprav) return [];
    var vzyat = {}, out = [];
    (razdely || []).forEach(function (x) {
      if (!x || BEZ[x.id] || x.vid === "sluzhebnyj") return;
      (x.fakty || []).forEach(function (f, i) {
        var t = String((f && f.tekst) || "");
        if (!t) return;
        for (var j = 0; j < (signals || []).length; j++) {
          var s = signals[j];
          if (vzyat[j] || String((s && s.title) || "") !== t || TON_FAKTA[s.status] !== f.ton) continue;
          vzyat[j] = 1;
          var k = najti(sprav, s);
          if (k) out.push({ f: x.id + ":" + i, k: k });
          return;
        }
      });
    });
    return out;
  }

  // Браузер: под строкой tr[data-f] Паспорта — строка с комментарием (повторно не вставляет).
  function vstavitFakty(koren, spisok) {
    if (!koren || !spisok) return 0;
    var n = 0, posl = null;
    spisok.forEach(function (v) {
      var tr = koren.querySelector('tr[data-f="' + v.f + '"]');
      if (!tr) return;
      if (tr.nextSibling && tr.nextSibling.className === "kom-tr") { posl = tr; return; }
      var nov = tr.ownerDocument.createElement("tr");
      nov.className = "kom-tr";
      nov.innerHTML = '<td colspan="2">' + html(v.k) + "</td>";
      tr.parentNode.insertBefore(nov, tr.nextSibling);
      nerazryv(nov);
      posl = tr; n++;
    });
    // оговорка [команда] — один раз, под таблицей раздела с последним комментарием
    var t = posl;
    while (t && t.tagName !== "TABLE") t = t.parentNode;
    if (t) postavitOgovorku(koren, t, "p");
    return n;
  }

  // [команда] 02.10 11:15: один раз под блоком комментариев (и в печати) — общая оговорка (ст. 152 ГК РФ, ч. 3 ст. 5 38-ФЗ).
  var OGOVORKA = "Комментарий команды — общий: он объясняет, как банки и налоговая смотрят на такой признак. Это не оценка этой компании или сделки и не юридическая консультация.";
  function ogovorkaHtml() { return '<p class="kom-og">' + esc(OGOVORKA) + "</p>"; }
  // Оговорка после узла posle (последний комментарий), если её ещё нет в koren.
  function postavitOgovorku(koren, posle, teg) {
    if (!koren || !posle || !posle.parentNode || koren.querySelector(".kom-og")) return false;
    var el = posle.ownerDocument.createElement(teg || "p");
    el.className = "kom-og";
    el.textContent = OGOVORKA;
    posle.parentNode.insertBefore(el, posle.nextSibling);
    return true;
  }

  // Экран проверки: «Существенные факты» (js/sushchestvennoe.js, строки .sut__r[data-fakt=k]; k = id строки светофора или «sigN»).
  // Чистая функция: [{ k, kom }] — только для фактов из строк светофора, у которых тон на экране совпадает со статусом строки
  // (налоги «не проверяли — набор старше 3 месяцев» — нейтральные, зелёный текст к ним не подходит).
  var TON_EKRANA = { ok: "ok", info: "ok", warn: "warn", bad: "bad" };
  // kom-kapital-v1 ([команда] 03.10): факты, которые экран считает сам из ГИР БО (js/sushchestvennoe.js) — у них нет строки
  // светофора; комментарий ищем по названию факта (записи kapital, likvidnost — тексты [команда] 03.10 07:07).
  // Только «Внимание»: экран выносит их, лишь когда капитал меньше нуля / ликвидность меньше 1.
  var SVOI_FAKTY = { kapital: 1, likvidnost: 1 };
  function dlyaSut(spisok, signals, sprav) {
    if (!sprav) return [];
    var out = [];
    (spisok || []).forEach(function (f) {
      if (!f || !f.k) return;
      if (SVOI_FAKTY[f.k]) {
        if (f.ton !== "warn") return;
        var ks = najti(sprav, { title: String(f.nazv || ""), status: "warn", detail: String(f.znach || "") });
        if (ks) out.push({ k: f.k, kom: ks });
        return;
      }
      for (var j = 0; j < (signals || []).length; j++) {
        var s = signals[j];
        if (!s || !s.title || (s.id || "sig" + j) !== f.k) continue;
        if (TON_EKRANA[s.status] !== f.ton) return;
        var k = najti(sprav, s);
        if (k) out.push({ k: f.k, kom: k });
        return;
      }
    });
    return out;
  }

  var CSS_EKRANA = ".sut .kom{margin:-4px 0 12px;padding:10px 14px;border-left:3px solid var(--line,#E5E5E0);background:#FAFAF8;" +
    "border-radius:0 10px 10px 0;font-size:15px;line-height:1.5;color:var(--ink,#1D1D1F)}" +
    ".sut .kom--zel{border-left-color:var(--ok,#1E7F4F)}.sut .kom--zhel{border-left-color:var(--warn,#B26B00)}.sut .kom--kras{border-left-color:var(--bad,#C0362C)}" +
    ".sut .kom__h{font-weight:600;font-size:13px;letter-spacing:.02em;color:var(--ink2,#48484C);margin-bottom:4px}" +
    ".sut .kom p{margin:2px 0}.sut .kom__l{font-weight:600}.sut .kom__p{color:var(--muted,#6B6B70);font-size:12px;margin-top:6px}" +
    ".kom-og{margin:4px 0 12px;font-size:13px;line-height:1.45;color:var(--muted,#6B6B70)}" +
    "@media print{.sut .kom{background:none;break-inside:avoid}}";
  function stil(doc) {
    if (!doc || !doc.createElement || doc.getElementById("kom-css")) return;
    var s = doc.createElement("style"); s.id = "kom-css"; s.textContent = CSS_EKRANA;
    (doc.head || doc.documentElement).appendChild(s);
  }

  // Браузер: под строкой .sut__r[data-fakt] — комментарий (повторно не вставляет), после последнего — оговорка.
  function vstavitSut(koren, spisok) {
    if (!koren || !spisok || !spisok.length) return 0;
    var n = 0, posl = null;
    spisok.forEach(function (v) {
      var row = koren.querySelector('.sut__r[data-fakt="' + String(v.k).replace(/["\\]/g, "") + '"]');
      if (!row) return;
      var sl = row.nextSibling;
      if (sl && /(^| )kom( |$)/.test(sl.className || "")) { posl = sl; return; }
      var w = row.ownerDocument.createElement("div");
      w.innerHTML = html(v.kom);
      var el = w.firstChild;
      if (!el) return;
      row.parentNode.insertBefore(el, row.nextSibling);
      nerazryv(el);
      posl = el; n++;
    });
    if (posl) {
      try { stil(koren.ownerDocument); } catch (e) {}
      // оговорка — под всем списком фактов (после последней строки или её комментария), а не посреди него
      var vse = koren.querySelectorAll ? koren.querySelectorAll(".sut__r") : [];
      var kon = vse.length ? vse[vse.length - 1] : posl;
      if (kon.nextSibling && /(^| )kom( |$)/.test(kon.nextSibling.className || "")) kon = kon.nextSibling;
      postavitOgovorku(koren, kon, "p");
    }
    return n;
  }

  // «Кому вы платите»: сигналы разбора выписки (engine.js) — по коду, не по заголовку. Тон у записи один: уровень сигнала
  // в движке постоянный (bad — kras, warn — zhel, info — sery: справка, не «норма»). Те же ворота gotov().
  var TON_VYP = { bad: "kras", warn: "zhel", info: "sery" };
  // klient — «org» (ИНН выписки из 10 цифр) / «ip» / пусто. Строка ton.dlya_organizacii — только для «org»:
  // норма о налоге на прибыль (ч. 8 ст. 15 422-ФЗ, [команда] 02.10 23:20) к ИП не относится.
  function dlyaOrg(o) {
    return !!(o && o.tekst && o.proveril && dataRu(o.data_proverki) && String(o.tekst).length <= MAKS);
  }
  function vypiska(sprav, kod, klient) {
    var list = (sprav && sprav.vypiska && sprav.vypiska.zapisi) || [];
    for (var i = 0; i < list.length; i++) {
      var z = list[i];
      if (!z || z.kod !== kod) continue;
      if (!TON_VYP[z.uroven] || !gotov(z.ton)) return null;
      var t = z.ton, norma = t.norma != null ? t.norma : z.norma, org = "";
      if (klient === "org" && dlyaOrg(t.dlya_organizacii)) {
        org = t.dlya_organizacii.tekst;
        var n2 = t.dlya_organizacii.norma || "";
        if (n2 && String(norma || "").indexOf(n2) < 0) norma = norma ? norma + "; " + n2 : n2;
      }
      return { id: z.id, ton: TON_VYP[z.uroven], bank: t.bank || "", nalog: t.nalog || "", sdelat: t.sdelat, org: org,
        norma: norma || "", podpis: (sprav && sprav.podpis) || "Команда Делоскопа", data: dataRu(t.data_proverki) };
    }
    return null;
  }
  // Свёрнуто под сигналом: в выписке десятки поставщиков, и раскрытый текст под каждым сигналом заслонил бы суммы.
  function vypiskaHtml(sprav, kod, klient) {
    var k = vypiska(sprav, kod, klient);
    if (!k) return "";
    var str = function (l, t) { return t ? '<p><span class="kom__l">' + l + "</span> " + esc(t) + "</p>" : ""; };
    return '<details class="kom kom--' + esc(k.ton) + '" data-kom="' + esc(k.id) + '">' +
      '<summary class="kom__h">Комментарий команды Делоскопа</summary>' +
      str("Банк:", k.bank) + str("Налоговая:", k.nalog) + str("Что сделать:", k.sdelat) + str("Компании:", k.org) +
      '<div class="kom__p">' + esc(k.podpis) + (k.norma ? " · " + esc(k.norma) : "") + (k.data ? " · нормы сверены " + esc(k.data) : "") + "</div></details>";
  }
  // Есть ли в библиотеке хоть один утверждённый текст для выписки (иначе страницу не перерисовываем).
  function estVypiska(sprav) {
    var list = (sprav && sprav.vypiska && sprav.vypiska.zapisi) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && vypiska(sprav, list[i].kod)) return true;
    return false;
  }

  return { TON: TON, MAKS: MAKS, OGOVORKA: OGOVORKA, ogovorkaHtml: ogovorkaHtml, postavitOgovorku: postavitOgovorku,
    dlyaSut: dlyaSut, vstavitSut: vstavitSut, CSS_EKRANA: CSS_EKRANA, gotov: gotov, istochnikOtvetil: istochnikOtvetil, NE_OTVETIL: NE_OTVETIL, zapis: zapis, najti: najti, html: html, zagruzit: zagruzit, vstavit: vstavit, dlina: dlina,
    dlyaFaktov: dlyaFaktov, vstavitFakty: vstavitFakty,
    TON_VYP: TON_VYP, vypiska: vypiska, vypiskaHtml: vypiskaHtml, estVypiska: estVypiska };
});
;
/* --- /js/otkuda.js --- */
/* Делоскоп — «Откуда данные» на экране проверки по ИНН (решение команды 02.10 «солиднее, техничнее, понятнее»:
 * «блок «Откуда данные»: сколько реестров опрошено, когда обновлены, статус каждого»).
 * Опись собирается только из ответа /api/check — ничего не дорисовываем:
 *   ● источник ответил — что из него взяли и на какую дату сведения;
 *   ○ не ответил — так и пишем, со ссылкой «проверьте сами» («не проверяли ≠ не нашли»);
 *   ◆ рассчитано Делоскопом — светофор и прогноз ЗСК, со ссылкой на методику.
 * Расчёт в счёт «опрошенных источников» не входит. Чистые функции (istochniki, html) — без DOM и сети,
 * их проверяет tests/otkuda.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Otkuda = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // prichina-nep-v1 [команда] 11.10: не запрошенный реестр (sostoyanie = not_checked) — причина словами сайта, а не текст
  // лимита API («обновите отчёт завтра», «откройте его в платном тарифе»); те же правила — в js/sushchestvennoe.js (prichinaReestra).
  var POKA_NE = 'эти реестры мы пока не проверяем';
  var OBESHCHANIE = /завтра|тариф|сегодн|запас|временно|позже/i;
  var PLATNYJ = /[\s,;—-]*(?:или\s+)?(?:откройте|откроется)[^.;]*тариф[^.;]*/gi;

  var NB = '\u00a0';
  var DAMIA_PORYADOK = ['sudy', 'bankrotstvo', 'fssp', 'priostanovki', 'mery', 'rnp', 'kontrakty'];
  // что из внешнего реестра берём — коротко, для строки описи
  var DAMIA_CHTO = { sudy: 'дела, где компания — сторона', bankrotstvo: 'дела о банкротстве', fssp: 'исполнительные производства',
    priostanovki: 'решения о приостановлении операций по счетам', mery: 'запрет распоряжаться имуществом',
    rnp: 'записи о недобросовестном поставщике', kontrakty: 'контракты 44-ФЗ и 223-ФЗ' };

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function z(n) { return (n < 10 ? '0' : '') + n; }
  function dmy(s) {
    if (!s) return '';
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
  }
  function skl(n, a, b, c) {
    var m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c;
  }
  function ip(r) { return String(((r || {}).company || {}).inn || '').length === 12; }
  // банк — ОКВЭД 64.1x, та же проверка, что bank(c) в js/sushchestvennoe.js и js/indeks-otvet.js
  function bank(c) { return /^64\.1(\.|\d|$)/.test(String((c || {}).okved || '')); }
  var BANK_GIRBO = 'организация сдаёт её в' + NB + 'Банк России; в' + NB + 'ГИР' + NB + 'БО её передаёт Банк России, доступ может быть ограничен (ч.' + NB + '9 и' + NB + '12 ст.' + NB + '18' + NB + '402-ФЗ)';
  var CBR_BANK = 'https://www.cbr.ru/finorg/foinfo/';
  // «402-ФЗ)» на 390 px рвался по дефису — номер закона со скобкой одним куском (после esc), как в sushchestvennoe.js
  function nw(h) { return String(h).replace(/(\d+-ФЗ\))/g, '<span style="white-space:nowrap">$1</span>'); }
  function chistyj(u) { return /^https:\/\/[^\s"<>]+$/.test(u || '') ? u : ''; }

  // «ЕГРЮЛ/ЕГРИП — на 29.09.2026; задолженность — на 01.09.2026» → [{metka, data}]
  function datyNaborov(s) {
    return String(s || '').split(';').map(function (ch) {
      var m = /^\s*(.+?)\s+—\s+(?:на\s+)?(\d{2}\.\d{2}\.\d{4})\s*$/.exec(ch);
      return m ? { metka: m[1], data: m[2] } : null;
    }).filter(Boolean);
  }
  function godyRyada(ch) {
    var g = {};
    ['revenue', 'profit', 'income_tax'].forEach(function (k) {
      (Array.isArray((ch || {})[k]) ? ch[k] : []).forEach(function (x) {
        if (x && isFinite(parseInt(x.year, 10)) && x.value != null && x.value !== '' && isFinite(Number(x.value))) g[parseInt(x.year, 10)] = 1;
      });
    });
    return Object.keys(g).map(Number).sort(function (a, b) { return a - b; });
  }

  // Опись источников: { spisok: [{znak, nazv, chto, data, status, ssylka}], otvetili, oprosheno, dataPr }
  function istochniki(r, opt) {
    opt = opt || {};
    if (!r || !r.company) return { spisok: [], otvetili: 0, oprosheno: 0, dataPr: '' };
    var c = r.company, fl = ip(r), reestr = fl ? 'ЕГРИП' : 'ЕГРЮЛ';
    var t = Date.parse(r.checked_at || ''), msk = new Date((isFinite(t) ? t : (opt.segodnya || new Date()).getTime()) + 3 * 3600 * 1000);
    var dataPr = z(msk.getUTCDate()) + '.' + z(msk.getUTCMonth() + 1) + '.' + msk.getUTCFullYear();
    var D = r.dossier || {}, daty = datyNaborov(D.data_dates);
    function dataPo(re) { for (var i = 0; i < daty.length; i++) if (re.test(daty[i].metka)) return daty[i].data; return ''; }
    var spisok = [];

    // 1. ЕГРЮЛ/ЕГРИП — карточка компании пришла
    var dEgr = dataPo(/^ЕГР(ЮЛ|ИП)/i);
    var chtoEgr = fl ? 'статус, дата регистрации, виды деятельности' : 'статус, адрес и отметки о недостоверности, руководитель, дата регистрации, виды деятельности';
    spisok.push({ k: 'egrul', znak: '●', nazv: reestr + ' (ФНС)', chto: chtoEgr, data: dEgr ? 'на' + NB + dEgr : 'на' + NB + dataPr, status: 'ok' });
    var dIzm = dataPo(/последнее изменение/i);
    if (dIzm) spisok[0].dop = 'последнее изменение записи — ' + dIzm;

    // 2. Прочие источники строк светофора (открытые данные ФНС и т. п.), сгруппированные по названию
    var gruppy = {}, poryadok = [];
    (r.signals || []).forEach(function (s) {
      if (!s || !s.source || /^ЕГР(ЮЛ|ИП)/.test(s.source)) return;
      var key = String(s.source);
      if (!gruppy[key]) { gruppy[key] = { chto: [], data: '' }; poryadok.push(key); }
      if (s.title) gruppy[key].chto.push(String(s.title).toLowerCase());
      if (s.as_of && !gruppy[key].data) gruppy[key].data = dmy(s.as_of);
    });
    var dPay = dataPo(/уплаченные налоги/i);
    poryadok.forEach(function (key) {
      var g = gruppy[key];
      var dat = g.data || (/ФНС/.test(key) ? dataPo(/задолженность/i) : '');
      spisok.push({ k: 'sig:' + key, znak: '●', nazv: key, chto: g.chto.join(', '), data: dat ? 'на' + NB + dat : '', status: 'ok' });
    });
    if (dPay && !poryadok.some(function (k) { return /ФНС/.test(k); })) {
      spisok.push({ k: 'paytax', znak: '●', nazv: 'ФНС, открытые данные', chto: 'уплаченные налоги и взносы', data: 'на' + NB + dPay, status: 'ok' });
    }

    // 3. ГИР БО — годовая бухотчётность (у ИП её нет — строку не показываем)
    if (!fl) {
      var gody = godyRyada(D.charts);
      if (gody.length) {
        var pos = gody[gody.length - 1];
        spisok.push({ k: 'girbo', znak: '●', nazv: 'ГИР БО (ФНС)', chto: 'бухотчётность: выручка, прибыль, налог на прибыль',
          data: gody.length > 1 ? 'за ' + gody[0] + '–' + pos + NB + 'гг.' : 'за ' + pos + NB + 'г.', status: 'ok' });
      } else if (bank(c)) {
        // bank-girbo-v2 [команда] 04.10: у банка пустой ответ ГИР БО — не «отчётности нет», а как устроено: сдаёт в Банк России,
        // в ГИР БО передаёт Банк России, доступ может быть ограничен (ч. 9 и 12 ст. 18 402-ФЗ) — текст [команда]
        // 04.10 11:30 разд. 1.4 + 12:30 разд. 1, как в «Существенных фактах»; «проверьте сами» — карточка банка на cbr.ru.
        spisok.push({ k: 'girbo', znak: '○', nazv: 'ГИР БО (ФНС)', chto: 'бухотчётность', data: '', status: 'net',
          prichina: BANK_GIRBO, ssylka: CBR_BANK + (/^\d{13}$/.test(String(c.ogrn || '')) ? '?ogrn=' + c.ogrn : '') });
      } else {
        spisok.push({ k: 'girbo', znak: '○', nazv: 'ГИР БО (ФНС)', chto: 'бухотчётность', data: '', status: 'net',
          prichina: 'отчётности в ответе нет', ssylka: 'https://bo.nalog.gov.ru/' });
      }
    }

    // 4. Внешние реестры (суды, банкротство, приставы, …) — как ответили
    var dm = r.damia || {};
    DAMIA_PORYADOK.concat(Object.keys(dm).filter(function (k) { return DAMIA_PORYADOK.indexOf(k) < 0; })).forEach(function (k) {
      var b = dm[k];
      if (!b || typeof b !== 'object' || !b.nazvanie || !b.status || b.status === 'not_applicable') return;
      var otv = b.status === 'found' || b.status === 'not_found';
      // ne-zaprashivali-v1 [команда]: API (damia v1.4) метит sostoyanie = not_checked — реестр мы в этот раз не запрашивали
      // (в бете не подключён). Это не «не ответил»: в счёт «запрошенных» не идёт, знак «–», причина — словами API.
      var nep = !otv && b.sostoyanie === 'not_checked';
      spisok.push({ k: 'damia:' + k, znak: otv ? '●' : nep ? '–' : '○', nazv: b.nazvanie, chto: DAMIA_CHTO[k] || '',
        dop: otv && b.iz_egryul ? 'по отметке в' + NB + 'ЕГРЮЛ, ' + (b.ogovorka || 'сообщения ЕФРСБ не проверяли') : otv && b.tochnost && b.tochnost !== 'inn' ? 'сопоставили по' + NB + 'названию и' + NB + 'адресу' : '',
        data: otv ? 'на' + NB + (dmy(b.data_svedeniy) || dataPr) : '', status: otv ? 'ok' : nep ? 'nep' : 'net',
        prichina: otv ? '' : nep ? (b.prichina && !OBESHCHANIE.test(b.prichina) ? b.prichina : POKA_NE) : (String(b.prichina || '').replace(PLATNYJ, '').replace(/\s+$/, '') || 'ответа нет'), ssylka: otv ? '' : chistyj(b.proverit_samim) });
    });

    var nep = spisok.filter(function (x) { return x.status === 'nep'; }).length;
    var oprosheno = spisok.length - nep, otvetili = spisok.filter(function (x) { return x.status === 'ok'; }).length;

    // 5. Рассчитано Делоскопом — не источник, в счёт не входит
    var rasch = [];
    if (r.risk_title) rasch.push('светофор риска');
    if (r.zsk && r.zsk.title) rasch.push('прогноз ЗСК — наша оценка, не статус Банка России');
    if (rasch.length) spisok.push({ k: 'raschet', znak: '◆', nazv: 'Расчёт Делоскопа', chto: rasch.join('; '), data: dataPr, status: 'raschet', ssylka: '/indeks/' });

    return { spisok: spisok, otvetili: otvetili, oprosheno: oprosheno, nep: nep, dataPr: dataPr };
  }

  // otchet-detali-v1: подпись ссылки на первоисточник называет его (js/istochniki.js → samiTekst); нет модуля — как было
  function samiT(url) {
    var I = typeof self !== 'undefined' && self.DlkIstochniki;
    try { return I && I.samiTekst ? I.samiTekst(url) : 'проверьте сами'; } catch (e) { return 'проверьте сами'; }
  }

  function stroka(x) {
    var st = x.status === 'ok' ? 'ответил' : x.status === 'net' ? 'не ответил' : x.status === 'nep' ? 'не проверяли' : 'рассчитано';
    var hvost = x.status === 'net' || x.status === 'nep'
      ? (x.prichina ? nw(esc(x.prichina)) : '') + (x.ssylka ? (x.prichina ? ' · ' : '') + '<a href="' + esc(x.ssylka) + '" target="_blank" rel="noopener">' + esc(samiT(x.ssylka)) + '</a>' : '') || (x.status === 'nep' ? 'не проверяли' : 'не ответил')
      : x.status === 'raschet' ? '<a href="' + esc(x.ssylka) + '">методика</a>' : esc(x.data || '');
    return '<li class="otk__r otk__r--' + x.status + '" data-ist="' + esc(x.k) + '">' +
      '<span class="otk__z" aria-label="' + st + '">' + x.znak + '</span>' +
      '<span class="otk__n"><b>' + esc(x.nazv) + '</b>' + (x.chto ? '<small>' + esc(x.chto) + (x.dop ? '; ' + esc(x.dop) : '') + '</small>' : '') + '</span>' +
      '<span class="otk__d">' + hvost + '</span></li>';
  }

  function html(r, opt) {
    var o = istochniki(r, opt);
    if (!o.spisok.length) return '';
    // одна и та же причина у всех, кто не ответил, — пишем её один раз под списком, а не в каждой строке
    var net = o.spisok.filter(function (x) { return x.status === 'net'; }), obshchaya = '';
    if (net.length > 1 && net.every(function (x) { return x.prichina && x.prichina === net[0].prichina; })) {
      obshchaya = net[0].prichina;
      o.spisok = o.spisok.map(function (x) { return x.status === 'net' ? Object.assign({}, x, { prichina: '' }) : x; });
    }
    // ne-zaprashivali-v1: у не запрошенных реестров общая причина — тоже один раз под списком
    var nepS = o.spisok.filter(function (x) { return x.status === 'nep'; }), obshchayaNep = '';
    if (nepS.length > 1 && nepS.every(function (x) { return x.prichina && x.prichina === nepS[0].prichina; })) {
      obshchayaNep = nepS[0].prichina;
      o.spisok = o.spisok.map(function (x) { return x.status === 'nep' ? Object.assign({}, x, { prichina: '' }) : x; });
    }
    var tochki = o.spisok.filter(function (x) { return x.status !== 'raschet'; }).map(function (x) { return x.znak; }).join('');
    var nepTekst = o.nep ? ' · ' + o.nep + NB + skl(o.nep, 'реестр', 'реестра', 'реестров') + ' не' + NB + 'проверяли' : '';
    return '<details class="otk"><summary><span class="otk__t">Откуда данные</span>' +
      '<span class="otk__s">' + skl(o.otvetili, 'ответил', 'ответили', 'ответили') + ' ' + o.otvetili + ' из ' + o.oprosheno + NB + skl(o.oprosheno, 'запрошенного', 'запрошенных', 'запрошенных') +
      nepTekst + ' · проверка ' + o.dataPr + '</span><span class="otk__m" aria-hidden="true">' + tochki + '</span></summary>' +
      '<ul>' + o.spisok.map(stroka).join('') + '</ul>' +
      (obshchaya ? '<p class="otk__p otk__p--net">Не ответили ' + net.length + ' из ' + o.oprosheno + ': ' + nw(esc(obshchaya)) + '.</p>' : '') +
      (obshchayaNep ? '<p class="otk__p otk__p--net">Не проверяли ' + nepS.length + NB + skl(nepS.length, 'реестр', 'реестра', 'реестров') + (obshchayaNep === POKA_NE ? ' — мы их пока не' + NB + 'проверяем' : ': ' + nw(esc(obshchayaNep))) + '. Ссылки «проверьте сами» — в строках выше.</p>' : '') +
      '<p class="otk__p">● ответил' + (net.length || !o.nep ? ' · ○ не ответил' : '') + (o.nep ? ' · – не проверяли' : '') + ' — не значит «не нашли» · ◆ рассчитано Делоскопом. Это оценка риска, а не решение банка.</p></details>';
  }

  var CSS = '.otk{margin-top:12px;border-top:1px solid var(--line,#E6E6E1);font-size:13px;color:var(--ink2,#48484C)}' +
    '.otk summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px;padding:12px 0}' +
    '.otk summary::-webkit-details-marker{display:none}' +
    '.otk__t{font-size:15px;font-weight:600;color:var(--ink,#1D1D1F)}' +
    '.otk__t::after{content:"";display:inline-block;width:6px;height:6px;margin-left:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-3px) rotate(45deg);transition:transform .2s}' +
    '.otk[open] .otk__t::after{transform:translateY(0) rotate(225deg)}' +
    '.otk__s{font-variant-numeric:tabular-nums;color:var(--muted,#6B6B70)}' +
    '.otk__m{margin-left:auto;letter-spacing:2px;color:var(--muted,#6B6B70);font-size:12px}' +
    '.otk ul{list-style:none;margin:0;padding:0}' +
    '.otk__r{display:grid;grid-template-columns:16px minmax(0,1fr) auto;gap:4px 10px;padding:8px 0;border-top:1px solid #EFEFEA;align-items:baseline}' +
    '.otk__z{color:var(--ok,#16723F)}.otk__r--net .otk__z,.otk__r--nep .otk__z{color:var(--muted,#6B6B70)}.otk__r--raschet .otk__z{color:var(--ink2,#48484C)}' +
    '.otk__n{display:grid;gap:2px;min-width:0}.otk__n b{font-weight:500;color:var(--ink,#1D1D1F)}.otk__n small{font-size:12px;color:var(--muted,#6B6B70)}' +
    '.otk__d{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.otk__d a{color:var(--accent,#0B63E5)}' +
    '.otk__r--net .otk__d,.otk__r--nep .otk__d{white-space:normal;max-width:220px}' +
    '.otk__p{margin:8px 0 0;font-size:12px;color:var(--muted,#6B6B70)}' +
    '@media (max-width:520px){.otk__r{grid-template-columns:16px minmax(0,1fr)}.otk__d{grid-column:2;text-align:left;white-space:normal;max-width:none}.otk__m{display:none}}' +
    '@media print{.otk:not([open])>*:not(summary){display:block}.otk__m{display:none}}';

  function stil(doc) {
    if (!doc || doc.getElementById('otk-css')) return;
    var s = doc.createElement('style'); s.id = 'otk-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Браузер: заменяет строку «Источники: …» под отчётом на опись источников. Ошибка — строка остаётся как была.
  function mount(el, r, opt) {
    if (!el) return false;
    var h = '';
    try { h = html(r, opt); } catch (e) { h = ''; }
    if (!h) return false;
    try { stil(el.ownerDocument || document); } catch (e) {}
    var w = (el.ownerDocument || document).createElement('div');
    w.innerHTML = h;
    el.parentNode.replaceChild(w.firstChild, el);
    return true;
  }

  return { istochniki: istochniki, datyNaborov: datyNaborov, html: html, mount: mount, CSS: CSS };
});
;
/* --- /js/reestry-sami.js --- */
/* Делоскоп — «Что ещё проверить самим» в свёрнутом разделе «Все данные из реестров» экрана проверки по ИНН
 * (эталон экрана 02.10, п. 6 «Глубина из баз»; полоса команда «новые законные источники данных без API»).
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

  // otchet-detali-v1: подпись ссылки на первоисточник называет его (js/istochniki.js → samiTekst); нет модуля — как было
  function samiT(url) {
    var I = typeof self !== 'undefined' && self.DlkIstochniki;
    try { return I && I.samiTekst ? I.samiTekst(url) : 'проверьте сами'; } catch (e) { return 'проверьте сами'; }
  }

  function html(spisok, sprav) {
    if (!spisok || !spisok.length) return '';
    var d = dmy((sprav || {}).svereno);
    return '<section class="sut__s rs" data-reestry-sami><h4>Что ещё проверить самим в открытых реестрах</h4><dl>' +
      spisok.map(function (x) {
        return '<div data-reestr="' + esc(x.id) + '"' + (x.okvedKod ? ' data-okved' : '') + '><dt>' + esc(nb(x.nazv)) + '<small>' + esc(nb(x.kogda || '')) + '</small></dt>' +
          '<dd>' + esc(nb(x.chto)) + ' <a href="' + esc(x.ssylka) + '" target="_blank" rel="noopener"' +
          (x.cel ? ' data-goal="' + esc(x.cel) + '"' : '') + '>' + esc(samiT(x.ssylka)) + '</a>' +
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
;
/* --- /js/rekvizity-proverki.js --- */
/* Делоскоп — «Реквизиты проверки» на экране проверки по ИНН (решение команды 02.10 «солиднее»:
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
    '.rkv dd{margin:0;font-size:15px;font-weight:600;color:var(--ink,#1D1D1F);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}' +
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
;
/* --- /js/perepoverit.js --- */
/* Делоскоп — «Перепроверить до…» и напоминание в календаре (23.10.2026).
 * Под реквизитами отчёта одна строка: «Перепроверить до {дата проверки + 30 дней}» и кнопка «Напомнить в календаре».
 * Почему 30 дней: открытые наборы ФНС (недоимка, численность, налоги, спецрежимы) обновляются раз в месяц,
 * а запись ЕГРЮЛ может смениться в любой день — проверка не на всю жизнь.
 * Файл .ics (RFC 5545) собирается в браузере: на сервер ничего не уходит, в файле — только название компании,
 * ИНН и ссылка на новую проверку. Событие — на весь день, за день до даты «Перепроверить до».
 * Чистые функции (srok, ics) — без DOM и сети, их проверяет tests/perepoverit.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Perepoverit = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DNEJ = 30;
  var NB = '\u00a0';
  var SAJT = 'https://deloskop.ru/';

  function z(n) { return (n < 10 ? '0' : '') + n; }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // день проверки по Москве (UTC+3): «2026-10-23» как есть; момент — в московский день
  function denProverki(s) {
    s = String(s || '').trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var t = Date.parse(s);
    if (!isFinite(t)) return null;
    var d = new Date(t + 3 * 3600 * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  function ru(t) { var d = new Date(t); return z(d.getUTCDate()) + '.' + z(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }
  function ymd(t) { var d = new Date(t); return d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate()); }
  function chistyjInn(s) { s = String(s == null ? '' : s).replace(/\D/g, ''); return /^(\d{10}|\d{12})$/.test(s) ? s : ''; }

  /* { inn, imya, proveren: 'ДД.ММ.ГГГГ', do: 'ДД.ММ.ГГГГ', napomnit: 'ГГГГММДД', konec: 'ГГГГММДД', ssylka } | null */
  function srok(r) {
    if (!r || !r.company) return null;
    var c = r.company;
    var inn = chistyjInn(c.inn);
    var den = denProverki(r.checked_at);
    if (!inn || den == null) return null;
    var dodo = den + DNEJ * 864e5;
    return {
      inn: inn,
      imya: String(c.name_short || c.name_full || ('ИНН ' + inn)).replace(/\s+/g, ' ').trim(),
      proveren: ru(den), 'do': ru(dodo),
      napomnit: ymd(dodo - 864e5), konec: ymd(dodo),
      ssylka: SAJT + '?inn=' + inn + '&utm_source=ics'
    };
  }

  // RFC 5545 §3.3.11: \ ; , и перевод строки — экранируются
  function tekst(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  // RFC 5545 §3.1: строка не длиннее 75 октетов, продолжение — CRLF + пробел; символ UTF-8 не режем
  function slozhit(line) {
    var out = [], cur = '', n = 0, lim = 75;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i], code = line.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < line.length) { ch += line[++i]; }
      var b = ch.length > 1 ? 4 : code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
      if (n + b > lim) { out.push(cur); cur = ' '; n = 1; lim = 75; }
      cur += ch; n += b;
    }
    out.push(cur);
    return out.join('\r\n');
  }
  function shtamp(t) {
    var d = new Date(t);
    return d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate()) + 'T' + z(d.getUTCHours()) + z(d.getUTCMinutes()) + z(d.getUTCSeconds()) + 'Z';
  }

  // текст файла .ics; seichas — мс (для DTSTAMP), по умолчанию — сейчас
  function ics(s, seichas) {
    if (!s) return '';
    var zag = 'Перепроверить ' + s.imya + ' перед следующей оплатой';
    var opis = 'Проверка в Делоскопе от ' + s.proveren + '. Перепроверить до ' + s['do'] +
      ': сведения реестров меняются, открытые данные ФНС обновляются раз в месяц.\n' + s.ssylka;
    var L = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Deloskop//Perepoverit//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:perepoverit-' + s.inn + '-' + s.konec + '@deloskop.ru',
      'DTSTAMP:' + shtamp(seichas == null ? Date.now() : seichas),
      'DTSTART;VALUE=DATE:' + s.napomnit,
      'DTEND;VALUE=DATE:' + s.konec,
      'SUMMARY:' + tekst(zag),
      'DESCRIPTION:' + tekst(opis),
      'URL:' + s.ssylka,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT9H', 'DESCRIPTION:' + tekst(zag), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ];
    return L.map(slozhit).join('\r\n') + '\r\n';
  }

  var POCHEMU = 'Сведения реестров меняются: запись ЕГРЮЛ — в любой день, открытые данные ФНС обновляются раз в' + NB + 'месяц.';
  var KNOPKA = '<button type="button" class="pp__b" data-act="ics">Напомнить в' + NB + 'календаре</button>';

  // клетка реквизитов (как «Проверено»): срок + кнопка; заменяет пустую клетку сетки 2 × 2
  function kletka(s) {
    if (!s) return '';
    return '<div class="rkv__pp" data-pp><dt title="' + esc(POCHEMU) + '">Перепроверить до</dt><dd>' + esc(s['do']) +
      '<small>через ' + DNEJ + NB + 'дней после проверки</small>' + KNOPKA + '</dd></div>';
  }
  // отдельная строка — если реквизитов нет
  function html(s) {
    if (!s) return '';
    return '<div class="pp" data-pp><p class="pp__t">Перепроверить до <b>' + esc(s['do']) + '</b>' +
      '<small>' + esc(POCHEMU) + '</small></p>' + KNOPKA + '</div>';
  }

  var CSS = '.pp{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;padding:12px 0;border-bottom:1px solid var(--line,#E6E6E1)}' +
    '.pp__t{margin:0;font-size:var(--t-15,15px);color:var(--ink,#1D1D1F);min-width:0}' +
    '.pp__t b{font-weight:600;font-variant-numeric:tabular-nums}' +
    '.pp__t small{display:block;font-size:var(--t-13,13px);color:var(--muted,#6B6B70);margin-top:2px}' +
    '.pp__b{min-height:44px;border:1px solid var(--line,#D9D9D4);background:transparent;font:inherit;font-size:var(--t-15,15px);font-weight:600;' +
    'border-radius:var(--r-small,10px);padding:10px 16px;cursor:pointer;color:var(--ink,#1D1D1F)}' +
    '.pp__b:hover,.pp__b:focus-visible{border-color:var(--accent,#0B63E5);color:var(--accent,#0B63E5)}' +
    '.rkv__pp .pp__b{display:block;margin-top:2px;min-height:44px;padding:0;border:0;font-size:var(--t-13,13px);color:var(--accent,#0B63E5);text-align:left;text-decoration:underline;text-underline-offset:3px}' +
    '.rkv__pp .pp__b:hover,.rkv__pp .pp__b:focus-visible{text-decoration-thickness:2px}' +
    '@media (max-width:600px){.pp .pp__b{width:100%}}' +
    '@media print{.pp__b{display:none!important}}';

  function stil(doc) {
    if (!doc || doc.getElementById('pp-css')) return;
    var st = doc.createElement('style'); st.id = 'pp-css'; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st);
  }

  function skachat(doc, s) {
    var txt = ics(s);
    var imya = 'perepoverit-' + s.inn + '.ics';
    var url, blob = null;
    try { blob = new Blob([txt], { type: 'text/calendar;charset=utf-8' }); url = URL.createObjectURL(blob); }
    catch (e) { url = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(txt); }
    var a = doc.createElement('a');
    a.href = url; a.download = imya; a.rel = 'noopener'; a.style.display = 'none';
    (doc.body || doc.documentElement).appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); if (blob) try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
  }

  // Браузер: строка — сразу под реквизитами (или под шапкой отчёта). Своя компания («Щит») — без строки.
  function mount(report, r) {
    if (!report) return false;
    var s = srok(r);
    if (!s) return false;
    var doc = report.ownerDocument || document;
    try { stil(doc); } catch (e) {}
    var rkv = report.querySelector('.rkv');
    var w = doc.createElement(rkv ? 'dl' : 'div');
    w.innerHTML = rkv ? kletka(s) : html(s);
    var el = w.firstChild;
    var pod = report.querySelector('.report-head');
    if (rkv) rkv.appendChild(el);
    else if (pod && pod.parentNode) pod.parentNode.insertBefore(el, pod.nextSibling);
    else report.insertBefore(el, report.firstChild);
    var b = el.querySelector('[data-act="ics"]');
    if (b) b.onclick = function () {
      try { skachat(doc, s); } catch (e) {}
      try { if (window.dlkGoal) window.dlkGoal('perepoverit_ics'); } catch (e) {}
      b.textContent = 'Файл календаря скачан';
    };
    return true;
  }

  return { srok: srok, ics: ics, html: html, kletka: kletka, mount: mount, slozhit: slozhit, DNEJ: DNEJ, CSS: CSS };
});
;
/* --- /js/status-kod.js --- */
/*!
 * Делоскоп · статус юрлица словами — по коду состояния ЕГРЮЛ (company.state_code, API status-kody).
 * status-tochno-v1 [команда] 10.10.2026: DaData кладёт и ликвидацию (101, 102), и предстоящее исключение
 * (105–108, 110) в один статус LIQUIDATING. Код в ответе есть — значит, пишем точно, а не «ликвидируется или исключается».
 * Названия — те же, что в «Что изменилось» (js/dinamika.js nazvSt, заголовки [команда] 03.10) и в справочнике
 * data/statusy-egryul.json; новых юридических формулировок здесь нет. Нет кода — прежний общий текст.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StatusKod = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NB = ' ';
  var LIKV = { '101': 1, '102': 1 };
  var ISKL = { '105': 1, '106': 1, '107': 1, '108': 1, '110': 1 };
  var ISKLYUCHENA = { '407': 1, '414': 1, '415': 1, '418': 1, '420': 1 };
  // Короткое название (шапка отчёта, Паспорт, PDF) — строчными
  var OBSHCHEE = { ACTIVE: 'действующая', LIQUIDATING: 'ликвидируется или исключается из' + NB + 'ЕГРЮЛ', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' };
  // Фраза о компании (причина вывода, Щит)
  var FRAZA = { LIQUIDATING: 'компания ликвидируется или ФНС готовит её исключение из' + NB + 'ЕГРЮЛ', LIQUIDATED: 'компания ликвидирована', BANKRUPT: 'идёт банкротство', REORGANIZING: 'идёт реорганизация' };

  function kod(v) { var k = String(v == null ? '' : v).trim(); return /^\d{3}$/.test(k) ? k : ''; }
  function vid(st, k) {
    k = kod(k);
    if (ISKLYUCHENA[k]) return 'isklyuchena';
    if (st === 'LIQUIDATING' && ISKL[k]) return 'isklyuchenie';
    if (st === 'LIQUIDATING' && LIKV[k]) return 'likvidaciya';
    return '';
  }
  // pasport-reorg-v1 [команда] 10.10: форма реорганизации по коду СЮЛСТ (data/statusy-egryul.json, группа reorganizaciya) —
  // короткий пересказ названия из справочника, без новых юридических формулировок. Название статуса (nazv) не меняем.
  var REORG_FORMA = {
    '121': 'преобразование', '122': 'слияние', '123': 'разделение', '124': 'присоединение к' + NB + 'другому юрлицу',
    '125': 'разделение одновременно с' + NB + 'присоединением', '129': 'сочетание нескольких форм, после которого компания прекратит деятельность',
    '131': 'выделение', '132': 'присоединение к' + NB + 'ней других юрлиц', '133': 'присоединение одновременно с' + NB + 'разделением',
    '134': 'присоединение одновременно с' + NB + 'выделением', '136': 'выделение одновременно с' + NB + 'присоединением',
    '139': 'сочетание нескольких форм, после которого компания продолжит деятельность'
  };
  // reorgForma('REORGANIZING', '124') → 'присоединение к другому юрлицу'; другой статус или неизвестный код — ''
  function reorgForma(st, k) { k = kod(k); return st === 'REORGANIZING' && REORG_FORMA[k] ? REORG_FORMA[k] : ''; }
  // pasport-likvidaciya-v1 [команда] 10.10: что делать кредитору при ликвидации и исключении — тексты [команда]
  // из data/statusy-egryul.json (поля sdelat и norma групп; тест сверяет дословно). Новых формулировок нет.
  var KREDITORU = {
    likvidaciya: { tekst: "Компания ликвидируется — после записи о ликвидации банк закроет счёт. Новые сделки — нет; по текущим — заявите требование ликвидатору в срок.", norma: "ст. 61–64 ГК РФ" },
    isklyuchenie: { tekst: "Новых авансов не платите. Если компания вам должна — возражение в налоговую нужно подать в течение 3 месяцев со дня публикации в «Вестнике государственной регистрации», по коду 108 — 6 месяцев. Дату публикации проверьте на vestnik-gosreg.ru.", norma: "ст. 21.1 и 21.3 129-ФЗ" },
    isklyuchena: { tekst: "Компания исключена из ЕГРЮЛ. Последствия — как при ликвидации (п. 2 ст. 64.2 ГК РФ): договор с ней не заключайте и не платите. Оспорить исключение в суде — в течение года (п. 8 ст. 22 129-ФЗ). Долг ООО можно требовать с директора или участников, если не оплачен по их вине (п. 3.1 ст. 3 14-ФЗ).", norma: "п. 2–3 ст. 64.2 ГК РФ; п. 3.1 ст. 3 14-ФЗ" }
  };
  // kreditoru('LIQUIDATING', '101') → { vid, tekst, norma }; без кода или при другом статусе — null
  function kreditoru(st, k) { var v = vid(st, k); return v && KREDITORU[v] ? { vid: v, tekst: KREDITORU[v].tekst, norma: KREDITORU[v].norma } : null; }
  function cap(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }

  // nazv('LIQUIDATING', '101') → 'ликвидируется'; {zaglavnaya: true} → с заглавной
  function nazv(st, k, o) {
    var v = vid(st, k);
    var t = v === 'isklyuchena' ? 'исключена из' + NB + 'ЕГРЮЛ' : v === 'isklyuchenie' ? 'готовится исключение из' + NB + 'ЕГРЮЛ' : v === 'likvidaciya' ? 'ликвидируется' : (OBSHCHEE[st] || st || '');
    return o && o.zaglavnaya ? cap(t) : t;
  }
  // fraza('LIQUIDATING', '106') → 'ФНС готовит исключение компании из ЕГРЮЛ'
  function fraza(st, k, o) {
    var v = vid(st, k);
    var t = v === 'isklyuchena' ? 'компания исключена из' + NB + 'ЕГРЮЛ' : v === 'isklyuchenie' ? 'ФНС готовит исключение компании из' + NB + 'ЕГРЮЛ' : v === 'likvidaciya' ? 'компания ликвидируется' : (FRAZA[st] || '');
    return o && o.zaglavnaya ? cap(t) : t;
  }
  // По ответу /api/check: company → короткое название
  function izOtveta(c, o) { c = c || {}; return c.status ? nazv(c.status, c.state_code, o) : ''; }

  return { nazv: nazv, fraza: fraza, izOtveta: izOtveta, vid: vid, kod: kod, reorgForma: reorgForma, REORG_FORMA: REORG_FORMA, kreditoru: kreditoru, KREDITORU: KREDITORU, LIKV: LIKV, ISKL: ISKL, ISKLYUCHENA: ISKLYUCHENA };
});
;
/* --- /js/usloviya.js --- */
/*!
 * Делоскоп · «Условия сделки» — карточка нового типа.
 * Вместо «риск 62 из 100» — вердикт с условием: можно ли работать, сколько платить вперёд,
 * сколько денег на кону при претензии налоговой и что запросить у контрагента (с готовым письмом).
 * Работает поверх ответа /api/check, без запросов на сервер. Всё считается в браузере.
 * Методика — в комментариях к каждой функции; ориентиры Делоскопа, а не нормы закона, так и подписаны.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Usloviya = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- ставки 2026 ----------
  var VAT = 0.22;          // НДС с 01.01.2026 (ст. 164 НК в ред. 425-ФЗ)
  var PROFIT = 0.25;       // налог на прибыль с 2025
  var USN_DR = 0.15;       // УСН «доходы минус расходы»
  var FINE_SOFT = 0.20;    // п. 1 ст. 122 НК — неуплата без умысла
  var FINE_HARD = 0.40;    // п. 3 ст. 122 НК — умышленная неуплата

  var REGIMES = [
    { id: 'osno', name: 'ОСН с НДС' },
    { id: 'usn_dr', name: 'УСН «доходы минус расходы»' },
    { id: 'usn_d', name: 'УСН «доходы», ПСН, НПД' }
  ];

  // ---------- мелочи ----------
  function nbsp(s) { return String(s).replace(/ /g, ' '); }
  function money(x) {
    var n = Math.round(Math.max(0, x || 0));
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  }
  // Крупные суммы в «Как посчитали» — словами, как читают люди: от 1 млрд ₽ — «8,6\u00a0трлн\u00a0₽», «330,8\u00a0млрд\u00a0₽»
  // (до 10 единиц — два знака после запятой, дальше — один, нули в хвосте убираем). 15-значное число на 390 px не читается.
  // Сам предел аванса (итог) по-прежнему — точной суммой, округлённой вниз.
  function moneyKrupno(x) {
    var n = Math.max(0, x || 0);
    if (n < 1e9) return money(n);
    var ed = n >= 1e12 ? [1e12, 'трлн'] : [1e9, 'млрд'], v = n / ed[0], zn = v < 10 ? 2 : 1;
    var t = v.toFixed(zn).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
    return t + '\u00a0' + ed[1] + '\u00a0₽';
  }
  // Круглые ориентиры, вниз: 87 400 → 80 000; 1 237 000 → 1 200 000. Меньше 10 000 ₽ — 0: вверх не округляем
  // ([команда] 02.10 19:37 — ориентир не должен обещать больше двух недель выручки).
  function niceFloor(x) {
    if (!(x > 0)) return 0;
    var step = x < 100000 ? 10000 : x < 1000000 ? 50000 : x < 10000000 ? 100000 : 1000000;
    return Math.floor(x / step) * step;
  }
  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
  function monthsBetween(from, to) {
    var a = new Date(from), b = to ? new Date(to) : new Date();
    if (isNaN(a)) return null;
    var m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) m -= 1;
    return Math.max(0, m);
  }
  function ageText(m) {
    if (m == null) return '';
    if (m < 12) return m + ' ' + plural(m, 'месяц', 'месяца', 'месяцев');
    var y = Math.floor(m / 12);
    return y + ' ' + plural(y, 'год', 'года', 'лет');
  }
  function parseAmount(s) {
    if (typeof s === 'number') return s > 0 ? s : 0;
    var t = String(s || '').toLowerCase().replace(/\s| /g, '').replace(',', '.');
    var k = 1;
    if (/млн|m$/.test(t)) k = 1e6; else if (/тыс|к$|k$/.test(t)) k = 1e3;
    var n = parseFloat(t.replace(/[^\d.]/g, ''));
    return isFinite(n) && n > 0 ? Math.round(n * k) : 0;
  }

  // ---------- признаки из ответа API ----------
  // Названия признаков приходят текстом, поэтому классифицируем по смыслу.
  // Неизвестный «плохой» признак не теряется — он попадает в «other».
  var KINDS = [
    ['exit', /ликвидац|ликвидир|банкрот|реорганиз|прекращ/i],
    ['diskv', /дисквалиф/i],
    ['nedost', /недостоверн/i],
    ['block', /приостановл|блокировк[аи]? (операц|сч)|решени[ея] о приостан/i],
    ['mass', /массов/i],
    ['fssp', /пристав|исполнительн|фссп/i],
    ['rnp', /недобросовестн.*поставщ|\bрнп\b/i],
    ['dolg', /задолженн|недоимк|долг/i],
    ['director', /руководител|директор/i],
    ['staff', /численност|сотрудник|штат/i],
    ['report', /отч[её]тност|не сда/i],
    ['nagruzka', /нагрузк|налоги.*уплач|уплачен.*налог/i],
    ['fines', /правонаруш|штраф/i],
    ['young', /молод|зарегистрир|возраст/i]
  ];
  function kindOf(title) {
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i][1].test(title || '')) return KINDS[i][0];
    return 'other';
  }
  function num(v) { var n = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[^\d.,-]/g, '').replace(',', '.')); return isFinite(n) ? n : null; }

  function facts(r) {
    r = r || {};
    var c = r.company || {}, D = r.dossier || {};
    var f = {
      name: c.name_short || c.name_full || (c.inn ? 'ИНН ' + c.inn : 'компания'),
      inn: c.inn || '', status: c.status || 'ACTIVE', kind: c.kind || (String(c.inn || '').length === 12 ? 'INDIVIDUAL' : 'LEGAL'),
      ageMonths: c.reg_date ? monthsBetween(c.reg_date, r.checked_at) : null,
      level: r.risk_level || 'low', zsk: r.zsk && r.zsk.level || null,
      revenue: null, staff: null, bad: {}, warn: {}, list: []
    };
    // status-tochno-v1: код состояния ЕГРЮЛ — только если пришёл (без кода вывод побайтно прежний)
    if (c.state_code != null && String(c.state_code).trim()) f.kod = String(c.state_code).trim();
    // predel-bank-v1 [команда] 11.10: кредитная организация (основной ОКВЭД 64.1 — банки и НКО, как в js/sushchestvennoe.js).
    // Её отчётность раскрывает Банк России, в ГИР БО её может не быть → потолок по возрасту занижен; число не меняем, объясняем.
    if (f.kind === 'LEGAL' && /^64\.1(\.|\d|$)/.test(String(c.okved || ''))) { f.kredit = true; f.okved = String(c.okved); if (/^\d{13}$/.test(String(c.ogrn || ''))) f.ogrn = String(c.ogrn); }
    // predel-finorg-v1 (ТЗ [команда] 12.10, pokupka-chestno п. 5): банк (64.1x) или страховая организация (65.1x, 65.2x) —
    // предел предоплаты не считаем: потолок по возрасту для них ничего не говорит, за устойчивостью следит Банк России.
    // 65.3 (пенсионные фонды) и 64.9 (МФО, лизинг) — не сюда: текст говорит только о банках и страховых.
    if (f.kind === 'LEGAL' && (f.kredit || /^65\.[12](\.|\d|$)/.test(String(c.okved || '')))) { f.finorg = true; f.okved = String(c.okved); if (/^\d{13}$/.test(String(c.ogrn || ''))) f.ogrn = String(c.ogrn); }
    (r.signals || []).forEach(function (s) {
      if (s.status !== 'bad' && s.status !== 'warn') {
        if (/численност|сотрудник/i.test(s.title || '')) { var z = num(s.detail); if (z != null) f.staff = z; }
        return;
      }
      var k = kindOf(s.title);
      f[s.status][k] = (f[s.status][k] || 0) + 1;
      f.list.push({ kind: k, status: s.status, title: s.title || '', detail: s.detail || '' });
      if (k === 'staff') { var n = num(s.detail); if (n != null) f.staff = n; }
    });
    (D.kpi || []).forEach(function (x) {
      if (/выручк/i.test(x.label || '') && typeof x.value === 'number' && x.value > 0) { f.revenue = x.value; var y = /(20\d\d)/.exec((x.label || '') + ' ' + (x.year || x.god || '')); if (y) f.revenueYear = y[1]; }
      if (/сотрудник|численност|штат/i.test(x.label || '') && typeof x.value === 'number') f.staff = x.value;
    });
    if (f.ageMonths != null && f.ageMonths < 12) f.warn.young = (f.warn.young || 0) + 1;
    // predel-bez-vyruchki-v1 [команда] 05.10 (ТЗ [команда] 05.10 разд. 1): отчёт за год в ГИР БО сдан
    // (признак — из js/sushchestvennoe.js, та же функция, что у строки «Выручка за … · В отчёте не указана»),
    // а выручки в нём нет → выручка известна и равна 0, а не «неизвестна». Потолок по возрасту — только без отчёта.
    var SU = modulSushch(), god = null, o = null;
    try { god = SU && SU.otchetGod ? SU.otchetGod(r) : null; o = SU && SU.otchetnost ? SU.otchetnost(r) : null; } catch (e) { god = null; }
    if (god != null) {
      f.otchetGod = String(god);
      f.vyruchkaNol = !(f.revenue > 0) && !(o && o.vyruchka > 0);
    }
    return f;
  }
  function modulSushch() {
    if (typeof Sushchestvennoe !== 'undefined') return Sushchestvennoe;
    if (typeof module === 'object' && typeof require === 'function') { try { return require('./sushchestvennoe.js'); } catch (e) {} }
    return null;
  }

  // reorg-pravopreemnik-v1 (позиция [команда] 10.10 10:07 разд. 3): реорганизация, после которой компания прекратит
  // существование, — коды СЮЛСТ 122–125, 129 (data/statusy-egryul.json). Обязательства перейдут к правопреемнику,
  // а его мы не проверяли: предоплата «до N ₽» здесь вводит в заблуждение — тон post, пока не проверен правопреемник.
  var REORG_PREKRASHCHENIE = ['122', '123', '124', '125', '129'];
  function reorgPrekr(f) { return !!f && f.status === 'REORGANIZING' && f.kod != null && REORG_PREKRASHCHENIE.indexOf(String(f.kod)) >= 0; }
  var REORG_PR = 'компания реорганизуется и прекратит существование, правопреемника мы не проверяли';
  var REORG_SDELAT = 'Узнайте, кто правопреемник, и проверьте его по ИНН: договоры и долги перейдут к нему.';
  var REORG_DOLG = 'Если долг перед вами возник до первой публикации о реорганизации, в течение 30 дней после последней публикации можно через суд потребовать досрочного исполнения (п. 2 ст. 60 ГК РФ). Права нет, если обеспечение уже достаточное; суд учтёт, ухудшилось ли положение должника.';

  // ---------- вердикт ----------
  // Четыре тона: go — работать можно; cap — можно с пределом предоплаты;
  // post — только оплата по факту; stop — не платить вперёд / сделку не заключать.
  function tone(f) {
    var b = f.bad, w = f.warn;
    if (f.status === 'LIQUIDATED') return 'stop';
    if (f.status === 'BANKRUPT' || f.status === 'LIQUIDATING') return 'stop';
    if (b.diskv || b.nedost || b.block || b.exit || f.zsk === 'high') return 'stop';
    var heavy = (b.dolg || 0) + (b.mass || 0) + (b.fssp || 0) + (b.rnp || 0) + (b.other || 0) + (b.director || 0) + (b.staff || 0) + (b.report || 0);
    var warns = 0; for (var k in w) warns += w[k];
    if (reorgPrekr(f)) return 'post';
    if (heavy || f.level === 'high' || warns >= 3) return 'post';
    if (warns || f.level === 'medium' || f.zsk === 'medium' || f.status === 'REORGANIZING') return 'cap';
    return 'go';
  }

  // Предел предоплаты — собственное правило Делоскопа:
  //  • выручка известна → не больше двух недель выручки (выручка / 26);
  //  • выручка неизвестна → по возрасту: до 6 мес — 100 тыс., до года — 300 тыс., до 3 лет — 1 млн, старше — 3 млн;
  //  • компании младше года — никогда не больше возрастного потолка;
  //  • тон «можно с пределом» — половина; «только по факту» и «стоп» — ноль.
  // OSTOROZHNO — «осторожный предел» (предложение Маркетинга 28.09, раздел 3.5; решение — за [Данными]):
  // если ни один источник долгов (приставы, налоги) не проверен, предел считается как «с пределом» — вдвое меньше.
  // Пока false: методика не меняется, а честность держит строка «Не проверяли» под пределом.
  var OSTOROZHNO = false;
  var DELITEL = 26;                                        // две недели выручки: 52 недели / 2
  var MINIMUM = 10000;                                     // предел меньше — числа нет, «советуем платить по факту» (malo)
  var POTOLKI = [[6, 100000], [12, 300000], [36, 1000000], [Infinity, 3000000]]; // [младше N мес, потолок]
  function potolok(m) { if (m == null) return 1000000; for (var i = 0; i < POTOLKI.length; i++) if (m < POTOLKI[i][0]) return POTOLKI[i][1]; return 3000000; }

  function prepayCap(f, t, np) {
    if (t === 'post' || t === 'stop') return { cap: 0, rule: t === 'stop' ? 'Вперёд не платить' : 'Оплата только по факту', raschet: { tone: t } };
    if (f.finorg) return { cap: null, finorg: true, rule: 'предел не считаем — банк или страховая организация', raschet: { tone: t, base: 'finorg' } };
    var byAge = potolok(f.ageMonths);
    var cap, rule, R = { tone: t, byAge: byAge, ageMonths: f.ageMonths, revenue: f.revenue || null, revenueYear: f.revenueYear || null };
    if (f.vyruchkaNol) {                                   // отчёт сдан, выручки нет: две недели нулевой выручки — 0 ₽
      R.base = 'nol'; R.otchetGod = f.otchetGod || null; R.malo = true; R.itog = 0;
      return { cap: 0, malo: true, rule: 'отчёт сдан, выручки в нём нет — две недели нулевой выручки: 0 ₽, советуем платить по факту', raschet: R };
    }
    if (f.revenue) {
      cap = f.revenue / DELITEL; rule = 'не больше двух недель выручки компании'; R.base = 'revenue'; R.dveNedeli = cap;
      if (f.ageMonths != null && f.ageMonths < 12 && byAge < cap) { cap = byAge; rule = 'потолок для компании младше года'; R.ageCapped = true; }
    } else { cap = byAge; R.base = f.ageMonths == null ? 'unknown' : 'age'; rule = f.ageMonths == null ? 'осторожный потолок — выручка и возраст неизвестны' : 'потолок по возрасту компании (выручка неизвестна)'; }
    R.doPolovinu = cap;
    var ostor = OSTOROZHNO && np && np.dolgiVse && t === 'go';
    if (t === 'cap' || ostor) { cap = cap / 2; rule += ostor ? ', вдвое меньше: долги не проверены' : ', вдвое меньше из-за замечаний'; R.half = ostor ? 'ostorozhno' : 'zamechaniya'; }
    if (cap < MINIMUM) { R.malo = true; R.itog = 0; return { cap: 0, malo: true, rule: rule + ' — меньше ' + money(MINIMUM) + ': советуем платить по факту', raschet: R }; }
    R.itog = niceFloor(cap);
    return { cap: R.itog, rule: rule, raschet: R };
  }

  // Какие источники долгов НЕ проверены в этой проверке. Правило «не проверяли ≠ не нашли» (Юрист 115-ФЗ, 27.09):
  // источник считается проверенным, только если сервер прямо сказал found / not_found (блок damia или список istochniki)
  // либо в ответе есть найденный долг этого вида. Иначе — «не проверяли», как бы ни выглядели остальные данные.
  var DOLGI = [
    { id: 'fssp', kind: 'fssp', title: 'долги у приставов', klyuchi: ['fssp'] },
    { id: 'nalogi', kind: 'dolg', title: 'долги по налогам', klyuchi: ['nalogi', 'fns_debt', 'nedoimki', 'dolgi_nalogi'] }
  ];
  function statusIstochnika(r, klyuchi) {
    var dm = r && r.damia || {}, spisok = r && r.istochniki || [];
    for (var i = 0; i < klyuchi.length; i++) {
      var b = dm[klyuchi[i]]; if (b && b.status) return b.status;
      for (var j = 0; j < spisok.length; j++) if (spisok[j] && (spisok[j].kod === klyuchi[i] || spisok[j].id === klyuchi[i]) && spisok[j].status) return spisok[j].status;
    }
    return null;
  }
  // Строка светофора «Задолженность по налогам» (id tax_debt, открытые данные ФНС) — тоже ответ источника
  // ([команда] 02.10 07:15/08:20): ok/warn/bad = налоги проверены, но только на дату набора ФНС и только если набор
  // не старше 3 месяцев на день проверки; без даты или старее — «не проверяли». Текст — «нет в списке ФНС на [дата]», не «нет».
  var SVEZHEST_MES = 3;
  function dataIzStroki(v) {
    var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v || '');
    if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }
  function dvaZnaka(n) { return (n < 10 ? '0' : '') + n; }
  function nalogovyjNabor(r) {
    var sig = (r && r.signals || []).filter(function (s) {
      return s && (s.id === 'tax_debt' || (!s.id && /задолженн\S*\s+по\s+налог/i.test(s.title || '')));
    })[0];
    if (!sig || ['ok', 'warn', 'bad'].indexOf(sig.status) < 0) return null;
    var d = dataIzStroki(sig.as_of);
    if (!d) return { status: sig.status, data: null, svezhij: false };
    var t = Date.parse(r.checked_at || ''), na = isFinite(t) ? new Date(t) : new Date();
    var granica = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + SVEZHEST_MES, d.getUTCDate()));
    return { status: sig.status, data: dvaZnaka(d.getUTCDate()) + '.' + dvaZnaka(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(), svezhij: na.getTime() < granica.getTime() + 24 * 3600 * 1000 };
  }
  function neProvereno(r, f) {
    var net = [], nn = nalogovyjNabor(r), nalogiNa = null;
    DOLGI.forEach(function (d) {
      if (f.bad[d.kind] || f.warn[d.kind]) return;               // долг найден — источник точно видели
      var s = statusIstochnika(r, d.klyuchi);
      if (s === 'found' || s === 'not_found' || s === 'not_applicable') return;
      if (d.id === 'nalogi' && nn) {
        if (nn.svezhij) { if (nn.status === 'ok') nalogiNa = nn.data; return; }
        net.push(d.title + (nn.data ? ' (набор ФНС на\u00a0' + nn.data + ' старше ' + SVEZHEST_MES + '\u00a0месяцев)' : ''));
        return;
      }
      net.push(d.title);
    });
    var p = r && r.damia && r.damia.polnota;
    // ne-zaprashivali-v1 [команда]: все внешние реестры API пометил «не проверяли» (sostoyanie not_checked, damia v1.4) —
    // «ответили 0 из 7» читалось бы как сбой источников; их не запрашивали. Счёт «ответили N из M» тогда не пишем.
    var bl = [];
    if (r && r.damia) for (var k in r.damia) if (Object.prototype.hasOwnProperty.call(r.damia, k) && r.damia[k] && typeof r.damia[k] === 'object' && r.damia[k].nazvanie) bl.push(r.damia[k]);
    if (bl.length && bl.every(function (b) { return b.sostoyanie === 'not_checked'; })) p = null;
    return { spisok: net, dolgiVse: net.length === DOLGI.length, nalogiNa: nalogiNa, provereno: p && p.provereno != null ? p.provereno : null, iz: p && p.iz != null ? p.iz : null, data: r && (r.damia && r.damia.data_svedeniy || r.checked_at) || null };
  }

  function dataRu(s) { var t = String(s == null ? '' : s).trim(); if (/^\d{2}\.\d{2}\.\d{4}$/.test(t)) return t; var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t); if (m) return m[3] + '.' + m[2] + '.' + m[1]; var d = new Date(s); if (isNaN(d)) return ''; function z(n) { return (n < 10 ? '0' : '') + n; } return z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear(); }
  function mesText(m) { return m < 12 ? m + '\u00a0мес.' : ageText(m); }

  // «Как посчитали» — открытая формула предела под суммой (Прорыв «Ф», тексты Маркетинга 28.09, раздел 3.3).
  var CBR_FOINFO = 'https://www.cbr.ru/finorg/foinfo/';
  function bankSsylka(f) { return { t: 'Карточка организации на сайте Банка России', u: CBR_FOINFO + (f.ogrn ? '?ogrn=' + f.ogrn : '') }; }
  // predel-finorg-v1: текст — дословно из ТЗ [команда] 12.10 (pokupka-chestno п. 5); «Они платят мне» — то же словами продавца.
  function FINORG_TEKST(otg) {
    return 'Для банков и страховых организаций предел ' + (otg ? 'отсрочки' : 'предоплаты') + ' не считаем: за их устойчивостью следит Банк России.';
  }
  var FINORG_SSYLKA = 'Лицензию и отчётность — на сайте Банка России';
  function kakPoschitali(f, t, pc, reasonsList, np, napr, pv) {
    var R = pc.raschet || {}, kak = '', otg = napr === 'otgruzhaem', bankR = false;
    if (t === 'post' || t === 'stop') {
      var pr = f.status === 'LIQUIDATED' ? 'компания ликвидирована' : reorgPrekr(f) ? REORG_PR : (reasonsList[0] || (t === 'stop' ? 'стоп-признак в данных' : 'серьёзное замечание в данных'));
      kak = otg ? 'В долг — 0\u00a0₽: ' + pr + ' — ' + (f.status === 'LIQUIDATED' ? 'сделку не заключать.' : 'отгружайте после оплаты.')
        : 'Вперёд — 0\u00a0₽: ' + pr + ' — ' + (t === 'stop' ? 'не платите вперёд.' : 'платите после поставки или акта.');
    } else {
      var polovina = R.half ? ' · ' + (R.half === 'ostorozhno' ? 'долги не проверены' : zamechaniya(reasonsList)) + ' → половина: ' + money(R.itog) : '';
      if (R.base === 'finorg') {
        kak = FINORG_TEKST(otg); bankR = true;
      } else if (R.base === 'nol') {
        kak = 'Как посчитали: отчёт' + (R.otchetGod ? ' за ' + R.otchetGod : '') + ' в ГИР БО есть, но выручки в нём нет. Две недели нулевой выручки — 0 ₽, поэтому советуем ' + (otg ? 'отгружать после оплаты.' : 'платить по факту поставки.');
      } else if (R.malo) {
        kak = 'Как посчитали: выручка' + (R.revenueYear ? ' за ' + R.revenueYear : '') + ' — ' + moneyKrupno(R.revenue) + ' ÷ ' + DELITEL + ' = ' + money(R.dveNedeli) + (R.half ? ', половина — ' + money(R.doPolovinu / 2) : '') + '. ' + (otg ? MALO_OTG(R.half) : MALO_TEKST(R.half));
      } else if (R.base === 'revenue' && R.ageCapped) {
        kak = 'Как посчитали: две недели выручки — ' + moneyKrupno(R.dveNedeli) + ', но компании ' + mesText(R.ageMonths) + ' — не больше потолка для возраста до года: ' + money(R.byAge) + polovina + '.';
      } else if (R.base === 'revenue') {
        kak = 'Как посчитали: выручка' + (R.revenueYear ? ' за ' + R.revenueYear : '') + ' — ' + moneyKrupno(R.revenue) + ' ÷ ' + DELITEL + ' = ' + moneyKrupno(R.dveNedeli) + ' (две недели выручки)' + polovina + ', округлили вниз.';
      } else if (R.base === 'age') {
        kak = 'Как посчитали: выручки в отчётности нет — берём потолок по возрасту (' + ageText(R.ageMonths) + '): ' + money(R.byAge) + polovina + '.';
      } else {
        kak = 'Как посчитали: выручка и возраст неизвестны — берём осторожный потолок ' + money(R.byAge) + polovina + '.';
      }
    }
    var ne = '';
    if (pv) {
      ne = predvTekst(pv, otg) +
        (np && np.nalogiNa ? ' Долги по налогам — нет в списке ФНС на\u00a0' + np.nalogiNa + '.' : '') +
        (np && np.provereno != null && np.iz ? ' Из внешних реестров ответили ' + np.provereno + ' из ' + np.iz + (np.data ? ' на ' + dataRu(np.data) : '') + '.' : '');
    } else if (np && np.spisok.length && (t === 'go' || t === 'cap')) {
      ne = 'Не проверяли: ' + np.spisok.join(', ') + '. Если они есть — ' + (otg ? 'в долг лучше не отгружать.' : 'вперёд лучше не платить.') +
        (np.nalogiNa ? ' Долги по налогам — нет в списке ФНС на\u00a0' + np.nalogiNa + '.' : '') +
        (np.provereno != null && np.iz ? ' Из внешних реестров ответили ' + np.provereno + ' из ' + np.iz + (np.data ? ' на ' + dataRu(np.data) : '') + '.' : '');
    }
    if (otg && R.base !== 'finorg') kak = OBA_NAPRAVLENIYA + ' ' + kak;
    var out = { kak: kak, ne: ne,
      podpis: 'Ориентир Делоскопа, не норма закона. Методика — в разборе «Сколько платить вперёд незнакомой компании».', url: STATYA };
    if (bankR) out.ssylka = R.base === 'finorg' ? { t: FINORG_SSYLKA, u: bankSsylka(f).u } : bankSsylka(f);
    return out;
  }
  // Текст [команда] 02.10 19:37 (разд. 0) — когда предел меньше 10 000 ₽.
  function MALO_TEKST(half) {
    return 'Вперёд — не больше ' + (half ? 'половины двух недель' : 'двух недель') + ' выручки компании, а это меньше ' + money(MINIMUM) + '. Советуем платить по факту поставки.';
  }
  // otsrochka-pokupatelyu-v1 (ТЗ [команда] 05.10, разд. 1): «Они платят мне» — тот же предел словами продавца.
  var OBA_NAPRAVLENIYA = 'Предел — сколько денег разумно держать под риском у одной компании: и предоплатой, и отгрузкой в долг. Считаем одинаково.';
  function MALO_OTG(half) {
    return 'В долг — не больше ' + (half ? 'половины двух недель' : 'двух недель') + ' выручки компании, а это меньше ' + money(MINIMUM) + '. Советуем отгружать после оплаты.';
  }
  var STATYA = '/nalogi/skolko-platit-vpered-neznakomoj-kompanii/';
  var FORMULA = '/indeks/#predoplata';                     // та же формула словами и мини-расчёт этим кодом
  function zamechaniya(list) { var n = Math.max(1, list.length); return 'есть ' + n + ' ' + plural(n, 'замечание', 'замечания', 'замечаний'); }

  function reasonText(x) {
    var d = String(x.detail || '').trim();
    var generic = !d || /^(да|есть|внимание|нет данных|—)$/i.test(d);
    // otsrochka-pokupatelyu-v1: «1 937 ₽» не рвём между числом и ₽ на 390 px (замена — дословно из ответа [команда] 05.10)
    var s = generic ? x.title : x.title + ': ' + d.charAt(0).toLowerCase() + d.slice(1);
    return s.replace(/(\d)\s(?=\d{3}(?!\d))/g, '$1\u00a0').replace(/(\d)\s(?=(₽|%|млн|млрд|тыс\.))/g, '$1\u00a0');
  }
  function statusKod() {
    if (typeof self !== 'undefined' && self.StatusKod) return self.StatusKod;
    try { return typeof require === 'function' ? require('./status-kod.js') : null; } catch (e) { return null; }
  }
  function reasons(f) {
    var out = [];
    // status-tochno-v1: код состояния ЕГРЮЛ в ответе — точное название (js/status-kod.js), без кода — как раньше
    var SK = statusKod();
    if (SK && SK.vid(f.status, f.kod)) out.push(SK.fraza(f.status, f.kod));
    else if (f.status === 'LIQUIDATED') out.push('компания ликвидирована');
    else if (f.status === 'LIQUIDATING') out.push('компания ликвидируется или ФНС готовит её исключение из ЕГРЮЛ');
    else if (f.status === 'BANKRUPT') out.push('идёт банкротство');
    else if (f.status === 'REORGANIZING') out.push('идёт реорганизация');
    var order = ['diskv', 'nedost', 'block', 'exit', 'dolg', 'mass', 'fssp', 'rnp', 'director', 'staff', 'report', 'nagruzka', 'fines', 'other', 'young'];
    var pick = f.list.slice().sort(function (a, b) {
      return (a.status === b.status ? 0 : a.status === 'bad' ? -1 : 1) || order.indexOf(a.kind) - order.indexOf(b.kind);
    });
    if (f.zsk === 'high') out.push('высокий прогноз попадания в красную зону ЗСК');
    var vzyali = {};
    pick.forEach(function (x) { if (out.length < 3 && x.kind !== 'young') { vzyali[x.kind] = 1; out.push(reasonText(x).replace(/^./, function (c) { return c.toLowerCase(); })); } });
    if (f.ageMonths != null && f.ageMonths < 12 && out.length < 3) out.push('компании ' + ageText(f.ageMonths));
    // otchet-bez-vyruchki-v1 [команда] 05.10: признак штата уже в причинах («сотрудники: среднесписочная численность: 0») —
    // второй раз «в штате никого» не добавляем (на живом ответе стояло подряд)
    if ((f.staff === 0 || f.staff === 1) && !vzyali.staff) { if (out.length < 3) out.push(f.staff ? 'в штате 1 человек' : 'в штате никого'); }
    if (f.zsk === 'medium' && out.length < 3) out.push('средний прогноз ЗСК');
    return out.slice(0, 3);
  }

  // predvaritelno-v1 (аудит 22.10, приоритет 1 «Безопасность денежных рекомендаций»): ориентир, посчитанный без выручки
  // (по возрасту) или при непроверенных судах, приставах, долгах, — предварительный. Неизвестное не считаем безопасным:
  // заголовок не говорит «работать можно», совет по сумме — «до проверки по факту поставки», число — «после проверки».
  function headline(f, t, cap, malo, pv) {
    if (pv && t === 'go') return 'Предварительно: серьёзного не нашли';
    if (pv && t === 'cap' && !malo && cap != null) return 'Предварительно: есть замечания';
    if (f.status === 'LIQUIDATED') return 'Сделку не заключать';
    if (t === 'stop') return 'Не платите вперёд';
    if (t === 'post' && reorgPrekr(f)) return 'Только оплата по факту\u00a0— до проверки правопреемника';
    if (t === 'post') return 'Только оплата по факту';
    if (t === 'cap' && malo) return 'Можно, оплата — по факту поставки';
    if (t === 'cap') return 'Можно, предоплата — до ' + money(cap);
    return 'Работать можно';
  }
  function headlineOtg(f, t, cap, malo, pv) {
    if (pv && t === 'go') return 'Предварительно: серьёзного не нашли';
    if (pv && t === 'cap' && !malo && cap != null) return 'Предварительно: есть замечания';
    if (f.status === 'LIQUIDATED') return 'Сделку не заключать';
    if (t === 'stop') return 'Отгружайте только после оплаты';
    if (t === 'post' && reorgPrekr(f)) return 'Только по предоплате\u00a0— до проверки правопреемника';
    if (t === 'post') return 'Только по предоплате';
    if (t === 'cap' && malo) return 'Можно, но без отсрочки';
    if (t === 'cap' && cap == null) return 'Можно, но есть замечания';
    if (t === 'cap') return 'Можно, отсрочка — до ' + money(cap);
    return 'Работать можно';
  }
  function adviceOtg(f, t, malo) {
    // ликвидированной — первые две фразы прежнего совета: «счёт не оплачивайте» продавцу не о том
    if (f.status === 'LIQUIDATED') return 'Компания прекратила существование — в ЕГРЮЛ есть запись о прекращении. Новый договор с ней заключить нельзя.';
    if (f.status === 'BANKRUPT') return 'Новые отгрузки — только после оплаты и по согласованию с арбитражным управляющим.';
    if (f.status === 'LIQUIDATING') return 'В долг не отгружайте: новые обязательства компания может не исполнить.' + advice(f, t, malo).replace(/^[^.]*\./, '');
    if (t === 'post' && reorgPrekr(f)) return 'Отсрочку не давайте: отгрузка — после оплаты. ' + REORG_SDELAT + ' ' + REORG_DOLG;
    if (t === 'stop' || t === 'post') return 'Отсрочку не давайте: отгрузка — после оплаты. Если без отсрочки сделки не будет — только под банковскую гарантию платежа или аккредитив.';
    if (malo) return 'Отсрочку — только под банковскую гарантию платежа или аккредитив.';
    if (t === 'cap' && !f.finorg) return 'Больше предела — под банковскую гарантию или аккредитив. Держите долг покупателя в пределе: следующая отгрузка — после оплаты предыдущей.';
    return 'Сохраните досье с датой проверки: если покупатель задержит оплату, оно покажет, на каких данных вы дали отсрочку.';
  }
  function advice(f, t, malo) {
    if (f.status === 'LIQUIDATED') return 'Компания прекратила существование — в ЕГРЮЛ есть запись о прекращении. Новый договор с ней заключить нельзя, платить по такому счёту некому: счёт не оплачивайте.';
    if (f.status === 'BANKRUPT') return 'Платежи по новым сделкам — только по согласованию с арбитражным управляющим и после поставки.';
    if (f.status === 'LIQUIDATING') return 'Вперёд не платите: новые обязательства компания может не исполнить. Если она вам должна — не ждите: при ликвидации заявите требование ликвидатору, при исключении из ЕГРЮЛ — подайте в налоговую возражение, пока не истёк срок: три месяца со дня публикации решения в «Вестнике государственной регистрации», а если основание — 115-ФЗ, шесть (п. 3, 4, 7 ст. 21.1, ст. 21.3 129-ФЗ). Возражение, поданное в срок, останавливает исключение.';
    if (t === 'stop') return 'Если сделка нужна — платите после поставки или через аккредитив и сохраните это досье.';
    if (t === 'post' && reorgPrekr(f)) return 'Платите после поставки или акта. ' + REORG_SDELAT + ' ' + REORG_DOLG;
    if (t === 'post') return 'Платите после поставки или акта. Нужна предоплата — через аккредитив или под гарантию возврата аванса.';
    if (malo) return 'Нужна предоплата — через аккредитив или под гарантию возврата аванса.';
    if (t === 'cap' && !f.finorg) return 'Больше предела — частями по этапам, аккредитивом или под гарантию возврата аванса.';
    return 'Сохраните досье с датой проверки — оно может стать частью доказательств должной осмотрительности.';
  }

  // ---------- деньги на кону (ст. 54.1 НК) ----------
  // Два честных сценария: мягкий — налоговая признаёт реальность поставки и делает реконструкцию
  // (снимает вычет НДС + штраф 20%); жёсткий — умысел, без реконструкции (НДС и налог с расходов + штраф 40%). Пени — сверху.
  function atStake(amount, regime) {
    amount = parseAmount(amount);
    if (!amount) return null;
    if (regime === 'usn_d') return { soft: 0, hard: 0, zero: true };
    if (regime === 'usn_dr') { var t = amount * USN_DR; return { soft: 0, hard: t * (1 + FINE_HARD) }; }
    var vat = amount * VAT / (1 + VAT), profit = (amount - vat) * PROFIT;
    return { soft: vat * (1 + FINE_SOFT), hard: (vat + profit) * (1 + FINE_HARD), vat: vat };
  }

  function prepayAdvice(amount, cap, t, pv) {
    amount = parseAmount(amount);
    if (!amount) return '';
    if (cap == null && (t === 'go' || t === 'cap')) return '';
    if (t === 'stop' || t === 'post' || cap === 0) return 'Предоплату не вносите: ' + money(amount) + ' — после поставки или через аккредитив.';
    if (pv) return 'Ориентир предварительный: пока не проверите то, чего мы не видели, — платите по факту поставки. После проверки — ' +
      (amount <= cap ? 'сумма укладывается в ориентир.' : 'вперёд не больше ' + money(cap) + ' (' + Math.max(1, Math.floor(cap / amount * 100)) + '% суммы).');
    if (t === 'go' && amount <= cap) return 'Сумма в пределах ориентира — обычные условия подойдут.';
    if (amount <= cap) return 'Сумма в пределах ориентира: предоплата допустима.';
    var p = Math.max(1, Math.floor(cap / amount * 100));
    return 'Вперёд — не больше ' + money(cap) + ' (' + p + '% суммы), остальное — после поставки.';
  }

  function otgruzkaAdvice(amount, cap, t, pv) {
    amount = parseAmount(amount);
    if (!amount) return '';
    if (cap == null && (t === 'go' || t === 'cap')) return '';
    if (t === 'stop' || t === 'post' || cap === 0) return 'В долг не отгружайте: ' + money(amount) + ' — после оплаты.';
    if (pv) return 'Ориентир предварительный: пока не проверите то, чего мы не видели, — отгружайте после оплаты. После проверки — ' +
      (amount <= cap ? 'сумма укладывается в ориентир.' : 'в долг не больше ' + money(cap) + ' (' + Math.max(1, Math.floor(cap / amount * 100)) + '% суммы).');
    if (amount <= cap) return 'Сумма в пределах ориентира — отсрочка допустима.';
    var p = Math.max(1, Math.floor(cap / amount * 100));
    return 'В долг — не больше ' + money(cap) + ' (' + p + '% суммы), остальное — предоплатой.';
  }

  // ---------- что запросить ----------
  // Соразмерно сумме — так требует п. 16 письма ФНС от 10.03.2021 № БВ-4-7/3060@:
  // чем крупнее сделка, тем больше подтверждений реальности контрагента.
  var DOCS = {
    power: { links: [{ t: 'проверить электронную доверенность (ФНС)', u: 'https://m4d.nalog.gov.ru/emchd/check-status' }, { t: 'нотариальную (ФНП)', u: 'https://www.reestr-dover.ru/' }], t: 'Документ о полномочиях подписанта', why: 'решение или протокол о назначении директора либо доверенность — чтобы договор подписал тот, кто вправе', ask: 'Документ о полномочиях подписанта договора: решение о назначении директора или доверенность' },
    powerNew: { links: [{ t: 'проверить электронную доверенность (ФНС)', u: 'https://m4d.nalog.gov.ru/emchd/check-status' }, { t: 'нотариальную (ФНП)', u: 'https://www.reestr-dover.ru/' }], t: 'Решение о назначении нового директора и его подпись на договоре', why: 'руководитель сменился недавно — убедитесь, что подписывает именно он, и созвонитесь с ним', ask: 'Решение (протокол) о назначении действующего директора' },
    card: { links: [{ t: 'проверить счёт в Делоскопе', u: '/proverit-schet/' }], t: 'Карточка с реквизитами за подписью директора', why: 'счёт для оплаты должен совпадать с карточкой — так вы защищаетесь от подмены реквизитов', ask: 'Карточка компании с банковскими реквизитами за подписью директора' },
    premises: { t: 'Документ на помещение по юридическому адресу', why: 'договор аренды или право собственности — ответ на отметку о недостоверности или «массовый» адрес', ask: 'Документ на помещение по юридическому адресу (договор аренды или выписка о праве собственности)' },
    fixRecord: { t: 'Подтверждение, что запись в ЕГРЮЛ исправлена', why: 'пока отметка о недостоверности стоит, банк может задержать ваш платёж', ask: 'Подтверждение исправления сведений в ЕГРЮЛ (лист записи)' },
    taxCert: { t: 'Справка об исполнении обязанности по уплате налогов (КНД 1120101)', why: 'не старше 10 дней — показывает, погашен ли долг перед бюджетом', ask: 'Справка об исполнении обязанности по уплате налогов (КНД 1120101), не старше 10 дней' },
    resources: { t: 'Подтверждение ресурсов: люди, склад, техника', why: 'штат, аренда склада, ПТС или договоры субподряда — кто и чем будет исполнять договор (п. 14–15 письма ФНС)', ask: 'Сведения о ресурсах для исполнения договора: штат, склад или техника либо договоры субподряда' },
    experience: { t: '2–3 исполненных похожих договора или отзывы клиентов', why: 'опыт и деловая репутация — прямо названы ФНС среди признаков реальной компании', ask: 'Копии 2–3 исполненных договоров, похожих на наш (цены можно скрыть), или отзывы клиентов' },
    regime: { t: 'Подтверждение режима налогообложения', why: 'для вычета НДС нужен счёт-фактура от плательщика НДС; на УСН — уведомление о переходе', ask: 'Подтверждение режима налогообложения (для УСН — уведомление о переходе)' },
    fssp: { t: 'Пояснение по долгам у приставов', why: 'как и когда погасят: при аресте счёта ваша предоплата застрянет', ask: 'Информация о погашении исполнительных производств или план погашения' },
    unblock: { t: 'Решение ФНС об отмене приостановления операций по счёту', why: 'пока счёт заблокирован налоговой, компания не сможет тратить ваши деньги', ask: 'Решение налоговой об отмене приостановления операций по счёту' },
    bank: { t: 'Письмо о том, что счёт не ограничен банком, и реквизиты второго банка', why: 'прогноз ЗСК повышен — запасной счёт спасёт сделку, если банк остановит платёж', ask: 'Подтверждение, что расчётный счёт не ограничен, и реквизиты второго банка' },
    license: { t: 'Лицензия или выписка из СРО, если работа этого требует', why: 'строительство, перевозки, медицина — без допуска сделку могут признать недействительной', ask: 'Лицензия или выписка из реестра СРО — если работы по договору этого требуют' },
    // только «Они платят мне» (ТЗ [команда] 05.10, документ команды, п. 1.1)
    otchetnostBank: { t: 'Бухгалтерская (финансовая) отчётность за последний год', why: 'у кредитной организации её раскрывает Банк России — в открытых данных ФНС её может не быть', ask: 'Ссылка на раскрытую бухгалтерскую (финансовую) отчётность за последний год — на сайте организации или Банка России', links: [{ t: 'cbr.ru', u: CBR_FOINFO }] },
    otchetnost: { t: 'Бухгалтерская отчётность за последний год', why: 'в открытых данных её нет — без выручки предел отсрочки считается по возрасту компании, осторожно', ask: 'Бухгалтерская отчётность за последний год с квитанцией о сдаче в налоговую' },
    poruchitel: { t: 'Поручительство директора или участника', why: 'если покупатель не оплатит, долг можно потребовать и с поручителя (ст. 361 ГК РФ) — работает, только если у поручителя есть имущество', ask: 'Согласие директора или участника подписать договор поручительства по оплате поставок' }
  };
  function docItem(id) { return { id: id, title: DOCS[id].t, why: DOCS[id].why, ask: DOCS[id].ask || DOCS[id].t, links: DOCS[id].links || [] }; }

  function docs(f, t, amount, regime) {
    amount = parseAmount(amount);
    var ids = [];
    function add(id) { if (ids.indexOf(id) < 0) ids.push(id); }
    var big = !amount || amount >= 1000000, mid = !amount || amount >= 100000;
    add(f.bad.director || f.warn.director ? 'powerNew' : 'power');
    add('card');
    if (f.bad.nedost || f.warn.nedost) { add('fixRecord'); add('premises'); }
    if (f.bad.mass || f.warn.mass) add('premises');
    if (f.bad.block || f.warn.block) add('unblock');
    if (f.bad.dolg || f.warn.dolg) add('taxCert');
    if (f.bad.fssp || f.warn.fssp) add('fssp');
    if (f.zsk === 'medium' || f.zsk === 'high') add('bank');
    if (f.bad.staff || f.warn.staff || f.staff === 0 || f.staff === 1 || f.warn.young || (mid && t !== 'go')) add('resources');
    if (big || t === 'post' || t === 'stop') add('experience');
    if (regime !== 'usn_d' && (f.bad.nagruzka || f.warn.nagruzka || big)) add('regime');
    if (big) add('license');
    return ids.slice(0, 7).map(docItem);
  }

  // «Они платят мне»: продавцу важно «заплатит ли и будет ли с кого взыскать», а не «реален ли исполнитель» —
  // без regime, resources, license, card, experience; плюс otchetnost и poruchitel (ТЗ п. 1.1, порядок оттуда же)
  function docsOtg(f, t, amount, cap) {
    amount = parseAmount(amount);
    var ids = [];
    function add(id) { if (ids.indexOf(id) < 0) ids.push(id); }
    add(f.bad.director || f.warn.director ? 'powerNew' : 'power');
    if (f.bad.fssp || f.warn.fssp) add('fssp');
    if (f.bad.dolg || f.warn.dolg) add('taxCert');
    if (f.bad.block || f.warn.block) add('unblock');
    if (f.zsk === 'medium' || f.zsk === 'high') add('bank');
    if (f.bad.nedost || f.warn.nedost) { add('fixRecord'); add('premises'); }
    if (f.bad.mass || f.warn.mass) add('premises');
    // отчётность — только у действующей: при ликвидации, банкротстве, исключении вопрос другой —
    // требование к ликвидатору или в деле о банкротстве (✎ ответ [команда] 05.10, разд. 4)
    var neDejstvuet = f.status === 'LIQUIDATING' || f.status === 'LIQUIDATED' || f.status === 'BANKRUPT' || !!f.bad.exit;
    if (!f.revenue && !f.vyruchkaNol && !neDejstvuet) add(f.kredit ? 'otchetnostBank' : 'otchetnost');
    // «стоп» — отгрузка только после оплаты, поручительство не помогает (решение потока, ✎ [команда])
    if (t !== 'stop' && cap !== null && (amount ? amount > (cap || 0) : t === 'cap')) add('poruchitel');
    return ids.slice(0, 7).map(docItem);
  }

  function letter(f, list, amount) {
    amount = parseAmount(amount);
    var lines = list.map(function (d, i) { return (i + 1) + '. ' + (d.ask || d.title) + '.'; }).join('\n');
    var subj = 'Документы для договора — ' + f.name;
    var body = 'Добрый день!\n\n' +
      'Готовимся заключить договор с ' + f.name + (f.inn ? ' (ИНН ' + f.inn + ')' : '') +
      (amount ? ' на сумму ' + money(amount).replace(/ /g, ' ') : '') + '. ' +
      'По нашим внутренним правилам проверки контрагентов просим прислать скан-копии:\n\n' + lines + '\n\n' +
      'Это стандартная процедура должной осмотрительности (ст. 54.1 НК РФ, письмо ФНС России от 10.03.2021 № БВ-4-7/3060@) — ' +
      'мы проходим её со всеми партнёрами. Будем благодарны за ответ в течение трёх рабочих дней.\n\n' +
      'С уважением,\n[Имя, должность]\n[Компания, телефон]';
    return { subject: subj, body: body };
  }

  function letterOtg(f, list, amount) {
    amount = parseAmount(amount);
    var lines = list.map(function (d, i) { return (i + 1) + '. ' + (d.ask || d.title) + '.'; }).join('\n');
    var subj = 'Документы для отгрузки с отсрочкой платежа — ' + f.name;
    var body = 'Добрый день!\n\n' +
      'Готовимся отгрузить ' + f.name + (f.inn ? ' (ИНН ' + f.inn + ')' : '') + ' с отсрочкой платежа' +
      (amount ? ' на сумму ' + money(amount).replace(/\u00a0/g, ' ') : '') + '. ' +
      'По нашим внутренним правилам работы с покупателями просим прислать скан-копии:\n\n' + lines + '\n\n' +
      'Мы проходим эту процедуру со всеми покупателями, которым даём отсрочку. Будем благодарны за ответ в течение трёх рабочих дней.\n\n' +
      'С уважением,\n[Имя, должность]\n[Компания, телефон]';
    return { subject: subj, body: body };
  }

  // Почему ориентир предварительный: { baza: 'age'|'unknown'|null, ne: ['арбитражные суды', 'долги у приставов', …] } или null.
  // Только для тонов go и cap: «по факту» и «стоп» и так ничего не разрешают. Банку и страховой предел не считаем — база не нужна.
  var PREDV_BAZA = { age: 'выручки в отчётности нет — предел посчитан по возрасту компании', unknown: 'выручка и возраст неизвестны — предел посчитан осторожным потолком' };
  function predvaritelno(r, f, t, pc, np) {
    if (t !== 'go' && t !== 'cap') return null;
    if (pc.malo || pc.cap === 0) return null;            // вперёд и так 0 ₽ — разрешать нечего
    var R = pc.raschet || {}, baza = !pc.finorg && (R.base === 'age' || R.base === 'unknown') ? R.base : null, ne = [];
    (np && np.spisok || []).forEach(function (x) { ne.push(x); });
    neProverenyPodrobno(r).forEach(function (x) {
      var t2 = x.k === 'fssp' ? 'долги у приставов' : x.t;
      if (ne.some(function (y) { return y.indexOf(t2) === 0; })) return;
      ne.push(t2);
    });
    if (!baza && !ne.length) return null;
    return { baza: baza, prichina: baza ? PREDV_BAZA[baza] : '', ne: ne };
  }
  function predvTekst(pv, otg) {
    var a = [];
    if (pv.ne.length) a.push('не проверяли ' + pv.ne.join(', '));
    if (pv.prichina) a.push(pv.prichina);
    return 'Ориентир предварительный: ' + a.join('; ') + '. Не проверено — не значит «в порядке»: ' + (otg ? 'в долг не отгружайте' : 'вперёд не платите') + ', пока не проверите' + (pv.baza && !pv.ne.length ? ' отчётность' : '') + '.';
  }
  function decide(r, opts) {
    opts = opts || {};
    var f = facts(r), t = tone(f), np = neProvereno(r, f), pc = prepayCap(f, t, np), amount = parseAmount(opts.amount), regime = opts.regime || 'osno';
    var pv = predvaritelno(r, f, t, pc, np);
    var list = docs(f, t, amount, regime);
    if (opts.napravlenie === 'otgruzhaem') {
      // «Они платят мне»: число то же (pc.cap), меняются слова; ст. 54.1 — про вычеты покупателя, «На кону» не считаем;
      // список и письмо — свои (docsOtg, letterOtg): без card, regime, resources, license, experience и без ст. 54.1
      list = docsOtg(f, t, amount, pc.cap);
      return sFinorg(pc, {
        napravlenie: 'otgruzhaem',
        facts: f, tone: t, cap: pc.cap, malo: !!pc.malo, capRule: pc.rule, raschet: pc.raschet, neProvereno: np,
        kak: kakPoschitali(f, t, pc, reasons(f), np, 'otgruzhaem', pv),
        headline: headlineOtg(f, t, pc.cap, pc.malo, pv), reasons: reasons(f), advice: adviceOtg(f, t, pc.malo),
        amount: amount, regime: regime, stake: null, prepay: otgruzkaAdvice(amount, pc.cap, t, pv),
        docs: list, letter: letterOtg(f, list, amount)
      }, pv);
    }
    return sFinorg(pc, {
      facts: f, tone: t, cap: pc.cap, malo: !!pc.malo, capRule: pc.rule, raschet: pc.raschet, neProvereno: np,
      kak: kakPoschitali(f, t, pc, reasons(f), np, null, pv),
      headline: headline(f, t, pc.cap, pc.malo, pv), reasons: reasons(f), advice: advice(f, t, pc.malo),
      amount: amount, regime: regime, stake: atStake(amount, regime), prepay: prepayAdvice(amount, pc.cap, t, pv),
      docs: list, letter: letter(f, list, amount)
    }, pv);
  }
  // finorg — только у банка или страховой: у остальных вывод побайтно прежний (снимок tests/otsrochka_pokupatelyu.test.js);
  // predvaritelno — только когда ориентир предварительный (predvaritelno-v1)
  function sFinorg(pc, v, pv) { if (pc.finorg) v.finorg = true; if (pv) v.predvaritelno = pv; return v; }

  // ---------- интерфейс ----------
  var CSS = '' +
    '.usl{border-radius:16px;background:var(--bg,#F5F5F2);padding:18px 18px 16px;display:flex;flex-direction:column;gap:12px;color:var(--ink,#1D1D1F)}' +
    '.usl-h{display:flex;gap:12px;align-items:flex-start}' +
    '.usl-mark{flex:none;width:12px;height:12px;border-radius:50%;margin-top:7px;box-shadow:0 0 0 4px rgba(22,114,63,.14);background:#16723F}' +
    '.usl.cap .usl-mark{background:#C27A00;box-shadow:0 0 0 4px rgba(194,122,0,.16)}' +
    '.usl.post .usl-mark,.usl.stop .usl-mark{background:#B3261E;box-shadow:0 0 0 4px rgba(179,38,30,.14)}' +
    '.usl-t{font-size:20px;line-height:1.3;font-weight:600;letter-spacing:-.01em}' +
    '.usl-r{margin:4px 0 0;font-size:15px;color:var(--ink2,#48484C)}' +
    '.usl-a{margin:0;font-size:15px;color:var(--ink2,#48484C)}' +
    '.usl-cap{font-size:13px;color:var(--muted,#6B6B70)}' +
    '.usl-kak{display:flex;flex-direction:column;gap:6px;border-top:1px solid #E6E6E1;padding-top:10px}' +
    '.usl-kak p{margin:0;font-size:15px;color:var(--ink2,#48484C);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}' +
    '.usl-kak .usl-ne{color:#8A5A00;background:#FFF6E0;border-radius:10px;padding:8px 10px}' +
    '.usl-kak a{color:var(--accent,#0B63E5)}' +
    '.usl-sum{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;border-top:1px solid #E6E6E1;padding-top:12px}' +
    '.usl-sum label{font-size:13px;color:var(--muted,#6B6B70);grid-column:1/-1}' +
    '.usl-in{display:flex;align-items:center;background:#fff;border:1px solid #DADAD4;border-radius:10px;padding:0 12px;min-width:0}' +
    '.usl-in:focus-within{border-color:var(--accent,#0B63E5);box-shadow:0 0 0 3px rgba(11,99,229,.15)}' +
    '.usl-in input{border:0;outline:0;font:inherit;font-size:17px;padding:10px 0;width:100%;min-width:0;background:transparent;font-variant-numeric:tabular-nums}' +
    '.usl-in span{color:var(--muted,#6B6B70)}' +
    '.usl select{font:inherit;font-size:15px;border:1px solid #DADAD4;border-radius:10px;padding:10px 30px 10px 12px;background:#fff;max-width:190px;color:inherit}' +
    '.usl-out{display:flex;flex-direction:column;gap:6px;font-size:15px}' +
    '.usl-out b{font-variant-numeric:tabular-nums}' +
    '.usl-out .z{color:var(--ok,#16723F)}' +
    '.usl details{border-top:1px solid #E6E6E1;padding-top:10px}' +
    '.usl summary{cursor:pointer;font-weight:600;font-size:15px;list-style:none;display:flex;justify-content:space-between;gap:10px}' +
    '.usl summary::-webkit-details-marker{display:none}' +
    '.usl summary:after{content:"";width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin:5px 4px 0 0;transition:transform .2s}' +
    '.usl details[open] summary:after{transform:rotate(-135deg);margin-top:9px}' +
    '.usl summary small{font-weight:400;color:var(--muted,#6B6B70);font-size:13px;margin-left:6px}' +
    '.usl ol{margin:10px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:8px;font-size:15px}' +
    '.usl ol span{display:block;color:var(--muted,#6B6B70);font-size:13px}' +
    '.usl ol a{color:var(--accent,#0B63E5);text-decoration:none;overflow-wrap:anywhere}.usl ol a:hover{text-decoration:underline}' +
    '.usl-note{font-size:13px;color:var(--muted,#6B6B70);margin:10px 0 0}' +
    '.usl-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}' +
    '.usl-btns button,.usl-btns a{border:1px solid #D9D9D4;background:#fff;font:inherit;font-size:15px;font-weight:600;border-radius:10px;padding:9px 14px;cursor:pointer;color:var(--ink,#1D1D1F);text-decoration:none}' +
    '.usl-btns button:hover,.usl-btns a:hover{border-color:var(--accent,#0B63E5);color:var(--accent,#0B63E5)}' +
    '.usl-napr{display:flex;gap:0;padding:3px;margin:-2px 0 2px;background:rgba(0,0,0,.055);border-radius:10px;align-self:flex-start;max-width:100%}' +
    '.usl-napr button{min-height:36px;padding:0 14px;border:0;border-radius:9px;background:transparent;font:inherit;font-size:15px;font-weight:500;line-height:1.15;color:var(--ink2,#48484C);cursor:pointer;white-space:nowrap}' +
    '@media (max-width:640px),(pointer:coarse){.usl-napr button,.usl-btns button,.usl-btns a{min-height:44px}.usl-btns a{display:inline-flex;align-items:center}}' + /* otchet-detali-v1: поле касания 44 px на телефоне */
    '.usl-napr button[aria-pressed=true]{background:#fff;color:var(--ink,#1D1D1F);box-shadow:0 1px 3px rgba(0,0,0,.1)}' +
    '.usl-napr button:focus-visible{outline:2px solid var(--accent,#0B63E5);outline-offset:1px}' +
    '.usl-watch{align-self:flex-start;font-size:15px;line-height:1.35;color:var(--accent,#0B63E5);text-decoration:none;border:1px solid #D9D9D4;background:#fff;border-radius:10px;padding:8px 12px}' +
    '.usl-watch:hover{border-color:var(--accent,#0B63E5)}' +
    '@media (max-width:520px){.usl-napr{align-self:stretch}.usl-napr button{flex:1 1 0;padding:0 8px}}' +
    '@media (max-width:520px){.usl{padding:16px 14px}.usl-t{font-size:17px}.usl-sum{grid-template-columns:1fr}.usl select{max-width:none;width:100%}}' +
    '@media print{.usl .usl-napr,.usl .usl-watch,.usl .usl-sum,.usl .usl-btns,.usl summary:after{display:none!important}.usl details>*{display:block}.usl{background:none;border:1px solid #E6E6E1}}';

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  CSS += '.usl-rynok{margin:-4px 0 0;font-size:13px;line-height:1.45;color:var(--muted,#6B6B70)}';
  function injectCss(doc) {
    if (doc.getElementById('usl-css')) return;
    var s = doc.createElement('style'); s.id = 'usl-css'; s.textContent = CSS; doc.head.appendChild(s);
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } }

  // Пояснение под выводом из r.verdict — без повтора самого вывода: «Работать можно. Серьёзных…» под «Работать можно» → «Серьёзных…».
  function bezPovtora(verdict, zag) {
    var t = String(verdict == null ? '' : verdict).replace(/^Вывод:\s*/i, '').trim();
    var h = String(zag || '').trim();
    if (h && t.toLowerCase().indexOf(h.toLowerCase()) === 0) t = t.slice(h.length).replace(/^[\s.,:;!—–-]+/, '');
    return t.replace(/[.\s]+$/, '');
  }

  // platyat-pozzhe-v1: «Для сравнения: около четверти счетов… с опозданием» — только под выводом с пределом предоплаты
  // (тон go/cap и предел > 0; не при «только по факту», «не платить» и «советуем платить по факту»). Текст и срок — из
  // window.DLK_RYNOK (главная, tests/sobrat_rynok.py из data/rynok.json); PDF-досье и Паспорт его не передают — там только факты о компании.
  function rynokStroka(rynok, v, seichas) {
    if (!rynok || !rynok.tekst || !v || (v.tone !== 'go' && v.tone !== 'cap') || !(v.cap > 0) || v.malo) return '';
    var konec = Date.parse(String(rynok['do'] || '') + 'T00:00:00+03:00');
    if (!isFinite(konec) || (seichas == null ? Date.now() : seichas) >= konec) return '';
    return String(rynok.tekst);
  }

  // chestnyj-vyvod-v1 [команда] 11.10 (v1.1 — по словам [команда] 11.10 разд. 2): «Серьёзных признаков риска не найдено»
  // из r.verdict честно только тогда, когда суды, банкротство и приставы проверены. Не подключены (sostoyanie = not_checked) —
  // «Не проверяли: …»; не ответили — «Не ответили в этот раз: …»; разные причины — «Пока не проверяем: … Не ответили в этот раз: …».
  var KLYUCHEVYE = [{ k: 'sudy', t: 'арбитражные суды' }, { k: 'bankrotstvo', t: 'банкротство' }, { k: 'fssp', t: 'приставы' }];
  function neProverenyPodrobno(r) {
    var dm = r && r.damia;
    if (!dm || typeof dm !== 'object') return [];
    var out = [];
    KLYUCHEVYE.forEach(function (x) {
      var b = dm[x.k];
      if (!b || typeof b !== 'object') return;
      if (b.sostoyanie) { if (b.sostoyanie === 'not_checked') out.push({ k: x.k, t: x.t, nep: true }); return; }
      if (['found', 'not_found', 'not_applicable'].indexOf(b.status) < 0) out.push({ k: x.k, t: x.t, nep: false });
    });
    return out;
  }
  function neProverenyKlyuchevye(r) { return neProverenyPodrobno(r).map(function (x) { return x.t; }); }
  // poyasnenie — уже без повтора вывода (bezPovtora); меняем только «не найдено/нет» без найденных причин
  function chestnoPoyasnenie(r, poyasnenie) {
    var t = String(poyasnenie == null ? '' : poyasnenie), np = neProverenyPodrobno(r);
    if (!np.length || !/(не\s+найден|не\s+обнаружен|признаков\s+(риска\s+)?нет|сигналов\s+нет)/i.test(t)) return t;
    function sp(xs) { return xs.map(function (x) { return x.t; }).join(', '); }
    var poka = np.filter(function (x) { return x.nep; }), net = np.filter(function (x) { return !x.nep; });
    var nach = !net.length ? 'Не проверяли: ' + sp(poka)
      : !poka.length ? 'Не ответили в\u00a0этот раз: ' + sp(net)
      : 'Пока не проверяем: ' + sp(poka) + '. Не ответили в\u00a0этот раз: ' + sp(net);
    // «В найденных данных серьёзных сигналов нет» уже стоит рядом, в блоке Индекса, — здесь не повторяем
    // [команда] 11.10 разд. 1: две фразы вместо тире; «— ссылки ниже» не ставим — блок стоит и на экране, и в PDF-досье,
    // где ссылок «проверьте сами» под ним может не быть (условие [команда]: «ссылки ниже» — только если они есть на этом экране)
    return nach + '. Перед крупной оплатой посмотрите их сами';
  }

  // ne-povtor-v1 [команда] 11.10: какие реестры уже названы в выводе («Не проверяли: …») — ключи damia (sudy, bankrotstvo, fssp).
  // Нужны «Существенным фактам», чтобы строка под ними не повторяла вывод. Причины в выводе есть — строки «Не проверяли» нет → [].
  function vVyvode(r) {
    try {
      var v = decide(r, {});
      if (v.reasons.length) return [];
      var baza = bezPovtora(r && r.verdict, v.headline);
      if (chestnoPoyasnenie(r, baza) === String(baza == null ? '' : baza)) return [];
      return neProverenyPodrobno(r).map(function (x) { return x.k; });
    } catch (e) { return []; }
  }

  function cel(imya) { try { if (typeof window !== 'undefined' && window.dlkGoal) window.dlkGoal(imya); } catch (_) { /* Метрика не мешает */ } }
  var NAPR = [{ id: 'platim', t: 'Я плачу им' }, { id: 'otgruzhaem', t: 'Они платят мне' }];

  // mount(el, r, {compact, open, bezNapr}) — рисует карточку в el, возвращает объект с методом update().
  // bezNapr — без переключателя «Я плачу им / Они платят мне» (PDF-досье): текст — в выбранном раньше режиме.
  function mount(el, r, o) {
    o = o || {};
    if (!r || !r.company || !r.company.inn) throw new Error('usloviya: нет данных о компании');
    var doc = el.ownerDocument; injectCss(doc);
    var uid = 'usl' + Math.random().toString(36).slice(2, 7);
    var st = { amount: o.amount || 0, regime: store('usl.regime') || 'osno', napravlenie: store('usl.napr') === 'otgruzhaem' ? 'otgruzhaem' : 'platim' };
    var celi = {};                                         // цели Метрики — один раз за проверку (за mount)
    var box = doc.createElement('section');
    box.setAttribute('aria-label', 'Условия сделки');
    el.innerHTML = ''; el.appendChild(box);

    function draw(keepFocus) {
      var v = decide(r, st), f = v.facts;
      box.className = 'usl ' + v.tone;
      var why = v.reasons.length ? v.reasons.join(', ') : chestnoPoyasnenie(r, bezPovtora(r && r.verdict, v.headline)); // точку ставит строка ниже — без «найдено..»
      var stake = '';
      if (v.stake) {
        stake = v.stake.zero
          ? '<div class="z">На вашем режиме расходы не уменьшают налог — налоговый риск по этому поставщику нулевой. Остаются риск денег и 115-ФЗ.</div>'
          : '<div>На кону при претензии налоговой: <b>' + (v.stake.soft ? money(v.stake.soft).replace(/\s₽$/, '') + '–' : 'до\u00a0') + money(v.stake.hard) + '</b> плюс пени. Досье Делоскопа — ваш довод, что поставщика проверили.</div>';
      }
      var sel = REGIMES.map(function (x) { return '<option value="' + x.id + '"' + (x.id === st.regime ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('');
      var openAttr = o.open ? ' open' : '', otg = v.napravlenie === 'otgruzhaem';
      var rynok = o.compact ? '' : rynokStroka(o.rynok, v);
      var napr = (o.compact || o.bezNapr) ? '' : '<div class="usl-napr" role="group" aria-label="Кто кому платит">' + NAPR.map(function (x) {
        return '<button type="button" data-napr="' + x.id + '" aria-pressed="' + (x.id === st.napravlenie) + '">' + esc(x.t) + '</button>'; }).join('') + '</div>';
      var watch = otg && (v.tone === 'go' || v.tone === 'cap') && v.facts.status !== 'LIQUIDATED'
        ? '<a class="usl-watch" href="/cabinet.html#watch">Поставьте покупателя на слежение, пока за ним долг: при следующей проверке отчёт покажет, что изменилось</a>' : '';
      box.innerHTML = napr +
        '<div class="usl-h"><span class="usl-mark" aria-hidden="true"></span><div>' +
          '<div class="usl-t">' + esc(v.headline) + '</div>' +
          (why ? '<p class="usl-r">' + esc(why.charAt(0).toUpperCase() + why.slice(1)) + '.</p>' : '') +
        '</div></div>' +
        '<p class="usl-a">' + esc(v.advice) + '</p>' + (rynok ? '<p class="usl-rynok">' + esc(rynok) + '</p>' : '') + watch +
        (o.compact ? '' :
        '<div class="usl-sum"><label for="' + uid + 'a">' + (otg ? 'Сумма отгрузки' : 'Сумма сделки — посчитаем предоплату и деньги на кону') + '</label>' +
          '<div class="usl-in"><input id="' + uid + 'a" inputmode="numeric" autocomplete="off" placeholder="например, 500 000" value="' + (st.amount ? esc(money(st.amount).replace(/ ₽$/, '')) : '') + '"><span>₽</span></div>' +
          (otg ? '' : '<select aria-label="Ваш режим налогов">' + sel + '</select>') + '</div>' +
        (v.amount && (v.prepay || stake) ? '<div class="usl-out" aria-live="polite">' + (v.prepay ? '<div>' + esc(v.prepay) + '</div>' : '') + stake + '</div>' : '')) +
        '<div class="usl-kak" data-u="kak"><p>' + esc(v.kak.kak) + '</p>' +
          (v.kak.ne ? '<p class="usl-ne">' + esc(v.kak.ne) + '</p>' : '') +
          (v.kak.ssylka ? '<p class="usl-ne" data-u="bank"><a href="' + esc(v.kak.ssylka.u) + '" target="_blank" rel="noopener">' + esc(v.kak.ssylka.t) + ' →</a></p>' : '') +
          '<p class="usl-cap">Ориентир Делоскопа, не норма закона. <a href="' + FORMULA + '">Открытая формула предела</a>; пример — в разборе <a href="' + STATYA + '">«Сколько платить вперёд незнакомой компании»</a>.</p>' +
        '</div>' +
        '<details' + openAttr + '><summary><span>Что запросить у них<small>' + v.docs.length + ' ' + plural(v.docs.length, 'документ', 'документа', 'документов') + '</small></span></summary>' +
          '<ol>' + v.docs.map(function (d) { return '<li>' + esc(d.title) + '<span>' + esc(d.why) + (d.links.length ? ' · ' + d.links.map(function (l) { return '<a href="' + esc(l.u) + '"' + (/^https?:/.test(l.u) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(l.t) + '</a>'; }).join(', ') : '') + '</span></li>'; }).join('') + '</ol>' +
          '<p class="usl-note">' + (otg ? 'Список зависит от суммы отгрузки и найденных признаков.' : 'Список соразмерен сумме сделки — так требует п. 16 письма ФНС от 10.03.2021 № БВ-4-7/3060@.') + '</p>' +
          '<div class="usl-btns"><button type="button" data-u="copy">Скопировать письмо</button>' +
          '<a data-u="mail" href="mailto:?subject=' + encodeURIComponent(v.letter.subject) + '&body=' + encodeURIComponent(v.letter.body) + '">Открыть в почте</a></div>' +
        '</details>';
      if (window.DlkTipo) window.DlkTipo.uzly(box);       // detali-v1: без висячих предлогов, как в статьях
      var inp = box.querySelector('input'), s = box.querySelector('select');
      if (inp) {
        inp.addEventListener('input', function () {
          var pos = inp.value.length; st.amount = parseAmount(inp.value);
          if (st.napravlenie === 'otgruzhaem' && st.amount && !celi.summa) { celi.summa = 1; cel('usl_otgruzhaem_summa'); }
          clearTimeout(inp._t); inp._t = setTimeout(function () { draw(true); }, 350);
          void pos;
        });
        if (keepFocus) { inp.focus(); var L = inp.value.length; try { inp.setSelectionRange(L, L); } catch (_) {} }
      }
      if (s) s.addEventListener('change', function () { st.regime = s.value; store('usl.regime', s.value); draw(); });
      Array.prototype.forEach.call(box.querySelectorAll('[data-napr]'), function (b) {
        b.addEventListener('click', function () {
          var n = b.getAttribute('data-napr');
          if (n === st.napravlenie) return;
          st.napravlenie = n; store('usl.napr', n);
          if (n === 'otgruzhaem' && !celi.otg) { celi.otg = 1; cel('usl_otgruzhaem'); }
          draw();
          var nb = box.querySelector('[data-napr="' + n + '"]'); if (nb) nb.focus();
        });
      });
      var cp = box.querySelector('[data-u="copy"]');
      if (cp) cp.addEventListener('click', function () {
        var txt = 'Тема: ' + v.letter.subject + '\n\n' + v.letter.body;
        var done = function () { cp.textContent = 'Письмо скопировано'; };
        try { navigator.clipboard.writeText(txt).then(done, function () { window.prompt('Скопируйте письмо:', txt); }); } catch (_) { window.prompt('Скопируйте письмо:', txt); }
      });
      return v;
    }
    var last = draw();
    return { update: function (a) { if (a != null) st.amount = parseAmount(a); last = draw(); return last; }, get result() { return last; } };
  }

  return {
    decide: decide, mount: mount, rynokStroka: rynokStroka, facts: facts, tone: tone, reorgPrekr: reorgPrekr, REORG_PREKRASHCHENIE: REORG_PREKRASHCHENIE, REORG_SDELAT: REORG_SDELAT, REORG_DOLG: REORG_DOLG, prepayCap: prepayCap, atStake: atStake,
    docs: docs, letter: letter, parseAmount: parseAmount, money: money, moneyKrupno: moneyKrupno, niceFloor: niceFloor, kindOf: kindOf,
    neProvereno: neProvereno, kakPoschitali: kakPoschitali, otgruzkaAdvice: otgruzkaAdvice, NAPR: NAPR, bezPovtora: bezPovtora, chestnoPoyasnenie: chestnoPoyasnenie, neProverenyKlyuchevye: neProverenyKlyuchevye, vVyvode: vVyvode, STATYA: STATYA, FORMULA: FORMULA,
    predvaritelno: predvaritelno, METODIKA: { DELITEL: DELITEL, POTOLKI: POTOLKI, OSTOROZHNO: OSTOROZHNO, MINIMUM: MINIMUM },
    RATES: { VAT: VAT, PROFIT: PROFIT, USN_DR: USN_DR }
  };
});
;
/* --- /js/shchit.js --- */
/*!
 * Делоскоп · Щит — своя компания глазами банка и налоговой.
 * Работает поверх ответа /api/check, без запросов на сервер (как usloviya.js).
 * Признаки берёт из Usloviya.facts / Usloviya.kindOf — второго классификатора нет.
 * Три блока: «Как вас видит банк», «Как вас видит налоговая», «Что сделать сейчас» (до 3 шагов + «Следить»).
 * Тексты — ТЗ [команда] 01.10 (документ команды, разд. 2.3).
 * Ссылка на норму в скобках выводится только у строк, сверенных [команда] (sver: true) — флаг SVERENO.
 * v2 (02.10): тексты и нормы по ответам [команда] 07:15 и 08:20 (документ команды, разд. 1;
 * документ команды, разд. 1) — все ◐ сняты, кроме «налоговая» у массового адреса (без нормы).
 * v3 (04.10, shchit-finansy-v1): финансы из того же ответа (ГИР БО) — Щит больше не пишет «заметных признаков нет», когда ниже
 * на экране стоят «ликвидность меньше 1» и «рентабельность ниже средней по отрасли — признак отбора». Признаки — те же функции,
 * что «Существенные факты» (js/sushchestvennoe.js) и блок рентабельности (js/rentabelnost.js, нормы ФНС грузятся один раз);
 * «почему» — дословно утверждённые [команда] тексты «Комментария команды» (data/kommentarii.json, тон «жёлтый»: ubytok,
 * kapital, likvidnost) — tests/shchit_finansy.test.js сверяет их с файлом. Капитал и ликвидность — только «банк», без шага.
 * v3.1 (04.10, shchit-ubytki-v1): убыток 2+ года — и в «Как вас видит налоговая» (критерий 2 ММ-3-06/333@, текст [команда] 09:20).
 * v4 (11.10, shchit-pokupateli-v1 [команда]): «Как вас видят покупатели» — что увидит тот, кто проверяет вас по ИНН перед оплатой,
 *   если вашей бухотчётности в открытых данных ГИР БО нет или она старая. Живой ответ (ПАО, 11.10): Щит писал «заметных признаков нет»,
 *   а у проверяющих покупателей — «Индекс — данных пока мало» и ни выручки, ни динамики. Строка ◐ (без нормы),
 *   шаг — открыть свою организацию в ГИР БО. ИП, банков (сдают в Банк России), прекращающих работу и признак API «отчётность» — не трогаем.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Shchit = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  // Включить все нормы разом — после «да» [команда] на ◐-строки (или поставить sver: true у конкретной строки).
  var SVERENO = false;
  // Дата, на которую [команда] сверило нормы в скобках с действующими редакциями (ответы 02.10 07:15 и 08:20).
  var SVERENO_NA = '02.10.2026';

  var CBR_ZSK = 'https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/';

  // b — «Как вас видит банк», n — «Как вас видит налоговая», s — «Что сделать».
  // Строка: { t: текст, norma: '(…)' — только у сверенных; sver: true — сверено [команда] / уже на живом }.
  var T = {
    zsk: {
      b: { t: 'По открытым данным у компании есть признаки, по которым банки относят клиентов к повышенному риску. Это наш прогноз, не статус Банка России.', sver: true },
      s: { t: 'Проверьте себя в сервисе Банка России — он показывает только «красную» зону. Если она есть, на заявление в МВК — 6 месяцев', norma: '(п. 1 ст. 7.8 115-ФЗ)', sver: true,
           href: CBR_ZSK, knopka: 'Проверить в сервисе Банка России', ext: true, eshche: { href: '/skoraya-115-fz/?s=zsk', t: 'План, если зона красная' } }
    },
    nedost: {
      b: { t: 'Отметка о недостоверности в ЕГРЮЛ — признак, на который банки обращают внимание.', sver: true },
      n: { t: 'Если отметка держится больше 6 месяцев, инспекция может исключить компанию из ЕГРЮЛ', norma: '(пп. «б» п. 5 ст. 21.1 129-ФЗ)', sver: true, tolkoUL: true },
      s: { t: 'Подайте исправленные или подтверждающие сведения в инспекцию.', href: '/nalogi/nedostovernyj-adres-egryul/', knopka: 'Как снять недостоверность' }
    },
    mass: {
      b: { t: 'Массовый адрес или руководитель — признак, по которому банки ищут «технические» компании.', sver: true },
      n: { t: 'Массовый адрес или руководитель — признак, по которому инспекция ищет «технические» компании.' },
      s: { t: 'Держите под рукой договор аренды и фото офиса или вывески — их просят первыми.', href: '/nalogi/priznaki-tehnicheskoj-kompanii/', knopka: 'Признаки «технической» компании' }
    },
    young: {
      b: { t: 'У компании младше года нет истории — банк внимательнее к крупным операциям.', sver: true },
      s: { t: 'Первые месяцы — без транзита «пришло и ушло в тот же день»; к каждому крупному платежу — договор и акт.', sver: true, href: '/115-fz/zapros-banka-po-115-fz-kak-otvetit/', knopka: 'Как отвечать на запрос банка' }
    },
    staff: {
      b: { t: 'Оборот без сотрудников банк сверяет с видом деятельности.', sver: true },
      n: { t: 'Работы и услуги без людей — частый вопрос о реальности сделок', norma: '(ст. 54.1 НК РФ)', sver: true },
      s: { t: 'Работаете с подрядчиками или самозанятыми — храните договоры и акты к каждому платежу.', href: '/nalogi/statya-54-1-nk-prostymi-slovami/', knopka: 'Статья 54.1 НК простыми словами' }
    },
    nagruzka: {
      b: { t: 'Налоги, малые по сравнению с оборотом, банки замечают.', sver: true },
      n: { t: 'Нагрузка ниже средней по отрасли — один из критериев отбора для выездной проверки.', sver: true },
      s: { t: 'Подготовьте короткое объяснение: сезонность, вложения, убыток прошлого года.' }
    },
    dolg: {
      b: { t: 'Долг по налогам может закончиться приостановкой расходных операций по счёту в пределах долга', norma: '(п. 2 ст. 76 НК РФ)', sver: true },
      n: { t: 'Долг растёт пенями каждый день.', sver: true },
      s: { t: 'Сверьте единый налоговый счёт в личном кабинете и погасите долг до требования.' }
    },
    fssp: {
      b: { t: 'По исполнительному листу банк списывает деньги со счёта без согласия владельца', norma: '(ст. 8 229-ФЗ)', sver: true },
      s: { t: 'Закройте долг и попросите постановление об окончании производства.' }
    },
    report: {
      n: { t: 'Нет отчётности и операций 12 месяцев — компанию могут исключить из ЕГРЮЛ как недействующую', norma: '(п. 1 ст. 21.1 129-ФЗ)', sver: true, tolkoUL: true },
      s: { t: 'Сдайте отчётность, даже нулевую.' }
    },
    director: {
      b: { t: 'После смены руководителя банк обновляет сведения о клиенте и может запросить документы.', sver: true },
      s: { t: 'Обновите анкету в банке сами, не дожидаясь запроса.' }
    },
    // Финансы (v3): тексты — data/kommentarii.json, тон zhel, status utverzhdeno ([команда] 02.10–03.10), дословно.
    // Шаг у убытков и рентабельности — тот же, что у нагрузки (объяснение для инспекции); у капитала и ликвидности шага нет.
    ubytki: {
      b: { t: 'Убытки и отрицательные чистые активы банк учитывает при оценке платёжеспособности.', sver: true },
      // shchit-ubytki-v1 (04.10): [команда] 04.10 09:20 разд. 3, дословно — критерий 2 прил. 2 к приказу ФНС
      // от 30.05.2007 № ММ-3-06/333@: «…с убытком в течение 2-х и более календарных лет»; порог «2+» — из нормы.
      n: { t: 'Убытки два года и более — один из открытых критериев, по которым налоговая отбирает компании для выездной проверки',
           norma: '(критерий 2, приказ ФНС от 30.05.2007 № ММ-3-06/333@)', dop: 'Проверка от этого не обязательна.', sver: true,
           ist: 'https://www.consultant.ru/document/cons_doc_LAW_55729/f579efc1e846c86acedf1433b3fb8817a96a6916/' },
      s: 'nagruzka'
    },
    rentabelnost: {
      n: { t: 'Рентабельность ниже отраслевой на 10% и более — критерий отбора на выездную проверку.', sver: true },
      s: 'nagruzka'
    },
    kapital: {
      b: { t: 'Минус капитала — не признак по 115-ФЗ, но для кредита и отсрочки банк о нём спросит.', sver: true },
      s: null
    },
    likvidnost: {
      b: { t: 'Ликвидность ниже 1 — не признак по 115-ФЗ, но для кредита и лимитов банк на неё смотрит.', sver: true },
      s: null
    },
    // v4: что увидит покупатель при проверке по ИНН (тексты согласованы [команда] 11.10 с двумя правками; нормы в блоке нет — так и оставлено)
    pokupateli: {
      net: { t: 'Покупатель, который проверяет вас по ИНН перед оплатой, не увидит ни выручки, ни её динамики: о вашем бизнесе он будет судить по возрасту компании и записям в реестрах.' },
      staraya: { t: 'Покупатель, который проверяет вас по ИНН перед оплатой, увидит отчётность только за {g} год — по ней трудно судить о вашем сегодняшнем обороте.' },
      sokr: 'Индекс Делоскопа в такой проверке — «данных пока мало».',
      s: { t: 'Откройте свою организацию в ГИР БО и посмотрите, видна ли там отчётность за {g} год. Если нет — проверьте, принята ли она налоговой. Если вы ограничили доступ к ней в ГИР БО, для крупных сделок держите копию с квитанцией о приёме.',
           href: 'https://bo.nalog.gov.ru/', knopka: 'Открыть ГИР БО', ext: true }
    },
    // block / diskv / exit / rnp / fines / other — строка признака как есть, шаг — «Скорая».
    skoraya: { t: 'Если банк уже прислал запрос или ограничил счёт — план по дням.', sver: true, href: '/skoraya-115-fz/', knopka: 'Открыть план по дням' },
    sled: { t: 'Следить за своей компанией: добавьте её в список слежения в кабинете и проверяйте раз в месяц.', href: '/cabinet.html', knopka: 'Следить за компанией', sled: true }
  };
  // Куда идут признаки без своего текста: банк или налоговая.
  var KAK_EST = { block: 'b', rnp: 'b', other: 'b', diskv: 'n', exit: 'n', fines: 'n' };
  // Порядок шагов (ТЗ 2.3) + признаки «как есть» в конце.
  var PORYADOK = ['block', 'zsk', 'dolg', 'fssp', 'nedost', 'report', 'mass', 'staff', 'nagruzka', 'ubytki', 'rentabelnost', 'kapital', 'likvidnost',
    'director', 'young', 'diskv', 'exit', 'rnp', 'other', 'fines'];
  var MAX_SHAGOV = 3;
  var ST = { LIQUIDATING: 'Компания ликвидируется или ФНС готовит её исключение из ЕГРЮЛ', LIQUIDATED: 'Компания ликвидирована', BANKRUPT: 'Идёт банкротство', REORGANIZING: 'Идёт реорганизация' };

  function tekst(x) {
    var t = x.norma && (x.sver || SVERENO) ? x.t + ' ' + x.norma + '.' : (/[.!?»]$/.test(x.t) ? x.t : x.t + '.');
    return x.dop ? t + ' ' + x.dop : t;   // dop — второе предложение после нормы (убытки: «Проверка от этого не обязательна.»)
  }
  function reestr(t, ul) { return ul ? t : t.replace(/ЕГРЮЛ/g, 'ЕГРИП'); }   // у ИП свой реестр
  function Sk(o) {
    if (o && o.statusKod) return o.statusKod;
    if (root && root.StatusKod) return root.StatusKod;
    try { return typeof require === 'function' ? require('./status-kod.js') : null; } catch (e) { return null; }
  }
  function Su(o) { return (o && o.sushchestvennoe) || (root && root.Sushchestvennoe) || (typeof require === 'function' ? require('./sushchestvennoe.js') : null); }
  function Rn(o) {
    if (o && o.rentabelnost) return o.rentabelnost;
    if (root && root.Rentabelnost) return root.Rentabelnost;
    try { return typeof require === 'function' ? require('./rentabelnost.js') : null; } catch (e) { return null; }
  }
  var NB = '\u00a0';
  function skl(n, a, b, c) { var m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; }
  function dengiF(v) {
    var a = Math.abs(v), e = [[1e12, 'трлн'], [1e9, 'млрд'], [1e6, 'млн'], [1e3, 'тыс.']];
    for (var i = 0; i < e.length; i++) if (a >= e[i][0]) return String(Math.round(a / e[i][0] * 10) / 10).replace('.', ',') + NB + e[i][1] + NB + '₽';
    return String(Math.round(a)) + NB + '₽';
  }
  // Финансовые признаки организации из ответа (ГИР БО): {kind → строка признака}. Те же пороги, что «Существенные факты»:
  // убыток 2 года подряд и больше, капитал меньше нуля, текущая ликвидность больше 0 и меньше 1. Рентабельность — только
  // с нормами ФНС (o.normy) и только «ниже средней на 10% и более». ИП и банков здесь нет (у них нет ГИР БО / сдают в ЦБ).
  function finansy(r, o) {
    var out = {}, c = r && r.company;
    if (!c || !/^\d{10}$/.test(String(c.inn || ''))) return out;
    var S = null; try { S = Su(o); } catch (e) { S = null; }
    if (S) {
      try {
        var ub = S.ubytki && S.ubytki(r);
        if (ub) out.ubytki = 'Убыток ' + ub.n + NB + skl(ub.n, 'год', 'года', 'лет') + ' подряд — по годовой отчётности за ' + (ub.n === 2 ? ub.ot + ' и ' + ub.god : ub.ot + '–' + ub.god);
        var kp = S.kapital && S.kapital(r);
        if (kp && kp.znach < 0) out.kapital = 'Собственный капитал на' + NB + '31.12.' + kp.god + ' — минус ' + dengiF(kp.znach) + ': обязательства больше активов';
        var lk = S.likvidnost && S.likvidnost(r);
        if (lk && lk.znach > 0 && lk.znach < 1) out.likvidnost = 'Текущая ликвидность на' + NB + '31.12.' + lk.god + ' — ' + lk.znach.toFixed(2).replace('.', ',') + ': краткосрочные долги больше оборотных средств';
      } catch (e) {}
    }
    if (o && o.normy) {
      try {
        var R = Rn(o), x = R && R.raschet ? R.raschet(r, o.normy) : null;
        if (x && x.st === 'nizhe' && typeof x.norma === 'number')
          out.rentabelnost = 'Рентабельность активов за ' + x.god + ' — ' + (R.znachenie ? R.znachenie(x) : R.pct(x.n)) + ' при средней по отрасли ' + R.pct(x.norma) + ' (оценка; ГИР' + NB + 'БО и ФНС)';
      } catch (e) {}
    }
    return out;
  }
  function U(o) { return (o && o.usloviya) || (root && root.Usloviya) || (typeof require === 'function' ? require('./usloviya.js') : null); }
  function dataRu(s) { var d = new Date(s || Date.now()); if (isNaN(d)) d = new Date(); function z(n) { return (n < 10 ? '0' : '') + n; } return z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear(); }
  function nbsp(t) { return String(t).replace(/(\d) (?=\d{3}(\D|$))/g, '$1\u00a0').replace(/ ₽/g, '\u00a0₽'); }
  function nazvanie(x) { var d = nbsp(String(x.detail || '').trim()); return /^(да|есть|внимание|нет данных|—|)$/i.test(d) ? x.title : x.title + ': ' + d.charAt(0).toLowerCase() + d.slice(1); }

  function Io(o) { return (o && o.indeksOtvet) || (root && root.IndeksOtvet) || null; }
  // v4: видимость отчётности для покупателей. → { kind:'pokupateli', priznak, pochemu, god, staraya } | null.
  // Год — тот, за который отчётность уже должна быть в ГИР БО: год проверки (МСК) минус 1. «Старая» — правило «Существенных фактов»
  // (Sushchestvennoe.staraya: последняя отчётность старше года проверки − 2), без своего порога.
  function vidimost(r, o) {
    var c = r && r.company, S = null;
    if (!c || !/^\d{10}$/.test(String(c.inn || ''))) return null;
    if (!r.dossier || typeof r.dossier !== 'object') return null;   // досье в ответе нет — о ГИР БО ничего не знаем, молчим
    try { S = Su(o); } catch (e) { S = null; }
    if (!S || !S.poslGodOtchetnosti || (S.bank && S.bank(c))) return null;
    var g = S.poslGodOtchetnosti(r), st = null;
    var t0 = Date.parse(r.checked_at || ''), gp = new Date((isFinite(t0) ? t0 : Date.now()) + 3 * 3600 * 1000).getUTCFullYear();
    if (g !== null) { try { st = S.staraya ? S.staraya(r) : null; } catch (e) { st = null; } if (!st) return null; }
    var T4 = T.pokupateli, out = { kind: 'pokupateli', god: gp - 1, staraya: g !== null ? g : null };
    out.priznak = g === null ? 'Бухотчётности в' + NB + 'открытых данных ГИР' + NB + 'БО нет' : 'Последняя открытая отчётность — за' + NB + g + NB + 'год';
    out.pochemu = g === null ? T4.net.t : T4.staraya.t.replace('{g} ', g + NB);
    try { var IO = Io(o), v = IO && IO.gotov && IO.gotov() ? IO.vid(r) : null; if (v && v.rezhim === 'sokr') out.pochemu += ' ' + T4.sokr; } catch (e) {}
    out.kratko = g === null ? 'Покупатели при проверке по ИНН не увидят вашу отчётность' : 'Покупатели при проверке по ИНН увидят отчётность только за ' + g + ' год';
    return out;
  }

  // razbor(r) → { banki, nalogovaya, pokupateli, shagi, chisto, neProvereno, ul, data }
  function razbor(r, o) {
    var Us = U(o); if (!Us) throw new Error('shchit: нет Usloviya');
    r = r || {};
    var f = Us.facts(r), np = Us.neProvereno(r, f), ul = f.kind !== 'INDIVIDUAL';
    var est = {};                                 // kind → строка признака (название · деталь) из ответа API
    f.list.forEach(function (x) { if (!est[x.kind] || x.status === 'bad') est[x.kind] = nazvanie(x); });
    if (f.zsk === 'high' || f.zsk === 'medium') est.zsk = 'Прогноз ЗСК — ' + (f.zsk === 'high' ? 'высокий' : 'средний') + ' · наша оценка';
    if ((f.warn.young || f.bad.young) && !est.young) est.young = 'Компании меньше года';
    if ((f.staff === 0 || f.staff === 1) && !est.staff) est.staff = f.staff ? 'В штате 1 человек' : 'В штате никого';
    // status-tochno-v1: с кодом состояния ЕГРЮЛ — точнее (js/status-kod.js)
    var SK = Sk(o);
    if (ST[f.status] && !est.exit) est.exit = SK && SK.vid(f.status, f.kod) ? SK.fraza(f.status, f.kod, { zaglavnaya: true }) : ST[f.status];
    var fin = finansy(r, o);
    Object.keys(fin).forEach(function (k) { if (!est[k]) est[k] = fin[k]; });

    var banki = [], nalogovaya = [], kinds = [];
    PORYADOK.forEach(function (k) {
      if (!est[k]) return;
      kinds.push(k);
      var t = T[k];
      if (t) {
        if (t.b && !(t.b.tolkoUL && !ul)) banki.push({ kind: k, priznak: est[k], pochemu: reestr(tekst(t.b), ul) });
        if (t.n && !(t.n.tolkoUL && !ul)) nalogovaya.push({ kind: k, priznak: est[k], pochemu: reestr(tekst(t.n), ul) });
      } else if (KAK_EST[k]) {
        (KAK_EST[k] === 'b' ? banki : nalogovaya).push({ kind: k, priznak: est[k], pochemu: '' });
      }
    });
    // ИП: признак report/nedost без строки в «налоговой» не теряется — показываем его хотя бы в банке как есть.
    kinds.forEach(function (k) {
      var vezde = banki.concat(nalogovaya).some(function (x) { return x.kind === k; });
      if (!vezde) banki.push({ kind: k, priznak: est[k], pochemu: '' });
    });

    // v4: «Как вас видят покупатели» — не для ИП, банков, прекращающих работу и не дублируя признак API «отчётность» (у него свой шаг)
    var pok = !est.exit && !est.report ? vidimost(r, o) : null, pokupateli = pok ? [pok] : [];
    var shagi = [], bylo = {};
    kinds.forEach(function (k) {
      if (shagi.length >= MAX_SHAGOV) return;
      if (T[k] && T[k].s === null) return;                       // финансы банка: шага нет (не «Скорая»)
      var ss = T[k] && typeof T[k].s === 'string' ? T[k].s : k;   // чужой шаг (убытки, рентабельность → «нагрузка»)
      var s = T[ss] && T[ss].s ? T[ss].s : T.skoraya;
      var key = s === T.skoraya ? 'skoraya' : ss;
      if (bylo[key]) return; bylo[key] = 1;
      shagi.push({ kind: key, t: tekst(s), href: s.href || '', knopka: s.knopka || '', ext: !!s.ext, eshche: s.eshche || null });
    });
    if (pok && shagi.length < MAX_SHAGOV) {
      var ps = T.pokupateli.s;
      shagi.push({ kind: 'pokupateli', t: ps.t.replace('{g} ', pok.god + NB), href: ps.href, knopka: ps.knopka, ext: !!ps.ext, eshche: null });
    }
    shagi.push({ kind: 'sled', t: T.sled.t, href: T.sled.href, knopka: T.sled.knopka, sled: true });

    var sNormoj = banki.concat(nalogovaya).some(function (x) { return /\((п|пп|ст)\. [^)]+\)\.$/.test(x.pochemu); }) ||
      shagi.some(function (x) { return /\((п|пп|ст)\. [^)]+\)\.$/.test(x.t); });
    return { banki: banki, nalogovaya: nalogovaya, pokupateli: pokupateli, shagi: shagi, chisto: !kinds.length, neProvereno: np, ul: ul, data: dataRu(r.checked_at), imya: f.name, sNormoj: sNormoj };
  }

  // Главное действие — одна кнопка: первый шаг со ссылкой, иначе «Следить».
  function glavnyj(R) { for (var i = 0; i < R.shagi.length; i++) if (R.shagi[i].href) return R.shagi[i]; return R.shagi[R.shagi.length - 1]; }

  // Короткий текст для «Скопировать разбор».
  function kratko(R) {
    var p = R.chisto ? 'Заметных признаков в открытых данных нет' : 'Признаков: ' + (R.banki.length + R.nalogovaya.length);
    if (R.pokupateli && R.pokupateli.length) p += '. ' + R.pokupateli[0].kratko;
    var sh = R.shagi.filter(function (s) { return !s.sled; }).map(function (s, i) { return (i + 1) + '. ' + s.t; }).join(' ');
    return R.imya + ' — глазами банка и налоговой на ' + R.data + '. ' + p + '.' + (sh ? ' Что сделать: ' + sh : '');
  }

  var CSS = '' +
    '.shch{display:flex;flex-direction:column;gap:18px;color:var(--ink,#1D1D1F)}' +
    '.shch-oh{margin:0;font-size:13px;color:var(--muted,#6B6B70);max-width:68ch}' +
    '.shch-b{display:flex;flex-direction:column;gap:8px}' +
    '.shch-b h3{margin:0;font-size:17px;line-height:1.3;font-weight:600;letter-spacing:-.01em}' +
    '.shch-b ul,.shch-b ol{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}' +
    '.shch-b li{background:var(--bg,#F5F5F2);border-radius:16px;padding:12px 14px;max-width:68ch}' +
    '.shch-b li b{display:block;font-size:15px;font-weight:600;line-height:1.35}' +
    '.shch-b li span{display:block;margin-top:3px;font-size:15px;line-height:1.45;color:var(--ink2,#48484C)}' +
    '.shch-b li a{font-size:15px}' +
    '.shch-sh{counter-reset:sh}' +
    '.shch-sh li{position:relative;padding-left:44px}' +
    '.shch-sh li:before{counter-increment:sh;content:counter(sh);position:absolute;left:14px;top:12px;width:20px;height:20px;border-radius:50%;background:var(--card,#fff);font-size:13px;font-weight:600;line-height:20px;text-align:center;color:var(--ink2,#48484C)}' +
    '.shch-sh li.shch-sled:before{content:"";background:var(--accent,#0B63E5);box-shadow:inset 0 0 0 6px var(--card,#fff)}' +
    '.shch-sh li span{margin-top:0;color:var(--ink,#1D1D1F)}' +
    '.shch-pusto{margin:0;font-size:15px;color:var(--ink2,#48484C);max-width:68ch}' +
    '.shch-ne{margin:0;font-size:15px;color:#8A5A00;background:#FFF6E0;border-radius:10px;padding:8px 10px;max-width:68ch}' +
    '.shch-k{display:inline-flex;align-items:center;justify-content:center;align-self:flex-start;border-radius:999px;background:var(--accent,#0B63E5);color:#fff!important;font-weight:600;font-size:15px;padding:12px 22px;min-height:44px;text-decoration:none;max-width:100%;text-align:center}' +
    '.shch-k:hover{background:var(--accent-hover,#084BB0)}' +
    '.shch-ch{font-weight:400;color:var(--muted,#6B6B70);font-variant-numeric:tabular-nums}' +
    '.shch-sv{margin:0;font-size:13px;line-height:1.45;color:var(--muted,#6B6B70);max-width:68ch;border-top:1px solid var(--line,#E5E5E0);padding-top:10px}';

  // «№ ММ-3-06/333@)» вместе со скобкой и точкой — одним куском: иначе на 390 px «)» уходит на новую строку.
  function nwNomer(h) { return h.replace(/№ ([^\s)<]+\)\.?)/g, '<span class="nw">№ $1</span>'); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ssylka(href, t, ext, cls) { return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(t) + '</a>'; }

  function html(R) {
    function blok(zag, spisok) {
      if (!spisok.length) return '';
      return '<div class="shch-b"><h3>' + zag + ' <span class="shch-ch">· ' + spisok.length + '</span></h3><ul>' + spisok.map(function (x) {
        return '<li><b>' + esc(x.priznak) + '</b>' + (x.pochemu ? '<span>' + nwNomer(esc(x.pochemu)) + '</span>' : '') + '</li>';
      }).join('') + '</ul></div>';
    }
    var g = glavnyj(R);
    var sh = '<div class="shch-b"><h3>Что сделать сейчас</h3><ol class="shch-sh">' + R.shagi.map(function (s) {
      var dop = [];
      if (s.href && s !== g) dop.push(ssylka(s.href, s.knopka, s.ext));
      if (s.eshche) dop.push(ssylka(s.eshche.href, s.eshche.t));
      return '<li' + (s.sled ? ' class="shch-sled"' : '') + '><span>' + esc(s.t) + (dop.length ? ' ' + dop.join(' · ') : '') + '</span></li>';
    }).join('') + '</ol></div>';
    var np = R.neProvereno && R.neProvereno.spisok && R.neProvereno.spisok.length ? '<p class="shch-ne">Не проверяли: ' + esc(R.neProvereno.spisok.join(', ')) + '. Это не значит, что их нет.</p>' : '';
    return '<section class="shch" aria-label="Ваша компания глазами банка и налоговой">' +
      '<p class="shch-oh">Это наша оценка по открытым данным, а не решение банка или инспекции. Банк видит ваши операции — мы нет.</p>' +
      (R.chisto ? '<p class="shch-pusto">В открытых данных заметных признаков не нашли. Это не гарантия: банк смотрит и на ваши операции.</p>' : '') +
      blok('Как вас видит банк', R.banki) + blok('Как вас видит налоговая', R.nalogovaya) +
      blok('Как вас видят покупатели', R.pokupateli || []) + np + sh +
      ssylka(g.href, g.knopka, g.ext, 'shch-k') +
      (R.sNormoj ? '<p class="shch-sv">Ссылки на нормы в скобках сверены командой Делоскопа (115-ФЗ и налоги) с редакциями законов на ' + SVERENO_NA + '.</p>' : '') + '</section>';
  }

  // Номера норм не рвутся на переносе («№ ММ-3-06/333@», «115-ФЗ») — общий js/shapka.js (nerazryv-v1), если он есть.
  function nw(el) {
    try { var w = root && root.dlkNerazryv ? root : (typeof window !== 'undefined' ? window : null); if (w && w.dlkNerazryv) w.dlkNerazryv.obernut(el); } catch (e) {}
  }
  // mount(el, r) — рисует разбор в el. Цель Метрики shchit_sled — клик по «Следить».
  function mount(el, r, o) {
    if (!r || !r.company || !r.company.inn) throw new Error('shchit: нет данных о компании');
    var doc = el.ownerDocument;
    if (!doc.getElementById('shch-css')) { var s = doc.createElement('style'); s.id = 'shch-css'; s.textContent = CSS; doc.head.appendChild(s); }
    var R = razbor(r, o);
    el.innerHTML = html(R); nw(el);
    el.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href="/cabinet.html"]') : null;
      if (a && root && root.dlkGoal) root.dlkGoal('shchit_sled', { inn_dlina: String(r.company.inn).length });
    });
    // v3: рентабельность против отрасли — когда загрузятся нормы ФНС (тот же файл и тот же расчёт, что блок ниже).
    // Разбор обновляем на месте (R — тот же объект: «Скопировать разбор» берёт его), новая проверка — старый не трогаем.
    var Rnt = Rn(o), metka = {}; el.__shch = metka;
    if (!(o && o.normy) && Rnt && Rnt.zagruzit && /^\d{10}$/.test(String(r.company.inn))) {
      R.gotovo = Rnt.zagruzit().then(function (d) {
        if (!d || el.__shch !== metka) return R;
        var o2 = {}; Object.keys(o || {}).forEach(function (k) { o2[k] = o[k]; }); o2.normy = d;
        var R2 = razbor(r, o2);
        if (R2.banki.length + R2.nalogovaya.length === R.banki.length + R.nalogovaya.length) return R;
        Object.keys(R2).forEach(function (k) { R[k] = R2[k]; });
        el.innerHTML = html(R); nw(el);
        return R;
      }).catch(function () { return R; });
    }
    return R;
  }

  return { razbor: razbor, mount: mount, html: html, kratko: kratko, glavnyj: glavnyj, finansy: finansy, vidimost: vidimost, T: T, SVERENO: SVERENO, SVERENO_NA: SVERENO_NA, MAX_SHAGOV: MAX_SHAGOV, PORYADOK: PORYADOK };
});
;
/* --- /js/dinamika.js --- */
/* Делоскоп — «Динамика за 3–5 лет» и «Что изменилось с вашей прошлой проверки» на экране проверки по ИНН
 * (решение команды 02.10, эталон экрана — п. 5 «Динамика и тренды»).
 * Данные — только из ответа /api/check: dossier.charts (ГИР БО ФНС, годовая бухотчётность), signals, company, zsk.
 * Снимки для «что изменилось» хранятся ТОЛЬКО в браузере (localStorage, ключ dlk_snimki): без ФИО, адресов и сумм,
 * кроме выручки, прибыли, собственного капитала, кредитов и займов, текущей ликвидности и оценки рентабельности активов из открытой отчётности (ГИР БО);
 * у организаций — ещё код и название основного вида деятельности из ЕГРЮЛ, число Индекса и коды факторов открытой методики (для «почему сдвинулся»),
 * уставный капитал, признак ООО и КПП из ЕГРЮЛ (izm-egryul-v1: «капитал уменьшился», «КПП сменился»). Нет доступа к хранилищу — блока «что изменилось» нет.
 * Чистые функции (ryady, trendy, snimok, sravnit, html) — без DOM и сети, их проверяет tests/dinamika.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Dinamika = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = ' ';
  // Разбор № 9 — куда ведёт подстрочник «Компания исключена из ЕГРЮЛ» (ссылка в htmlIzmeneniya)
  var RAZBOR_ISKL = '/praktika/nalogi/isklyuchili-iz-egryul-dolg-s-direktora/';
  var KEY = 'dlk_snimki', MAKS_INN = 40, MAKS_SNIMKOV = 4, CHAS = 3600 * 1000;
  var POKAZATELI = [
    { k: 'revenue', nazv: 'Выручка', dengi: true },
    { k: 'profit', nazv: 'Чистая прибыль', dengi: true, znak: true },
    { k: 'income_tax', nazv: 'Налог на прибыль', dengi: true },
    // ряды наборов ФНС по годам (ответ [команда] 02.10: charts.staff — sshr, charts.taxes_paid — paytax, со взносами);
    // пока API их не отдаёт или лет меньше трёх — строки нет
    { k: 'taxes_paid', nazv: 'Уплачено налогов и взносов', dengi: true, fns: true },
    { k: 'staff', nazv: 'Численность', chel: true, fns: true }
  ];
  var LVL = { low: 'низкий', medium: 'средний', high: 'высокий' };
  var STX = { ok: 'норма', info: 'справочно', warn: 'внимание', bad: 'риск' };
  var VES = { ok: 0, info: 0, warn: 1, bad: 2 };
  var STATUS = { ACTIVE: 'действующая', LIQUIDATING: 'ликвидируется или исключается из ЕГРЮЛ', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' };
  // Код состояния ЕГРЮЛ (company.state_code, API status-kody-api-v1; DaData кладёт эти коды в LIQUIDATING):
  // 105–107, 110 — ФНС готовит исключение из ЕГРЮЛ; 108 — по сведениям Банка России (заголовки [команда] 03.10 08:11 и 12:07).
  // Нет кода в ответе (API до выкладки, старые снимки) — сравниваем по одному статусу, как раньше.
  var ISKL = { '105': 1, '106': 1, '107': 1, '108': 1, '110': 1 };
  function kodSost(v) { var k = String(v == null ? '' : v).trim(); return /^\d{3}$/.test(k) ? k : ''; }
  function iskl(k) { return !!(k && ISKL[k]); }
  function nazvIskl(k) { return 'ФНС готовит исключение из ЕГРЮЛ' + (k === '108' ? ' по' + NB + 'сведениям Банка России' : ''); }
  // 407, 414, 415, 418, 420 — компания уже исключена из ЕГРЮЛ (заголовок [команда] 03.10 14:30, разд. 1 п. 3)
  var ISKLYUCHENA = { '407': 1, '414': 1, '415': 1, '418': 1, '420': 1 };
  function isklyuchena(k) { return !!(k && ISKLYUCHENA[k]); }
  // Срок возражения кредитора: 3 месяца со дня публикации в «Вестнике», по 108 — 6 месяцев (п. 4 и 7 ст. 21.1 129-ФЗ).
  // Публикации в снимке нет — считаем от даты записи и пишем «ориентировочно» ([команда] 03.10 14:30, разд. 1 п. 1).
  function plusMes(iso, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return '';
    var g = +m[1], me = +m[2] - 1 + n, d = +m[3];
    g += Math.floor(me / 12); me = me % 12;
    var posl = new Date(Date.UTC(g, me + 1, 0)).getUTCDate();
    return g + '-' + ('0' + (me + 1)).slice(-2) + '-' + ('0' + Math.min(d, posl)).slice(-2);
  }
  // Подстрочник к строке «ФНС готовит исключение» — текст «Истории» [команда] 14:30 (разд. 1 п. 4) + дата и «Вестник» (п. 1)
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
    var ubGody = nalogBezZnaka(ch);
    return POKAZATELI.map(function (p) {
      var o = { k: p.k, nazv: p.nazv, znak: !!p.znak, chel: !!p.chel, fns: !!p.fns, ryad: ryad(ch[p.k]) };
      if (p.k === 'income_tax' && ubGody.length) o.ubGody = ubGody;
      return o;
    }).filter(function (p) { return p.ryad.length >= 3; });
  }

  // znak-naloga-v1 (04.10): строка 2410 в ответе API — без знака. В год с убытком сумма может быть доходом по налогу
  // (у «Аэрофлота» 2020: убыток 96,5 млрд ₽ и «налог» 26,6 млрд ₽), а не расходом — знак не виден ([команда] 04.10 разд. 1:
  // «не гадаем»). → годы с убытком, в которые налог ≠ 0; ряд со знаком (есть значение < 0) — пустой список.
  function nalogBezZnaka(ch) {
    // znak-naloga-v1.1: флаг ряда `income_tax_znak: true`, `znak` у точки и строка 2300 (`profit_before_tax`) за год
    // ([команда] 04.10 разд. 1) — знак известен; без флагов — прежнее правило «есть значение < 0».
    var t = Array.isArray(ch && ch.income_tax) ? ch.income_tax : [];
    if (ch && ch.income_tax_znak === true) return [];
    var sFlagom = t.some(function (x) { return x && typeof x.znak === 'boolean'; });
    if (!sFlagom && t.some(function (x) { return x && Number(x.value) < 0; })) return [];
    var izv = {}, ub = {};
    t.forEach(function (x) { if (x && x.znak === true) izv[parseInt(x.year, 10)] = 1; });
    (Array.isArray(ch && ch.profit_before_tax) ? ch.profit_before_tax : []).forEach(function (x) {
      if (x && x.value !== null && x.value !== '' && isFinite(Number(x.value))) izv[parseInt(x.year, 10)] = 1;
    });
    (Array.isArray(ch && ch.profit) ? ch.profit : []).forEach(function (x) { if (x && x.value !== null && x.value !== '' && Number(x.value) < 0) ub[parseInt(x.year, 10)] = 1; });
    return ryad(t).filter(function (x) { return ub[x.year] && !izv[x.year] && x.value !== 0; }).map(function (x) { return x.year; });
  }

  // Одна строка: значение последнего года, изменение к прошлому году и за период — простыми словами.
  function stroka(p) {
    var a = p.ryad, n = a.length, posl = a[n - 1], pred = a[n - 2], perv = a[0];
    var o = { k: p.k, nazv: p.nazv, god: posl.year, znach: posl.value, ryad: a, kGodu: '', zaPeriod: '', ton: 'ro', fns: !!p.fns };
    o.fmt = p.chel ? chel : dengi;
    if (p.znak && posl.value < 0) o.znachTekst = 'убыток ' + dengi(-posl.value);
    else if (p.k === 'income_tax' && posl.value < 0) o.znachTekst = 'доход ' + dengi(-posl.value);
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
    // налог без знака: сравнение с убыточным годом не делаем — неизвестно, расход там или доход
    if (p.ubGody) {
      o.ubGody = p.ubGody;
      var vRyadu = a.filter(function (x) { return p.ubGody.indexOf(x.year) >= 0; }).map(function (x) { return x.year; });
      if (vRyadu.indexOf(perv.year) >= 0 || vRyadu.indexOf(posl.year) >= 0) o.zaPeriod = '';
      if (vRyadu.indexOf(posl.year) >= 0 || vRyadu.indexOf(pred.year) >= 0) {
        o.kGodu = ''; o.ton = 'ro';
        o.zaPeriod = '±' + NB + '— в год убытка не видно, расход это или доход';
      }
    }
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

  // ---- skachok-v1 [команда] 10.10: резкий скачок в отчётности — выручка или активы за последний год изменились
  // в 2 раза и больше (рост ×2 и больше, падение на 50 % и больше). Живой ответ 10.10: у сетевой компании активы
  // на 31.12.2025 — в 3,9 раза больше, чем годом раньше, а таблица об этом молчит, и «рост выручки» читается как обычный.
  // Только факт из ответа: выручка — dossier.charts.revenue (два последних соседних года, оба > 0, база от 1 млн ₽);
  // активы — KPI «Активы» с delta (% к прошлому году, считает API). Причину не утверждаем: «так бывает при…».
  // Рост — нейтрально (ton 'ro'), падение — «внимание» (ton 'warn'). → { ton, tekst, fakty: [...] } | null
  var SKACHOK_BAZA = 1e6;
  function skachok(r) {
    var D = (r && r.dossier) || {}, ch = D.charts || {}, fakty = [], vverh = false, vniz = false;
    var v = ryad(ch.revenue);
    if (v.length >= 2) {
      var a = v[v.length - 2], b = v[v.length - 1];
      if (b.year - a.year === 1 && a.value >= SKACHOK_BAZA && b.value > 0) {
        var k = b.value / a.value;
        if (k >= 2) { vverh = true; fakty.push({ k: 'revenue', god: b.year, kRaz: k, tekst: 'Выручка за' + NB + b.year + NB + 'год — ' + vRaz(k) + ' больше, чем за' + NB + a.year + '.' }); }
        else if (k <= 0.5) { vniz = true; fakty.push({ k: 'revenue', god: b.year, kRaz: k, tekst: 'Выручка за' + NB + b.year + NB + 'год — на' + NB + Math.round((1 - k) * 100) + NB + '% меньше, чем за' + NB + a.year + '.' }); }
      }
    }
    var akt = (Array.isArray(D.kpi) ? D.kpi : []).filter(function (x) { return x && /^Активы(\s|$)/.test(String(x.label || '')); })[0];
    var bg = ch.balance && typeof ch.balance === 'object' ? parseInt(ch.balance.year, 10) : NaN;
    if (akt && typeof akt.delta === 'number' && isFinite(akt.delta) && typeof akt.value === 'number' && akt.value > 0) {
      var na = isFinite(bg) ? 'Активы на' + NB + '31.12.' + bg : 'Активы';
      var ka = 1 + akt.delta / 100;
      if (ka >= 2 && akt.value / ka >= SKACHOK_BAZA) { vverh = true; fakty.push({ k: 'aktivy', god: isFinite(bg) ? bg : null, kRaz: ka, tekst: na + ' — ' + vRaz(ka) + ' больше, чем годом раньше.' }); }
      else if (akt.delta <= -50) { vniz = true; fakty.push({ k: 'aktivy', god: isFinite(bg) ? bg : null, kRaz: ka, tekst: na + ' — на' + NB + Math.round(-akt.delta) + NB + '% меньше, чем годом раньше.' }); }
    }
    if (!fakty.length) return null;
    var t = fakty.map(function (f) { return f.tekst; });
    if (vverh) t.push('Так бывает, например, при присоединении другой компании, крупной сделке или переоценке имущества — годы до' + NB + 'и' + NB + 'после скачка сравнивайте осторожно.');
    if (vniz) t.push('Перед авансом спросите компанию, что изменилось.');
    return { ton: vniz ? 'warn' : 'ro', tekst: t.join(' '), fakty: fakty };
  }
  function skachokHtml(r) {
    var s = skachok(r);
    return s ? '<p class="din__skachok din__skachok--' + s.ton + '" data-blok="skachok"><b>Скачок в' + NB + 'отчётности.</b> ' + esc(s.tekst) + '</p>' : '';
  }

  // Спарклайн (макет [команда] 02.10, токены v1.1): линия 96 × 20, 1,5 px, без осей и точек.
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
    if (s.ubGody && s.ubGody.indexOf(g) >= 0) return '<span title="В год убытка не видно, расход это или доход по налогу">±' + s.fmt(x.value) + '</span>';
    // znak-naloga-v1.1: налог со знаком < 0 — доход по налогу (например, из-за отложенного налога), словом, а не минусом
    if (s.k === 'income_tax' && x.value < 0) return '<span title="Доход по налогу на прибыль">доход ' + dengi(-x.value) + '</span>';
    return s.fmt(x.value);
  }

  // ---- staraya-otchetnost-v1 [команда] 10.10 (ТЗ [команда] 10.10 01:40, разд. 2.2 и 3 п. Б): последняя открытая отчётность
  // старше (год проверки по Москве − 2) — показываем её как «последнюю открытую», а не как текущую. Живой ответ 10.10:
  // у крупной торговой сети — «Выручка за 2021» рядом с «проверено 10.10.2026», строки о 2022–2025 не было.
  // Последний год — наибольший по всем рядам ГИР БО ответа (выручка, прибыль, налог, баланс, расчёты, KPI «за ГГГГ»).
  // Нет ни одного года — null (это другой случай: «Нет в ответе ГИР БО»). Причину не пишем — её не знаем, только факт.
  // Та же функция — в js/sushchestvennoe.js, js/dinamika.js, js/pasport-kontragenta.js (tests/staraya_otchetnost.test.js сверяет).
  function poslGodOtchetnosti(r) {
    var D = (r && r.dossier) || {}, ch = D.charts || {}, g = null;
    function vz(y) { y = parseInt(y, 10); if (isFinite(y) && y > 1990 && y < 2200 && (g === null || y > g)) g = y; }
    ['revenue', 'profit', 'income_tax'].forEach(function (k) {
      (Array.isArray(ch[k]) ? ch[k] : []).forEach(function (x) { if (x && x.value != null && x.value !== '' && isFinite(Number(x.value))) vz(x.year); });
    });
    ['balance', 'debts'].forEach(function (k) { if (ch[k] && typeof ch[k] === 'object' && !Array.isArray(ch[k])) vz(ch[k].year); });
    (Array.isArray(D.kpi) ? D.kpi : []).forEach(function (k) {
      var m = /за (\d{4})$/.exec((k && k.label) || '');
      if (m && k.value != null && isFinite(Number(k.value))) vz(m[1]);
    });
    return g;
  }
  function godProverki(r, segodnya) {
    var t = Date.parse((r && r.checked_at) || '');
    var ms = isFinite(t) ? t : (segodnya || new Date()).getTime();
    return new Date(ms + 3 * 3600 * 1000).getUTCFullYear();
  }
  // → { god, tekst } | null
  function staraya(r, segodnya) {
    var g = poslGodOtchetnosti(r);
    if (g === null || g >= godProverki(r, segodnya) - 2) return null;
    return { god: g, tekst: 'Последняя открытая отчётность — за' + NB + g + NB + 'год. Более свежей в' + NB + 'открытых данных ГИР' + NB + 'БО нет — запросите отчётность у' + NB + 'компании.' };
  }
  function starayaHtml(r) { var s = staraya(r); return s ? '<p class="din__star" data-blok="staraya">' + esc(s.tekst) + '</p>' : ''; }

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
      starayaHtml(r) +
      '<div class="din__w"><table class="din__t"><caption class="din__cap">Показатели по годам, ' + g0 + '–' + g1 + '</caption>' +
      '<thead><tr><th scope="col">Показатель</th><th scope="col" class="din__g"><span class="din__cap">График </span>' + g0 + '–' + g1 + '</th>' +
      '<th scope="col" class="din__v din__p n">' + gp + '</th><th scope="col" class="din__v n">' + g1 + '</th><th scope="col" class="din__v">Изм.</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
      (tr.length ? '<p class="din__tr">' + tr.map(esc).join(' ') + '</p>' : '') +
      skachokHtml(r) +
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
  // Доли пассива — тем же расчётом, что PasportKontragenta.strukturaBalansa (balans-edinyj-v1): метод наибольшего остатка,
  // три доли дают ровно 100 %; доли — только когда известны все три части и ни одна не меньше нуля. Совпадение — tests/balans_edinyj.test.js.
  function doliBalansa(ch) {
    var vse = ch.length === 3 && ch.every(function (x) { return x.v != null && x.v >= 0; });
    var tot = vse ? ch.reduce(function (a, x) { return a + x.v; }, 0) : 0;
    if (!(tot > 0)) return false;
    ch.forEach(function (x) { var t = x.v / tot * 100; x.p = Math.floor(t); x.o = t - x.p; x.w = t; });
    var ost = 100 - ch.reduce(function (a, x) { return a + x.p; }, 0);
    ch.slice().sort(function (a, c) { return c.o - a.o; }).slice(0, ost).forEach(function (x) { x.p++; });
    ch.forEach(function (x) { x.dolya = x.p < 1 && x.v > 0 ? 'меньше' + NB + '1' + NB + '%' : x.p + NB + '%'; });
    return true;
  }
  function balans(r) {
    var ch = (r && r.dossier && r.dossier.charts) || {};
    var b = ch.balance && typeof ch.balance === 'object' ? ch.balance : null, d = ch.debts && typeof ch.debts === 'object' ? ch.debts : null;
    var out = { god: null, chasti: [], polosa: false, kapitalMinus: null, raschety: [], godR: null, zajmyKVyr: null };
    if (b) {
      var gb = parseInt(b.year, 10), eq = chisl(b.equity), ld = chisl(b.long_debt), sd = chisl(b.short_debt);
      if (isFinite(gb) && (eq != null || ld != null || sd != null)) {
        out.god = gb;
        var ch3 = [{ k: 'kap', nazv: 'Собственный капитал', v: eq }, { k: 'dol', nazv: 'Долгосрочные обязательства', v: ld }, { k: 'kor', nazv: 'Краткосрочные обязательства', v: sd }];
        // полоса и доли — только при всех трёх частях ≥ 0; иначе строки суммами без долей (капитал меньше нуля — первой строкой, красным)
        out.polosa = doliBalansa(ch3);
        out.chasti = ch3.filter(function (x) { return x.v != null && x.v > 0; })
          .map(function (x) { return { k: x.k, nazv: x.nazv, v: x.v, dolya: out.polosa ? x.dolya : '', p: out.polosa ? x.p : null, w: out.polosa ? x.w : null }; });
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
      if (b.polosa && b.chasti.length) {
        h += '<div class="din__bar" role="img" aria-label="' + esc(b.chasti.map(function (x) { return x.nazv + ' — ' + x.dolya.replace(NB, ' '); }).join(', ')) + '">' +
          b.chasti.map(function (x) { return '<i class="din__b--' + x.k + '" style="width:' + x.w.toFixed(1) + '%"></i>'; }).join('') + '</div>';
      }
      h += '<ul class="din__leg">' + (b.kapitalMinus != null ? '<li class="din__minus"><i></i><span>Собственный капитал</span><b class="n">' + dengi(b.kapitalMinus) + '</b><em>меньше нуля</em></li>' : '') +
        b.chasti.map(function (x) {
          // без полосы цветной квадрат легенды ничего не обозначает — место оставляем пустым (строки ровные)
          return '<li><i' + (b.polosa ? ' class="din__b--' + x.k + '"' : '') + '></i><span>' + esc(x.nazv) + '</span><b class="n">' + dengi(x.v) + '</b><em class="n">' + x.dolya + '</em></li>';
        }).join('') + '</ul>';
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
    return '<section class="din" aria-label="Баланс по годовой отчётности">' + starayaHtml(r) + bh +
      '<p class="din__src">Источник: ГИР БО ФНС, годовая бухгалтерская отчётность (баланс).</p></section>';
  }

  // ---- «Что изменилось»: снимок существенных фактов, без персональных данных ----
  // zapis-egryul-v1 [команда]: дата последнего изменения записи в ЕГРЮЛ — company.state_actuality_date (DaData: дата последних
  // изменений записи), иначе строка dossier.data_dates «последнее изменение записи ЕГРЮЛ/ЕГРИП — ДД.ММ.ГГГГ». Дата позже дня
  // проверки — не значение (сбой источника). → 'ГГГГ-ММ-ДД' | null
  function zapisEgryul(r) {
    var c = (r && r.company) || {}, d = null;
    var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(c.state_actuality_date || ''));
    if (m) d = m[1];
    if (!d) {
      var q = /последнее изменение записи ЕГРЮЛ[^—–-]*[—–-]\s*(\d{2})\.(\d{2})\.(\d{4})/i.exec(String(((r && r.dossier) || {}).data_dates || ''));
      if (q) d = q[3] + '-' + q[2] + '-' + q[1];
    }
    if (!d || !isFinite(Date.parse(d))) return null;
    var den = /^(\d{4}-\d{2}-\d{2})/.exec(String((r && r.checked_at) || ''));
    if (den && d > den[1]) return null;
    return d;
  }
  // Сколько прошло от даты записи до дня проверки: «сегодня», «12 дней назад», «2 месяца назад», «3 года назад». → {dn, t} | null
  function davnost(iso, t) {
    var a = Date.parse(iso), b = new Date(t + 3 * CHAS);
    if (!isFinite(a) || !isFinite(t)) return null;
    var dn = Math.round((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - a) / (24 * CHAS));
    if (dn < 0) return null;
    if (dn === 0) return { dn: 0, t: 'сегодня' };
    if (dn <= 60) return { dn: dn, t: dn + NB + skl(dn, 'день', 'дня', 'дней') + ' назад' };
    if (dn < 730) { var ms = Math.floor(dn / 30.44); return { dn: dn, t: ms + NB + skl(ms, 'месяц', 'месяца', 'месяцев') + ' назад' }; }
    var g = Math.floor(dn / 365.25);
    return { dn: dn, t: g + NB + skl(g, 'год', 'года', 'лет') + ' назад' };
  }
  var VYPISKA = '<a href="https://egrul.nalog.ru/" target="_blank" rel="noopener">выписке ЕГРЮЛ</a>';

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
      // налог без знака (znak-naloga-v1) — два варианта: [год, меньшая, большая]
      if (ro && isFinite(ro.n)) s.rn = ro.bezZnaka && isFinite(ro.nMin) ? [ro.god, Math.round(ro.nMin * 10) / 10, Math.round(ro.nMax * 10) / 10] : [ro.god, Math.round(ro.n * 10) / 10];
      // кредиты и займы (баланс, dossier.charts.debts.loans; та же строка «Кредиты и займы» в досье) — для «стали больше годовой выручки» и «выросли в 2 раза»
      var db = ch.debts, zg = db && typeof db === 'object' ? parseInt(db.year, 10) : NaN, zl = db ? db.loans : null;
      if (isFinite(zg) && zl !== null && zl !== '' && typeof zl !== 'boolean' && isFinite(Number(zl)) && Number(zl) >= 0) s.zm = [zg, Number(zl)];
      // основной вид деятельности (ЕГРЮЛ): код и название — для «основной вид деятельности сменился»
      var ok = okved(r);
      if (ok) { s.ok = ok.kod; if (ok.nazv) s.okn = ok.nazv; }
      // уставный капитал (строка досье «Уставный капитал», ЕГРЮЛ) и ООО ли это — для «капитал уменьшился» и срока кредитора ООО
      var ku = ustKapital(r);
      if (ku !== null) { s.ku = ku; if (ooo(r)) s.ooo = 1; }
      // zapis-egryul-v1 [команда]: дата последнего изменения записи ЕГРЮЛ — для «запись обновлялась после вашей проверки»
      var ez = zapisEgryul(r);
      if (ez) s.egrd = ez;
      // КПП (ЕГРЮЛ): первые 4 цифры — код налоговой инспекции; для «КПП сменился — другая инспекция»
      var kpp = String(c.kpp == null ? '' : c.kpp).replace(/\s+/g, '').toUpperCase();
      if (/^\d{4}[0-9A-Z]{2}\d{3}$/.test(kpp)) s.kpp = kpp;
      // Индекс (сервер или браузер по открытой методике, js/indeks-otvet.js) — для «Индекс: 64 → 58 с проверки 01.10»
      var ix = ixChislo(r);
      if (ix != null) {
        s.ix = ix;
        // почему такое число (indeks-pochemu-v1): id факторов, полнота и версия методики — только у браузерного расчёта
        var ir = ixRazbor(r);
        if (ir) { s.ixf = ir.f; s.ixp = ir.p; s.ixv = ir.v; }
      }
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

  // Строка досье по названию (любой раздел): «Уставный капитал», «Организационно-правовая форма». → строка | ''
  function strokaDosje(r, re) {
    var D = (r && r.dossier) || {}, v = '';
    (Array.isArray(D.sections) ? D.sections : []).forEach(function (sk) {
      if (!sk || !Array.isArray(sk.rows)) return;
      sk.rows.forEach(function (row) {
        if (!v && Array.isArray(row) && re.test(String(row[0] || '').trim())) v = String(row[1] == null ? '' : row[1]);
      });
    });
    return v;
  }
  // Уставный капитал из строки досье: «118 367 564 500 ₽», «10 000,00 ₽». Ноль — значение; «тыс.», текст, минус — не значение. → число | null
  function ustKapital(r) {
    var t = strokaDosje(r, /^Уставный капитал$/i).replace(/\s+/g, '').replace(/(₽|руб\.?)$/i, '');
    if (!/^\d{1,15}(?:[.,]\d{1,2})?$/.test(t)) return null;
    var v = Number(t.replace(',', '.'));
    return isFinite(v) ? v : null;
  }
  // ООО: по строке «Организационно-правовая форма» или полному наименованию (у АО срок кредитора — другая норма, её не пишем)
  function ooo(r) {
    var c = (r && r.company) || {};
    return /ограниченной\s+ответственностью/i.test(strokaDosje(r, /^Организационно-правовая форма$/i) + ' ' + String(c.name_full || ''));
  }
  // Сумма в рублях целиком: «10 000 ₽», «1 234 567,50 ₽» (капитал — не округляем до «млн»)
  function rubliTochno(v) {
    var z = Math.round(v * 100), cel = Math.floor(z / 100), kop = z % 100;
    return String(cel).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + (kop ? ',' + ('0' + kop).slice(-2) : '') + NB + '₽';
  }
  // Подстрочники izm-egryul-v1 — тексты [команда] 04.10 14:50 (документ команды), разд. 3 и 4,
  // и [команда] 04.10 14:55 (ТЗ izmeneniya-egryul-v1, пп. 2 и 5, ✅). Реорганизация — без «вправе потребовать досрочно» ([команда] разд. 4).
  // Неразрывные пробелы — только через NB; «\s» в JS ловит и неразрывный, и узкий пробел. В новых строках нет ни «сырых» невидимых символов,
  // ни escape-последовательностей с «u» — патч переживает перепечатку текстом (v1.1).
  var POD_KAP = 'Если ваше требование к' + NB + 'компании возникло до' + NB + 'первой публикации уведомления об' + NB + 'уменьшении, в' + NB + 'течение 30' + NB + 'дней ' +
    'с' + NB + 'последней публикации в' + NB + '«Вестнике государственной регистрации» вы вправе потребовать досрочного исполнения, а' + NB + 'если это невозможно — ' +
    'прекращения обязательства и' + NB + 'возмещения убытков (п.' + NB + '5 ст.' + NB + '20 14-ФЗ). Пропустили 30' + NB + 'дней — право требовать досрочно уходит; ' +
    'обычные права по' + NB + 'договору остаются. В' + NB + 'суд с' + NB + 'таким требованием — не' + NB + 'позднее 6' + NB + 'месяцев с' + NB + 'последней публикации.';
  var POD_KPP = 'Старый КПП в' + NB + 'вашей платёжке — частая причина уточнения платежа. Новые реквизиты возьмите письмом за' + NB + 'подписью ' +
    'и' + NB + 'подтвердите звонком по' + NB + 'известному номеру.';
  var POD_REORG = 'Обязательства перейдут к' + NB + 'правопреемнику — узнайте, к' + NB + 'какому, и' + NB + 'проверьте его по' + NB + 'ИНН так' + NB + 'же, как саму компанию. ' +
    'Если ваше требование возникло до' + NB + 'первой публикации о' + NB + 'реорганизации, проверьте сроки: 30' + NB + 'дней с' + NB + 'последней публикации ' +
    'в' + NB + '«Вестнике государственной регистрации» (п.' + NB + '2 ст.' + NB + '60 ГК' + NB + 'РФ).';

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
  // Разбор браузерного Индекса для снимка: {f: [id факторов], p: полнота %, v: версия методики} | null.
  // Серверное число (r.indeks) не раскладываем — его факторов в ответе нет.
  function ixRazbor(r) {
    var v = r && r.indeks;
    if (v !== undefined && v !== null && v !== '') return null;
    var IO = ixModul();
    try {
      if (!IO || !IO.gotov || !IO.gotov() || !IO.versiya) return null;
      var x = IO.vid(r);
      if (x.rezhim !== 'chislo' || !Array.isArray(x.vklady)) return null;
      return { f: x.vklady.map(function (q) { return String(q.id); }).filter(function (id) { return /^[a-z0-9_]{2,40}$/.test(id); }).slice(0, 40),
        p: isFinite(x.polnota) ? Math.round(x.polnota) : null, v: IO.versiya() };
    } catch (e) { return null; }
  }
  // Подстрочник к «Индекс: A → B»: какие факторы методики появились и какие ушли (не больше 3, крупные — первыми).
  // Без разбора в одном из снимков (сервер, старый снимок) — молчим; методика сменилась — так и пишем, факторы не сравниваем.
  function ixPochemu(a, b) {
    if (!Array.isArray(a.ixf) || !Array.isArray(b.ixf)) return '';
    if (a.ixv && b.ixv && a.ixv !== b.ixv) return 'Методика Индекса обновилась: v' + a.ixv + ' → v' + b.ixv + ' — факторы двух проверок не' + NB + 'сравниваем.';
    var IO = ixModul(), F = function (id) { try { return IO && IO.faktor ? IO.faktor(id) : null; } catch (e) { return null; } };
    var nov = [], ush = [];
    b.ixf.forEach(function (id) { if (a.ixf.indexOf(id) < 0) { var f = F(id); if (f) nov.push(f); } });
    a.ixf.forEach(function (id) { if (b.ixf.indexOf(id) < 0) { var f = F(id); if (f) ush.push(f); } });
    var vse = nov.map(function (f) { return { f: f, d: f.vklad, n: 1 }; }).concat(ush.map(function (f) { return { f: f, d: -f.vklad, n: 0 }; }));
    if (!vse.length) {
      if (typeof a.ixp === 'number' && typeof b.ixp === 'number' && a.ixp !== b.ixp)
        return 'Факторы те' + NB + 'же — изменилась полнота данных: ' + a.ixp + NB + '% → ' + b.ixp + NB + '%.';
      return '';
    }
    vse.sort(function (p, q) { return Math.abs(q.d) - Math.abs(p.d); });
    // indeks-pochemu-v1.1 [команда]: сдвиг не всегда равен сумме вкладов — у части факторов есть потолок
    // (недостоверность: «не выше 45»), плюсы учитываются не больше чем на +N, шкала — от 1 до 99. Объясняем, а не молчим.
    var est = vse.length > 3 ? vse.length - 3 : 0;
    var dop = dopPochemu(a, b, nov, ush, vse, IO, est);
    vse = vse.slice(0, 3);
    var zn = function (n) { return (n > 0 ? '+' : '−') + Math.abs(n); };
    // название фактора — в ёлочках, внутренние кавычки — „лапками“
    var kav = function (t) { return '«' + String(t).replace(/«/g, '„').replace(/»/g, '“') + '»'; };
    var chast = function (spisok, zag) {
      return spisok.length ? zag + ' — ' + spisok.map(function (x) { return kav(x.f.tekst) + NB + '(' + zn(x.d) + ')'; }).join(', ') : '';
    };
    var t = [chast(vse.filter(function (x) { return x.n; }), 'появилось'), chast(vse.filter(function (x) { return !x.n; }), 'ушло')]
      .filter(Boolean).join('; ');
    return 'Почему: ' + t + (est ? '; и' + NB + 'ещё ' + est : '') + '.' + (dop ? ' ' + dop : '') +
      ' Вклады — по' + NB + 'открытой методике' + (b.ixv ? ' v' + b.ixv : '') + '.';
  }
  // Пояснение, когда «Индекс: A → B» не равен сумме вкладов появившихся и ушедших факторов.
  // Потолок берём из методики (IO.faktor(id).potolok), а не из снимка: старые снимки остаются понятными.
  // Потолок «включился» — у нового фактора с потолком P и B === наименьшему такому P; «снят» — ушёл фактор с потолком P и A === P.
  // Часть факторов скрыта («и ещё N») — сумму вкладов читатель не сверит, общую оговорку не ставим.
  function dopPochemu(a, b, nov, ush, vse, IO, est) {
    if (typeof a.ix !== 'number' || typeof b.ix !== 'number') return '';
    var kav = function (t) { return '«' + String(t).replace(/«/g, '„').replace(/»/g, '“') + '»'; };
    var minP = function (sp) {
      var m = null;
      sp.forEach(function (f) { if (typeof f.potolok === 'number' && (!m || f.potolok < m.potolok)) m = f; });
      return m;
    };
    var pn = minP(nov), pu = minP(ush);
    if (pn && b.ix === pn.potolok)
      return (nov.length === 1 && !ush.length ? 'С' + NB + 'этим признаком' : 'При' + NB + 'признаке ' + kav(pn.tekst)) +
        ' Индекс не' + NB + 'выше ' + pn.potolok + ' — потолок методики.';
    if (pu && a.ix === pu.potolok)
      return 'Потолок методики «не' + NB + 'выше ' + pu.potolok + '» ушёл вместе с' + NB + 'признаком.';
    if (est) return '';
    var summa = 0;
    vse.forEach(function (x) { summa += x.d; });
    if (summa === b.ix - a.ix) return '';
    var sh = null;
    try { sh = IO && IO.shkala ? IO.shkala() : null; } catch (e) { sh = null; }
    var pl = sh && typeof sh.plyusyMaks === 'number' ? ' (не' + NB + 'больше +' + sh.plyusyMaks + ')' : '';
    var gr = sh && typeof sh.min === 'number' && typeof sh.max === 'number' ? 'шкала — от' + NB + sh.min + ' до' + NB + sh.max : 'шкала ограничена';
    return 'Итог не' + NB + 'равен сумме вкладов: у' + NB + 'плюсов есть предел' + pl + ', у' + NB + 'части признаков — потолок, ' + gr + '.';
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
    return d.getDate() + NB + m[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? NB + d.getFullYear() : '');
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
      // уже исключена: тон — стоп; подстрочник — [команда] 16:07 разд. 2 («последствия — как при ликвидации»: норма говорит о последствиях)
      // + что делать кредитору — [команда] 03.10 19:10 разд. 2 дословно (документ команды); «Разбор дела…» — ссылка на Разбор № 9
      add('huzhe', 'Компания исключена из' + NB + 'ЕГРЮЛ' + zapis(b) + ranshe,
        'Последствия — как при' + NB + 'ликвидации (п.' + NB + '2 ст.' + NB + '64.2 ГК' + NB + 'РФ): договор с' + NB + 'ней не' + NB + 'заключайте и' + NB + 'не' + NB + 'платите. ' +
        'Если она вам должна: исключение можно обжаловать в' + NB + 'суде в' + NB + 'течение года со дня, когда вы узнали или' + NB + 'должны были узнать о' + NB + 'нём (п.' + NB + '8 ст.' + NB + '22' + NB + '129-ФЗ). Долг можно требовать с' + NB + 'тех, кто' + NB + 'управлял компанией, если она не' + NB + 'заплатила из-за их' + NB + 'недобросовестных или' + NB + 'неразумных действий (п.' + NB + '3 ст.' + NB + '64.2 ГК' + NB + 'РФ, п.' + NB + '3.1 ст.' + NB + '3' + NB + '14-ФЗ). Разбор дела: что доказывать кредитору.');
      bezSt = true;
    } else if (iB && !iA && (a.kod || a.st === 'ACTIVE')) {
      add('huzhe', nazvIskl(b.kod) + zapis(b) + ranshe, podIskl(b.kod, b.kodd));
      bezSt = true;
    } else if (iA && !iB && b.st === 'ACTIVE') {
      add('luchshe', 'Отметки о' + NB + 'предстоящем исключении из' + NB + 'ЕГРЮЛ больше нет: компания действующая');
      bezSt = true;
    }
    if (!bezSt && a.st && b.st && (a.st !== b.st || (a.kod && b.kod && iskl(a.kod) !== iskl(b.kod))) && nazvSt(a.st, a.kod) !== nazvSt(b.st, b.kod))
      add(b.st === 'ACTIVE' ? 'luchshe' : 'huzhe', 'Статус в ЕГРЮЛ: ' + nazvSt(a.st, a.kod) + ' → ' + nazvSt(b.st, b.kod), b.st === 'REORGANIZING' ? POD_REORG : '');
    if (a.lvl && b.lvl && a.lvl !== b.lvl) {
      var o = ['low', 'medium', 'high'];
      add(o.indexOf(b.lvl) > o.indexOf(a.lvl) ? 'huzhe' : 'luchshe', 'Оценка риска: ' + LVL[a.lvl] + ' → ' + LVL[b.lvl]);
    }
    if (a.ix && b.ix && a.ix !== b.ix && isFinite(a.t))
      add(b.ix < a.ix ? 'huzhe' : 'luchshe', 'Индекс: ' + a.ix + ' → ' + b.ix + ' с' + NB + 'проверки ' + ddmm(a.t), ixPochemu(a, b));
    if (a.zsk && b.zsk && a.zsk !== b.zsk) {
      var z = ['low', 'medium', 'high'];
      add(z.indexOf(b.zsk) > z.indexOf(a.zsk) ? 'huzhe' : 'luchshe', 'Прогноз ЗСК (наша оценка): ' + LVL[a.zsk] + ' → ' + LVL[b.zsk]);
    }
    if (a.nedost === false && b.nedost === true) add('huzhe', 'Появилась отметка о недостоверности сведений в ЕГРЮЛ');
    if (a.nedost === true && b.nedost === false) add('luchshe', 'Отметка о недостоверности сведений в ЕГРЮЛ снята');
    if (a.dir && b.dir && a.dir !== b.dir) add('info', 'Руководитель сменился: новая запись в ЕГРЮЛ с' + NB + dmy(b.dir));
    // уставный капитал (ЕГРЮЛ): только уменьшение; срок кредитора — только у ООО (п. 5 ст. 20 14-ФЗ), у АО — без подстрочника
    if (typeof a.ku === 'number' && typeof b.ku === 'number' && a.ku > 0 && b.ku < a.ku)
      add('info', 'Уставный капитал уменьшился: ' + rubliTochno(a.ku) + ' → ' + rubliTochno(b.ku) + ' (ЕГРЮЛ)', b.ooo && a.ooo ? POD_KAP : '');
    // КПП (ЕГРЮЛ): другой код инспекции (первые 4 цифры) — так и пишем; иначе — просто «сменился»
    if (a.kpp && b.kpp && a.kpp !== b.kpp)
      add('info', 'КПП сменился: ' + a.kpp + ' → ' + b.kpp + (a.kpp.slice(0, 4) !== b.kpp.slice(0, 4) ? ' — компания встала на' + NB + 'учёт в' + NB + 'другой налоговой инспекции' : '') + ' (ЕГРЮЛ)', POD_KPP);
    Object.keys(b.sig || {}).forEach(function (id) {
      if (bezSt && id === 'status') return;
      var x = (a.sig || {})[id], y = b.sig[id];
      if (!x) { if (VES[y[0]] > 0) add('huzhe', y[1] + ': ' + STX[y[0]]); return; }
      if (x[0] !== y[0]) add(VES[y[0]] > VES[x[0]] ? 'huzhe' : VES[y[0]] < VES[x[0]] ? 'luchshe' : 'info', y[1] + ': ' + STX[x[0]] + ' → ' + STX[y[0]]);
    });
    // izm-indeks-v1: признак был «внимание»/«риск», а в новом ответе строки нет. Сняли его или источник не ответил — из ответа
    // не видно, поэтому серая точка, не зелёная («не проверили» ≠ «не нашли»). Пустой список признаков — сбой ответа, молчим.
    // Подстрочник — [команда] 04.10 07:07 разд. 4 (правка ритма), дословно (shchit-ubytki-v1).
    if (Object.keys(b.sig || {}).length) Object.keys(a.sig || {}).forEach(function (id) {
      if ((bezSt && id === 'status') || b.sig.hasOwnProperty(id)) return;
      var x = a.sig[id];
      if (!Array.isArray(x) || !(VES[x[0]] > 0) || !x[1]) return;
      add('info', x[1] + ': на' + NB + 'прошлой проверке — ' + STX[x[0]] + ', в' + NB + 'этой строки нет',
        'Признак могли снять — или источник в' + NB + 'этот раз не' + NB + 'ответил. «Не' + NB + 'проверили» — не' + NB + 'значит «не' + NB + 'нашли».');
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
    // zapis-egryul-v1: запись в ЕГРЮЛ обновилась после прошлой проверки, а то, что мы сравниваем, не изменилось —
    // одна справочная строка: что ещё изменилось (участники, адрес, лицензии), видно только в выписке. Старый снимок без даты — молчим.
    if (a.egrd && b.egrd && b.egrd > a.egrd && !out.some(function (x) { return /ЕГРЮЛ/.test(x.t); }))
      add('info', 'Запись в' + NB + 'ЕГРЮЛ обновлялась после вашей проверки: последнее изменение — ' + dmy(b.egrd),
        'Из записи ЕГРЮЛ мы сравниваем статус, руководителя, капитал, КПП и' + NB + 'основной вид деятельности — они прежние. ' +
        'Что ещё изменилось (например, участники или адрес), видно в' + NB + 'выписке ЕГРЮЛ.');
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
    if (!a) return b.egrd ? { pervyj: true, egrd: b.egrd, t: b.t } : { pervyj: true };
    return { s: a, izm: sravnit(a, b) };
  }

  // pasport-izm-v1 [команда]: то же сравнение только для чтения — Паспорт снимков не сохраняет (его открывают и по старому досье).
  // Берём самую позднюю проверку этой компании в браузере раньше досье больше чем на час. → { s, izm } | null
  function sravnitSnimki(r, ls) {
    var b = snimok(r);
    if (!b || !ls) return null;
    var vse = chitat(ls);
    if (!vse) return null;
    var a = null;
    (Array.isArray(vse[b.inn]) ? vse[b.inn] : []).forEach(function (x) {
      if (x && x.inn === b.inn && isFinite(x.t) && x.t <= b.t - CHAS && (!a || x.t > a.t)) a = x;
    });
    return a ? { s: a, izm: sravnit(a, b) } : null;
  }
  // Образец Паспорта (?demo=1): как выглядит блок при повторной проверке — прошлая проверка «за 35 дней до», три отличия.
  function obrazecIzm(r) {
    var b = snimok(r);
    if (!b) return null;
    var a = JSON.parse(JSON.stringify(b));
    a.t = b.t - 35 * 24 * CHAS;
    a.lvl = 'medium';
    if (b.kpp) a.kpp = b.kpp.slice(0, 2) + '11' + b.kpp.slice(4);
    if (b.vyr) { a.vyr = [b.vyr[0] - 1, Math.round(b.vyr[1] * 0.91)]; delete a.prib; }
    return { s: a, izm: sravnit(a, b) };
  }
  // Блок для Паспорта: под «Итогом», только на экране — в PDF и в отпечаток SHA-256 не входит (класс noprint).
  function htmlPasport(rez, obrazec) {
    if (!rez || !rez.s || !Array.isArray(rez.izm)) return '';
    return '<section class="pk-izm noprint" aria-label="Что изменилось с вашей прошлой проверки">' + htmlIzmeneniya(rez) +
      '<p class="pk-izm__n">' + (obrazec ? 'Образец: так блок выглядит, когда вы проверяете компанию повторно. ' : '') +
      (rez.izm.length ? '' : 'Сравнили с' + NB + 'вашей проверкой на' + NB + 'этом устройстве. ') +
      'Блок только на экране: в' + NB + 'PDF Паспорта и в' + NB + 'его отпечаток не' + NB + 'входит.</p></section>';
  }

  // rez.id — сравнение с досье проверки из кабинета (любое устройство); иначе — со снимком в этом браузере.
  // opt.dokument — PDF-досье (report.html): документ читают позже и на бумаге — без «запомнили на устройстве»,
  // давность — от дня проверки («за 2 месяца до проверки»), а не от сегодня (ne-zaprashivali-v1 [команда]).
  function htmlIzmeneniya(rez, opt) {
    if (!rez) return '';
    var ZAPOMNILI = 'Запомнили эту проверку на' + NB + 'вашем устройстве. Проверите компанию снова — покажем, что изменилось.';
    if (rez.pervyj && opt && opt.dokument) {
      var dd = rez.egrd ? davnost(rez.egrd, rez.t) : null;
      if (!dd) return '';
      var kogdaD = dd.dn === 0 ? 'в' + NB + 'день проверки' : 'за ' + dd.t.replace(/ назад$/, '') + ' до' + NB + 'проверки';
      return '<p class="izm izm--0" data-izm="egryul">Последнее изменение записи в' + NB + 'ЕГРЮЛ — ' + dmy(rez.egrd) + ', ' + kogdaD + '.' +
        (dd.dn <= 30 ? ' Что именно изменилось, видно в' + NB + VYPISKA + '; перед оплатой сверьте с' + NB + 'ней подписанта и адрес в' + NB + 'договоре.' : '') + '</p>';
    }
    if (rez.pervyj) {
      // zapis-egryul-v1: уже на первой проверке — когда запись в ЕГРЮЛ менялась последний раз (факт реестра, без оценки)
      var dv = rez.egrd ? davnost(rez.egrd, rez.t) : null;
      if (!dv) return '<p class="izm izm--0">' + ZAPOMNILI + '</p>';
      if (dv.dn <= 30) return '<div class="izm izm--da izm--svezh" data-izm="egryul"><b>Запись в' + NB + 'ЕГРЮЛ менялась недавно: ' + dmy(rez.egrd) +
        ', ' + dv.t + '</b><span>Что именно изменилось, видно в' + NB + VYPISKA + '. Перед оплатой сверьте с' + NB +
        'ней подписанта и адрес в' + NB + 'договоре.</span></div><p class="izm izm--0">' + ZAPOMNILI + '</p>';
      return '<p class="izm izm--0" data-izm="egryul">Последнее изменение записи в' + NB + 'ЕГРЮЛ — ' + dmy(rez.egrd) + ', ' + dv.t + '. ' + ZAPOMNILI + '</p>';
    }
    var kogda = dataRu(rez.s.t);
    var dosje = rez.id ? '<a href="/report.html?id=' + encodeURIComponent(rez.id) + '" target="_blank" rel="noopener">досье от' + NB + dmyT(rez.s.t) + '</a>' : '';
    if (!rez.izm.length) return '<div class="izm"' + (rez.id ? ' data-izm="kabinet"' : '') + '><b>С вашей проверки ' + kogda + ' существенных изменений нет</b>' +
      '<span>Статус, руководитель, долги, оценка риска и признаки светофора — прежние.' + (rez.id ? ' Сравнили с ' + dosje + ' в вашем кабинете.' : '') + '</span></div>';
    return '<div class="izm izm--da"' + (rez.id ? ' data-izm="kabinet"' : '') + '><b>Что изменилось с вашей проверки ' + kogda + '</b><ul>' +
      rez.izm.map(function (x) {
        return '<li class="izm--' + x.ton + '">' + esc(x.t) + (x.pod ? '<small class="izm__pod">' + esc(x.pod).replace('vestnik-gosreg.ru',
          '<a href="https://vestnik-gosreg.ru/" target="_blank" rel="noopener">vestnik-gosreg.ru</a>').replace('в' + NB + 'выписке ЕГРЮЛ.', 'в' + NB + VYPISKA + '.').replace('Разбор дела: что доказывать кредитору.',
          '<a href="' + RAZBOR_ISKL + '">Разбор дела: что доказывать кредитору.</a>') + '</small>' : '') + '</li>';
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
    '.din__star{margin:0;padding:10px 12px;border-radius:10px;background:var(--warn-bg,#FBF3E2);color:var(--warn,#8A5A00);font-size:15px;line-height:1.45}' +
    '.din__tr{margin:0;font-size:15px;color:var(--ink2,#48484C)}.din__skachok{margin:0;padding:10px 12px;border-radius:10px;background:var(--surface-2,#F4F4F2);font-size:15px;line-height:1.45;color:var(--ink2,#48484C)}.din__skachok b{color:var(--ink,#1D1D1F)}.din__skachok--warn{background:var(--warn-bg,#FBF3E2);color:var(--warn,#8A5A00)}.din__skachok--warn b{color:inherit}.din__src{margin:0;font-size:12px;color:var(--muted,#6B6B70)}' +
    '.din__bal{display:grid;gap:8px;padding-top:6px;border-top:1px solid var(--line,#E6E6E1)}' +
    '.din__bh{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 10px;margin-top:6px}.din__bh b{font-size:15px;font-weight:600}.din__bh span{font-size:12px;color:var(--muted,#6B6B70)}' +
    '.din__bar{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;background:var(--surface-2,#EEEEEA)}.din__bar i{display:block;height:100%;min-width:2px}' +
    '.din__b--kap{background:var(--accent,#0B63E5)}.din__b--dol{background:#7FA8F0}.din__b--kor{background:#C9C9C4}' +
    '.din__leg{margin:0;padding:0;list-style:none;display:grid;gap:2px;font-size:15px}' +
    '.din__leg li{display:grid;grid-template-columns:auto 1fr auto 10em;align-items:baseline;gap:8px;padding:5px 0;border-top:1px solid var(--line,#E6E6E1)}.din__leg li:first-child{border-top:0}' +
    '.din__leg li>i{width:8px;height:8px;border-radius:2px;align-self:center}.din__ras li{grid-template-columns:1fr auto 10em}' +
    '.din__leg b{font-weight:600;text-align:right;white-space:nowrap}.din__leg em{font-style:normal;font-size:12px;color:var(--muted,#6B6B70);text-align:right;white-space:nowrap}' +
    '.din__minus>i{background:#B3261E}.din__minus b,.din__minus em{color:#B3261E}' +
    '@media (max-width:520px){.din__leg li{grid-template-columns:auto 1fr auto}.din__ras li{grid-template-columns:1fr auto}.din__leg em{grid-column:2/-1;text-align:left;margin-top:-4px}.din__ras em{grid-column:1/-1}.din__leg em:empty{display:none}}' +
    '.izm{display:grid;gap:4px;padding:14px 18px;border-radius:16px;border:1px solid var(--line,#E6E6E1);font-size:15px}' +
    '.izm b{font-size:15px;font-weight:600}.izm span{font-size:12px;color:var(--muted,#6B6B70)}.izm span a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
    '.izm ul{margin:4px 0;padding:0;list-style:none;display:grid;gap:4px}.izm li{padding-left:18px;position:relative}' +
    '.izm li::before{content:"";position:absolute;left:2px;top:.55em;width:8px;height:8px;border-radius:50%;background:var(--muted,#6B6B70)}' +
    '.izm__pod{display:block;margin-top:2px;font-size:13px;line-height:1.45;color:var(--muted,#6B6B70)}.izm__pod a{white-space:nowrap;color:inherit;text-decoration:underline;text-underline-offset:2px}' +
    '.izm li.izm--huzhe::before{background:#E5484D}.izm li.izm--luchshe::before{background:#2FA36B}' +
    '.izm--0{margin:0;padding:0;border:0;font-size:13px;color:var(--muted,#6B6B70)}' +
    '.izm--svezh{border-color:#E8D3A6;background:#FFFAF0}.izm--svezh+.izm--0{margin-top:8px}' +
    '#doc .izm,#doc .din{margin-top:14px}' +
    '@media (max-width:640px){.din__t .din__g{display:none}}' +
    '@media (max-width:520px){.din{padding:14px}.din__t{font-size:15px}.din__t th,.din__t td{padding-left:10px}.din__t .din__p{display:none}}' +
    '@media print{.din,.izm{break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}.izm--0{display:none}}';

  function stil(doc) {
    if (!doc || doc.getElementById('din-css')) return;
    var s = doc.createElement('style'); s.id = 'din-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // ---- izm-indeks-v1: методика Индекса загрузилась позже ответа API ----
  // Снимок сохраняется сразу при отрисовке; если методика (js/indeks-otvet.js) ещё грузилась, в снимке нет Индекса — и через
  // неделю строки «Индекс: A → B» не будет. Ждём методику и дописываем Индекс в тот же снимок (и в показанное сравнение).
  function ozhidatIndeks(r, ls, doc) {
    var b = snimok(r), v = r && r.indeks;
    if (!b || b.ix != null || b.inn.length !== 10 || (v !== undefined && v !== null && v !== '')) return false;
    var IO = ixModul();
    if (!IO || typeof IO.gotovo !== 'function' || typeof IO.gotov !== 'function' || IO.gotov()) return false;
    var kl = b.inn + ':' + b.t, popytki = 0;
    // gotovo() через 4 с зовёт и без методики — тогда ждём ещё (до 4 раз, ~16 с), медленная сеть тоже получит Индекс
    var zhdat = function () {
      if (!IO.gotov() && ++popytki < 4) { IO.gotovo(zhdat); return; }
      try { dopisatIndeks(r, ls, kl, doc); } catch (e) {}
    };
    IO.gotovo(zhdat);
    return true;
  }
  // → null (Индекса так и нет / другая проверка) | { b, zapisan: bool, rez: новое сравнение | null }
  function dopisatIndeks(r, ls, kl, doc) {
    var b = snimok(r);
    if (!b || b.ix == null || b.inn + ':' + b.t !== kl) return null;
    var zapisan = false;
    var vse = ls ? chitat(ls) : null;
    if (vse && Array.isArray(vse[b.inn])) {
      vse[b.inn].forEach(function (x) {
        if (!x || x.inn !== b.inn || !isFinite(x.t) || Math.abs(x.t - b.t) >= CHAS || x.ix != null) return;
        x.ix = b.ix;
        if (Array.isArray(b.ixf)) { x.ixf = b.ixf; x.ixp = b.ixp; x.ixv = b.ixv; }
        zapisan = true;
      });
      if (zapisan) zapisan = zapisat(ls, vse);
    }
    var out = { b: b, zapisan: zapisan, rez: null };
    if (!pokazan || pokazan.kl !== kl || !pokazan.rez || !pokazan.rez.s || !Array.isArray(pokazan.rez.izm)) return out;
    var star = pokazan.rez, izm = sravnit(star.s, b, dopolnenie && dopolnenie.kl === kl ? dopolnenie.fn : null);
    pokazan.b = b;
    if (JSON.stringify(izm) === JSON.stringify(star.izm)) return out;
    var nov = {}; Object.keys(star).forEach(function (k) { nov[k] = star[k]; });
    nov.izm = izm;
    pokazan.rez = nov;
    if (poslednij && poslednij.inn + ':' + poslednij.t === kl && !star.id) poslednij.rez = nov;
    out.rez = nov;
    try {
      doc = doc || (typeof document !== 'undefined' ? document : null);
      var mesto = doc && (doc.querySelector('.report') || doc.body);
      if (mesto && mesto.querySelector('.izm')) vstavit(mesto, htmlIzmeneniya(nov));
    } catch (e) {}
    return out;
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
      izm = htmlIzmeneniya(rez, { dokument: !!opt.dokument });
      ozhidatIndeks(r, ls, opt.doc);
    } catch (e) { izm = ''; }
    var din = '';
    try { din = htmlDinamika(r, opt); if (!din && opt.balans !== false) din = htmlBalansOtdelno(r); } catch (e) { din = ''; }
    return izm + din;
  }

  return { skachok: skachok, skachokHtml: skachokHtml, ryad: ryad, ryady: ryady, nalogBezZnaka: nalogBezZnaka, stroka: stroka, izmenenie: izmenenie, trendy: trendy, dengi: dengi, htmlDinamika: htmlDinamika, poslGodOtchetnosti: poslGodOtchetnosti, staraya: staraya, balans: balans, htmlBalans: htmlBalans,
    snimok: snimok, sravnit: sravnit, likvidnost: likvidnost, okved: okved, ustKapital: ustKapital, rubliTochno: rubliTochno, vRaz: vRaz, zapomnit: zapomnit, htmlIzmeneniya: htmlIzmeneniya, html: html, KEY: KEY, CSS: CSS,
    iskl: iskl, isklyuchena: isklyuchena, ixChislo: ixChislo, plusMes: plusMes, kodSost: kodSost, predydushchaya: predydushchaya, nuzhenKabinet: nuzhenKabinet, dogruzit: dogruzit, dobavit: dobavit, sDop: sDop, ozhidatIndeks: ozhidatIndeks, dopisatIndeks: dopisatIndeks,
    sravnitSnimki: sravnitSnimki, obrazecIzm: obrazecIzm, htmlPasport: htmlPasport, stil: stil };
});
;
/* --- /js/golos.js --- */
/* Делоскоп — «Голос клиента» (golos-klienta-v1, решение команды 12.10.2026 ~18:40, разд. 2 пп. 1 и 3).
 *
 * Два места, оба — только для вошедших:
 *   1) кабинет — карточка «Чего не хватает в Делоскопе?»: темы-кнопки + строка своими словами, одно действие «Отправить»;
 *   2) под отчётом проверки — одна строка «Что добавить в отчёт?»: после 3-й разной компании на этом устройстве
 *      и не чаще раза в 30 дней (закрыли «Не сейчас» — тоже 30 дней тишины).
 * golos-klienta-v2 (16.10.2026, обратная связь — главный продукт): строку под отчётом видят и гости —
 *      после 2-й разной компании (у гостя всего 10 проверок в день, ждать третью — потерять половину ответов), та же пауза 30 дней.
 *      Гость отправляет без cookie входа — сервер хранит ответ как анонимный (как «Полезно?»); почту и ИНН не шлём по-прежнему.
 * Отправка — тот же POST https://api.deloskop.ru/api/otzyv, что у «Полезно?» (js/otzyv.js), с cookie входа
 * (связь с аккаунтом — только на сервере, по id сессии; почту и имя сайт не отправляет):
 *   {id, stranica, vid: "kabinet" | "otchet", ocenka: "golos", tema: "sudy,bank" | "", tekst?, rezhim: "rabota"}
 * В тексте до отправки вырезаем почту, телефоны и 10–20-значные числа (ИНН предпринимателя — персональные данные) —
 * та же чистка, что в otzyv.js (тест сверяет). Сервер не принял ответ (до выкладки API — 422) — отзыв не теряется:
 * предлагаем письмо на help@ с уже подставленным текстом.
 * На устройстве храним только счётчик разных компаний, отпечаток последней (не ИНН) и дату последнего вопроса.
 * Чистые функции — для автотестов (node): tests/golos.test.js. */
(function (root) {
  "use strict";
  var MAX = 500;
  var DEN = 864e5, PAUZA_DNEJ = 30, POSLE_KOMPANIJ = 3, POSLE_KOMPANIJ_GOST = 2;
  // порядок — из решения команды 12.10; ключи уходят на сервер, подписи — только на экран
  var TEMY = [
    { k: "sudy", t: "Суды и банкротства" },
    { k: "bank", t: "Отчёт для банка" },
    { k: "1s", t: "Выписка из 1С целиком" },
    { k: "slezhenie", t: "Слежение за контрагентами" },
    { k: "api", t: "API и выгрузка" },
    { k: "drugoe", t: "Другое" }
  ];
  var KLYUCHI = TEMY.reduce(function (o, x) { o[x.k] = 1; return o; }, {});
  var T = {
    kabZag: "Чего не хватает в Делоскопе?",
    kabPod: "Отметьте, что пригодилось бы в вашей работе, — по этим ответам решаем, что делать первым.",
    pole: "Своими словами — необязательно",
    chistka: "Телефоны, почту и номера уберём из текста ещё до отправки. Ответ читает только команда Делоскопа.",
    otpravit: "Отправить",
    spasibo: "Спасибо, получили.",
    spasiboPod: "Что сделаем по таким просьбам, появится в «Что нового».",
    ne: "Сайт не принял ответ.",
    nePod: "Отправьте его письмом — текст уже подставлен:",
    pismo: "Написать на help@deloskop.ru",
    otchZag: "Что добавить в отчёт?",
    otchPod: "Одной строкой — читаем каждую.",
    otchPole: "Например, суды за пять лет",
    nesejchas: "Не сейчас"
  };

  function chistyj(t) {
    return String(t || "")
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[почта]")
      .replace(/(\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g, "[телефон]")
      .replace(/\b\d{10,20}\b/g, "[номер]")
      .replace(/\s+/g, " ").trim().slice(0, MAX);
  }
  // только известные ключи, без повторов, в порядке списка
  function tema(vybrano) {
    var s = {};
    (vybrano || []).forEach(function (k) { if (KLYUCHI[k]) s[k] = 1; });
    return TEMY.filter(function (x) { return s[x.k]; }).map(function (x) { return x.k; }).join(",");
  }
  function novyjId() {
    var a = new Uint8Array(8);
    try { (root.crypto || require("crypto").webcrypto).getRandomValues(a); } catch (e) { for (var i = 0; i < 8; i++) a[i] = Math.random() * 256; }
    return Array.prototype.map.call(a, function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
  }
  // vid: kabinet | otchet; пустой ответ (ни темы, ни текста) — null: отправлять нечего
  function telo(vid, vybrano, tekst, id) {
    var b = { id: /^[0-9a-f]{16}$/.test(id || "") ? id : novyjId(), stranica: vid === "kabinet" ? "/cabinet.html" : "/",
      vid: vid === "kabinet" ? "kabinet" : "otchet", ocenka: "golos", tema: tema(vybrano), rezhim: "rabota" };
    var t = chistyj(tekst);
    if (t) b.tekst = t;
    return b.tema || b.tekst ? b : null;
  }
  // письмо вместо формы, если сервер не принял: тема письма и текст — уже очищенные
  function mailto(b) {
    var podpisi = (b.tema ? b.tema.split(",") : []).map(function (k) { for (var i = 0; i < TEMY.length; i++) if (TEMY[i].k === k) return TEMY[i].t; return k; });
    var telo = (b.vid === "kabinet" ? "Чего не хватает: " : "Что добавить в отчёт: ") +
      (podpisi.length ? podpisi.join(", ") : "") + (podpisi.length && b.tekst ? ". " : "") + (b.tekst || "");
    return "mailto:help@deloskop.ru?subject=" + encodeURIComponent(b.vid === "kabinet" ? "Чего не хватает в Делоскопе" : "Что добавить в отчёт") +
      "&body=" + encodeURIComponent(telo);
  }
  // отпечаток ИНН — короткий, по нему ИНН не восстановить (нужен только «та же компания или другая»)
  function otpechatok(inn) {
    var s = String(inn || ""), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return (h % 4096).toString(36);
  }
  // состояние устройства {n, p, t}: n — разных компаний подряд, p — отпечаток последней, t — когда последний раз спрашивали
  function uchest(sost, inn) {
    var s = { n: +(sost && sost.n) || 0, p: (sost && sost.p) || "", t: +(sost && sost.t) || 0 };
    var o = otpechatok(inn);
    if (inn && o !== s.p) { s.n += 1; s.p = o; }
    return s;
  }
  function pokazat(sost, voshel, seichas) {
    if (!sost) return false;
    if ((+sost.n || 0) < (voshel ? POSLE_KOMPANIJ : POSLE_KOMPANIJ_GOST)) return false;
    return !sost.t || (seichas - sost.t) >= PAUZA_DNEJ * DEN;
  }

  var api = { TEMY: TEMY, T: T, MAX: MAX, PAUZA_DNEJ: PAUZA_DNEJ, POSLE_KOMPANIJ: POSLE_KOMPANIJ, POSLE_KOMPANIJ_GOST: POSLE_KOMPANIJ_GOST,
    chistyj: chistyj, tema: tema, telo: telo, mailto: mailto, otpechatok: otpechatok, uchest: uchest, pokazat: pokazat, novyjId: novyjId };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  if (typeof document === "undefined") return;
  root.DlkGolos = api;

  var KLYUCH = "dlk_golos";
  function prochest() { try { return JSON.parse(localStorage.getItem(KLYUCH) || "null") || {}; } catch (e) { return {}; } }
  function zapisat(s) { try { localStorage.setItem(KLYUCH, JSON.stringify(s)); } catch (e) {} }
  function voshel() { try { return localStorage.getItem("dlk_voshel") === "1"; } catch (e) { return false; } }
  function cel(c, p) { try { if (window.dlkGoal) window.dlkGoal(c, p); } catch (e) {} }
  function apiUrl(o) { return (o && o.api != null) ? String(o.api) : (/(^|\.)deloskop\.ru$/.test(location.hostname) ? "https://api.deloskop.ru" : ""); }
  function otpravit(u, b) {
    if (!u) return Promise.reject(new Error("net api"));
    return fetch(u + "/api/otzyv", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r; });
  }

  var CSS = ".golos__temy{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;padding:0;list-style:none}" +
    ".golos__t{min-height:40px;padding:0 16px;border:1px solid #D9D9D4;border-radius:999px;background:#fff;color:#1D1D1F;font:inherit;font-size:15px;font-weight:500;cursor:pointer}" +
    ".golos__t:hover{border-color:#0B63E5}.golos__t[aria-pressed=true]{background:#EAF1FD;border-color:#0B63E5;color:#0B63E5}" +
    ".golos__t[aria-pressed=true]::before{content:\"✓\\00a0\"}" +
    ".golos textarea,.golos__in{width:100%;margin:12px 0 0;padding:12px 14px;border:1px solid #D9D9D4;border-radius:10px;font:inherit;font-size:17px;color:#1D1D1F;background:#fff;box-sizing:border-box}" +
    ".golos textarea{min-height:76px;resize:vertical}" +
    ".golos textarea:focus,.golos__in:focus{outline:2px solid #0B63E5;outline-offset:1px;border-color:#0B63E5}" +
    ".golos__m{margin:8px 0 0;font-size:13px;line-height:1.45;color:#6B6B70}" +
    ".golos__r{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:14px}" +
    ".golos__ok{margin:0;font-weight:600}.golos__ok span{display:block;font-weight:400;font-size:15px;color:#48484C}" +
    ".golos :focus-visible{outline:3px solid #0B63E5;outline-offset:2px}" +
    ".golos--otchet{margin:20px 0 0;padding:18px 20px;border-radius:16px;background:#F5F5F2}" +
    ".golos--otchet .golos__z{margin:0;font-weight:600;font-size:17px}.golos--otchet .golos__z span{display:block;font-weight:400;font-size:15px;color:#6B6B70}" +
    ".golos__b{min-height:44px;padding:0 18px;border:0;border-radius:10px;background:#0B63E5;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer}" +
    ".golos__b:disabled{opacity:.45;cursor:default}.golos__b--tiho{background:none;color:#48484C;box-shadow:inset 0 0 0 1px #D9D9D4}" +
    "@media print{.golos{display:none}}";
  function stil() {
    if (document.querySelector("style[data-golos]")) return;
    var s = document.createElement("style"); s.setAttribute("data-golos", ""); s.textContent = CSS; document.head.appendChild(s);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function itog(box, ok, b) {
    box.innerHTML = ok
      ? '<p class="golos__ok" tabindex="-1">' + T.spasibo + "<span>" + T.spasiboPod + "</span></p>"
      : '<p class="golos__ok" tabindex="-1">' + T.ne + "<span>" + T.nePod + ' <a href="' + esc(mailto(b)) + '">' + T.pismo + "</a></span></p>";
    try { box.querySelector(".golos__ok").focus(); } catch (e) {}
  }

  // 1) кабинет: el — пустой <section class="card" id="golos">
  function kabinet(el, o) {
    if (!el || el.getAttribute("data-golos-gotov")) return;
    el.setAttribute("data-golos-gotov", ""); stil();
    el.classList.add("golos");
    el.innerHTML = '<h2 id="golos-z">' + T.kabZag + '</h2><p class="sub" style="margin:0">' + T.kabPod + "</p>" +
      '<div class="golos__box"><ul class="golos__temy" role="group" aria-labelledby="golos-z">' +
      TEMY.map(function (x) { return '<li><button type="button" class="golos__t" aria-pressed="false" data-tema="' + x.k + '">' + x.t + "</button></li>"; }).join("") + "</ul>" +
      '<label class="vh" for="golos-t">' + T.pole + '</label><textarea id="golos-t" maxlength="' + MAX + '" placeholder="' + T.pole + '"></textarea>' +
      '<p class="golos__m">' + T.chistka + "</p>" +
      '<div class="golos__r"><button type="button" class="btn primary" data-golos-go disabled>' + T.otpravit + "</button></div></div>";
    el.hidden = false;
    var box = el.querySelector(".golos__box"), ta = el.querySelector("textarea"), go = el.querySelector("[data-golos-go]");
    function vybrano() { return Array.prototype.map.call(el.querySelectorAll('[aria-pressed="true"]'), function (b) { return b.getAttribute("data-tema"); }); }
    function obnovit() { go.disabled = !telo("kabinet", vybrano(), ta.value); }
    el.querySelectorAll("[data-tema]").forEach(function (b) {
      b.addEventListener("click", function () { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); obnovit(); });
    });
    ta.addEventListener("input", obnovit);
    go.addEventListener("click", function () {
      var b = telo("kabinet", vybrano(), ta.value);
      if (!b) return;
      go.disabled = true;
      cel("golos_otpravlen", { vid: "kabinet", tema: b.tema || "tekst" });
      otpravit(apiUrl(o), b).then(function () { itog(box, true, b); }, function () { itog(box, false, b); });
    });
  }

  // 2) под отчётом: report — контейнер отчёта, r — ответ /api/check. Возвращает true, если строку показали.
  function posleProverki(report, r, o) {
    o = o || {};
    if (!report || !r) return false;
    var inn = r.company && r.company.inn;
    var s = uchest(prochest(), inn);
    var seichas = o.seichas || Date.now();
    var vsh = o.voshel != null ? !!o.voshel : voshel();
    var nado = pokazat(s, vsh, seichas);
    if (nado) s.t = seichas; // спросили — следующие 30 дней молчим, ответят или нет
    zapisat(s);
    if (!nado || report.querySelector("[data-golos-otchet]")) return false;
    stil();
    var d = document.createElement("section");
    d.className = "golos golos--otchet"; d.setAttribute("data-golos-otchet", ""); d.setAttribute("aria-label", T.otchZag);
    d.innerHTML = '<div class="golos__box"><p class="golos__z">' + T.otchZag + "<span>" + T.otchPod + "</span></p>" +
      '<label class="vh" for="golos-o">' + T.otchZag + '</label><input class="golos__in" id="golos-o" type="text" maxlength="' + MAX + '" placeholder="' + T.otchPole + '" autocomplete="off">' +
      '<div class="golos__r"><button type="button" class="golos__b" data-golos-go disabled>' + T.otpravit + '</button><button type="button" class="golos__b golos__b--tiho" data-golos-net>' + T.nesejchas + "</button></div></div>";
    report.appendChild(d);
    var box = d.querySelector(".golos__box"), inp = d.querySelector("input"), go = d.querySelector("[data-golos-go]");
    inp.addEventListener("input", function () { go.disabled = !chistyj(inp.value); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && !go.disabled) { e.preventDefault(); go.click(); } });
    d.querySelector("[data-golos-net]").addEventListener("click", function () { cel("golos_nesejchas", { vid: "otchet" }); d.remove(); });
    go.addEventListener("click", function () {
      var b = telo("otchet", [], inp.value);
      if (!b) return;
      go.disabled = true;
      cel("golos_otpravlen", { vid: "otchet", tema: "tekst" });
      otpravit(apiUrl(o), b).then(function () { itog(box, true, b); }, function () { itog(box, false, b); });
    });
    cel("golos_pokaz", { vid: "otchet" });
    return true;
  }
  api.kabinet = kabinet;
  api.posleProverki = posleProverki;
})(typeof window !== "undefined" ? window : this);
;
/* --- /js/nagruzka.js --- */
/* Делоскоп — «Налоговая нагрузка против отрасли» (/nalogi/nagruzka/, справочник /nalogi/nagruzka-po-otraslyam-2025/).
 * Нормы — data/fns-normy-2025.json: приложения 3–4 к приказу ФНС № ММ-3-06/333@, Информация ФНС от 05.05.2026.
 * Правила и тексты — документ команды (§ 2 — четыре ловушки, § 3 — тексты):
 *   1) норма ФНС включает НДФЛ → без НДФЛ наша оценка ниже: «красный» только ниже 50 % нормы, 50–100 % — «внимание»;
 *   2) знаменатель — доходы по бухотчётности, у ФНС — оборот Росстата → слово «оценка» всегда;
 *   3) УСН — с общей нормой не сравниваем, не красим;
 *   4) доходы меньше 1 млн ₽ или нет данных — «данных нет», а не «ниже нормы»; «красный» — только при доходах ≥ 10 млн ₽.
 * Строка нормы — самая подробная, в которую входит ОКВЭД (подкласс → класс → раздел). Не нашли — «Всего по РФ»
 * НЕ подставляем. Запрещённые формулировки (обещания исхода, «безопасный» уровень) — список в tests/nagruzka.test.js.
 * Чистые функции: без DOM и сети (кроме init в браузере). Считается в браузере, ничего не отправляем. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DlkNagruzka = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var NBSP = " ";
  var MIN_DOHOD = 1e6;      // ловушка 4: меньше — «данных мало»
  var KRASNYJ_DOHOD = 10e6; // «красный» — только от 10 млн ₽ дохода

  function cifry(kod) { return String(kod || "").replace(/[^0-9]/g, ""); }

  // Код ОКВЭД-2 из ввода: «41.20», «41.2», «4120», «ОКВЭД 46.90» → «41.20». Плохой ввод → "".
  function okvedIzVvoda(s) {
    var m = String(s || "").match(/\d{2}(?:\.\d{1,2}){1,2}/);
    if (m) return m[0];
    var d = cifry(s);
    if (d.length < 2 || d.length > 6) return "";
    var out = d.slice(0, 2);
    if (d.length > 2) out += "." + d.slice(2, 4);
    if (d.length > 4) out += "." + d.slice(4, 6);
    return out;
  }

  // Самая подробная строка таблицы, в которую входит код (по цифрам: 49.41.1 → «4941 1» входит в «49.4», «49», …).
  function najti(okved, stroki) {
    var d = cifry(okved);
    if (d.length < 2 || !stroki) return null;
    var luchshaya = null, dlina = 0;
    for (var i = 0; i < stroki.length; i++) {
      var ok = stroki[i].okved || [];
      for (var j = 0; j < ok.length; j++) {
        var p = cifry(ok[j]);
        // при равной длине — строка подробнее раздела (46 «оптовая» точнее раздела G, где тоже есть «46»)
        var luchshe = p.length > dlina || (p.length === dlina && luchshaya && /^[A-Z]$/.test(luchshaya.kod) && !/^[A-Z]$/.test(stroki[i].kod));
        if (p && d.indexOf(p) === 0 && luchshe) { luchshaya = stroki[i]; dlina = p.length; }
      }
    }
    return luchshaya;
  }

  // nagruzka-yakorya-v1: якорь строки в справочнике — «n-35-1», «n-f», «n-vsego» (как tests/sobrat_nagruzka.py yakor).
  var SPRAVOCHNIK = "/nalogi/nagruzka-po-otraslyam-2025/";
  function yakor(kod, tablica) {
    var k = kod === "ВСЕГО" ? "vsego" : String(kod || "").toLowerCase().replace(/[^0-9a-z]+/g, "-").replace(/^-+|-+$/g, "");
    return (tablica || "n") + "-" + k;
  }

  function pct(x) {
    var r = Math.round(x * 10) / 10;
    return String(r).replace(".", ",") + (String(r).indexOf(".") < 0 ? ",0" : "") + "%";
  }

  // «раздел F «Строительство»» / «ОКВЭД 46 «торговля оптовая…»» — с чем сравнили.
  function podpisStroki(s) {
    var nazv = String(s.nazvanie).replace(/\s+-\s+всего$/i, "");
    var kod = /^[A-Z]$/.test(s.kod) ? "раздел " + s.kod : "ОКВЭД " + s.kod;
    return kod + " «" + nazv + "»";
  }

  /* vvod: { okved, dohody (₽ за год), nalogi (₽, уплачено за год, без страховых взносов), sNdfl (true — в сумме есть
   *        НДФЛ за работников), rezhim ("osn" | "usn"), god (год нормы, по умолчанию 2025) }
   * Возвращает { st, n, norma, stroka, raz, zagolovok, tekst, podpis }.
   * st: "net-dannyh" | "usn" | "net-normy" | "zelenyj" | "zheltyj" | "krasnyj". */
  function ocenka(vvod, dannye) {
    var god = String(vvod.god || 2025);
    var dohody = Number(vvod.dohody), nalogi = Number(vvod.nalogi);
    var r = { st: "", n: null, norma: null, stroka: null, ssylka: null, raz: null, zagolovok: "Налоговая нагрузка против отрасли", tekst: "", podpis: "" };
    r.podpis = "Оценка по методике калькулятора ФНС: уплаченные налоги без страховых взносов / доходы за " + god +
      " год. Норма — приложение 3 к приказу ФНС № ММ-3-06/333@, Информация ФНС от 05.05.2026. Страховые взносы не учитываются — как и в норме ФНС. Считается в вашем браузере, ничего не отправляем.";

    if (!isFinite(dohody) || !isFinite(nalogi) || dohody < MIN_DOHOD || nalogi < 0) {
      r.st = "net-dannyh";
      r.tekst = "Для сравнения нужны доходы за год — от 1" + NBSP + "млн" + NBSP + "₽ — и сумма уплаченных налогов. " +
        "У новой компании или при нулевой отчётности сравнивать не с чем — это не значит «всё плохо».";
      return r;
    }
    r.n = nalogi / dohody * 100;

    if (vvod.rezhim === "usn") {
      r.st = "usn";
      r.tekst = "Налоги — " + pct(r.n) + " от доходов. Вы на упрощённой системе. Общая отраслевая норма ФНС включает НДС и налог на прибыль, " +
        "поэтому сравнивать с ней упрощенца некорректно — мы этого не делаем.";
      return r;
    }

    var stroki = dannye && dannye.nagruzka;
    var s = najti(vvod.okved, stroki);
    if (!s || typeof s.nagruzka[god] !== "number") {
      r.st = "net-normy";
      r.tekst = "Налоги — " + pct(r.n) + " от доходов. Отраслевой нормы для вашего вида деятельности ФНС не публикует: " +
        "в таблице ФНС есть не все разделы ОКВЭД. Со средней «Всего по РФ» не сравниваем — это была бы другая отрасль.";
      return r;
    }
    r.stroka = s;
    r.ssylka = SPRAVOCHNIK + "#" + yakor(s.kod);
    r.norma = s.nagruzka[god];
    r.raz = Math.round((r.norma - r.n) * 10) / 10;
    var dolya = r.n / r.norma;
    var golova = "Ваша нагрузка — " + pct(r.n) + ". Средняя по отрасли — " + pct(r.norma) + " (" + podpisStroki(s) + ", ФНС, " + god + " год). ";
    var ndfl = vvod.sNdfl
      ? ""
      : "В вашем расчёте нет НДФЛ за работников, а в норме ФНС он есть, поэтому настоящая нагрузка, скорее всего, выше. ";

    if (dolya >= 1) {
      r.st = "zelenyj";
      r.tekst = golova + "Нагрузка не ниже отраслевой — по этому признаку налоговая компанию на проверку не отбирает.";
    } else if (dolya >= 0.5 || dohody < KRASNYJ_DOHOD) {
      r.st = "zheltyj";
      r.tekst = golova + "Разница: " + String(r.raz).replace(".", ",") + NBSP + "п." + NBSP + "п. " + ndfl +
        "Само по себе это не нарушение: ФНС сравнивает нагрузку с отраслью как один из 12 признаков при отборе на выездную проверку.";
    } else {
      r.st = "krasnyj";
      var vRaz = r.n > 0 ? ": в " + Math.round(r.norma / r.n) + NBSP + "раз ниже" : "";
      r.tekst = golova.replace(/\. $/, "") + vRaz + ". " + ndfl +
        "Нагрузка ниже среднеотраслевой — первый из 12 признаков, по которым налоговая выбирает компании для выездной проверки " +
        "(приказ ФНС № ММ-3-06/333@). Это не вывод о нарушении — возможны убытки, крупные вычеты или особенности бизнеса.";
    }
    return r;
  }

  // ---- браузер: калькулятор на /nalogi/nagruzka/ ----
  function chislo(s) { var x = Number(String(s || "").replace(/[\s ]/g, "").replace(",", ".")); return isFinite(x) ? x : NaN; }

  function init(doc, dannye) {
    var f = doc.getElementById("nagruzka-forma");
    if (!f) return;
    var vyhod = doc.getElementById("nagruzka-itog");
    function poschitat(e) {
      if (e) e.preventDefault();
      var r = ocenka({
        okved: okvedIzVvoda(f.okved.value),
        dohody: chislo(f.dohody.value),
        nalogi: chislo(f.nalogi.value),
        sNdfl: f.ndfl.checked,
        rezhim: f.rezhim.value,
      }, dannye);
      vyhod.className = "itog itog--" + r.st;
      vyhod.hidden = false;
      vyhod.querySelector("[data-tekst]").textContent = r.tekst;
      vyhod.querySelector("[data-podpis]").textContent = r.podpis;
      var sp = vyhod.querySelector("[data-stroka-p]");
      if (sp) {
        sp.hidden = !r.ssylka;
        if (r.ssylka) sp.querySelector("a").setAttribute("href", r.ssylka);
      }
      var shkala = vyhod.querySelector("[data-shkala]");
      if (r.norma) {
        var max = Math.max(r.n, r.norma) * 1.1;
        shkala.hidden = false;
        shkala.querySelector("[data-vy]").style.width = Math.min(100, r.n / max * 100) + "%";
        shkala.querySelector("[data-otr]").style.width = Math.min(100, r.norma / max * 100) + "%";
        shkala.querySelector("[data-vy-t]").textContent = "Вы — " + pct(r.n);
        shkala.querySelector("[data-otr-t]").textContent = "Отрасль — " + pct(r.norma);
      } else shkala.hidden = true;
    }
    f.addEventListener("submit", poschitat);
  }

  return { yakor: yakor, najti: najti, ocenka: ocenka, okvedIzVvoda: okvedIzVvoda, pct: pct, podpisStroki: podpisStroki, init: init, chislo: chislo };
});
;
/* --- /js/nagruzka-proverka.js --- */
/* Делоскоп — «Налоги и взносы против отрасли» на экране проверки по ИНН
 * (решение команды 02.10, эталон экрана — п. 4 «Налоговая нагрузка против отрасли»; nagruzka-proverka-v1, команда 11.10).
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
    '.ngo__s{font-size:15px;color:var(--ink2,#48484C)}.ngo__s b{font-weight:600}.ngo__z{font-size:15px}' +
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
;
/* --- /js/rentabelnost.js --- */
/* Делоскоп — «Рентабельность активов против отрасли» на экране проверки по ИНН и в Щите
 * (решение команды 02.10, эталон экрана — п. 4 «Налоговая нагрузка против отрасли + рентабельность»).
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
  // rentabelnost-status-v1: от 100 % по модулю (капитал меньше нуля — активов мало) десятые не нужны: «−851 %», а не «−851,1 … −850,7 %»
  function okr(x) { return Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10; }
  function pct(x) {
    var r = okr(x), s = String(Math.abs(r)).replace('.', ',');
    if (Math.abs(r) >= 100) return (r < 0 ? '−' : '') + s + NB + '%';
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
  // rentabelnost-status-v1 [команда] 11.10: у компании в банкротстве или ликвидации (и уже ликвидированной) сравнение
  // с отраслью не показываем — экран уже говорит «Не платите вперёд», а «признак отбора на выездную проверку» здесь только
  // отвлекает. Найдено на ответе API банкрота-холдинга: «−851,1 … −850,7 %, ниже средней по отрасли». Тот же список — в js/usloviya.js.
  var NE_DEJSTVUET = ['BANKRUPT', 'LIQUIDATING', 'LIQUIDATED'];
  function neDejstvuet(c) { return !!c && NE_DEJSTVUET.indexOf(String(c.status || '').toUpperCase()) >= 0; }

  function ocenka(r) {
    if (!r || !r.company) return null;
    var c = r.company, inn = String(c.inn || ''), okved = String(c.okved || '');
    if (!/^\d{10}$/.test(inn)) return null;
    if (neDejstvuet(c)) return null;
    if (/^64\.1(\.|\d|$)/.test(okved) || /^65(\.|$)/.test(okved)) return null;
    var ch = (r.dossier && r.dossier.charts) || {}, b = ch.balance;
    if (!b || typeof b !== 'object') return null;
    var god = parseInt(b.year, 10);
    if (!isFinite(god)) return null;
    // ключи живого /api/check — long_debt / short_debt (как в js/dinamika.js и Паспорте); до zhivoj-otvet-v1 здесь стояли
    // long_liab / short_liab, которых API не отдаёт, — блок «Рентабельность против отрасли» на живом не появлялся
    var kap = chislo(b.equity), dl = chislo(b.long_debt != null ? b.long_debt : b.long_liab), kr = chislo(b.short_debt != null ? b.short_debt : b.short_liab);
    if (!isFinite(kap) || !isFinite(dl) || !isFinite(kr) || dl < 0 || kr < 0) return null;
    var aktivy = kap + dl + kr;
    // aktivy-kpi-v1 (досье сделки 22.10): в живом ответе бывает balance без обязательств (long_debt = short_debt = 0), а итог
    // баланса — в KPI «Активы» (у ООО «Доверенный врач» 2025: капитал 2,78 млн, KPI «Активы» 6,42 млн) — без него оценка
    // рентабельности активов завышалась в 2,3 раза. KPI больше суммы частей — берём его: это строка 1600 той же отчётности.
    var kA = ((r.dossier && r.dossier.kpi) || []).filter(function (x) { return x && /^Активы(\s|$)/i.test(String(x.label || '')) && isFinite(chislo(x.value)); })[0];
    if (kA && chislo(kA.value) > aktivy) aktivy = chislo(kA.value);
    if (!(aktivy >= MIN_AKTIVY)) return null;
    var pribyl = zaGod(ch.profit, god);
    if (!isFinite(pribyl)) return null;
    var nalog = zaGod(ch.income_tax, god), sNalogom = isFinite(nalog);
    // znak-naloga-v1 (04.10): API отдаёт строку 2410 без знака (модуль): у «Аэрофлота» 2020 при убытке 96,5 млрд ₽
    // «налог» +26,6 млрд ₽ — это доход по налогу, а не расход. Строки 2300 в ответе нет — знак не вычислить ([команда] 04.10 разд. 1:
    // «не гадаем»). Поэтому при налоге без знака считаем оба варианта: расход (прибыль + налог) и доход (прибыль − налог);
    // вывод даём, только если оба варианта ведут к одному выводу. Ряд со знаком (есть значение < 0) — один точный вариант.
    // znak-naloga-v1.1 (04.10, контракт [команда] 04.10 разд. 1): строка 2300 за год — налог = 2300 − чистая прибыль,
    // точно и со знаком; иначе знак по флагу ряда `income_tax_znak` / точки `znak`, а без флагов — прежнее правило.
    var pbt = zaGod(ch.profit_before_tax, god);
    if (isFinite(pbt)) { nalog = pbt - pribyl; sNalogom = true; }
    var soZnakom = isFinite(pbt) || nalogSoZnakom(ch, god);
    if (!sNalogom || nalog === 0 || soZnakom) {
      var rez = sNalogom ? pribyl + nalog : pribyl, n1 = rez / aktivy * 100;
      return { god: god, n: n1, nMin: n1, nMax: n1, pribyl: pribyl, nalog: sNalogom ? nalog : null, rez: rez, aktivy: aktivy,
        sNalogom: sNalogom, bezZnaka: false };
    }
    var t = Math.abs(nalog), rMax = pribyl + t, rMin = pribyl - t;
    return { god: god, n: rMax / aktivy * 100, nMin: rMin / aktivy * 100, nMax: rMax / aktivy * 100, pribyl: pribyl, nalog: t,
      rez: rMax, rezMin: rMin, aktivy: aktivy, sNalogom: true, bezZnaka: true };
  }
  // Ряд налога на прибыль со знаком, как в форме (расход > 0, доход < 0): видно по хотя бы одному отрицательному значению.
  function rjadSoZnakom(arr) {
    return (Array.isArray(arr) ? arr : []).some(function (q) { return q && isFinite(chislo(q.value)) && chislo(q.value) < 0; });
  }
  // Знак налога за год god: флаг ряда `income_tax_znak: true` — весь ряд со знаком; у точки есть `znak` — по нему
  // (в смешанном ряду точка `znak: false` — модуль, даже если рядом есть отрицательные); флагов нет — rjadSoZnakom.
  function nalogSoZnakom(ch, god) {
    if (!ch) return false;
    if (ch.income_tax_znak === true) return true;
    var arr = Array.isArray(ch.income_tax) ? ch.income_tax : [];
    var x = arr.filter(function (q) { return q && parseInt(q.year, 10) === god; })[0];
    if (x && typeof x.znak === 'boolean') return x.znak;
    if (arr.some(function (q) { return q && typeof q.znak === 'boolean'; })) return false;
    return rjadSoZnakom(arr);
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

  // Два варианта оценки (налог без знака) → один вывод или 'neyasno'. Главное — критерий 11 («ниже на 10% и более»):
  // оба ниже — 'nizhe'; оба не ниже на 10% — 'chut-nizhe'/'ne-nizhe' (разошлись между собой — 'ne-nizhe-10'); иначе 'neyasno'.
  function sravnenieDvuh(nMin, nMax, god, okved, dannye) {
    var a = sravnenie(nMin, god, okved, dannye);
    if (!a || nMin === nMax || typeof a.norma !== 'number') return a;
    var b = sravnenie(nMax, god, okved, dannye);
    if (a.st === b.st) return a;
    var st = a.st === 'nizhe' || b.st === 'nizhe' ? 'neyasno' : 'ne-nizhe-10';
    return { st: st, stroka: a.stroka, norma: a.norma };
  }

  /* Возвращает null (блока нет) или { st, god, n, nMin, nMax, norma, stroka, pribyl, nalog, aktivy, sNalogom, bezZnaka }.
   * st: 'nizhe' | 'chut-nizhe' | 'ne-nizhe' | 'ne-nizhe-10' | 'neyasno' | 'otr' | 'net-normy'. */
  function raschet(r, dannye) {
    if (!dannye) return null;
    var o = ocenka(r);
    if (!o) return null;
    var sr = sravnenieDvuh(o.nMin, o.nMax, o.god, String(r.company.okved || ''), dannye);
    if (!sr) return null;
    o.st = sr.st; o.stroka = sr.stroka; o.norma = sr.norma; o.istochnik = istochnikNormy(o.god, dannye);
    return o;
  }

  /* «Что изменилось с вашей проверки» (rentabelnost-izm-v1): a, b — снимки js/dinamika.js с полем rn = [год, оценка %].
   * Только новая отчётность (год b больше года a) и только переход через «ниже средней на 10% и более» —
   * обе оценки сравниваем с нормой ФНС своего года для ТЕКУЩЕГО ОКВЭД. → { ton, t } | null. */
  function izmenenie(a, b, okved, dannye) {
    // снимок: rn = [год, оценка] или [год, меньшая, большая] (налог без знака, znak-naloga-v1)
    if (!a || !b || !Array.isArray(a.rn) || !Array.isArray(b.rn) || !(b.rn[0] > a.rn[0])) return null;
    function dva(rn) { return [rn[1], rn.length > 2 && isFinite(rn[2]) ? rn[2] : rn[1]]; }
    var da = dva(a.rn), db = dva(b.rn);
    var x = sravnenieDvuh(da[0], da[1], a.rn[0], okved, dannye), y = sravnenieDvuh(db[0], db[1], b.rn[0], okved, dannye);
    if (!x || !y || typeof x.norma !== 'number' || typeof y.norma !== 'number' || x.st === 'neyasno' || y.st === 'neyasno') return null;
    var hvost = ': за' + NB + b.rn[0] + ' — ' + diapazon(db[0], db[1]) + ' при средней ' + pct(y.norma) + ' (оценка; ГИР' + NB + 'БО и ФНС)';
    if (x.st !== 'nizhe' && y.st === 'nizhe') return { ton: 'huzhe', t: 'Рентабельность активов стала ниже средней по отрасли на 10\u00a0% и более' + hvost };
    if (x.st === 'nizhe' && y.st !== 'nizhe') return { ton: 'luchshe', t: 'Рентабельность активов больше не ниже средней по отрасли на 10\u00a0% и более' + hvost };
    return null;
  }

  var VYVOD = {
    'nizhe': 'Ниже средней по отрасли на 10\u00a0% и более.',
    'chut-nizhe': 'Ниже средней по отрасли, но меньше чем на 10\u00a0%.',
    'ne-nizhe': 'Не ниже средней по отрасли.',
    'ne-nizhe-10': 'Не ниже средней по отрасли на 10\u00a0% и более.',
    'neyasno': 'Сравнить точно нельзя: при одном знаке налога оценка ниже средней по отрасли на 10\u00a0% и более, при другом — нет.',
    'otr': 'У отрасли в целом за этот год, по данным ФНС, убыток — сравнивать не с чем.',
    'net-normy': 'Средней рентабельности для этого вида деятельности ФНС не публикует — со строкой «Всего» не сравниваем.'
  };
  // фразы — с сайта: /nalogi/nagruzka-po-otraslyam-2025/ (FAQ, сверено [команда] 02.10)
  var PRIZNAK = 'Признак отбора — рентабельность по бухучёту ниже среднеотраслевой на 10\u00a0% и более (критерий 11 приложения 2 к Концепции). ' +
    'Это средние значения, а не порог: ФНС сравнивает с ними компании как с одним из 12 признаков при отборе на выездную проверку.';

  // фраза — моя (znak-naloga-v1), ✎ [команда]: почему два варианта
  var BEZ_ZNAKA = 'В открытых данных у налога на прибыль нет знака: по ним не видно, расход это или доход по налогу (доход бывает, например, из-за отложенного налога).';
  // «2,1–4,3 %» — диапазон двух вариантов; один вариант — одно число
  function diapazon(a, b) {
    var x = okr(Math.min(a, b)), y = okr(Math.max(a, b));
    if (x === y) return pct(x);
    return pct(x).replace(NB + '%', '') + (x < 0 || y < 0 ? ' … ' : '–') + pct(y);
  }
  function znachenie(o) { return o ? diapazon(isFinite(o.nMin) ? o.nMin : o.n, isFinite(o.nMax) ? o.nMax : o.n) : ''; }

  // opts.otkryto — «Как посчитали» раскрыто (PDF-досье: на бумаге свёрнутое не видно);
  // opts.primechanie — строка под блоком (Паспорт: «в отпечаток SHA-256 не входит»).
  function html(o, opts) {
    if (!o) return '';
    opts = opts || {};
    var ton = o.st === 'nizhe' ? 'warn' : o.st === 'ne-nizhe' || o.st === 'chut-nizhe' || o.st === 'ne-nizhe-10' ? 'ok' : 'ro';
    var podpis = o.stroka ? N.podpisStroki(o.stroka) : '';
    var sr = o.norma != null
      ? 'Средняя по отрасли — <b class="n">' + pct(o.norma) + '</b> · ' + esc(podpis) + ', данные ФНС за' + NB + o.god + NB + 'год'
      : (o.st === 'otr' ? esc(podpis) : '');
    var kak = (o.bezZnaka ? BEZ_ZNAKA + ' Если это расход — прибыль до налогообложения ' + dengi(o.pribyl) + ' + ' + dengi(o.nalog) + ' = ' + dengi(o.rez) +
        ', если доход — ' + dengi(o.pribyl) + ' − ' + dengi(o.nalog) + ' = ' + dengi(o.rezMin) + '; считаем оба варианта'
      : o.sNalogom
      ? 'Прибыль до налогообложения — чистая прибыль ' + dengi(o.pribyl) + (o.nalog < 0 ? ' минус доход по налогу на прибыль ' + dengi(-o.nalog) : ' плюс налог на прибыль ' + dengi(o.nalog)) + ' = ' + dengi(o.rez)
      : 'Налога на прибыль в ответе нет — взяли чистую прибыль ' + dengi(o.pribyl)) +
      ' (ГИР БО, ' + o.god + '). Активы на' + NB + '31.12.' + o.god + ' — ' + dengi(o.aktivy) +
      ': капитал, долгосрочные и краткосрочные обязательства (баланс, строки 1300 + 1400 + 1500). ' +
      'У ФНС — сальдированный финансовый результат к стоимости активов по всем организациям отрасли, поэтому это оценка, а не расчёт инспекции. ' +
      'Норма — приложение 4 к приказу ФНС № ММ-3-06/333@, ' + o.istochnik + '.';
    return '<section class="rnt rnt--' + ton + '" aria-label="Рентабельность активов против отрасли">' +
      '<div class="rnt__h"><b>Рентабельность активов против отрасли</b><span>оценка · ГИР БО и ФНС · ' + o.god + '</span></div>' +
      '<p class="rnt__v"><b class="n">' + znachenie(o) + '</b><span>за' + NB + o.god + NB + 'год</span></p>' +
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
    '.rnt__s{font-size:15px;color:var(--ink2,#48484C)}.rnt__s b{font-weight:600}.rnt__z{font-size:15px}' +
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
    var pos = null, sp = opts.posle || ['.ngo', '.din', '.izm', '.rows']; // .ngo — «Налоги и взносы против отрасли» (js/nagruzka-proverka.js), рентабельность — после неё
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

  return { raschet: raschet, ocenka: ocenka, neDejstvuet: neDejstvuet, NE_DEJSTVUET: NE_DEJSTVUET, sravnenie: sravnenie, sravnenieDvuh: sravnenieDvuh, izmenenie: izmenenie, znachenie: znachenie,
    diapazon: diapazon, nalogSoZnakom: nalogSoZnakom, BEZ_ZNAKA: BEZ_ZNAKA, html: html, mount: mount, vstavit: vstavit, zagruzit: zagruzit, norma: norma, pct: pct, CSS: CSS, VYVOD: VYVOD, PRIZNAK: PRIZNAK,
    PRIMECHANIE_PASPORT: PRIMECHANIE_PASPORT };
});
;
/* --- /js/bez-nds.js --- */
/* Делоскоп — «Без НДС» при большой выручке: /proverit-schet/ и «Кому вы платите» (/kontragenty-iz-vypiski/).
 * Счёт «без НДС» от поставщика на упрощёнке законен, пока его доход за прошлый год не больше порога
 * п. 1 ст. 145 НК РФ (ред. 228-ФЗ от 04.07.2026): 20 млн ₽ за 2025–2028 годы, 15 млн ₽ за 2029-й,
 * 10 млн ₽ за 2030-й и дальше. Сверено [Налоговым юристом] — sroki.json, id usn_nds_porog.
 * Данные — из ответа /api/check: выручка (строка 2110) по годам из ГИР БО ФНС — dossier.charts.revenue,
 * налоговый режим — строка «Налоговый режим» раздела activity (открытые данные ФНС «СНР» и DaData).
 * Честно о пределах: выручка по бухотчётности ≠ доход по правилам упрощёнки, а «без НДС» законно и при
 * большой выручке по льготным операциям (ст. 149 НК РФ). Поэтому это информационная строка («спросите»),
 * а не красный флаг. ИП не показываем (у ИП нет бухотчётности; данные ИП не публикуем).
 * Чистые функции: без DOM, без сети. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DlkBezNds = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Порог дохода за год `godDohoda`, выше которого в следующем году освобождения нет (п. 1 ст. 145 НК РФ).
  function porog(godDohoda) {
    if (godDohoda < 2025) return null;          // старые годы — другие пороги, не считаем
    if (godDohoda <= 2028) return 20e6;         // 20 млн ₽ — доход за 2025–2028 годы
    if (godDohoda === 2029) return 15e6;
    return 10e6;
  }

  function mln(n) {
    var x = Math.round(n / 1e5) / 10;
    return String(x).replace(".", ",") + " млн ₽";
  }

  // Режим из досье: "usn" | "drugoj" (АУСН, ЕСХН, патент, СРП, ОСН — правило не то) | null (не знаем)
  function rezhim(dossier) {
    var secs = (dossier && dossier.sections) || [];
    for (var i = 0; i < secs.length; i++) {
      var rows = secs[i].rows || [];
      for (var j = 0; j < rows.length; j++) {
        if (rows[j][0] !== "Налоговый режим") continue;
        var v = String(rows[j][1] || "");
        if (/АУСН|ЕСХН|СРП|Патент|ПСН|ОСН|Общая/i.test(v)) return "drugoj";
        if (/УСН/.test(v)) return "usn";
        return null;
      }
    }
    return null;
  }

  /* noVat — в счёте «Без НДС» / «НДС не облагается»; remote — ответ /api/check; segodnya — Date.
   * → {st:'info', title, detail} или null (молчим, если не уверены). */
  function stroka(noVat, remote, segodnya) {
    if (!noVat || !remote) return null;
    var co = remote.company || {};
    if (co.inn && String(co.inn).length !== 10) return null;            // ИП — не показываем
    var d = remote.dossier || {};
    var rz = rezhim(d);
    if (rz === "drugoj") return null;
    var god = (segodnya || new Date()).getFullYear() - 1;               // доход прошлого года решает этот год
    var p = porog(god);
    if (!p) return null;
    var ryad = (d.charts && d.charts.revenue) || [];
    var t = null;
    for (var i = 0; i < ryad.length; i++) if (ryad[i] && ryad[i].year === god) t = ryad[i];
    if (!t || typeof t.value !== "number" || t.value <= p) return null;   // нет отчётности за год — молчим
    var nachalo = rz === "usn"
      ? "Поставщик на упрощёнке, выручка за " + god + " год по бухотчётности — " + mln(t.value) + ". Освобождение"
      : "Выручка поставщика за " + god + " год по бухотчётности — " + mln(t.value) + ". Если он на упрощёнке, освобождение";
    return {
      st: "info",
      title: "Без НДС",
      detail: nachalo + osvobozhdenie(god, p) + " Спросите поставщика, на каком основании " +
        "счёт без НДС. Что будет с ценой, если НДС появится, — заранее в договоре: пункт 2.2 Делописи."
    };
  }

  // Общая середина строки — одна для «Проверь счёт» и «Кому вы платите» (текст сверяет [Налоговый юрист]).
  function osvobozhdenie(god, p) {
    return " от НДС в " + (god + 1) + " году — только при доходе за " + god + " год до " + mln(p) +
      " (п. 1 ст. 145 НК РФ), выше — счёт выставляют с НДС: по общей ставке или по ставке 5 или 7\u00a0%. " +
      "Доход для порога считают по правилам упрощёнки, не по бухотчётности, а «без НДС» законно и при льготной " +
      "операции (ст. 149 НК РФ) — поэтому это вопрос, а не нарушение.";
  }

  function rub(n) {
    return Math.round(n).toLocaleString("ru-RU").replace(/[\s\u202f]/g, "\u00a0") + "\u00a0₽";
  }

  // Режим из ответа /api/shield/counterparties (открытые данные ФНС «СНР»): "usn" | "ausn" | "eshn" | "srp" | null.
  // null — компании нет в наборе спецрежимов: общая система или набор отстаёт → говорим условно.
  function rezhimKoda(k) {
    if (k === "usn") return "usn";
    if (k === "ausn" || k === "eshn" || k === "srp") return "drugoj";
    return null;
  }

  /* «Кому вы платите» (/kontragenty-iz-vypiski/): s — поставщик из DeloVypiska.analyze (inn, kind, noVatGod —
   * {год: сумма платежей с «без НДС» в назначении}); rm — элемент ответа /api/shield/counterparties
   * (rezhim, dohod — «СумДоход» набора ФНС revexp, dohod_na — 31.12 отчётного года).
   * Судим только платежи года, следующего за годом дохода: платили в 2026-м — решает доход за 2025-й.
   * → {level:'info', code:'bez_nds', text} или null. */
  function strokaVypiski(s, rm) {
    if (!s || !rm || s.kind !== "org" || !s.inn || String(s.inn).length !== 10) return null;
    var rz = rezhimKoda(rm.rezhim);
    if (rz === "drugoj") return null;
    if (typeof rm.dohod !== "number" || !/^\d{4}-/.test(String(rm.dohod_na || ""))) return null;
    var god = parseInt(String(rm.dohod_na).slice(0, 4), 10);
    var p = porog(god);
    if (!p || rm.dohod <= p) return null;
    var summa = (s.noVatGod || {})[god + 1];
    if (!(summa > 0)) return null;
    var dohod = "доход за " + god + " год по бухотчётности — " + mln(rm.dohod) + " (открытые данные ФНС).";
    var nachalo = "Платежи «без НДС» в " + (god + 1) + " году — " + rub(summa) + ". " + (rz === "usn"
      ? "Поставщик на упрощёнке, " + dohod + " Освобождение"
      : "Поставщик: " + dohod + " Если он на упрощёнке, освобождение");
    return {
      level: "info",
      code: "bez_nds",
      text: nachalo + osvobozhdenie(god, p) + " Спросите поставщика, на каком основании платежи без НДС. " +
        "Что будет с ценой, если НДС появится, — заранее в договоре: пункт 2.2 Делописи."
    };
  }


  /* nds-porog-v1 (команда, 03.10): «НДС в 2027 году» — честная строка «у порога» (решение команды 03.10,
   * ТЗ документ команды разд. 2 и 6; тексты — [команда]
   * 03.10 21:10, документ команды разд. 2, дословно).
   * Будет ли НДС у поставщика в году T, решает его доход за T−1 — отчётности за T−1 до апреля T ни у кого нет.
   * Поэтому смотрим выручку за T−2 рядом с порогом. Работает с 1 января T−1 до 1 мая T и только пока в ряду нет
   * выручки за T−1 (появилась — ответ уже не прогноз, строка молчит). T по умолчанию — 2027.
   * Только организации (10 цифр) и только упрощёнка, названная в досье: режим неизвестен — молчим (компании нет
   * в наборе спецрежимов — скорее общая система; «Поставщик на упрощёнке» было бы неправдой).
   * → {kod, st:'info', title, detail, vyruchka, god, rost} или null.
   *   uzhe_platit — выручка T−2 > порога; u_poroga — 15 млн < выручка ≤ порога (ровно порог — «не превысили»);
   *   u_poroga_rost — то же + рост к T−3 такой, что при нём доход T−1 превысит порог (оценка — так и пишем);
   *   osvobozhdena — выручка ≤ 15 млн: на экране молчим, на карточке — нейтральный факт (tests/kartochka_render.py). */
  var GOD_PROGNOZA = 2027, BLIZKO = 15e6;
  function prognoz(remote, segodnya, T) {
    T = T || GOD_PROGNOZA;
    if (!remote) return null;
    var co = remote.company || {};
    if (!/^\d{10}$/.test(String(co.inn || ""))) return null;               // ИП и без ИНН — не показываем
    var sg = segodnya || new Date();
    if (sg < new Date(T - 1, 0, 1) || sg >= new Date(T, 4, 1)) return null; // окно: с 01.01.(T−1) до 01.05.T
    var d = remote.dossier || {};
    if (rezhim(d) !== "usn") return null;
    var R = T - 2, p = porog(R), pTek = porog(T - 1);
    if (!p || !pTek) return null;
    var ryad = (d.charts && d.charts.revenue) || [], v = null, v0 = null;
    for (var i = 0; i < ryad.length; i++) {
      var x = ryad[i];
      if (!x || typeof x.value !== "number") continue;
      if (x.year === T - 1) return null;                                    // отчётность за T−1 есть — не прогноз
      if (x.year === R) v = x.value;
      if (x.year === R - 1) v0 = x.value;
    }
    if (v == null || v <= 0) return null;
    // 20 000 001 ₽ в «млн» округлится до порога — тогда пишем рубли, иначе «20 млн ₽, выше порога 20 млн ₽»
    var vyr = "Поставщик на упрощёнке, выручка за " + R + " год по бухотчётности — " + (mln(v) === mln(p) && v !== p ? rub(v) : mln(v));
    var hvost = " " + HVOST;
    if (v > p) {
      return { kod: "uzhe_platit", st: "info", title: "НДС в " + (T - 1) + " году", vyruchka: v, god: R, rost: null,
        detail: vyr + ", выше порога " + mln(p) + ". Поэтому в " + (T - 1) + " году он, вероятно, платит НДС — по общей " +
          "ставке или по ставке 5 или 7\u00a0% (п. 8 ст. 164 НК РФ). Если в счёте «Без НДС» — спросите основание." + hvost };
    }
    if (v <= BLIZKO) return { kod: "osvobozhdena", st: "info", title: "НДС в " + T + " году", vyruchka: v, god: R, rost: null, detail: "" };
    var rost = v0 > 0 ? v / v0 - 1 : null;
    var sRostom = rost != null && rost > 0 && v * (1 + rost) > pTek;
    var detail = vyr + ", у порога " + mln(p) + ". Если доход за " + (T - 1) + " год превысит " + mln(pTek) +
      ", в " + T + " году освобождения от НДС не будет (п. 1 ст. 145 НК РФ). Если превысит уже в " + (T - 1) +
      " году — НДС появится с 1-го числа следующего месяца (п. 5 ст. 145 НК РФ). Спросите поставщика, будет ли НДС " +
      "в счетах " + T + " года, и закрепите в договоре, что будет с ценой: пункт 2.2 Делописи.";
    if (sRostom) {
      detail += " За " + R + " год выручка выросла на " + procent(rost) + " %. Если рост сохранится, доход за " +
        (T - 1) + " год превысит " + mln(pTek) + ". Это наша оценка по двум годам отчётности, а не данные ФНС.";
    }
    return { kod: sRostom ? "u_poroga_rost" : "u_poroga", st: "info", title: "НДС в " + T + " году", vyruchka: v, god: R,
      rost: sRostom ? rost : null, detail: detail + hvost };
  }

  function procent(x) { var n = x * 100; return n >= 1 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace(".", ","); }

  // Хвост для всех строк «НДС в 2027 году» — существующая середина osvobozhdenie(), утверждена [команда] 21:10 без правок.
  var HVOST = "Доход для порога считают по правилам упрощёнки, не по бухотчётности, а «без НДС» законно и при льготной " +
    "операции (ст. 149 НК РФ) — поэтому это вопрос, а не нарушение.";

  // Подпись под строкой: «Режим — открытые данные ФНС на [дата набора]; выручка — бухотчётность ГИР БО за 2025 год.»
  // Дата набора — из dossier.data_dates («… режим… — на ДД.ММ.ГГГГ»); нет даты — без неё (не выдумываем).
  function podpis(remote, god) {
    var s = String(((remote || {}).dossier || {}).data_dates || ""), data = "";
    s.split(";").forEach(function (ch) {
      var m = /^\s*(.+?)\s+—\s+(?:на\s+)?(\d{2}\.\d{2}\.\d{4})\s*$/.exec(ch);
      if (m && !data && /режим/i.test(m[1])) data = m[2];
    });
    return "Режим — открытые данные ФНС" + (data ? " на " + data : "") + "; выручка — бухотчётность ГИР БО за " + god + " год.";
  }

  // «Кому вы платите»: сколько поставщиков-организаций на упрощёнке с доходом за T−2 от 15 млн ₽ до порога включительно
  // (rm — элементы ответа /api/shield/counterparties: rezhim, dohod — набор ФНС revexp, dohod_na). Ровно, без прогноза.
  function uPorogaVypiski(spisok, T) {
    T = T || GOD_PROGNOZA;
    var R = T - 2, p = porog(R), n = 0;
    (spisok || []).forEach(function (rm) {
      if (!rm || !/^\d{10}$/.test(String(rm.inn || "")) || rezhimKoda(rm.rezhim) !== "usn") return;
      if (typeof rm.dohod !== "number" || String(rm.dohod_na || "").slice(0, 4) !== String(R)) return;
      if (rm.dohod > BLIZKO && rm.dohod <= p) n++;
    });
    return n;
  }

  return { porog: porog, rezhim: rezhim, stroka: stroka, mln: mln, rezhimKoda: rezhimKoda, strokaVypiski: strokaVypiski,
    prognoz: prognoz, podpis: podpis, uPorogaVypiski: uPorogaVypiski, HVOST: HVOST, GOD_PROGNOZA: GOD_PROGNOZA };
});
;
/* --- /js/nds-porog.js --- */
/* Делоскоп — «НДС в 2027 году» на экране проверки: строка «у порога» (nds-porog-v1, команда, 03.10.2026).
 * Логика и тексты — js/bez-nds.js prognoz() (тексты [команда] 03.10 21:10 дословно).
 * Тон — только информационный: это вопрос поставщику, а не красный флаг (не жёлтый и не красный).
 * Ставится после «Рентабельности» / «Динамики» / фактов; повторная проверка заменяет блок; нет строки — блока нет.
 * Цели Метрики: nds_porog_view (строка показана), nds_porog_klik (переход в Делопись). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NdsPorog = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var CSS = ".ndp{display:grid;gap:6px;padding:16px 18px;border-radius:16px;border:1px solid var(--line,#E6E6E1);border-left-width:3px;border-left-color:#8A8A90;margin-top:12px}" +
    ".ndp__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px}.ndp__h b{font-size:15px;font-weight:600}" +
    ".ndp__h span{font-size:13px;color:var(--muted,#6B6B70)}.ndp p{margin:0}.ndp__t{font-size:15px;line-height:1.5}" +
    ".ndp__t a{color:inherit;text-decoration:underline;text-underline-offset:2px}.ndp__m{font-size:12px;color:var(--muted,#6B6B70)}" +
    "@media (max-width:520px){.ndp{padding:14px}}@media print{.ndp{break-inside:avoid}}";

  // o — результат DlkBezNds.prognoz(); molchat: osvobozhdena на экране не показываем (только факт на карточке).
  function html(o, podpis) {
    if (!o || !o.detail || o.kod === "osvobozhdena") return "";
    var t = esc(o.detail).replace("пункт 2.2 Делописи", '<a href="/delopis/" data-goal="nds_porog_klik">пункт 2.2 Делописи</a>');
    return '<section class="ndp" aria-label="' + esc(o.title) + '" data-nds-porog="' + esc(o.kod) + '">' +
      '<div class="ndp__h"><b>' + esc(o.title) + '</b><span>к сведению · ГИР БО и ФНС</span></div>' +
      '<p class="ndp__t">' + t + '</p>' +
      (podpis ? '<p class="ndp__m">' + esc(podpis) + '</p>' : '') +
      '</section>';
  }

  function stil(doc) {
    if (!doc || doc.getElementById("ndp-css")) return;
    var s = doc.createElement("style"); s.id = "ndp-css"; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  function mount(report, r, B, segodnya) {
    B = B || (typeof self !== "undefined" ? self.DlkBezNds : null);
    if (!report || !B || !B.prognoz) return null;
    var star = report.querySelector(".ndp");
    var o = B.prognoz(r, segodnya || new Date()), h = html(o, o ? B.podpis(r, o.god) : "");
    if (!h) { if (star) star.parentNode.removeChild(star); return null; }
    var doc = report.ownerDocument, t = doc.createElement("div");
    t.innerHTML = h;
    var nov = t.firstChild;
    try { stil(doc); } catch (e) {}
    if (star) star.parentNode.replaceChild(nov, star);
    else {
      var pos = null, sp = [".rnt", ".ngo", ".din", ".izm", ".rows"];
      for (var i = 0; i < sp.length && !pos; i++) pos = report.querySelector(sp[i]);
      if (!pos || !pos.parentNode) return null;
      pos.parentNode.insertBefore(nov, pos.nextSibling);
    }
    // клик по «пункт 2.2 Делописи» считает общий обработчик a[data-goal] (js/metrika.js)
    if (typeof self !== "undefined" && self.dlkGoal) self.dlkGoal("nds_porog_view", { kod: o.kod });
    return nov;
  }

  return { html: html, mount: mount, CSS: CSS };
});
;
/* --- /js/terminy.js --- */
/* Делоскоп — подсказки к терминам на экране проверки и в досье (решение команды 02.10 «понятнее»:
 * «термины с подсказкой по наведению/тапу (ЗСК, 54.1, РНП…)»; документ команды).
 * Справочник — /data/terminy.json: у каждого термина определение — дословные предложения из статьи сайта
 * (их уже сверило [команда]) и ссылка на эту статью. Новых правовых утверждений модуль не добавляет —
 * это держит tests/terminy.test.js. Подсказка — у первого упоминания термина в блоке; ссылки, кнопки,
 * заголовок компании и <summary> не трогаем. Чистые функции (sobrat, razmetit) — без DOM и сети. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Terminy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BUKVA = /[0-9A-Za-zА-Яа-яЁё]/;
  // заголовки разделов не трогаем: кнопка в строке заголовка Паспорта не переносится и выталкивает значок вбок на 390 px
  var NE_TROGAT = { A: 1, BUTTON: 1, SUMMARY: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, LABEL: 1 };
  var CSS =
    '.termin{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:help;text-align:inherit;' +
    'text-decoration:underline dotted;text-decoration-thickness:1px;text-underline-offset:.22em;text-decoration-color:currentColor}' +
    '.termin:hover,.termin[aria-expanded=true]{color:#0B63E5}' +
    '#termin-pop{position:absolute;z-index:70;box-sizing:border-box;max-width:320px;background:#fff;color:#1D1D1F;border:1px solid #E6E6E1;' +
    'border-radius:16px;padding:12px 14px;font:400 13px/1.5 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;' +
    'box-shadow:0 12px 36px rgba(0,0,0,.16);text-align:left}' +
    '#termin-pop b{display:block;font-weight:600;margin-bottom:4px}#termin-pop p{margin:0}' +
    '#termin-pop a{display:inline-block;margin-top:8px;color:#0B63E5}' +
    '@media print{#termin-pop{display:none!important}.termin{text-decoration:none}}';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // справочник → термины с готовыми выражениями (без lookbehind — старые Safari его не понимают)
  function sobrat(spr) {
    var out = [];
    ((spr && spr.terminy) || []).forEach(function (t) {
      if (!t || !t.id || !t.shablon || !t.opredelenie || !t.stranica) return;
      try { out.push({ t: t, re: new RegExp(t.shablon, 'g' + (t.flagi || '').replace(/g/g, '')) }); } catch (e) { /* битый шаблон — без подсказки */ }
    });
    return out;
  }

  // первое вхождение термина в строке с границами слова: [начало, конец] или null
  function najti(re, s) {
    re.lastIndex = 0;
    var m;
    while ((m = re.exec(s))) {
      if (!m[0]) { re.lastIndex++; continue; }
      var a = m.index, b = a + m[0].length;
      if ((a === 0 || !BUKVA.test(s.charAt(a - 1))) && (b >= s.length || !BUKVA.test(s.charAt(b)))) return [a, b];
      re.lastIndex = a + 1;
    }
    return null;
  }

  // строка → куски [{tekst}] и [{tekst, id}]; uzhe — id терминов, уже размеченных в этом блоке (дополняется)
  function razmetit(s, terminy, uzhe) {
    uzhe = uzhe || {};
    var kuski = [{ tekst: String(s == null ? '' : s) }];
    terminy.forEach(function (x) {
      if (uzhe[x.t.id]) return;
      for (var i = 0; i < kuski.length; i++) {
        var k = kuski[i];
        if (k.id) continue;
        var p = najti(x.re, k.tekst);
        if (!p) continue;
        var nov = [];
        if (p[0] > 0) nov.push({ tekst: k.tekst.slice(0, p[0]) });
        nov.push({ tekst: k.tekst.slice(p[0], p[1]), id: x.t.id });
        if (p[1] < k.tekst.length) nov.push({ tekst: k.tekst.slice(p[1]) });
        kuski.splice.apply(kuski, [i, 1].concat(nov));
        uzhe[x.t.id] = true;
        break;
      }
    });
    return kuski;
  }

  // содержимое всплывающей подсказки (HTML)
  function podskazka(t) {
    return '<b>' + esc(t.nazvanie) + '</b><p>' + esc(t.opredelenie) + '</p>' +
      '<a href="' + esc(t.stranica) + '">Подробнее: ' + esc(t.stranica_nazvanie || 'статья') + ' →</a>';
  }

  /* ---------- DOM ---------- */
  var zagruzka = null, SPR = null, svyazano = false, pop = null, tek = null;

  function zagruzit(url) {
    if (!zagruzka) {
      zagruzka = (typeof fetch === 'function' ? fetch(url || '/data/terminy.json', { cache: 'no-cache' })
        .then(function (o) { return o.ok ? o.json() : null; }) : Promise.resolve(null))
        .then(function (j) { SPR = j; return j; })
        .catch(function () { return null; });
    }
    return zagruzka;
  }

  function stil(doc) {
    if (doc.getElementById('termin-css')) return;
    var s = doc.createElement('style'); s.id = 'termin-css'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function zakryt() {
    if (pop) { pop.parentNode && pop.parentNode.removeChild(pop); pop = null; }
    if (tek) { tek.setAttribute('aria-expanded', 'false'); tek = null; }
  }

  function otkryt(btn) {
    var doc = btn.ownerDocument, win = doc.defaultView;
    var t = null;
    ((SPR && SPR.terminy) || []).forEach(function (x) { if (x.id === btn.getAttribute('data-termin')) t = x; });
    if (!t) return;
    zakryt();
    pop = doc.createElement('div');
    pop.id = 'termin-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Что значит «' + t.nazvanie + '»');
    pop.innerHTML = podskazka(t);
    doc.body.appendChild(pop);
    var r = btn.getBoundingClientRect(), w = pop.offsetWidth, sx = win.pageXOffset || 0, sy = win.pageYOffset || 0;
    var vw = doc.documentElement.clientWidth || win.innerWidth;
    pop.style.left = Math.max(sx + 8, Math.min(r.left + sx - 12, sx + vw - w - 8)) + 'px';
    pop.style.top = (r.bottom + sy + 8) + 'px';
    btn.setAttribute('aria-expanded', 'true'); tek = btn;
  }

  function svyazat(doc) {
    if (svyazano) return; svyazano = true;
    doc.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.termin') : null;
      if (b) { e.preventDefault(); if (tek === b && !b.hasAttribute('data-navedenie')) zakryt(); else otkryt(b); b.removeAttribute('data-navedenie'); return; }
      if (pop && !(e.target.closest && e.target.closest('#termin-pop'))) zakryt();
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tek) { var b = tek; zakryt(); b.focus(); } });
    // наведение — только там, где есть мышь; уход с термина и подсказки закрывает её через 300 мс
    var win = doc.defaultView, mysh = !!(win && win.matchMedia && win.matchMedia('(hover: hover) and (pointer: fine)').matches), tajmer = null;
    if (!mysh) return;
    doc.addEventListener('mouseover', function (e) {
      var b = e.target.closest ? e.target.closest('.termin, #termin-pop') : null;
      if (!b) return;
      clearTimeout(tajmer);
      if (b.classList.contains('termin') && tek !== b) { otkryt(b); b.setAttribute('data-navedenie', ''); }
    });
    doc.addEventListener('mouseout', function (e) {
      var b = e.target.closest ? e.target.closest('.termin, #termin-pop') : null;
      if (!b || !tek) return;
      var kuda = e.relatedTarget;
      if (kuda && kuda.closest && kuda.closest('.termin, #termin-pop')) return;
      clearTimeout(tajmer); tajmer = setTimeout(zakryt, 300);
    });
  }

  function mozhno(uzel, kont) {
    for (var p = uzel.parentNode; p && p !== kont; p = p.parentNode) {
      if (NE_TROGAT[p.nodeName] || (p.classList && (p.classList.contains('termin') || p.classList.contains('q'))) ||
          (p.hasAttribute && p.hasAttribute('data-bez-terminov'))) return false;
    }
    return true;
  }

  // размечает первые упоминания терминов в блоке kont; возвращает число подсказок
  function razmetitBlok(kont, spr) {
    if (!kont || !spr) return 0;
    var doc = kont.ownerDocument, terminy = sobrat(spr);
    if (!terminy.length) return 0;
    stil(doc); svyazat(doc);
    var uzhe = {}, n = 0, uzly = [];
    kont.querySelectorAll('.termin').forEach(function (b) { uzhe[b.getAttribute('data-termin')] = true; });
    var w = doc.createTreeWalker(kont, 4, null), u;
    while ((u = w.nextNode())) if (u.nodeValue && u.nodeValue.trim() && mozhno(u, kont)) uzly.push(u);
    uzly.forEach(function (uz) {
      var kuski = razmetit(uz.nodeValue, terminy, uzhe);
      // термин может занимать весь текстовый узел («ГИР БО» в <small>) — размечаем и его
      if (!kuski.some(function (k) { return k.id; })) return;
      var fr = doc.createDocumentFragment();
      kuski.forEach(function (k) {
        if (!k.id) { fr.appendChild(doc.createTextNode(k.tekst)); return; }
        var b = doc.createElement('button');
        b.type = 'button'; b.className = 'termin'; b.setAttribute('data-termin', k.id);
        b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-haspopup', 'dialog');
        b.textContent = k.tekst; fr.appendChild(b); n++;
      });
      uz.parentNode.replaceChild(fr, uz);
    });
    return n;
  }

  // главный вход: загрузить справочник и разметить блок; без справочника страница не меняется
  function mount(kont, url) {
    return zagruzit(url).then(function (spr) { try { return razmetitBlok(kont, spr); } catch (e) { return 0; } });
  }

  return { sobrat: sobrat, najti: najti, razmetit: razmetit, podskazka: podskazka, razmetitBlok: razmetitBlok, mount: mount, zagruzit: zagruzit };
});
;
/* --- /js/pasport-cta.js --- */
/*
 * Делоскоп — «Паспорт 490 ₽ в один шаг»: кнопка Паспорта контрагента по состояниям
 * (ТЗ [команда] 02.10.2026, документ команды, разд. 1.1, 1.3, 1.4).
 *
 * Состояния (тексты — дословно из ТЗ; цены и названия — только из /tarify/tarify.json, в коде чисел нет):
 *   beta    — бета: «Паспорт контрагента» + «В бете — бесплатно. После {beta_do ДД.ММ} — 490 ₽ или в тарифе «Старт».» Кнопки оплаты нет;
 *             даты нет или день прошёл — только «В бете — бесплатно.» (beta-data-v1, [команда] 05.10 11:10, разд. 1, п. 3).
 *   gost    — гость / бесплатный: «Паспорт на дату сделки — 490 ₽» + «Без подписки. PDF с QR-кодом, хранится в Кабинете.» + «3 проверки — 990 ₽»;
 *             пока «Старт» в месяц дешевле Паспорта — вместо пакета «или «Старт» — 390 ₽ в месяц, 3 Паспорта включены»
 *             (lestnica-390-v1, ТЗ [команда] 03.10 23:55, документ команды, разд. 2.3–2.4;
 *             «Старт» дороже Паспорта — снова пакет: выгоды, которой нет, не обещаем, ч. 3 ст. 5 38-ФЗ).
 *   paket   — есть пакет: «Сформировать Паспорт» + «Осталось N из 3 · до ДД.ММ.ГГГГ».
 *   tarif   — «Старт» и выше: «Сформировать Паспорт» + «Входит в ваш тариф».
 *   gotov   — Паспорт на эту дату уже есть: «Открыть Паспорт № …» + «Сформирован ДД.ММ.ГГГГ в ЧЧ:ММ».
 * Лист оплаты (разд. 1.2) — js/pasport-oplata.js: кнопка гостя открывает его поверх отчёта (счёт — прямо в листе);
 * без модуля или <dialog> — прежний переход в форму счёта (/schet/?produkt=pasport_razovyj); ссылка пакета — /schet/?produkt=paket_pasportov.
 * Метрика (разд. 1.4): pasport_cta_view{mesto, sost} при показе, pasport_cta_click{mesto, sost} по нажатию.
 * ИНН и e-mail в параметры не передаём (ИНН ИП — персональные данные, 152-ФЗ).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PasportCta = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NB = '\u00a0';
  var TARIFY_URL = '/tarify/tarify.json';
  var PLATNYE = { start: 1, pro: 1, business: 1, biznes: 1, team: 1 };
  // beta-data-v1: конец беты — из tarify.json → beta_do (последний бесплатный день, МСК). Нет даты или день прошёл —
  // текст без даты (вариант B полосы, ТЗ [команда] 05.10, разд. 1; [команда] 05.10 11:10, разд. 1, условие 3).
  var MES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function srokBety(d, sejchas) {
    var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var k = Date.parse(d + 'T00:00:00+03:00') + 864e5;
    if (isNaN(k) || (sejchas || Date.now()) >= k) return null;
    return { kratko: m[3] + '.' + m[2], slovami: (+m[3]) + NB + MES[+m[2] - 1] };
  }

  function rub(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽';
  }
  function z(n) { return (n < 10 ? '0' : '') + n; }
  function dataRu(v) {
    if (!v) return '';
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '.' + m[2] + '.' + m[1];
    return /^\d{2}\.\d{2}\.\d{4}$/.test(String(v)) ? String(v) : '';
  }
  function vremyaRu(v) {
    // только дата («2026-10-04») — без времени: полночь UTC иначе вышла бы «в 03:00» (vremya-proverki-v1)
    if (/^\s*\d{4}-\d{2}-\d{2}\s*$/.test(String(v || ''))) return dataRu(String(v).trim());
    var d = new Date(v);
    if (!v || isNaN(d)) return '';
    // время — по Москве (UTC+3, без перехода на летнее время)
    var m = new Date(d.getTime() + 3 * 3600 * 1000);
    return z(m.getUTCDate()) + '.' + z(m.getUTCMonth() + 1) + '.' + m.getUTCFullYear() + ' в ' + z(m.getUTCHours()) + ':' + z(m.getUTCMinutes());
  }

  // Что нужно из tarify.json: цена разового Паспорта, пакет (штук и цена), название первого платного тарифа.
  function iz(T) {
    if (!T || !T.pasport_razovyj || !(T.pasport_razovyj.cena_rub > 0)) return null;
    var p = T.paket_pasportov || {};
    var start = (T.tarify || []).filter(function (t) { return t.id === 'start'; })[0];
    return {
      beta: T.beta === true,
      betaDo: T.beta_do || null,
      cena: T.pasport_razovyj.cena_rub,
      paketShtuk: p.shtuk > 0 ? p.shtuk : null,
      paketCena: p.cena_rub > 0 ? p.cena_rub : null,
      start: start ? start.nazvanie : null,
      startMes: start ? startMesyac(start, T.beta === true) : null,
      startPasportov: start && start.otchetov > 0 ? start.otchetov : null
    };
  }

  /* Цена «Старта» в месяц, которую увидит покупатель после беты. После беты — как есть в tarify.json
   * (сборщик tests/startovaya.py сам переписывает туда стартовую цену). В бете — стартовая цена, только если
   * она точно включится: vklyuchit и «да» команды на годовую цену (god_soglasovan); иначе обычная. */
  function startMesyac(t, beta) {
    var st = t.startovaya;
    if (beta && st && st.vklyuchit === true && st.god_soglasovan === true && st.mesyac > 0) return st.mesyac;
    return t.mesyac > 0 ? t.mesyac : null;
  }
  // 1 Паспорт включён / 3 Паспорта включены / 5 Паспортов включены
  function pasportov(n) {
    var d = n % 10, s = n % 100;
    if (d === 1 && s !== 11) return n + NB + 'Паспорт включён';
    if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return n + NB + 'Паспорта включены';
    return n + NB + 'Паспортов включены';
  }
  // «Старт» дешевле разового Паспорта — тогда и только тогда подсказываем подписку.
  function startVygodnee(T) {
    return !!(T && T.start && T.startMes && T.startPasportov && T.startMes < T.cena);
  }
  function startPodskazka(T) {
    return rub(T.startMes) + ' в месяц, ' + pasportov(T.startPasportov);
  }

  /* sostoyanie({tarify, beta, user, gotov, sejchas}) → {sost, knopka, stroka, ssylka?:{t, href}, href}
   * tarify — разобранный iz(tarify.json); beta — режим страницы (meta deloskop-rezhim), он главнее;
   * user — ответ /api/me .user (plan, paket:{ostalos, vsego, do}); gotov — {nomer, sformirovan, url}. */
  function sostoyanie(o) {
    o = o || {};
    var T = o.tarify, u = o.user || null, inn = String(o.inn || '').replace(/\D/g, '');
    // dosje-sdelki-v1: номер проверки есть — открываем Паспорт с досье сделки по нему, без второй проверки по ИНН
    var rid = /^[A-Za-z0-9_-]{8,24}$/.test(String(o.reportId || '')) ? String(o.reportId) : '';
    var put = rid ? '/pasport/kontragent/?id=' + rid + '#sd' : '/pasport/kontragent/?inn=' + inn;
    var g = o.gotov;
    if (g && g.nomer) {
      var kogda = vremyaRu(g.sformirovan);
      return { sost: 'gotov', knopka: 'Открыть Паспорт № ' + g.nomer, stroka: kogda ? 'Сформирован ' + kogda : '', href: g.url || put };
    }
    if (o.beta || (T && T.beta)) {
      var s = 'В бете — бесплатно.';
      var srok = srokBety(T && T.betaDo, o.sejchas);
      if (T && T.start && srok) s += ' После ' + srok.kratko + ' — ' + rub(T.cena) + ' или в тарифе «' + T.start + '»' + (startVygodnee(T) ? ': ' + startPodskazka(T) : '') + '.';
      return { sost: 'beta', knopka: rid ? 'Досье сделки' : 'Паспорт контрагента', stroka: s, href: put };
    }
    var plan = u && u.plan ? String(u.plan) : '';
    if (PLATNYE[plan]) return { sost: 'tarif', knopka: 'Сформировать Паспорт', stroka: 'Входит в ваш тариф', href: put };
    var pk = u && u.paket;
    if (pk && pk.ostalos > 0) {
      var vsego = pk.vsego > 0 ? pk.vsego : (T && T.paketShtuk) || pk.ostalos;
      var dd = dataRu(pk['do']);
      return { sost: 'paket', knopka: 'Сформировать Паспорт', stroka: 'Осталось ' + pk.ostalos + ' из ' + vsego + (dd ? ' · до ' + dd : ''), href: put };
    }
    if (!T) return { sost: 'nejzvestno', knopka: 'Паспорт контрагента', stroka: '', href: put };
    // pokupka-chestno-v1: ИНН проверенной компании — в ссылку на счёт: Паспорт покупают на неё (Метрика адрес с ИНН не видит — js/metrika.js)
    var r = { sost: 'gost', knopka: 'Паспорт на дату сделки — ' + rub(T.cena), stroka: 'Без подписки. PDF с QR-кодом, хранится в Кабинете.', href: '/schet/?produkt=pasport_razovyj' + (/^(\d{10}|\d{12})$/.test(inn) ? '&inn=' + inn : '') };
    // pokupka-chestno п. 6 (ТЗ [команда] 12.10): «дешевле одного Паспорта» — только пока это правда (startVygodnee); цены — из tarify.json
    if (startVygodnee(T)) r.ssylka = { t: 'или «' + T.start + '» — ' + rub(T.startMes) + ' в месяц: дешевле одного Паспорта, и ' + pasportov(T.startPasportov), href: '/tarify/#t-start', cel: 'start' };
    else if (T.paketShtuk && T.paketCena) r.ssylka = { t: T.paketShtuk + ' проверки — ' + rub(T.paketCena), href: '/schet/?produkt=paket_pasportov', cel: 'paket' };
    return r;
  }

  // ---------- браузер ----------
  var kesh = null;
  function zagruzit(doc) {
    if (kesh) return kesh;
    var w = doc && doc.defaultView;
    var el = doc && doc.getElementById && doc.getElementById('tarify-data');
    if (el) { try { kesh = Promise.resolve(JSON.parse(el.textContent)); return kesh; } catch (e) { /* дальше — по сети */ } }
    kesh = w && w.fetch ? w.fetch(TARIFY_URL).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
    return kesh;
  }
  function betaStranicy(doc) {
    return !!(doc && doc.querySelector && doc.querySelector('meta[name="deloskop-rezhim"][content="beta"]'));
  }
  function cel(w, imya, p) { try { if (w && w.dlkGoal) w.dlkGoal(imya, p); } catch (e) { /* Метрика не мешает */ } }

  // Нарисовать состояние на уже стоящей кнопке a (полоса вывода листа или карточка /company/).
  function primenit(a, s, mesto, nazvanie) {
    var doc = a.ownerDocument, w = doc.defaultView;
    if (nazvanie) a.setAttribute('data-naz', String(nazvanie).slice(0, 200));
    a.textContent = s.knopka;
    a.setAttribute('href', s.href);
    a.setAttribute('data-sost', s.sost);
    var box = a.parentNode && a.parentNode.querySelector('.pcta[data-dlya="' + (a.getAttribute('data-cel') || '') + '"]');
    if (box) box.parentNode.removeChild(box);
    if (s.stroka || s.ssylka) {
      box = doc.createElement('p');
      box.className = 'pcta';
      box.setAttribute('data-dlya', a.getAttribute('data-cel') || '');
      if (s.stroka) box.appendChild(doc.createTextNode(s.stroka));
      if (s.ssylka) {
        if (s.stroka) box.appendChild(doc.createTextNode(' '));
        var l = doc.createElement('a');
        l.href = s.ssylka.href; l.textContent = s.ssylka.t;
        if (s.ssylka.cel) {
          l.setAttribute('data-ssylka', s.ssylka.cel);
          l.addEventListener('click', function () { cel(w, 'pasport_cta_click', { mesto: mesto, sost: s.sost, ssylka: s.ssylka.cel }); });
        }
        box.appendChild(l);
      }
      a.parentNode.insertBefore(box, a.nextSibling);
    }
    cel(w, 'pasport_cta_view', { mesto: mesto, sost: s.sost });
    if (!a.getAttribute('data-pcta')) {
      a.setAttribute('data-pcta', '1');
      a.addEventListener('click', function (e) {
        var sost = a.getAttribute('data-sost') || '';
        cel(w, 'pasport_cta_click', { mesto: mesto, sost: sost });
        // гость: лист оплаты поверх отчёта (js/pasport-oplata.js); не открылся — обычный переход по ссылке
        if (sost !== 'gost' || !w.PasportOplata || e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return;
        e.preventDefault();
        var href = a.getAttribute('href');
        w.PasportOplata.otkryt({ nazvanie: a.getAttribute('data-naz') || '', inn: (/[?&]inn=(\d{10,12})/.exec(href) || [])[1] || '', doc: doc }).then(function (ok) { if (!ok) w.location.href = href; });
      });
    }
    return s;
  }

  /* mount(a, {inn, mesto, nazvanie?, user?, gotov?}) → Promise<состояние>. Сразу — бета или «Паспорт контрагента»,
   * после загрузки tarify.json и /api/me — точное состояние. Ошибка сети — кнопка остаётся как была. */
  function mount(a, o) {
    o = o || {};
    if (!a || !a.ownerDocument) return Promise.resolve(null);
    var doc = a.ownerDocument, beta = betaStranicy(doc), mesto = o.mesto || 'list';
    var user = o.user ? Promise.resolve(o.user) : (beta || !o.api ? Promise.resolve(null)
      : doc.defaultView.fetch(o.api + '/api/me', { credentials: 'include' }).then(function (r) { return r.json(); }).then(function (j) { return j && j.user || null; }).catch(function () { return null; }));
    return Promise.all([zagruzit(doc), user]).then(function (x) {
      return primenit(a, sostoyanie({ tarify: iz(x[0]), beta: beta, user: x[1], gotov: o.gotov, inn: o.inn, reportId: o.reportId }), mesto, o.nazvanie);
    }).catch(function () { return null; });
  }

  return { sostoyanie: sostoyanie, iz: iz, pasportov: pasportov, startVygodnee: startVygodnee, rub: rub, dataRu: dataRu, vremyaRu: vremyaRu, mount: mount, primenit: primenit, srokBety: srokBety };
});
;
/* --- /js/pasport-oplata.js --- */
/*
 * Делоскоп — «Паспорт 490 ₽ в один шаг», лист оплаты (ТЗ [команда] 02.10.2026,
 * документ команды, разд. 1.2–1.4).
 *
 * Лист выезжает справа (на телефоне — снизу) поверх отчёта: человек не уходит с экрана проверки.
 * Внутри: «Паспорт контрагента на ДД.ММ.ГГГГ» + название из отчёта → 4 строки «что внутри» →
 * цена крупно (из /tarify/tarify.json, в коде чисел нет) + «без НДС» → способы оплаты → оговорка [команда].
 * Способы: онлайн-кнопки — только когда в tarify.json появится `sposoby` (провайдер ещё не подключён,
 * выдуманных кнопок не рисуем); всегда — «Компании и ИП — оплата по счёту»: прежняя форма счёта
 * (js/schet.js, без изменений) открывается прямо в листе.
 * В бете лист не открывается вовсе (кнопка в бете ведёт на бесплатный Паспорт — js/pasport-cta.js).
 * Метрика (разд. 1.4): oplata_start{produkt, sposob}; ИНН и e-mail в параметры не передаём (152-ФЗ).
 * Чистые функции (model, html) — без DOM и сети, их проверяет tests/pasport_oplata.test.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PasportOplata = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NB = '\u00a0';
  var TARIFY_URL = '/tarify/tarify.json';
  var SCHET_JS = '/js/schet.js';
  // Что внутри (разд. 1.2, дословно)
  var VNUTRI = [
    'Все признаки — с источником и датой',
    'Комментарий команды к сигналам, где он есть',
    'PDF с QR-кодом: проверить подлинность может любой',
    'Хранится в Кабинете — часть доказательств вашей осмотрительности'
  ];
  // Оговорка [команда] 02.10 12:30, разд. 1; номер пункта — по оферте с разовыми покупками (п. 3.7, oferta-razovye-v1)
  var OGOVORKA = 'Оплачивая, вы принимаете оферту (п.' + NB + '3.7). Если Паспорт не сформирован или в нём ошибка по нашей вине, исправим за 3 рабочих дня, не исправим — вернём оплату.';
  var PO_SCHETU = 'Компании и ИП — оплата по счёту';

  function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽'; }
  function z(n) { return (n < 10 ? '0' : '') + n; }
  // дата «сегодня» по Москве (UTC+3) — Паспорт формируется на дату сделки
  function segodnya(now) {
    var d = new Date((now == null ? Date.now() : +new Date(now)) + 3 * 3600 * 1000);
    return z(d.getUTCDate()) + '.' + z(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* model(T, {nazvanie, now}) → null (бета / нет цены) или {zag, nazvanie, vnutri[], cena, nds, sposoby[], poSchetu, ogovorka, produkt}
   * T — разобранный tarify.json. sposoby — из T.sposoby: [{id, nazvanie, href}] только с адресом https. */
  function model(T, o) {
    o = o || {};
    if (!T || T.beta === true) return null;
    var p = T.pasport_razovyj;
    if (!p || !(p.cena_rub > 0)) return null;
    var sp = (Array.isArray(T.sposoby) ? T.sposoby : []).filter(function (s) {
      return s && s.nazvanie && /^https:\/\//.test(String(s.href || ''));
    }).map(function (s) { return { id: String(s.id || ''), nazvanie: String(s.nazvanie), href: String(s.href) }; });
    return {
      produkt: 'pasport_razovyj',
      zag: 'Паспорт контрагента на' + NB + segodnya(o.now),
      nazvanie: String(o.nazvanie || '').trim(),
      // pokupka-chestno-v1: ИНН компании, на которую покупают Паспорт (с экрана проверки) — уходит в форму счёта
      inn: /^(\d{10}|\d{12})$/.test(String(o.inn || '')) ? String(o.inn) : '',
      vnutri: VNUTRI.slice(),
      cena: rub(p.cena_rub),
      nds: 'без НДС',
      sposoby: sp,
      poSchetu: PO_SCHETU,
      ogovorka: OGOVORKA
    };
  }

  function html(m) {
    if (!m) return '';
    return '<header class="po-hd"><h2 class="po-zag" id="po-zag" tabindex="-1">' + esc(m.zag) + '</h2>' +
      (m.nazvanie ? '<p class="po-naz">' + esc(m.nazvanie) + '</p>' : '') + '</header>' +
      '<ul class="po-vn">' + m.vnutri.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      '<p class="po-cena"><b class="n">' + esc(m.cena) + '</b><span>' + esc(m.nds) + '</span></p>' +
      (m.sposoby.length ? '<div class="po-sp">' + m.sposoby.map(function (s, i) {
        return '<a class="btn' + (i === 0 ? ' p' : '') + '" href="' + esc(s.href) + '" data-sposob="' + esc(s.id) + '" rel="noopener">' + esc(s.nazvanie) + '</a>';
      }).join('') + '</div>' : '') +
      '<button type="button" class="po-schet' + (m.sposoby.length ? '' : ' po-schet--gl') + '" data-po-schet aria-expanded="false">' + esc(m.poSchetu) + '</button>' +
      '<div class="po-forma" data-po-forma hidden></div>' +
      '<p class="po-og">' + esc(m.ogovorka).replace('оферту', '<a href="/oferta/#razovye" target="_blank" rel="noopener">оферту</a>') + '</p>';
  }

  // ---------- браузер ----------
  var kesh = null, dlg = null, schetGruzim = null;
  function tarify(doc) {
    if (kesh) return kesh;
    var w = doc.defaultView, el = doc.getElementById && doc.getElementById('tarify-data');
    if (el) { try { kesh = Promise.resolve(JSON.parse(el.textContent)); return kesh; } catch (e) { /* дальше — по сети */ } }
    kesh = w && w.fetch ? w.fetch(TARIFY_URL).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
    return kesh;
  }
  function cel(w, imya, p) { try { if (w && w.dlkGoal) w.dlkGoal(imya, p); } catch (e) { /* Метрика не мешает */ } }
  function schet(doc) {
    var w = doc.defaultView;
    if (w.DeloskopSchet) return Promise.resolve(w.DeloskopSchet);
    if (schetGruzim) return schetGruzim;
    schetGruzim = new Promise(function (ok, ne) {
      var s = doc.createElement('script'); s.src = SCHET_JS; s.async = true;
      s.onload = function () { w.DeloskopSchet ? ok(w.DeloskopSchet) : ne(new Error('schet')); };
      s.onerror = function () { schetGruzim = null; ne(new Error('schet')); };
      doc.head.appendChild(s);
    });
    return schetGruzim;
  }

  /* otkryt({nazvanie, doc?}) → Promise<boolean>: true — лист открыт; false — открыть нельзя (бета, нет цены,
   * нет <dialog>) — тогда вызывающий оставляет обычный переход по ссылке на /schet/. */
  function otkryt(o) {
    o = o || {};
    var doc = o.doc || (typeof document !== 'undefined' ? document : null);
    if (!doc || !doc.defaultView || !doc.defaultView.HTMLDialogElement) return Promise.resolve(false);
    var w = doc.defaultView;
    return tarify(doc).then(function (T) {
      var m = model(T, { nazvanie: o.nazvanie, inn: o.inn });
      if (!m) return false;
      if (!dlg) {
        dlg = doc.createElement('dialog'); dlg.className = 'po';
        dlg.setAttribute('aria-labelledby', 'po-zag');
        doc.body.appendChild(dlg);
        dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
        dlg.addEventListener('close', function () { doc.documentElement.style.overflow = ''; });
      }
      dlg.classList.remove('po--schet');
      dlg.innerHTML = '<button type="button" class="po-x" aria-label="Закрыть">×</button>' + html(m);
      dlg.querySelector('.po-x').onclick = function () { dlg.close(); };
      Array.prototype.forEach.call(dlg.querySelectorAll('[data-sposob]'), function (a) {
        a.addEventListener('click', function () { cel(w, 'oplata_start', { produkt: 'razovyj', sposob: a.getAttribute('data-sposob') || '' }); });
      });
      var b = dlg.querySelector('[data-po-schet]'), box = dlg.querySelector('[data-po-forma]');
      b.onclick = function () {
        if (!box.hidden) return;
        cel(w, 'oplata_start', { produkt: 'razovyj', sposob: 'schet' });
        b.setAttribute('aria-expanded', 'true');
        schet(doc).then(function (S) {
          box.hidden = false; b.hidden = true; dlg.classList.add('po--schet');   // сумма — в форме счёта, без повтора
          var f = S.forma(box, { produkt: m.produkt, inn: m.inn, nazvanie: m.nazvanie }, true);
          try { f.fokus(); } catch (e) { /* фокус не обязателен */ }
        }).catch(function () { w.location.href = '/schet/?produkt=' + m.produkt + (m.inn ? '&inn=' + m.inn : ''); });
      };
      doc.documentElement.style.overflow = 'hidden';
      dlg.showModal();
      try { dlg.querySelector('#po-zag').focus(); } catch (e) { /* фокус не обязателен */ }
      return true;
    }).catch(function () { return false; });
  }

  return { model: model, html: html, otkryt: otkryt, segodnya: segodnya, rub: rub, VNUTRI: VNUTRI, OGOVORKA: OGOVORKA, PO_SCHETU: PO_SCHETU };
});
;
/* --- /indeks/indeks.js --- */
/* Индекс Делоскопа — калькулятор на странице методики.
   Считает по тем же правилам, что и сервер (indeks_v1.py); методика — в JSON на странице.
   Тест совпадения с Python: tests/indeks.test.mjs */
(function (root) {
  'use strict';

  function rasschitat(m, fakty, dostupno) {
    var sh = m.shkala, ist = m.istochniki, polnota = 0, k;
    for (k in ist) if (dostupno[k]) polnota += ist[k].ves_polnoty;
    for (var i = 0; i < m.polnota.minimum_dlya_rascheta.length; i++)
      if (!dostupno[m.polnota.minimum_dlya_rascheta[i]]) return { indeks: null, uroven: null, stop: null, polnota: polnota, vklady: [] };
    for (i = 0; i < m.stop.length; i++)
      if (fakty[m.stop[i].id]) return { indeks: null, uroven: { id: 'stop', nazvanie: 'Стоп', ton: 'red', tekst: m.stop[i].tekst }, stop: m.stop[i], polnota: polnota, vklady: [] };
    var vklady = [], plyusy = 0, minusy = 0, potolki = [];
    m.faktory.forEach(function (f) {
      if (!fakty[f.id] || !dostupno[f.istochnik]) return;
      vklady.push({ id: f.id, vklad: f.vklad, tekst: f.tekst, pochemu: f.pochemu, gruppa: f.gruppa });
      if (f.vklad > 0) plyusy += f.vklad; else minusy += f.vklad;
      if (f.potolok != null) potolki.push([f.potolok, f.tekst]);
    });
    var pu = Math.min(plyusy, m.plyusy_maksimum);
    var indeks = Math.max(sh.min, Math.min(sh.max, sh.baza + minusy + pu)), potolok = null;
    potolki.sort(function (a, b) { return a[0] - b[0]; });
    if (potolki.length && indeks > potolki[0][0]) { indeks = potolki[0][0]; potolok = { znachenie: indeks, prichina: potolki[0][1] }; }
    // методика 1.0.1: меньше порога полноты — числа и уровня нет (раньше — потолок 69), пишем, сколько данных собрано
    if (polnota < m.polnota.porog_sokrashchennoj)
      return { indeks: null, uroven: null, stop: null, polnota: polnota, sokrashchennaya: true, vklady: [] };
    vklady.sort(function (a, b) { return (a.vklad > 0) - (b.vklad > 0) || a.vklad - b.vklad; });
    var u = m.urovni.filter(function (x) { return x.ot <= indeks && indeks <= x.do; })[0];
    return { indeks: indeks, uroven: u, stop: null, polnota: polnota, sokrashchennaya: false, minusy: minusy,
             plyusy: plyusy, plyusy_uchteno: pu, potolok: potolok, vklady: vklady };
  }

  function minus(n) { return (n > 0 ? '+' : '−') + Math.abs(n); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var PRESETY = {
    zavod: ['vozrast_10g', 'shtat_10', 'likvidnost_vysokaya', 'goskontrakty', 'iski_est'],
    tehnicheskaya: ['vozrast_do_6m', 'massovyj_rukovoditel', 'shtat_0_1', 'nalogi_nol', 'nedostovernyj_adres'],
    startap: ['vozrast_6_12m', 'shtat_0_1', 'net_buhotchetnosti'],
    ustalaya: ['vozrast_10g', 'ubytok_2_goda', 'chistye_aktivy_minus', 'nedoimka', 'iski_krupnye']
  };

  function zapustit(doc) {
    var el = doc.getElementById('kalk');
    if (!el) return;
    var m = JSON.parse(doc.getElementById('metodika').textContent);
    var vse = {}; for (var k in m.istochniki) vse[k] = true;
    var box = el.querySelectorAll('input[type=checkbox]');
    var chislo = el.querySelector('[data-k=chislo]'), nazv = el.querySelector('[data-k=uroven]'),
        tekst = el.querySelector('[data-k=tekst]'), ukaz = el.querySelector('[data-k=ukazatel]'),
        raskl = el.querySelector('[data-k=rasklad]'), kart = el.querySelector('.k-itog');

    function obnovit() {
      var f = {};
      box.forEach(function (b) { f[b.value] = b.checked; });
      var r = rasschitat(m, f, vse);
      kart.setAttribute('data-ton', r.uroven.ton);
      if (r.indeks == null) {
        chislo.textContent = 'Стоп'; nazv.textContent = r.stop.tekst;
        tekst.textContent = 'Индекс не считаем: с ликвидируемой или банкротящейся компанией работать нельзя.';
        ukaz.style.left = '0%'; raskl.innerHTML = ''; return;
      }
      chislo.textContent = r.indeks; nazv.textContent = r.uroven.nazvanie; tekst.textContent = r.uroven.tekst;
      ukaz.style.left = ((r.indeks - 1) / 98 * 100) + '%';
      var h = '<li><span>База</span><b>' + m.shkala.baza + '</b></li>';
      r.vklady.forEach(function (v) { h += '<li class="' + (v.vklad < 0 ? 'm' : 'p') + '"><span>' + esc(v.tekst) + '</span><b>' + minus(v.vklad) + '</b></li>'; });
      if (r.plyusy > r.plyusy_uchteno) h += '<li class="n"><span>Плюсов больше +' + m.plyusy_maksimum + ' не засчитываем</span><b>' + minus(r.plyusy_uchteno - r.plyusy) + '</b></li>';
      if (r.potolok) h += '<li class="n"><span>Потолок: ' + esc(r.potolok.prichina.toLowerCase()) + '</span><b>≤ ' + r.potolok.znachenie + '</b></li>';
      h += '<li class="i"><span>Индекс</span><b>' + r.indeks + '</b></li>';
      raskl.innerHTML = h;
    }
    box.forEach(function (b) { b.addEventListener('change', obnovit); });
    el.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = PRESETY[btn.getAttribute('data-preset')] || [];
        box.forEach(function (b) { b.checked = p.indexOf(b.value) >= 0; });
        el.querySelectorAll('[data-preset]').forEach(function (x) { x.setAttribute('aria-pressed', x === btn ? 'true' : 'false'); });
        obnovit();
      });
    });
    obnovit();
  }

  var api = { rasschitat: rasschitat, PRESETY: PRESETY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.DeloskopIndeks = api; if (root.document) { if (document.readyState !== 'loading') zapustit(document); else document.addEventListener('DOMContentLoaded', function () { zapustit(document); }); } }
})(typeof window !== 'undefined' ? window : this);
;
/* --- /js/indeks-otvet.js --- */
/*
 * Делоскоп — Индекс в проверке без ожидания API (комплект indeks-v-otchete-v1, Очередь п. 245;
 * ТЗ [команда] 03.10 13:35 — документ команды; Планёрка 03.10 (а) — да).
 *
 * Переводит ответ /api/check в факты и источники открытой методики v1.0 (indeks/metodika-v1.json)
 * и считает число тем же калькулятором, что страница /indeks/ (indeks/indeks.js = сервер indeks_v1.py).
 * Ворота честности («без данных не хвалим»):
 *   1) ИП — числа нет;  2) в ответе есть сигнал warn/bad, который методика v1 не оценивает, — числа нет;
 *   3) полнота < 60 % — ни числа, ни уровня: «Индекс — данных пока мало» (v1.1–v1.2);  4) есть r.indeks от сервера — берём его, не считаем;
 *   5) dossier.score — никогда.
 * Нагрузку против отрасли не берём: API считает её со взносами, методика — без (✎ 02:05, daty-api-v1).
 * Ничего не запрашивает, кроме самой методики (один JSON, в браузере — при загрузке скрипта).
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IndeksOtvet = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var NB = ' ';
  var M = null, KALK = null, zhdut = [];
  var ISKL = { '105': 1, '106': 1, '107': 1, '108': 1, '110': 1 };
  var ISKLYUCHENA = { '407': 1, '414': 1, '415': 1, '418': 1, '420': 1 };
  var TON = { green: 'ok', yellow: 'warn', orange: 'warn', red: 'bad' };
  var NE_PODKL = { sudy: 'суды', fssp: 'приставы', fedresurs: 'банкротство', eis: 'закупки' };

  function gotov() { return !!(M && KALK); }
  function ustanovit(m, kalk) {
    M = m || M; KALK = kalk || KALK;
    if (gotov()) { var z = zhdut; zhdut = []; z.forEach(function (f) { try { f(); } catch (e) {} }); }
  }
  // gotovo(f): вызвать f, когда методика загружена (или сразу); не дождались за 4 с — всё равно вызываем (будет «считаем»)
  function gotovo(f) {
    if (gotov() || typeof setTimeout !== 'function') { f(); return; }
    var bylo = false, g = function () { if (!bylo) { bylo = true; f(); } };
    zhdut.push(g); setTimeout(g, 4000);
  }

  // ---------- разбор ответа ----------
  function sig(r) { return Array.isArray(r && r.signals) ? r.signals.filter(function (s) { return s && typeof s === 'object'; }) : []; }
  function t(s) { return String(s.title == null ? '' : s.title).replace(/ /g, ' ').trim(); }
  function d(s) { return String(s.detail == null ? '' : s.detail).replace(/ /g, ' ').trim(); }
  function plohoj(s) { return s.status === 'warn' || s.status === 'bad'; }

  // дата проверки по Москве → {g, m, d} (как «Существенные факты»)
  function naDatu(r) {
    var x = Date.parse((r && r.checked_at) || '');
    if (!isFinite(x)) x = Date.now();
    var q = new Date(x + 3 * 3600 * 1000);
    return { g: q.getUTCFullYear(), m: q.getUTCMonth() + 1, d: q.getUTCDate() };
  }
  function iso(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? { g: +m[1], m: +m[2], d: +m[3] } : null; }
  function ru(v) { var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(v || '').trim()); return m ? { g: +m[3], m: +m[2], d: +m[1] } : iso(v); }
  // полных месяцев от a до b
  function mesyacev(a, b) { var n = (b.g - a.g) * 12 + (b.m - a.m); if (b.d < a.d) n--; return n; }

  // «1,2 млн ₽», «410 000 ₽», «3,1 млрд ₽», «850 тыс. ₽» → рубли | null
  function rubli(s) {
    var m = /(\d[\d\s ]*(?:[.,]\d+)?)\s*(млрд|млн|тыс)?\.?\s*(?:₽|руб)/i.exec(String(s || ''));
    if (!m) return null;
    var v = parseFloat(m[1].replace(/[\s ]/g, '').replace(',', '.'));
    if (!isFinite(v)) return null;
    var k = (m[2] || '').toLowerCase();
    return v * (k === 'млрд' ? 1e9 : k === 'млн' ? 1e6 : k === 'тыс' ? 1e3 : 1);
  }
  function ryad(arr) {
    var po = {};
    (Array.isArray(arr) ? arr : []).forEach(function (x) {
      var g = x ? parseInt(x.year, 10) : NaN, v = x ? x.value : null;
      if (isFinite(g) && v !== null && v !== '' && typeof v !== 'boolean' && isFinite(Number(v))) po[g] = Number(v);
    });
    return Object.keys(po).map(Number).sort(function (a, b) { return a - b; }).map(function (g) { return { g: g, v: po[g] }; });
  }
  function vyruchka(r) {
    var a = ryad(((r.dossier || {}).charts || {}).revenue);
    return a.length && a[a.length - 1].v > 0 ? a[a.length - 1].v : null;
  }
  // текущая ликвидность — та же строка досье, что js/dinamika.js (likvidnost-izm-v1); своей формулы нет
  function likvidnost(r) {
    var D = (r && r.dossier) || {}, v = null;
    (Array.isArray(D.sections) ? D.sections : []).forEach(function (sk) {
      if (!sk || sk.id !== 'dynamics' || !Array.isArray(sk.rows)) return;
      sk.rows.forEach(function (row) {
        if (!Array.isArray(row) || !/^Текущая ликвидность$/i.test(String(row[0] || '').trim())) return;
        var m = /^\s*(\d+(?:[.,]\d+)?)\s*$/.exec(String(row[1] == null ? '' : row[1]));
        if (m) v = Number(m[1].replace(',', '.'));
      });
    });
    return v !== null && isFinite(v) && v > 0 ? v : null;
  }

  // r → { fakty, dostupno, neizvestnye[], neUchli[] }
  function izOtveta(r) {
    r = r || {};
    var c = r.company || {}, ch = (r.dossier && r.dossier.charts) || {}, na = naDatu(r);
    var fakty = {}, dostupno = {}, neizv = [], neUchli = [];
    var S = sig(r);
    var kod = String(c.state_code == null ? '' : c.state_code).trim();

    // --- источники (полнота) ---
    dostupno.egrul = !!(c.inn && S.some(function (s) { return t(s) === 'Статус'; }));
    dostupno.fns = S.some(function (s) {
      // v1.1 ([команда] 15:55, разд. 2.2): источник «ФНС» — только открытые наборы (не реестр дисквалифицированных, не «Сервис ФНС»)
      var src = String(s.source || '');
      if (!/ФНС/.test(src) || !/открыт/i.test(src)) return false;
      var a = ru(s.as_of);
      if (!a) return false;
      var n = mesyacev(a, na);
      return n >= 0 && n <= 3 && !(n === 3 && na.d > a.d) || n < 0;
    });
    var godMin = na.g - 1, rv = ryad(ch.revenue), bl = ch.balance && typeof ch.balance === 'object' ? ch.balance : null;
    var netOtch = S.some(function (s) { return /отч[её]тность за \d{4} год не (сдана|представлена)/i.test(d(s)); });
    dostupno.girbo = (rv.length && rv[rv.length - 1].g >= godMin) || (bl && parseInt(bl.year, 10) >= godMin) || netOtch;
    dostupno.girbo = !!dostupno.girbo;
    var dm = r.damia || {};
    [['sudy', 'sudy'], ['fssp', 'fssp'], ['fedresurs', 'bankrotstvo'], ['eis', 'rnp']].forEach(function (p) {
      // istochniki-v1: учтён — ответ самого реестра (provereno / found / not_found); банкротство, подставленное из ЕГРЮЛ
      // (iz_egryul), полноту «Федресурс и ЕФРСБ» не даёт — сообщения ЕФРСБ не проверены
      var b = dm[p[1]];
      dostupno[p[0]] = !!(b && typeof b === 'object' && !b.iz_egryul && (b.status === 'provereno' || b.status === 'found' || b.status === 'not_found'));
    });

    // --- статус ЕГРЮЛ ---
    var st = c.status;
    if (st === 'LIQUIDATED' || ISKLYUCHENA[kod]) fakty.likvidirovana = true;
    if (st === 'BANKRUPT') fakty.bankrotstvo = true;
    if (st === 'REORGANIZING') fakty.reorganizaciya = true;
    if (st === 'LIQUIDATING') {
      if (ISKL[kod] || !kod) fakty.reshenie_ob_isklyuchenii = true; // без кода — двусмысленно: не «Стоп», потолок 25
      else fakty.likvidaciya = true;
    }

    // --- возраст (от даты регистрации до даты проверки) ---
    var rg = iso(c.reg_date), vozrastIzv = false;
    if (rg) {
      var mes = mesyacev(rg, na);
      if (mes >= 0) {
        vozrastIzv = true;
        if (mes < 6) fakty.vozrast_do_6m = true;
        else if (mes < 12) fakty.vozrast_6_12m = true;
        else if (mes < 36) fakty.vozrast_1_3g = true;
        else if (mes >= 120) fakty.vozrast_10g = true;
      }
    }

    // --- недостоверность по полям ---
    if (c.address_invalid === true) fakty.nedostovernyj_adres = true;
    if (c.invalid === true && c.address_invalid !== true) fakty.nedostovernyj_rukovoditel = true;

    // --- численность (по детали строки, любой статус) ---
    S.forEach(function (s) {
      if (!/^Среднесписочная численность/i.test(t(s))) return;
      var m = /(\d+)\s*человек/.exec(d(s));
      if (!m) { if (plohoj(s)) neizv.push(s); return; }
      var n = +m[1];
      if (n <= 1) fakty.shtat_0_1 = true; else if (n >= 10) fakty.shtat_10 = true;
    });

    // --- сигналы warn/bad ---
    var vyr = vyruchka(r);
    S.forEach(function (s) {
      if (!plohoj(s)) return;
      var T = t(s), D = d(s), TD = T + ' ' + D;
      if (/^Среднесписочная численность/i.test(T)) return; // разобрано выше
      if (T === 'Статус' || /исключ|ликвид|банкрот|реорганиз/i.test(T)) {
        if (/исключена из ЕГРЮЛ|исключено из ЕГРЮЛ|исключила компанию/i.test(TD)) { fakty.likvidirovana = true; return; }
        if (/^Ликвидирована$/i.test(D) || /прекратил[аи]? деятельность/i.test(D)) { fakty.likvidirovana = true; return; }
        if (/банкрот/i.test(TD)) { fakty.bankrotstvo = true; return; }
        if (/исключени|упрощ[её]нном порядке/i.test(TD)) { fakty.reshenie_ob_isklyuchenii = true; return; }
        if (/^Ликвидируется$|в процессе ликвидации/i.test(D) && !ISKL[kod]) { fakty.likvidaciya = true; return; }
        if (/реорганиз/i.test(TD)) { fakty.reorganizaciya = true; return; }
        neizv.push(s); return;
      }
      if (/недостоверн/i.test(TD)) {
        var a = /адрес/i.test(TD.replace(/^Недостоверность адреса или руководителя/, '')), ru_ = /руковод|учредит/i.test(TD.replace(/^Недостоверность адреса или руководителя/, ''));
        if (T === 'Адрес') a = true;
        if (!a && !ru_) { if (c.address_invalid === true) a = true; else if (c.invalid === true) ru_ = true; }
        if (a) fakty.nedostovernyj_adres = true;
        if (ru_) fakty.nedostovernyj_rukovoditel = true;
        if (!a && !ru_) neizv.push(s);
        return;
      }
      if (/^Массовый руководитель/i.test(T)) { fakty.massovyj_rukovoditel = true; return; }
      if (/^Массовый адрес/i.test(T) || (T === 'Адрес' && /массов/i.test(D))) { fakty.massovyj_adres = true; return; }
      if (/^Дисквалификац/i.test(T)) { if (s.status === 'bad') fakty.diskvalifikaciya = true; else neizv.push(s); return; }
      if (/^(Задолженность|Долги) по налогам/i.test(T)) {
        var sum = rubli(D);
        if (sum != null && vyr && sum > 0.05 * vyr) fakty.nedoimka_krupnaya = true; else fakty.nedoimka = true;
        return;
      }
      if (/^Приостановление операций/i.test(T)) { if (s.status === 'bad') fakty.blokirovka_fns = true; else neizv.push(s); return; }
      if (/штраф/i.test(T)) { fakty.nalogovye_shtrafy = true; return; }
      if (/^Возраст компании/i.test(T)) { if (!vozrastIzv) neizv.push(s); return; }
      if (/^Доходы и расходы/i.test(T)) {
        if (/не (сдана|представлена)/i.test(D)) fakty.net_buhotchetnosti = true;
        return; // убыток одного года — не фактор v1 (два года — по ряду ниже); «не раскрыта» — не «0»
      }
      if (/^Низкая налоговая нагрузка/i.test(T)) { neUchli.push('nagruzka'); return; }
      if (/^Прогноз ЗСК/i.test(T)) return; // наша оценка ЗСК — фактом рядом, не в балл (методика v2, разд. 2.2)
      if (/^(ФССП|Долг[иа]? у приставов|Исполнительн)/i.test(T)) {
        var p = rubli(D);
        if (dostupno.fssp && p != null && vyr && p > 0.05 * vyr) { fakty.pristavy_krupnye = true; return; }
        if (dostupno.fssp && p != null && vyr) return;
        neizv.push(s); return;
      }
      neizv.push(s);
    });

    // --- приставы из блока API (istochniki-v1): остаток по открытым производствам без штрафов ГИБДД против выручки ---
    var fs = dm.fssp;
    if (dostupno.fssp && fs && fs.status === 'found') {
      var ost = Number(fs.summa_ostatka);
      if (isFinite(ost) && ost > 0 && vyr && ost > 0.05 * vyr) fakty.pristavy_krupnye = true;
      else if (isFinite(ost) && ost > 0 && !vyr) neizv.push({ title: 'Долги у приставов', status: 'warn', faktor: 'pristavy_krupnye' });
    }

    // --- бухотчётность по рядам ---
    var pr = ryad(ch.profit);
    if (pr.length >= 2) {
      var p1 = pr[pr.length - 1], p0 = pr[pr.length - 2];
      if (p1.g - p0.g === 1 && p1.v < 0 && p0.v < 0) fakty.ubytok_2_goda = true;
    }
    if (bl && bl.equity !== null && bl.equity !== '' && typeof bl.equity !== 'boolean' && isFinite(Number(bl.equity)) && Number(bl.equity) < 0) fakty.chistye_aktivy_minus = true;
    var lk = likvidnost(r);
    if (lk !== null) { if (lk < 1) fakty.likvidnost_nizkaya = true; else if (lk > 2) fakty.likvidnost_vysokaya = true; }
    if (rv.length >= 2) {
      var v1 = rv[rv.length - 1], v0 = rv[rv.length - 2];
      if (v1.g - v0.g === 1 && v0.v > 0 && v1.v < 0.5 * v0.v) fakty.vyruchka_upala = true;
    }

    // минус из источника, который не учтён в полноте, калькулятор пропустит — число завысится: такой случай — как неизвестный сигнал
    if (M) M.faktory.forEach(function (f) {
      if (fakty[f.id] && f.vklad < 0 && !dostupno[f.istochnik]) neizv.push({ title: f.tekst, status: 'warn', faktor: f.id });
    });
    return { fakty: fakty, dostupno: dostupno, neizvestnye: neizv, neUchli: neUchli, bankrIzEgryul: !!(dm.bankrotstvo && dm.bankrotstvo.iz_egryul) };
  }

  // ---------- что показать ----------
  function chisloServera(r) {
    var v = r && r.indeks;
    return v !== undefined && v !== null && v !== '';
  }
  // vid(r) → { rezhim: 'server'|'ip'|'net'|'neizv'|'sokr'|'stop'|'chislo', ball, uroven, ton, polnota, istochnikov, vklady, potolok, neUchityvali }
  function vid(r) {
    r = r || {};
    var c = r.company || {};
    if (chisloServera(r)) return { rezhim: 'server' };
    if (c.kind === 'INDIVIDUAL' || String(c.inn || '').replace(/\D/g, '').length === 12) return { rezhim: 'ip' };
    if (!gotov()) return { rezhim: 'net' };
    var x = izOtveta(r);
    var rez = KALK.rasschitat(M, x.fakty, x.dostupno);
    var n = 0, k;
    for (k in M.istochniki) if (x.dostupno[k]) n++;
    var out = { polnota: rez.polnota, istochnikov: n, vsego: Object.keys(M.istochniki).length, versiya: M.versiya, neUchityvali: neUchityvali(x, c) };
    if (rez.stop) { out.rezhim = 'stop'; out.stop = rez.stop.tekst; out.ton = 'bad'; return out; }
    if (rez.indeks == null && !rez.sokrashchennaya) { out.rezhim = 'net'; return out; } // нет ЕГРЮЛ — не считаем
    if (x.neizvestnye.length) { out.rezhim = 'neizv'; out.signaly = x.neizvestnye.map(function (s) { return t(s); }); return out; }
    // v1.1: «данных пока мало» — без уровня и тона; методика 1.0.1 — ниже порога числа нет и в расчёте (indeks/indeks.js)
    if (rez.sokrashchennaya || rez.polnota < M.polnota.porog_sokrashchennoj) { out.rezhim = 'sokr'; out.porog = M.polnota.porog_sokrashchennoj; return out; }
    out.uroven = rez.uroven.nazvanie; out.ton = TON[rez.uroven.ton] || 'warn';
    out.rezhim = 'chislo'; out.ball = rez.indeks; out.baza = M.shkala.baza; out.vklady = rez.vklady;
    out.potolok = rez.potolok; out.plyusy = rez.plyusy; out.plyusyUchteno = rez.plyusy_uchteno; out.plyusyMaks = M.plyusy_maksimum;
    return out;
  }
  // банк: та же проверка, что bank(c) в js/sushchestvennoe.js (ОКВЭД 64.1x) — бухотчётность банка в ГИР БО передаёт Банк России (ч. 9 ст. 18 402-ФЗ), доступ может быть ограничен (ч. 12)
  function bank(c) {
    var S = root && root.Sushchestvennoe;
    if (S && typeof S.bank === 'function') return S.bank(c);
    return /^64\.1(\.|\d|$)/.test(String((c || {}).okved || ''));
  }
  function neUchityvali(x, c) {
    var a = [], b = [];
    // istochniki-v1: статус банкротства из ЕГРЮЛ учли — не учли только сообщения ЕФРСБ (намерения кредиторов, ход процедуры)
    Object.keys(NE_PODKL).forEach(function (k) { if (!x.dostupno[k]) a.push(k === 'fedresurs' && x.bankrIzEgryul ? 'сообщения ЕФРСБ' : NE_PODKL[k]); });
    if (a.length) b.push(a.join(', ') + ' — источник не' + NB + 'подключён');
    if (!x.dostupno.fns) b.push('налоги и штат — свежего набора ФНС в' + NB + 'ответе нет');
    // v1.2 ([команда] 16:07 разд. 1 п. 1): у банка «её нет» звучит как упрёк — пишем, куда он её сдаёт.
    // v1.3 ([команда] 04.10 11:30 разд. 1.4): «а не в ГИР БО» неполно — Банк России передаёт её в ГИР БО
    // (ч. 9 ст. 18 402-ФЗ), доступ может быть ограничен (ч. 12; v1.4 — [команда] 04.10 12:30 разд. 1). «;» внутри — на «,»: пункты списка разделены «; ».
    if (!x.dostupno.girbo) b.push(bank(c) ? 'бухотчётность — организация сдаёт в' + NB + 'Банк России, в' + NB + 'ГИР' + NB + 'БО её передаёт Банк России, доступ может быть ограничен (ч.' + NB + '9 и' + NB + '12 ст.' + NB + '18' + NB + '402-ФЗ)'
      : 'бухотчётность — за' + NB + 'прошлый год в' + NB + 'ответе её нет');
    b.push('налоговая нагрузка — сравним с' + NB + 'отраслью, когда придут налоги без взносов');
    return b;
  }

  // ---------- вёрстка колонки Индекса листа отчёта (полоса B) ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (q) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[q]; }); }
  // «402-ФЗ).» на 390 px рвался по дефису — номер закона со скобкой и точкой одним куском (после esc)
  function nwFz(h) { return String(h).replace(/(\d+-ФЗ\)?\.?)/g, '<span class="nw">$1</span>'); }
  function zn(n) { return (n > 0 ? '+' : '−') + Math.abs(n); }
  function podpis(v) {
    return 'По открытой методике v' + esc(v.versiya) + ' · ' + v.istochnikov + NB + 'из' + NB + v.vsego + ' источников · полнота ' + v.polnota + NB + '%';
  }
  var NE_ZNACHIT = 'Не проверено — не значит «не обнаружено».';
  function strokaNe(v) { return 'Не учитывали в этот раз: ' + v.neUchityvali.join('; ') + '. ' + NE_ZNACHIT; }
  var TXT_NEIZV = 'Индекс — считаем: в' + NB + 'проверке есть сигнал, который методика v1 пока не' + NB + 'оценивает. Он показан в' + NB + 'фактах ниже.';
  var ZAG_SOKR = 'Индекс — данных пока' + NB + 'мало';
  function txtSokr(v) { return 'Собрано ' + v.polnota + NB + '% данных — число и' + NB + 'уровень покажем, когда наберётся ' + (v.porog || 60) + NB + '%'; }
  // первый пункт «Не учитывали», которого не хватает именно для полноты (без «не подключён» и «налоговой нагрузки»)
  function neHvataet(v) {
    var a = (v.neUchityvali || []).filter(function (x) { return !/не\s?подключён/.test(x) && !/^налоговая нагрузка/.test(x); });
    return a.length ? a[0] : '';
  }

  // html колонки для режимов, которые считает браузер; для остальных — '' (лист оставит свою строку «считаем»)
  function htmlKolonka(v) {
    var h = '<div class="ot-ix__lab">Индекс Делоскопа</div>';
    if (v.rezhim === 'chislo') {
      var li = '<li><span>База</span><b>' + v.baza + '</b></li>';
      v.vklady.forEach(function (x) { li += '<li class="' + (x.vklad < 0 ? 'm' : 'p') + '"><span>' + esc(x.tekst) + '</span><b>' + zn(x.vklad) + '</b></li>'; });
      if (v.plyusy > v.plyusyUchteno) li += '<li class="n"><span>Плюсов больше +' + v.plyusyMaks + ' не' + NB + 'засчитываем</span><b>' + zn(v.plyusyUchteno - v.plyusy) + '</b></li>';
      if (v.potolok) li += '<li class="n"><span>Потолок: ' + esc(String(v.potolok.prichina).toLowerCase()) + '</span><b>≤' + NB + v.potolok.znachenie + '</b></li>';
      li += '<li class="i"><span>Индекс</span><b>' + v.ball + '</b></li>';
      return h + '<div class="ot-ix__big n">' + v.ball + '<small>' + NB + '/' + NB + '99</small></div>' +
        '<div class="ot-ix__sh" aria-hidden="true"><i style="left:' + v.ball + '%"></i></div>' +
        '<div class="ot-ix__lv ot-ix__lv--' + v.ton + '">' + esc(v.uroven) + '</div>' +
        '<div class="ot-ix__po n">' + podpis(v) + ' · <a href="/indeks/">методика</a></div>' +
        '<details class="ot-ix__pch"><summary>Почему ' + v.ball + '</summary><ul class="ot-ix__rs n">' + li + '</ul>' +
        '<p class="ot-ix__ne-uch">' + strokaNe(v) + '</p></details>';
    }
    if (v.rezhim === 'sokr')
      // v1.2 ([команда] 16:07 разд. 1 п. 4): числа нет — «по сокращённым данным» читалось бы как «посчитали, но грубо»
      return h + '<div class="ot-ix__ne">' + ZAG_SOKR + '</div>' +
        '<div class="ot-ix__po n">' + esc(txtSokr(v)) + '.' + (neHvataet(v) ? ' Не хватает: ' + nwFz(esc(neHvataet(v)) + '.') : '') + '</div>' +
        '<div class="ot-ix__po n">' + podpis(v) + ' · <a href="/indeks/">методика</a></div>';
    if (v.rezhim === 'neizv')
      return h + '<div class="ot-ix__ne">Индекс — считаем</div><div class="ot-ix__po">' + TXT_NEIZV.replace(/^Индекс — считаем: в/, 'В') + '</div>' +
        '<div class="ot-ix__lv"><a href="/indeks/">методика</a></div>';
    if (v.rezhim === 'stop')
      return h + '<div class="ot-ix__big ot-ix__lv--bad">Стоп</div><div class="ot-ix__lv ot-ix__lv--bad">' + esc(v.stop) + '</div>' +
        '<div class="ot-ix__po">По открытой методике v' + esc(v.versiya) + ' при этом факте число не' + NB + 'считаем · <a href="/indeks/">методика</a></div>';
    return '';
  }

  // Короткая строка для Паспорта и снимка: число или null
  function ball(r) {
    var v = vid(r);
    return v.rezhim === 'chislo' ? v.ball : null;
  }

  // Фактор методики по id — для «Что изменилось»: почему сдвинулся Индекс (js/dinamika.js, indeks-pochemu-v1)
  function faktor(id) {
    if (!M || !Array.isArray(M.faktory)) return null;
    var f = M.faktory.filter(function (x) { return x.id === id; })[0];
    if (!f) return null;
    var o = { id: f.id, tekst: f.tekst, vklad: f.vklad };
    // indeks-pochemu-v1.1 [команда]: потолок фактора — «Что изменилось» объясняет сдвиг, который не равен сумме вкладов
    if (typeof f.potolok === 'number') o.potolok = f.potolok;
    return o;
  }
  // границы шкалы и предел плюсов методики — для «итог не равен сумме вкладов»
  function shkala() {
    if (!M || !M.shkala) return null;
    return { min: M.shkala.min, max: M.shkala.max, plyusyMaks: M.plyusy_maksimum };
  }
  function versiya() { return M ? String(M.versiya || '') : ''; }

  // ---------- загрузка методики ----------
  if (typeof module === 'object' && module.exports && typeof require === 'function') {
    try { ustanovit(require('../indeks/metodika-v1.json'), require('../indeks/indeks.js')); } catch (e) {}
  } else if (root && typeof root.fetch === 'function') {
    var kalk = function () { return root.DeloskopIndeks || null; };
    root.fetch('/indeks/metodika-v1.json').then(function (x) { return x.ok ? x.json() : null; }).then(function (m) {
      if (!m || !Array.isArray(m.faktory)) return;
      if (kalk()) ustanovit(m, kalk());
      else if (root.addEventListener) root.addEventListener('DOMContentLoaded', function () { ustanovit(m, kalk()); });
    }).catch(function () {});
  }

  return { izOtveta: izOtveta, vid: vid, ball: ball, htmlKolonka: htmlKolonka, gotov: gotov, gotovo: gotovo, ustanovit: ustanovit, faktor: faktor, shkala: shkala, versiya: versiya,
    rubli: rubli, TXT_NEIZV: TXT_NEIZV, ZAG_SOKR: ZAG_SOKR, txtSokr: txtSokr, neHvataet: neHvataet, strokaNe: strokaNe, podpis: podpis };
});
;
/* --- /js/otchet.js --- */
/*
 * Делоскоп — «Отчёт о проверке на всю ширину» (макет [команда] 02.10.2026,
 * документ команды, разд. 2; решение команды 02.10 «солиднее · техничнее · понятнее»).
 *
 * Данные не меняются: модули (rekvizity-proverki, usloviya, sushchestvennoe, kommentarii, dinamika, otkuda, shchit, terminy)
 * рисуют свои блоки как раньше, а этот модуль только раскладывает готовые узлы по листу:
 *   A шапка-документ (название + реквизиты) → B полоса вывода (Индекс · вывод · одно действие)
 *   → основное: существенные факты → что изменилось → динамика → «Все данные из реестров»
 *   → справа: «Как посчитали предел», «Откуда данные» → подвал (действия) → оговорка.
 * На ≤ 860 px — одна колонка: … динамика → как посчитали → откуда → все данные → подвал.
 * Числа Индекса нет в ответе /api/check — колонку считает браузер по открытой методике v1.0 (js/indeks-otvet.js,
 * indeks-v-otchete-v1) с воротами честности; не прошло ворота или нет модуля — «считаем», ничего не выдумываем.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Otchet = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NB = '\u00a0';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Уровни Индекса — без оценочных слов о компании (222-ФЗ; ответы [команда] 02.10 09:15 и 11:15).
  var UROVNI = [
    [70, 'Без серьёзных сигналов', 'ok'],
    [50, 'Есть вопросы', 'warn'],
    [30, 'Есть серьёзные сигналы', 'warn'],
    [1, 'Много признаков риска', 'bad']
  ];
  function uroven(n) {
    for (var i = 0; i < UROVNI.length; i++) if (n >= UROVNI[i][0]) return { t: UROVNI[i][1], ton: UROVNI[i][2] };
    return null;
  }
  // Число Индекса — только целое 1–99 из ответа API; иначе null («считаем»).
  function indeks(r) {
    var v = r && r.indeks;
    if (v && typeof v === 'object') v = v.znachenie != null ? v.znachenie : v.value;
    var n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d{1,2}$/.test(v) ? +v : NaN);
    return isFinite(n) && n >= 1 && n <= 99 ? Math.round(n) : null;
  }
  function polnota(r) {
    var v = r && r.polnota;
    if (v && typeof v === 'object') v = v.procent;
    var n = typeof v === 'number' ? v : NaN;
    if (!isFinite(n)) return null;
    if (n > 0 && n <= 1) n = n * 100;
    return n >= 0 && n <= 100 ? Math.round(n) : null;
  }
  // Цвет полосы вывода — по risk_level ответа (low/medium/high); неизвестное — нейтральный «есть вопросы».
  function tonPolosy(r) {
    var l = r && r.risk_level;
    return l === 'low' ? 'ok' : l === 'high' ? 'bad' : 'warn';
  }

  // Действия полосы: одна главная («Следить»), одна второстепенная («Паспорт» — только юрлицу).
  // Щит: главное действие — первый шаг разбора со ссылкой (Shchit.glavnyj), иначе «Следить за своей компанией».
  function dejstviya(r, svoj, g) {
    var inn = String(r && r.company && r.company.inn || '').replace(/\D/g, '');
    var a = [svoj && g && g.href && !g.sled
      ? { t: g.knopka || 'Что сделать', href: g.href, glavnaya: true, cel: 'shchit_shag', ext: !!g.ext }
      : { t: svoj ? 'Следить за своей компанией' : 'Следить за компанией', href: '/cabinet.html#watch', glavnaya: true, cel: svoj ? 'shchit_sled' : 'otchet_sled' }];
    // dosje-sdelki-v1: с номером проверки — «Досье сделки» на странице Паспорта по этому номеру (без второй проверки)
    var rid = /^[A-Za-z0-9_-]{8,24}$/.test(String(r && r.report_id || '')) ? String(r.report_id) : '';
    if (!svoj && inn.length === 10) a.push(rid ? { t: 'Досье сделки', href: '/pasport/kontragent/?id=' + rid + '#sd', cel: 'otchet_pasport' } : { t: 'Паспорт контрагента', href: '/pasport/kontragent/?inn=' + inn, cel: 'otchet_pasport' });
    // sravnit-v1 (Ф2, 23.10): «+ Сравнить с другой» — тихой ссылкой под второстепенной кнопкой (не спорит с главной); ИП не сравниваем
    if (!svoj && inn.length === 10) a.push({ t: '+' + NB + 'Сравнить с другой компанией', href: '/sravnit/?a=' + inn, cel: 'otchet_sravnit', tihaya: true });
    return a;
  }

  // Колонка Индекса (B, слева).
  function htmlIndeks(r) {
    var n = indeks(r), p = polnota(r);
    var h = '<div class="ot-ix__lab">Индекс Делоскопа</div>';
    if (n != null) {
      var u = uroven(n);
      h += '<div class="ot-ix__big n">' + n + '<small>' + NB + '/' + NB + '99</small></div>' +
        '<div class="ot-ix__sh" aria-hidden="true"><i style="left:' + n + '%"></i></div>' +
        '<div class="ot-ix__lv">' + esc(u.t) + ' · <a href="/indeks/">методика</a></div>';
    } else {
      h += '<div class="ot-ix__ne">Индекс — считаем</div>' +
        (p != null ? '<div class="ot-ix__pl n">собрано ' + p + NB + '% данных</div>' : '') +
        '<div class="ot-ix__lv"><a href="/indeks/">методика</a></div>';
    }
    return h;
  }

  // indeks-v-otchete-v1: нет числа от сервера — колонка по открытой методике в браузере (js/indeks-otvet.js); иначе — как раньше
  function htmlIndeksIz(r, IO) {
    if (indeks(r) == null && IO && IO.vid && IO.htmlKolonka) {
      try { var h = IO.htmlKolonka(IO.vid(r)); if (h) return h; } catch (e) {}
    }
    return htmlIndeks(r);
  }
  function modulIO() { return typeof self !== 'undefined' && self.IndeksOtvet ? self.IndeksOtvet : null; }

  function summaVSsylku(a, report) {
    var h = a.getAttribute('href') || '';
    if (!/^\/pasport\/kontragent\/\?id=/.test(h)) return;
    var i = report.querySelector('.usl-in input'), U = typeof self !== 'undefined' ? self.Usloviya : null;
    var v = U && i ? U.parseAmount(i.value) : 0;
    h = h.replace(/&summa=\d+/, '');
    a.setAttribute('href', v > 0 ? h.replace(/(#sd)?$/, '&summa=' + Math.round(v) + '$1') : h);
  }
  function htmlDejstviya(r, svoj, g) {
    return dejstviya(r, svoj, g).map(function (d) {
      if (d.tihaya) return '<a class="ot-lnk" href="' + esc(d.href) + '" data-cel="' + d.cel + '">' + esc(d.t) + '</a>';
      return '<a class="ot-btn ' + (d.glavnaya ? 'p' : 's') + '" href="' + esc(d.href) + '" data-cel="' + d.cel + '"' + (d.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(d.t) + '</a>';
    }).join('');
  }

  // «Как посчитали предел» (H) — те же тексты, что в «Условиях сделки» (Usloviya.decide(r).kak).
  function htmlKak(kak, statya) {
    if (!kak || !kak.kak) return '';
    return '<section class="ot-sc" id="ot-kak" aria-labelledby="ot-kak-h"><h3 id="ot-kak-h">Как посчитали предел</h3>' +
      '<p class="n">' + esc(kak.kak) + '</p>' + (kak.ne ? '<p class="ot-ne n">' + esc(kak.ne) + '</p>' : '') +
      (kak.ssylka ? '<p class="n" data-ot="bank"><a href="' + esc(kak.ssylka.u) + '" target="_blank" rel="noopener">' + esc(kak.ssylka.t) + ' →</a></p>' : '') +
      '<p class="ot-cap">Ориентир Делоскопа, не норма закона. <a href="/indeks/#predoplata">Открытая формула предела</a>' + (statya ? '; пример — в разборе <a href="' + esc(statya) + '">«Сколько платить вперёд незнакомой компании»</a>' : '') + '.</p></section>';
  }

  var POD_PILL = 'по признакам из реестров';
  // «Данных пока мало» (Индекс без числа) + пилюля API «Без серьёзных сигналов»: слова уровня 70–99 читались бы как оценка,
  // которой нет — пишем о найденном и сколько реестров методики учтено (ТЗ [команда] 03.10 18:55 разд. 4, [команда] 20:07 разд. 3).
  // indeks-yasno-v1 (ТЗ [команда] 03.10 22:55 разд. 2): на листе одно «из» — 7 реестров методики, то же число, что в колонке Индекса
  // (IndeksOtvet.vid(r).istochnikov / vsego). Опись «Откуда данные» считает другое и называется «ответили N из M запрошенных».
  var PILL_SOKR = 'В найденных данных серьёзных сигналов нет';
  function podSokr(v) {
    if (!v || !(v.vsego > 0) || !(v.istochnikov >= 0)) return '';
    var t = 'Учтено реестров: ' + v.istochnikov + NB + 'из' + NB + v.vsego;
    return v.istochnikov < v.vsego ? t + '. По остальным не' + NB + 'проверяли — это не' + NB + 'значит «нарушений нет».' : t;
  }
  // pilyulya(r, v) → { t, pod } — что написать в пилюле и под ней; t = null — текст пилюли не трогаем.
  // v — IndeksOtvet.vid(r).
  function pilyulya(r, v) {
    if (r && r.risk_level === 'low' && v && v.rezhim === 'sokr') return { t: PILL_SOKR, pod: podSokr(v) || POD_PILL };
    return { t: null, pod: POD_PILL };
  }

  // Отступ сверху под липкие полосы (шапка сайта, строка проверки) — чтобы начало листа не пряталось под ними.
  function otstup(doc) {
    var w = doc.defaultView, m = 0;
    if (!w || !w.getComputedStyle) return 0;
    Array.prototype.forEach.call(doc.querySelectorAll('.shapka, .rezhim-otcheta .hero-text'), function (x) {
      var cs = w.getComputedStyle(x);
      if (cs.position !== 'sticky' && cs.position !== 'fixed') return;
      var b = (parseFloat(cs.top) || 0) + x.offsetHeight;
      if (b > m) m = b;
    });
    return m;
  }
  // Правка [команда] 02.10 13:35: при новом ответе — к началу листа (на любой ширине, а не только < 980 px).
  function prokrutit(report) {
    if (!report || !report.ownerDocument) return false;
    var doc = report.ownerDocument, w = doc.defaultView;
    if (!w || !w.scrollTo) return false;
    // пришли по ссылке «…#indeks» — к колонке Индекса (отчёт рисуется после ответа API, сам браузер к якорю не прокрутит)
    var cel = (w.location && w.location.hash === '#indeks' && doc.getElementById('indeks')) || report;
    var y = cel.getBoundingClientRect().top + (w.pageYOffset || 0) - otstup(doc) - 12;
    var plavno = !(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
    w.scrollTo({ top: Math.max(0, Math.round(y)), behavior: plavno ? 'smooth' : 'auto' });
    return true;
  }

  var OGOVORKA = 'Оценка по открытым данным на дату проверки, а не решение банка или налоговой.';

  // otchet-detali-v1: строка под отчётом в режиме /?inn= (названия — как в витрине partials/vitrina.json)
  var DRUGIE = [['Проверить счёт', '/proverit-schet/'], ['Кому вы' + NB + 'платите', '/kontragenty-iz-vypiski/'],
    ['Наличные глазами банка', '/nalichnye/'], ['Скорая 115\u2011ФЗ', '/skoraya-115-fz/'], ['Разборы дел', '/praktika/'],
    ['Все инструменты', '/#vitrina']];

  // ---------- браузер: раскладка готового отчёта по листу ----------
  // текст пилюли (после значка): t — новый, null — исходный (запомнен в data-t0)
  function tekstPilyuli(pill, t) {
    var uz = null;
    for (var i = pill.childNodes.length - 1; i >= 0; i--) if (pill.childNodes[i].nodeType === 3) { uz = pill.childNodes[i]; break; }
    if (!uz) return;
    if (!pill.hasAttribute('data-t0')) pill.setAttribute('data-t0', uz.nodeValue);
    uz.nodeValue = t == null ? pill.getAttribute('data-t0') : t;
  }
  function el(doc, tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function vzyat(report, sel) { var x = report.querySelector(sel); return x && x.parentNode ? x : null; }

  // razlozhit(report, r, {svoj, shR, usl}) — report — уже нарисованный .report; возвращает true, если лист собран.
  function razlozhit(report, r, o) {
    o = o || {};
    if (!report || !r || !r.company) return false;
    var doc = report.ownerDocument || document, svoj = !!o.svoj;
    var head = vzyat(report, '.report-head'), who = head && head.firstElementChild, pill = vzyat(report, '.report-head .pill');
    var rkv = vzyat(report, '.rkv'), rows = vzyat(report, '.rows'), izm = report.querySelector(':scope > .izm');
    var din = report.querySelector(':scope > .din'), gl = report.querySelector('.sut__g');
    var act = vzyat(report, '.report-actions'), otk = vzyat(report, '.otk') || vzyat(report, '.src');
    var usl = o.usl || null;
    if (!head || !act) return false;

    var hd = el(doc, 'header', 'ot-hd'), whoBox = el(doc, 'div', 'ot-who'), rq = el(doc, 'div', 'ot-rq');
    if (who) whoBox.appendChild(who);
    if (rkv) rq.appendChild(rkv);
    // «Перепроверить до…» (js/perepoverit.js) — срок годности проверки: реквизит документа, под реквизитами
    var ppEl = vzyat(report, '.pp');
    if (ppEl) rq.appendChild(ppEl);
    hd.appendChild(whoBox); hd.appendChild(rq);
    // otchet-detali-v1: номер проверки нужен поддержке, а не читателю — из шапки в строку под действиями (и на печати)
    var nom = null, nomEl = rkv && rkv.querySelector('.rkv__nom');
    if (nomEl) {
      var nomDiv = nomEl.closest ? nomEl.closest('div') : nomEl.parentNode.parentNode;
      var nomDt = nomDiv && nomDiv.querySelector('dt');
      nom = el(doc, 'p', 'ot-nom', (nomDt ? nomDt.innerHTML : 'Проверка №') + NB);
      nom.appendChild(nomEl);
      if (nomDiv && nomDiv.parentNode === rkv) rkv.removeChild(nomDiv);
      if (rkv.children.length % 2) rkv.classList.add('rkv--nechet');
    }

    var vd = el(doc, 'section', 'ot-vd ot-vd--' + tonPolosy(r));
    vd.setAttribute('aria-label', 'Вывод');
    var ix = el(doc, 'div', 'ot-ix', htmlIndeks(r));
    ix.id = 'indeks'; // якорь: карточки /company/ ведут на /?inn=…#indeks (✎ [команда] 03.10 20:50)
    // колонка Индекса: число браузера (если методика загружена) — без пилюли; «считаем» — с пилюлей уровня риска, как раньше
    var zapolnit = function () {
      var IO = modulIO(), h = htmlIndeksIz(r, IO);
      ix.innerHTML = h;
      var chislo = /ot-ix__big/.test(h);
      if (pill && !chislo) {
        pill.classList.add('ot-pill'); ix.insertBefore(pill, ix.lastChild);
        var pv = null;
        try { pv = IO && indeks(r) == null && IO.gotov && IO.gotov() ? IO.vid(r) : null; } catch (e) { pv = null; }
        var pp = pilyulya(r, pv);
        tekstPilyuli(pill, pp.t);
        // правка [команда] 02.10 13:35: уровень риска — не Индекс, подписываем, откуда он
        ix.insertBefore(el(doc, 'div', 'ot-ix__pod', esc(pp.pod)), ix.lastChild);
      }
      var pch = ix.querySelector('.ot-ix__pch');
      if (pch) pch.addEventListener('toggle', function () { try { if (pch.open && window.dlkGoal) dlkGoal('indeks_raskladka'); } catch (e) {} });
    };
    zapolnit();
    var IO0 = modulIO();
    // gotovo() через 4 с зовёт и без методики — на медленной сети колонка оставалась «Индекс — считаем»; ждём ещё (до 4 раз, ~16 с)
    if (IO0 && indeks(r) == null && IO0.gotov && !IO0.gotov() && IO0.gotovo) {
      var popytki = 0, zhdat = function () {
        if (!IO0.gotov() && ++popytki < 4) { IO0.gotovo(zhdat); return; }
        if (IO0.gotov()) zapolnit();
      };
      IO0.gotovo(zhdat);
    }
    var vt = el(doc, 'div', 'ot-vt');
    if (svoj) {
      var shKr = function () {
        var kr = '';
        try { kr = o.shR && window.Shchit ? Shchit.kratko(o.shR) : ''; } catch (e) { kr = ''; }
        kr = kr.replace(/^.*? — глазами банка и налоговой на [\d.]+\.\s*/, '').replace(/\s*Что сделать:.*$/, '');
        vt.innerHTML = '<h2 class="ot-vt__h">Ваша компания глазами банка и налоговой</h2>' + (kr ? '<p class="ot-vt__p">' + esc(kr) + '</p>' : '');
      };
      shKr();
      // Щит v3: рентабельность против отрасли приходит после загрузки норм ФНС — «Признаков: N» пересчитываем (shchit-finansy-v1)
      if (o.shR && o.shR.gotovo && typeof o.shR.gotovo.then === 'function') o.shR.gotovo.then(shKr, function () {});
    } else if (usl) {
      vt.appendChild(usl);
      vt.appendChild(el(doc, 'a', 'ot-vt__kak', 'Как посчитали предел')).setAttribute('href', '#ot-kak');
    }
    var g = null;
    try { g = svoj && o.shR && window.Shchit ? Shchit.glavnyj(o.shR) : null; } catch (e) { g = null; }
    var ac = el(doc, 'div', 'ot-act', htmlDejstviya(r, svoj, g));
    vd.appendChild(ix); vd.appendChild(vt); vd.appendChild(ac);

    var body = el(doc, 'div', 'ot-body'), main = el(doc, 'div', 'ot-main'), side = el(doc, 'aside', 'ot-side');
    side.setAttribute('aria-label', 'Справка к выводу');
    if (svoj && usl) main.appendChild(usl);
    [rows, izm, din, gl].forEach(function (x) { if (x && x.parentNode) main.appendChild(x); });
    if (gl) gl.classList.add('ot-gl');
    if (!svoj) {
      var kak = null;
      try { kak = window.Usloviya ? Usloviya.decide(r).kak : null; } catch (e) { kak = null; }
      var kh = htmlKak(kak, window.Usloviya && Usloviya.STATYA);
      if (kh) side.appendChild(el(doc, 'div', null, kh).firstChild);
      else { var k = vt.querySelector('.ot-vt__kak'); if (k) k.parentNode.removeChild(k); }
    }
    if (otk) { otk.classList.add('ot-otk'); side.appendChild(otk); }
    body.appendChild(main); body.appendChild(side);

    var foot = el(doc, 'div', 'ot-foot'); foot.appendChild(act);
    if (nom) foot.appendChild(nom);
    var disc = el(doc, 'p', 'ot-disc', esc(OGOVORKA));
    // otchet-detali-v1: на главной в режиме отчёта витрина и разделы скрыты (css/otchet.css) — под отчётом одна строка
    // «Другие инструменты»; «Все инструменты» ведёт на чистую главную к витрине
    var dr = null;
    if (!svoj && doc.querySelector && doc.querySelector('main#top > .hero')) {
      dr = el(doc, 'nav', 'ot-dr', '<p class="ot-dr__h">Другие инструменты</p><ul>' + DRUGIE.map(function (x) {
        return '<li><a href="' + x[1] + '" data-goal="otchet_drugie">' + x[0] + '</a></li>';
      }).join('') + '</ul>');
      dr.setAttribute('aria-label', 'Другие инструменты');
    }

    // всё, что осталось (неизвестные блоки модулей), — в основное, ничего не теряем
    Array.prototype.slice.call(report.children).forEach(function (x) { if (x !== head) main.appendChild(x); });
    if (head.parentNode) head.parentNode.removeChild(head);
    // пустые обёртки (строки светофора, из которых глубина ушла ниже) — убираем, чтобы не было пустых полос
    Array.prototype.slice.call(main.children).forEach(function (x) { if (!x.textContent.trim()) main.removeChild(x); });
    report.innerHTML = '';
    [hd, vd, body, foot, disc, dr].forEach(function (x) { if (x) report.appendChild(x); });
    report.classList.add('ot');
    report.setAttribute('aria-label', svoj ? 'Ваша компания глазами банка и налоговой' : 'Отчёт о проверке контрагента');
    Array.prototype.forEach.call(vd.querySelectorAll('[data-cel]'), function (a) {
      a.addEventListener('click', function () { try { if (window.dlkGoal) dlkGoal(a.getAttribute('data-cel')); } catch (e) {} });
    });
    // «Паспорт 490 ₽ в один шаг»: кнопка Паспорта по состояниям из tarify.json (js/pasport-cta.js); нет модуля — как было
    var pa = vd.querySelector('[data-cel="otchet_pasport"]');
    if (pa && doc.defaultView && doc.defaultView.PasportCta) {
      try { doc.defaultView.PasportCta.mount(pa, { inn: r.company.inn, mesto: 'list', reportId: r.report_id, api: o.api || '', nazvanie: r.company.name_short || r.company.name_full || '' }); } catch (e) { /* кнопка остаётся как была */ }
    }
    // сумма из «Условий сделки» — в досье сделки (шаг 1), в момент нажатия: человек мог вписать её после показа отчёта
    if (pa) pa.addEventListener('click', function () { summaVSsylku(pa, report); });
    if (doc.body) doc.body.classList.add('rezhim-otcheta');
    return true;
  }

  return { razlozhit: razlozhit, indeks: indeks, polnota: polnota, uroven: uroven, tonPolosy: tonPolosy, dejstviya: dejstviya,
    htmlIndeks: htmlIndeks, htmlIndeksIz: htmlIndeksIz, htmlKak: htmlKak, prokrutit: prokrutit, UROVNI: UROVNI, OGOVORKA: OGOVORKA, POD_PILL: POD_PILL,
    pilyulya: pilyulya, PILL_SOKR: PILL_SOKR };
});
;
/* --- /js/lipkaya.js --- */
/* Делоскоп — липкая строка «Что делать завтра утром» (vizual-v3.1b «Инструмент», 18.10.2026).
   Визуал v3 §7, волна 3.1 (в): на телефоне, когда вывод отчёта ушёл за верх экрана, снизу держится одна строка —
   уровень вывода и кнопка «Что делать завтра утром». Кнопка открывает <dialog> с тем же выводом и теми же действиями.
   Новых утверждений нет: текст берётся из уже нарисованного вывода отчёта (Условия сделки / Щит) в момент открытия —
   сумма сделки и «кто кому платит», поменянные выше, попадают в окно как есть. Кнопки окна — ссылки вывода (их цели Метрики те же).
   Шире 600 px строки нет: вывод и так рядом. Нет IntersectionObserver или <dialog> — ничего не делаем. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkLipkaya = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ZAG = 'Что делать завтра утром';
  var UZKO = '(max-width: 600px)';
  var sostoyanie = null; // { bar, dlg, io, ro, report, doc, slushat }

  function tekst(e) { return e ? String(e.textContent || '').replace(/\s+/g, ' ').trim() : ''; }

  // vyvod(report) — что показать: { kratko, abzacy[], ssylki[] } из вывода отчёта; нечего — null.
  // Условия сделки: .usl-t (итог), .usl-r (почему), .usl-a (что сделать). Щит (своя компания): .ot-vt__p.
  // Запасной итог — уровень Индекса (.ot-ix__lv).
  function vyvod(report) {
    var vd = report && report.querySelector && report.querySelector('.ot-vd');
    if (!vd) return null;
    var vt = vd.querySelector('.ot-vt');
    var kratko = tekst(vt && vt.querySelector('.usl-t')) || tekst(vd.querySelector('.ot-ix__lv')) || tekst(vd.querySelector('.ot-pill'));
    var abzacy = [];
    if (vt) {
      ['.usl-t', '.usl-r', '.usl-a', '.ot-vt__p'].forEach(function (s) {
        var t = tekst(vt.querySelector(s));
        if (t && abzacy.indexOf(t) < 0) abzacy.push(t);
      });
    }
    var ssylki = [];
    Array.prototype.forEach.call(vd.querySelectorAll('.ot-act a[href]'), function (a) {
      var t = tekst(a);
      if (t) ssylki.push({ t: t, href: a.getAttribute('href'), glavnaya: a.classList.contains('p'), ist: a });
    });
    if (!kratko && !abzacy.length) return null;
    return { kratko: kratko, abzacy: abzacy, ssylki: ssylki, ton: (vd.className.match(/ot-vd--(\w+)/) || [])[1] || '' };
  }

  function el(doc, tag, cls, txt) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function zapolnitOkno(s) {
    var v = vyvod(s.report), dlg = s.dlg, doc = s.doc;
    var telo = dlg.querySelector('.lip-d__t'), act = dlg.querySelector('.lip-d__act');
    telo.textContent = ''; act.textContent = '';
    if (!v) return false;
    v.abzacy.forEach(function (t, i) { telo.appendChild(el(doc, 'p', i === 0 && v.abzacy.length > 1 ? 'lip-d__itog' : null, t)); });
    v.ssylki.forEach(function (x) {
      var a = el(doc, 'a', 'ot-btn ' + (x.glavnaya ? 'p' : 's'), x.t);
      a.href = x.href;
      if (x.ist.target) { a.target = x.ist.target; a.rel = 'noopener'; }
      // цель Метрики и особое поведение (Паспорт, «Следить») — у ссылки вывода: нажимаем её саму
      a.addEventListener('click', function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
        e.preventDefault();
        try { dlg.close(); } catch (er) {}
        x.ist.click();
      });
      act.appendChild(a);
    });
    return true;
  }

  function obnovitStroku(s) {
    var v = vyvod(s.report);
    var t = s.bar.querySelector('.lip__t');
    t.textContent = v ? v.kratko : '';
    s.bar.setAttribute('data-ton', v ? v.ton : '');
    return !!v;
  }

  // окно cookie внизу экрана — строка садится над ним
  function niz(s) {
    var ck = s.doc.querySelector('.ck-bar'), hgt = 0;
    if (ck && !ck.hidden) hgt = ck.getBoundingClientRect().height;
    s.doc.documentElement.style.setProperty('--lip-niz', Math.round(hgt) + 'px');
  }

  function pokazat(s, da) {
    var w = s.doc.defaultView;
    niz(s);
    var uzko = !!(w.matchMedia && w.matchMedia(UZKO).matches);
    var on = !!(da && uzko && !(s.dlg.open) && obnovitStroku(s));
    s.bar.classList.toggle('is-on', on);
    s.bar.inert = !on;
    s.doc.body.classList.toggle('lip-on', on);
  }

  function snyat() {
    var s = sostoyanie;
    if (!s) return;
    sostoyanie = null;
    try { if (s.io) s.io.disconnect(); if (s.ro) s.ro.disconnect(); } catch (e) {}
    try { if (s.dlg.open) s.dlg.close(); } catch (e) {}
    if (s.bar.parentNode) s.bar.parentNode.removeChild(s.bar);
    if (s.dlg.parentNode) s.dlg.parentNode.removeChild(s.dlg);
    if (s.mq && s.mq.removeEventListener) s.mq.removeEventListener('change', s.naMq);
    s.doc.body.classList.remove('lip-on');
    s.doc.documentElement.style.removeProperty('--lip-niz');
  }

  // mount(report) — после Otchet.razlozhit; повторный вызов (новая проверка) пересобирает строку.
  function mount(report) {
    snyat();
    var doc = report && report.ownerDocument, w = doc && doc.defaultView;
    if (!w || typeof w.IntersectionObserver !== 'function' || typeof w.HTMLDialogElement !== 'function') return false;
    var vd = report.querySelector('.ot-vd');
    if (!vd || !vyvod(report)) return false;

    var bar = el(doc, 'div', 'lip');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', ZAG);
    bar.inert = true;
    var kn = el(doc, 'button', 'lip__b');
    kn.type = 'button';
    kn.setAttribute('aria-haspopup', 'dialog');
    kn.appendChild(el(doc, 'span', 'lip__z', ZAG));
    kn.appendChild(el(doc, 'span', 'lip__t'));
    var str = el(doc, 'span', 'lip__s');
    str.setAttribute('aria-hidden', 'true');
    str.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l5-5 5 5"/></svg>';
    kn.appendChild(str);
    bar.appendChild(kn);

    var dlg = el(doc, 'dialog', 'lip-d');
    dlg.setAttribute('aria-labelledby', 'lip-d-h');
    var h = el(doc, 'h2', 'lip-d__h', ZAG); h.id = 'lip-d-h';
    var zakr = el(doc, 'button', 'lip-d__x', 'Закрыть'); zakr.type = 'button';
    dlg.appendChild(h); dlg.appendChild(el(doc, 'div', 'lip-d__t')); dlg.appendChild(el(doc, 'div', 'lip-d__act')); dlg.appendChild(zakr);

    var s = sostoyanie = { bar: bar, dlg: dlg, report: report, doc: doc, ushel: false };
    kn.addEventListener('click', function () {
      if (!zapolnitOkno(s)) return;
      try { dlg.showModal(); } catch (e) { return; }
      pokazat(s, false);
      try { if (w.dlkGoal) w.dlkGoal('lipkaya_otkryta'); } catch (e) {}
    });
    zakr.addEventListener('click', function () { dlg.close(); });
    // нажатие на затемнение вокруг окна — закрыть (само окно — без отступов, поэтому цель = dialog только снаружи содержимого)
    dlg.addEventListener('click', function (e) {
      if (e.target !== dlg) return;
      var r = dlg.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) dlg.close();
    });
    dlg.addEventListener('close', function () { if (sostoyanie === s) { pokazat(s, s.ushel); kn.focus({ preventScroll: true }); } });

    doc.body.appendChild(bar);
    doc.body.appendChild(dlg);

    // вывод ушёл за верх экрана — строка видна; вернулся или ниже — прячем
    s.io = new w.IntersectionObserver(function (z) {
      var e = z[z.length - 1];
      s.ushel = !e.isIntersecting && e.boundingClientRect.bottom <= 0;
      pokazat(s, s.ushel);
    });
    s.io.observe(vd);
    var ck = doc.querySelector('.ck-bar');
    if (ck && typeof w.ResizeObserver === 'function') {
      s.ro = new w.ResizeObserver(function () { niz(s); });
      s.ro.observe(ck);
    }
    if (w.matchMedia) {
      s.mq = w.matchMedia(UZKO);
      s.naMq = function () { pokazat(s, s.ushel); };
      if (s.mq.addEventListener) s.mq.addEventListener('change', s.naMq);
    }
    return true;
  }

  return { mount: mount, snyat: snyat, vyvod: vyvod, ZAG: ZAG, UZKO: UZKO };
});
;
/* --- /js/svyazi.js --- */
/* Делоскоп — режим «Связи» в отчёте (vizual-v3.2, 18.10.2026; ТЗ v3 §7, волна 3.2).
   Третья вкладка рядом с «Глазами банка / Глазами налоговой» (таблетки строит js/vizual2.js): компания — узел в центре,
   вокруг — руководитель, учредители, адрес, инспекция, филиалы, основной вид деятельности.
   Только то, что уже пришло в ответе /api/check (company, dossier.sections, signals) — слова и числа берём из ответа как есть,
   своих утверждений не добавляем; новых запросов к API нет. ИП — без вкладки (данные ИП не показываем).
   Цвет нити — по признаку из ответа (signals: адрес, «Массовый адрес», «Массовый руководитель»), иначе нейтральный.
   Широкий экран — граф на canvas («камера» поворачивается вокруг компании при открытии и за мышью) + тот же список для
   экранного диктора; ≤ 600 px — список, граф по кнопке. prefers-reduced-motion: reduce — один кадр без поворота.
   Цвета — из --ink/--muted/--accent/--ok/--warn/--bad, при смене темы кадр рисуется заново. Без JS вкладки нет. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.Svyazi = factory(root);
})(typeof self !== 'undefined' ? self : this, function (W) {
  'use strict';
  var d = W && W.document;
  var tiho = !W || !W.matchMedia || !W.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  var TON = { ok: 'ok', warn: 'warn', medium: 'warn', high: 'bad', bad: 'bad', critical: 'bad' };

  function skl(n, a, b, c) { var m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function ton(s) { return (s && TON[s.status]) || 'neutral'; }

  // модель из ответа /api/check: {centr:{zag, pod}, uzly:[{k, zag, znach, pod, ton}]}; null — вкладки нет
  function model(r) {
    var c = r && r.company;
    if (!c || c.kind !== 'LEGAL') return null;
    var sec = {};
    ((r.dossier || {}).sections || []).forEach(function (s) { sec[s.id] = s.rows || []; });
    function ryad(id, re) { return (sec[id] || []).filter(function (x) { return x && re.test(str(x[0])) && str(x[1]); }); }
    var sig = {}, massRuk = null, massAdr = null;
    (r.signals || []).forEach(function (s) {
      if (!s) return;
      sig[s.id] = s;
      if (/^Массовый руководитель/i.test(str(s.title))) massRuk = s;
      if (/^Массовый адрес/i.test(str(s.title))) massAdr = s;
    });
    var uzly = [];
    function dob(k, row, pod, s) {
      if (!row) return;
      uzly.push({ k: k, zag: str(row[0]), znach: str(row[1]), pod: str(pod), ton: s ? ton(s) : 'neutral' });
    }
    // руководство: первая строка — должность и имя (как в «Все данные из реестров»), «Руководит с» — подпись
    var ruk = (sec.management || []).filter(function (x) { return x && str(x[1]) && !/^(Руководит с|Уставный капитал)/i.test(str(x[0])) && !/учредит|участник|акционер|собственник/i.test(str(x[0])); })[0];
    var s1 = ryad('management', /^Руководит с/i)[0];
    if (ruk) dob('rukovoditel', ruk, massRuk ? str(massRuk.detail) : s1 ? s1[0] + ' ' + s1[1] : '', massRuk);
    ryad('management', /учредит|участник|акционер|собственник/i).slice(0, 6).forEach(function (x) { dob('uchreditel', x, '', null); });
    var adr = ryad('profile', /^Юридический адрес/i)[0];
    var sa = massAdr || sig.address;
    if (adr) dob('adres', adr, sa ? str(sa.detail) : '', sa);
    dob('inspekciya', ryad('profile', /^Налоговая инспекция/i)[0], '', null);
    dob('vid', ryad('activity', /^Основной вид деятельности/i)[0], '', null);
    dob('filialy', ryad('profile', /^Филиалы/i)[0], '', null);
    // vizual-v3.2b: связи из реестров DaMIA — арбитражные суды, приставы, госзаказ, РНП; только где источник ответил и есть что показать.
    // Подпись — «итог» ответа слово в слово (в нём источник и дата), число — из ответа; не ответил — узла нет (не проверяли ≠ не нашли)
    function dm(k) {
      var b = (r.damia || {})[k];
      return b && /^(polucheno|found|not_found|provereno)$/.test(b.status) && b.dannye && typeof b.dannye === 'object' && !b.iz_egryul ? b : null;
    }
    function chislo(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
    var istD = [], KRATKO = { sudy: 'картотека арбитражных дел', fssp: 'ФССП', kontrakty: 'ЕИС', rnp: 'РНП ЕИС' };
    function dmUzel(k, b, n, slova, tn) {
      uzly.push({ k: k, zag: str(b.nazvanie), znach: chislo(n) + ' ' + slova, pod: str(b.itog), ton: tn });
      var dd = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(b.data_svedeniy));
      istD.push(KRATKO[k] + (dd ? ' на ' + dd[3] + '.' + dd[2] + '.' + dd[1] : ''));
    }
    var su = dm('sudy'), fs = dm('fssp'), kt = dm('kontrakty'), rn = dm('rnp');
    if (su && +su.dannye.vsego > 0) dmUzel('sudy', su, +su.dannye.vsego, skl(+su.dannye.vsego, 'дело', 'дела', 'дел') + ' в картотеке', +su.dannye.otvetchik_nezaversheno > 0 ? 'warn' : 'neutral');
    if (fs && +fs.dannye.otkryto > 0) dmUzel('fssp', fs, +fs.dannye.otkryto, skl(+fs.dannye.otkryto, 'открытое производство', 'открытых производства', 'открытых производств'), 'warn');
    if (kt && +kt.dannye.vsego > 0) dmUzel('kontrakty', kt, +kt.dannye.vsego, skl(+kt.dannye.vsego, 'контракт', 'контракта', 'контрактов'), 'neutral');
    if (rn && +rn.dannye.vsego > 0) dmUzel('rnp', rn, +rn.dannye.vsego, skl(+rn.dannye.vsego, 'запись', 'записи', 'записей') + ' в реестре', 'bad');
    if (uzly.length < 2) return null;
    // дата сведений ЕГРЮЛ — день получения (fetched_at / checked_at), а не state_actuality_date: та — последнее изменение записи (урок kartochki-daty-v2)
    var ist = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(c.fetched_at || r.checked_at));
    return { centr: { zag: str(c.name_short || c.name_full), pod: c.inn ? 'ИНН ' + c.inn : '' }, uzly: uzly,
      ist: 'Связи — из сведений этого отчёта: ЕГРЮЛ' + (ist ? ' на ' + ist[3] + '.' + ist[2] + '.' + ist[1] : '') + (istD.length ? ', ' + istD.join(', ') : '') +
        '. Другие компании руководителя и учредителей покажем, когда загрузим ЕГРЮЛ целиком: неполную картину за полную не выдаём.' };
  }

  // ---------- рисование ----------
  function cveta(el) {
    var cs = W.getComputedStyle(el);
    function v(n, z) { return (cs.getPropertyValue(n) || '').trim() || z; }
    return { ink: v('--ink', '#1D1D1F'), muted: v('--muted', '#6B6B70'), accent: v('--accent', '#0B63E5'),
      soft: v('--accent-soft', '#EAF1FD'), line: v('--line', '#E6E6E1'), surface: v('--surface', '#FFFFFF'),
      ok: v('--ok', '#16723F'), warn: v('--warn', '#9A5B00'), bad: v('--bad', '#B3261E'), font: cs.fontFamily || 'sans-serif' };
  }
  // строки подписи не шире w (не больше 2; длинное — с «…», полный текст — в списке)
  function stroki(cx, t, w) {
    var sl = t.split(/\s+/), out = [], cur = '';
    for (var i = 0; i < sl.length; i++) {
      var p = cur ? cur + ' ' + sl[i] : sl[i];
      if (cx.measureText(p).width <= w || !cur) cur = p; else { out.push(cur); cur = sl[i]; if (out.length === 2) break; }
    }
    if (out.length < 2 && cur) out.push(cur); else if (out.length === 2 && i < sl.length) out[1] += '…';
    return out.slice(0, 2);
  }
  // один кадр: phi — угол «камеры» вокруг компании (0 — фронт); w, h — CSS-пиксели
  function kadr(cx, m, w, h, phi, C) {
    cx.clearRect(0, 0, w, h);
    // подписи не выходят за холст: ширина подписи lw, кольцо — что осталось; название компании — строкой сверху
    var n = m.uzly.length, lw = Math.min(170, w * 0.3), ox = w / 2, oy = h / 2 + 14, rx = Math.max(24, Math.min(w / 2 - lw - 22, 300)), ry = Math.min(h * 0.34, 120);
    var P = m.uzly.map(function (u, i) {
      var a = phi + (i + 0.5) * 6.2832 / n, z = Math.cos(a); // z: 1 — ближе к зрителю
      return { u: u, x: ox + rx * Math.sin(a), y: oy + ry * z * 0.75, z: z, s: 0.8 + 0.2 * (z + 1) / 2 }; // ближние — ниже: камера чуть сверху
    });
    P.sort(function (a, b) { return a.z - b.z; });
    // орбита — пунктирный эллипс: глубина видна и в кадре без движения (vizual-v3.2b)
    cx.globalAlpha = 0.25; cx.strokeStyle = C.muted; cx.lineWidth = 1; cx.setLineDash([2, 5]);
    cx.beginPath(); cx.ellipse(ox, oy, rx, ry * 0.75, 0, 0, 6.2832); cx.stroke(); cx.setLineDash([]);
    cx.lineWidth = 1.5;
    P.forEach(function (p) { // нити
      cx.globalAlpha = 0.35 + 0.45 * (p.z + 1) / 2;
      cx.strokeStyle = p.u.ton === 'neutral' ? C.muted : C[p.u.ton];
      cx.beginPath(); cx.moveTo(ox, oy); cx.lineTo(p.x, p.y); cx.stroke();
    });
    cx.globalAlpha = 1;
    // компания
    cx.fillStyle = C.surface; cx.strokeStyle = C.accent; cx.lineWidth = 2;
    cx.beginPath(); cx.arc(ox, oy, 22, 0, 6.2832); cx.fill(); cx.stroke();
    cx.textAlign = 'center'; cx.textBaseline = 'top';
    cx.font = '600 14px ' + C.font; cx.fillStyle = C.ink;
    stroki(cx, m.centr.zag, w - 32)[0] && cx.fillText(stroki(cx, m.centr.zag, w - 32)[0], ox, 10);
    P.forEach(function (p) {
      var al = 0.45 + 0.55 * (p.z + 1) / 2, lev = p.x < ox - 4, x = p.x + (lev ? -12 : 12) * p.s;
      cx.globalAlpha = al;
      cx.fillStyle = p.u.ton === 'neutral' ? C.muted : C[p.u.ton];
      cx.beginPath(); cx.arc(p.x, p.y, 6 * p.s, 0, 6.2832); cx.fill();
      cx.textAlign = lev ? 'right' : 'left'; cx.textBaseline = 'middle';
      cx.font = '500 11px ' + C.font; cx.fillStyle = C.muted;
      cx.fillText(stroki(cx, p.u.zag, lw)[0], x, p.y - 15);
      cx.font = '500 13px ' + C.font; cx.fillStyle = C.ink;
      stroki(cx, p.u.znach, lw).forEach(function (t, j) { cx.fillText(t, x, p.y + 1 + j * 15); });
    });
    cx.globalAlpha = 1;
  }

  // ---------- панель ----------
  function el(t, c, txt) { var e = d.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  function spisok(m) {
    var ul = el('ul', 'svz__sp');
    m.uzly.forEach(function (u) {
      var li = el('li', 'svz__u svz__u--' + u.ton);
      li.appendChild(el('span', 'svz__zag', u.zag));
      li.appendChild(el('b', 'svz__zn', u.znach));
      if (u.pod) li.appendChild(el('small', 'svz__pod', u.pod));
      ul.appendChild(li);
    });
    return ul;
  }
  function panel(rep) {
    if (rep.dlkSvzPanel) return rep.dlkSvzPanel;
    var m = rep.dlkSvz, p = el('div', 'svz'), cv = el('canvas', 'svz__cv'), cx = cv.getContext && cv.getContext('2d');
    cv.setAttribute('aria-hidden', 'true');
    var kn = el('button', 'svz__kn', 'Показать граф'); kn.type = 'button'; kn.setAttribute('aria-expanded', 'false');
    p.appendChild(kn); if (cx) p.appendChild(cv); p.appendChild(spisok(m));
    if (m.ist) p.appendChild(el('p', 'svz__ist', m.ist)); // источник и дата — видно и под графом, и под списком
    if (!cx) kn.hidden = true;
    var phi = 0, cel = 0, idet = 0, C = null, w = 0, h = 0;
    function razmer() {
      var r = cv.getBoundingClientRect(), dpr = Math.min(2, W.devicePixelRatio || 1);
      w = Math.round(r.width); h = Math.round(r.height);
      if (!w || !h) return false;
      cv.width = w * dpr; cv.height = h * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }
    function risovat() { if (cx && p.isConnected && (w || razmer())) { C = C || cveta(p); kadr(cx, m, w, h, phi, C); } }
    function petlya() {
      if (idet) return;
      idet = W.requestAnimationFrame(function shag() {
        var dl = cel - phi;
        phi += dl * 0.12;
        if (Math.abs(dl) < 0.002) phi = cel;
        risovat();
        idet = phi !== cel && p.isConnected ? W.requestAnimationFrame(shag) : 0;
      });
    }
    // открыть: камера поворачивается вокруг компании на четверть оборота к фронту
    p.svzPusk = function () {
      w = 0; C = null;
      if (!razmer()) return;
      if (tiho) { phi = cel = 0; risovat(); return; }
      phi = -1.5708; cel = 0; petlya();
    };
    p.svzKadr = risovat;
    kn.addEventListener('click', function () {
      var on = p.classList.toggle('svz--graf');
      kn.setAttribute('aria-expanded', on ? 'true' : 'false');
      kn.textContent = on ? 'Скрыть граф' : 'Показать граф';
      if (on) p.svzPusk();
    });
    if (!tiho && W.matchMedia && W.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      cv.addEventListener('pointermove', function (e) {
        var r = cv.getBoundingClientRect();
        cel = ((e.clientX - r.left) / r.width - 0.5) * 0.9; petlya();
      }, { passive: true });
      cv.addEventListener('pointerleave', function () { cel = 0; petlya(); });
    }
    W.addEventListener('resize', function () { if (p.isConnected) { w = 0; risovat(); } });
    if (W.MutationObserver) new W.MutationObserver(function () { C = null; risovat(); })
      .observe(d.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    rep.dlkSvzPanel = p;
    return p;
  }

  return {
    model: model,
    _kadr: kadr,
    // index.html: после отрисовки отчёта — модель на узел отчёта (повторная проверка — новая модель и новая панель)
    zapomnit: function (rep, r) { if (!rep) return; rep.dlkSvz = model(r); rep.dlkSvzPanel = null; },
    est: function (f) { var rep = f && f.closest && f.closest('.report'); return !!(rep && rep.dlkSvz); },
    // vizual2: оборот «Связи» — панель в оборот; zhivo — вкладку открыли (не замер высоты)
    pokazat: function (spis, f, zhivo) {
      var rep = f.closest('.report'); if (!rep || !rep.dlkSvz) return;
      var p = panel(rep);
      if (p.parentNode !== spis) spis.appendChild(p);
      if (zhivo) p.svzPusk(); else p.svzKadr();
    },
    ubrat: function (spis) { var p = spis.querySelector(':scope > .svz'); if (p) spis.removeChild(p); }
  };
});
;
/* --- /js/nedavnie.js --- */
/* Делоскоп — «Недавние проверки» на этом устройстве.
   Хранится только в браузере человека (localStorage), на сервер не уходит.
   Нет доступа к хранилищу (приватный режим, запрет cookies) — список просто пустой. */
(function (w) {
  'use strict';
  var KEY = 'dlk_nedavnie', MAX = 5;
  var LVL = { low: 'Без серьёзных сигналов', medium: 'Есть вопросы', high: 'Есть серьёзные сигналы' };

  function read() {
    try {
      var a = JSON.parse(w.localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a.filter(function (x) { return x && /^\d{10}(\d{2})?$/.test(x.inn); }) : [];
    } catch (e) { return []; }
  }
  function write(a) { try { w.localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }

  function add(r) {
    if (!r || !/^\d{10}(\d{2})?$/.test(String(r.inn || '')) || /^0+$/.test(r.inn)) return;
    var item = {
      inn: String(r.inn),
      name: String(r.name || '').slice(0, 160),
      level: LVL[r.level] ? r.level : '',
      id: /^[A-Za-z0-9_-]{8,24}$/.test(r.id || '') ? r.id : '',
      t: Date.now()
    };
    var a = read().filter(function (x) { return x.inn !== item.inn; });
    a.unshift(item);
    write(a.slice(0, MAX));
  }

  // kavychki-v1: старые записи на устройстве — с прямыми кавычками из ЕГРЮЛ; показываем «ёлочками» (js/imya.js)
  function kav(t) { return w.DlkImya ? w.DlkImya.kavychki(t) : t; }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function when(t) {
    try { return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); } catch (e) { return ''; }
  }

  /* Рисует список в el. Пустой список — el скрывается. Возвращает число записей. */
  function render(el) {
    if (!el) return 0;
    var a = read();
    if (!a.length) { el.hidden = true; el.innerHTML = ''; return 0; }
    el.hidden = false;
    el.innerHTML = '<h2 class="ned__h">Недавние проверки на этом устройстве</h2><ul class="ned__list">' +
      a.map(function (x) {
        var href = x.id ? '/report.html?id=' + encodeURIComponent(x.id) : '/?inn=' + encodeURIComponent(x.inn);
        return '<li><a href="' + href + '"><b>' + esc(x.name ? kav(x.name) : ('ИНН ' + x.inn)) + '</b>' +
          '<span>ИНН ' + esc(x.inn) + (x.t ? ' · ' + esc(when(x.t)) : '') + '</span></a>' +
          (x.level ? '<i class="ned__lvl ned__lvl--' + x.level + '">' + LVL[x.level] + '</i>' : '') + '</li>';
      }).join('') + '</ul><button type="button" class="ned__clear">Очистить список</button>';
    el.querySelector('.ned__clear').onclick = function () { write([]); render(el); };
    return a.length;
  }

  w.Nedavnie = { add: add, list: read, render: render, KEY: KEY };
})(window);
;
