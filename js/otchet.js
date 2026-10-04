/*
 * Делоскоп — «Отчёт о проверке на всю ширину» (макет [Продукт · Арт-директор] 02.10.2026,
 * claude/Продукт_макет_экрана_проверки_02.10.md, разд. 2; решение владельца 02.10 «солиднее · техничнее · понятнее»).
 *
 * Данные не меняются: модули (rekvizity-proverki, usloviya, sushchestvennoe, kommentarii, dinamika, otkuda, shchit, terminy)
 * рисуют свои блоки как раньше, а этот модуль только раскладывает готовые узлы по листу:
 *   A шапка-документ (название + реквизиты) → B полоса вывода (Индекс · вывод · одно действие)
 *   → основное: существенные факты → что изменилось → динамика → «Все данные из реестров»
 *   → справа: «Как посчитали предел», «Откуда данные» → подвал (действия) → оговорка.
 * На ≤ 860 px — одна колонка: … динамика → как посчитали → откуда → все данные → подвал.
 * Числа Индекса нет в ответе /api/check — колонку считает браузер по открытой методике v1.0 (js/indeks-otvet.js,
 * indeks-v-otchete-v1) с воротами честности; не прошло ворота или нет модуля — «считаем», ничего не выдумываем.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Otchet = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NB = '\u00a0';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Уровни Индекса — без оценочных слов о компании (222-ФЗ; ответы [Право] 02.10 09:15 и 11:15).
  var UROVNI = [
    [70, 'Без серьёзных сигналов', 'ok'],
    [50, 'Есть вопросы', 'warn'],
    [30, 'Есть серьёзные сигналы', 'warn'],
    [1, 'Много признаков риска', 'bad']
  ];
  function uroven(n) {
    for (var i = 0; i < UROVNI.length; i++) if (n >= UROVNI[i][0]) return { t: UROVNI[i][1], ton: UROVNI[i][2] };
    return null;
  }
  // Число Индекса — только целое 1–99 из ответа API; иначе null («считаем»).
  function indeks(r) {
    var v = r && r.indeks;
    if (v && typeof v === 'object') v = v.znachenie != null ? v.znachenie : v.value;
    var n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d{1,2}$/.test(v) ? +v : NaN);
    return isFinite(n) && n >= 1 && n <= 99 ? Math.round(n) : null;
  }
  function polnota(r) {
    var v = r && r.polnota;
    if (v && typeof v === 'object') v = v.procent;
    var n = typeof v === 'number' ? v : NaN;
    if (!isFinite(n)) return null;
    if (n > 0 && n <= 1) n = n * 100;
    return n >= 0 && n <= 100 ? Math.round(n) : null;
  }
  // Цвет полосы вывода — по risk_level ответа (low/medium/high); неизвестное — нейтральный «есть вопросы».
  function tonPolosy(r) {
    var l = r && r.risk_level;
    return l === 'low' ? 'ok' : l === 'high' ? 'bad' : 'warn';
  }

  // Действия полосы: одна главная («Следить»), одна второстепенная («Паспорт» — только юрлицу).
  // Щит: главное действие — первый шаг разбора со ссылкой (Shchit.glavnyj), иначе «Следить за своей компанией».
  function dejstviya(r, svoj, g) {
    var inn = String(r && r.company && r.company.inn || '').replace(/\D/g, '');
    var a = [svoj && g && g.href && !g.sled
      ? { t: g.knopka || 'Что сделать', href: g.href, glavnaya: true, cel: 'shchit_shag', ext: !!g.ext }
      : { t: svoj ? 'Следить за своей компанией' : 'Следить за компанией', href: '/cabinet.html#watch', glavnaya: true, cel: svoj ? 'shchit_sled' : 'otchet_sled' }];
    if (!svoj && inn.length === 10) a.push({ t: 'Паспорт контрагента', href: '/pasport/kontragent/?inn=' + inn, cel: 'otchet_pasport' });
    return a;
  }

  // Колонка Индекса (B, слева).
  function htmlIndeks(r) {
    var n = indeks(r), p = polnota(r);
    var h = '<div class="ot-ix__lab">Индекс Делоскопа</div>';
    if (n != null) {
      var u = uroven(n);
      h += '<div class="ot-ix__big n">' + n + '<small>' + NB + '/' + NB + '99</small></div>' +
        '<div class="ot-ix__sh" aria-hidden="true"><i style="left:' + n + '%"></i></div>' +
        '<div class="ot-ix__lv">' + esc(u.t) + ' · <a href="/indeks/">методика</a></div>';
    } else {
      h += '<div class="ot-ix__ne">Индекс — считаем</div>' +
        (p != null ? '<div class="ot-ix__pl n">собрано ' + p + NB + '% данных</div>' : '') +
        '<div class="ot-ix__lv"><a href="/indeks/">методика</a></div>';
    }
    return h;
  }

  // indeks-v-otchete-v1: нет числа от сервера — колонка по открытой методике в браузере (js/indeks-otvet.js); иначе — как раньше
  function htmlIndeksIz(r, IO) {
    if (indeks(r) == null && IO && IO.vid && IO.htmlKolonka) {
      try { var h = IO.htmlKolonka(IO.vid(r)); if (h) return h; } catch (e) {}
    }
    return htmlIndeks(r);
  }
  function modulIO() { return typeof self !== 'undefined' && self.IndeksOtvet ? self.IndeksOtvet : null; }

  function htmlDejstviya(r, svoj, g) {
    return dejstviya(r, svoj, g).map(function (d) {
      return '<a class="ot-btn ' + (d.glavnaya ? 'p' : 's') + '" href="' + esc(d.href) + '" data-cel="' + d.cel + '"' + (d.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(d.t) + '</a>';
    }).join('');
  }

  // «Как посчитали предел» (H) — те же тексты, что в «Условиях сделки» (Usloviya.decide(r).kak).
  function htmlKak(kak, statya) {
    if (!kak || !kak.kak) return '';
    return '<section class="ot-sc" id="ot-kak" aria-labelledby="ot-kak-h"><h3 id="ot-kak-h">Как посчитали предел</h3>' +
      '<p class="n">' + esc(kak.kak) + '</p>' + (kak.ne ? '<p class="ot-ne n">' + esc(kak.ne) + '</p>' : '') +
      '<p class="ot-cap">Ориентир Делоскопа, не норма закона. <a href="/indeks/#predoplata">Открытая формула предела</a>' + (statya ? '; пример — в разборе <a href="' + esc(statya) + '">«Сколько платить вперёд незнакомой компании»</a>' : '') + '.</p></section>';
  }

  var POD_PILL = 'по признакам из реестров';
  // «Данных пока мало» (Индекс без числа) + пилюля API «Без серьёзных сигналов»: слова уровня 70–99 читались бы как оценка,
  // которой нет — пишем о найденном и сколько источников проверено (ТЗ [Продукт · Данные] 03.10 18:55 разд. 4, [Право] 20:07 разд. 3).
  var PILL_SOKR = 'В найденных данных серьёзных сигналов нет';
  function podSokr(o) {
    if (!o || !(o.oprosheno > 0) || !(o.otvetili >= 0)) return '';
    var t = 'Проверено источников: ' + o.otvetili + NB + 'из' + NB + o.oprosheno;
    return o.otvetili < o.oprosheno ? t + '. По остальным не' + NB + 'проверяли — это не' + NB + 'значит «нарушений нет».' : t;
  }
  // pilyulya(r, v, opis) → { t, pod } — что написать в пилюле и под ней; t = null — текст пилюли не трогаем.
  // v — IndeksOtvet.vid(r), opis — Otkuda.istochniki(r).
  function pilyulya(r, v, opis) {
    if (r && r.risk_level === 'low' && v && v.rezhim === 'sokr') return { t: PILL_SOKR, pod: podSokr(opis) || POD_PILL };
    return { t: null, pod: POD_PILL };
  }

  // Отступ сверху под липкие полосы (шапка сайта, строка проверки) — чтобы начало листа не пряталось под ними.
  function otstup(doc) {
    var w = doc.defaultView, m = 0;
    if (!w || !w.getComputedStyle) return 0;
    Array.prototype.forEach.call(doc.querySelectorAll('.shapka, .rezhim-otcheta .hero-text'), function (x) {
      var cs = w.getComputedStyle(x);
      if (cs.position !== 'sticky' && cs.position !== 'fixed') return;
      var b = (parseFloat(cs.top) || 0) + x.offsetHeight;
      if (b > m) m = b;
    });
    return m;
  }
  // Правка [Арт-директора] 02.10 13:35: при новом ответе — к началу листа (на любой ширине, а не только < 980 px).
  function prokrutit(report) {
    if (!report || !report.ownerDocument) return false;
    var doc = report.ownerDocument, w = doc.defaultView;
    if (!w || !w.scrollTo) return false;
    // пришли по ссылке «…#indeks» — к колонке Индекса (отчёт рисуется после ответа API, сам браузер к якорю не прокрутит)
    var cel = (w.location && w.location.hash === '#indeks' && doc.getElementById('indeks')) || report;
    var y = cel.getBoundingClientRect().top + (w.pageYOffset || 0) - otstup(doc) - 12;
    var plavno = !(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
    w.scrollTo({ top: Math.max(0, Math.round(y)), behavior: plavno ? 'smooth' : 'auto' });
    return true;
  }

  var OGOVORKA = 'Оценка по открытым данным на дату проверки, а не решение банка или налоговой.';

  // ---------- браузер: раскладка готового отчёта по листу ----------
  // текст пилюли (после значка): t — новый, null — исходный (запомнен в data-t0)
  function tekstPilyuli(pill, t) {
    var uz = null;
    for (var i = pill.childNodes.length - 1; i >= 0; i--) if (pill.childNodes[i].nodeType === 3) { uz = pill.childNodes[i]; break; }
    if (!uz) return;
    if (!pill.hasAttribute('data-t0')) pill.setAttribute('data-t0', uz.nodeValue);
    uz.nodeValue = t == null ? pill.getAttribute('data-t0') : t;
  }
  function el(doc, tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function vzyat(report, sel) { var x = report.querySelector(sel); return x && x.parentNode ? x : null; }

  // razlozhit(report, r, {svoj, shR, usl}) — report — уже нарисованный .report; возвращает true, если лист собран.
  function razlozhit(report, r, o) {
    o = o || {};
    if (!report || !r || !r.company) return false;
    var doc = report.ownerDocument || document, svoj = !!o.svoj;
    var head = vzyat(report, '.report-head'), who = head && head.firstElementChild, pill = vzyat(report, '.report-head .pill');
    var rkv = vzyat(report, '.rkv'), rows = vzyat(report, '.rows'), izm = report.querySelector(':scope > .izm');
    var din = report.querySelector(':scope > .din'), gl = report.querySelector('.sut__g');
    var act = vzyat(report, '.report-actions'), otk = vzyat(report, '.otk') || vzyat(report, '.src');
    var usl = o.usl || null;
    if (!head || !act) return false;

    var hd = el(doc, 'header', 'ot-hd'), whoBox = el(doc, 'div', 'ot-who'), rq = el(doc, 'div', 'ot-rq');
    if (who) whoBox.appendChild(who);
    if (rkv) rq.appendChild(rkv);
    hd.appendChild(whoBox); hd.appendChild(rq);

    var vd = el(doc, 'section', 'ot-vd ot-vd--' + tonPolosy(r));
    vd.setAttribute('aria-label', 'Вывод');
    var ix = el(doc, 'div', 'ot-ix', htmlIndeks(r));
    ix.id = 'indeks'; // якорь: карточки /company/ ведут на /?inn=…#indeks (✎ [Ночные-2] 03.10 20:50)
    // колонка Индекса: число браузера (если методика загружена) — без пилюли; «считаем» — с пилюлей уровня риска, как раньше
    var zapolnit = function () {
      var IO = modulIO(), h = htmlIndeksIz(r, IO);
      ix.innerHTML = h;
      var chislo = /ot-ix__big/.test(h);
      if (pill && !chislo) {
        pill.classList.add('ot-pill'); ix.insertBefore(pill, ix.lastChild);
        var pv = null, op = null, w = doc.defaultView || {};
        try { pv = IO && indeks(r) == null && IO.gotov && IO.gotov() ? IO.vid(r) : null; } catch (e) { pv = null; }
        try { op = w.Otkuda && w.Otkuda.istochniki ? w.Otkuda.istochniki(r) : null; } catch (e) { op = null; }
        var pp = pilyulya(r, pv, op);
        tekstPilyuli(pill, pp.t);
        // правка [Арт-директора] 02.10 13:35: уровень риска — не Индекс, подписываем, откуда он
        ix.insertBefore(el(doc, 'div', 'ot-ix__pod', esc(pp.pod)), ix.lastChild);
      }
      var pch = ix.querySelector('.ot-ix__pch');
      if (pch) pch.addEventListener('toggle', function () { try { if (pch.open && window.dlkGoal) dlkGoal('indeks_raskladka'); } catch (e) {} });
    };
    zapolnit();
    var IO0 = modulIO();
    if (IO0 && indeks(r) == null && IO0.gotov && !IO0.gotov() && IO0.gotovo) IO0.gotovo(zapolnit);
    var vt = el(doc, 'div', 'ot-vt');
    if (svoj) {
      var shKr = function () {
        var kr = '';
        try { kr = o.shR && window.Shchit ? Shchit.kratko(o.shR) : ''; } catch (e) { kr = ''; }
        kr = kr.replace(/^.*? — глазами банка и налоговой на [\d.]+\.\s*/, '').replace(/\s*Что сделать:.*$/, '');
        vt.innerHTML = '<h2 class="ot-vt__h">Ваша компания глазами банка и налоговой</h2>' + (kr ? '<p class="ot-vt__p">' + esc(kr) + '</p>' : '');
      };
      shKr();
      // Щит v3: рентабельность против отрасли приходит после загрузки норм ФНС — «Признаков: N» пересчитываем (shchit-finansy-v1)
      if (o.shR && o.shR.gotovo && typeof o.shR.gotovo.then === 'function') o.shR.gotovo.then(shKr, function () {});
    } else if (usl) {
      vt.appendChild(usl);
      vt.appendChild(el(doc, 'a', 'ot-vt__kak', 'Как посчитали предел')).setAttribute('href', '#ot-kak');
    }
    var g = null;
    try { g = svoj && o.shR && window.Shchit ? Shchit.glavnyj(o.shR) : null; } catch (e) { g = null; }
    var ac = el(doc, 'div', 'ot-act', htmlDejstviya(r, svoj, g));
    vd.appendChild(ix); vd.appendChild(vt); vd.appendChild(ac);

    var body = el(doc, 'div', 'ot-body'), main = el(doc, 'div', 'ot-main'), side = el(doc, 'aside', 'ot-side');
    side.setAttribute('aria-label', 'Справка к выводу');
    if (svoj && usl) main.appendChild(usl);
    [rows, izm, din, gl].forEach(function (x) { if (x && x.parentNode) main.appendChild(x); });
    if (gl) gl.classList.add('ot-gl');
    if (!svoj) {
      var kak = null;
      try { kak = window.Usloviya ? Usloviya.decide(r).kak : null; } catch (e) { kak = null; }
      var kh = htmlKak(kak, window.Usloviya && Usloviya.STATYA);
      if (kh) side.appendChild(el(doc, 'div', null, kh).firstChild);
      else { var k = vt.querySelector('.ot-vt__kak'); if (k) k.parentNode.removeChild(k); }
    }
    if (otk) { otk.classList.add('ot-otk'); side.appendChild(otk); }
    body.appendChild(main); body.appendChild(side);

    var foot = el(doc, 'div', 'ot-foot'); foot.appendChild(act);
    var disc = el(doc, 'p', 'ot-disc', esc(OGOVORKA));

    // всё, что осталось (неизвестные блоки модулей), — в основное, ничего не теряем
    Array.prototype.slice.call(report.children).forEach(function (x) { if (x !== head) main.appendChild(x); });
    if (head.parentNode) head.parentNode.removeChild(head);
    // пустые обёртки (строки светофора, из которых глубина ушла ниже) — убираем, чтобы не было пустых полос
    Array.prototype.slice.call(main.children).forEach(function (x) { if (!x.textContent.trim()) main.removeChild(x); });
    report.innerHTML = '';
    [hd, vd, body, foot, disc].forEach(function (x) { report.appendChild(x); });
    report.classList.add('ot');
    report.setAttribute('aria-label', svoj ? 'Ваша компания глазами банка и налоговой' : 'Отчёт о проверке контрагента');
    Array.prototype.forEach.call(vd.querySelectorAll('[data-cel]'), function (a) {
      a.addEventListener('click', function () { try { if (window.dlkGoal) dlkGoal(a.getAttribute('data-cel')); } catch (e) {} });
    });
    // «Паспорт 490 ₽ в один шаг»: кнопка Паспорта по состояниям из tarify.json (js/pasport-cta.js); нет модуля — как было
    var pa = vd.querySelector('[data-cel="otchet_pasport"]');
    if (pa && doc.defaultView && doc.defaultView.PasportCta) {
      try { doc.defaultView.PasportCta.mount(pa, { inn: r.company.inn, mesto: 'list', api: o.api || '', nazvanie: r.company.name_short || r.company.name_full || '' }); } catch (e) { /* кнопка остаётся как была */ }
    }
    if (doc.body) doc.body.classList.add('rezhim-otcheta');
    return true;
  }

  return { razlozhit: razlozhit, indeks: indeks, polnota: polnota, uroven: uroven, tonPolosy: tonPolosy, dejstviya: dejstviya,
    htmlIndeks: htmlIndeks, htmlIndeksIz: htmlIndeksIz, htmlKak: htmlKak, prokrutit: prokrutit, UROVNI: UROVNI, OGOVORKA: OGOVORKA, POD_PILL: POD_PILL,
    pilyulya: pilyulya, PILL_SOKR: PILL_SOKR };
});
