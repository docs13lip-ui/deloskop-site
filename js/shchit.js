/*!
 * Делоскоп · Щит — своя компания глазами банка и налоговой.
 * Работает поверх ответа /api/check, без запросов на сервер (как usloviya.js).
 * Признаки берёт из Usloviya.facts / Usloviya.kindOf — второго классификатора нет.
 * Три блока: «Как вас видит банк», «Как вас видит налоговая», «Что сделать сейчас» (до 3 шагов + «Следить»).
 * Тексты — ТЗ [Продукт] 01.10 (claude/Продукт_Щит_свой_взгляд_и_ответы_✎_01.10.md, разд. 2.3).
 * Ссылка на норму в скобках выводится только у строк, сверенных [Право] (sver: true) — флаг SVERENO.
 * v2 (02.10): тексты и нормы по ответам [Право] 07:15 и 08:20 (claude/Право_ответы_✎_02.10_комментарии_команды.md, разд. 1;
 * claude/Право_ответы_✎_kommentarii-v2_dvojnik_02.10.md, разд. 1) — все ◐ сняты, кроме «налоговая» у массового адреса (без нормы).
 * v3 (04.10, shchit-finansy-v1): финансы из того же ответа (ГИР БО) — Щит больше не пишет «заметных признаков нет», когда ниже
 * на экране стоят «ликвидность меньше 1» и «рентабельность ниже средней по отрасли — признак отбора». Признаки — те же функции,
 * что «Существенные факты» (js/sushchestvennoe.js) и блок рентабельности (js/rentabelnost.js, нормы ФНС грузятся один раз);
 * «почему» — дословно утверждённые [Право] тексты «Комментария команды» (data/kommentarii.json, тон «жёлтый»: ubytok,
 * kapital, likvidnost) — tests/shchit_finansy.test.js сверяет их с файлом. Капитал и ликвидность — только «банк», без шага.
 * v3.1 (04.10, shchit-ubytki-v1): убыток 2+ года — и в «Как вас видит налоговая» (критерий 2 ММ-3-06/333@, текст [Право] 09:20).
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Shchit = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  // Включить все нормы разом — после «да» [Право] на ◐-строки (или поставить sver: true у конкретной строки).
  var SVERENO = false;
  // Дата, на которую [Право] сверило нормы в скобках с действующими редакциями (ответы 02.10 07:15 и 08:20).
  var SVERENO_NA = '02.10.2026';

  var CBR_ZSK = 'https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/';

  // b — «Как вас видит банк», n — «Как вас видит налоговая», s — «Что сделать».
  // Строка: { t: текст, norma: '(…)' — только у сверенных; sver: true — сверено [Право] / уже на живом }.
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
    // Финансы (v3): тексты — data/kommentarii.json, тон zhel, status utverzhdeno ([Право] 02.10–03.10), дословно.
    // Шаг у убытков и рентабельности — тот же, что у нагрузки (объяснение для инспекции); у капитала и ликвидности шага нет.
    ubytki: {
      b: { t: 'Убытки и отрицательные чистые активы банк учитывает при оценке платёжеспособности.', sver: true },
      // shchit-ubytki-v1 (04.10): [Право · Налоговый] 04.10 09:20 разд. 3, дословно — критерий 2 прил. 2 к приказу ФНС
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

  // razbor(r) → { banki, nalogovaya, shagi, chisto, neProvereno, ul, data }
  function razbor(r, o) {
    var Us = U(o); if (!Us) throw new Error('shchit: нет Usloviya');
    r = r || {};
    var f = Us.facts(r), np = Us.neProvereno(r, f), ul = f.kind !== 'INDIVIDUAL';
    var est = {};                                 // kind → строка признака (название · деталь) из ответа API
    f.list.forEach(function (x) { if (!est[x.kind] || x.status === 'bad') est[x.kind] = nazvanie(x); });
    if (f.zsk === 'high' || f.zsk === 'medium') est.zsk = 'Прогноз ЗСК — ' + (f.zsk === 'high' ? 'высокий' : 'средний') + ' · наша оценка';
    if ((f.warn.young || f.bad.young) && !est.young) est.young = 'Компании меньше года';
    if ((f.staff === 0 || f.staff === 1) && !est.staff) est.staff = f.staff ? 'В штате 1 человек' : 'В штате никого';
    if (ST[f.status] && !est.exit) est.exit = ST[f.status];
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
    shagi.push({ kind: 'sled', t: T.sled.t, href: T.sled.href, knopka: T.sled.knopka, sled: true });

    var sNormoj = banki.concat(nalogovaya).some(function (x) { return /\((п|пп|ст)\. [^)]+\)\.$/.test(x.pochemu); }) ||
      shagi.some(function (x) { return /\((п|пп|ст)\. [^)]+\)\.$/.test(x.t); });
    return { banki: banki, nalogovaya: nalogovaya, shagi: shagi, chisto: !kinds.length, neProvereno: np, ul: ul, data: dataRu(r.checked_at), imya: f.name, sNormoj: sNormoj };
  }

  // Главное действие — одна кнопка: первый шаг со ссылкой, иначе «Следить».
  function glavnyj(R) { for (var i = 0; i < R.shagi.length; i++) if (R.shagi[i].href) return R.shagi[i]; return R.shagi[R.shagi.length - 1]; }

  // Короткий текст для «Скопировать разбор».
  function kratko(R) {
    var p = R.chisto ? 'Заметных признаков в открытых данных нет' : 'Признаков: ' + (R.banki.length + R.nalogovaya.length);
    var sh = R.shagi.filter(function (s) { return !s.sled; }).map(function (s, i) { return (i + 1) + '. ' + s.t; }).join(' ');
    return R.imya + ' — глазами банка и налоговой на ' + R.data + '. ' + p + '.' + (sh ? ' Что сделать: ' + sh : '');
  }

  var CSS = '' +
    '.shch{display:flex;flex-direction:column;gap:18px;color:var(--ink,#1D1D1F)}' +
    '.shch-oh{margin:0;font-size:13.5px;color:var(--muted,#6B6B70);max-width:68ch}' +
    '.shch-b{display:flex;flex-direction:column;gap:8px}' +
    '.shch-b h3{margin:0;font-size:17px;line-height:1.3;font-weight:600;letter-spacing:-.01em}' +
    '.shch-b ul,.shch-b ol{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}' +
    '.shch-b li{background:var(--bg,#F5F5F2);border-radius:14px;padding:12px 14px;max-width:68ch}' +
    '.shch-b li b{display:block;font-size:15px;font-weight:600;line-height:1.35}' +
    '.shch-b li span{display:block;margin-top:3px;font-size:14.5px;line-height:1.45;color:var(--ink2,#48484C)}' +
    '.shch-b li a{font-size:14.5px}' +
    '.shch-sh{counter-reset:sh}' +
    '.shch-sh li{position:relative;padding-left:44px}' +
    '.shch-sh li:before{counter-increment:sh;content:counter(sh);position:absolute;left:14px;top:12px;width:20px;height:20px;border-radius:50%;background:var(--card,#fff);font-size:12.5px;font-weight:600;line-height:20px;text-align:center;color:var(--ink2,#48484C)}' +
    '.shch-sh li.shch-sled:before{content:"";background:var(--accent,#0B63E5);box-shadow:inset 0 0 0 6px var(--card,#fff)}' +
    '.shch-sh li span{margin-top:0;color:var(--ink,#1D1D1F)}' +
    '.shch-pusto{margin:0;font-size:15px;color:var(--ink2,#48484C);max-width:68ch}' +
    '.shch-ne{margin:0;font-size:14px;color:#8A5A00;background:#FFF6E0;border-radius:10px;padding:8px 10px;max-width:68ch}' +
    '.shch-k{display:inline-flex;align-items:center;justify-content:center;align-self:flex-start;border-radius:999px;background:var(--accent,#0B63E5);color:#fff!important;font-weight:600;font-size:15px;padding:12px 22px;min-height:44px;text-decoration:none;max-width:100%;text-align:center}' +
    '.shch-k:hover{background:var(--accent-hover,#084BB0)}' +
    '.shch-ch{font-weight:400;color:var(--muted,#6B6B70);font-variant-numeric:tabular-nums}' +
    '.shch-sv{margin:0;font-size:12.5px;line-height:1.45;color:var(--muted,#6B6B70);max-width:68ch;border-top:1px solid var(--line,#E5E5E0);padding-top:10px}';

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
      blok('Как вас видит банк', R.banki) + blok('Как вас видит налоговая', R.nalogovaya) + np + sh +
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

  return { razbor: razbor, mount: mount, html: html, kratko: kratko, glavnyj: glavnyj, finansy: finansy, T: T, SVERENO: SVERENO, SVERENO_NA: SVERENO_NA, MAX_SHAGOV: MAX_SHAGOV, PORYADOK: PORYADOK };
});
