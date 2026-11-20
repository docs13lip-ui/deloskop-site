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
  // signal-id-v1 (Master 30.10, «Архитектура»): правило зависит от стабильного кода признака, а не от текста заголовка.
  // Порядок: (1) s.signal_id / s.rule_id — код признака, когда API начнёт его отдавать; неизвестный код → 'other'
  // (признак не теряется и не угадывается по тексту); (2) s.id из ответа /api/check, если он однозначен
  // (tax_debt, employees, age, mass_address…); (3) совместимый адаптер — прежние регулярные выражения по заголовку,
  // только для общих id (status, address, management, mass) и признаков без id. Для нынешних ответов API результат
  // побайтно прежний (сторож tests/signal_id.test.js), а переименование заголовка признака с однозначным id правило не меняет.
  // Вид (kind) — группа для «Условий сделки» и «Щита»; signal_id — сам признак (mass_address ≠ mass_dir).
  var SIGNALY = [
    // [signal_id, вид, выражение по заголовку — только для адаптера]
    ['bankrotstvo', 'exit', /банкрот/i],
    ['likvidaciya', 'exit', /ликвидац|ликвидир/i],
    ['reorganizaciya', 'exit', /реорганиз/i],
    ['prekrashchena', 'exit', /прекращ/i],
    ['diskvalifikaciya', 'diskv', /дисквалиф/i],
    ['nedostovernost', 'nedost', /недостоверн/i],
    ['priostanovka', 'block', /приостановл|блокировк[аи]? (операц|сч)|решени[ея] о приостан/i],
    ['mass_address', 'mass', /массов\S*\s+адрес/i],
    ['mass_dir', 'mass', /массов\S*\s+(руковод|директор)/i],
    ['mass_uchr', 'mass', /массов\S*\s+учредит/i],
    ['massovyj', 'mass', /массов/i],
    ['fssp', 'fssp', /пристав|исполнительн|фссп/i],
    ['rnp', 'rnp', /недобросовестн.*поставщ|\bрнп\b/i],
    ['tax_debt', 'dolg', /(задолженн|долг)\S*.*(налог|бюджет)|недоимк/i],
    ['dolg', 'dolg', /задолженн|недоимк|долг/i],
    ['rukovoditel', 'director', /руководител|директор/i],
    ['shtat', 'staff', /численност|сотрудник|штат/i],
    ['otchetnost', 'report', /отч[её]тност|не сда/i],
    ['nalog_nagruzka', 'nagruzka', /нагрузк|налоги.*уплач|уплачен.*налог/i],
    ['shtrafy', 'fines', /правонаруш|штраф/i],
    ['vozrast', 'young', /молод|зарегистрир|возраст/i]
  ];
  var VID = {}; SIGNALY.forEach(function (x) { VID[x[0]] = x[1]; });
  // однозначные id ответа /api/check → signal_id (общие status, address, management, mass, dynamics — через адаптер)
  var IZ_API = {
    tax_debt: 'tax_debt', employees: 'shtat', age: 'vozrast',
    mass_address: 'mass_address', massovyj_adres: 'mass_address', mass_dir: 'mass_dir', massovyj_rukovoditel: 'mass_dir',
    fssp: 'fssp', rnp: 'rnp', nedostovernost: 'nedostovernost', bankrotstvo: 'bankrotstvo', likvidaciya: 'likvidaciya',
    reorganizaciya: 'reorganizaciya', diskvalifikaciya: 'diskvalifikaciya', priostanovki: 'priostanovka', shtrafy: 'shtrafy'
  };
  // Прежний набор видов — для kindOf(строка): порядок проверки тот же, что был до signal-id-v1
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
  function poTekstu(title) {
    var t = String(title || ''), k = 'other', i;
    for (i = 0; i < KINDS.length; i++) if (KINDS[i][1].test(t)) { k = KINDS[i][0]; break; }
    if (k === 'other') return { id: null, kind: 'other' };
    // signal_id — первый признак этого вида, чей текст совпал (вид — всегда прежний)
    for (i = 0; i < SIGNALY.length; i++) if (SIGNALY[i][1] === k && SIGNALY[i][2].test(t)) return { id: SIGNALY[i][0], kind: k };
    return { id: null, kind: k };
  }
  // signalId(s) → { id: signal_id | null, kind, po: 'kod' | 'id' | 'tekst' }
  function signalId(s) {
    s = s || {};
    var kod = s.signal_id || s.rule_id;
    if (kod != null && String(kod).trim()) {
      kod = String(kod).trim();
      return { id: kod, kind: VID[kod] || 'other', po: 'kod' };
    }
    var a = s.id != null ? IZ_API[String(s.id)] : null;
    if (a) return { id: a, kind: VID[a], po: 'id' };
    var t = poTekstu(s.title);
    return { id: t.id, kind: t.kind, po: 'tekst' };
  }
  // kindOf: признак целиком (по коду) или, как раньше, строка заголовка
  function kindOf(x) {
    if (x && typeof x === 'object') return signalId(x).kind;
    return poTekstu(x).kind;
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
    // predel-staraya-v1: год проверки — для правила «выручка старше двух лет» (неперечисляемое: снимки JSON прежние)
    Object.defineProperty(f, 'godProverki', { value: godProverki(r), enumerable: false, writable: true });
    (r.signals || []).forEach(function (s) {
      if (s.status !== 'bad' && s.status !== 'warn') {
        if (signalId(s).id === 'shtat' || /численност|сотрудник/i.test(s.title || '')) { var z = num(s.detail); if (z != null) f.staff = z; }
        return;
      }
      var si = signalId(s), k = si.kind;
      // predel-staraya-v1 (юристы 19.11 вечер разд. 1 (5)): долг по налогам меньше 500 ₽ — не причина вывода и не замечание:
      // тон, предел и причины от него не зависят; справочно — строкой под выводом (NALOG_OSTATOK) и в «Плюсах и минусах»
      var ost = si.id === 'tax_debt' ? nalogOstatok(r, s) : null;
      if (ost) { Object.defineProperty(f, 'nalogOstatok', { value: ost, enumerable: false, writable: true }); return; }
      f[s.status][k] = (f[s.status][k] || 0) + 1;
      var el = { kind: k, status: s.status, title: s.title || '', detail: s.detail || '' };
      // signal_id — неперечисляемое поле: сохранённые выводы, экспорт и снимки (JSON) побайтно прежние
      Object.defineProperty(el, 'sid', { value: si.id, enumerable: false });
      f.list.push(el);
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
    // zapros-glavnoe-v1 (18.11): приставы и приостановки сервер отдаёт блоком damia, а не сигналом — без этого
    // «Что запросить у них» молчал о производствах на миллионы (живой /api/check: сигналов fssp и priostanovki нет).
    // Только для списка документов: тон, предел и вывод не меняются. Точный ноль у приставов (неимущественные) — не «погашение».
    var dm = (r && r.damia) || {}, dn = (dm.fssp && dm.fssp.dannye) || {};
    if (dmNajdeno(dm.fssp) && !(dn.ostatok === 0 && dn.ostatok_tochno === true)) f.zaprosFssp = true;
    if (dmNajdeno(dm.priostanovki)) f.zaprosBlock = true;
    // pravo-sdelka-v1 (юристы 19.11 разд. 4): идущие дела, где компания — ответчик, — пояснение по ним в «Что запросить у них»
    var ds = (dm.sudy && dm.sudy.dannye) || {};
    if (dmNajdeno(dm.sudy) && Number(ds.otvetchik_nezaversheno) > 0) f.zaprosSudy = true;
    return f;
  }
  // Сумма недоимки меньше порога — { summa, data } (как js/plyusy-minusy.js: из «Денег на кону», иначе из начала detail), иначе null
  var OSTATOK_DO = 500;
  function nalogOstatok(r, s) {
    var L = r && r.dengi && Array.isArray(r.dengi.sostavlyayushchie) ? r.dengi.sostavlyayushchie : [], x = null, d = null;
    for (var i = 0; i < L.length; i++) if (L[i] && L[i].vid === 'nedoimka' && num(L[i].summa) !== null) { x = num(L[i].summa); d = L[i].data_nabora || null; break; }
    if (x === null) { var m = /^[\d\s\u00a0,]+₽/.exec(String(s && s.detail || '')); if (m) x = num(m[0].replace(/\s/g, '')); }
    if (x === null || !(x > 0) || x >= OSTATOK_DO) return null;
    return { summa: x, data: (s && s.as_of) || d };
  }
  function dmNajdeno(b) {
    if (!b || typeof b !== 'object') return false;
    var s = b.status;
    if (s === 'polucheno' || s === 'ne_provereno' || !s) s = b.sostoyanie;
    return s === 'found';
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
  // Версия правила предела ([команда] 30.10: сохранённые отчёты молча не меняем — у вывода есть версия правила и дата).
  // usloviya-2026-11-20 — predel-staraya-v1: выручка старше двух лет → предел не считаем (staraya); налог < 500 ₽ — не замечание.
  // usloviya-2026-10-30 — doverie-v1: «выручка и возраст неизвестны» → insufficient_data вместо потолка 1 000 000 ₽;
  // УСН «доходы» → «зависит от статуса по НДС», а не «риск нулевой».
  var PRAVILO = 'usloviya-2026-11-20';
  var DELITEL = 26;                                        // две недели выручки: 52 недели / 2
  var MINIMUM = 10000;                                     // предел меньше — числа нет, «советуем платить по факту» (malo)
  var POTOLKI = [[6, 100000], [12, 300000], [36, 1000000], [Infinity, 3000000]]; // [младше N мес, потолок]
  function potolok(m) { if (m == null) return null; for (var i = 0; i < POTOLKI.length; i++) if (m < POTOLKI[i][0]) return POTOLKI[i][1]; return 3000000; }

  function prepayCap(f, t, np) {
    if (t === 'post' || t === 'stop') return { cap: 0, rule: t === 'stop' ? 'Вперёд не платить' : 'Оплата только по факту', raschet: { tone: t } };
    if (f.finorg) return { cap: null, finorg: true, rule: 'предел не считаем — банк или страховая организация', raschet: { tone: t, base: 'finorg' } };
    // doverie-v1 ([команда] 30.10, п. 1): выручка и возраст неизвестны — положительного предела
    // из одних неизвестных не выводим. cap = null («не посчитано») — не 0 ₽ (у нуля своё основание) и не потолок 1 000 000 ₽.
    if (!f.revenue && !f.vyruchkaNol && f.ageMonths == null) {
      return { cap: null, nedostatochno: true, rule: 'предел не считаем — выручка и возраст компании неизвестны', raschet: { tone: t, base: 'insufficient_data' } };
    }
    var byAge = potolok(f.ageMonths);
    var cap, rule, R = { tone: t, byAge: byAge, ageMonths: f.ageMonths, revenue: f.revenue || null, revenueYear: f.revenueYear || null };
    if (f.vyruchkaNol) {                                   // отчёт сдан, выручки нет: две недели нулевой выручки — 0 ₽
      R.base = 'nol'; R.otchetGod = f.otchetGod || null; R.malo = true; R.itog = 0;
      return { cap: 0, malo: true, rule: 'отчёт сдан, выручки в нём нет — две недели нулевой выручки: 0 ₽, советуем платить по факту', raschet: R };
    }
    // predel-staraya-v1 (юристы 19.11 вечер разд. 1 (2)): выручка старше двух лет (год проверки − год выручки > 2) — числа
    // предела не даём: сумма из старых цифр читается как наш расчёт на сегодня. Было (predel-chestno-v1) — «предварительно, по ней».
    if (f.revenue && f.revenueYear && f.godProverki - +f.revenueYear > STARAYA_LET) {
      return { cap: null, nedostatochno: true, staraya: +f.revenueYear, rule: STARAYA_TEKST(+f.revenueYear, false), raschet: { tone: t, base: 'staraya', revenueYear: +f.revenueYear } };
    }
    if (f.revenue) {
      cap = f.revenue / DELITEL; rule = 'не больше двух недель выручки компании'; R.base = 'revenue'; R.dveNedeli = cap;
      if (f.ageMonths != null && f.ageMonths < 12 && byAge < cap) { cap = byAge; rule = 'потолок для компании младше года'; R.ageCapped = true; }
    } else { cap = byAge; R.base = 'age'; rule = 'потолок по возрасту компании (выручка неизвестна)'; }
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
      // chestnyj-nol-v1: живой формат istochniki-v1 — ответ реестра в sostoyanie (status там «polucheno»), иначе приставы,
      // которые ответили, читались бы «не проверяли»
      var b = dm[klyuchi[i]]; if (b && b.sostoyanie) return b.sostoyanie; if (b && b.status) return b.status;
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
      if (!s) return false;
      var si = signalId(s);
      return s.id === 'tax_debt' || (si.po === 'kod' && si.id === 'tax_debt') || (si.po === 'tekst' && !s.id && /задолженн\S*\s+по\s+налог/i.test(s.title || ''));
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
  function kakPoschitali(f, t, pc, reasonsList, np, napr, pv, nv) {
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
      } else if (R.base === 'insufficient_data') {
        kak = NEDOST_KAK(otg);
      } else if (R.base === 'staraya') {
        kak = 'Как посчитали: не считали. ' + STARAYA_TEKST(R.revenueYear, otg);
      } else {
        kak = 'Как посчитали: потолок ' + money(R.byAge) + polovina + '.';
      }
    }
    var ne = '';
    if (pv) {
      var esche = (nv || []).filter(function (x) { return pv.ne.indexOf(x) < 0; });   // predel-chestno-v1: приостановки и меры ФНС не теряем
      ne = predvTekst(pv, otg) + (esche.length ? ' Не проверяли в\u00a0этот раз: ' + esche.join(', ') + '.' : '') +
        (np && np.nalogiNa ? ' Долги по налогам — нет в списке ФНС на\u00a0' + np.nalogiNa + '.' : '') +
        (np && np.provereno != null && np.iz ? ' Из внешних реестров ответили ' + np.provereno + ' из ' + np.iz + (np.data ? ' на ' + dataRu(np.data) : '') + '.' : '');
    } else if (np && np.spisok.length && (t === 'go' || t === 'cap')) {
      ne = 'Не проверяли: ' + np.spisok.join(', ') + '. Если они есть — ' + (otg ? 'в долг лучше не отгружать.' : 'вперёд лучше не платить.') +
        (np.nalogiNa ? ' Долги по налогам — нет в списке ФНС на\u00a0' + np.nalogiNa + '.' : '') +
        (np.provereno != null && np.iz ? ' Из внешних реестров ответили ' + np.provereno + ' из ' + np.iz + (np.data ? ' на ' + dataRu(np.data) : '') + '.' : '');
    } else if (nv && nv.length && (t === 'go' || t === 'cap')) {
      // dostovernost-v1: всё, что влияет на вывод о деньгах, кроме этих реестров, проверено — называем, чего не видели
      ne = 'Не проверяли в\u00a0этот раз: ' + nv.join(', ') + '. ' + RASCHET(np, otg) +
        (np && np.provereno != null && np.iz ? ' Из внешних реестров ответили ' + np.provereno + ' из ' + np.iz + (np.data ? ' на ' + dataRu(np.data) : '') + '.' : '');
    } else if (t === 'cap' && pc && pc.cap > 0) {
      ne = RASCHET(np, otg); // pravo-sdelka-v1: и при полной проверке предел — расчёт, а не гарантия
    }
    if (otg && R.base !== 'finorg') kak = OBA_NAPRAVLENIYA + ' ' + kak;
    var out = { kak: kak, ne: ne,
      podpis: 'Ориентир Делоскопа, не норма закона. Методика — в разборе «Сколько платить вперёд незнакомой компании».', url: STATYA };
    if (bankR) out.ssylka = R.base === 'finorg' ? { t: FINORG_SSYLKA, u: bankSsylka(f).u } : bankSsylka(f);
    return out;
  }
  // doverie-v1: предел не посчитан — оснований мало; что именно запросить, чтобы он появился.
  function NEDOST_KAK(otg) {
    return 'Как посчитали: не считали. Выручка и возраст компании неизвестны, а положительный предел из одних неизвестных мы не выводим. ' +
      'Чего не хватает: дата регистрации (выписка из ЕГРЮЛ) и бухгалтерская отчётность за прошлый год (ГИР БО или копия от компании).';
  }
  // predel-staraya-v1: слова юристов 19.11 вечер разд. 1 (2) дословно; «Они платят мне» — то же словами продавца
  function STARAYA_TEKST(god, otg) {
    return 'Предел не считаем: последняя выручка в\u00a0открытой отчётности\u00a0— за\u00a0' + god + '. До свежей отчётности\u00a0— ' + (otg ? 'отгружайте после оплаты.' : 'по\u00a0факту поставки.');
  }
  function NEDOST_SOVET(otg) {
    return otg ? 'Предел отсрочки не посчитан: оснований мало. Пока не увидите выписку и отчётность покупателя, отгружайте после оплаты.'
      : 'Предел предоплаты не посчитан: оснований мало. Пока не увидите выписку и отчётность компании, платите по факту поставки.';
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
  // chestnyj-nol-v1 ([команда] 13.11 12:40 п. 1.1, дословно): суды или приставы не ответили — положительного вывода нет вовсе.
  // «Предварительно: серьёзного не нашли» при непроверенных судах — утверждение о компании без проверки (ст. 152 ГК, решение 02.10).
  function neOtvetiliSudyFssp(pv) {
    var a = (pv && pv.ne) || [], s = a.some(function (x) { return /^арбитражные суды/.test(x); }), p = a.some(function (x) { return /^(долги у приставов|приставы)/.test(x); });
    return s && p ? 'суды и приставы' : s ? 'суды' : p ? 'приставы' : '';
  }
  function zagNeVse(pv) { var k = neOtvetiliSudyFssp(pv); return 'Проверили не всё: ' + k + ' сегодня не\u00a0ответили'; }
  var NET_VYVODA = 'Вывода о рисках пока нет.';
  function sNetVyvoda(pv, t, sovet) { return neOtvetiliSudyFssp(pv) && t === 'go' ? NET_VYVODA + ' ' + sovet : sovet; }
  // dostovernost-v1 (аудит 19.11, п. 22 (б)): «Можно…» — разрешение. Пока не проверены все
  // реестры, от которых зависит вывод о деньгах (суды, банкротство, приставы, приостановки счетов и обеспечительные меры ФНС,
  // долги по налогам), слова «можно» в выводе нет: «по нашей оценке» и «не гарантия». Слова до ответа юристов — нейтральные.
  var NE_GARANTIYA = 'это не\u00a0гарантия исполнения договора';
  // pravo-sdelka-v1 (юристы 19.11 разд. 1 (а), дословно): «Это расчёт по проверенным источникам на {дата}, а не гарантия исполнения договора.»
  function RASCHET(np, otg) {
    return 'Это расчёт по\u00a0проверенным источникам' + (np && np.data ? ' на\u00a0' + dataRu(np.data) : '') + ', а\u00a0не\u00a0гарантия ' + (otg ? 'оплаты' : 'исполнения договора') + '.';
  }
  var BEZ_SIGNALOV = 'Серьёзных сигналов в\u00a0проверенных источниках нет';
  function nvHeadline(t, cap, malo, otg) {
    if (t === 'go') return BEZ_SIGNALOV;
    if (malo) return otg ? 'Без отсрочки' : 'Оплата\u00a0— по\u00a0факту поставки';
    if (cap == null) return 'Есть замечания';
    return (otg ? 'Отсрочка' : 'Предоплата') + '\u00a0— по\u00a0нашей оценке не\u00a0больше ' + money(cap);
  }
  function headline(f, t, cap, malo, pv, ned, nv) {
    if (neOtvetiliSudyFssp(pv) && t === 'go') return zagNeVse(pv);
    if (ned && (t === 'go' || t === 'cap')) return t === 'cap' ? 'Предварительно: есть замечания' : 'Предварительно: данных мало';
    if (pv && t === 'go') return 'Предварительно: серьёзного не нашли';
    if (pv && t === 'cap' && !malo && cap != null) return 'Предварительно: есть замечания';
    if (f.status === 'LIQUIDATED') return 'Сделку не заключать';
    if (t === 'stop') return 'Не платите вперёд';
    if (t === 'post' && reorgPrekr(f)) return 'Только оплата по факту\u00a0— до проверки правопреемника';
    if (t === 'post') return 'Только оплата по факту';
    if (nv && (t === 'go' || t === 'cap')) return nvHeadline(t, cap, malo, false);
    // pravo-sdelka-v1 (юристы 19.11 разд. 1 (а)): «Можно, предоплата — до X» не возвращаем и при полной проверке —
    // «можно» читается как наша рекомендация к сделке (ст. 152 ГК, ч. 3 ст. 5 38-ФЗ); формула та же
    if (t === 'cap') return nvHeadline(t, cap, malo, false);
    return 'Работать можно';
  }
  function headlineOtg(f, t, cap, malo, pv, ned, nv) {
    if (neOtvetiliSudyFssp(pv) && t === 'go') return zagNeVse(pv);
    if (ned && (t === 'go' || t === 'cap')) return t === 'cap' ? 'Предварительно: есть замечания' : 'Предварительно: данных мало';
    if (pv && t === 'go') return 'Предварительно: серьёзного не нашли';
    if (pv && t === 'cap' && !malo && cap != null) return 'Предварительно: есть замечания';
    if (f.status === 'LIQUIDATED') return 'Сделку не заключать';
    if (t === 'stop') return 'Отгружайте только после оплаты';
    if (t === 'post' && reorgPrekr(f)) return 'Только по предоплате\u00a0— до проверки правопреемника';
    if (t === 'post') return 'Только по предоплате';
    if (nv && (t === 'go' || t === 'cap')) return nvHeadline(t, cap, malo, true);
    if (t === 'cap') return nvHeadline(t, cap, malo, true); // pravo-sdelka-v1: без «Можно» (как headline)
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
    // doverie-v1 ([команда] 30.10, п. 2): на УСН «доходы» расход налог не уменьшает, но вычет НДС у плательщика
    // НДС на УСН есть — риск не нулевой, он зависит от статуса по НДС. Суммы не объявляем; vat — справочно, «если вычет есть».
    if (regime === 'usn_d') return { soft: null, hard: null, utochnit: 'nds', vat: amount * VAT / (1 + VAT) };
    if (regime === 'usn_dr') { var t = amount * USN_DR; return { soft: 0, hard: t * (1 + FINE_HARD) }; }
    var vat = amount * VAT / (1 + VAT), profit = (amount - vat) * PROFIT;
    return { soft: vat * (1 + FINE_SOFT), hard: (vat + profit) * (1 + FINE_HARD), vat: vat };
  }

  function prepayAdvice(amount, cap, t, pv, nv) {
    amount = parseAmount(amount);
    if (!amount) return '';
    if (cap == null && (t === 'go' || t === 'cap')) return '';
    if (t === 'stop' || t === 'post' || cap === 0) return 'Предоплату не вносите: ' + money(amount) + ' — после поставки или через аккредитив.';
    if (pv) return 'Ориентир предварительный: пока не проверите то, чего мы не видели, — платите по факту поставки. После проверки — ' +
      (amount <= cap ? 'сумма укладывается в ориентир.' : 'вперёд не больше ' + money(cap) + ' (' + Math.max(1, Math.floor(cap / amount * 100)) + '% суммы).');
    if (nv && amount <= cap) return 'Сумма в\u00a0пределах нашей оценки по\u00a0проверенным источникам; ' + NE_GARANTIYA + '.';
    if (t === 'go' && amount <= cap) return 'Сумма в пределах ориентира — обычные условия подойдут.';
    if (amount <= cap) return 'Сумма в пределах ориентира: предоплата допустима.';
    var p = Math.max(1, Math.floor(cap / amount * 100));
    return 'Вперёд — не больше ' + money(cap) + ' (' + p + '% суммы), остальное — после поставки.';
  }

  function otgruzkaAdvice(amount, cap, t, pv, nv) {
    amount = parseAmount(amount);
    if (!amount) return '';
    if (cap == null && (t === 'go' || t === 'cap')) return '';
    if (t === 'stop' || t === 'post' || cap === 0) return 'В долг не отгружайте: ' + money(amount) + ' — после оплаты.';
    if (pv) return 'Ориентир предварительный: пока не проверите то, чего мы не видели, — отгружайте после оплаты. После проверки — ' +
      (amount <= cap ? 'сумма укладывается в ориентир.' : 'в долг не больше ' + money(cap) + ' (' + Math.max(1, Math.floor(cap / amount * 100)) + '% суммы).');
    if (nv && amount <= cap) return 'Сумма в\u00a0пределах нашей оценки по\u00a0проверенным источникам; это не\u00a0гарантия оплаты.';
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
    // pravo-sdelka-v1: слова юристы 19.11 разд. 4 (иски) и разд. 2 (3) (наличные)
    sudy: { t: 'Пояснение по делам, где компания\u00a0— ответчик', why: 'суть требований и как идут дела', ask: 'Пояснение по делам, где компания — ответчик: суть требований и как идут дела' },
    // predmet-sdelki-v1 (юристы 19.11 разд. 4 «Предмет сделки», слова дословно; «почему» — без норм, только к чему документ)
    postavka: { t: 'Договор поставки и\u00a0УПД', why: 'что и на каких условиях вам поставят; УПД подтверждает каждую поставку', ask: 'Проект договора поставки; УПД — на каждую поставку' },
    smeta: { t: 'Смета и\u00a0акт выполненных работ', why: 'документы под предмет сделки: работы или услуги', ask: 'Смета; акт выполненных работ (оказанных услуг) — по итогам' },
    sro: { t: 'Выписка из\u00a0реестра членов СРО, если работы этого требуют', why: 'для строительных работ', ask: 'Выписка из реестра членов СРО, если работы по договору этого требуют' },
    egrn: { t: 'Выписка из\u00a0ЕГРН или договор с\u00a0собственником', why: 'на помещение или имущество, которое сдают вам в аренду', ask: 'Выписка из ЕГРН на сдаваемое помещение или договор с собственником' },
    grafik: { t: 'График поставки', why: 'когда придёт товар, за который вы платите вперёд', ask: 'График поставки' },
    obesp: { t: 'Обеспечение, если договор его предусматривает', why: 'на случай, если поставки не будет', ask: 'Обеспечение исполнения договора, если договор его предусматривает' },
    chek: { t: 'Кассовый чек на каждый платёж', why: 'при наличных касса обязательна и между компаниями', ask: 'Кассовый чек на каждый платёж наличными' },
    fssp: { t: 'Пояснение по долгам у приставов', why: 'как и когда погасят: при аресте счёта ваша предоплата застрянет', ask: 'Информация о погашении исполнительных производств или план погашения' },
    unblock: { t: 'Решение ФНС об отмене приостановления операций по счёту', why: 'пока счёт заблокирован налоговой, компания не сможет тратить ваши деньги', ask: 'Решение ФНС об отмене приостановления операций по счёту' },
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
    if (f.bad.block || f.warn.block || f.zaprosBlock) add('unblock');
    if (f.bad.dolg || f.warn.dolg || f.nalogOstatok) add('taxCert');
    if (f.bad.fssp || f.warn.fssp || f.zaprosFssp) add('fssp');
    if (f.zaprosSudy) add('sudy');
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
    if (f.bad.fssp || f.warn.fssp || f.zaprosFssp) add('fssp');
    if (f.zaprosSudy) add('sudy');
    if (f.bad.dolg || f.warn.dolg || f.nalogOstatok) add('taxCert');
    if (f.bad.block || f.warn.block || f.zaprosBlock) add('unblock');
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

  // zapros-dokumentov-v1 (текст юриста 11.11, п. «а», дословно): письмо отправляет сам пользователь со своей почты —
  // с сервера ничего не уходит. Без слов «проверка», «риск», «подозрение», «115-ФЗ», «налоговая», без норм и обещаний,
  // без Индекса и без подписи Делоскопа. Ссылка — только на опубликованную карточку организации (у ИП её нет и не будет).
  var SAJT = 'https://deloskop.ru';
  function letter(f, list, amount, o) {
    o = o || {};
    var lines = list.map(function (d, i) { return (i + 1) + '. ' + (d.ask || d.title) + '.'; }).join('\n');
    var put = f.kind !== 'INDIVIDUAL' && /^\/company\/\d{10}-[a-z0-9-]+\/$/.test(String(o.kartochka || '')) ? o.kartochka : '';
    var subj = 'Документы для договора с [Наша компания]';
    var body = 'Здравствуйте!\n\n' +
      'Готовим договор с ' + f.name + ' и собираем стандартный комплект документов — так мы делаем со всеми новыми партнёрами. ' +
      'Пришлите, пожалуйста, сканы или выписки:\n\n' + lines + '\n\n' +
      (put ? 'Сведения из открытых реестров о вашей компании' + (o.data ? ' на ' + o.data : '') + ' мы уже посмотрели: ' + SAJT + put + '. Если там что-то неточно — напишите, учтём.\n\n' : '') +
      'Спасибо!\n[Имя, должность, телефон]';
    return { subject: subj, body: body };
  }
  // Слова, которых в письме контрагенту быть не должно (юрист, 11.11) — сторож для тестов
  var LETTER_NELZYA = /провер|риск|подозр|115-ФЗ|налогов(ая|ой|ую|ые|ых)\b|над\u0451жн|Индекс|Делоскоп|54\.1|БВ-4-7/i;

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

  // Почему ориентир предварительный: { baza: 'age'|'insufficient_data'|null, ne: ['арбитражные суды', 'долги у приставов', …] } или null.
  // Только для тонов go и cap: «по факту» и «стоп» и так ничего не разрешают. Банку и страховой предел не считаем — база не нужна.
  var PREDV_BAZA = { age: 'выручки в отчётности нет — предел посчитан по возрасту компании', insufficient_data: 'выручка и возраст неизвестны — предел не считаем' };
  // predel-chestno-v1 (аудит 19.11, граничные случаи): предел из выручки, которой больше двух лет (то же правило, что у доли
  // выручки в «Деньгах на кону» и «Главном» — юрист 12.11 п. 3), — ориентир предварительный: у ОАО «РЖД» 19.11 предел
  // 75,5 млрд ₽ считался по выручке за 2021 год. Число то же, меняются слова: «Предварительно…», «вперёд не платите, пока не проверите отчётность».
  var STARAYA_LET = 2;
  function godProverki(r) { var m = /^(\d{4})-/.exec(String(r && r.checked_at || '')); return m ? +m[1] : new Date().getFullYear(); }
  function vyruchkaStaraya(r, R) { var g = +(R && R.revenueYear); return !!(R && R.base === 'revenue' && g && godProverki(r) - g > STARAYA_LET); }
  function predvaritelno(r, f, t, pc, np) {
    if (t !== 'go' && t !== 'cap') return null;
    if (pc.malo || pc.cap === 0) return null;            // вперёд и так 0 ₽ — разрешать нечего
    var R = pc.raschet || {}, baza = !pc.finorg && (R.base === 'age' || R.base === 'insufficient_data') ? R.base : !pc.finorg && vyruchkaStaraya(r, R) ? 'staraya' : null, ne = [];
    (np && np.spisok || []).forEach(function (x) { ne.push(x); });
    neProverenyPodrobno(r).forEach(function (x) {
      var t2 = x.k === 'fssp' ? 'долги у приставов' : x.t;
      if (ne.some(function (y) { return y.indexOf(t2) === 0; })) return;
      ne.push(t2);
    });
    if (!baza && !ne.length) return null;
    return { baza: baza, prichina: baza === 'staraya' ? 'последняя выручка в открытой отчётности — за\u00a0' + R.revenueYear + '\u00a0год, предел посчитан по\u00a0ней' : baza ? PREDV_BAZA[baza] : '', ne: ne };
  }
  function predvTekst(pv, otg) {
    var a = [];
    if (pv.ne.length) a.push('не проверяли ' + pv.ne.join(', '));
    if (pv.prichina) a.push(pv.prichina);
    return 'Ориентир предварительный: ' + a.join('; ') + '. Не проверено — не значит «в порядке»: ' + (otg ? 'в долг не отгружайте' : 'вперёд не платите') + ', пока не проверите' + (pv.baza && !pv.ne.length ? ' отчётность' : '') + '.';
  }
  // dostovernost-v1: реестры, без которых вывод о деньгах неполный (суды, банкротство, приставы — KLYUCHEVYE; приостановки
  // счетов и обеспечительные меры ФНС — «аванс может застрять»). Блока в ответе нет (старый формат) — не судим.
  var VLIYAYUT_DOP = [{ k: 'priostanovki', t: 'решения ФНС о\u00a0приостановке операций по\u00a0счетам' }, { k: 'mery', t: 'обеспечительные меры ФНС' }];
  function nepolno(r, t, pv, np) {
    if (t !== 'go' && t !== 'cap') return null;
    if (pv) return null; // «Предварительно…» уже говорит, чего не видели
    var dm = r && r.damia, out = [];
    (np && np.spisok || []).forEach(function (x) { out.push(x); });
    if (dm && typeof dm === 'object') KLYUCHEVYE.concat(VLIYAYUT_DOP).forEach(function (x) {
      var b = dm[x.k];
      if (!b || typeof b !== 'object') return;
      var st = b.sostoyanie || b.status;
      if (['found', 'not_found', 'not_applicable', 'provereno'].indexOf(st) < 0) out.push(x.t);
    });
    return out.length ? out : null;
  }
  // nalichnye-usloviya-v1 (принцип владельца «контроль наличных — везде»; решение 19.11 п. 1 «способ оплаты»):
  // сумма больше 100 000 ₽ — строка о пределе наличных расчётов теми же словами, что в «Лестнице» (js/lestnica.js,
  // слова юристов; сторож tests/usloviya.test.js сверяет дословно). Ровно 100 000 — без строки, как в «Лестнице».
  var LIMIT_NALICHNYH = 100000;
  var NALICHNYE = 'Наличными — не больше 100 000 ₽ по одному договору, остальное — безналично: так ограничены расчёты между компаниями и ИП (п. 4 Указания Банка России от 09.12.2019 № 5348\u2011У). Предел\u00a0— на\u00a0весь договор, сколько бы платежей ни\u00a0было.'; // dostovernost-v1 (аудит 19.11): было «Наличными — нельзя: …» — первая фраза спорила со второй; слова до ответа юристов
  // поле только при сумме больше предела: без него вывод побайтно прежний (снимки tests/otsrochka_pokupatelyu.test.js)
  // sposob-oplaty-v1 (план 19.11 п. 1 «ИНН + сумма + предмет + способ оплаты»): «Как платите» —
  // «Безналично» снимает строку (она не о вашей сделке), «Наличными» ставит её первой и выделяет; не выбрано — как раньше.
  // Новых слов нет: строка та же (слова юристов); «Картой или СБП» не добавляли — нужны слова юристов.
  // pravo-sdelka-v1 (юристы 19.11 разд. 2, дословно): «Картой или СБП» — безналичный расчёт, предела нет, строки о пределе нет;
  // «Наличными» — напоминание о кассовом чеке при любой сумме (касса обязательна и между компаниями), в «Что запросить» — чек.
  // Чек выдаёт поставщик: при «Они платят мне» строк о чеке нет (слов юристов для продавца нет).
  var SPOSOB = [{ id: 'bezn', t: 'Безналично' }, { id: 'nal', t: 'Наличными' }, { id: 'karta', t: 'Картой или СБП' }];
  var KARTA = 'Картой или по\u00a0СБП со\u00a0счёта компании\u00a0— это безналичный расчёт, предела 100\u00a0000\u00a0₽ нет.';
  var KARTA_CHEK = 'Поставщик выдаёт кассовый чек.';
  var CHEK = 'Возьмите кассовый чек: при наличных касса обязательна и\u00a0между компаниями.';
  function sNal(v, amount, sposob) {
    if (sposob === 'bezn' || sposob === 'nal' || sposob === 'karta') v.sposob = sposob;
    var prodavec = v.napravlenie === 'otgruzhaem';
    if (sposob === 'karta') { v.karta = prodavec ? KARTA : KARTA + ' ' + KARTA_CHEK; return v; }
    if (sposob === 'bezn') return v;
    var x = nalichnye(amount); if (x) { v.nalichnye = x; if (sposob === 'nal') v.nalPervoj = true; }
    if (sposob === 'nal' && !prodavec && parseAmount(amount)) v.chek = CHEK;
    return v;
  }
  // predmet-sdelki-v1 (план 19.11 п. 1 «ИНН + сумма + предмет + способ оплаты»; юристы 19.11 разд. 4):
  // «Что покупаете» — четыре варианта словами юристов; меняет только «Что запросить у них» и письмо. Вывод, предел,
  // «На кону» и строки об оплате от предмета не зависят (сторож tests/predmet_sdelki.test.js). Не выбран — побайтно прежнее.
  // Только «Я плачу им»: список юристов — о том, что просит покупатель. Выбор не запоминаем, как способ оплаты.
  var PREDMET = [{ id: 'tovary', t: 'Товары', docs: ['postavka'] }, { id: 'raboty', t: 'Работы или услуги', docs: ['smeta', 'sro'] },
    { id: 'arenda', t: 'Аренда', docs: ['egrn'] }, { id: 'avans', t: 'Предоплата за будущую поставку', docs: ['postavka', 'grafik', 'obesp'] }];
  var PREDMET_ID = {}; PREDMET.forEach(function (x) { PREDMET_ID[x.id] = x; });
  function sPredmet(list, predmet) {
    var p = PREDMET_ID[predmet]; if (!p) return list;
    var est = {}; list.forEach(function (d) { est[d.id] = 1; });
    var nov = p.docs.filter(function (id) { return !est[id]; }).map(docItem);
    // sro заменяет общую «Лицензию или выписку из СРО» — одна строка о допуске, а не две
    if (predmet === 'raboty') list = list.filter(function (d) { return d.id !== 'license'; });
    var i = 0; while (i < list.length && (list[i].id === 'power' || list[i].id === 'powerNew' || list[i].id === 'card')) i++;
    return list.slice(0, i).concat(nov, list.slice(i));
  }
  function nalichnye(amount) { amount = parseAmount(amount); return amount && amount > LIMIT_NALICHNYH ? NALICHNYE : null; }
  function decide(r, opts) {
    opts = opts || {};
    var f = facts(r), t = tone(f), np = neProvereno(r, f), pc = prepayCap(f, t, np), amount = parseAmount(opts.amount), regime = opts.regime || 'osno';
    var pv = predvaritelno(r, f, t, pc, np), nv = nepolno(r, t, pv, np);
    var itG = opts.itogG !== undefined && opts.itogG !== null ? opts.itogG : itogStranicy(r);   // ton-vyvoda-v1
    var nvKak = nv || (pv && pv.baza === 'staraya' ? nepolno(r, t, null, null) : null); // predel-chestno-v1: только для «Как посчитали»
    var list = docs(f, t, amount, regime);
    if (opts.sposob === 'nal' && opts.napravlenie !== 'otgruzhaem' && !list.some(function (d) { return d.id === 'chek'; })) list.push(docItem('chek')); // pravo-sdelka-v1
    if (opts.napravlenie !== 'otgruzhaem' && PREDMET_ID[opts.predmet]) list = sPredmet(list, opts.predmet); // predmet-sdelki-v1
    if (opts.napravlenie === 'otgruzhaem') {
      // «Они платят мне»: число то же (pc.cap), меняются слова; ст. 54.1 — про вычеты покупателя, «На кону» не считаем;
      // список и письмо — свои (docsOtg, letterOtg): без card, regime, resources, license, experience и без ст. 54.1
      list = docsOtg(f, t, amount, pc.cap);
      return sPered(sNal(sFinorg(pc, {
        napravlenie: 'otgruzhaem',
        facts: f, tone: t, cap: pc.cap, malo: !!pc.malo, capRule: pc.rule, raschet: pc.raschet, neProvereno: np,
        kak: kakPoschitali(f, t, pc, reasons(f), np, 'otgruzhaem', pv, nvKak),
        headline: headlineOtg(f, t, pc.cap, pc.malo, pv, pc.nedostatochno, nv), reasons: reasons(f), advice: sNetVyvoda(pv, t, adviceOtg(f, t, pc.malo)),
        amount: amount, regime: regime, stake: null, prepay: pc.staraya && amount ? STARAYA_TEKST(pc.staraya, true) : pc.nedostatochno && amount ? NEDOST_SOVET(true) : otgruzkaAdvice(amount, pc.cap, t, pv, nv),
        docs: list, letter: letterOtg(f, list, amount)
      }, pv, nv), amount, opts.sposob), itG);
    }
    return sPr(sPered(sNal(sFinorg(pc, {
      facts: f, tone: t, cap: pc.cap, malo: !!pc.malo, capRule: pc.rule, raschet: pc.raschet, neProvereno: np,
      kak: kakPoschitali(f, t, pc, reasons(f), np, null, pv, nvKak),
      headline: headline(f, t, pc.cap, pc.malo, pv, pc.nedostatochno, nv), reasons: reasons(f), advice: sNetVyvoda(pv, t, advice(f, t, pc.malo)),
      amount: amount, regime: regime, stake: atStake(amount, regime), prepay: pc.staraya && amount ? STARAYA_TEKST(pc.staraya, false) : pc.nedostatochno && amount ? NEDOST_SOVET(false) : prepayAdvice(amount, pc.cap, t, pv, nv),
      docs: list, letter: letter(f, list, amount, { kartochka: opts.kartochka, data: dataRu(r.checked_at) || '' })
    }, pv, nv), amount, opts.sposob), itG), opts.predmet);
  }
  // finorg — только у банка или страховой: у остальных вывод побайтно прежний (снимок tests/otsrochka_pokupatelyu.test.js);
  // predvaritelno — только когда ориентир предварительный (predvaritelno-v1)
  function sFinorg(pc, v, pv, nv) {
    if (pc.finorg) v.finorg = true; if (pv) v.predvaritelno = pv;
    if (nv) v.nepolno = nv; // dostovernost-v1: поле только при неполной проверке — иначе вывод побайтно прежний
    if (pc.nedostatochno) v.nedostatochno = true;
    // predel-staraya-v1: выручка старше двух лет — год и готовая строка для Паспорта, «4 вопросов», сравнения и досье сделки
    if (pc.staraya) { v.staraya = pc.staraya; v.predelNe = STARAYA_TEKST(pc.staraya, v.napravlenie === 'otgruzhaem'); }
    // doverie-v1: положительный, нулевой и не посчитанный предел различимы без разбора текста
    v.predel = { sostoyanie: pc.finorg ? 'finorg' : pc.staraya ? 'staraya' : pc.nedostatochno ? 'insufficient_data' : pc.cap > 0 ? 'positive' : 'zero', pravilo: PRAVILO };
    return v;
  }

  // ---------- интерфейс ----------
  var CSS = '' +
    '.usl{border-radius:16px;background:var(--bg,#F5F1E6);padding:18px 18px 16px;display:flex;flex-direction:column;gap:12px;color:var(--ink,#0D2247)}' +
    '.usl-h{display:flex;gap:12px;align-items:flex-start}' +
    '.usl-mark{flex:none;width:12px;height:12px;border-radius:50%;margin-top:7px;box-shadow:0 0 0 4px rgba(22,114,63,.14);background:#16723F}' +
    '.usl.cap .usl-mark{background:#C27A00;box-shadow:0 0 0 4px rgba(194,122,0,.16)}' +
    '.usl.post .usl-mark,.usl.stop .usl-mark{background:#B3261E;box-shadow:0 0 0 4px rgba(179,38,30,.14)}' +
    '.usl.ned .usl-mark{background:#8A97B5;box-shadow:0 0 0 4px rgba(142,142,147,.18)}' +
    '.usl-t{font-size:20px;line-height:1.3;font-weight:600;letter-spacing:-.01em}' +
    '.usl-r{margin:4px 0 0;font-size:15px;color:var(--ink2,#3A4868)}' +
    '.usl-a{margin:0;font-size:15px;color:var(--ink2,#3A4868)}' +
    '.usl-cap{font-size:13px;color:var(--muted,#5B6783)}' +
    '.usl-kak{display:flex;flex-direction:column;gap:6px;border-top:1px solid #E3DDCD;padding-top:10px}' +
    '.usl-kak p{margin:0;font-size:15px;color:var(--ink2,#3A4868);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}' +
    '.usl-kak .usl-ne{color:#8A5A00;background:#FFF6E0;border-radius:10px;padding:8px 10px}' +
    '.usl-kak a{color:var(--accent,#12305F)}' +
    '.usl-sum{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;border-top:1px solid #E3DDCD;padding-top:12px}' +
    '.usl-sum label{font-size:13px;color:var(--muted,#5B6783);grid-column:1/-1}' +
    '.usl-in{display:flex;align-items:center;background:#fff;border:1px solid #DADAD4;border-radius:10px;padding:0 12px;min-width:0}' +
    '.usl-in:focus-within{border-color:var(--accent,#12305F);box-shadow:0 0 0 3px rgba(18,48,95,.15)}' +
    '.usl-in input{border:0;outline:0;font:inherit;font-size:17px;padding:10px 0;width:100%;min-width:0;background:transparent;font-variant-numeric:tabular-nums}' +
    '.usl-in span{color:var(--muted,#5B6783)}' +
    '.usl select{font:inherit;font-size:15px;border:1px solid #DADAD4;border-radius:10px;padding:10px 30px 10px 12px;background:#fff;max-width:190px;color:inherit}' +
    '.usl-out{display:flex;flex-direction:column;gap:6px;font-size:15px}' +
    '.usl-out b{font-variant-numeric:tabular-nums}' +
    '.usl-out .usl-nal{border-left:2px solid var(--mat-zhdu,#7A5C14);padding-left:12px}[data-theme=dark] .usl-out .usl-nal{border-left-color:var(--mat-zhdu-t,#D9B45A)}' +
    '.usl-out .usl-nal1{font-weight:600}' +
    '.usl-sp{grid-column:1/-1;display:flex;align-items:center;gap:10px}.usl-sp>span{flex:none}.usl-sp .usl-napr{flex:0 1 auto;min-width:0}.usl-sp>span{font-size:13px;color:var(--muted,#5B6783)}.usl-sp .usl-napr{margin:0}.usl-sp .usl-napr button{min-height:32px;font-size:13px;padding:0 12px}' +
    '@media (max-width:640px),(pointer:coarse){.usl-sp .usl-napr button{min-height:44px;font-size:15px}}@media (max-width:520px){.usl-sp{flex-wrap:wrap;gap:6px}.usl-sp .usl-napr{flex:1 1 100%}.usl-sp .usl-napr button{flex:1 1 auto;padding:0 6px}}' +
    '.usl-pr .usl-napr{display:grid;grid-template-columns:auto auto;gap:2px}' + /* predmet-sdelki-v1: четыре варианта — сеткой 2 × 2, без вылета за край */
    '@media (max-width:520px){.usl-pr .usl-napr{grid-template-columns:1fr 1fr}.usl-pr .usl-napr button{white-space:normal;text-align:center;line-height:1.2;padding:4px 6px}}' +
    '.usl-out .z{color:var(--ok,#16723F)}' +
    '.usl details{border-top:1px solid #E3DDCD;padding-top:10px}' +
    '.usl summary{cursor:pointer;font-weight:600;font-size:15px;list-style:none;display:flex;justify-content:space-between;gap:10px}' +
    '.usl summary::-webkit-details-marker{display:none}' +
    '.usl summary:after{content:"";width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin:5px 4px 0 0;transition:transform .2s}' +
    '.usl details[open] summary:after{transform:rotate(-135deg);margin-top:9px}' +
    '.usl summary small{font-weight:400;color:var(--muted,#5B6783);font-size:13px;margin-left:6px}' +
    '.usl ol{margin:10px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:8px;font-size:15px}' +
    '.usl ol span{display:block;color:var(--muted,#5B6783);font-size:13px}' +
    '.usl ol a{color:var(--accent,#12305F);text-decoration:none;overflow-wrap:anywhere}.usl ol a:hover{text-decoration:underline}' +
    '.usl-note{font-size:13px;color:var(--muted,#5B6783);margin:10px 0 0}' +
    '.usl-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}' +
    '.usl-btns button,.usl-btns a{border:1px solid #D8D1BE;background:#fff;font:inherit;font-size:15px;font-weight:600;border-radius:10px;padding:9px 14px;cursor:pointer;color:var(--ink,#0D2247);text-decoration:none}' +
    '.usl-btns button:hover,.usl-btns a:hover{border-color:var(--accent,#12305F);color:var(--accent,#12305F)}' +
    '.usl-napr{display:flex;gap:0;padding:3px;margin:-2px 0 2px;background:rgba(0,0,0,.055);border-radius:10px;align-self:flex-start;max-width:100%}' +
    '.usl-napr button{min-height:36px;padding:0 14px;border:0;border-radius:9px;background:transparent;font:inherit;font-size:15px;font-weight:500;line-height:1.15;color:var(--ink2,#3A4868);cursor:pointer;white-space:nowrap}' +
    '@media (max-width:640px),(pointer:coarse){.usl-napr button,.usl-btns button,.usl-btns a{min-height:44px}.usl-btns a{display:inline-flex;align-items:center}}' + /* otchet-detali-v1: поле касания 44 px на телефоне */
    '.usl-napr button[aria-pressed=true]{background:#fff;color:var(--ink,#0D2247);box-shadow:0 1px 3px rgba(0,0,0,.1)}' +
    '.usl-napr button:focus-visible{outline:2px solid var(--accent,#12305F);outline-offset:1px}' +
    '.usl-watch{align-self:flex-start;font-size:15px;line-height:1.35;color:var(--accent,#12305F);text-decoration:none;border:1px solid #D8D1BE;background:#fff;border-radius:10px;padding:8px 12px}' +
    '.usl-watch:hover{border-color:var(--accent,#12305F)}' +
    '@media (max-width:520px){.usl-napr{align-self:stretch}.usl-napr button{flex:1 1 0;padding:0 8px}}' +
    '@media (max-width:520px){.usl{padding:16px 14px}.usl-t{font-size:17px}.usl-sum{grid-template-columns:1fr}.usl select{max-width:none;width:100%}}' +
    '@media print{.usl .usl-napr,.usl .usl-watch,.usl .usl-sum,.usl .usl-btns,.usl summary:after{display:none!important}.usl details>*{display:block}.usl{background:none;border:1px solid #E3DDCD}}';

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // chestnyj-nol-v2: «Напомнить завтра» — тихая кнопка под советом, поле касания 44 px; в печати не видна
  CSS += '.usl-zavtra{align-self:flex-start;min-height:44px;border:1px solid #D8D1BE;background:#fff;font:inherit;font-size:15px;font-weight:600;border-radius:10px;padding:9px 14px;cursor:pointer;color:var(--ink,#0D2247)}' +
    '.usl-zavtra:hover,.usl-zavtra:focus-visible{border-color:var(--accent,#12305F);color:var(--accent,#12305F)}@media print{.usl .usl-zavtra{display:none!important}}';
  CSS += '.usl-rynok{margin:-4px 0 0;font-size:13px;line-height:1.45;color:var(--muted,#5B6783)}';
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

  // vyvod-glavnoe-v1 (сверка 19.11 00:20 на живых /api/check: 8602060185 — «Работать можно. Серьёзных признаков риска не найдено»
  // под выводом, а выше, в «Главном» (js/glavnoe.js), — «Есть 1 существенный минус» — иски 169,2 млн ₽, 0,1 % выручки): на одном
  // экране два противоположных ответа. Причин в выводе нет, пояснение говорит «не найдено», а «Главное» насчитало существенные
  // минусы (слова юриста 18.11 п. 2) — вместо «не найдено» пишем итог «Главного» и сам минус, теми же словами. Новых утверждений нет.
  var NE_NAJDENO = /(не\s+найден|не\s+обнаружен|признаков\s+(риска\s+)?нет|сигналов\s+нет)/i;
  function poGlavnomu(it, poyasnenie) {
    var t = String(poyasnenie == null ? '' : poyasnenie);
    if (!it || it.vid !== 'est' || !NE_NAJDENO.test(t)) return t;
    var S = Array.isArray(it.sushchestvennye) ? it.sushchestvennye : [];
    if (!S.length || !it.t) return t;
    if (S.length > 1) return it.t + ' — первыми в\u00a0«Главном»';
    return it.t + ': ' + S[0].t + (S[0].dolya ? ' (' + S[0].dolya + ')' : '');
  }
  // predel-staraya-v1 (юристы 19.11 вечер разд. 1 (5)): сервер пишет «Есть один момент: задолженность по налогам» и при 8 ₽ —
  // долг меньше 500 ₽ не причина вывода: вместо него — справочная строка юристов дословно (точку ставит строка ниже)
  var ODIN_NALOG = /^Есть один момент:\s*задолженн\S*\s+по\s+налог/i;
  function bezOstatka(f, poyasnenie) {
    var t = String(poyasnenie == null ? '' : poyasnenie), o = f && f.nalogOstatok;
    if (!o || !ODIN_NALOG.test(t)) return t;
    return 'Долг по\u00a0налогам\u00a0— ' + String(Math.round(o.summa)) + '\u00a0₽' + (dataRu(o.data) ? ' на\u00a0' + dataRu(o.data) : '') + ' (ФНС). Небольшая сумма\u00a0— уточните у\u00a0компании, погашена ли';
  }
  // ton-vyvoda-v1 (юристы 19.11 разд. 4): зелёный «Работать можно» над «Есть 1 существенный минус» — два вывода спорят.
  // При ≥ 1 существенном минусе «Главного» (js/glavnoe.js, порог — слова юриста 18.11 п. 2; иски — от 1 % выручки) —
  // нейтральный тон и «Перед оплатой посмотрите: {минус}». Живые /api/check 19.11 16:20: у 2457083313 вывод «Предоплата — не больше
  // 319 млн ₽» с причиной «задолженность по налогам: 6 360 ₽», а иск на 421,7 млн ₽ (2 % выручки) — только в «Главном».
  // Вывод без причин и без минуса («Работать можно», «Серьёзных сигналов…») — строкой «Перед оплатой посмотрите» вместо него (zag);
  // вывод с пределом (cap) — заголовок прежний, пояснение начинается с минуса, причины — «Ещё — …» (pod). «Стоп» и «по факту» не трогаем.
  // Предел, совет, документы и письмо не меняются (сторож). Итог «Главного» — opts.itogG или из DlkGlavnoe страницы; в node без него вывод прежний.
  var BEZ_MINUSOV = /^(Работать можно|Серьёзных сигналов|Предварительно: серьёзного не\s*нашли)/;
  var PRO_TO_ZHE = { tax_debt: /налог/i, damia_fssp: /пристав|ФССП/i, damia_sudy: /суд|иск|ответчик/i, address: /адрес/i, status: /статус|ликвид|банкрот|реорган/i };
  function sMalenkoj(t) { t = String(t || ''); return /^[А-ЯЁA-Z][А-ЯЁA-Z]/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1); }
  function peredOplatoj(it, t, reasons, headline) {
    if (!it || it.vid !== 'est' || !it.t || (t !== 'go' && t !== 'cap')) return null;
    var S = Array.isArray(it.sushchestvennye) ? it.sushchestvennye.filter(function (x) { return x && x.t; }) : [];
    if (!S.length) return null;
    var R = Array.isArray(reasons) ? reasons : [];
    var zag = t === 'go' && !R.length && BEZ_MINUSOV.test(headline || '');
    if (t === 'go' && !zag && !R.length) return null;   // «Проверили не всё», «Предварительно: данных мало» — свои слова
    var re = PRO_TO_ZHE[S[0].k];
    return { rezhim: zag ? 'zag' : 'pod', minus: sMalenkoj(S[0].t) + (S[0].dolya ? ' (' + S[0].dolya + ')' : ''), itog: it.t, n: S.length, bylo: headline,
      esche: R.filter(function (x) { return !(re && re.test(String(x))); }) };
  }
  function sPr(v, predmet) { if (PREDMET_ID[predmet]) v.predmet = predmet; return v; } // predmet-sdelki-v1: ключ — только при выборе
  function sPered(v, it) {
    var p = peredOplatoj(it, v.tone, v.reasons, v.headline);
    if (!p) return v;
    v.pered = p;
    if (p.rezhim === 'zag') v.headline = PERED + p.minus;
    return v;
  }
  var PERED = 'Перед оплатой посмотрите: ';
  function itogStranicy(r) {
    var g = typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null);
    return g && g.DlkGlavnoe ? itogGlavnogo(g, r) : null;
  }
  // пояснение: zag — итог «Главного» (минус уже в заголовке) + честная оговорка вывода сервера, если она не «не найдено»;
  // pod — минус, остальные — в «Главном», прочие причины вывода — «Ещё — …»
  function poyasneniePered(p, baza) {
    if (p.rezhim === 'pod') return PERED + p.minus + (p.n > 1 ? '; остальные\u00a0— первыми в\u00a0«Главном»' : '') + (p.esche && p.esche.length ? '. Ещё\u00a0— ' + p.esche.join(', ') : '');
    var t = p.itog + (p.n > 1 ? ' — все первыми в\u00a0«Главном»' : '');
    baza = String(baza == null ? '' : baza).trim();
    return baza && !NE_NAJDENO.test(baza) ? t + '. ' + baza.charAt(0).toUpperCase() + baza.slice(1) : t;
  }
  function itogGlavnogo(win, r) {
    var G = win && win.DlkGlavnoe;
    if (!G || typeof G.sobrat !== 'function') return null;
    try { var x = G.sobrat(r); return x && x.itog ? x.itog : null; } catch (_) { return null; }
  }

  // ne-povtor-v1 [команда] 11.10: какие реестры уже названы в выводе («Не проверяли: …») — ключи damia (sudy, bankrotstvo, fssp).
  // Нужны «Существенным фактам», чтобы строка под ними не повторяла вывод. Причины в выводе есть — строки «Не проверяли» нет → [].
  function vVyvode(r) {
    try {
      var v = decide(r, {});
      if (v.reasons.length) return [];
      var baza = bezPovtora(r && r.verdict, v.pered ? v.pered.bylo : v.headline);
      if (chestnoPoyasnenie(r, baza) === String(baza == null ? '' : baza)) return [];
      return neProverenyPodrobno(r).map(function (x) { return x.k; });
    } catch (e) { return []; }
  }

  function cel(imya) { try { if (typeof window !== 'undefined' && window.dlkGoal) window.dlkGoal(imya); } catch (_) { /* Метрика не мешает */ } }
  var NAPR = [{ id: 'platim', t: 'Я плачу им' }, { id: 'otgruzhaem', t: 'Они платят мне' }];

  // mount(el, r, {compact, open, bezNapr}) — рисует карточку в el, возвращает объект с методом update().
  // bezNapr — без переключателя «Я плачу им / Они платят мне» (PDF-досье): текст — в выбранном раньше режиме.
  // zapros-dokumentov-v1: есть ли у организации опубликованная карточка — по карте сайта /company/ (один запрос за страницу).
  // Карточки нет → в письме нет и ссылки: ссылки на несуществующую страницу контрагенту не даём.
  var KART = null, KART_ZHDUT = null;
  function kartaKartochek(xml) {
    var m = {}, re = /\/company\/(\d{10})-[a-z0-9-]+\//g, x;
    while ((x = re.exec(String(xml || '')))) if (!m[x[1]]) m[x[1]] = x[0];
    return m;
  }
  function kartochki(win, cb) {
    if (KART) return cb(KART);
    if (KART_ZHDUT) return KART_ZHDUT.push(cb);
    if (!win || typeof win.fetch !== 'function') return;
    KART_ZHDUT = [cb];
    win.fetch('/sitemap-companies.xml', { credentials: 'omit' }).then(function (o) { return o.ok ? o.text() : ''; })
      .then(function (s) { KART = kartaKartochek(s); }, function () { KART = {}; })
      .then(function () { var z = KART_ZHDUT; KART_ZHDUT = null; z.forEach(function (f) { try { f(KART); } catch (_) {} }); });
  }

  function mount(el, r, o) {
    o = o || {};
    if (!r || !r.company || !r.company.inn) throw new Error('usloviya: нет данных о компании');
    var doc = el.ownerDocument; injectCss(doc);
    var uid = 'usl' + Math.random().toString(36).slice(2, 7);
    var st = { amount: o.amount || 0, regime: store('usl.regime') || 'osno', napravlenie: store('usl.napr') === 'otgruzhaem' ? 'otgruzhaem' : 'platim', sposob: null, predmet: null }; // способ и предмет не запоминаем: он у каждой сделки свой
    var celi = {};                                         // цели Метрики — один раз за проверку (за mount)
    var box = doc.createElement('section');
    box.setAttribute('aria-label', 'Условия сделки');
    el.innerHTML = ''; el.appendChild(box);
    var win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
    if (/^\d{10}$/.test(String(r.company.inn))) kartochki(win, function (m) {
      var put = m[String(r.company.inn)];
      if (!put || st.kartochka === put) return;
      st.kartochka = put;
      var a = doc.activeElement, fokus = !!a && a.tagName === 'INPUT' && box.contains(a);
      last = draw(fokus);
    });

    function draw(keepFocus) {
      if (st.itogG === undefined || st.itogG === null) st.itogG = itogGlavnogo(win, r);   // vyvod-glavnoe-v1: «Главное» — один раз за проверку
      var v = decide(r, st), f = v.facts;
      var neVse = v.tone === 'go' && !!neOtvetiliSudyFssp(v.predvaritelno);
      // chestnyj-nol-v2 ([команда] 13.11 12:40 п. 1.1; 09:40 п. 2): под «Проверили не всё» — «Напомнить завтра» (.ics, js/perepoverit.js)
      var PP = win && win.Perepoverit, zavtra = neVse && !o.compact && PP && PP.srokZavtra ? PP.srokZavtra(r) : null;
      box.className = 'usl ' + v.tone + (v.nedostatochno || neVse || v.pered ? ' ned' : ''); // chestnyj-nol-v1: «Проверили не всё» — серым, не зелёным   // doverie-v1: неизвестное — нейтральным цветом   // ton-vyvoda-v1: при существенном минусе — нейтральным
      var why = v.pered ? poyasneniePered(v.pered, bezOstatka(v.facts, chestnoPoyasnenie(r, bezPovtora(r && r.verdict, v.pered.bylo))))
        : v.reasons.length ? v.reasons.join(', ') : poGlavnomu(st.itogG, bezOstatka(v.facts, chestnoPoyasnenie(r, bezPovtora(r && r.verdict, v.headline)))); // точку ставит строка ниже — без «найдено..»
      var stake = '';
      if (v.stake) {
        stake = v.stake.utochnit === 'nds'
          ? '<div>Налоговый риск зависит от вашего статуса по\u00a0НДС — уточните. Расход на УСН «доходы» налог не уменьшает; если вы платите НДС 22% с вычетами, на кону вычет НДС — <b>' + money(v.stake.vat) + '</b> (18% суммы). Остаются риск денег и 115-ФЗ.</div>'
          : '<div>На кону при претензии налоговой: <b>' + (v.stake.soft ? money(v.stake.soft).replace(/\s₽$/, '') + '–' : 'до\u00a0') + money(v.stake.hard) + '</b> плюс пени. Досье Делоскопа — ваш довод, что поставщика проверили.</div>';
      }
      var sel = REGIMES.map(function (x) { return '<option value="' + x.id + '"' + (x.id === st.regime ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('');
      var det = box.querySelector('details'), openAttr = (det ? det.open : o.open) ? ' open' : '', otg = v.napravlenie === 'otgruzhaem';
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
        '<p class="usl-a">' + esc(v.advice) + '</p>' + (zavtra ? '<button type="button" class="usl-zavtra" data-u="zavtra">Напомнить завтра</button>' : '') + (rynok ? '<p class="usl-rynok">' + esc(rynok) + '</p>' : '') + watch +
        (o.compact ? '' :
        '<div class="usl-sum"><label for="' + uid + 'a">' + (otg ? 'Сумма отгрузки' : 'Сумма сделки — посчитаем предоплату и деньги на кону') + '</label>' +
          '<div class="usl-in"><input id="' + uid + 'a" inputmode="numeric" autocomplete="off" placeholder="например, 500 000" value="' + (st.amount ? esc(money(st.amount).replace(/ ₽$/, '')) : '') + '"><span>₽</span></div>' +
          (otg ? '' : '<select aria-label="Ваш режим налогов">' + sel + '</select>') +
          '<div class="usl-sp"><span id="' + uid + 's">' + (otg ? 'Как платят вам' : 'Как платите') + '</span><div class="usl-napr" role="group" aria-labelledby="' + uid + 's">' + SPOSOB.map(function (x) {
            return '<button type="button" data-sposob="' + x.id + '" aria-pressed="' + (x.id === st.sposob) + '">' + esc(x.t) + '</button>'; }).join('') + '</div></div>' +
          (otg ? '' : '<div class="usl-sp usl-pr"><span id="' + uid + 'p">Что покупаете</span><div class="usl-napr" role="group" aria-labelledby="' + uid + 'p">' + PREDMET.map(function (x) {
            return '<button type="button" data-predmet="' + x.id + '" aria-pressed="' + (x.id === st.predmet) + '">' + esc(x.t) + '</button>'; }).join('') + '</div></div>') + '</div>' +
        (v.amount && (v.prepay || stake || v.nalichnye || v.karta || v.chek) ? '<div class="usl-out" aria-live="polite">' + (v.nalPervoj ? '<div class="usl-nal usl-nal1">' + esc(v.nalichnye) + '</div>' : '') +
          (v.chek ? '<div class="usl-nal">' + esc(v.chek) + '</div>' : '') + (v.karta ? '<div class="usl-nal">' + esc(v.karta) + '</div>' : '') + (v.prepay ? '<div>' + esc(v.prepay) + '</div>' : '') + stake + (v.nalichnye && !v.nalPervoj ? '<div class="usl-nal">' + esc(v.nalichnye) + '</div>' : '') + '</div>' : '')) +
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
      Array.prototype.forEach.call(box.querySelectorAll('[data-sposob]'), function (b) {
        b.addEventListener('click', function () {
          var n = b.getAttribute('data-sposob');
          st.sposob = st.sposob === n ? null : n;            // второе нажатие снимает выбор
          if (st.sposob === 'nal' && !celi.nal) { celi.nal = 1; cel('usl_nalichnymi'); }
          draw();
          var nb = box.querySelector('[data-sposob="' + n + '"]'); if (nb) nb.focus();
        });
      });
      Array.prototype.forEach.call(box.querySelectorAll('[data-predmet]'), function (b) {
        b.addEventListener('click', function () {
          var n = b.getAttribute('data-predmet');
          st.predmet = st.predmet === n ? null : n;          // второе нажатие снимает выбор
          if (st.predmet && !celi.pr) { celi.pr = 1; cel('usl_predmet'); }
          var d0 = box.querySelector('details'); if (st.predmet && d0) d0.open = true;   // список меняется — показываем его
          draw();
          var nb = box.querySelector('[data-predmet="' + n + '"]'); if (nb) nb.focus();
        });
      });
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
      // zapros-dokumentov-v1: событие zapros_copy — только вид, без ИНН и текста письма (юрист, 11.11)
      var sobytie = function () { try { if (win && win.dlkSobytie && !otg) win.dlkSobytie('zapros_copy'); } catch (_) {} };
      var ml = box.querySelector('[data-u="mail"]');
      if (ml) ml.addEventListener('click', sobytie);
      var zb = box.querySelector('[data-u="zavtra"]');
      if (zb) zb.addEventListener('click', function () {
        try { PP.skachat(doc, zavtra); } catch (_) {}
        cel('napomnit_zavtra');
        zb.textContent = 'Файл календаря скачан';
      });
      var cp = box.querySelector('[data-u="copy"]');
      if (cp) cp.addEventListener('click', function () {
        sobytie();
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
    decide: decide, mount: mount, nalichnye: nalichnye, SPOSOB: SPOSOB, PREDMET: PREDMET.map(function (x) { return { id: x.id, t: x.t }; }), NALICHNYE: NALICHNYE, LIMIT_NALICHNYH: LIMIT_NALICHNYH, rynokStroka: rynokStroka, facts: facts, tone: tone, reorgPrekr: reorgPrekr, REORG_PREKRASHCHENIE: REORG_PREKRASHCHENIE, REORG_SDELAT: REORG_SDELAT, REORG_DOLG: REORG_DOLG, prepayCap: prepayCap, atStake: atStake,
    docs: docs, letter: letter, LETTER_NELZYA: LETTER_NELZYA, kartaKartochek: kartaKartochek, parseAmount: parseAmount, money: money, moneyKrupno: moneyKrupno, niceFloor: niceFloor, kindOf: kindOf, signalId: signalId, SIGNALY: SIGNALY.map(function (x) { return x[0]; }),
    neProvereno: neProvereno, kakPoschitali: kakPoschitali, otgruzkaAdvice: otgruzkaAdvice, NAPR: NAPR, bezPovtora: bezPovtora, chestnoPoyasnenie: chestnoPoyasnenie, poGlavnomu: poGlavnomu, peredOplatoj: peredOplatoj, poyasneniePered: poyasneniePered, neProverenyKlyuchevye: neProverenyKlyuchevye, vVyvode: vVyvode, STATYA: STATYA, FORMULA: FORMULA,
    bezOstatka: bezOstatka, STARAYA_TEKST: STARAYA_TEKST, predvaritelno: predvaritelno, neOtvetiliSudyFssp: neOtvetiliSudyFssp, NET_VYVODA: NET_VYVODA, METODIKA: { DELITEL: DELITEL, POTOLKI: POTOLKI, OSTOROZHNO: OSTOROZHNO, MINIMUM: MINIMUM, PRAVILO: PRAVILO },
    RATES: { VAT: VAT, PROFIT: PROFIT, USN_DR: USN_DR }
  };
});
