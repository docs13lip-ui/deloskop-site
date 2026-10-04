/* Делоскоп — «Только существенные факты» и свёрнутая «Все данные из реестров» на экране проверки по ИНН
 * (решение владельца 02.10, эталон экрана — п. 2 и п. 6: claude/Решения_владельца_02.10_лучший_сайт_проверки_приоритеты.md).
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
  var PORYADOK = ['status', 'address', 'tax_debt', 'kapital', 'likvidnost', 'ubytki', 'otchetnost', 'rukovoditel', 'age', 'zsk'];
  var NAZV = { status: 'Статус', address: 'Отметки о недостоверности', age: 'На рынке', tax_debt: 'Долги по налогам' };
  var SEKCII = { profile: 'reestr', history: 'reestr', management: 'reestr', activity: 'reestr', taxes: 'ФНС, открытые данные', dynamics: 'ГИР БО ФНС, годовая бухгалтерская отчётность' };
  var KRATKO = { sudy: 'арбитражные суды', bankrotstvo: 'банкротство', fssp: 'приставы', priostanovki: 'приостановки счетов', mery: 'обеспечительные меры ФНС', rnp: 'РНП', kontrakty: 'госконтракты' };
  var DAMIA_PORYADOK = ['sudy', 'bankrotstvo', 'fssp', 'priostanovki', 'mery', 'rnp', 'kontrakty'];

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
      // [Право] 02.10: не «Нет», а «Нет в списке ФНС на [дата]»; набор старше 3 месяцев — как непроверенный
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

    var o = otchetnost(r);
    if (!fl) {
      if (o) {
        var pr = o.pribyl == null ? '' : o.pribyl < 0 ? ' · убыток ' + dengi(-o.pribyl) : ' · прибыль ' + dengi(o.pribyl);
        add({ k: 'otchetnost', nazv: 'Выручка за ' + o.god, znach: dengi(o.vyruchka) + pr, ton: 'neutral', ist: 'ГИР БО ФНС', data: '31.12.' + o.god });
      } else if (bank(c)) {
        // банк сдаёт отчётность в Банк России; в ГИР БО её передаёт Банк России (ч. 9 ст. 18 402-ФЗ), доступ может быть
        // ограничен (ч. 12; v1.1 — [Право] 04.10 12:30 разд. 1). Есть она в ответе — считаем как у всех (ветка выше); нет — пишем, как устроено, без «её нет».
        // Текст — [Право · Налоговый] 04.10 11:30 разд. 1.4 дословно.
        add({ k: 'otchetnost', nazv: 'Бухотчётность', znach: BANK_GIRBO, ton: 'neutral',
          ist: reestr + ', ОКВЭД ' + c.okved, data: dataPr, ssylka: CBR_BANK + (/^\d{13}$/.test(String(c.ogrn || '')) ? '?ogrn=' + c.ogrn : '') });
      } else {
        // «Почему так бывает» — статья о законных причинах (net-otchetnosti-v1, ТЗ [Продукт · Маркетинг] 04.10 10:50 разд. 2):
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
      var estRuk = (r.signals || []).some(function (s) { return s && /director|rukovod/i.test(s.id || ''); });
      var ot = dataIz(c.director_since);
      if (!estRuk && ot) {
        var mr = mesyacev(ot, na);
        if (mr != null) add({ k: 'rukovoditel', nazv: 'Руководитель', ton: mr < 6 ? 'warn' : 'ok',
          znach: (mr < 12 ? 'Сменился ' + srok(mr) + ' назад' : 'Не менялся ' + srok(mr)) + ' · с' + NB + dmy(c.director_since),
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
      var pa = PORYADOK.indexOf(a.k), pb = PORYADOK.indexOf(b.k);
      return (pa < 0 ? -1 : pa) - (pb < 0 ? -1 : pb); // незнакомые признаки API — раньше базовых
    });

    var ne = [];
    var dm = r.damia || {};
    DAMIA_PORYADOK.concat(Object.keys(dm).filter(function (k) { return DAMIA_PORYADOK.indexOf(k) < 0; })).forEach(function (k) {
      var b = dm[k];
      if (!b || typeof b !== 'object' || !b.nazvanie || !b.status) return;
      if (b.status === 'found') {
        add({ k: 'damia_' + k, nazv: b.nazvanie, znach: b.itog || b.znachenie || 'Сведения найдены',
          ton: b.uroven === 'bad' || b.uroven === 'high' ? 'bad' : 'warn', ist: b.istochnik || '', data: dmy(b.data_svedeniy) || dataPr });
        var f = vse.pop(); // найденное — среди первых
        var i = 0; while (i < vse.length && VES[vse[i].ton] <= VES[f.ton]) i++;
        vse.splice(i, 0, f);
      } else if (b.status !== 'not_found' && b.status !== 'not_applicable') {
        ne.push({ k: k, nazv: b.nazvanie, kratko: KRATKO[k] || b.nazvanie, prichina: b.prichina || '', sam: b.proverit_samim || '' });
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
      else v = 'Не проверяли' + (b.prichina ? ': ' + b.prichina : '');
      reestry.push([b.nazvanie, v, t, b.status !== 'found' && b.status !== 'not_found' ? (b.proverit_samim || '') : '', b.istochnik || '']);
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

  // ---- разметка ----
  function rowHtml(x) {
    var meta = [x.ist, x.data ? 'на' + NB + x.data : ''].filter(Boolean).join(' · ');
    return '<div class="row sut__r" data-fakt="' + esc(x.k) + '"><span>' + esc(x.nazv) +
      '<small>' + esc(meta) + (x.ssylka ? ' · <a href="' + esc(x.ssylka) + '" target="_blank" rel="noopener">проверить в' + NB + 'ЦБ</a>' : '') +
      (x.spravka ? ' · <a href="' + esc(x.spravka) + '" data-goal="' + esc(x.spravkaCel || 'statusy_iz_proverki') + '">' + esc(x.spravkaT) + '</a>' : '') + '</small></span>' +
      '<b class="d ' + x.ton + '">' + nwFz(esc(x.znach)) + '</b></div>';
  }
  function glubinaHtml(g, podpis, dop) {
    if (!g.razdely.length) return '';
    var n = g.razdely.length;
    return '<details class="sut__g"><summary><span>Все данные из реестров</span><small>' + (podpis || n + NB + skl(n, 'раздел', 'раздела', 'разделов')) + '</small></summary>' + (dop || '') +
      g.razdely.map(function (s) {
        return '<section class="sut__s"><h4>' + esc(s.zag) + '</h4><dl>' + s.stroki.map(function (row) {
          var dop = row[4] ? '<small>' + esc(row[4]) + '</small>' : '';
          var sam = row[3] ? ' <a href="' + esc(row[3]) + '" target="_blank" rel="noopener">проверьте сами</a>' : '';
          return '<div><dt>' + esc(row[0]) + dop + '</dt><dd' + (row[2] && row[2] !== 'neutral' ? ' class="' + row[2] + '"' : '') + '>' + esc(row[1]) + sam + '</dd></div>';
        }).join('') + '</dl>' + (s.ist ? '<p>Источник: ' + esc(s.ist) + '</p>' : '') + '</section>';
      }).join('') +
      (g.daty ? '<p class="sut__d">Даты наборов: ' + esc(g.daty) + '</p>' : '') + '</details>';
  }
  function html(r) {
    var f = fakty(r);
    if (!f.spisok.length) return '';
    var pr = f.neProvereno.map(function (x) { return x.prichina; });
    var odna = pr[0] && pr.every(function (x) { return x === pr[0]; }) ? ' — ' + pr[0] : '';
    var ne = f.neProvereno.length ? '<p class="sut__ne">Не проверяли в этот раз: ' +
      esc(f.neProvereno.map(function (x) { return x.kratko; }).join(', ') + odna) +
      '. Не проверено — не значит «не обнаружено»; ссылки, где проверить самим, — в разделе «Все данные из реестров».</p>' : '';
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
    var ne = f.neProvereno.length ? '<p class="sut__ne">Не проверяли в этот раз: ' +
      esc(f.neProvereno.map(function (x) { return x.kratko; }).join(', ')) +
      '. Не проверено — не значит «не обнаружено»; ссылки, где проверить самим, — в разделе «Внешние реестры».</p>' : '';
    return glubinaHtml({ razdely: razdely, daty: g.daty },
      n + NB + skl(n, 'признак', 'признака', 'признаков') + ' · ' + m + NB + skl(m, 'раздел', 'раздела', 'разделов'), ne);
  }

  var CSS = '.sut__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px;padding-bottom:10px}' +
    '.sut__h b{font-size:15px;font-weight:600}.sut__h span{font-size:13px;color:var(--muted,#6B6B70)}' +
    '.sut__r>span{display:block}.sut__r small{display:block;margin-top:2px;font-size:12px;color:var(--muted,#6B6B70);font-weight:400}' +
    '.sut__r small a{color:inherit;text-decoration:underline}' +
    '.sut__ne{margin:0;padding:12px 0 0;border-top:1px solid #EFEFEA;font-size:13px;color:var(--ink2,#48484C)}' +
    '.sut__g{margin-top:12px;border:1px solid var(--line,#E6E6E1);border-radius:14px;padding:0 16px}' +
    '.sut__g summary{cursor:pointer;display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:14px 0;font-size:15px;font-weight:600;list-style:none}' +
    '.sut__g summary::-webkit-details-marker{display:none}' +
    '.sut__g summary span::after{content:"";display:inline-block;width:7px;height:7px;margin-left:10px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-3px) rotate(45deg);transition:transform .2s}' +
    '.sut__g[open] summary span::after{transform:translateY(0) rotate(225deg)}' +
    '.sut__g summary small{font-size:13px;font-weight:400;color:var(--muted,#6B6B70)}' +
    '.sut__s{padding:4px 0 14px;border-top:1px solid #EFEFEA}.sut__s h4{margin:12px 0 6px;font-size:14px;font-weight:600}' +
    '.sut__s dl{margin:0;display:grid}.sut__s dl div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:12px;padding:6px 0;font-size:14px}' +
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
  function mount(el, r) {
    if (!el) return false;
    var h = '';
    try { h = html(r); } catch (e) { h = ''; }
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

  return { razryady: razryady, fakty: fakty, bank: bank, kapital: kapital, likvidnost: likvidnost, ubytki: ubytki, glubina: glubina, otchetnost: otchetnost, html: html, mount: mount, htmlSvoj: htmlSvoj, mountSvoj: mountSvoj, dengi: dengi, srok: srok, MAKS: MAKS, CSS: CSS };
});
