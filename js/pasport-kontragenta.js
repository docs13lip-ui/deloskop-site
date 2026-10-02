/*!
 * Делоскоп · «Паспорт контрагента» v2 — документ из 17 разделов (Г2, приказ владельца 29.09 «Паспорт — максимально солидный»).
 * Эталон разделов и контракт — claude/Данные_глубина_Паспорт_эталон_карта_DaData_29.09.md, разд. 4.
 * Собирается в браузере из ответа /api/report/{id} (тот же ответ, что у «Досье контрагента») —
 * без новых запросов к базам и без траты проверок. Когда сервер начнёт отдавать /api/pasport/{inn}
 * по тому же контракту, страница возьмёт его как есть (функция sobrat пропускает готовый ответ).
 * Правила солидности (держат тесты tests/pasport_kontragenta.test.js):
 *  • у раздела со сведениями — источник и дата; «не проверяли» ≠ «не нашли»;
 *  • раздел 16 «Чего мы не знаем» не бывает пустым;
 *  • «на кону» — только с формулой; ИП — Паспорт не выпускаем; без флага persons — ни одного ФИО;
 *  • «нет» — только с реестром и датой (Ф8, 30.09): «нет» без даты сведений — не проверка, а «не проверяли».
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PasportKontragenta = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var VERSIYA = 'Паспорт v2.7';
  // Определение Индекса и подпись предела аванса — дословно [Юриста 115-ФЗ] 29.09 (222-ФЗ), разд. 3 пп. 1 и 4.
  var OPREDELENIE_INDEKSA = 'Индекс Делоскопа — оценка признаков риска для сделки по открытым и лицензированным данным: регистрационных, налоговых, признаков по 115-ФЗ и нарушений. Это не кредитный рейтинг и не мнение о способности компании исполнять финансовые обязательства.';
  var PODPIS_PREDELA = 'Сколько разумно платить вперёд с учётом найденных признаков — расчёт Делоскопа по открытой формуле. Это не оценка способности компании вернуть деньги.';
  // Подвал экрана и PDF — дословно [Юриста 115-ФЗ] 29.09, разд. 1; адрес формы — help@ до страницы «Сообщить об ошибке».
  function podval(sformirovan, nomer) {
    return 'Паспорт сформирован Делоскопом ' + sformirovan + ' по сведениям источников, указанным в каждом разделе, на даты, указанные там же. ' +
      'Это оценка признаков по открытым и лицензированным данным, а не заключение о надёжности или платёжеспособности компании и не гарантия исхода сделки. ' +
      'Если данных нет, мы пишем «не проверяли», а не «не нашли». Подлинность документа — по QR-коду или на deloskop.ru/pasport/proverka/ по номеру ' + nomer + '. ' +
      'Ошибка в сведениях — напишите на help@deloskop.ru, укажите номер Паспорта.';
  }
  var ST = { ACTIVE: 'Действующая', LIQUIDATING: 'Ликвидируется или исключается из ЕГРЮЛ', LIQUIDATED: 'Ликвидирована', BANKRUPT: 'Банкротство', REORGANIZING: 'Реорганизация' };

  // 17 разделов эталона. vid: istochnik — сведения первоисточника (●), raschet — расчёт Делоскопа (◐), sluzhebnyj — о самом документе.
  var RAZDELY = [
    { id: 'rekvizity', n: 1, title: 'Реквизиты и статус', vid: 'istochnik', istochnik: 'ЕГРЮЛ', dostup: 'free',
      prichina: 'Реквизитов и статуса в полученных сведениях нет — посмотрите их в выписке ЕГРЮЛ.',
      sam: [['egrul.nalog.ru', 'https://egrul.nalog.ru/', 'выписка ЕГРЮЛ: реквизиты и статус']] },
    { id: 'istoriya', n: 2, title: 'История изменений', vid: 'istochnik', istochnik: 'ЕГРЮЛ, наблюдение Делоскопа', dostup: 'pro',
      prichina: 'Историю изменений ведём с первой проверки компании в Делоскопе: смена директора, адреса или учредителей появится здесь при следующих проверках.',
      sam: [['egrul.nalog.ru', 'https://egrul.nalog.ru/', 'у каждой записи в выписке — дата внесения (ГРН): видно, когда сменились директор и адрес']] },
    { id: 'lyudi', n: 3, title: 'Руководитель и учредители', vid: 'istochnik', istochnik: 'ЕГРЮЛ', dostup: 'free',
      prichina: 'Руководителя и учредителей в полученных сведениях нет — посмотрите их в выписке ЕГРЮЛ.',
      sam: [['egrul.nalog.ru', 'https://egrul.nalog.ru/', 'руководитель и учредители']] },
    { id: 'svyazi', n: 4, title: 'Связи и группа компаний', vid: 'raschet', istochnik: 'расчёт Делоскопа по ЕГРЮЛ', dostup: 'pro',
      prichina: 'Связи через руководителей и учредителей считаем по всей базе ЕГРЮЛ — покажем, когда база загрузится целиком (октябрь 2026). Неполную картину выдавать за полную не будем.' },
    { id: 'deyatelnost', n: 5, title: 'Деятельность: виды, лицензии, допуски', vid: 'istochnik', istochnik: 'ЕГРЮЛ, реестры лицензий', dostup: 'free',
      prichina: 'Видов деятельности и лицензий в полученных сведениях нет — посмотрите их в выписке ЕГРЮЛ.',
      sam: [['egrul.nalog.ru', 'https://egrul.nalog.ru/', 'виды деятельности и сведения о лицензиях']] },
    { id: 'finansy', n: 6, title: 'Финансы и штат', vid: 'istochnik', istochnik: 'ГИР БО, открытые данные ФНС', dostup: 'pro',
      prichina: 'Бухгалтерской отчётности в полученных сведениях нет: компания могла её не сдавать или ещё не должна была сдать.',
      sam: [['bo.nalog.gov.ru', 'https://bo.nalog.gov.ru/', 'ГИР БО: бухгалтерская отчётность по годам']] },
    { id: 'nalogi', n: 7, title: 'Налоги: режим, уплачено, долги', vid: 'istochnik', istochnik: 'открытые данные ФНС', dostup: 'free',
      prichina: 'Сведений ФНС о налогах, долгах и штрафах в ответе нет — наборы ФНС ещё загружаются.',
      sam: [['pb.nalog.ru', 'https://pb.nalog.ru/', '«Прозрачный бизнес» ФНС: режим, уплаченные налоги, недоимки, штат']] },
    { id: 'sudy', n: 8, title: 'Арбитражные суды и банкротство', vid: 'istochnik', istochnik: 'картотека арбитражных дел, Федресурс', dostup: 'free', damia: ['sudy', 'bankrotstvo'],
      prichina: 'Не проверяли: картотеку арбитражных дел и сообщения о банкротстве мы пока не подключили.',
      sam: [['kad.arbitr.ru', 'https://kad.arbitr.ru/', 'дела, где компания истец или ответчик'], ['bankrot.fedresurs.ru', 'https://bankrot.fedresurs.ru/', 'сообщения о банкротстве и намерении кредитора']] },
    { id: 'scheta', n: 9, title: 'Счета: приостановки и обеспечительные меры ФНС', vid: 'istochnik', istochnik: 'ФНС: решения о приостановлении операций', dostup: 'pro', damia: ['priostanovki', 'mery'],
      prichina: 'Проверяется по паре «ИНН компании + БИК её банка». Проверьте сами — бесплатно на сайте ФНС service.nalog.ru/bi.do, БИК возьмите из счёта; ответ ФНС видите только вы. Ограничения банков по 115-ФЗ не публикуются нигде.',
      sam: [['service.nalog.ru/bi.do', 'https://service.nalog.ru/bi.do', 'решения ФНС о приостановлении операций: ИНН + БИК']] },
    { id: 'pristavy', n: 10, title: 'Исполнительные производства', vid: 'istochnik', istochnik: 'ФССП', dostup: 'free', damia: ['fssp'],
      prichina: 'Не проверяли: банк данных исполнительных производств мы пока не подключили. В базе ФССП юрлицо ищут по названию и региону.',
      sam: [['fssp.gov.ru/iss/ip', 'https://fssp.gov.ru/iss/ip', 'банк данных исполнительных производств']] },
    { id: 'goszakaz', n: 11, title: 'Госзаказ: контракты и РНП', vid: 'istochnik', istochnik: 'ЕИС «Закупки»', dostup: 'free', damia: ['kontrakty', 'rnp'],
      prichina: 'Не проверяли: реестр недобросовестных поставщиков и госконтракты мы пока не подключили.',
      sam: [['zakupki.gov.ru — РНП', 'https://zakupki.gov.ru/epz/dishonestsupplier/search/results.html', 'реестр недобросовестных поставщиков'], ['zakupki.gov.ru — контракты', 'https://zakupki.gov.ru/epz/contract/search/results.html', 'госконтракты компании']] },
    { id: 'stoplisty', n: 12, title: 'Стоп-листы', vid: 'istochnik', istochnik: 'Росфинмониторинг, Банк России', dostup: 'free', vneshnij: true,
      prichina: 'Не проверяли: перечни Росфинмониторинга и список Банка России мы пока не подключили. Красную группу ЗСК автоматически проверить нельзя — сервис Банка России закрыт капчей и показывает ответ только тому, кто спросил. Проверьте сами: это займёт полминуты, ИНН скопируйте кнопкой ниже. Жёлтую группу публично не узнать нигде — только в своём банке.',
      sam: [['cbr.ru — проверка по ИНН', 'https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/', 'Банк России: есть ли сведения о высоком (красном) уровне риска по ЗСК'],
        ['cbr.ru — список нелегальных', 'https://www.cbr.ru/inside/warning-list/', 'Банк России: компании с признаками нелегальной деятельности на финансовом рынке'],
        ['fedsfm.ru — перечень', 'https://www.fedsfm.ru/documents/terrorists-catalog-portal-act', 'Росфинмониторинг: перечень организаций, связанных с экстремизмом или терроризмом']] },
    { id: 'indeks', n: 13, title: 'Индекс Делоскопа', vid: 'raschet', istochnik: 'методика Индекса, deloskop.ru/indeks/', dostup: 'free' },
    { id: 'predel', n: 14, title: 'Предел аванса и как посчитали', vid: 'raschet', istochnik: 'открытая формула Делоскопа', dostup: 'free' },
    { id: 'zaprosit', n: 15, title: 'Что запросить у контрагента', vid: 'raschet', istochnik: 'письмо ФНС от 10.03.2021 № БВ-4-7/3060@, ст. 54.1 НК', dostup: 'pro' },
    { id: 'ne_znaem', n: 16, title: 'Чего мы не знаем и почему', vid: 'sluzhebnyj', istochnik: 'Делоскоп', dostup: 'free' },
    { id: 'podlinnost', n: 17, title: 'Как проверить этот Паспорт', vid: 'sluzhebnyj', istochnik: 'Делоскоп', dostup: 'free' }
  ];

  // Признак из ответа сервера → раздел. Порядок важен: первое совпадение.
  var KUDA = [
    ['stoplisty', /перечн|росфинмониторинг|экстремист|террор|санкц|стоп-лист|нелегальн/i],
    ['pristavy', /пристав|исполнительн|фссп/i],
    ['scheta', /приостановл|блокировк|обеспечительн/i],
    ['goszakaz', /недобросовестн|(^|[^а-яё])рнп([^а-яё]|$)|контракт|закупк/i],
    ['sudy', /арбитраж|банкрот|судебн|(^|[^а-яё])суд([^а-яё]|$)|(^|[^а-яё])иск(и|ов|ам)?([^а-яё]|$)/i],
    ['rekvizity', /недостоверн|ликвидац|реорганиз|исключен/i],
    ['lyudi', /дисквалиф|руководител|директор|учредител/i],
    ['svyazi', /массов/i],
    ['deyatelnost', /лиценз|(^|[^а-яё])сро([^а-яё]|$)|деклар|(^|[^а-яё])мсп([^а-яё]|$)|малого|окв[эе]д/i],
    ['finansy', /отч[её]тност|бухгалт|выручк|прибыл|актив|численн|сотрудн|штат/i],
    ['nalogi', /недоимк|задолженн|долг|налог|штраф|правонаруш|спецрежим|усн|взнос|доход/i]
  ];
  function razdelDlya(title) {
    for (var i = 0; i < KUDA.length; i++) if (KUDA[i][1].test(title || '')) return KUDA[i][0];
    return 'rekvizity';
  }

  // Постоянные строки раздела 16 — то, чего не видит ни один открытый источник.
  var VSEGDA_NE_ZNAEM = [
    'Ограничения, которые наложил банк по 115-ФЗ, и зону компании в ЗСК Банка России видят только банки и сама компания — в открытых данных их нет.',
    'Суды общей юрисдикции и мировые судьи — не проверяли: единого открытого реестра по ИНН нет.',
    'Кто на самом деле распоряжается счётом и подписывает документы, по реестрам не установить — сверьте подписанта по доверенности или решению о назначении.'
  ];

  function dataRu(v) {
    if (!v) return '';
    var d = new Date(v); if (isNaN(d)) return String(v);
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear();
  }
  function isIp(r) {
    var c = (r && r.company) || {};
    return c.kind === 'INDIVIDUAL' || String(c.inn || '').replace(/\D/g, '').length === 12;
  }
  // Ф8 (Ночные 30.09): «нет» — утверждение, а не пустое поле. Принимаем его только с датой сведений,
  // кроме ЕГРЮЛ: там отсутствие записи (о недостоверности, о ликвидации) и есть сведения реестра на дату выписки.
  var NET = /^\s*(нет|не\s+(найден|обнаружен|выявлен|значится|числится)\S*|отметок\s+нет|отсутству\S*|сведений\s+нет)(?=[\s.,;:!)]|$)/i;
  function netBezDaty(tekst, znachenie, ton, data, istochnik) {
    if (ton === 'bad' || ton === 'warn' || data) return false;
    if (/^\s*ЕГРЮЛ\s*$/i.test(String(istochnik || ''))) return false;
    return NET.test(String(znachenie || '')) || NET.test(String(tekst || '').replace(/^.*?[—:]\s*/, ''));
  }
  // Дисквалификация: DaData management.disqualified не заполняется (документация DaData, find-party) — «нет» оттуда не проверка.
  // Проверено — только отметка источника (bad/warn) или ответ реестра дисквалифицированных лиц ФНС с датой.
  function diskvalProveren(s) {
    if (!s) return false;
    if (s.status === 'bad' || s.status === 'warn') return true;
    return !!s.as_of && /реестр\S*\s+дисквалифицир/i.test(String(s.source || ''));
  }
  var DISKVAL_SAM = { tekst: 'service.nalog.ru/disqualified.do', url: 'https://service.nalog.ru/disqualified.do', chto: 'поиск по ФИО руководителя' };

  function tonIz(status) { return status === 'bad' ? 'bad' : status === 'warn' ? 'warn' : status === 'ok' ? 'ok' : 'info'; }
  function hudshij(a, b) { var R = { bad: 3, warn: 2, info: 1, ok: 0 }; return (R[b] || 0) > (R[a] || 0) ? b : a; }

  // Детерминированная строка для отпечатка: ключи по алфавиту, без поля hash.
  function kanon(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(kanon).join(',') + ']';
    return '{' + Object.keys(v).filter(function (k) { return k !== 'hash' && v[k] !== undefined; }).sort()
      .map(function (k) { return JSON.stringify(k) + ':' + kanon(v[k]); }).join(',') + '}';
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(''); }
  // SHA-256 от канонической строки Паспорта: браузер — WebCrypto, Node — модуль crypto. Возвращает Promise.
  function otpechatok(p) {
    // Номер и раздел 17 выводятся из отпечатка — в расчёт их не берём (иначе круг).
    var meta = {}; Object.keys(p.meta || {}).forEach(function (k) { if (k !== 'nomer') meta[k] = p.meta[k]; });
    var s = kanon({ meta: meta, itog: p.itog, razdely: (p.razdely || []).filter(function (x) { return x.id !== 'podlinnost'; }) });
    try {
      if (root && root.crypto && root.crypto.subtle && typeof TextEncoder !== 'undefined')
        return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(hex);
    } catch (_) { /* ниже — Node */ }
    try { var c = require('crypto'); return Promise.resolve(c.createHash('sha256').update(s, 'utf8').digest('hex')); }
    catch (_) { return Promise.resolve(null); }
  }
  function otpechatokKratko(h) { return h ? (h.slice(0, 4) + '‑' + h.slice(4, 8) + '‑' + h.slice(8, 12) + '‑' + h.slice(12, 16)).toUpperCase() : ''; }

  function pustoj(def) {
    return { id: def.id, n: def.n, title: def.title, vid: def.vid, dostup: def.dostup, status: 'not_checked', ton: 'info',
      prichina: def.prichina || '', istochnik: def.istochnik, data_svedeniy: null, polucheno: null, fakty: [], vyvod: '', chto_delat: '',
      sam: (def.sam || []).map(function (a) { return { tekst: a[0], url: a[1], chto: a[2] || '' }; }) };
  }

  function sobrat(r, opts) {
    opts = opts || {};
    r = r || {};
    if (r.razdely && r.meta) return r;                       // сервер уже прислал Паспорт по контракту
    var c = r.company || {}, persons = opts.persons !== false;
    var U = opts.usloviya || (root && root.Usloviya) || null, IV = opts.indeksVorota || (root && root.IndeksVorota) || null;
    // Номер — из даты и отпечатка (P.vypustit), без ИНН и без номера досье: по номеру нельзя открыть закрытые сведения.
    var nomer = opts.nomer || null;
    var dostup = opts.dostup || r.dostup || null;           // 'free' — бесплатный уровень: разделы «Про» не собираем вовсе
    var meta = { nomer: nomer, versiya: VERSIYA, sformirovan: r.checked_at || null, inn: c.inn || '', ogrn: c.ogrn || '',
      nazvanie: c.name_short || c.name_full || ('ИНН ' + (c.inn || '')), nazvanie_polnoe: c.name_full || '', provereno: null, indeks: null, demo: !!r.demo };
    if (isIp(r)) {
      return { ip: true, meta: meta, itog: null, razdely: [],
        tekst: 'Паспорт для индивидуальных предпринимателей пока не выпускаем. Проверку ИП смотрите в досье.' };
    }
    var map = {}, spisok = RAZDELY.map(function (d) { var x = pustoj(d); map[d.id] = x; return x; });
    var polucheno = r.checked_at || null;
    function fakt(id, tekst, znachenie, s) {
      var x = map[id]; s = s || {};
      x.fakty.push({ tekst: tekst, znachenie: znachenie == null ? '' : String(znachenie), ton: s.ton || 'info', data: s.data || null, istochnik: s.istochnik || x.istochnik });
      x.status = 'found'; x.prichina = '';
      x.ton = hudshij(x.ton, s.ton || 'info');
      if (s.data && (!x.data_svedeniy || s.data > x.data_svedeniy)) x.data_svedeniy = s.data;
      if (!x.polucheno) x.polucheno = polucheno;
    }

    // 1. Реквизиты — ЕГРЮЛ
    var R1 = [['Полное наименование', c.name_full], ['ИНН', c.inn], ['КПП', c.kpp], ['ОГРН', c.ogrn],
      ['Дата регистрации', dataRu(c.reg_date)], ['Адрес юридического лица', c.address]];
    R1.forEach(function (x) { if (x[1]) fakt('rekvizity', x[0], x[1], { ton: 'info', istochnik: 'ЕГРЮЛ' }); });
    if (c.status) fakt('rekvizity', 'Статус', ST[c.status] || c.status, { ton: c.status === 'ACTIVE' ? 'ok' : 'bad', istochnik: 'ЕГРЮЛ' });

    // 8. Банкротство по ЕГРЮЛ (прочерки, 30.09): запись о банкротстве в ЕГРЮЛ — факт первоисточника.
    // Нет записи — раздел остаётся «не проверяли» (картотеку судов и Федресурс не смотрели), но говорим, что видно по ЕГРЮЛ.
    if (c.status === 'BANKRUPT') fakt('sudy', 'Банкротство по ЕГРЮЛ', 'в ЕГРЮЛ есть запись о процедуре банкротства', { ton: 'bad', istochnik: 'ЕГРЮЛ' }), map.sudy.chastichno = 'картотеку арбитражных дел и сообщения Федресурса не проверяли';
    // Только для действующей: у ликвидированной причину прекращения (в том числе конкурсное производство) даст код статуса — dadata-max-v1.
    else if (c.status === 'ACTIVE') map.sudy.prichina = 'По ЕГРЮЛ записи о банкротстве нет: компания действующая. Картотеку арбитражных дел и сообщения Федресурса мы пока не подключили.';

    // 3. Люди — ФИО только при persons (флаг PERSONS_PUBLIC, п. 92)
    if (c.director_post || c.director_name)
      fakt('lyudi', c.director_post || 'Руководитель', persons ? (c.director_name || 'указан в ЕГРЮЛ') : 'указан в ЕГРЮЛ', { ton: 'info', istochnik: 'ЕГРЮЛ' });

    // 5. Основной вид деятельности
    if (c.okved) fakt('deyatelnost', 'Основной вид деятельности', c.okved + (c.okved_name ? ' — ' + c.okved_name : ''), { ton: 'info', istochnik: 'ЕГРЮЛ' });

    // Признаки из реестров → по разделам
    var diskvalEst = false, neProv = {};
    function neProverili(id, chto) { (neProv[id] = neProv[id] || []).push(chto); }
    (r.signals || []).forEach(function (s) {
      var id = razdelDlya(s.title);
      var det = String(s.detail || '');
      if (/дисквалиф/i.test(String(s.title || ''))) {
        if (!diskvalProveren(s)) return;                      // Ф8: «нет» без реестра ФНС и даты — не факт, ниже станет «не проверяли»
        diskvalEst = true;
      } else if (netBezDaty(s.title, det, tonIz(s.status), s.as_of, s.source)) {
        neProverili(id, '«' + String(s.title || '') + '» — источник ответил без даты сведений, проверкой не считаем'); return;
      }
      if (!persons && id === 'lyudi' && c.director_name) det = det.split(c.director_name).join('руководитель');
      fakt(id, String(s.title || ''), det, { ton: tonIz(s.status), data: s.as_of || null, istochnik: s.source || null });
    });

    // 3. Дисквалификация не проверена → строка «не проверяли» в разделе 3 и в разделе 16 + дорога к реестру ФНС
    if (!diskvalEst) {
      neProverili('lyudi', 'реестр дисквалифицированных лиц ФНС не проверяли — мы его пока не подключили');
      map.lyudi.sam.push(DISKVAL_SAM);
      if (map.lyudi.status === 'not_checked') map.lyudi.prichina = 'Руководителя и учредителей в полученных сведениях нет — посмотрите их в выписке ЕГРЮЛ. Реестр дисквалифицированных лиц ФНС мы тоже не проверяли.';
    }
    Object.keys(neProv).forEach(function (id) {
      var x = map[id]; if (!x) return;
      var t = neProv[id].join('; ');
      if (x.status === 'found') x.chastichno = x.chastichno ? x.chastichno + '; ' + t : t;
      else if (id !== 'lyudi') x.prichina = (x.prichina ? x.prichina + ' ' : '') + 'Не проверяли: ' + t + '.';
    });

    // 6. Финансы из досье (ГИР БО)
    var D = r.dossier || {};
    (D.kpi || []).forEach(function (k) {
      if (!k || !k.label) return;
      var v = k.text || (typeof k.value === 'number' && U ? U.money(k.value) : k.value);
      if (v == null || v === '') return;
      fakt(razdelDlya(k.label) === 'nalogi' ? 'nalogi' : 'finansy', k.label, v, { ton: 'info', istochnik: 'ГИР БО, ФНС' });
    });
    if (D.charts && D.charts.revenue && D.charts.revenue.length && U) {
      var rv = D.charts.revenue.slice(-5).map(function (x) { return x.year + ' — ' + U.money(x.value); }).join(' · ');
      fakt('finansy', 'Выручка по годам', rv, { ton: 'info', istochnik: 'ГИР БО' });
    }

    // 8–11. Блоки DaMIA по контракту Арт-директора 27.09 (status, itog, znachenie, prichina, istochnik, data_svedeniy)
    var dm = r.damia || {};
    spisok.forEach(function (x) {
      var def = RAZDELY[x.n - 1]; if (!def.damia) return;
      var st = [], ist = [];
      def.damia.forEach(function (k) {
        var b = dm[k]; if (!b || !b.status) return;
        st.push(b.status); if (b.istochnik) ist.push(b.istochnik);
        if (b.status === 'found') fakt(x.id, b.itog || b.metka || 'Сведения найдены', b.znachenie || '', { ton: b.uroven === 'bad' || b.uroven === 'high' ? 'bad' : 'warn', data: b.data_svedeniy || null, istochnik: b.istochnik || null });
        else if (b.status === 'not_found' && b.data_svedeniy && x.status !== 'found') {
          x.status = 'not_found'; x.ton = 'ok'; x.data_svedeniy = b.data_svedeniy; x.polucheno = polucheno;
          x.fakty.push({ tekst: b.itog || 'Сведений не найдено', znachenie: '', ton: 'ok', data: b.data_svedeniy, istochnik: b.istochnik || x.istochnik });
          x.prichina = '';
        } else if (b.status === 'not_applicable' && x.status === 'not_checked') { x.status = 'not_applicable'; x.prichina = b.prichina || 'Не применяется к этой компании.'; }
        else if (b.status === 'not_checked' && x.status === 'not_checked' && b.prichina) x.prichina = b.prichina;
      });
      if (ist.length) x.istochnik = ist.filter(function (v, i) { return ist.indexOf(v) === i; }).join('; ');
    });

    // 13. Индекс — только за воротами полноты (п. 71)
    var V = IV ? IV.vid(r) : { rezhim: 'schitaem', polnota: null, porog: 60 };
    var ix = map.indeks;
    if (V.rezhim === 'chislo') {
      fakt('indeks', 'Балл', V.ball + ' из 99 — ' + V.zona, { ton: V.ton || 'info', istochnik: 'методика Индекса' });
      fakt('indeks', 'Собрано данных', V.polnota + '%', { ton: 'info', istochnik: 'методика Индекса' });
      meta.indeks = { ball: V.ball, sobrano: V.polnota };
    } else {
      ix.prichina = 'Индекс — считаем: ' + (V.polnota != null ? 'собрано ' + V.polnota + '% данных, для балла нужно ' + (V.porog || 60) + '%.' : 'для балла нужно собрать не меньше ' + (V.porog || 60) + '% данных.') + ' Пока смотрите факты по разделам.';
      meta.indeks = { ball: null, sobrano: V.polnota != null ? V.polnota : null };
    }

    // 14–15. Предел аванса и что запросить — тем же расчётом, что «Условия сделки» (site-v9)
    var itog = { vyvod: '', predel_avansa_rub: null, glavnoe: [], na_konu: null };
    if (U) {
      var u = U.decide(r, { amount: opts.summa, regime: opts.rezhim });
      itog.vyvod = u.headline && (u.headline.title || u.headline) || '';
      itog.predel_avansa_rub = typeof u.cap === 'number' ? u.cap : null;
      fakt('predel', 'Предел аванса', typeof u.cap === 'number' ? U.money(u.cap) : '—', { ton: u.malo ? 'warn' : u.tone === 'go' ? 'ok' : u.tone === 'cap' ? 'warn' : 'bad', istochnik: 'формула Делоскопа' });
      var kk = u.kak && (typeof u.kak === 'string' ? { kak: u.kak } : u.kak);
      if (kk && kk.kak) fakt('predel', 'Как посчитали', kk.kak.replace(/^Как посчитали:\s*/, ''), { ton: 'info', istochnik: 'формула Делоскопа' });
      if (kk && kk.ne) fakt('predel', 'Оговорка', kk.ne, { ton: 'warn', istochnik: 'формула Делоскопа' });
      if (kk && kk.url) map.predel.ssylka = kk.url;
      // Лестница по сумме (Ночные 30.09 21:05): ступень — из суммы и возраста компании по ЕГРЮЛ; закупки клиента и прочие признаки —
      // в «Решении о сделке» (там же, в браузере, вне отпечатка). Здесь — только то, что следует из сведений и суммы.
      var L = opts.lestnica || (root && root.Lestnica) || null;
      if (L && u.amount) {
        var ls = L.stupen({ summa: u.amount, priznaki: u.facts && u.facts.ageMonths != null && u.facts.ageMonths < 12 ? ['molodaya'] : [] });
        fakt('zaprosit', 'Объём проверки', 'ступень ' + ls.n + ' из 4 — ' + ls.nazvanie.toLowerCase() + '. ' + ls.pochemu + ' ' + L.OGOVORKA, { ton: 'info', istochnik: 'ориентир Делоскопа по п. 16 письма ФНС № БВ-4-7/3060@' });
        if (ls.nalichnye) fakt('zaprosit', 'Оплата', ls.nalichnye, { ton: 'warn', istochnik: 'Указание Банка России от 09.12.2019 № 5348-У, п. 4' });
      }
      (u.docs || []).forEach(function (d, i) { fakt('zaprosit', (i + 1) + '. ' + d.title, d.why || '', { ton: 'info', istochnik: 'письмо ФНС № БВ-4-7/3060@' }); });
      var st = u.stake;
      if (st && u.amount) {
        itog.na_konu = st.zero
          ? { rub: 0, formula: 'УСН «доходы»: расход по сделке налог не уменьшает — снимать нечего. Если вы на УСН платите НДС 22% с вычетами, на кону вычет НДС — 18% суммы.', summa: u.amount }
          : { rub: Math.round(st.hard), rub_min: Math.round(st.soft || 0), summa: u.amount,
              formula: u.regime === 'usn_dr' ? 'УСН «доходы минус расходы»: налог 15% со снятого расхода + штраф до 40% (п. 3 ст. 122 НК). Без пеней.'
                : 'ОСН: вычет НДС 22/122 + налог на прибыль 25% со снятого расхода + штраф 20–40% (ст. 122 НК). Без пеней; верхняя граница без налоговой реконструкции.' };
      }
    }

    // Бесплатный уровень: разделы «Про» — без сведений (их нет ни на экране, ни в PDF, ни в отпечатке), только замок
    if (dostup === 'free') spisok.forEach(function (x) {
      if (x.dostup !== 'pro') return;
      x.status = 'locked'; x.fakty = []; x.vyvod = ''; x.ton = 'info'; x.data_svedeniy = null; x.polucheno = null; x.data_iz_polucheniya = false;
      x.prichina = 'Раздел — в полном Паспорте (тариф «Про»). В бесплатном Паспорте его сведения не выводим и не печатаем.';
    });

    // Итог: три главных факта — сначала худшие, у каждого дата
    var vse = [];
    spisok.forEach(function (x) { if (x.vid !== 'sluzhebnyj' && x.id !== 'predel' && x.id !== 'zaprosit') x.fakty.forEach(function (f) { if (f.ton === 'bad' || f.ton === 'warn') vse.push({ f: f, x: x }); }); });
    vse.sort(function (a, b) { return (b.f.ton === 'bad') - (a.f.ton === 'bad'); });
    itog.glavnoe = vse.slice(0, 3).map(function (v) { return v.f.tekst + (v.f.znachenie ? ': ' + v.f.znachenie : '') + (v.f.data ? ' (на ' + dataRu(v.f.data) + ')' : ''); });

    // Вывод и «что делать» у разделов со сведениями
    spisok.forEach(function (x) {
      if (x.status === 'found' && x.vid !== 'sluzhebnyj' && x.id !== 'predel' && x.id !== 'zaprosit')
        x.vyvod = x.ton === 'bad' ? 'Есть серьёзные отметки — разберите их до оплаты.' : x.ton === 'warn' ? 'Есть моменты для вопросов контрагенту.'
          : x.chastichno ? 'В полученных сведениях настораживающих отметок нет. Проверено не всё — что не смотрели, ниже.'
          : 'Сведения получены, настораживающих отметок в этом разделе нет.';
      // связи пока — только факты реестров (массовый адрес ФНС): подписываем их источником, а не расчётом
      if (x.id === 'svyazi' && x.status === 'found') {
        var src = x.fakty.map(function (f) { return f.istochnik; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
        if (src.length) { x.istochnik = src.join('; '); x.vid = 'istochnik'; }
      }
      // дата сведений не пришла — честно ставим дату получения, страница подписывает «получено»
      if ((x.status === 'found' || x.status === 'not_found') && !x.data_svedeniy) { x.data_svedeniy = x.polucheno || polucheno; x.data_iz_polucheniya = true; }
    });

    // 16. Чего мы не знаем — все непроверенные разделы + постоянные строки. Не бывает пустым.
    var nz = map.ne_znaem;
    spisok.forEach(function (x) {
      if (x.status === 'not_checked' && x.vid !== 'sluzhebnyj') nz.fakty.push({ tekst: x.n + '. ' + x.title, znachenie: x.prichina || 'не проверяли', ton: 'info', data: null, istochnik: x.istochnik });
      else if (x.chastichno && x.status === 'found') nz.fakty.push({ tekst: x.n + '. ' + x.title, znachenie: x.chastichno, ton: 'info', data: null, istochnik: x.istochnik });
    });
    VSEGDA_NE_ZNAEM.forEach(function (t) { nz.fakty.push({ tekst: t, znachenie: '', ton: 'info', data: null, istochnik: 'Делоскоп' }); });
    nz.status = 'found'; nz.prichina = ''; nz.polucheno = polucheno; nz.data_svedeniy = polucheno;

    // Полнота: серверное «N из M» (п. 128) главнее; иначе — число разделов с первоисточником
    var ist = spisok.filter(function (x) { return x.vid === 'istochnik'; });
    var est = ist.filter(function (x) { return x.status === 'found' || x.status === 'not_found' || x.status === 'not_applicable'; }).length;
    meta.provereno = r.provereno && r.provereno.n != null && r.provereno.m != null
      ? { n: r.provereno.n, m: r.provereno.m, chto: 'istochnikov' }
      : { n: est, m: ist.length, chto: 'razdelov' };

    // 17. Как проверить — номер, дата, версия; отпечаток дописывает страница после расчёта
    var pd = map.podlinnost;
    pd.status = 'found'; pd.polucheno = polucheno; pd.data_svedeniy = polucheno;
    pd.fakty.push({ tekst: 'Номер Паспорта', znachenie: nomer || 'присваивается по отпечатку', ton: 'info', data: null, istochnik: 'Делоскоп' });
    pd.fakty.push({ tekst: 'Сформирован', znachenie: dataRu(r.checked_at), ton: 'info', data: null, istochnik: 'Делоскоп' });
    pd.fakty.push({ tekst: 'Версия документа', znachenie: VERSIYA, ton: 'info', data: null, istochnik: 'Делоскоп' });

    meta.dostup = dostup;
    return { ip: false, meta: meta, itog: itog, razdely: spisok };
  }

  // «Подписант на дату подписи» (Прорыв «Я-3», Ночные 29.09 23:05). Считается на странице из того, что ввёл
  // заказчик Паспорта (должность подписанта, основание, дата подписи), и сведений Паспорта. Имена людей сюда
  // не попадают ни с какой стороны: сравниваем должности, не персоны. Сервер ничего не получает, в отпечаток не входит.
  // Дату записи о руководителе API пока не отдаёт — поэтому для подписи раньше даты Паспорта честно отправляем к выписке ЕГРЮЛ.
  var SSYLKI_PODPISANTA = {
    mchd: { t: 'Проверить МЧД в реестре ФНС ↗', u: 'https://m4d.nalog.gov.ru/emchd/check-status' },
    notar: { t: 'Нотариальная доверенность — реестр ФНП ↗', u: 'https://www.reestr-dover.ru/' },
    egrul: { t: 'Выписка ЕГРЮЛ на сайте ФНС ↗', u: 'https://egrul.nalog.ru/' },
    pb: { t: '«Прозрачный бизнес» ФНС ↗', u: 'https://pb.nalog.ru/' }
  };
  function datuIz(s) {
    var m = String(s || '').trim().match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if (!m) return null;
    var d = new Date(+m[3], +m[2] - 1, +m[1]);
    return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? d : null;
  }
  function dolzhnostKlyuch(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function tuZheDolzhnost(a, b) {
    a = dolzhnostKlyuch(a); b = dolzhnostKlyuch(b);
    if (!a || !b) return false;
    if (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return true;
    var gd = /(генеральн\S* )?директор|руководител/;           // «Директор» и «Генеральный директор» — одна роль
    return gd.test(a) && gd.test(b) && !/заместител|финансов|коммерческ|исполнительн|технич/.test(a + ' ' + b);
  }

  // «Отметка самопроверки» (Прорыв Ночных 30.09 14:05, сверстано 17:05). Заказчик сам открыл первоисточник по ссылке
  // «проверьте сами» и отмечает результат — Паспорт становится протоколом его осмотрительности на дату.
  // Правила: отметка — слово пользователя, не наше: статус раздела остаётся «не проверяли», в отпечаток SHA-256
  // не входит (P.vypustit считает из сведений p, отметка в p не пишется), в печати — отдельной строкой с оговоркой.
  // Оговорка — черновая до ✎ [Юриста 115-ФЗ] (п. 169).
  var OTM_OGOVORKA = 'Это отметка заказчика о его собственной проверке. Делоскоп её не проверял и не подтверждает.';
  var OTM_REZ = { net: 'сведений не найдено', est: 'есть сведения', ne_udalos: 'проверить не удалось' };
  var OTM_TON = { net: 'info', est: 'warn', ne_udalos: 'off' };
  var OTM_SVEZHEST_DNEJ = 30;
  function dataIzRu(t) { // «ДД.ММ.ГГГГ» → Date (полдень МСК, чтобы не съезжать на сутки) или null
    var m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(String(t || ''));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 9));
    return d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1 ? d : null;
  }
  // otmetka-v2 (Ночные 30.09 19:05, по глубине 18:05): чтобы отметка работала доводом по п. 55 Постановления
  // Пленума ВС № 10 от 23.04.2019 (снимок — с адресом страницы и временем получения, за подписью того, кто его сделал) и пп. 14–16
  // письма ФНС БВ-4-7/3060@ (проверка соразмерна сделке), у неё есть: время, полный адрес страницы, кто проверял
  // (должность; ФИО — только от руки в печати, как в «Решении о сделке»), номер приложения-снимка; у ЕГРЮЛ — вариант «выписка ФНС с электронной подписью».
  // Никогда не пишем, что суд или налоговая «примут» отметку — оценивает суд (✎ [Налоговый юрист], п. 171).
  var OTM_SNIMOK = 'Снимок экрана: чтобы на нём были видны адрес страницы, ИНН, результат, дата и время. Так снимок оформляют как доказательство; оценивает его суд.';
  var OTM_EP = 'Сильнее снимка — выписка ЕГРЮЛ в PDF с электронной подписью ФНС: бесплатно, на той же странице.';
  var OTM_EP_HOST = 'egrul.nalog.ru';
  // papka-v1.1 «ЗСК-дневник» (Ночные 01.10 01:05, п. 180): сведения платформы ЗСК меняются каждый день —
  // cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/ (проверено 01.10.2026): «Информация платформы ЗСК ежедневно
  // передается в кредитные организации», «Информация является справочной». Поэтому у сверки с ЦБ свой срок свежести — день, а не 30.
  var OTM_ZSK = 'Сведения ЗСК Банк России передаёт банкам ежедневно — в день оплаты проверьте ещё раз.';
  function zskAdres(u) { return /^https:\/\/(www\.)?cbr\.ru\/counteraction_m_ter\/platform_zsk\//i.test(String(u || '').trim()); }
  function dnejTekst(n) { var d = n % 10, s = n % 100; return n + ' ' + (d === 1 && s !== 11 ? 'день' : d >= 2 && d <= 4 && (s < 12 || s > 14) ? 'дня' : 'дней'); }
  function hostIz(u) { var m = /^https:\/\/([a-z0-9.-]+)(?::\d+)?(\/|$)/i.exec(String(u || '').trim()); return m ? m[1].toLowerCase() : ''; }
  function tuZheSajt(adres, ssylka) { // адрес — https и тот же сайт (или его поддомен), что у ссылки раздела
    var a = hostIz(adres), b = hostIz(ssylka).replace(/^www\./, '');
    return !!a && !!b && (a === b || a === 'www.' + b || a.slice(-(b.length + 1)) === '.' + b);
  }
  function vremyaIz(t) { var m = /^\s*([01]?\d|2[0-3])[:.]([0-5]\d)\s*$/.exec(String(t || '')); return m ? [+m[1], +m[2]] : null; }
  function dd(n) { return (n < 10 ? '0' : '') + n; }
  function otmetka(x, vvod, segodnya) {
    vvod = vvod || {};
    if (!x || x.status !== 'not_checked' || !x.sam || !x.sam.length) return { ok: false, oshibka: 'Отметка ставится только у раздела, который мы не проверяли' };
    if (!OTM_REZ[vvod.rez]) return { ok: false, oshibka: 'Выберите, что показал первоисточник' };
    var i = +(vvod.ist || 0), ist = x.sam[i];
    if (!ist) return { ok: false, oshibka: 'Выберите, где проверяли' };
    var d = dataIzRu(vvod.data);
    if (!d) return { ok: false, oshibka: 'Дата — в виде ДД.ММ.ГГГГ' };
    var vr = vremyaIz(vvod.vremya);
    if (!vr) return { ok: false, oshibka: 'Время — в виде ЧЧ:ММ' };
    var seg = segodnya instanceof Date ? segodnya : new Date();
    var segD = Date.UTC(seg.getFullYear(), seg.getMonth(), seg.getDate(), 9);
    var dnej = Math.round((segD - d.getTime()) / 864e5);
    if (dnej < 0) return { ok: false, oshibka: 'Дата проверки — не позже сегодняшней' };
    if (dnej === 0 && vr[0] * 60 + vr[1] > seg.getHours() * 60 + seg.getMinutes()) return { ok: false, oshibka: 'Время проверки — не позже текущего' };
    var adres = String(vvod.adres == null || vvod.adres === '' ? ist.url : vvod.adres).trim();
    if (!tuZheSajt(adres, ist.url)) return { ok: false, oshibka: 'Адрес страницы — https и тот же сайт, что в ссылке раздела (' + hostIz(ist.url) + ')' };
    var pril = String(vvod.pril || '').trim().replace(/^№\s*/, '');
    if (pril && !/^\d{1,3}$/.test(pril)) return { ok: false, oshibka: 'Номер приложения — число' };
    var ep = !!vvod.ep && hostIz(ist.url) === OTM_EP_HOST;
    var tz = String(vvod.tz || 'МСК').slice(0, 12);
    var dolzh = String(vvod.dolzhnost || '').trim().slice(0, 80);
    var kogda = dataRu(d) + ' в ' + dd(vr[0]) + ':' + dd(vr[1]) + ' ' + tz;
    var tekst = 'Проверено вами ' + kogda + ' — ' + ist.tekst + ': ' + OTM_REZ[vvod.rez] + '.';
    var stroki = ['Адрес страницы: ' + adres];
    if (ep) stroki.push('Приложена выписка ЕГРЮЛ в PDF с электронной подписью ФНС' + (pril ? ' — приложение № ' + pril : '') + '.');
    else if (pril) stroki.push('Снимок экрана — приложение № ' + pril + '.');
    var sovet = vvod.rez === 'est' ? (ep || pril ? '' : 'Сохраните снимок экрана первоисточника и приложите к досье сделки. ') + 'Запросите у контрагента объяснение и документы до оплаты.' :
      vvod.rez === 'ne_udalos' ? 'Раздел остаётся непроверенным — вернитесь к нему до оплаты.' :
      (!ep && !pril ? 'Сохраните снимок экрана и укажите номер приложения — так отметку можно подтвердить.' : '');
    if (hostIz(ist.url) === OTM_EP_HOST && !ep && vvod.rez !== 'ne_udalos') sovet = (sovet + ' ' + OTM_EP).trim();
    var zsk = zskAdres(ist.url);
    if (zsk) sovet = ((dnej > 0 ? 'Сверка с Банком России была ' + dnejTekst(dnej) + ' назад. ' : '') + OTM_ZSK + ' ' + sovet).trim();
    else if (dnej > OTM_SVEZHEST_DNEJ) sovet = ('Проверке больше ' + OTM_SVEZHEST_DNEJ + ' дней — перед оплатой перепроверьте. ' + sovet).trim();
    return { ok: true, razdel: x.n, id: x.id, rez: vvod.rez, ton: OTM_TON[vvod.rez], ist: i, url: ist.url, adres: adres,
      data: dataRu(d), vremya: dd(vr[0]) + ':' + dd(vr[1]), tz: tz, kogda: kogda, dnej: dnej, pril: pril, ep: ep, zsk: zsk,
      dolzhnost: dolzh, tekst: tekst, stroki: stroki, sovet: sovet, ogovorka: OTM_OGOVORKA };
  }
  // Сводка для «Решения о сделке»: какие разделы заказчик проверил сам. Порядок — по номеру раздела.
  function otmetkiSvodka(spisok) {
    var v = (spisok || []).filter(function (o) { return o && o.ok; }).sort(function (a, b) { return a.razdel - b.razdel; });
    if (!v.length) return '';
    return 'Самопроверка заказчика: ' + v.map(function (o) {
      var pr = o.ep ? ', выписка с ЭП' + (o.pril ? ' — прил. № ' + o.pril : '') : o.pril ? ', снимок — прил. № ' + o.pril : '';
      return 'раздел ' + o.razdel + ' — ' + OTM_REZ[o.rez] + ' (' + (o.kogda || o.data) + pr + ')';
    }).join('; ') + '. ' + OTM_OGOVORKA;
  }

  function podpisant(r, p, vvod) {
    r = r || {}; vvod = vvod || {};
    var c = r.company || {}, post = String(c.director_post || '').trim();
    var naDatu = dataRu((p && p.meta && p.meta.sformirovan) || r.checked_at);
    var out = [];
    function s(ton, tekst, ssylki, vid) { out.push({ ton: ton, tekst: tekst, ssylki: ssylki || [], vid: vid || (ton === 'off' ? 'net' : 'raschet') }); }
    if (!p || p.ip) return out;
    if (post) s('info', 'По ЕГРЮЛ на ' + naDatu + ' без доверенности действует: ' + post.toLowerCase() + '.', [], 'istochnik');
    else s('off', 'Руководителя в полученных сведениях нет — кто вправе подписывать без доверенности, посмотрите в выписке ЕГРЮЛ.', [SSYLKI_PODPISANTA.egrul]);

    var lyudi = (p.razdely || []).filter(function (x) { return x.id === 'lyudi' || x.id === 'rekvizity'; });
    lyudi.forEach(function (x) {
      x.fakty.forEach(function (f) {
        if ((f.ton === 'bad' || f.ton === 'warn') && /дисквалиф|руководител|директор|недостоверн/i.test(f.tekst))
          s(f.ton, 'В разделе ' + x.n + ' отметка «' + f.tekst + '»' + (f.data ? ' на ' + dataRu(f.data) : '') + ' — выясните, кто вправе подписывать, до того как принять документ.', [SSYLKI_PODPISANTA.pb], 'istochnik');
      });
    });

    var dolzh = String(vvod.dolzhnost || '').trim(), osn = vvod.osnovanie || '';
    if (dolzh && osn === 'ustav' && post) {
      if (tuZheDolzhnost(dolzh, post)) s('ok', 'Должность подписанта совпадает с руководителем по ЕГРЮЛ. Сверьте подпись с документом о назначении.', []);
      else s('warn', 'Подписал «' + dolzh + '», а без доверенности действует ' + post.toLowerCase() + '. Запросите доверенность подписанта.', [SSYLKI_PODPISANTA.mchd, SSYLKI_PODPISANTA.notar]);
    }
    if (osn === 'mchd') s('info', 'Электронная доверенность: проверьте в реестре ФНС, что она действовала на дату подписи, доверитель — ИНН ' + (c.inn || 'компании') + ' и в ней есть полномочие на такой документ.', [SSYLKI_PODPISANTA.mchd]);
    if (osn === 'bumaga') s('info', 'Бумажная доверенность: нотариальную проверьте в реестре ФНП; простую — запросите копию за подписью руководителя по ЕГРЮЛ.', [SSYLKI_PODPISANTA.notar]);

    var dp = datuIz(vvod.data), ds = datuIz(naDatu);
    if (String(vvod.data || '').trim() && !dp) s('off', 'Дату подписи не распознали — нужен вид ДД.ММ.ГГГГ.', []);
    else if (dp && ds) {
      var dn = Math.round((dp - ds) / 864e5);
      if (dn < 0) s('info', 'Документ подписан ' + dataRu(dp) + ' — раньше даты сведений Паспорта (' + naDatu + '). Сменился ли руководитель между этими датами, видно по дате записи в выписке ЕГРЮЛ; мы эту дату пока не получаем.', [SSYLKI_PODPISANTA.egrul]);
      else if (dn > 30) s('warn', 'Паспорт собран за ' + dn + ' дн. до подписи — пересоберите его по ссылке: сведения о руководителе могли измениться.', []);
      else s('ok', 'Сведения Паспорта — на ' + naDatu + ', подпись — ' + dataRu(dp) + ': разница ' + dn + ' дн.', []);
    }
    return out;
  }

  // Номер Паспорта: «П-ГГГГММДД-XXXXXXXX» — дата формирования + 8 знаков отпечатка. ИНН и номера досье внутри нет.
  function nomerIz(hash, sformirovan) {
    var d = dataRu(sformirovan).split('.').reverse().join('');
    return 'П-' + (d || '00000000') + '-' + String(hash || '').slice(0, 8).toUpperCase();
  }
  // Выпуск: отпечаток → номер (если не задан) → строка раздела 17. Возвращает Promise с отпечатком.
  function vypustit(p) {
    if (!p || p.ip) return Promise.resolve(null);
    return otpechatok(p).then(function (h) {
      if (!p.meta.nomer && h) p.meta.nomer = nomerIz(h, p.meta.sformirovan);
      p.razdely.forEach(function (x) {
        if (x.id === 'podlinnost') x.fakty.forEach(function (f) { if (f.tekst === 'Номер Паспорта') f.znachenie = p.meta.nomer || f.znachenie; });
      });
      return h;
    });
  }
  // QR ведёт на публичную проверку подлинности, а не на Паспорт: номер, дата, отпечаток и ИНН организации — всё публичное.
  function qrSsylka(p, hash, baza) {
    var m = p.meta, d = dataRu(m.sformirovan).split('.').reverse().join('');
    return (baza || 'https://deloskop.ru') + '/pasport/proverka/?n=' + encodeURIComponent(m.nomer || '') + '&d=' + d +
      '&h=' + String(hash || '').slice(0, 16) + (m.inn ? '&inn=' + m.inn : '');
  }

  // Словарь [Юриста 115-ФЗ] 29.09, разд. 7 (222-ФЗ, ст. 152 ГК, 38-ФЗ) — в текстах Паспорта не бывает.
  var SLOVAR_222 = /аффилирован|группа лиц|подконтрольн|номинальн|массов(ый|ого) (директор|учредител)|техничк|однодневк|ненад[её]жн|над[её]жная компания|рейтинг над[её]жности|кредитоспособн|пл[ао]т[её]жеспособн|финансовая (устойчивость|над[её]жность)|кредитный рейтинг|вероятность дефолта|не заплатит|риск невозврата|заверен|печать делоскопа|официальн|сделка ничтожна|договор недействителен|была банкротом|верят банки/i;
  var ZAPRET = /(^|\s)(чисто|рисков\s+нет|долгов\s+нет|не\s+банкрот|не\s+судится)(\s|[.,!]|$)/i; // стоп-слова п. 93
  // Проверка солидности — те же правила, что в тестах; страница зовёт её перед показом.
  function proverit(p) {
    var osh = [];
    if (!p || p.ip) return osh;
    p.razdely.forEach(function (x) {
      if ((x.status === 'found' || x.status === 'not_found') && (!x.istochnik || !x.data_svedeniy)) osh.push(x.n + ': нет источника или даты');
      if (x.status === 'not_checked' && !x.prichina) osh.push(x.n + ': «не проверяли» без причины');
      if (x.status === 'locked' && x.fakty.length) osh.push(x.n + ': закрытый раздел со сведениями');
      if (SLOVAR_222.test(x.title + ' ' + (x.vyvod || '') + ' ' + (x.prichina || ''))) osh.push(x.n + ': слово из словаря 222-ФЗ');
      x.fakty.forEach(function (f) {
        if (ZAPRET.test(f.tekst + ' ' + f.znachenie)) osh.push(x.n + ': запрещённая формулировка');
        if (x.id !== 'ne_znaem' && x.vid !== 'sluzhebnyj' && x.vid !== 'raschet' && netBezDaty(f.tekst, f.znachenie, f.ton, f.data, f.istochnik)) osh.push(x.n + ': «нет» без даты сведений — «' + f.tekst + '»');
      });
    });
    var nz = p.razdely.filter(function (x) { return x.id === 'ne_znaem'; })[0];
    if (!nz || !nz.fakty.length) osh.push('16: раздел пуст');
    if (p.itog && p.itog.na_konu && !p.itog.na_konu.formula) osh.push('на кону без формулы');
    return osh;
  }

  return { VERSIYA: VERSIYA, RAZDELY: RAZDELY, sobrat: sobrat, proverit: proverit, razdelDlya: razdelDlya,
    vypustit: vypustit, nomerIz: nomerIz, podpisant: podpisant, datuIz: datuIz, tuZheDolzhnost: tuZheDolzhnost, SSYLKI_PODPISANTA: SSYLKI_PODPISANTA, qrSsylka: qrSsylka, podval: podval, SLOVAR_222: SLOVAR_222,
    OPREDELENIE_INDEKSA: OPREDELENIE_INDEKSA, PODPIS_PREDELA: PODPIS_PREDELA,
    otmetka: otmetka, otmetkiSvodka: otmetkiSvodka, dataIzRu: dataIzRu, tuZheSajt: tuZheSajt, OTM_SNIMOK: OTM_SNIMOK, OTM_EP: OTM_EP, OTM_EP_HOST: OTM_EP_HOST, OTM_OGOVORKA: OTM_OGOVORKA, OTM_REZ: OTM_REZ, OTM_SVEZHEST_DNEJ: OTM_SVEZHEST_DNEJ, OTM_ZSK: OTM_ZSK, zskAdres: zskAdres, dnejTekst: dnejTekst,
    netBezDaty: netBezDaty, diskvalProveren: diskvalProveren, DISKVAL_SAM: DISKVAL_SAM,
    kanon: kanon, otpechatok: otpechatok, otpechatokKratko: otpechatokKratko, dataRu: dataRu, isIp: isIp, VSEGDA_NE_ZNAEM: VSEGDA_NE_ZNAEM };
});
