/* Делоскоп — подключённые источники в ответе проверки (комплект istochniki-v1, решение команды 11.10 16:25:
 * «не урезать, а подключить суды, банкротство, приставов» — документ команды).
 *
 * dopolnit(r) — общая точка: вызывается из DlkImya.ispravitOtvet (главная, Паспорт, Проверь счёт, PDF-досье, Делопись, кабинет)
 * до всех модулей отчёта. Меняет ответ на месте и возвращает его же.
 *
 * 1) Банкротство — из ЕГРЮЛ. Статус компании в ЕГРЮЛ (company.status от DaData: BANKRUPT — введена процедура банкротства)
 *    уже есть в каждом ответе. Если API не прислал блок damia.bankrotstvo с ответом (found / not_found / not_applicable),
 *    ставим его сами: источник «ЕГРЮЛ ФНС», дата сведений — дата проверки, оговорка «сообщения ЕФРСБ не проверяли»
 *    (намерения кредиторов и ход процедуры в ЕГРЮЛ не попадают). Ответ API с проверкой ЕФРСБ никогда не перетираем.
 *    У ИП — не ставим: банкротство гражданина в ЕГРИП не отражается до прекращения статуса ИП.
 *    В полноту Индекса такой блок НЕ идёт (источник методики «Федресурс и ЕФРСБ» не проверен) — флаг iz_egryul;
 *    стоп-фактор «Введена процедура банкротства» Индекс и так берёт из статуса ЕГРЮЛ (js/indeks-otvet.js).
 * 2) Приставы — блок damia.fssp приходит от API (загрузчик открытых данных ФССП, комплект API istochniki-v1):
 *    status found / not_found, summa_ostatka, chislo, tochnost ('inn' | 'naimenovanie_adres'), data_svedeniy.
 *    Здесь только приводим словарь: sostoyanie = status, чтобы «Условия сделки» и Индекс читали одно и то же.
 * Чистые функции, без DOM и сети — tests/istochniki_bankrotstvo_fssp.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkIstochniki = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = ' ';
  var OTVETIL = { found: 1, not_found: 1, not_applicable: 1 };
  var EFRSB = 'https://fedresurs.ru/';
  var OGOVORKA_EFRSB = 'сообщения ЕФРСБ не проверяли';

  // дата проверки по Москве → «2026-10-11» (как «Существенные факты»: ЕГРЮЛ — на дату проверки)
  function dataProverki(r) {
    var x = Date.parse((r && r.checked_at) || '');
    if (!isFinite(x)) return null;
    var q = new Date(x + 3 * 3600 * 1000);
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return q.getUTCFullYear() + '-' + z(q.getUTCMonth() + 1) + '-' + z(q.getUTCDate());
  }

  function statusSignal(r) {
    var S = Array.isArray(r && r.signals) ? r.signals : [];
    for (var i = 0; i < S.length; i++) {
      var s = S[i];
      if (s && String(s.title || '').replace(/ /g, ' ').trim() === 'Статус') return s;
    }
    return null;
  }

  // r → блок «Банкротство» по ЕГРЮЛ | null (нечего сказать честно)
  function bankrotstvoIzEgryul(r) {
    var c = r && r.company;
    if (!c || typeof c !== 'object' || !c.inn) return null;
    if (c.kind === 'INDIVIDUAL' || String(c.inn).length === 12) return null;
    var st = String(c.status || '').toUpperCase(), sg = statusSignal(r);
    var det = sg ? String(sg.detail || '').replace(/ /g, ' ') : '';
    if (!st && !sg) return null;
    var data = dataProverki(r);
    var b = { nazvanie: 'Банкротство', istochnik: 'ЕГРЮЛ ФНС', data_svedeniy: data, iz_egryul: true,
      ogovorka: OGOVORKA_EFRSB, proverit_samim: EFRSB };
    if (st === 'BANKRUPT' || /банкрот/i.test(det)) {
      b.status = 'found'; b.uroven = 'bad';
      b.itog = 'Процедура банкротства — отметка в' + NB + 'ЕГРЮЛ';
      b.dubl_statusa = true; // строка «Статус» уже говорит об этом — в «Существенных фактах» не повторяем
    } else if (st === 'LIQUIDATED') {
      b.status = 'not_applicable';
      b.prichina = 'Компания прекратила деятельность — см.' + NB + '«Статус»';
    } else if (st === 'ACTIVE' || st === 'LIQUIDATING' || st === 'REORGANIZING') {
      b.status = 'not_found';
      b.itog = 'Отметки о банкротстве в' + NB + 'ЕГРЮЛ нет; ' + OGOVORKA_EFRSB;
    } else return null;
    b.sostoyanie = b.status;
    return b;
  }

  // sudy-v1 [команда] 11.10: словарь API → словарь сайта. API (damia v1.4) отдаёт status «polucheno» / «ne_provereno»
  // и отдельно sostoyanie found / not_found / not_checked / not_applicable, а модули отчёта (Паспорт, «Откуда данные»,
  // «Существенные факты», Индекс) читают status как found / not_found. Без этого шага, когда ключ DaMIA заработает, найденные
  // дела суда показались бы как «ответа нет». Прежнее слово API сохраняем в status_api.
  var SLOVAR_API = { polucheno: 1, ne_provereno: 1 };
  function privestiSlovar(dm) {
    Object.keys(dm).forEach(function (k) {
      var b = dm[k];
      if (!b || typeof b !== 'object' || !SLOVAR_API[b.status]) return;
      var s = b.sostoyanie;
      b.status_api = b.status;
      b.status = OTVETIL[s] ? s : 'not_checked';
      if (!b.sostoyanie) b.sostoyanie = b.status;
    });
  }

  // sudy-v1: «Арбитражные суды» — одна строка-вывод из analitika API (кто и сколько судится, доля выручки, тренд) вместо
  // общего итога. Прежний итог — в itog_prezhnij. Советы «что сделать» — только согласованные [команда] (soglasovano: true).
  function sudyItog(b) {
    var a = b && b.analitika;
    if (!a || typeof a !== 'object' || a.oshibka || !a.svodka || b.status !== 'found') return;
    var t = [String(a.svodka)];
    if (a.dolya_vyruchki && a.dolya_vyruchki.tekst) t.push(String(a.dolya_vyruchki.tekst));
    if (a.trend && a.trend.rost && a.trend.tekst) t.push(String(a.trend.tekst));
    if (!b.itog_prezhnij) b.itog_prezhnij = b.itog || '';
    b.itog = t.join(' ');
    if (a.dolya_vyruchki && a.dolya_vyruchki.ton === 'bad') b.uroven = 'bad';
    b.chto_sdelat = (Array.isArray(a.chto_sdelat) ? a.chto_sdelat : []).filter(function (x) { return x && x.soglasovano === true && x.tekst; });
  }

  // otchet-detali-v1 (19.10): «не завершены 2 на 0 ₽» читалось как ошибка — у таких дел сумма иска в картотеке не указана
  // (неимущественные требования или сумма не внесена). Говорим это словами; ненулевую сумму не трогаем.
  function sudyNol(b) {
    if (!b || typeof b !== 'object' || typeof b.itog !== 'string') return;
    var t = b.itog.replace(/(\d+)\s+на\s+0\s*₽/g, '$1; сумма исков в' + NB + 'картотеке не' + NB + 'указана');
    if (t !== b.itog) { if (!b.itog_prezhnij) b.itog_prezhnij = b.itog; b.itog = t; }
  }

  // otchet-detali-v1: подпись ссылки на первоисточник по адресу — «проверить в картотеке арбитражных дел» вместо семи
  // одинаковых «проверьте сами» (доверие: видно, куда ведём; WCAG 2.4.4 — у ссылок с разной целью разный текст).
  // Неизвестный адрес — «проверить на <домен>». Порядок важен: сначала точные пути, потом домены.
  var SAMI = [
    [/^service\.nalog\.ru\/bi/, 'в' + NB + 'сервисе ФНС о' + NB + 'приостановлениях'],
    [/^egrul\.nalog\.ru/, 'в' + NB + 'ЕГРЮЛ'], [/^pb\.nalog\.ru/, 'в' + NB + '«Прозрачном бизнесе» ФНС'],
    [/^bo\.nalog\.ru/, 'в' + NB + 'ГИР' + NB + 'БО'], [/^rmsp\.nalog\.ru/, 'в' + NB + 'реестре МСП'],
    [/^m4d\.nalog\.gov\.ru/, 'в' + NB + 'реестре доверенностей ФНС'],
    [/^(?:www\.)?cbr\.ru\/fmp_check/, 'в' + NB + 'справочнике Банка России'],
    [/^(?:www\.)?cbr\.ru\/finorg/, 'в' + NB + 'карточке Банка России'], [/^(?:www\.)?cbr\.ru/, 'на' + NB + 'сайте Банка России'],
    [/^bankrot\.fedresurs\.ru/, 'в' + NB + 'ЕФРСБ'], [/^(?:www\.)?fedresurs\.ru/, 'на' + NB + 'Федресурсе'],
    [/^kad\.arbitr\.ru/, 'в' + NB + 'картотеке арбитражных дел'], [/^(?:www\.)?fssp\.gov\.ru/, 'в' + NB + 'банке данных ФССП'],
    [/^zakupki\.gov\.ru/, 'в' + NB + 'ЕИС закупок'], [/^(?:www\.)?reestr-zalogov\.ru/, 'в' + NB + 'реестре залогов'],
    [/^(?:www\.)?reestr-dover\.ru/, 'в' + NB + 'реестре нотариальных доверенностей'],
    [/^(?:www\.)?fips\.ru/, 'в' + NB + 'реестрах Роспатента'], [/^pub\.fsa\.gov\.ru/, 'в' + NB + 'реестре Росаккредитации'],
    [/^(?:www\.)?nalog\.(?:gov\.)?ru/, 'на' + NB + 'сайте ФНС']
  ];
  function samiTekst(url) {
    var m = /^https?:\/\/([^?#]+)/i.exec(String(url || ''));
    if (!m) return 'проверьте сами';
    var put = m[1].toLowerCase();
    for (var i = 0; i < SAMI.length; i++) if (SAMI[i][0].test(put)) return 'проверить ' + SAMI[i][1];
    return 'проверить на' + NB + put.split('/')[0].replace(/^www\./, '');
  }

  // ---------- doverie-2 (30.10.2026): единые статусы источников и правило «устарело» ----------
  // Реестр источников — data/istochniki.json (один файл для страниц и отчёта). Здесь — его часть, нужная отчёту без сети:
  // какие блоки DaMIA к какому источнику относятся, когда сведения устаревают и в каком состоянии источник. Сторож
  // tests/istochniki_statusy.test.js сверяет эту копию с data/istochniki.json побайтно по значениям.
  var REESTR = {
    kad: { damia: ['sudy', 'bankrotstvo'], ustarelo_dney: 7, sostoyanie: 'zamorozhen', s: '2026-10-12' },
    fssp: { damia: ['fssp'], ustarelo_dney: 7, sostoyanie: 'zamorozhen', s: '2026-10-12' },
    eis: { damia: ['rnp', 'kontrakty'], ustarelo_dney: 30, sostoyanie: 'zamorozhen', s: '2026-10-12' },
    nalog_bi: { damia: ['priostanovki', 'mery'], ustarelo_dney: 1, sostoyanie: 'zamorozhen', s: '2026-10-12' }
  };
  var PO_BLOKU = {};
  Object.keys(REESTR).forEach(function (id) { REESTR[id].damia.forEach(function (k) { PO_BLOKU[k] = id; }); });

  // Единые статусы источника — один словарь для отчёта, Паспорта, досье и экспорта (тексты согласованы юристом 30.10)
  var STATUSY = ['found', 'not_found', 'not_connected', 'error', 'stale', 'not_applicable', 'user'];
  function dmyIz(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
  }
  function dniMezhdu(a, b) {
    var x = Date.parse(String(a || '').slice(0, 10)), y = Date.parse(String(b || '').slice(0, 10));
    return isFinite(x) && isFinite(y) ? Math.floor((y - x) / 864e5) : null;
  }
  // b → код единого статуса
  function statusIstochnika(b) {
    if (!b || typeof b !== 'object') return 'not_connected';
    if (b.otmetka_polzovatelya || b.status === 'user') return 'user';
    if (b.status === 'stale' || b.ustarelo) return b.status === 'found' ? 'found' : 'stale';
    if (b.status === 'found' || b.status === 'not_found' || b.status === 'not_applicable') return b.status;
    if (b.oshibka || b.status === 'error') return 'error';
    return 'not_connected';
  }
  // b → строка для отчёта: что известно, на какую дату, и что «не найдено» ≠ «нарушений нет»
  function statusTekst(b) {
    var k = statusIstochnika(b), ist = (b && (b.istochnik || b.nazvanie)) || 'источник', d = dmyIz(b && b.data_svedeniy);
    if (k === 'found') return (b.ustarelo ? 'Данные на' + NB + d + ' — могли измениться. ' : '') + (b.itog || 'Сведения найдены');
    if (k === 'not_found') return 'В' + NB + 'источнике записей нет' + (d ? ' — на' + NB + d : '') + '.';
    if (k === 'stale') return 'Данные устарели: сведения на' + NB + d + ' — могли измениться. Это не значит, что записей нет.';
    if (k === 'not_applicable') return b.prichina || 'Не применяется.';
    if (k === 'user') return 'Со слов пользователя · Делоскоп не проверял.';
    if (k === 'error') return 'Не удалось проверить: ' + ist + ' не ответил. Повторите позже.';
    return 'Не проверяли: ' + (b && b.zamorozhen ? 'источник сейчас не обновляется.' : ist + ' пока не подключён.');
  }

  // Сведения из блока DaMIA старше срока источника: «не найдено» перестаёт быть «чисто» (status → stale, в полноту не идёт),
  // найденное (иск, производство) остаётся видно с пометкой даты — негатив не прячем. Замороженный источник без ответа
  // не обещает «обновите завтра». Меняет блоки на месте; число групп, снятых из полноты, — в dm.polnota.ustarelo.
  function ustarevanie(r) {
    var dm = r && r.damia;
    if (!dm || typeof dm !== 'object') return r;
    var na = (r.checked_at || '').slice(0, 10), snyato = 0;
    Object.keys(PO_BLOKU).forEach(function (k) {
      var b = dm[k], ist = REESTR[PO_BLOKU[k]];
      if (!b || typeof b !== 'object' || b.iz_egryul) return;
      if (ist.sostoyanie === 'zamorozhen' && (b.status === 'not_checked' || b.sostoyanie === 'not_checked')) {
        b.zamorozhen = true;
        if (b.prichina && !b.prichina_api) b.prichina_api = b.prichina;
        b.prichina = 'источник сейчас не' + NB + 'обновляется';
        b.itog_ne_provereno = 'Не проверяли: источник сейчас не' + NB + 'обновляется.';
        return;
      }
      if (b.status !== 'found' && b.status !== 'not_found') return;
      var dn = dniMezhdu(b.data_svedeniy, na);
      if (dn == null || dn <= ist.ustarelo_dney) return;
      b.ustarelo = true; b.ustarelo_dney = dn; snyato++;
      if (b.status === 'not_found') {
        b.status_do = 'not_found'; b.status = 'stale'; b.sostoyanie = 'stale';
        b.prichina = 'данные на' + NB + dmyIz(b.data_svedeniy) + ' устарели — сведения могли измениться';
        b.itog_ne_provereno = 'Данные устарели: сведения на' + NB + dmyIz(b.data_svedeniy) + '.';
      }
    });
    if (snyato && dm.polnota && typeof dm.polnota === 'object' && isFinite(dm.polnota.provereno)) {
      dm.polnota = { provereno: Math.max(0, Number(dm.polnota.provereno) - snyato), iz: dm.polnota.iz, ustarelo: snyato };
    }
    return r;
  }

  function dopolnit(r) {
    if (!r || typeof r !== 'object' || !r.company) return r;
    var dm = r.damia && typeof r.damia === 'object' ? r.damia : null;
    if (dm) { privestiSlovar(dm); sudyItog(dm.sudy); sudyNol(dm.sudy); ustarevanie(r); }
    var est = dm && dm.bankrotstvo && typeof dm.bankrotstvo === 'object' ? dm.bankrotstvo : null;
    // ЕГРЮЛ говорит «банкротство», а картотека API — «дел, где компания должник, не нашли»: верим ЕГРЮЛ (запись о процедуре
    // вносит налоговая по решению суда; картотека по роли «должник» могла не сопоставиться)
    var bankrotEgryul = String((r.company || {}).status || '').toUpperCase() === 'BANKRUPT';
    if (!est || !OTVETIL[est.status] || (bankrotEgryul && est.status === 'not_found')) {
      var b = bankrotstvoIzEgryul(r);
      if (b) {
        if (!dm) { dm = {}; r.damia = dm; }
        if (est && est.proverit_samim) b.proverit_samim = est.proverit_samim;
        dm.bankrotstvo = b;
        if (dm.polnota && typeof dm.polnota === 'object' && isFinite(dm.polnota.provereno) && !(est && OTVETIL[est.status]) && !(est && est.ustarelo)) {
          dm.polnota = { provereno: Number(dm.polnota.provereno) + 1, iz: dm.polnota.iz };
        }
      }
    }
    // приставы: один словарь для вывода и Индекса
    var f = dm && dm.fssp;
    if (f && typeof f === 'object' && OTVETIL[f.status] && f.sostoyanie !== f.status) f.sostoyanie = f.status;
    // единый статус у каждого блока — для отчёта, Паспорта, досье и экспорта
    if (dm) Object.keys(dm).forEach(function (k) { var b = dm[k]; if (b && typeof b === 'object' && k !== 'polnota') { b.status_edinyj = statusIstochnika(b); b.status_edinyj_tekst = statusTekst(b); } });
    return r;
  }

  // Для Индекса: реестр учтён в полноте — ответ API с проверкой самого реестра (не подстановка из ЕГРЮЛ)
  function uchten(b) {
    if (!b || typeof b !== 'object' || b.iz_egryul || b.ustarelo) return false;
    return b.status === 'provereno' || b.status === 'found' || b.status === 'not_found';
  }

  return { dopolnit: dopolnit, ustarevanie: ustarevanie, statusIstochnika: statusIstochnika, statusTekst: statusTekst, STATUSY: STATUSY, REESTR: REESTR, bankrotstvoIzEgryul: bankrotstvoIzEgryul, uchten: uchten, privestiSlovar: privestiSlovar, sudyItog: sudyItog, sudyNol: sudyNol, samiTekst: samiTekst, OGOVORKA_EFRSB: OGOVORKA_EFRSB };
});
