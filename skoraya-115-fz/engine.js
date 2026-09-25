/* Делоскоп · Скорая 115-ФЗ — движок.
   Чистые функции: рабочие дни по производственному календарю, план со сроками,
   деньги в простое, документы, черновики писем, разбор выписки 1С.
   Ничего не отправляет в сеть. Работает в браузере и в Node (для тестов). */
(function (root) {
  'use strict';

  /* ---------- Производственный календарь ----------
     Только будни, которые стали нерабочими, и субботы, которые стали рабочими.
     2025 — Постановление Правительства РФ от 04.10.2024 № 1335;
     2026 — от 24.09.2025 № 1466; 2027 — от 17.09.2026 № 1187. */
  var OFF = {
    2025: ['01-01','01-02','01-03','01-06','01-07','01-08','02-24','03-10','05-01','05-02','05-09','06-12','11-03','11-04','12-31'],
    2026: ['01-01','01-02','01-05','01-06','01-07','01-08','01-09','02-23','03-09','05-01','05-11','06-12','11-04','12-31'],
    2027: ['01-01','01-04','01-05','01-06','01-07','01-08','02-22','02-23','03-08','05-03','05-10','06-14','11-04','11-05','12-31']
  };
  var WORK_SAT = { 2025: ['11-01'], 2026: [], 2027: ['02-20'] };
  var CAL_FROM = 2025, CAL_TO = 2027;

  var DAY = 86400000;
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(t);
    if (d.getUTCMonth() !== +m[2] - 1) return null;
    return t;
  }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function key(t) { return iso(t).slice(5); }
  function year(t) { return new Date(t).getUTCFullYear(); }

  function covered(s) { var t = parse(s); var y = year(t); return y >= CAL_FROM && y <= CAL_TO; }
  function isWorkday(s) {
    var t = typeof s === 'number' ? s : parse(s);
    var y = year(t), k = key(t), wd = new Date(t).getUTCDay();
    if ((WORK_SAT[y] || []).indexOf(k) >= 0) return true;
    if (wd === 0 || wd === 6) return false;
    if ((OFF[y] || []).indexOf(k) >= 0) return false;
    return true;
  }
  /* n-й рабочий день ПОСЛЕ даты s (сам день s не считается) */
  function addWorkdays(s, n) {
    var t = parse(s), c = 0;
    if (n <= 0) return iso(t);
    while (c < n) { t += DAY; if (isWorkday(t)) c++; }
    return iso(t);
  }
  function nextWorkday(s) { var t = parse(s); while (!isWorkday(t)) t += DAY; return iso(t); }
  function workdaysBetween(a, b) { /* рабочих дней в (a; b] */
    var t = parse(a), e = parse(b), c = 0;
    if (e <= t) return 0;
    while (t < e) { t += DAY; if (isWorkday(t)) c++; }
    return c;
  }
  /* Срок «в течение N месяцев со дня, следующего за днём получения»:
     истекает в соответствующее число последнего месяца (ст. 192 ГК РФ),
     если это нерабочий день — переносится на ближайший рабочий (ст. 193 ГК РФ). */
  function addMonthsDeadline(s, months) {
    var d = new Date(parse(s));
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + months, day = d.getUTCDate();
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return nextWorkday(iso(Date.UTC(y, m, Math.min(day, last))));
  }
  function addDays(s, n) { return iso(parse(s) + n * DAY); }

  /* ---------- Типографика по «Ководству» ---------- */
  var NB = ' ';
  function num(n) {
    n = Math.round(Number(n) || 0);
    var s = String(Math.abs(n)), out = '';
    if (s.length <= 4) out = s; /* 1500 — без пробела, как в «Ководстве» */
    else out = s.replace(/\B(?=(\d{3})+(?!\d))/g, NB);
    return (n < 0 ? '−' : '') + out;
  }
  function rub(n) { return num(n) + NB + '₽'; }
  function rubShort(n) {
    n = Number(n) || 0;
    if (Math.abs(n) >= 1e6) return String((Math.round(n / 1e5) / 10)).replace('.', ',') + NB + 'млн' + NB + '₽';
    if (Math.abs(n) >= 1e4) return num(Math.round(n / 1e3)) + NB + 'тыс.' + NB + '₽';
    return rub(n);
  }
  var MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  var WD = ['вс','пн','вт','ср','чт','пт','сб'];
  var MON_SHORT = ['янв.','февр.','марта','апр.','мая','июня','июля','авг.','сент.','окт.','нояб.','дек.'];
  function humanShort(s, refYear) {
    var d = new Date(parse(s));
    return d.getUTCDate() + NB + MON_SHORT[d.getUTCMonth()] + (refYear && d.getUTCFullYear() !== refYear ? NB + d.getUTCFullYear() : '');
  }
  function weekday(s) { return WD[new Date(parse(s)).getUTCDay()]; }
  function humanY(s) { return human(s) + NB + s.slice(0, 4); }
  function human(s, withWd) {
    var d = new Date(parse(s));
    var r = d.getUTCDate() + NB + MONTHS[d.getUTCMonth()];
    if (withWd) r += ', ' + WD[d.getUTCDay()];
    return r;
  }
  function plural(n, a, b, c) {
    n = Math.abs(n) % 100; var n1 = n % 10;
    if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c;
  }

  /* ---------- Ситуации ---------- */
  var SCENARIOS = {
    zapros: {
      title: 'Банк запросил документы',
      short: 'Запрос документов',
      tone: 'warn',
      verdict: 'Это ещё не блокировка. Хороший ответ сейчас — лучшая защита от неё.',
      what: 'Банк проверяет операции и имеет право запросить сведения (п. 14 ст. 7 115-ФЗ). Счёт работает. Если ответа не будет или он не убедит — следующий шаг банка обычно отказ в операции или ограничение интернет-банка.'
    },
    otkaz: {
      title: 'Банк не провёл платёж',
      short: 'Отказ в операции',
      tone: 'bad',
      verdict: 'Остальные операции, как правило, работают. Реабилитация в банке — 7 рабочих дней после подачи документов.',
      what: 'Банк отказал в конкретной операции по 115-ФЗ (ст. 7). Он обязан сообщить дату и причину отказа. Вы вправе представить документы, что оснований для отказа нет, — банк рассматривает их не дольше 7 рабочих дней (п. 13.4 ст. 7).'
    },
    dbo: {
      title: 'Отключили интернет-банк или карту',
      short: 'Ограничение ДБО',
      tone: 'bad',
      verdict: 'Счёт не закрыт: платить можно бумажными поручениями в отделении. Параллельно — документы на снятие ограничения.',
      what: 'Банк ограничил дистанционное обслуживание. По разъяснению Банка России это не мешает проводить операции по счёту в отделении по платёжным поручениям на бумаге.'
    },
    rastorzhenie: {
      title: 'Банк расторгает договор счёта',
      short: 'Расторжение договора',
      tone: 'bad',
      verdict: 'Главное — забрать остаток и не остановить бизнес. Второй счёт в другом банке — нормальный законный шаг.',
      what: 'Банк вправе расторгнуть договор, если в течение года дважды и более отказывал в операциях по 115-ФЗ (п. 5.2 ст. 7). Остаток выдаётся или перечисляется по вашему заявлению не позднее 7 дней (п. 3 ст. 859 ГК РФ) — кроме случая, когда у вас красная зона ЗСК.'
    },
    zsk: {
      title: 'Красная зона ЗСК — стоят все банки',
      short: 'Высокий риск ЗСК',
      tone: 'bad',
      verdict: 'Самый серьёзный случай, но у него понятный законный выход: заявление в Банк России или в межведомственную комиссию.',
      what: 'Платформа Банка России «Знай своего клиента» присвоила высокий уровень риска. Банки не проводят списания, СБП и выдачу наличных, не выдают остаток при закрытии счёта (п. 5 ст. 7.7). Разрешён короткий список операций (п. 6 ст. 7.7) — он ниже.'
    },
    unknown: {
      title: 'Не знаю точно, что случилось',
      short: 'Неясно',
      tone: 'warn',
      verdict: 'Первое дело — получить от банка письменный ответ: какая мера и из-за какой операции.',
      what: 'Под словами «заблокировали счёт» скрываются пять разных мер — от запроса документов до красной зоны ЗСК. От вида меры зависят сроки и путь. Банк обязан сообщить о мере письменно. И проверьте, не налоговая ли приостановила операции (ст. 76 НК РФ) — тогда путь другой: погасить долг или сдать декларацию.'
    }
  };

  /* Что работает прямо сейчас */
  function worksNow(sc, o) {
    o = o || {};
    if (sc === 'zsk') {
      var a = [
        'Налоги, сборы, страховые взносы и таможенные платежи.',
        'Зарплата сотрудникам — не больше, чем за прошлый месяц' + (o.payroll > 0 ? ' (у вас это до ' + rub(o.payroll) + ')' : '') + '.',
        'Выплаты по Трудовому кодексу, пенсии, алименты, соцвыплаты.',
        'Платежи по кредитам в этом банке.'
      ];
      if (o.form === 'ip') a.push('Предпринимателю — до ' + rub(30000) + ' в календарный месяц на жизнь.');
      a.push('Операции при банкротстве и ликвидации.');
      return { title: 'Что банк обязан провести даже сейчас', basis: 'п. 6 ст. 7.7 115-ФЗ', items: a };
    }
    if (sc === 'dbo') return { title: 'Как платить прямо сейчас', basis: 'разъяснение Банка России', items: [
      'Платёжные поручения на бумаге — в отделении банка, где открыт счёт.',
      'Сначала — налоги, зарплата и платежи с неустойкой за просрочку.',
      'Возьмите с собой печать (если есть) и доверенность, если идёт не руководитель.'
    ]};
    if (sc === 'otkaz') return { title: 'Что работает', basis: 'ст. 7 115-ФЗ', items: [
      'Счёт открыт, другие операции обычно проходят.',
      'Не повторяйте отклонённый платёж тем же текстом и не дробите его — это усиливает подозрение.'
    ]};
    if (sc === 'rastorzhenie') return { title: 'Что работает', basis: 'п. 3 ст. 859 ГК РФ', items: [
      'До закрытия счёта — налоги и зарплата, если банк не ограничил их отдельно.',
      'Остаток — по вашему заявлению на другой счёт, не позднее 7 дней.'
    ]};
    if (sc === 'zapros') return { title: 'Что работает', basis: '', items: ['Всё: счёт работает. Задача — ответить так, чтобы вопросов не осталось.'] };
    return { title: 'Что работает', basis: '', items: ['Узнайте вид меры — от него зависит, какие операции доступны.'] };
  }

  /* ---------- План со сроками ---------- */
  var PREP_DAYS = 2;      /* рекомендуемый срок сбора пакета, рабочих дней */
  var MVK_DAYS = 20;      /* п. 13.5 ст. 7 115-ФЗ, Положение ЦБ № 842-П; худший вариант */
  var CB_DAYS = 15;       /* п. 1.1 ст. 7.8 115-ФЗ */
  var BANK_DAYS = 7;      /* п. 13.4 ст. 7 115-ФЗ */
  var WD_PER_MONTH = 247 / 12;

  function buildPlan(inp) {
    var sc = SCENARIOS[inp.scenario] ? inp.scenario : 'unknown';
    var today = inp.today;
    var d0 = parse(inp.eventDate) ? inp.eventDate : today;
    if (parse(d0) > parse(today)) d0 = today;
    var start = parse(d0) > parse(today) ? d0 : today;
    var steps = [];
    function step(date, label, basis, kind, note) { steps.push({ date: date, label: label, basis: basis || '', kind: kind || 'you', note: note || '' }); }

    var submit = addWorkdays(start, PREP_DAYS);
    if (sc === 'zapros') {
      var due = parse(inp.dueDate) ? inp.dueDate : addWorkdays(d0, 5);
      step(d0, 'Банк прислал запрос', '', 'bank');
      step(today, 'Разобрать запрос: какие операции и какие документы просят', '', 'you');
      step(addWorkdays(start, 1) < due ? addWorkdays(start, 1) : today, 'Собрать пакет и написать пояснение', '', 'you');
      step(due, parse(inp.dueDate) ? 'Срок ответа из запроса банка' : 'Ответить банку — рекомендуемый срок', parse(inp.dueDate) ? 'запрос банка' : 'закон срок не задаёт; 5 рабочих дней — разумный ориентир', 'deadline');
    } else if (sc === 'otkaz' || sc === 'dbo' || sc === 'unknown') {
      step(d0, sc === 'dbo' ? 'Банк ограничил интернет-банк' : sc === 'otkaz' ? 'Банк отказал в операции' : 'Банк ввёл ограничение', '', 'bank');
      step(addWorkdays(d0, 5), 'Крайний срок, когда банк должен сообщить дату и причину', 'ст. 7 115-ФЗ', 'bank');
      step(submit, 'Подать в банк документы и пояснение', 'п. 13.4 ст. 7 115-ФЗ', 'you', 'Лучше раньше: срок банка считается со дня подачи');
      step(addWorkdays(submit, BANK_DAYS), 'Банк обязан ответить: снимает ограничение или нет', 'п. 13.4 ст. 7 115-ФЗ', 'deadline');
      var mvkIn = addWorkdays(addWorkdays(submit, BANK_DAYS), 3);
      step(mvkIn, 'Если отказ — заявление в межведомственную комиссию при Банке России', 'п. 13.5 ст. 7 115-ФЗ, Положение ЦБ № 842-П', 'you');
      step(addWorkdays(mvkIn, MVK_DAYS), 'Комиссия принимает решение', 'до 20 рабочих дней', 'deadline');
      step(addMonthsDeadline(d0, 6), 'Последний день подать заявление в комиссию', 'п. 13.5 ст. 7 115-ФЗ — 6 месяцев', 'limit');
    } else if (sc === 'rastorzhenie') {
      step(d0, 'Банк уведомил о расторжении', '', 'bank');
      step(addWorkdays(start, 1), 'Открыть счёт в другом банке и сообщить новые реквизиты контрагентам', '', 'you');
      step(addWorkdays(start, 1), 'Заявление о перечислении остатка на новый счёт', 'п. 3 ст. 859 ГК РФ', 'you');
      step(addDays(addWorkdays(start, 1), 7), 'Остаток должен прийти на новый счёт', 'не позднее 7 дней после заявления', 'deadline');
      step(addMonthsDeadline(d0, 6), 'Последний день оспорить отказы банка в комиссии', 'п. 13.5 ст. 7 115-ФЗ', 'limit');
    } else if (sc === 'zsk') {
      step(d0, 'Высокий уровень риска на платформе ЗСК', '', 'bank');
      step(addWorkdays(d0, 5), 'Крайний срок, когда банк должен сообщить о мерах', 'п. 8 ст. 7.7 115-ФЗ', 'bank');
      var cbIn = addWorkdays(start, 3);
      if (inp.zskBank === 'bank') {
        step(cbIn, 'Заявление в межведомственную комиссию при Банке России', 'п. 1 ст. 7.8 115-ФЗ', 'you', 'Высокий риск и у банка, и у ЦБ — идём сразу в комиссию');
        step(addWorkdays(cbIn, MVK_DAYS), 'Комиссия принимает решение', 'до 20 рабочих дней', 'deadline');
        step(addWorkdays(addWorkdays(cbIn, MVK_DAYS), 1), 'Банк снимает меры после положительного решения', 'п. 2 ст. 7.8 — не позднее 1 рабочего дня', 'bank');
      } else {
        step(cbIn, 'Заявление в Банк России о пересмотре уровня риска', 'п. 1.1 ст. 7.8 115-ФЗ', 'you', 'Через интернет-приёмную Банка России');
        step(addWorkdays(cbIn, CB_DAYS), 'Банк России отвечает', 'п. 1.1 ст. 7.8 — не позднее 15 рабочих дней', 'deadline');
        step(addWorkdays(addWorkdays(cbIn, CB_DAYS), 1), 'При положительном решении уровень риска меняют', 'не позднее 1 рабочего дня', 'bank');
        step(null, 'Если ЦБ отказал — комиссия в течение 6 месяцев после его решения', 'п. 1.2 ст. 7.8 115-ФЗ', 'limit');
      }
      step(addMonthsDeadline(d0, 6), 'Последний день подать заявление в комиссию', 'п. 1 ст. 7.8 115-ФЗ — 6 месяцев', 'limit');
    }

    /* по порядку дат; шаги без даты — в конце, исходный порядок при равных датах сохраняется */
    steps = steps.map(function (s, i) { s._i = i; return s; }).sort(function (a, b) {
      if (!a.date || !b.date) return (a.date ? 0 : 1) - (b.date ? 0 : 1) || a._i - b._i;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : a._i - b._i;
    });
    var anyOutside = steps.some(function (s) { return s.date && !covered(s.date); });
    steps.forEach(function (s) { if (s.date) s.passed = s.date < today; s.isToday = s.date === today; });

    return {
      scenario: sc, info: SCENARIOS[sc], today: today, eventDate: d0,
      steps: steps, works: worksNow(sc, inp), money: moneyAtStake(sc, inp.turnover),
      calendarNote: anyOutside ? 'Часть дат за пределами утверждённых производственных календарей — посчитали по пятидневке без учёта переносов.' : '',
      tasks: todayTasks(sc, inp), dont: dontDo(sc)
    };
  }

  /* ---------- Деньги в простое ---------- */
  function moneyAtStake(sc, turnover) {
    turnover = Number(turnover) || 0;
    if (!(turnover > 0)) return null;
    var perDay = turnover / WD_PER_MONTH;
    var fast, slow, fastLabel, slowLabel;
    if (sc === 'zsk') {
      fast = 3 + CB_DAYS + 1; fastLabel = 'Банк России снял риск по заявлению';
      slow = 3 + MVK_DAYS + 3 + 1; slowLabel = 'Решение через межведомственную комиссию';
    } else if (sc === 'rastorzhenie') {
      fast = 1; fastLabel = 'Второй счёт открыт за день';
      slow = 1 + 5; slowLabel = 'Остаток пришёл через 7 дней';
    } else if (sc === 'zapros') {
      fast = 0; fastLabel = 'Ответили вовремя — ограничений нет';
      slow = PREP_DAYS + BANK_DAYS; slowLabel = 'Если дойдёт до отказа и реабилитации';
    } else {
      fast = PREP_DAYS + BANK_DAYS; fastLabel = 'Банк снял ограничение после документов';
      slow = PREP_DAYS + BANK_DAYS + 3 + MVK_DAYS + 3 + 1; slowLabel = 'Решение через межведомственную комиссию';
    }
    return { perDay: perDay, fast: { days: fast, sum: perDay * fast, label: fastLabel }, slow: { days: slow, sum: perDay * slow, label: slowLabel } };
  }

  function todayTasks(sc, o) {
    var t = {
      zapros: ['Выписать, какие операции и документы просит банк, — по пунктам.', 'Собрать пакет по каждой операции (список ниже) и написать короткое пояснение.', 'Отправить ответ через интернет-банк и сохранить подтверждение отправки.'],
      otkaz: ['Запросить у банка письменно: какая операция и почему отказ.', 'Собрать документы по операции — договор, счёт, акт или накладная, переписка.', 'Подать пояснение с приложениями и записать дату подачи: от неё 7 рабочих дней.'],
      dbo: ['Срочные платежи — бумажными поручениями в отделении: налоги, зарплата, неустойки.', 'Запросить у банка письменно причину ограничения.', 'Подать документы и пояснение на снятие ограничения.'],
      rastorzhenie: ['Открыть счёт в другом банке сегодня — чтобы не остановились платежи.', 'Подать заявление о перечислении остатка на новый счёт.', 'Разослать контрагентам новые реквизиты официальным письмом.'],
      zsk: ['Проверить уровень риска по ИНН на сайте Банка России и сохранить снимок экрана.', 'Заплатить налоги и зарплату — они разрешены (п. 6 ст. 7.7).', 'Готовить заявление: отчётность, помещения, операции с 1 января прошлого года, три крупнейших контрагента.'],
      unknown: ['Проверить, не налоговая ли приостановила операции: сервис ФНС «Банкинформ» по ИНН и БИК банка. Это другая процедура — не 115-ФЗ.', 'Запросить у банка письменно: какая мера и из-за какой операции; проверить уровень риска по ИНН на сайте Банка России.', 'Вернуться сюда и выбрать точную ситуацию — план пересчитается.']
    };
    return t[sc] || t.unknown;
  }

  function dontDo(sc) {
    var base = [
      'Не выводите остатки резко в другой банк — это само по себе выглядит как признак риска.',
      'Не меняйте задним числом договоры и назначения платежей: подлог хуже любой блокировки.',
      'Не дробите отклонённый платёж на мелкие части.'
    ];
    if (sc === 'zsk') base.unshift('Не пытайтесь «переждать» в другом банке: красная зона видна всем банкам.');
    if (sc === 'rastorzhenie') base[0] = 'Открывать второй счёт можно и нужно, но переводите туда деньги по реальным операциям, без спешки.';
    return base;
  }

  /* ---------- Документы по типу операции ---------- */
  var OPS = {
    postavka: { t: 'Поставка товаров', docs: ['Договор поставки и спецификации', 'Счета и УПД или товарные накладные', 'Транспортные документы: ТТН или ЭТрН, путевые листы', 'Где хранится товар: договор аренды склада, фото', 'Переписка с поставщиком или покупателем о сделке'] },
    uslugi: { t: 'Работы и услуги', docs: ['Договор и техническое задание', 'Акты и отчёты о выполнении', 'Результат работы: файлы, фото, публикации', 'Кто выполнял: штат исполнителя или договоры с ним', 'Переписка по ходу работ'] },
    nalichnye: { t: 'Снятие или внесение наличных', docs: ['На что снимали: зарплатные ведомости, авансовые отчёты с чеками', 'Закупки у физлиц — закупочные акты', 'Кассовая книга и кассовые ордера', 'Откуда наличные при внесении: Z-отчёты ККТ или договор займа от учредителя', 'Расчёт, почему нужны именно наличные, а не безналичная оплата'] },
    fizlica: { t: 'Переводы физлицам и себе', docs: ['Договоры ГПХ и акты, уплаченные НДФЛ и взносы', 'Самозанятым — чеки из «Мой налог»', 'ИП себе — КУДиР и платёжки по налогам за период', 'Участникам ООО — решение о дивидендах и НДФЛ с них', 'Подотчётные суммы — авансовые отчёты'] },
    zaym: { t: 'Займы', docs: ['Договор займа и график возврата', 'Решение участников, если сделка требует одобрения', 'Откуда деньги у займодавца и за счёт чего вернёте', 'Бухгалтерская отчётность с отражением займа'] },
    tranzit: { t: 'Много поступлений и быстрые списания', docs: ['Экономический смысл: кто покупатели, кто поставщики, где наценка', 'Договоры с крупнейшими покупателями и поставщиками', 'Отчёты маркетплейсов или эквайринга', 'Где хранится товар и кто им занимается'] },
    ved: { t: 'Внешнеэкономическая сделка', docs: ['Внешнеторговый контракт и уникальный номер контракта', 'Декларации на товары', 'Транспортные и страховые документы', 'Подтверждение поставки и оплаты'] }
  };
  var BASE_DOCS = [
    'Последняя бухгалтерская отчётность и декларации с отметкой о приёме',
    'Справка об отсутствии долга по налогам (личный кабинет ФНС)',
    'Сведения о сотрудниках: расчёт по страховым взносам или ЕФС-1',
    'Договор аренды офиса, склада или производства, фото помещений',
    'Сайт, карточки на маркетплейсах, реклама — всё, что показывает реальный бизнес'
  ];
  var MVK_DOCS = [
    'Показатели финансовой отчётности',
    'Сведения о производственных и складских помещениях (если есть)',
    'Операции по счетам с 1 января прошлого года до месяца подачи',
    'Три крупнейших контрагента по поступлениям и три — по списаниям'
  ];
  function docsFor(ops, sc) {
    var out = [];
    (ops || []).forEach(function (k) { if (OPS[k]) out.push({ group: OPS[k].t, items: OPS[k].docs.slice() }); });
    out.push({ group: 'Базовый пакет о компании', items: BASE_DOCS.slice() });
    if (sc === 'zsk' || sc === 'otkaz' || sc === 'dbo' || sc === 'rastorzhenie' || sc === 'unknown')
      out.push({ group: 'Для межведомственной комиссии (Положение ЦБ № 842-П)', items: MVK_DOCS.slice(), mvk: true });
    return out;
  }

  /* ---------- Черновик письма ---------- */
  function s(v, ph) { v = String(v == null ? '' : v).trim(); return v || ph; }
  function buildLetter(sc, f, attachments) {
    f = f || {};
    var who = s(f.company, '[название компании или ФИО ИП]') + ', ИНН ' + s(f.inn, '[ИНН]');
    var head, addressee, title, body;
    var today = f.today ? human(f.today) + ' ' + f.today.slice(0, 4) + NB + 'г.' : '';
    var op = 'операции ' + (f.opDate ? 'от ' + human(f.opDate) + ' ' + f.opDate.slice(0, 4) + NB + 'г. ' : '') +
      (f.opSum ? 'на сумму ' + rub(f.opSum) + ' ' : '') + (f.opCounterparty ? 'в адрес ' + f.opCounterparty.trim() + ' ' : '');
    op = op.trim();
    var expl = s(f.explanation, '[Коротко и по фактам: кто контрагент, за что платёж, почему такая сумма, где подтверждение. Каждое утверждение — со ссылкой на приложение.]');
    addressee = 'В ' + s(f.bank, '[название банка]');
    if (sc === 'zsk') {
      addressee = f.zskBank === 'bank' ? 'В межведомственную комиссию при Банке России' : 'В Банк России';
      title = f.zskBank === 'bank' ? 'Заявление об отсутствии оснований для применения мер (п. 1 ст. 7.8 Федерального закона № 115-ФЗ)' : 'Заявление о пересмотре высокого уровня риска (п. 1.1 ст. 7.8 Федерального закона № 115-ФЗ)';
      body = 'Платформа «Знай своего клиента» отнесла ' + who + ' к группе высокого риска' + (f.eventDate ? ' (информация получена ' + human(f.eventDate) + ' ' + f.eventDate.slice(0, 4) + NB + 'г.)' : '') + '. Считаем, что оснований для этого нет: компания ведёт реальную деятельность, платит налоги и взносы, операции экономически обоснованы.\n\n' + expl + '\n\nПрошу пересмотреть уровень риска и сообщить о решении.';
    } else if (sc === 'zapros') {
      title = 'Ответ на запрос' + (f.reqNo ? ' № ' + f.reqNo : '') + (f.eventDate ? ' от ' + human(f.eventDate) + ' ' + f.eventDate.slice(0, 4) + NB + 'г.' : '');
      body = 'В ответ на запрос сообщаем сведения по ' + (op ? op : 'операциям, указанным в запросе') + '.\n\n' + expl + '\n\nГотовы представить дополнительные документы, если они понадобятся.';
    } else if (sc === 'rastorzhenie') {
      title = 'Заявление о перечислении остатка денежных средств';
      body = 'В связи с расторжением договора банковского счёта ' + s(f.account, '[номер счёта]') + ' прошу перечислить остаток денежных средств на счёт ' + s(f.newAccount, '[номер нового счёта]') + ' в ' + s(f.newBank, '[банк, БИК]') + ' в срок, установленный п. 3 ст. 859 ГК РФ.\n\nОдновременно прошу сообщить, какие операции послужили основанием для отказов, и принять документы, подтверждающие отсутствие оснований для них (п. 13.4 ст. 7 Федерального закона № 115-ФЗ).\n\n' + expl;
    } else {
      title = sc === 'dbo' ? 'Заявление о восстановлении дистанционного банковского обслуживания' : 'Заявление об отсутствии оснований для отказа в проведении операции (п. 13.4 ст. 7 Федерального закона № 115-ФЗ)';
      body = (sc === 'dbo' ? 'Банк ограничил дистанционное обслуживание по счёту ' + s(f.account, '[номер счёта]') + (f.eventDate ? ' с ' + human(f.eventDate) + ' ' + f.eventDate.slice(0, 4) + NB + 'г.' : '') + '.' : 'Банк отказал в проведении ' + (op || 'операции') + ' по счёту ' + s(f.account, '[номер счёта]') + '.') +
        ' Представляем документы и сведения, подтверждающие, что оснований для этого нет.\n\n' + expl +
        '\n\nПрошу рассмотреть документы в срок, установленный п. 13.4 ст. 7 Федерального закона № 115-ФЗ, ' + (sc === 'dbo' ? 'восстановить дистанционное обслуживание' : 'провести операцию') + ' и письменно сообщить о решении.';
    }
    head = addressee + '\nот ' + who + (f.account && sc !== 'zsk' ? '\nрасчётный счёт ' + f.account : '') + (f.contact ? '\nконтакт: ' + f.contact : '');
    var att = (attachments || []).filter(Boolean);
    var tail = att.length ? '\n\nПриложения:\n' + att.map(function (a, i) { return (i + 1) + '. ' + a + '.'; }).join('\n') : '';
    return head + '\n\n' + title + '\n\n' + body + tail + '\n\n' + (today ? today + '\n' : '') + s(f.signer, '[должность, ФИО, подпись]');
  }

  /* ---------- Выписка 1С (1CClientBankExchange) ---------- */
  function decodeBytes(buf) {
    var encs = ['utf-8', 'windows-1251', 'ibm866'];
    for (var i = 0; i < encs.length; i++) {
      try {
        var txt = new TextDecoder(encs[i], { fatal: encs[i] === 'utf-8' }).decode(buf);
        if (/1CClientBankExchange/.test(txt) && /СекцияДокумент/.test(txt)) return txt;
      } catch (e) { /* пробуем следующую */ }
    }
    return null;
  }
  function num1c(v) { v = String(v || '').replace(/\s/g, '').replace(',', '.'); var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function date1c(v) { var m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(v || ''); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }
  function cleanName(v) { return String(v || '').replace(/^ИНН\s*\d+\s*/i, '').replace(/\s+/g, ' ').trim(); }
  function parseStatement(text) {
    if (!text || !/1CClientBankExchange/.test(text)) return { ok: false, error: 'Это не выписка 1С: нет заголовка 1CClientBankExchange.' };
    var lines = text.split(/\r?\n/), own = {}, docs = [], cur = null;
    lines.forEach(function (ln) {
      var i = ln.indexOf('='), k = i > 0 ? ln.slice(0, i).trim() : ln.trim(), v = i > 0 ? ln.slice(i + 1).trim() : '';
      if (/^СекцияДокумент/.test(k)) { cur = { kind: v }; return; }
      if (k === 'КонецДокумента') { if (cur) docs.push(cur); cur = null; return; }
      if (cur) { cur[k] = v; return; }
      if (k === 'РасчСчет' && v) own[v] = true;
    });
    var ownList = Object.keys(own);
    if (!ownList.length) { /* определяем свой счёт как самый частый */
      var cnt = {};
      docs.forEach(function (d) { [d.ПлательщикСчет, d.ПолучательСчет].forEach(function (a) { if (a) cnt[a] = (cnt[a] || 0) + 1; }); });
      var best = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
      if (best) own[best] = true;
    }
    var seen = {}, inAgg = {}, outAgg = {}, totalIn = 0, totalOut = 0, cash = 0, cashN = 0, minD = '', maxD = '';
    docs.forEach(function (d) {
      var sum = num1c(d.Сумма); if (!(sum > 0)) return;
      var uid = [d.Номер, d.Дата, d.Сумма, d.ПлательщикСчет, d.ПолучательСчет].join('|');
      if (seen[uid]) return; seen[uid] = true;
      var out = !!own[d.ПлательщикСчет] && !own[d.ПолучательСчет];
      var inc = !!own[d.ПолучательСчет] && !own[d.ПлательщикСчет];
      var dt = date1c(d.ДатаСписано) || date1c(d.ДатаПоступило) || date1c(d.Дата);
      if (dt) { if (!minD || dt < minD) minD = dt; if (!maxD || dt > maxD) maxD = dt; }
      var purpose = d.НазначениеПлатежа || '';
      var isCash = /денежн\S* чек|выдач\S* наличн|снятие наличн|наличны\S* денежн|инкасс/i.test(purpose + ' ' + d.kind);
      if (out) {
        totalOut += sum;
        if (isCash) { cash += sum; cashN++; return; }
        var kk = d.ПолучательИНН || cleanName(d.Получатель1 || d.Получатель);
        outAgg[kk] = outAgg[kk] || { inn: d.ПолучательИНН || '', name: cleanName(d.Получатель1 || d.Получатель) || 'Без названия', sum: 0, n: 0 };
        outAgg[kk].sum += sum; outAgg[kk].n++;
      } else if (inc) {
        totalIn += sum;
        var k2 = d.ПлательщикИНН || cleanName(d.Плательщик1 || d.Плательщик);
        inAgg[k2] = inAgg[k2] || { inn: d.ПлательщикИНН || '', name: cleanName(d.Плательщик1 || d.Плательщик) || 'Без названия', sum: 0, n: 0 };
        inAgg[k2].sum += sum; inAgg[k2].n++;
      }
    });
    function top(m) { return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.sum - a.sum; }).slice(0, 3); }
    var months = 1;
    if (minD && maxD) months = Math.max(1, (parse(maxD) - parse(minD)) / DAY / 30.44);
    return {
      ok: true, docs: Object.keys(seen).length, from: minD, to: maxD,
      totalIn: totalIn, totalOut: totalOut, monthlyOut: totalOut / months,
      topIn: top(inAgg), topOut: top(outAgg), cash: cash, cashN: cashN, cashShare: totalOut ? cash / totalOut : 0
    };
  }

  var api = {
    OFF: OFF, WORK_SAT: WORK_SAT, SCENARIOS: SCENARIOS, OPS: OPS, BASE_DOCS: BASE_DOCS, MVK_DOCS: MVK_DOCS,
    parse: parse, iso: iso, isWorkday: isWorkday, addWorkdays: addWorkdays, nextWorkday: nextWorkday,
    workdaysBetween: workdaysBetween, addMonthsDeadline: addMonthsDeadline, covered: covered,
    num: num, rub: rub, rubShort: rubShort, human: human, humanShort: humanShort, humanY: humanY, weekday: weekday, plural: plural,
    buildPlan: buildPlan, moneyAtStake: moneyAtStake, worksNow: worksNow, docsFor: docsFor,
    buildLetter: buildLetter, parseStatement: parseStatement, decodeBytes: decodeBytes
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Skoraya = api;
})(typeof window !== 'undefined' ? window : this);
