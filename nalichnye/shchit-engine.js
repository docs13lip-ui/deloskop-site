/*!
 * Делоскоп · Щит · «Наличные глазами банка»
 * Разбор выписки 1С (формат 1CClientBankExchange) прямо в браузере.
 * Файл клиента никуда не отправляется: весь расчёт — на его компьютере.
 *
 * Пороги и ориентиры лежат в CONFIG с указанием первоисточника.
 * Тексты пояснений — в shchit-texts.js (правятся без программиста).
 * Работает в браузере (window.DeloskopShield) и в Node (module.exports) — для тестов.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DeloskopShield = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= Конфиг: все пороги — здесь, не в коде ================= */
  var CONFIG = {
    version: '2026-09-25',
    // ст. 6 115-ФЗ, п. 1, пп. 1: снятие/зачисление наличных юрлицом от 1 млн ₽ — обязательный контроль
    bigCashOp: 1000000,
    // Положение Банка России № 860-П, код 1428: снятие наличных корпоративной картой — 30% оборота за неделю
    weekCashShare: 0.30,
    weekMinDebit: 100000,          // неделя с оборотом меньше — не учитываем, чтобы не шуметь
    // Доля наличных в расходах за период — наш ориентир (Делоскоп), калибруется на реальных выписках
    cashShareAttention: 0.15,
    cashShareDanger: 0.30,
    // Транзит «пришло — ушло в наличные/себе» за окно рабочих дней (ориентир Делоскопа по 860-П, код 1414)
    transitDays: 2,
    transitAttention: 0.30,
    transitDanger: 0.50,
    // Быстрый проход всего оборота за 1 рабочий день при малых налогах (860-П, код 1414)
    passDays: 1,
    passShare: 0.80,
    // Налоги к обороту: ориентир 0,9% — методические рекомендации Банка России № 18-МР
    taxShareMin: 0.009,
    taxShareMinTurnover: 300000,   // при меньших поступлениях признак не считаем
    // Рост доли наличных в месяце против среднего по предыдущим
    growthFactor: 2,
    growthMinCash: 100000,
    // ИП: доля переводов себе от поступлений
    ipSelfAttention: 0.70,
    ipSelfDanger: 0.90,
    // Переводы физлицам вне зарплаты
    personsShare: 0.20,
    personsMinCount: 10,
    // Взносы наличных — методические рекомендации Банка России № 1-МР от 20.05.2026:
    // от 30 млн ₽ за 30 дней, если заметно больше обычных оборотов за 3 предыдущих месяца
    depositWindowDays: 30,
    depositLimit: 30000000,
    depositVsAvg: 2,               // «заметно больше» — наш ориентир: вдвое выше среднего
    depositShareAttention: 0.30,   // доля наличных во всех поступлениях, если бизнес не «наличный»
    // Наличные «на хознужды» без следа: риск доначисления НДФЛ 13% + взносы до 30%
    hiddenSalaryRate: 0.43,
    vagueMonthly: 100000,
    // Цена блокировки: сколько поступлений встанет, если счёт закроют на время проверки
    blockWorkDays: 10,
    // Обычные расходы бизнеса — их отсутствие настораживает банк
    ordinaryMinDebit: 500000
  };

  var RX = {
    cashDocType: /(денежн\S*\s+чек|расходн\S*\s+кассов|выдач\S*\s+наличн)/i,
    depositDocType: /(взнос\S*\s+наличн|приходн\S*\s+кассов|объявлени)/i,
    cashWords: /(наличн|банкомат|\batm\b|снятие\s+д\/с|снятие\s+денеж|выдача\s+д\/с|по\s+чеку|денежн\S*\s+чек)/i,
    depositWords: /(взнос\S*\s+налич|инкасс|сдач\S*\s+выручк|выручк\S*\s+налич|внесени\S*\s+налич|через\s+банкомат|взнос\s+д\/с)/i,
    selfWords: /(собственн\S*\s+средств|личн\S*\s+нужд|на\s+личн\S*\s+(сч|карт)|перевод\S*\s+себе|вывод\S*\s+собствен|перевод\s+собств)/i,
    salaryWords: /(заработн|зарплат|з\/п|аванс\s+(по|за)|отпускн|больничн|реестр\S*\s+№?|пособи|премия|расч[её]т\S*\s+при\s+увольн)/i,
    vagueWords: /(хоз\S*\s*нужд|хозяйственн\S*\s+нужд|прочи\S*\s+выдач|прочи\S*\s+нужд|на\s+нужды\s+организ|текущ\S*\s+расход)/i,
    advanceWords: /(подотч[её]т|под\s+отч[её]т)/i,
    advanceDetail: /(закупк|приобретени|оплат\S*\s+(по|за)|командиров|договор|сч[её]т\S*\s*№|топлив|гсм)/i,
    loanWords: /(займ|заём|заем)/i,
    feeWords: /(комисси|плата\s+за\s+(обслуж|веден|пакет|тариф)|абонентск\S*\s+плат\S*\s+банк)/i,
    taxWords: /(налог|страхов\S*\s+взнос|ндфл|ндс\s+за\s+|пени|усн|енп|единый\s+налогов)/i,
    ordinary: /(аренд|коммунал|электроэнерг|теплоэнерг|водоснаб|водоотвед|связ[ьи]|интернет|телефон|хостинг|вывоз\s+мусор|охран|бухгалтерск\S*\s+услуг|лицензи|подписк|программн\S*\s+обеспеч)/i
  };

  /* ================= Мелкие помощники ================= */
  function num(s) {
    var v = parseFloat(String(s || '').replace(/[\s ]/g, '').replace(',', '.'));
    return isFinite(v) ? v : 0;
  }
  function parseDate(s) {
    var m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(String(s || '').trim());
    if (!m) return null;
    var y = +m[3]; if (y < 100) y += 2000;
    return Date.UTC(y, +m[2] - 1, +m[1]);
  }
  var DAY = 86400000;
  function isWorkDay(t) { var d = new Date(t).getUTCDay(); return d !== 0 && d !== 6; }
  function addWorkDays(t, n) {
    var x = t, k = 0;
    while (k < n) { x += DAY; if (isWorkDay(x)) k++; }
    return x;
  }
  function monthKey(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2); }
  function weekKey(t) { var d = new Date(t), wd = (d.getUTCDay() + 6) % 7; return t - wd * DAY; }
  function acc(s) { return String(s || '').replace(/\D/g, ''); }
  function innOk(s) {
    if (!/^\d{10}$|^\d{12}$/.test(s)) return false;
    var d = s.split('').map(Number);
    function k(w, n) { var x = 0; for (var i = 0; i < w.length; i++) x += w[i] * d[i]; return (x % 11) % 10 === d[n]; }
    if (s.length === 10) return k([2, 4, 10, 3, 5, 9, 4, 6, 8], 9);
    return k([7, 2, 4, 10, 3, 5, 9, 4, 6, 8], 10) && k([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8], 11);
  }
  // Стабильный хеш: один и тот же отчёт при повторном открытии не меняется
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ================= 1. Кодировка ================= */
  function decode(bytes) {
    if (typeof bytes === 'string') return bytes;
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    function dec(enc, fatal) { return new TextDecoder(enc, fatal ? { fatal: true } : undefined).decode(u8); }
    try { var u = dec('utf-8', true); if (/СекцияДокумент|1CClientBankExchange/.test(u)) return u.replace(/^﻿/, ''); } catch (e) { /* не UTF-8 */ }
    var w = dec('windows-1251');
    if (/Кодировка\s*=\s*DOS/i.test(w) || !/Секция/.test(w)) {
      try { var d = dec('ibm866'); if (/Секция/.test(d)) return d; } catch (e) { /* нет cp866 */ }
    }
    return w;
  }

  /* ================= 2. Разбор 1CClientBankExchange ================= */
  function parse1C(input) {
    var text = decode(input);
    var lines = text.split(/\r\n|\n|\r/);
    var res = { format: null, header: {}, accounts: [], sections: [], docs: [], warnings: [] };
    if (!/^\s*1CClientBankExchange/.test(lines[0] || '')) {
      if (text.indexOf('1CClientBankExchange') < 0) throw new Error('NOT_1C');
      res.warnings.push('Заголовок файла не в первой строке — прочитали как смогли.');
    }
    res.format = '1CClientBankExchange';
    var cur = null, sec = null, i, line, eq, k, v;
    for (i = 0; i < lines.length; i++) {
      line = lines[i];
      if (!line || !line.trim()) continue;
      eq = line.indexOf('=');
      k = (eq < 0 ? line : line.slice(0, eq)).trim();
      v = eq < 0 ? '' : line.slice(eq + 1).trim();
      if (k === 'СекцияДокумент') { cur = { _type: v }; continue; }
      if (k === 'КонецДокумента') { if (cur) res.docs.push(cur); cur = null; continue; }
      if (k === 'СекцияРасчСчет') { sec = {}; continue; }
      if (k === 'КонецРасчСчет') { if (sec) res.sections.push(sec); sec = null; continue; }
      if (k === 'КонецФайла') break;
      if (cur) {
        if (k === 'НазначениеПлатежа' || /^НазначениеПлатежа\d$/.test(k)) cur.НазначениеПлатежа = ((cur.НазначениеПлатежа || '') + ' ' + v).trim();
        else cur[k] = v;
      } else if (sec) sec[k] = v;
      else if (k === 'РасчСчет') { if (acc(v)) res.accounts.push(acc(v)); }
      else res.header[k] = v;
    }
    if (cur) res.warnings.push('Файл оборван: последний документ без «КонецДокумента» — его пропустили.');
    res.sections.forEach(function (s) { var a = acc(s.РасчСчет); if (a && res.accounts.indexOf(a) < 0) res.accounts.push(a); });
    if (!res.docs.length) throw new Error('NO_DOCS');
    return res;
  }

  /* ================= 3. Классификация операций ================= */
  function sideAcc(d, who) { return acc(d[who + 'Счет'] || d[who + 'РасчСчет']); }
  function sideInn(d, who) { return String(d[who + 'ИНН'] || '').replace(/\D/g, ''); }
  function sideName(d, who) {
    var n = d[who + '1'] || d[who] || '';
    return n.replace(/^ИНН\s*\d+\s*/i, '').trim();
  }

  function detectClient(p) {
    var cnt = {}, i, d, a;
    for (i = 0; i < p.docs.length; i++) {
      d = p.docs[i];
      ['Плательщик', 'Получатель'].forEach(function (w) {
        a = sideAcc(d, w);
        var inn = sideInn(d, w);
        if (!inn) return;
        var mine = p.accounts.indexOf(a) >= 0;
        cnt[inn] = (cnt[inn] || 0) + (mine ? 3 : 1);
      });
    }
    var best = '', bv = -1;
    Object.keys(cnt).forEach(function (k) { if (cnt[k] > bv) { bv = cnt[k]; best = k; } });
    var name = '';
    for (i = 0; i < p.docs.length && !name; i++) {
      d = p.docs[i];
      if (sideInn(d, 'Плательщик') === best) name = sideName(d, 'Плательщик');
      else if (sideInn(d, 'Получатель') === best) name = sideName(d, 'Получатель');
    }
    return { inn: best, name: name, isIP: best.length === 12 };
  }

  function isPersonAcc(a) { return /^(40817|40820|423|426)/.test(a); }
  function isCashDeskAcc(a) { return /^(20202|20207|20208|20209)/.test(a); }
  function isBudgetAcc(a) { return /^(40101|03100|03212|03221|03222|03231|40102)/.test(a); }

  function classify(p, client) {
    client = client || detectClient(p);
    var mine = {}; p.accounts.forEach(function (a) { mine[a] = 1; });
    var ops = [], skipped = 0;
    p.docs.forEach(function (d, idx) {
      var sum = num(d.Сумма);
      var t = parseDate(d.ДатаСписано) || parseDate(d.ДатаПоступило) || parseDate(d.Дата);
      if (!sum || !t) { skipped++; return; }
      var pa = sideAcc(d, 'Плательщик'), ra = sideAcc(d, 'Получатель');
      var pi = sideInn(d, 'Плательщик'), ri = sideInn(d, 'Получатель');
      var purpose = d.НазначениеПлатежа || '';
      var type = d._type || '';
      var dir;
      if (mine[pa] && mine[ra]) dir = 'internal';
      else if (mine[pa]) dir = 'out';
      else if (mine[ra]) dir = 'in';
      else if (d.ДатаСписано && !d.ДатаПоступило) dir = 'out';
      else if (d.ДатаПоступило && !d.ДатаСписано) dir = 'in';
      else if (pi === client.inn && ri !== client.inn) dir = 'out';
      else if (ri === client.inn && pi !== client.inn) dir = 'in';
      else dir = 'out';

      var kind = 'counterparty', text = type + ' ' + purpose;
      if (dir === 'internal') kind = 'own';
      else if (dir === 'out') {
        if (RX.cashDocType.test(type) || isCashDeskAcc(ra) || (RX.cashWords.test(purpose) && (ri === client.inn || !ri || /^(30232|30233|30302|47422)/.test(ra)) && !RX.salaryWords.test(purpose))) kind = 'cash_out';
        else if (d.ПоказательКБК && /\d{5,}/.test(d.ПоказательКБК) || d.СтатусСоставителя || isBudgetAcc(ra)) kind = 'tax';
        else if (ri && ri === client.inn && !isPersonAcc(ra)) kind = 'own';
        else if (ri && ri === client.inn) kind = 'self';
        else if (client.isIP && RX.selfWords.test(purpose)) kind = 'self';
        else if (RX.feeWords.test(purpose) && /^(70601|47423|30102|30232|47422)/.test(ra)) kind = 'fee';
        else if (isPersonAcc(ra) || (!ri && RX.salaryWords.test(purpose)) || (ri && ri.length === 12 && RX.salaryWords.test(purpose))) {
          kind = RX.salaryWords.test(purpose) ? 'salary' : 'person';
        }
      } else {
        if (RX.depositDocType.test(type) || isCashDeskAcc(pa) || RX.depositWords.test(purpose)) kind = 'cash_in';
        else if (pi && pi === client.inn) kind = 'own';
      }
      ops.push({
        i: idx, t: t, dir: dir, kind: kind, sum: sum, purpose: purpose, type: type,
        cpInn: dir === 'out' ? ri : pi,
        cpName: dir === 'out' ? sideName(d, 'Получатель') : sideName(d, 'Плательщик'),
        cpAcc: dir === 'out' ? ra : pa,
        vague: (kind === 'cash_out' || kind === 'person') && (RX.vagueWords.test(purpose) || (RX.advanceWords.test(purpose) && !RX.advanceDetail.test(purpose)) || !purpose.replace(/[\s.,-]/g, '').length),
        loan: RX.loanWords.test(purpose),
        ordinary: RX.ordinary.test(text)
      });
    });
    ops.sort(function (a, b) { return a.t - b.t || a.i - b.i; });
    return { client: client, ops: ops, skipped: skipped };
  }

  /* ================= 4. Анализ: признаки глазами банка ================= */
  function r2(x) { return Math.round(x * 100) / 100; }

  function analyze(p, opts) {
    opts = opts || {};
    var C = {}; Object.keys(CONFIG).forEach(function (k) { C[k] = CONFIG[k]; });
    if (opts.config) Object.keys(opts.config).forEach(function (k) { C[k] = opts.config[k]; });
    var cl = classify(p, opts.client);
    var ops = cl.ops, client = cl.client;
    if (!ops.length) throw new Error('NO_OPS');

    var T = { inAll: 0, inCp: 0, outAll: 0, cashOut: 0, cashIn: 0, self: 0, own: 0, tax: 0, salary: 0, person: 0, fee: 0, cpOut: 0, vague: 0, ordinary: 0 };
    var months = {}, weeks = {}, persons = {}, bigOps = [];
    ops.forEach(function (o) {
      var m = months[monthKey(o.t)] || (months[monthKey(o.t)] = { key: monthKey(o.t), inAll: 0, outAll: 0, cashOut: 0, cashIn: 0, self: 0, tax: 0 });
      if (o.kind === 'own') { T.own += o.sum; return; }
      if (o.dir === 'in') {
        T.inAll += o.sum; m.inAll += o.sum;
        if (o.kind === 'cash_in') { T.cashIn += o.sum; m.cashIn += o.sum; } else T.inCp += o.sum;
      } else {
        T.outAll += o.sum; m.outAll += o.sum;
        var w = weeks[weekKey(o.t)] || (weeks[weekKey(o.t)] = { start: weekKey(o.t), out: 0, cash: 0 });
        w.out += o.sum;
        if (o.kind === 'cash_out') { T.cashOut += o.sum; m.cashOut += o.sum; w.cash += o.sum; }
        else if (o.kind === 'self') { T.self += o.sum; m.self += o.sum; }
        else if (o.kind === 'tax') { T.tax += o.sum; m.tax += o.sum; }
        else if (o.kind === 'salary') T.salary += o.sum;
        else if (o.kind === 'person') { T.person += o.sum; persons[o.cpAcc || o.cpInn || o.cpName] = 1; }
        else if (o.kind === 'fee') T.fee += o.sum;
        else T.cpOut += o.sum;
        if (o.vague && o.kind === 'cash_out') T.vague += o.sum;
        if (o.ordinary) T.ordinary += o.sum;
      }
      if ((o.kind === 'cash_out' || o.kind === 'cash_in') && o.sum >= C.bigCashOp) bigOps.push(o);
    });

    var first = ops[0].t, last = ops[ops.length - 1].t;
    var start = parseDate(p.header.ДатаНачала) || first, end = parseDate(p.header.ДатаКонца) || last;
    var workDays = 0; for (var x = start; x <= end; x += DAY) if (isWorkDay(x)) workDays++;
    workDays = Math.max(workDays, 1);
    var monthList = Object.keys(months).sort().map(function (k) { var mm = months[k]; mm.cashShare = mm.outAll ? mm.cashOut / mm.outAll : 0; return mm; });

    var S = [];
    function add(id, level, value, extra) { var s = { id: id, level: level, value: value }; if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; }); S.push(s); }

    // 4.1 Доля наличных в расходах
    var cashShare = T.outAll ? T.cashOut / T.outAll : 0;
    add('cash_share', cashShare >= C.cashShareDanger ? 2 : cashShare >= C.cashShareAttention ? 1 : 0, cashShare,
      { amount: T.cashOut, threshold: C.cashShareDanger, source: 'ориентир Делоскопа; 860-П, код 1428 — 30%' });

    // 4.2 Неделя с долей наличных от 30% (860-П, код 1428)
    // Одиночное снятие в «тихую» неделю не должно давать 100%: делим на больший из оборотов — недели или средней недели
    var weekArr = Object.keys(weeks).map(function (k) { return weeks[k]; });
    var avgWeekOut = weekArr.length ? T.outAll / weekArr.length : 0;
    weekArr.forEach(function (w) { w.ratio = w.cash / Math.max(w.out, avgWeekOut, 1); });
    var hotWeeks = weekArr
      .filter(function (w) { return w.out >= C.weekMinDebit && w.ratio >= C.weekCashShare; })
      .sort(function (a, b) { return b.ratio - a.ratio; });
    if (hotWeeks.length) add('cash_week', hotWeeks.length >= 3 && cashShare >= C.cashShareAttention ? 2 : 1, hotWeeks[0].ratio,
      { count: hotWeeks.length, weekStart: hotWeeks[0].start, amount: hotWeeks[0].cash, source: 'Положение Банка России № 860-П, код 1428' });

    // 4.3 Транзит: поступило — ушло в наличные или «себе» за N рабочих дней
    var inflows = ops.filter(function (o) { return o.dir === 'in' && o.kind === 'counterparty'; }).map(function (o) { return { t: o.t, left: o.sum }; });
    var drains = ops.filter(function (o) { return o.dir === 'out' && (o.kind === 'cash_out' || o.kind === 'self' || (o.kind === 'person' && o.loan)); });
    var transit = 0, transitDaysSet = {};
    drains.forEach(function (o) {
      var need = o.sum;
      for (var j = 0; j < inflows.length && need > 0; j++) {
        var f = inflows[j];
        if (f.t > o.t || f.left <= 0) continue;
        if (addWorkDays(f.t, C.transitDays) < o.t) continue;
        var take = Math.min(f.left, need);
        f.left -= take; need -= take; transit += take; transitDaysSet[o.t] = 1;
      }
    });
    var transitShare = T.inCp ? transit / T.inCp : 0;
    add('transit', transitShare >= C.transitDanger ? 2 : transitShare >= C.transitAttention ? 1 : 0, transitShare,
      { amount: transit, days: Object.keys(transitDaysSet).length, window: C.transitDays, source: 'ориентир Делоскопа по 860-П, код 1414' });

    // 4.4 Налоги к обороту (18-МР: ~0,9%)
    var taxShare = T.inCp ? T.tax / T.inCp : 0;
    if (T.inCp >= C.taxShareMinTurnover) add('tax_share', taxShare < C.taxShareMin / 3 ? 2 : taxShare < C.taxShareMin ? 1 : 0, taxShare,
      { amount: T.tax, threshold: C.taxShareMin, source: 'Методические рекомендации Банка России № 18-МР' });

    // 4.5 Быстрый проход всего оборота при малых налогах (860-П, код 1414)
    if (T.inCp >= C.taxShareMinTurnover && taxShare < C.taxShareMin) {
      var inf2 = ops.filter(function (o) { return o.dir === 'in' && o.kind === 'counterparty'; }).map(function (o) { return { t: o.t, left: o.sum }; });
      var passed = 0;
      ops.forEach(function (o) {
        if (o.dir !== 'out' || o.kind === 'tax' || o.kind === 'own') return;
        var need = o.sum;
        for (var j = 0; j < inf2.length && need > 0; j++) {
          var f = inf2[j];
          if (f.t > o.t || f.left <= 0 || addWorkDays(f.t, C.passDays) < o.t) continue;
          var tk = Math.min(f.left, need); f.left -= tk; need -= tk; passed += tk;
        }
      });
      var passShare = passed / T.inCp;
      if (passShare >= C.passShare) add('pass_through', 2, passShare, { amount: passed, source: 'Положение Банка России № 860-П, код 1414' });
    }

    // 4.6 Операции с наличными от 1 млн ₽ (ст. 6 115-ФЗ)
    if (bigOps.length) add('big_cash', 1, bigOps.length, { amount: bigOps.reduce(function (s, o) { return s + o.sum; }, 0), source: 'ст. 6 Федерального закона № 115-ФЗ', note: client.isIP ? 'ip' : 'org' });

    // 4.7 Резкий рост доли наличных в месяце
    if (monthList.length >= 2) {
      var worst = null;
      for (var mi = 1; mi < monthList.length; mi++) {
        var prev = monthList.slice(0, mi), pOut = 0, pCash = 0;
        prev.forEach(function (q) { pOut += q.outAll; pCash += q.cashOut; });
        var avg = pOut ? pCash / pOut : 0, mm = monthList[mi];
        if (mm.cashOut >= C.growthMinCash && mm.cashShare >= Math.max(avg * C.growthFactor, 0.05) && (!worst || mm.cashShare / (avg || 0.01) > worst.k)) worst = { m: mm, avg: avg, k: mm.cashShare / (avg || 0.01) };
      }
      if (worst) add('cash_growth', 1, worst.m.cashShare, { month: worst.m.key, avg: worst.avg, amount: worst.m.cashOut, source: 'ориентир Делоскопа' });
    }

    // 4.8 ИП выводит себе почти всё
    if (client.isIP && T.inCp) {
      var selfShare = (T.self + T.cashOut) / T.inCp;
      if (selfShare >= C.ipSelfAttention) add('ip_self', selfShare >= C.ipSelfDanger && taxShare < C.taxShareMin ? 2 : 1, selfShare,
        { amount: T.self + T.cashOut, source: 'ориентир Делоскопа; письма Банка России о переводах ИП «себе»' });
    }

    // 4.9 Переводы физлицам вне зарплаты (поимённо не храним — только число)
    var personCount = Object.keys(persons).length;
    if (T.outAll && T.person / T.outAll >= C.personsShare && personCount >= C.personsMinCount)
      add('persons', 1, T.person / T.outAll, { amount: T.person, count: personCount, source: 'ориентир Делоскопа' });

    // 4.10 Взносы наличных (1-МР от 20.05.2026)
    if (T.cashIn > 0) {
      var cashIns = ops.filter(function (o) { return o.kind === 'cash_in'; }), peak = 0, peakEnd = 0;
      cashIns.forEach(function (o) {
        var s = 0; cashIns.forEach(function (q) { if (q.t <= o.t && q.t > o.t - C.depositWindowDays * DAY) s += q.sum; });
        if (s > peak) { peak = s; peakEnd = o.t; }
      });
      var before = ops.filter(function (o) { return o.dir === 'in' && o.kind !== 'own' && o.t <= peakEnd - C.depositWindowDays * DAY && o.t > peakEnd - (C.depositWindowDays + 90) * DAY; })
        .reduce(function (s, o) { return s + o.sum; }, 0) / 3;
      var cashInShare = T.inAll ? T.cashIn / T.inAll : 0;
      if (peak >= C.depositLimit && (!before || peak >= before * C.depositVsAvg)) add('deposit_big', 2, peak, { avg: before, source: 'Методические рекомендации Банка России № 1-МР от 20.05.2026' });
      else if (!opts.cashBusiness && cashInShare >= C.depositShareAttention) add('deposit_share', 1, cashInShare, { amount: T.cashIn, source: 'ориентир Делоскопа; 1-МР от 20.05.2026' });
    }

    // 4.11 Наличные без следа: «хознужды», «прочие выдачи», подотчёт
    var months_n = Math.max(monthList.length, 1);
    if (T.vague / months_n >= C.vagueMonthly) add('vague_cash', 1, T.vague, { risk: T.vague * C.hiddenSalaryRate, source: 'ст. 210, 226 НК РФ; гл. 34 НК РФ (страховые взносы)' });

    // 4.12 Нет обычных расходов бизнеса
    if (T.outAll >= C.ordinaryMinDebit && T.ordinary === 0) add('no_ordinary', 1, 0, { source: 'Положение Банка России № 860-П; 18-МР' });

    /* ---------- уровень и деньги ---------- */
    var active = S.filter(function (s) { return s.level > 0; });
    var dangers = active.filter(function (s) { return s.level === 2; }).length;
    var level = dangers || active.length >= 3 ? 2 : active.length ? 1 : 0;
    // «Спокойно» при нулевой активности подтверждаем сильными сторонами
    var strengths = [];
    if (cashShare < C.cashShareAttention) strengths.push('cash_low');
    if (T.inCp >= C.taxShareMinTurnover && taxShare >= C.taxShareMin) strengths.push('tax_ok');
    if (T.ordinary > 0) strengths.push('ordinary_ok');
    if (T.salary > 0) strengths.push('salary_card');
    if (transitShare < C.transitAttention && T.inCp) strengths.push('no_transit');

    var endBalance = 0;
    p.sections.forEach(function (s) { endBalance += num(s.КонечныйОстаток); });
    var dailyIn = T.inAll / workDays;
    var money = {
      balance: r2(endBalance),
      inflowAtStake: r2(dailyIn * C.blockWorkDays),
      blockDays: C.blockWorkDays,
      hiddenSalaryRisk: r2(T.vague * C.hiddenSalaryRate)
    };
    money.atStake = r2(money.balance + money.inflowAtStake);

    // Три дела на неделю: сначала опасные, затем по деньгам
    var order = active.slice().sort(function (a, b) { return b.level - a.level || (b.amount || 0) - (a.amount || 0); });
    var todo = order.slice(0, 3).map(function (s) { return s.id; });

    return {
      version: C.version,
      client: client,
      period: { start: start, end: end, months: monthList.length, workDays: workDays },
      accounts: p.accounts.length,
      counts: { docs: p.docs.length, ops: ops.length, skipped: cl.skipped, persons: personCount },
      totals: Object.keys(T).reduce(function (o, k) { o[k] = r2(T[k]); return o; }, {}),
      shares: { cash: cashShare, tax: taxShare, transit: transitShare },
      months: monthList.map(function (m) { return { key: m.key, outAll: r2(m.outAll), cashOut: r2(m.cashOut), cashIn: r2(m.cashIn), self: r2(m.self), tax: r2(m.tax), inAll: r2(m.inAll), cashShare: m.cashShare }; }),
      signals: S,
      level: level,
      strengths: strengths,
      todo: todo,
      money: money,
      warnings: p.warnings.slice()
    };
  }

  /* ================= 5. Выбор варианта текста ================= */
  function pickVariant(list, clientInn, id) {
    if (!list || !list.length) return '';
    return list[hash(String(clientInn) + '|' + id) % list.length];
  }
  function fill(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
  }

  return {
    CONFIG: CONFIG, decode: decode, parse1C: parse1C, detectClient: detectClient,
    classify: classify, analyze: analyze, pickVariant: pickVariant, fill: fill,
    _util: { parseDate: parseDate, addWorkDays: addWorkDays, innOk: innOk, hash: hash, num: num }
  };
});
