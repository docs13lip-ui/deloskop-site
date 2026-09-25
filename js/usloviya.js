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
  // Круглые ориентиры, вниз: 87 400 → 80 000; 1 237 000 → 1 200 000.
  function niceFloor(x) {
    if (!(x > 0)) return 0;
    var step = x < 100000 ? 10000 : x < 1000000 ? 50000 : x < 10000000 ? 100000 : 1000000;
    return Math.max(10000, Math.floor(x / step) * step);
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
      if (/выручк/i.test(x.label || '') && typeof x.value === 'number' && x.value > 0) f.revenue = x.value;
      if (/сотрудник|численност|штат/i.test(x.label || '') && typeof x.value === 'number') f.staff = x.value;
    });
    if (f.ageMonths != null && f.ageMonths < 12) f.warn.young = (f.warn.young || 0) + 1;
    return f;
  }

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
    if (heavy || f.level === 'high' || warns >= 3) return 'post';
    if (warns || f.level === 'medium' || f.zsk === 'medium' || f.status === 'REORGANIZING') return 'cap';
    return 'go';
  }

  // Предел предоплаты — собственное правило Делоскопа:
  //  • выручка известна → не больше двух недель выручки (выручка / 26);
  //  • выручка неизвестна → по возрасту: до 6 мес — 100 тыс., до года — 300 тыс., до 3 лет — 1 млн, старше — 3 млн;
  //  • компании младше года — никогда не больше возрастного потолка;
  //  • тон «можно с пределом» — половина; «только по факту» и «стоп» — ноль.
  function prepayCap(f, t) {
    if (t === 'post' || t === 'stop') return { cap: 0, rule: t === 'stop' ? 'Вперёд не платить' : 'Оплата только по факту' };
    var byAge = f.ageMonths == null ? 1000000 : f.ageMonths < 6 ? 100000 : f.ageMonths < 12 ? 300000 : f.ageMonths < 36 ? 1000000 : 3000000;
    var cap, rule;
    if (f.revenue) {
      cap = f.revenue / 26; rule = 'не больше двух недель выручки компании';
      if (f.ageMonths != null && f.ageMonths < 12 && byAge < cap) { cap = byAge; rule = 'потолок для компании младше года'; }
    } else { cap = byAge; rule = f.ageMonths == null ? 'осторожный потолок — выручка и возраст неизвестны' : 'потолок по возрасту компании (выручка неизвестна)'; }
    if (t === 'cap') { cap = cap / 2; rule += ', вдвое меньше из-за замечаний'; }
    return { cap: niceFloor(cap), rule: rule };
  }

  function reasonText(x) {
    var d = String(x.detail || '').trim();
    var generic = !d || /^(да|есть|внимание|нет данных|—)$/i.test(d);
    return generic ? x.title : x.title + ': ' + d.charAt(0).toLowerCase() + d.slice(1);
  }
  function reasons(f) {
    var out = [];
    if (f.status === 'LIQUIDATED') out.push('компания ликвидирована');
    else if (f.status === 'LIQUIDATING') out.push('компания ликвидируется');
    else if (f.status === 'BANKRUPT') out.push('идёт банкротство');
    else if (f.status === 'REORGANIZING') out.push('идёт реорганизация');
    var order = ['diskv', 'nedost', 'block', 'exit', 'dolg', 'mass', 'fssp', 'rnp', 'director', 'staff', 'report', 'nagruzka', 'fines', 'other', 'young'];
    var pick = f.list.slice().sort(function (a, b) {
      return (a.status === b.status ? 0 : a.status === 'bad' ? -1 : 1) || order.indexOf(a.kind) - order.indexOf(b.kind);
    });
    if (f.zsk === 'high') out.push('высокий прогноз попадания в красную зону ЗСК');
    pick.forEach(function (x) { if (out.length < 3 && x.kind !== 'young') out.push(reasonText(x).replace(/^./, function (c) { return c.toLowerCase(); })); });
    if (f.ageMonths != null && f.ageMonths < 12 && out.length < 3) out.push('компании ' + ageText(f.ageMonths));
    if (f.staff === 0 || f.staff === 1) { if (out.length < 3) out.push(f.staff ? 'в штате 1 человек' : 'в штате никого'); }
    if (f.zsk === 'medium' && out.length < 3) out.push('средний прогноз ЗСК');
    return out.slice(0, 3);
  }

  function headline(f, t, cap) {
    if (f.status === 'LIQUIDATED') return 'Сделку не заключать';
    if (t === 'stop') return 'Не платите вперёд';
    if (t === 'post') return 'Только оплата по факту';
    if (t === 'cap') return 'Можно, предоплата — до ' + money(cap);
    return 'Работать можно';
  }
  function advice(f, t) {
    if (f.status === 'LIQUIDATED') return 'Компания исключена из реестра: договор с ней недействителен, счёт не принимайте.';
    if (f.status === 'BANKRUPT') return 'Платежи по новым сделкам — только по согласованию с арбитражным управляющим и после поставки.';
    if (f.status === 'LIQUIDATING') return 'Товар — только после поставки: ликвидатор вправе не исполнять новые обязательства.';
    if (t === 'stop') return 'Если сделка нужна — платите после поставки или через аккредитив и сохраните это досье.';
    if (t === 'post') return 'Платите после поставки или акта. Нужна предоплата — через аккредитив или под гарантию возврата аванса.';
    if (t === 'cap') return 'Больше предела — частями по этапам, аккредитивом или под гарантию возврата аванса.';
    return 'Сохраните досье: это ваше доказательство должной осмотрительности.';
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

  function prepayAdvice(amount, cap, t) {
    amount = parseAmount(amount);
    if (!amount) return '';
    if (t === 'stop' || t === 'post' || cap === 0) return 'Предоплату не вносите: ' + money(amount) + ' — после поставки или через аккредитив.';
    if (t === 'go' && amount <= cap) return 'Сумма в пределах ориентира — обычные условия подойдут.';
    if (amount <= cap) return 'Сумма в пределах ориентира: предоплата допустима.';
    var p = Math.max(1, Math.floor(cap / amount * 100));
    return 'Вперёд — не больше ' + money(cap) + ' (' + p + '% суммы), остальное — после поставки.';
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
    license: { t: 'Лицензия или выписка из СРО, если работа этого требует', why: 'строительство, перевозки, медицина — без допуска сделку могут признать недействительной', ask: 'Лицензия или выписка из реестра СРО — если работы по договору этого требуют' }
  };

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
    return ids.slice(0, 7).map(function (id) { return { id: id, title: DOCS[id].t, why: DOCS[id].why, ask: DOCS[id].ask || DOCS[id].t, links: DOCS[id].links || [] }; });
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

  function decide(r, opts) {
    opts = opts || {};
    var f = facts(r), t = tone(f), pc = prepayCap(f, t), amount = parseAmount(opts.amount), regime = opts.regime || 'osno';
    var list = docs(f, t, amount, regime);
    return {
      facts: f, tone: t, cap: pc.cap, capRule: pc.rule,
      headline: headline(f, t, pc.cap), reasons: reasons(f), advice: advice(f, t),
      amount: amount, regime: regime, stake: atStake(amount, regime), prepay: prepayAdvice(amount, pc.cap, t),
      docs: list, letter: letter(f, list, amount)
    };
  }

  // ---------- интерфейс ----------
  var CSS = '' +
    '.usl{border-radius:18px;background:var(--bg,#F5F5F2);padding:18px 18px 16px;display:flex;flex-direction:column;gap:12px;color:var(--ink,#1D1D1F)}' +
    '.usl-h{display:flex;gap:12px;align-items:flex-start}' +
    '.usl-mark{flex:none;width:12px;height:12px;border-radius:50%;margin-top:7px;box-shadow:0 0 0 4px rgba(22,114,63,.14);background:#16723F}' +
    '.usl.cap .usl-mark{background:#C27A00;box-shadow:0 0 0 4px rgba(194,122,0,.16)}' +
    '.usl.post .usl-mark,.usl.stop .usl-mark{background:#B3261E;box-shadow:0 0 0 4px rgba(179,38,30,.14)}' +
    '.usl-t{font-size:19px;line-height:1.3;font-weight:600;letter-spacing:-.01em}' +
    '.usl-r{margin:4px 0 0;font-size:14.5px;color:var(--ink2,#48484C)}' +
    '.usl-a{margin:0;font-size:14.5px;color:var(--ink2,#48484C)}' +
    '.usl-cap{font-size:12.5px;color:var(--muted,#6B6B70)}' +
    '.usl-sum{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;border-top:1px solid #E6E6E1;padding-top:12px}' +
    '.usl-sum label{font-size:13px;color:var(--muted,#6B6B70);grid-column:1/-1}' +
    '.usl-in{display:flex;align-items:center;background:#fff;border:1px solid #DADAD4;border-radius:12px;padding:0 12px;min-width:0}' +
    '.usl-in:focus-within{border-color:var(--accent,#0B63E5);box-shadow:0 0 0 3px rgba(11,99,229,.15)}' +
    '.usl-in input{border:0;outline:0;font:inherit;font-size:16px;padding:10px 0;width:100%;min-width:0;background:transparent;font-variant-numeric:tabular-nums}' +
    '.usl-in span{color:var(--muted,#6B6B70)}' +
    '.usl select{font:inherit;font-size:14px;border:1px solid #DADAD4;border-radius:12px;padding:10px 30px 10px 12px;background:#fff;max-width:190px;color:inherit}' +
    '.usl-out{display:flex;flex-direction:column;gap:6px;font-size:14.5px}' +
    '.usl-out b{font-variant-numeric:tabular-nums}' +
    '.usl-out .z{color:var(--ok,#16723F)}' +
    '.usl details{border-top:1px solid #E6E6E1;padding-top:10px}' +
    '.usl summary{cursor:pointer;font-weight:600;font-size:15px;list-style:none;display:flex;justify-content:space-between;gap:10px}' +
    '.usl summary::-webkit-details-marker{display:none}' +
    '.usl summary:after{content:"";width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin:5px 4px 0 0;transition:transform .2s}' +
    '.usl details[open] summary:after{transform:rotate(-135deg);margin-top:9px}' +
    '.usl summary small{font-weight:400;color:var(--muted,#6B6B70);font-size:13px;margin-left:6px}' +
    '.usl ol{margin:10px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:8px;font-size:14.5px}' +
    '.usl ol span{display:block;color:var(--muted,#6B6B70);font-size:13px}' +
    '.usl ol a{color:var(--accent,#0B63E5);text-decoration:none;overflow-wrap:anywhere}.usl ol a:hover{text-decoration:underline}' +
    '.usl-note{font-size:12.5px;color:var(--muted,#6B6B70);margin:10px 0 0}' +
    '.usl-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}' +
    '.usl-btns button,.usl-btns a{border:1px solid #D9D9D4;background:#fff;font:inherit;font-size:14px;font-weight:600;border-radius:11px;padding:9px 14px;cursor:pointer;color:var(--ink,#1D1D1F);text-decoration:none}' +
    '.usl-btns button:hover,.usl-btns a:hover{border-color:var(--accent,#0B63E5);color:var(--accent,#0B63E5)}' +
    '@media (max-width:520px){.usl{padding:16px 14px}.usl-t{font-size:17.5px}.usl-sum{grid-template-columns:1fr}.usl select{max-width:none;width:100%}}' +
    '@media print{.usl .usl-sum,.usl .usl-btns,.usl summary:after{display:none!important}.usl details>*{display:block}.usl{background:none;border:1px solid #E6E6E1}}';

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function injectCss(doc) {
    if (doc.getElementById('usl-css')) return;
    var s = doc.createElement('style'); s.id = 'usl-css'; s.textContent = CSS; doc.head.appendChild(s);
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } }

  // mount(el, r, {compact, open}) — рисует карточку в el, возвращает объект с методом update().
  function mount(el, r, o) {
    o = o || {};
    if (!r || !r.company || !r.company.inn) throw new Error('usloviya: нет данных о компании');
    var doc = el.ownerDocument; injectCss(doc);
    var uid = 'usl' + Math.random().toString(36).slice(2, 7);
    var st = { amount: o.amount || 0, regime: store('usl.regime') || 'osno' };
    var box = doc.createElement('section');
    box.setAttribute('aria-label', 'Условия сделки');
    el.innerHTML = ''; el.appendChild(box);

    function draw(keepFocus) {
      var v = decide(r, st), f = v.facts;
      box.className = 'usl ' + v.tone;
      var why = v.reasons.length ? v.reasons.join(', ') : (r && r.verdict ? String(r.verdict).replace(/^Вывод:\s*/i, '') : '');
      var capLine = v.cap ? 'Предел предоплаты — ориентир Делоскопа, не норма закона: ' + v.capRule + '.' : '';
      var stake = '';
      if (v.stake) {
        stake = v.stake.zero
          ? '<div class="z">На вашем режиме расходы не уменьшают налог — налоговый риск по этому поставщику нулевой. Остаются риск денег и 115-ФЗ.</div>'
          : '<div>На кону при претензии налоговой: <b>' + (v.stake.soft ? money(v.stake.soft).replace(/\s₽$/, '') + '–' : 'до\u00a0') + money(v.stake.hard) + '</b> плюс пени. Досье Делоскопа — ваш довод, что поставщика проверили.</div>';
      }
      var sel = REGIMES.map(function (x) { return '<option value="' + x.id + '"' + (x.id === st.regime ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('');
      var openAttr = o.open ? ' open' : '';
      box.innerHTML =
        '<div class="usl-h"><span class="usl-mark" aria-hidden="true"></span><div>' +
          '<div class="usl-t">' + esc(v.headline) + '</div>' +
          (why ? '<p class="usl-r">' + esc(why.charAt(0).toUpperCase() + why.slice(1)) + '.</p>' : '') +
        '</div></div>' +
        '<p class="usl-a">' + esc(v.advice) + '</p>' +
        (o.compact ? '' :
        '<div class="usl-sum"><label for="' + uid + 'a">Сумма сделки — посчитаем предоплату и деньги на кону</label>' +
          '<div class="usl-in"><input id="' + uid + 'a" inputmode="numeric" autocomplete="off" placeholder="например, 500 000" value="' + (st.amount ? esc(money(st.amount).replace(/ ₽$/, '')) : '') + '"><span>₽</span></div>' +
          '<select aria-label="Ваш режим налогов">' + sel + '</select></div>' +
        (v.amount ? '<div class="usl-out" aria-live="polite"><div>' + esc(v.prepay) + '</div>' + stake + '</div>' : '')) +
        (capLine && !o.compact ? '<div class="usl-cap">' + esc(capLine) + '</div>' : '') +
        '<details' + openAttr + '><summary><span>Что запросить у них<small>' + v.docs.length + ' ' + plural(v.docs.length, 'документ', 'документа', 'документов') + '</small></span></summary>' +
          '<ol>' + v.docs.map(function (d) { return '<li>' + esc(d.title) + '<span>' + esc(d.why) + (d.links.length ? ' · ' + d.links.map(function (l) { return '<a href="' + esc(l.u) + '"' + (/^https?:/.test(l.u) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(l.t) + '</a>'; }).join(', ') : '') + '</span></li>'; }).join('') + '</ol>' +
          '<p class="usl-note">Список соразмерен сумме сделки — так требует п. 16 письма ФНС от 10.03.2021 № БВ-4-7/3060@.</p>' +
          '<div class="usl-btns"><button type="button" data-u="copy">Скопировать письмо</button>' +
          '<a data-u="mail" href="mailto:?subject=' + encodeURIComponent(v.letter.subject) + '&body=' + encodeURIComponent(v.letter.body) + '">Открыть в почте</a></div>' +
        '</details>';
      var inp = box.querySelector('input'), s = box.querySelector('select');
      if (inp) {
        inp.addEventListener('input', function () {
          var pos = inp.value.length; st.amount = parseAmount(inp.value);
          clearTimeout(inp._t); inp._t = setTimeout(function () { draw(true); }, 350);
          void pos;
        });
        if (keepFocus) { inp.focus(); var L = inp.value.length; try { inp.setSelectionRange(L, L); } catch (_) {} }
      }
      if (s) s.addEventListener('change', function () { st.regime = s.value; store('usl.regime', s.value); draw(); });
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
    decide: decide, mount: mount, facts: facts, tone: tone, prepayCap: prepayCap, atStake: atStake,
    docs: docs, letter: letter, parseAmount: parseAmount, money: money, niceFloor: niceFloor, kindOf: kindOf,
    RATES: { VAT: VAT, PROFIT: PROFIT, USN_DR: USN_DR }
  };
});
