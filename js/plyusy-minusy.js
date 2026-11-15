/* Делоскоп — «Плюсы и минусы» компании за 10 секунд (план отчёта 15.11, п. 1.2; приоритет 16.11, п. 1).
 * Две колонки коротких строк по 3–7 слов: что у компании есть и чего нет или что настораживает, и узкая полоса
 * «Не проверено» (не проверяли ≠ не нашли). Строки собирает одна функция sobrat(r) из уже готового ответа /api/check
 * (signals, damia, dossier, zsk, podderzhka) — новых запросов нет. Только факты с источником, без оценок
 * компании в целом; цвет — латунь и нейтральные, без красного светофора (вывод не обещаем).
 * Каждая строка ведёт к своему разделу отчёта: к строке «Существенных фактов» (data-fakt) или к строке
 * «Все данные из реестров» (раскрывает её). У ИП — без данных человека: ни ФИО, ни адреса здесь нет.
 * Чистые функции sobrat и html — без DOM и сети, их проверяет tests/plyusy_minusy.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlyusyMinusy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = ' ';
  var MAKS_PLYUS = 6; // остальное — под «ещё N»: плюсы не должны оттеснять минусы с первого экрана

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function skl(n, a, b, c) {
    var k = Math.abs(n) % 100, d = k % 10;
    return k > 10 && k < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c;
  }
  function chislo(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
  // vniz — «не меньше»: округляем вниз, чтобы «от 22,9 млн» не стало «от 23 млн»
  function rub(v, vniz) {
    var a = Math.abs(v), z = function (x) { return (vniz ? Math.floor(x * 10) / 10 : x).toFixed(1).replace('.', ',').replace(/,0$/, ''); };
    if (a >= 1e12) return z(a / 1e12) + NB + 'трлн' + NB + '₽';
    if (a >= 1e9) return z(a / 1e9) + NB + 'млрд' + NB + '₽';
    if (a >= 1e6) return z(a / 1e6) + NB + 'млн' + NB + '₽';
    if (a >= 1e3) return chislo(a / 1e3) + NB + 'тыс.' + NB + '₽';
    return chislo(a) + NB + '₽';
  }
  function dmy(v) {
    var s = String(v || ''), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return m[3] + '.' + m[2] + '.' + m[1];
    return /^\d{2}\.\d{2}\.\d{4}$/.test(s) ? s : '';
  }
  function data(v) {
    var s = String(v || ''), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s) || /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
    if (!m) return null;
    return m[1].length === 4 ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(+m[3], +m[2] - 1, +m[1]);
  }
  function mesyacev(ot, na) {
    if (!ot || !na) return null;
    var m = (na.getFullYear() - ot.getFullYear()) * 12 + na.getMonth() - ot.getMonth();
    if (na.getDate() < ot.getDate()) m--;
    return m < 0 ? null : m;
  }
  function srok(m) {
    if (m < 1) return 'меньше месяца';
    if (m < 12) return m + NB + skl(m, 'месяц', 'месяца', 'месяцев');
    var g = Math.floor(m / 12);
    return g + NB + skl(g, 'год', 'года', 'лет');
  }
  function ip(r) { var c = (r && r.company) || {}; return c.kind === 'INDIVIDUAL' || String(c.inn || '').length === 12; }
  // один признак у сервера встречался под разными id (tests: «tax», «staff») — берём первый из синонимов
  var SINONIMY = { tax_debt: ['tax_debt', 'tax'], employees: ['employees', 'staff'] };
  function signal(r, id) {
    var S = Array.isArray(r && r.signals) ? r.signals : [], ids = SINONIMY[id] || [id];
    for (var j = 0; j < ids.length; j++)
      for (var i = 0; i < S.length; i++) if (S[i] && S[i].id === ids[j]) return S[i];
    return null;
  }
  // состояние блока реестра: после js/istochniki.js status = found / not_found / …; сырой ответ API — sostoyanie
  function sost(b) {
    if (!b || typeof b !== 'object') return '';
    var s = b.status;
    if (s === 'polucheno' || s === 'ne_provereno' || !s) s = b.sostoyanie || (s === 'ne_provereno' ? 'not_checked' : '');
    return s;
  }
  // «Ликвидирована» → «ликвидирована», но «ЕГРЮЛ …» и «ИНН …» — как есть
  function mal(s) { s = String(s || ''); return /^[А-ЯЁA-Z][а-яёa-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function num(v) { var n = Number(v); return v !== null && v !== '' && isFinite(n) ? n : null; }

  // последний год выручки ГИР БО (после сверок js/istochniki.js несверенные годы из рядов уже сняты)
  function godOtchetnosti(r) {
    var D = (r && r.dossier) || {}, ch = D.charts || {}, g = null;
    (Array.isArray(ch.revenue) ? ch.revenue : []).forEach(function (x) {
      var y = parseInt(x && x.year, 10);
      if (isFinite(y) && num(x.value) !== null && (g === null || y > g)) g = y;
    });
    (Array.isArray(D.kpi) ? D.kpi : []).forEach(function (k) {
      var m = /^Выручка за (\d{4})$/.exec((k && k.label) || '');
      if (m && num(k.value) !== null && (g === null || +m[1] > g)) g = +m[1];
    });
    return g;
  }
  function godProverki(r, segodnya) {
    var t = Date.parse((r && r.checked_at) || '');
    var ms = isFinite(t) ? t : (segodnya || new Date()).getTime();
    return new Date(ms + 3 * 3600 * 1000).getUTCFullYear();
  }

  // Темы, которые колонки уже называют сами: такие замечания сервера (dossier.concerns) второй раз не пишем
  var UZHE = /налог|штат|сотрудн|недостовер|суд|дел[аео]?\b|пристав|ФССП|исполнит|банкрот|приостанов|РНП|недобросовест|ЗСК|отч[её]тност|ликвид|статус/i;

  // r → { plyusy: [x], minusy: [x], ne: [{k, t}] }; x = { k, t, ist, data, nazv }
  //   k — ключ строки (= data-fakt «Существенных фактов»), t — текст строки, nazv — название раздела «Все данные из реестров»
  function sobrat(r, segodnya) {
    var P = [], M = [], N = [];
    if (!r || !r.company) return { plyusy: P, minusy: M, ne: N };
    var c = r.company, fl = ip(r), dm = r.damia || {}, reestr = fl ? 'ЕГРИП' : 'ЕГРЮЛ';
    var na = data(r.checked_at) || segodnya || new Date();
    function plus(k, t, ist, d, nazv) { P.push({ k: k, t: t, ist: ist || '', data: dmy(d), nazv: nazv || '' }); }
    function minus(k, t, ist, d, nazv) { M.push({ k: k, t: t, ist: ist || '', data: dmy(d), nazv: nazv || '' }); }

    // ---- реестр: статус, недостоверность, возраст ----
    var s = signal(r, 'status');
    if (s && s.status === 'ok') plus('status', 'Действующая компания', s.source || reestr);
    else if (s && (s.status === 'bad' || s.status === 'warn') && s.detail) minus('status', 'Статус: ' + mal(s.detail), s.source || reestr);

    s = signal(r, 'address');
    var ned = r.nedostovernost || {};
    if (s && (s.status === 'bad' || s.status === 'warn' || ned.adres === true)) minus('address', 'Отметка о недостоверности адреса', s.source || reestr);
    else if (s && s.status === 'ok' && ned.rukovoditel !== true) plus('address', 'Нет отметок о недостоверности', s.source || reestr);
    if (ned.rukovoditel === true && !fl) minus('address', 'Отметка о недостоверности руководителя', reestr);

    s = signal(r, 'age');
    var m = mesyacev(data(c.reg_date), na);
    if (s && m !== null) {
      if (s.status === 'ok' && m >= 12) plus('age', 'На рынке ' + srok(m), s.source || reestr);
      else if (s.status === 'warn' || s.status === 'bad') minus('age', 'На рынке ' + srok(m), s.source || reestr);
    }
    // руководитель — из сильных сторон сервера («Руководитель не менялся 17 лет 1 месяц» → «… 17 лет»)
    var D = r.dossier || {};
    if (!fl) (Array.isArray(D.strengths) ? D.strengths : []).forEach(function (t) {
      var mm = /^Руководитель не менялся\s+(\d+\s*(?:год|года|лет))/.exec(String(t || '').replace(/ /g, ' '));
      if (mm) plus('rukovoditel', 'Руководитель не менялся ' + mm[1].replace(/\s+/, NB), reestr);
    });

    // ---- налоги и люди ----
    s = signal(r, 'tax_debt');
    if (s && s.status === 'ok') plus('tax_debt', 'Нет долгов по налогам', s.source, s.as_of);
    else if (s && (s.status === 'warn' || s.status === 'bad')) {
      var sm = /^[\d\s ,]+₽/.exec(String(s.detail || ''));
      minus('tax_debt', 'Долг по налогам' + (sm ? ' ' + sm[0].trim().replace(/\s/g, NB) : ''), s.source, s.as_of);
    }
    s = signal(r, 'employees');
    if (s) {
      var ch = /(\d[\d\s ]*)/.exec(String(s.detail || '')), n = ch ? parseInt(ch[1].replace(/\D/g, ''), 10) : null;
      if (s.status === 'ok' && n > 0) plus('employees', 'В штате ' + chislo(n) + NB + skl(n, 'человек', 'человека', 'человек'), s.source, s.as_of);
      else if ((s.status === 'warn' || s.status === 'bad') && n === 0) minus('employees', 'Нет сотрудников по данным ФНС', s.source, s.as_of);
      else if (s.status === 'warn' || s.status === 'bad') minus('employees', s.title + ': ' + s.detail, s.source, s.as_of);
    }
    // прочие признаки сервера с замечанием — названием (и коротким значением, если оно короткое), как пришли;
    // суды, приставы и банкротство называет блок реестров ниже — второй раз не пишем
    var SVOI = ['status', 'address', 'age', 'tax_debt', 'tax', 'employees', 'staff', 'fssp', 'sudy', 'bankrotstvo'];
    (Array.isArray(r.signals) ? r.signals : []).forEach(function (x) {
      if (!x || SVOI.indexOf(x.id) >= 0 || !x.title) return;
      if (x.status !== 'warn' && x.status !== 'bad') return;
      var d = String(x.detail || '').trim();
      minus(x.id, x.title + (d && d.length <= 40 ? ': ' + mal(d) : ''), x.source, x.as_of);
    });

    // ---- бухотчётность ГИР БО ----
    var g = godOtchetnosti(r), gp = godProverki(r, segodnya);
    if (!fl && g !== null) {
      if (g >= gp - 2) plus('otchetnost', 'Отчётность за ' + g + NB + 'год в' + NB + 'ГИР' + NB + 'БО', 'ГИР БО ФНС');
      else minus('otchetnost', 'Последняя отчётность — за ' + g + NB + 'год', 'ГИР БО ФНС');
    }

    // ---- внешние реестры (суды, приставы, банкротство, счета, РНП, госконтракты) ----
    function blok(k) { var b = dm[k]; return b && typeof b === 'object' && b.nazvanie ? b : null; }
    var b = blok('sudy');
    if (b) {
      var st = sost(b), dn = b.dannye || {}, nz = num(dn.otvetchik_nezaversheno), sz = num(dn.otvetchik_summa_nezaversheno);
      if (st === 'found' && nz > 0) {
        var ne1 = nz % 10 === 1 && nz % 100 !== 11;
        minus('damia_sudy', 'Ответчик в' + NB + chislo(nz) + NB + (ne1 ? 'идущем деле' : 'идущих делах') + (sz > 0 ? ' на' + NB + rub(sz) : ''), b.istochnik, b.data_svedeniy, b.nazvanie);
      } else if (st === 'found' && nz === 0) plus('damia_sudy', 'Нет идущих дел против компании', b.istochnik, b.data_svedeniy, b.nazvanie);
      else if (st === 'found') minus('damia_sudy', 'Есть арбитражные дела', b.istochnik, b.data_svedeniy, b.nazvanie);
      else if (st === 'not_found') plus('damia_sudy', 'Нет арбитражных дел против компании', b.istochnik, b.data_svedeniy, b.nazvanie);
    }
    b = blok('fssp');
    if (b) {
      var sf = sost(b), df = b.dannye || {}, ot = num(df.otkryto), os = num(df.ostatok);
      if (sf === 'found') minus('damia_fssp', 'Производства у приставов' + (ot > 0 ? ': ' + chislo(ot) : '') +
        (os > 0 ? ', долг ' + (df.ostatok_tochno === false ? 'от' + NB + rub(os, true) : rub(os)) : ''), b.istochnik, b.data_svedeniy, b.nazvanie);
      else if (sf === 'not_found') plus('damia_fssp', 'Нет долгов у приставов', b.istochnik, b.data_svedeniy, b.nazvanie);
    }
    b = blok('bankrotstvo');
    if (b) {
      var sb = sost(b);
      if (sb === 'found' && !(b.dubl_statusa && signal(r, 'status') && signal(r, 'status').status !== 'ok')) minus('damia_bankrotstvo', b.iz_egryul ? 'Банкротство — отметка в' + NB + 'ЕГРЮЛ' : 'Сообщения о банкротстве в' + NB + 'ЕФРСБ', b.istochnik, b.data_svedeniy, b.nazvanie);
      else if (sb === 'not_found') plus('damia_bankrotstvo', b.iz_egryul ? 'Нет отметки о банкротстве' : 'Нет сообщений о банкротстве', b.istochnik, b.data_svedeniy, b.nazvanie);
    }
    b = blok('priostanovki');
    if (b) {
      var sp = sost(b);
      if (sp === 'found') minus('damia_priostanovki', 'Счета приостановлены решением ФНС', b.istochnik, b.data_svedeniy, b.nazvanie);
      else if (sp === 'not_found') plus('damia_priostanovki', 'Счета не приостановлены', b.istochnik, b.data_svedeniy, b.nazvanie);
    }
    b = blok('mery');
    if (b && sost(b) === 'found') minus('damia_mery', 'Обеспечительные меры налоговой', b.istochnik, b.data_svedeniy, b.nazvanie);
    b = blok('rnp');
    var bk = blok('kontrakty'), vk = bk && sost(bk) === 'found' ? num((bk.dannye || {}).vsego) : null;
    if (b && sost(b) === 'found') minus('damia_rnp', 'В реестре недобросовестных поставщиков', b.istochnik, b.data_svedeniy, b.nazvanie);
    if (vk > 0) plus('damia_kontrakty', 'Госконтракты как поставщик: ' + chislo(vk), bk.istochnik, bk.data_svedeniy, bk.nazvanie);
    // не в РНП — плюс только у того, кто работает с госзаказом (иначе строка ни о чём)
    if (b && sost(b) === 'not_found' && vk > 0) plus('damia_rnp', 'Нет в реестре недобросовестных поставщиков', b.istochnik, b.data_svedeniy, b.nazvanie);

    // ---- прогноз ЗСК (наша оценка) и господдержка ----
    var z = r.zsk;
    if (z && (z.level === 'medium' || z.level === 'high') && z.title) minus('zsk', 'Прогноз ЗСК: ' + mal(z.title), 'оценка Делоскопа, не статус Банка России');
    var pd = r.podderzhka;
    if (pd && pd.status === 'najdeno' && !fl) plus('podderzhka', 'Получала господдержку МСП', pd.istochnik, pd.data_nabora);

    // ---- замечания сервера, которых колонки не называют (например, недавняя смена руководителя) ----
    (Array.isArray(D.concerns) ? D.concerns : []).forEach(function (t) {
      t = String(t || '').trim();
      if (t && !UZHE.test(t) && !(fl && /руководител/i.test(t))) minus('dossier', t, 'по ответу проверки');
    });

    // ---- не проверено: реестр не ответил или не опрашивался ----
    Object.keys(dm).forEach(function (k) {
      var x = dm[k];
      if (!x || typeof x !== 'object' || !x.nazvanie) return;
      var q = sost(x);
      if (!q || q === 'found' || q === 'not_found' || q === 'not_applicable') return;
      // устаревшие сведения (status stale, js/istochniki.js) — тоже не проверка на сегодня: называем дату, на которую они были
      var tt = KRATKO[k] || String(x.nazvanie).toLowerCase(), dd = q === 'stale' ? dmy(x.data_svedeniy) : '';
      N.push({ k: 'damia_' + k, t: tt + (dd ? ' (сведения на' + NB + dd + ')' : ''), nazv: x.nazvanie });
    });
    var bs = blok('sudy');
    if (bs && /общей юрисдикции/i.test(bs.podzagolovok || '')) N.push({ k: 'damia_sudy', t: 'суды общей юрисдикции', nazv: bs.nazvanie });
    // порядок: сначала то, что решает про деньги (статус, налоги, суды, приставы), затем остальное
    function poryadok(spisok) {
      return function (a, b) {
        var x = spisok.indexOf(a.k), y = spisok.indexOf(b.k);
        return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
      };
    }
    P = P.map(function (x, i) { x.i = i; return x; }).sort(function (a, b) { return poryadok(PORYADOK_P)(a, b) || a.i - b.i; });
    M = M.map(function (x, i) { x.i = i; return x; }).sort(function (a, b) { return poryadok(PORYADOK_M)(a, b) || a.i - b.i; });
    P.forEach(function (x) { delete x.i; }); M.forEach(function (x) { delete x.i; });
    return { plyusy: P, minusy: M, ne: N };
  }
  var PORYADOK_P = ['status', 'tax_debt', 'damia_sudy', 'damia_fssp', 'damia_bankrotstvo', 'damia_priostanovki', 'address', 'otchetnost', 'age', 'employees', 'damia_kontrakty', 'rukovoditel', 'damia_rnp', 'podderzhka'];
  var PORYADOK_M = ['status', 'damia_bankrotstvo', 'damia_priostanovki', 'damia_rnp', 'damia_mery', 'address', 'damia_sudy', 'damia_fssp', 'tax_debt', 'otchetnost', 'zsk', 'employees', 'age'];
  var KRATKO = { sudy: 'арбитражные суды', bankrotstvo: 'банкротство', fssp: 'приставы', priostanovki: 'приостановки счетов', mery: 'обеспечительные меры ФНС', rnp: 'РНП', kontrakty: 'госконтракты' };

  // ---- разметка ----
  function stroka(x) {
    var meta = [x.ist, x.data ? 'на' + NB + x.data : ''].filter(Boolean).join(' · ');
    return '<li data-pm="' + esc(x.k) + '"' + (x.nazv ? ' data-pm-nazv="' + esc(x.nazv) + '"' : '') + '><span class="pm__t">' + esc(x.t) + '</span>' +
      (meta ? '<small>' + esc(meta) + '</small>' : '') + '</li>';
  }
  function kolonka(zag, pod, spisok, mod, pusto, vse) {
    var kap = mod === 'plus' && !vse, vid = kap ? spisok.slice(0, MAKS_PLYUS) : spisok, eshche = kap ? spisok.slice(MAKS_PLYUS) : [];
    return '<div class="pm__k pm__k--' + mod + '"><h3>' + zag + ' <span>' + spisok.length + '</span></h3><p class="pm__pod">' + pod + '</p>' +
      (spisok.length ? '<ul>' + vid.map(stroka).join('') + '</ul>' : '<p class="pm__pusto">' + pusto + '</p>') +
      (eshche.length ? '<details class="pm__e"><summary>Ещё ' + eshche.length + '</summary><ul>' + eshche.map(stroka).join('') + '</ul></details>' : '') + '</div>';
  }
  // o.vse — без «Ещё N» (PDF-досье: на бумаге свёрнутое не прочесть)
  function html(S, o) {
    o = o || {};
    if (!S || (!S.plyusy.length && !S.minusy.length)) return '';
    var ne = S.ne.filter(function (x, i, a) { return a.map(function (y) { return y.t; }).indexOf(x.t) === i; });
    return '<section class="pm" aria-labelledby="pm-h" data-plyusy="' + S.plyusy.length + '" data-minusy="' + S.minusy.length + '">' +
      '<h2 id="pm-h" class="pm__h">Плюсы и' + NB + 'минусы</h2>' +
      '<div class="pm__kk">' +
      kolonka('Плюсы', 'что у' + NB + 'компании есть', S.plyusy, 'plus', 'Подтверждённых плюсов в' + NB + 'ответе нет', o.vse) +
      kolonka('Минусы', 'чего нет или что настораживает', S.minusy, 'minus', 'По проверенным источникам замечаний нет') +
      '</div>' +
      (ne.length ? '<p class="pm__ne"><b>Не проверено:</b> ' + ne.map(function (x) { return esc(x.t); }).join(', ') + ' — не' + NB + 'проверяли ≠ не' + NB + 'нашли</p>' : '') +
      '</section>';
  }

  var CSS =
    '.pm{margin:0 0 20px;padding:20px;border:1px solid var(--line,#E3DDCD);border-radius:16px;background:var(--card,#fff)}' +
    '.pm__h{margin:0 0 14px;font-size:20px;line-height:1.3}' +
    '.pm__kk{display:grid;grid-template-columns:1fr 1fr;gap:12px 28px}' +
    '.pm__k h3{margin:0;font-size:15px;line-height:1.4;font-weight:600;display:flex;align-items:baseline;gap:8px}' +
    '.pm__k h3 span{font-size:13px;font-weight:400;color:var(--muted,#5B6783);font-variant-numeric:tabular-nums}' +
    '.pm__pod{margin:0 0 6px;font-size:13px;color:var(--muted,#5B6783)}' +
    '.pm__k ul{list-style:none;margin:0;padding:0}' +
    '.pm__k li{position:relative;padding:8px 0 8px 22px;border-top:1px solid var(--line,#E3DDCD)}' +
    '.pm__k li::before{position:absolute;left:2px;top:8px;font-weight:600;line-height:1.4;font-size:15px}' +
    '.pm__k--plus li::before{content:"+";color:var(--mat-zhdu,#7A5C14)}' +
    '.pm__k--minus li::before{content:"\\2212";color:var(--ink,#0B1B3A)}' +
    '[data-theme=dark] .pm__k--plus li::before{color:var(--mat-zhdu-t,#D9B45A)}' +
    '.pm__t{display:block;font-size:15px;line-height:1.4}' +
    '.pm__k li small{display:block;margin-top:2px;font-size:12px;line-height:1.4;color:var(--muted,#5B6783)}' +
    '.pm__k a.pm__a{color:inherit;text-decoration:underline;text-decoration-color:var(--line,#E3DDCD);text-underline-offset:.2em}' +
    '.pm__k a.pm__a:hover{text-decoration-color:currentColor}' +
    '.pm__pusto{margin:0;padding:8px 0;border-top:1px solid var(--line,#E3DDCD);font-size:15px;color:var(--muted,#5B6783)}' +
    '.pm__e summary{cursor:pointer;padding:8px 0 0 22px;font-size:13px;color:var(--muted,#5B6783)}' +
    '.pm__ne{margin:14px 0 0;padding-top:12px;border-top:1px solid var(--line,#E3DDCD);font-size:13px;line-height:1.5;color:var(--muted,#5B6783)}' +
    '.pm__ne b{font-weight:600;color:var(--ink-2,#3A4868)}' +
    '.pm-vspyshka{outline:2px solid var(--mat-fokus,#A07A28);outline-offset:4px;border-radius:8px;transition:outline-color 1.2s}' +
    '[data-theme=dark] .pm-vspyshka{outline-color:var(--mat-fokus-t,#D9B45A)}' +
    '@media (max-width:640px){.pm{padding:16px}.pm__kk{grid-template-columns:1fr}.pm__h{font-size:17px}}' +
    '@media print{.pm{break-inside:avoid;border-color:#ccc}.pm__e:not([open])>ul{display:block}.pm__e summary{display:none}}';

  function stil(doc) {
    if (!doc || doc.getElementById('pm-css')) return;
    var s = doc.createElement('style'); s.id = 'pm-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Строка → её раздел отчёта: «Существенные факты» (data-fakt) или строка «Все данные из реестров» (dt с названием)
  function cel(report, li) {
    var k = li.getAttribute('data-pm'), nazv = li.getAttribute('data-pm-nazv');
    var f = k && report.querySelector('.sut [data-fakt="' + k + '"]');
    if (f) return f;
    if (k === 'damia_sudy' || k === 'damia_fssp') { var dnk = report.querySelector('.dnk'); if (dnk && !nazv) return dnk; }
    var g = report.querySelector('.sut__g');
    if (!g) return null;
    var dts = g.querySelectorAll('dt');
    for (var i = 0; i < dts.length; i++) {
      var t = (dts[i].firstChild && dts[i].firstChild.nodeType === 3 ? dts[i].firstChild.nodeValue : dts[i].textContent) || '';
      if (nazv && t.trim() === nazv) return dts[i].parentNode;
    }
    return null;
  }
  function svyazat(report, sek) {
    var lis = sek.querySelectorAll('li[data-pm]'), n = 0;
    Array.prototype.forEach.call(lis, function (li) {
      var t = cel(report, li), sp = li.querySelector('.pm__t');
      if (!t || !sp) return;
      if (!t.id) t.id = 'pm-' + li.getAttribute('data-pm').replace(/[^a-z0-9_-]/gi, '') + '-' + (++n);
      var a = report.ownerDocument.createElement('a');
      a.className = 'pm__a'; a.href = '#' + t.id; a.textContent = sp.textContent;
      sp.textContent = ''; sp.appendChild(a);
      a.addEventListener('click', function (e) {
        var g = t.closest ? t.closest('details') : null;
        if (g && !g.open) g.open = true;
        e.preventDefault();
        try { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (x) { t.scrollIntoView(); }
        t.classList.add('pm-vspyshka');
        setTimeout(function () { t.classList.remove('pm-vspyshka'); }, 1600);
        try { if (self.dlkGoal) self.dlkGoal('pm_perehod', { k: li.getAttribute('data-pm') }); } catch (x) {}
      });
    });
  }

  // mount(report, r) — экран проверки: первым в основной колонке листа (.ot-main), над «Деньгами на кону».
  // /report.html (PDF-досье) рисует html(sobrat(r)) сам — на месте прежних «Сильных сторон». Повторная проверка заменяет блок.
  function mount(report, r, o) {
    o = o || {};
    if (!report) return null;
    var star = report.querySelector('.pm'), h = html(sobrat(r));
    if (!h) { if (star && star.parentNode) star.parentNode.removeChild(star); return null; }
    var doc = report.ownerDocument, t = doc.createElement('div');
    t.innerHTML = h;
    var nov = t.firstChild;
    try { stil(doc); } catch (e) {}
    if (star && star.parentNode) star.parentNode.replaceChild(nov, star);
    else {
      var main = report.querySelector('.ot-main');
      if (!main) return null;
      main.insertBefore(nov, main.firstChild);
    }
    if (o.ssylki !== false) { try { svyazat(report, nov); } catch (e) {} }
    try { if (self.dlkGoal) self.dlkGoal('pm_view', { p: nov.getAttribute('data-plyusy'), m: nov.getAttribute('data-minusy') }); } catch (e) {}
    return nov;
  }

  return { sobrat: sobrat, html: html, mount: mount, stil: stil, rub: rub, CSS: CSS, MAKS_PLYUS: MAKS_PLYUS };
});
