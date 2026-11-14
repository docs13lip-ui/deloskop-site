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
  // istochniki-checko-v1 (12.11.2026): суды, приставы и ЕФРСБ снова обновляются — через Checko (живой /api/check 12.11 19:10);
  // банкротство — свой источник ЕФРСБ, а не картотека. ЕИС (РНП) и решения ФНС — по-прежнему с 12.10.
  var REESTR = {
    kad: { damia: ['sudy'], ustarelo_dney: 7, sostoyanie: 'podklyuchen' },
    fssp: { damia: ['fssp'], ustarelo_dney: 7, sostoyanie: 'podklyuchen' },
    eis: { damia: ['rnp', 'kontrakty'], ustarelo_dney: 30, sostoyanie: 'zamorozhen', s: '2026-10-12' },
    efrsb: { damia: ['bankrotstvo'], ustarelo_dney: 7, sostoyanie: 'podklyuchen' },
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
      // Подключённый источник без ответа (посредник не ответил, лимит) — «не удалось проверить», а не «не подключён» и не «0 дел»
      if (ist.sostoyanie === 'podklyuchen' && (b.status === 'not_checked' || b.status === 'ne_provereno' || b.sostoyanie === 'not_checked')) {
        b.oshibka = true;
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

  // maska-storon-v1 (юрист 12.11, п. 1.3): ФИО граждан и ИП из сторон дел и производств (ответ Checko) не показываем и
  // не храним — ни в отчёте, ни в папке, ни в экспорте. Наименования организаций остаются. Ключи — как у API и у Checko.
  var KLYUCHI_STORON = { istcy: 1, istec: 1, otvetchiki: 1, otvetchik_imya: 1, storony: 1, vzyskatel: 1, vzyskateli: 1, dolzhnik: 1,
    'Ист': 1, 'Ответ': 1, 'ДолжНаим': 1, 'Должник': 1, 'Взыскатель': 1, 'Истец': 1, 'Ответчик': 1, 'ВзыскНаим': 1 };
  var RE_IP = /^\s*(ИП|индивидуальный\s+предприниматель)(\s|$)/i;
  var RE_FIO_INIC = /^\s*[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s+[А-ЯЁ]\.\s*(?:[А-ЯЁ]\.?)?\s*$/;
  var RE_FIO_INIC2 = /^\s*[А-ЯЁ]\.\s*(?:[А-ЯЁ]\.)?\s*[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s*$/;
  var RE_FIO_POLN = /^\s*(?:[А-ЯЁ][А-ЯЁа-яё-]+\s+){2,3}(?:[А-ЯЁ][А-ЯЁа-яё-]*(?:вич|вна|ична|ВИЧ|ВНА|ИЧНА)|[Оо]глы|[Кк]ызы|ОГЛЫ|КЫЗЫ)\s*$/;
  function storona(v) {
    if (typeof v !== 'string') return v;
    if (RE_IP.test(v)) return 'индивидуальный предприниматель';
    if (RE_FIO_INIC.test(v) || RE_FIO_INIC2.test(v) || RE_FIO_POLN.test(v)) return 'физическое лицо';
    return v;
  }
  // сторона-объект: имя в naimenovanie / name / fio / НаимПолн — маскируем, остальное (роль, ИНН организации) обходим как обычно
  function obStorony(o, gl) {
    ['naimenovanie', 'name', 'fio', 'imya', 'Наим', 'НаимПолн', 'НаимСокр', 'ФИО'].forEach(function (p) { if (typeof o[p] === 'string') o[p] = storona(o[p]); });
    if (typeof o.fio === 'string' && o.fio) o.fio = 'физическое лицо';
    ['inn', 'ИНН', 'ogrn', 'ОГРН', 'ogrnip', 'ОГРНИП'].forEach(function (p) { if (/^\d{12}$|^\d{15}$/.test(String(o[p] == null ? '' : o[p]))) delete o[p]; });
    return maskaStoron(o, gl);
  }
  function maskaStoron(x, gl) {
    if (!x || typeof x !== 'object' || (gl = gl || 0) > 6) return x;
    Object.keys(x).forEach(function (k) {
      var v = x[k];
      if (KLYUCHI_STORON[k] === 1) {
        if (typeof v === 'string') x[k] = storona(v);
        else if (Array.isArray(v)) x[k] = v.map(function (e) { return typeof e === 'string' ? storona(e) : (e && typeof e === 'object' ? obStorony(e, gl + 1) : e); });
        else if (v && typeof v === 'object') obStorony(v, gl + 1);
      } else if (v && typeof v === 'object') maskaStoron(v, gl + 1);
    });
    return x;
  }

  // sverka-dohodov-v1 ([команда] 14.11; находка команда 14.11 02:45 и 09:10, ✎ «Сервер»): у части компаний
  // доходы за год из набора ФНС «доходы и расходы» приходят в 1 000 раз больше (единицы: тысячи вместо рублей) —
  // 0105053225: 2024 — 31 438 000 ₽, 2025 — 32 461 319 000 ₽. На этом числе сервер строил строку «Низкая налоговая нагрузка»
  // (warn), «Оборот около 32,5 млрд ₽», рост +733 % в год, а Индекс считал «крупную недоимку» и «крупный долг у приставов»
  // от завышенной выручки — риск занижался. Здесь, до всех модулей отчёта: год, где доходы ≥ 1 млрд ₽ и в 100+ раз больше
  // последнего года с выручкой, НЕ учитываем — ни в рядах, ни в показателях, ни в «Деньгах на кону», ни в Индексе.
  // Число не «чиним» делением: что верно — решает сверка с бухотчётностью, а не мы. Строку светофора про нагрузку
  // заменяем честной «Доходы за ГГГГ год — не сверены» (нейтральная, не минус). Порог настоящего роста ×100 при сумме
  // от 1 млрд ₽ за год почти не встречается; если встретится — человек увидит «не сверены» и ссылку на ГИР БО, а не ложь.
  var SVERKA = { kratno: 100, summa: 1e9 };
  // показатели и строки «Динамики», которые сервер считает по балансу (ГИР БО) последнего года — снимаются вместе с ним
  var BALANS_KPI = /^(Активы|Собственный капитал|Фирме должны|Фирма должна|Деньги на счетах|Заёмные средства|Долги)/i;
  var BALANS_STROKI = /^(Доля заёмных средств|Деньги на счетах|Текущая ликвидность|Собственный капитал|Активы)/i;
  function razryady(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
  function razSkl(n) { var a = Math.abs(Math.round(n)) % 100, b = a % 10; return a > 10 && a < 20 ? 'раз' : b >= 2 && b <= 4 ? 'раза' : 'раз'; }
  function ryadGod(ryad) {
    var po = {};
    (Array.isArray(ryad) ? ryad : []).forEach(function (x) {
      if (x && isFinite(+x.year) && x.value !== null && x.value !== '' && typeof x.value !== 'boolean' && isFinite(Number(x.value))) po[+x.year] = Number(x.value);
    });
    return Object.keys(po).map(Number).sort(function (a, b) { return a - b; }).map(function (g) { return { g: g, v: po[g] }; });
  }
  // r → [{god, summa, proshlyj: {god, summa}, kratno}] — годы, которые не сходятся с прошлыми
  function neSverennye(r) {
    var ch = r && r.dossier && r.dossier.charts, a = ryadGod(ch && ch.revenue), out = [], pr = null;
    a.forEach(function (x) {
      if (pr && x.v >= SVERKA.summa && x.v >= SVERKA.kratno * pr.v) out.push({ god: x.g, summa: x.v, proshlyj: { god: pr.g, summa: pr.v }, kratno: x.v / pr.v });
      else if (x.v > 0) pr = x; // сравниваем с последним годом, где выручка была и сошлась
    });
    return out;
  }
  function sverkaDohodov(r) {
    if (!r || typeof r !== 'object' || r.sverka_dohodov) return r;
    var ns = neSverennye(r);
    if (!ns.length) return r;
    var D = r.dossier, ch = D.charts, goda = {}, nov = ns[ns.length - 1];
    ns.forEach(function (x) { goda[x.god] = true; });
    r.sverka_dohodov = ns;
    // sverka-dohodov-v2 [команда] 14.11: живой отчёт 7453199651 после v1 — в «Динамике» «Налог на прибыль 2025 —
    // 266,1 млн ₽ ▲ в 390 раз», а в «На чём держится компания» капитал 2,1 млрд ₽ (баланс 2025 того же ответа, «Активы» ▲13 447 %).
    // Год не сверен целиком: налог на прибыль снимаем вместе с выручкой и прибылью; баланс — если «Активы» за тот же год выросли ×100+.
    ['revenue', 'profit', 'income_tax'].forEach(function (k) {
      if (Array.isArray(ch[k])) ch[k] = ch[k].filter(function (x) { return !(x && goda[+x.year]); });
    });
    var bal = ch.balance && typeof ch.balance === 'object' && !Array.isArray(ch.balance) ? ch.balance : null, balGod = bal ? parseInt(bal.year, 10) : NaN;
    var aktK = (Array.isArray(D.kpi) ? D.kpi : []).filter(function (k) { return k && /^Активы(\s|$)/.test(String(k.label || '')); })[0];
    var balNe = !!(bal && goda[balGod] && aktK && Number(aktK.delta) >= (SVERKA.kratno - 1) * 100);
    if (balNe) {
      r.sverka_balansa = { god: balGod, kratno: 1 + Number(aktK.delta) / 100 };
      delete ch.balance;
      if (ch.debts && typeof ch.debts === 'object' && parseInt(ch.debts.year, 10) === balGod) delete ch.debts;
    }
    var rv = ryadGod(ch.revenue), pf = ryadGod(ch.profit);
    function poslednij(a) { return a.length ? a[a.length - 1] : null; }
    function delta(a, g) { // как у сервера: процент к прошлому году, целым; прошлого года нет или ≤ 0 — без процента
      var t = a.filter(function (x) { return x.g === g; })[0], p = a.filter(function (x) { return x.g === g - 1; })[0];
      return t && p && p.v > 0 ? Math.round((t.v / p.v - 1) * 100) : null;
    }
    // показатели: выручка и прибыль — за последний сверенный год; нагрузка «без взносов» считалась от не сверенного — убираем
    if (Array.isArray(D.kpi)) D.kpi = D.kpi.filter(function (k) {
      var L = String((k && k.label) || ''), m = /^(Выручка|Чистая прибыль) за (\d{4})$/.exec(L);
      if (/^Налоговая нагрузка/i.test(L)) return false;
      if (balNe && !/ за \d{4}$/.test(L) && BALANS_KPI.test(L)) return false; // показатели баланса того же не сверенного года
      if (!/ за \d{4}$/.test(L) && Number(k.delta) >= (SVERKA.kratno - 1) * 100) return false; // «Активы» ×100+ к прошлому году в том же наборе — тоже не сверены
      if (!m || !goda[+m[2]]) return true;
      var a = m[1] === 'Выручка' ? rv : pf, p = poslednij(a);
      if (!p) return false;
      k.label = m[1] + ' за ' + p.g; k.value = p.v; k.delta = delta(a, p.g);
      return true;
    });
    // «Деньги на кону»: сумма — против выручки последнего сверенного года по ГИР БО (процент считает js/dengi-na-konu.js)
    var dv = r.dengi && r.dengi.vyruchka;
    if (dv && goda[+dv.god]) {
      var pv = poslednij(rv);
      r.dengi.vyruchka = pv && pv.v > 0 ? { summa: pv.v, god: pv.g, istochnik: 'ГИР БО ФНС, годовая бухгалтерская отчётность', zamena_za: +dv.god }
        : { summa: null, god: null, istochnik: dv.istochnik, zamena_za: +dv.god };
      if ('dolya' in r.dengi) r.dengi.dolya = null;
      if (r.dengi.doli && typeof r.dengi.doli === 'object') r.dengi.doli = null;
    }
    var tekst = 'Доходы за' + NB + nov.god + NB + 'год в' + NB + 'открытых данных ФНС — ' + razryady(nov.summa) + NB + '₽, в' + NB +
      razryady(nov.kratno) + NB + razSkl(nov.kratno) + ' больше, чем за' + NB + nov.proshlyj.god + NB + 'год (' + razryady(nov.proshlyj.summa) + NB + '₽). ' +
      'Так бывает при ошибке единиц в' + NB + 'наборе. Этот год не' + NB + 'учитываем — ни в' + NB + 'выручке, ни в' + NB + 'налоговой нагрузке, ни в' + NB + 'Индексе; ' +
      'сверьте с' + NB + 'бухотчётностью на' + NB + 'bo.nalog.gov.ru.' +
      (balNe ? ' Баланс на' + NB + '31.12.' + balGod + ' из' + NB + 'того' + NB + 'же ответа тоже вырос в' + NB + razryady(r.sverka_balansa.kratno) + NB + razSkl(r.sverka_balansa.kratno) + ' — его не' + NB + 'показываем.' : '');
    r.sverka_dohodov_tekst = tekst;
    // разделы досье: «Финансы» — строки, посчитанные от не сверенных доходов, снимаем; «Динамика» — без не сверенного года
    (Array.isArray(D.sections) ? D.sections : []).forEach(function (sk) {
      if (!sk || !Array.isArray(sk.rows)) return;
      if (sk.id === 'finance') {
        var na = sk.rows.filter(function (x) { return Array.isArray(x) && x[0] === 'Данные на'; })[0], g = na && /(\d{4})\s*$/.exec(String(na[1]));
        if (g && !goda[+g[1]]) return;
        sk.rows = sk.rows.filter(function (x) { return !(Array.isArray(x) && /^(Доходы за год|Расходы за год|Финансовый результат|Рентабельность|Налоговая нагрузка|Доход на одного сотрудника)/i.test(String(x[0]))); });
        sk.comment = tekst;
      }
      if (sk.id === 'dynamics') {
        sk.rows = sk.rows.filter(function (x) { return !(Array.isArray(x) && (goda[+String(x[0]).trim()] && /^\d{4}$/.test(String(x[0]).trim()) || /^Средний рост выручки/i.test(String(x[0])) ||
          balNe && BALANS_STROKI.test(String(x[0])))); });
        var ost = (String(sk.comment || '').match(/[^.]+\.?/g) || []).map(function (f) { return f.trim(); }).filter(function (f) { return f && !/выручк|рентабельн|раст[её]т|прибыл|зарабатыва|сокращ/i.test(f) && !(balNe && /оборотн|ликвидн|заём|долг|капитал|на счетах/i.test(f)); });
        sk.comment = ['Год ' + Object.keys(goda).join(', ') + ' не' + NB + 'показываем: доходы в' + NB + 'открытых данных ФНС не' + NB + 'сходятся с' + NB + 'прошлыми годами.'].concat(ost).join(' ');
      }
    });
    // светофор: строка нагрузки стояла на не сверенном числе → честная нейтральная строка; нет такой — добавляем
    var S = Array.isArray(r.signals) ? r.signals : (r.signals = []), stroka = {
      id: 'sverka_dohodov', title: 'Доходы за' + NB + nov.god + NB + 'год', status: 'not_checked',
      detail: 'Не сверены: в' + NB + razryady(nov.kratno) + NB + razSkl(nov.kratno) + ' больше, чем за' + NB + nov.proshlyj.god + NB + 'год — в' + NB + 'оценку не' + NB + 'взяли',
      pains: [], source: 'ФНС, открытые данные: доходы и расходы организации', as_of: '31.12.' + nov.god, sverka_dohodov: true };
    var i = -1;
    S.forEach(function (s, j) { if (i < 0 && s && (s.id === 'tax_burden' || /^Низкая налоговая нагрузка/i.test(String(s.title || '')))) i = j; });
    if (i >= 0) S.splice(i, 1, stroka); else S.push(stroka);
    if (typeof r.verdict === 'string') r.verdict = r.verdict.replace(/,\s*низкая налоговая нагрузка|низкая налоговая нагрузка,\s*/i, '');
    return r;
  }

  function dopolnit(r) {
    if (!r || typeof r !== 'object' || !r.company) return r;
    var dm = r.damia && typeof r.damia === 'object' ? r.damia : null;
    if (dm) { maskaStoron(dm); privestiSlovar(dm); sudyItog(dm.sudy); sudyNol(dm.sudy); ustarevanie(r); }
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
    sverkaDohodov(r); // sverka-dohodov-v1: доходы года, не сходящиеся с прошлыми, — до всех модулей отчёта
    return r;
  }

  // Для Индекса: реестр учтён в полноте — ответ API с проверкой самого реестра (не подстановка из ЕГРЮЛ)
  function uchten(b) {
    if (!b || typeof b !== 'object' || b.iz_egryul || b.ustarelo) return false;
    return b.status === 'provereno' || b.status === 'found' || b.status === 'not_found';
  }

  return { dopolnit: dopolnit, ustarevanie: ustarevanie, statusIstochnika: statusIstochnika, statusTekst: statusTekst, STATUSY: STATUSY, REESTR: REESTR, bankrotstvoIzEgryul: bankrotstvoIzEgryul, uchten: uchten, privestiSlovar: privestiSlovar, maskaStoron: maskaStoron, storona: storona, sudyItog: sudyItog, sudyNol: sudyNol, samiTekst: samiTekst, OGOVORKA_EFRSB: OGOVORKA_EFRSB, sverkaDohodov: sverkaDohodov, neSverennye: neSverennye, SVERKA: SVERKA };
});
