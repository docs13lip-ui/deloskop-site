/* Делоскоп — ряд плиток-счётчиков под «Плюсами и минусами» (план отчёта 15.11, п. 1.3; приоритет 16.11, п. 1).
 * Семь плиток: Суды · Приставы · Госконтракты · Банкротство · Приостановки · Финансы · Связи. На плитке — крупное число,
 * короткая подпись к нему, одно слово состояния и мелко источник с датой. Нажатие — к своему разделу ниже
 * (строка «Все данные из реестров» раскрывается, «Динамика», «Кто рядом»), с короткой вспышкой рамки.
 * Слова состояния — «есть» / «не нашли» / «не проверено», а не «чисто»: «не нашли на дату» — факт, «чисто» — оценка,
 * которую мы не обещаем (не проверяли ≠ не нашли). Цвет — латунь и нейтральные, без красного светофора: латунный кант
 * сверху — только у плиток, где найдено то, на что стоит посмотреть (дела против компании, приставы, банкротство, приостановки).
 * Данные — из уже готового ответа /api/check (damia, dossier) — новых запросов нет; «Связи» дописывает js/krug.js,
 * когда придёт его ответ (svyazi()). У ИП плиток «Финансы» и «Связи» нет (у ИП нет ГИР БО, «Кто рядом» — только организации).
 * Чистые функции sobrat и html — без DOM и сети, их проверяет tests/plitki.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkPlitki = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = ' ';

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
  function num(v) { var n = Number(v); return v !== null && v !== undefined && v !== '' && isFinite(n) ? n : null; }
  // деньги для плитки: число и единица отдельно (единица мельче — «149,8» + «млрд ₽»); vniz — «не меньше», вниз
  function den(v, vniz) {
    var a = Math.abs(v), z = function (x) { return (vniz ? Math.floor(x * 10) / 10 : Math.round(x * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, ''); };
    if (a >= 1e12) return { c: z(a / 1e12), e: 'трлн' + NB + '₽' };
    if (a >= 1e9) return { c: z(a / 1e9), e: 'млрд' + NB + '₽' };
    if (a >= 1e6) return { c: z(a / 1e6), e: 'млн' + NB + '₽' };
    if (a >= 1e3) return { c: chislo(vniz ? Math.floor(a / 1e3) : a / 1e3), e: 'тыс.' + NB + '₽' };
    return { c: chislo(a), e: '₽' };
  }
  function denStr(v, vniz) { var d = den(v, vniz); return d.c + NB + d.e; }
  function dmy(v) {
    var s = String(v || ''), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return m[3] + '.' + m[2] + '.' + m[1];
    return /^\d{2}\.\d{2}\.\d{4}$/.test(s) ? s : '';
  }
  function ip(r) { var c = (r && r.company) || {}; return c.kind === 'INDIVIDUAL' || String(c.inn || '').length === 12; }
  // состояние блока реестра — как в js/plyusy-minusy.js: после js/istochniki.js status = found / not_found / stale / …
  function sost(b) {
    if (!b || typeof b !== 'object') return '';
    var s = b.status;
    if (s === 'polucheno' || s === 'ne_provereno' || !s) s = b.sostoyanie || (s === 'ne_provereno' ? 'not_checked' : '');
    return s;
  }
  // источник без хвоста «(через …)» — на плитке места мало; полностью — в подсказке и в строке раздела
  // короткие имена реестров, чтобы на узкой плитке поместилась дата (kad.arbitr.ru — «КАД»)
  var KOROTKO = [[/^Картотека арбитражных дел/, 'КАД'], [/^ФССП/, 'ФССП'], [/^ЕИС/, 'ЕИС'], [/^ЕФРСБ/, 'ЕФРСБ'], [/^ФНС/, 'ФНС']];
  function kratkoIst(s) {
    s = String(s || '');
    for (var i = 0; i < KOROTKO.length; i++) if (KOROTKO[i][0].test(s)) return KOROTKO[i][1];
    return s.replace(/\s*\(через [^)]*\)\s*$/, '').replace(/:.*$/, '').trim();
  }

  // плитка: { k, zag, c, e, pod, slovo, ton, ist, ist_polno, data, nazv | sel }
  //   c — крупное число (строка), e — единица/подпись к числу, slovo — есть / не нашли / не проверено / ждём,
  //   ton — 'vnim' (латунный кант: найдено то, на что смотреть), 'est' (найдено, нейтрально), 'net', 'ne'
  function neProvereno(k, zag, b, nazv) {
    var st = sost(b), dd = st === 'stale' ? dmy(b && b.data_svedeniy) : '';
    return { k: k, zag: zag, c: '—', e: dd ? 'сведения на' + NB + dd : 'сегодня не' + NB + 'проверяли',
      slovo: 'не проверено', ton: 'ne', ist: kratkoIst(b && b.istochnik), ist_polno: (b && b.istochnik) || '', data: '', nazv: nazv || (b && b.nazvanie) || '' };
  }
  function iz(b) { return { ist: kratkoIst(b.istochnik), ist_polno: b.istochnik || '', data: dmy(b.data_svedeniy), nazv: b.nazvanie || '' }; }
  function plitka(o, b) { var x = iz(b); for (var k in o) x[k] = o[k]; return x; }
  // «есть запись в реестре недобросовестных поставщиков на 12.10.2026» — с датой сведений (правовая сверка 16.11)
  function rnpZapis(b) { var d = dmy(b && b.data_svedeniy); return 'есть запись в' + NB + 'реестре недобросовестных поставщиков' + (d ? ' на' + NB + d : ''); }

  function godProverki(r) {
    var t = Date.parse((r && r.checked_at) || '');
    return new Date((isFinite(t) ? t : Date.now()) + 3 * 3600 * 1000).getUTCFullYear();
  }
  // последняя выручка ГИР БО (несверенные годы js/istochniki.js из рядов уже снял)
  function vyruchka(r) {
    var D = (r && r.dossier) || {}, ch = D.charts || {}, g = null, v = null;
    (Array.isArray(ch.revenue) ? ch.revenue : []).forEach(function (x) {
      var y = parseInt(x && x.year, 10), z = num(x && x.value);
      if (isFinite(y) && z !== null && (g === null || y > g)) { g = y; v = z; }
    });
    (Array.isArray(D.kpi) ? D.kpi : []).forEach(function (k) {
      var m = /^Выручка за (\d{4})$/.exec((k && k.label) || ''), z = num(k && k.value);
      if (m && z !== null && (g === null || +m[1] > g)) { g = +m[1]; v = z; }
    });
    return g === null ? null : { god: g, summa: v };
  }

  function sobrat(r) {
    var T = [];
    if (!r || !r.company) return T;
    var dm = r.damia || {}, fl = ip(r);
    function blok(k) { var b = dm[k]; return b && typeof b === 'object' && b.nazvanie ? b : null; }

    // ---- Суды: идущие дела, где компания — ответчик (то, что решает про деньги); всего дел — подписью ----
    var b = blok('sudy'), st = sost(b), d;
    if (b && st === 'found') {
      d = b.dannye || {};
      var nz = num(d.otvetchik_nezaversheno), vs = num(d.vsego), sz = num(d.otvetchik_summa_nezaversheno);
      // слова — правовая сверка 16.11, п. 1: «незавершённых дел, где компания — ответчик», сумма исков — «требования», не долг
      if (nz !== null) T.push(plitka({ k: 'sudy', zag: 'Суды', c: chislo(nz), e: skl(nz, 'незавершённое дело', 'незавершённых дела', 'незавершённых дел') + ', где компания — ответчик',
        pod: nz > 0 && sz > 0 ? 'требования к' + NB + 'компании — ' + denStr(sz) : (vs > 0 ? 'всего в' + NB + 'картотеке: ' + chislo(vs) : ''),
        slovo: nz > 0 ? 'есть' : 'не нашли', ton: nz > 0 ? 'vnim' : 'net' }, b));
      else T.push(plitka({ k: 'sudy', zag: 'Суды', c: vs !== null ? chislo(vs) : '—', e: 'дел в' + NB + 'картотеке', slovo: 'есть', ton: 'vnim' }, b));
    } else if (b && st === 'not_found') T.push(plitka({ k: 'sudy', zag: 'Суды', c: '0', e: 'дел, где компания — ответчик', slovo: 'не нашли', ton: 'net' }, b));
    else T.push(neProvereno('sudy', 'Суды', b, 'Арбитражные суды'));

    // ---- Приставы: открытые производства и остаток («не меньше» — когда посчитаны не все) ----
    b = blok('fssp'); st = sost(b);
    if (b && st === 'found') {
      d = b.dannye || {};
      var ot = num(d.otkryto), zv = num(d.zapisej_vsego), os = num(d.ostatok), n1 = ot !== null ? ot : zv;
      T.push(plitka({ k: 'fssp', zag: 'Приставы', c: n1 !== null ? chislo(n1) : '—', e: n1 !== null ? skl(n1, 'производство', 'производства', 'производств') : 'производства есть',
        pod: os > 0 ? 'остаток долга — ' + (d.ostatok_tochno === false ? 'не' + NB + 'меньше ' + denStr(os, true) : denStr(os)) : '', slovo: 'есть', ton: 'vnim' }, b));
    } else if (b && st === 'not_found') T.push(plitka({ k: 'fssp', zag: 'Приставы', c: '0', e: 'производств', slovo: 'не нашли', ton: 'net' }, b));
    else T.push(neProvereno('fssp', 'Приставы', b, 'Приставы'));

    // ---- Госконтракты: сколько контрактов и договоров как поставщик; РНП — подписью, если нашли ----
    b = blok('kontrakty'); st = sost(b);
    var rnp = blok('rnp'), vRnp = rnp && sost(rnp) === 'found';
    if (b && st === 'found') {
      d = b.dannye || {};
      var vk = num(d.vsego), sm = num(d.summa), polno = !d.summa_ohvat || d.summa_ohvat === 'vse';
      T.push(plitka({ k: 'kontrakty', zag: 'Госконтракты', c: vk !== null ? chislo(vk) : '—', e: vk !== null ? skl(vk, 'контракт', 'контракта', 'контрактов') + ' и' + NB + 'договоров' : 'контракты есть',
        pod: vRnp ? rnpZapis(rnp) : (sm > 0 && polno ? 'на' + NB + denStr(sm) : ''), slovo: 'есть', ton: vRnp ? 'vnim' : 'est' }, b));
    } else if (b && st === 'not_found') T.push(plitka({ k: 'kontrakty', zag: 'Госконтракты', c: '0', e: 'контрактов', pod: vRnp ? rnpZapis(rnp) : '',
      slovo: 'не нашли', ton: vRnp ? 'vnim' : 'net' }, b));
    else T.push(neProvereno('kontrakty', 'Госконтракты', b, 'Госконтракты'));

    // ---- Банкротство: сообщения ЕФРСБ (или отметка в ЕГРЮЛ) ----
    b = blok('bankrotstvo'); st = sost(b);
    if (b && st === 'found') {
      d = b.dannye || {};
      var vb = num(d.vsego);
      T.push(plitka({ k: 'bankrotstvo', zag: 'Банкротство', c: b.iz_egryul ? '!' : (vb > 0 ? chislo(vb) : '!'),
        e: b.iz_egryul ? 'отметка в' + NB + 'ЕГРЮЛ' : (vb > 0 ? skl(vb, 'сообщение', 'сообщения', 'сообщений') + ' в' + NB + 'ЕФРСБ' : 'сообщения в' + NB + 'ЕФРСБ'),
        slovo: 'есть', ton: 'vnim' }, b));
    } else if (b && st === 'not_found') T.push(plitka({ k: 'bankrotstvo', zag: 'Банкротство', c: '0', e: b.iz_egryul ? 'отметок в' + NB + 'ЕГРЮЛ' : 'сообщений', slovo: 'не нашли', ton: 'net' }, b));
    else T.push(neProvereno('bankrotstvo', 'Банкротство', b, 'Банкротство'));

    // ---- Приостановки счетов: действующие решения ФНС ----
    b = blok('priostanovki'); st = sost(b);
    if (b && st === 'found') {
      d = b.dannye || {};
      var vp = num(d.vsego) !== null ? num(d.vsego) : num(d.kolichestvo);
      T.push(plitka({ k: 'priostanovki', zag: 'Приостановки', c: vp > 0 ? chislo(vp) : '!', e: vp > 0 ? skl(vp, 'решение', 'решения', 'решений') + ' ФНС' : 'решения ФНС', slovo: 'есть', ton: 'vnim' }, b));
    } else if (b && st === 'not_found') T.push(plitka({ k: 'priostanovki', zag: 'Приостановки', c: '0', e: 'решений ФНС', slovo: 'не нашли', ton: 'net' }, b));
    else T.push(neProvereno('priostanovki', 'Приостановки', b, 'Счета: решения ФНС о приостановлении'));

    if (fl) return T;

    // ---- Финансы: последняя выручка ГИР БО; «сдана» — за один из двух прошлых лет, иначе «старая» ----
    var v = vyruchka(r), gp = godProverki(r);
    if (v) {
      var dv = den(v.summa);
      T.push({ k: 'finansy', zag: 'Финансы', c: dv.c, e: dv.e + ' выручки за' + NB + v.god, slovo: v.god >= gp - 2 ? 'отчётность есть' : 'старая отчётность',
        ton: v.god >= gp - 2 ? 'est' : 'vnim', ist: 'ГИР БО', ist_polno: 'ГИР БО ФНС, годовая бухгалтерская отчётность', data: '', sel: '.din' });
    } else T.push({ k: 'finansy', zag: 'Финансы', c: '—', e: 'выручки в' + NB + 'ответе нет', slovo: 'не проверено', ton: 'ne', ist: 'ГИР БО', ist_polno: 'ГИР БО ФНС', data: '', sel: '.din' });

    // ---- Связи: заполняет svyazi(), когда ответит /api/krug ----
    T.push(svyaziPlitka(null));
    return T;
  }

  // o — модель js/krug.js (raschet): sost est / pusto / pusto_chast / net_v_baze / oshibka; n, vsego; null — ещё ждём
  function svyaziPlitka(o) {
    var x = { k: 'svyazi', zag: 'Связи', ist: 'ЕГРЮЛ', ist_polno: 'ЕГРЮЛ: тот же руководитель, участник или учредитель', data: '', sel: '.krug' };
    if (!o) { x.c = '…'; x.e = 'ищем по' + NB + 'ЕГРЮЛ'; x.slovo = 'ждём'; x.ton = 'zhdem'; return x; }
    if (o.sost === 'est') {
      var n = Math.max(num(o.vsego) || 0, num(o.n) || 0);
      x.c = chislo(n); x.e = skl(n, 'организация', 'организации', 'организаций') + ' рядом'; x.slovo = 'есть'; x.ton = 'est';
    } else if (o.sost === 'pusto') { x.c = '0'; x.e = 'организаций рядом'; x.slovo = 'не нашли'; x.ton = 'net'; }
    else if (o.sost === 'pusto_chast') { x.c = '0'; x.e = 'сверили не весь ЕГРЮЛ'; x.slovo = 'не нашли'; x.ton = 'net'; }
    else { x.c = '—'; x.e = o.sost === 'net_v_baze' ? 'компании нет в' + NB + 'нашей базе' : 'сервис не ответил'; x.slovo = 'не проверено'; x.ton = 'ne'; }
    return x;
  }

  // ---- разметка ----
  function vnutr(x) {
    var meta = [x.ist, x.data ? 'на' + NB + x.data : ''].filter(Boolean).join(' · ');
    return '<span class="pl__z">' + esc(x.zag) + '</span>' +
      '<span class="pl__c">' + esc(x.c) + '</span>' +
      '<span class="pl__e">' + esc(x.e) + '</span>' +
      (x.pod ? '<span class="pl__p">' + esc(x.pod) + '</span>' : '') +
      '<span class="pl__s">' + esc(x.slovo) + '</span>' +
      (meta ? '<span class="pl__i">' + esc(meta) + '</span>' : '');
  }
  function plitkaHtml(x) {
    var tip = [x.ist_polno, x.data ? 'на ' + x.data : ''].filter(Boolean).join(', ');
    return '<li class="pl__t pl__t--' + esc(x.ton) + '" data-pl="' + esc(x.k) + '"' + (x.nazv ? ' data-pl-nazv="' + esc(x.nazv) + '"' : '') +
      (x.sel ? ' data-pl-sel="' + esc(x.sel) + '"' : '') + (tip ? ' title="' + esc(tip) + '"' : '') + '><div class="pl__b">' + vnutr(x) + '</div></li>';
  }
  function html(T) {
    if (!T || !T.length) return '';
    return '<section class="pl" aria-labelledby="pl-h">' +
      '<h2 id="pl-h" class="pl__h">Коротко по' + NB + 'реестрам</h2>' +
      '<ul class="pl__r">' + T.map(plitkaHtml).join('') + '</ul></section>';
  }

  var CSS =
    '.pl{margin:0 0 20px}' +
    '.pl__h{margin:0 0 10px;font-size:15px;line-height:1.4;font-weight:600;color:var(--ink-2,#3A4868)}' +
    '.pl__hh{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 16px;margin:0 0 10px}.pl__hh .pl__h{margin:0}' +
    '.pl__d{font-size:13px;line-height:1.4;font-weight:600;color:var(--accent,#12305F);text-decoration:none;white-space:nowrap}' +
    '.pl__d:hover{text-decoration:underline;text-underline-offset:.18em}' +
    '.pl__r{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(136px,1fr));gap:10px}' +
    '.pl__t{margin:0;min-width:0}' +
    '.pl__b{position:relative;display:flex;flex-direction:column;height:100%;box-sizing:border-box;min-height:132px;padding:12px 12px 10px;' +
      'border:1px solid var(--line,#E3DDCD);border-radius:10px;background:var(--card,#fff);color:inherit;text-decoration:none}' +
    'a.pl__b{cursor:pointer;transition:border-color .2s,transform .2s}' +
    'a.pl__b:hover{border-color:var(--mat-zhdu,#7A5C14)}' +
    'a.pl__b:focus-visible{outline:2px solid var(--mat-fokus,#A07A28);outline-offset:2px}' +
    '.pl__t--vnim .pl__b{box-shadow:inset 0 2px 0 var(--mat-zhdu,#7A5C14)}' +
    '.pl__t--ne .pl__b,.pl__t--zhdem .pl__b{border-style:dashed}' +
    '.pl__z{font-size:13px;line-height:1.3;font-weight:600}' +
    '.pl__c{margin-top:6px;font-size:24px;line-height:1.1;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em}' +
    '.pl__t--ne .pl__c,.pl__t--zhdem .pl__c{color:var(--muted,#5B6783)}' +
    '.pl__e{margin-top:2px;font-size:12px;line-height:1.35;color:var(--ink-2,#3A4868)}' +
    '.pl__p{margin-top:4px;font-size:12px;line-height:1.35;color:var(--muted,#5B6783)}' +
    '.pl__s{margin-top:auto;padding-top:8px;font-size:12px;line-height:1.3;font-weight:600}' +
    '.pl__t--vnim .pl__s{color:var(--mat-zhdu,#7A5C14)}' +
    '.pl__t--net .pl__s,.pl__t--est .pl__s{color:var(--ink-2,#3A4868)}' +
    '.pl__t--ne .pl__s,.pl__t--zhdem .pl__s{color:var(--muted,#5B6783);font-weight:400}' +
    '.pl__i{font-size:12px;line-height:1.3;color:var(--muted,#5B6783);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '[data-theme=dark] a.pl__b:hover{border-color:var(--mat-zhdu-t,#D9B45A)}' +
    '[data-theme=dark] .pl__t--vnim .pl__b{box-shadow:inset 0 2px 0 var(--mat-zhdu-t,#D9B45A)}' +
    '[data-theme=dark] .pl__t--vnim .pl__s{color:var(--mat-zhdu-t,#D9B45A)}' +
    '[data-theme=dark] a.pl__b:focus-visible{outline-color:var(--mat-fokus-t,#D9B45A)}' +
    '.pl-vspyshka{outline:2px solid var(--mat-fokus,#A07A28);outline-offset:4px;border-radius:8px;transition:outline-color 1.2s}' +
    '[data-theme=dark] .pl-vspyshka{outline-color:var(--mat-fokus-t,#D9B45A)}' +
    '@media (prefers-reduced-motion:reduce){a.pl__b,.pl-vspyshka{transition:none}}' +
    '@media (max-width:640px){.pl__r{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pl__t:last-child:nth-child(odd){grid-column:1/-1}.pl__t:last-child:nth-child(odd) .pl__b{min-height:0}.pl__b{min-height:124px;padding:10px 10px 8px}.pl__c{font-size:20px}}' +
    '@media print{.pl{break-inside:avoid}.pl__b{border-color:#ccc;box-shadow:none}}';

  function stil(doc) {
    if (!doc || doc.getElementById('pl-css')) return;
    var s = doc.createElement('style'); s.id = 'pl-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Плитка → раздел ниже: строка «Все данные из реестров» (dt с названием реестра) или блок по селектору (.din, .krug)
  function cel(report, li) {
    var sel = li.getAttribute('data-pl-sel'), nazv = li.getAttribute('data-pl-nazv');
    if (sel) return report.querySelector('.ot-main ' + sel) || report.querySelector(sel);
    // sudy-pristavy-v1: у «Судов», «Приставов» и «Госконтрактов» (goskontrakty-v1) есть свой раздел «подробно» (js/sudy-pristavy.js) — туда, он раскрывается
    var k = li.getAttribute('data-pl'), dl = (k === 'sudy' || k === 'fssp' || k === 'kontrakty') && report.querySelector('.dl [data-dl="' + k + '"]');
    if (dl) return dl;
    var g = report.querySelector('.sut__g');
    if (!g || !nazv) return null;
    var dts = g.querySelectorAll('dt');
    for (var i = 0; i < dts.length; i++) {
      var t = (dts[i].firstChild && dts[i].firstChild.nodeType === 3 ? dts[i].firstChild.nodeValue : dts[i].textContent) || '';
      if (t.trim() === nazv) return dts[i].parentNode;
    }
    return null;
  }
  // div.pl__b → a.pl__b, если раздел есть; иначе плитка остаётся просто плиткой (без ссылки в никуда)
  function svyazat(report, li, n) {
    var t = cel(report, li), b = li.querySelector('.pl__b');
    if (!b) return;
    if (!t) { if (b.tagName === 'A') { var d0 = report.ownerDocument.createElement('div'); d0.className = 'pl__b'; d0.innerHTML = b.innerHTML; li.replaceChild(d0, b); } return; }
    if (!t.id) t.id = 'pl-' + li.getAttribute('data-pl') + '-' + n;
    var a = b;
    if (b.tagName !== 'A') { a = report.ownerDocument.createElement('a'); a.className = 'pl__b'; a.innerHTML = b.innerHTML; li.replaceChild(a, b); }
    a.href = '#' + t.id;
    a.setAttribute('aria-label', li.textContent.replace(/\s+/g, ' ').trim() + ' — к разделу');
    a.onclick = function (e) {
      var g = t.closest ? t.closest('details') : null;
      if (g && !g.open) g.open = true;
      if (t.tagName === 'DETAILS' && !t.open) t.open = true;
      e.preventDefault();
      try { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (x) { t.scrollIntoView(); }
      t.classList.add('pl-vspyshka');
      setTimeout(function () { t.classList.remove('pl-vspyshka'); }, 1600);
      try { if (self.dlkGoal) self.dlkGoal('plitka_perehod', { k: li.getAttribute('data-pl') }); } catch (x) {}
    };
  }
  function svyazatVse(report, sek) {
    Array.prototype.forEach.call(sek.querySelectorAll('li[data-pl]'), function (li, i) { try { svyazat(report, li, i + 1); } catch (e) {} });
  }

  // dosje-glavnaya-v1 (план отчёта 15.11, п. 1.4): плитки — оглавление досье. Рядом с заголовком — ссылка «Всё одним документом»
  // туда же, куда главная кнопка полосы вывода (Досье сделки или Паспорт); нажатие — сама кнопка (сумма из «Условий сделки» и счётчики — её).
  // Нет кнопки (ИП, своя компания) — ссылки нет.
  function dosje(report, sek) {
    var pa = report.querySelector('.ot-act a[data-cel="otchet_pasport"]'), h = sek.querySelector('.pl__h');
    if (!pa || !h || sek.querySelector('.pl__d')) return null;
    var doc = report.ownerDocument, box = doc.createElement('div'), a = doc.createElement('a');
    box.className = 'pl__hh';
    h.parentNode.insertBefore(box, h); box.appendChild(h);
    a.className = 'pl__d'; a.href = pa.getAttribute('href') || '#'; a.textContent = 'Всё одним документом' + NB + '→';
    a.setAttribute('data-pl-dosje', '1');
    a.setAttribute('aria-label', 'Всё одним документом: ' + (pa.textContent || '').trim());
    a.onclick = function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) { a.href = pa.getAttribute('href') || a.href; return; }
      e.preventDefault();
      try { if (self.dlkGoal) self.dlkGoal('plitki_dosje'); } catch (x) {}
      pa.click();
    };
    box.appendChild(a);
    return a;
  }

  // mount(report, r) — экран проверки: сразу под «Плюсами и минусами» (или первым в .ot-main, если их нет).
  // Разделы ниже (реестры, «Динамика») вставляются тем же проходом отчёта — ссылки ставит отложенный повтор.
  function mount(report, r) {
    if (!report) return null;
    var star = report.querySelector('.pl'), h = html(sobrat(r));
    if (!h) { if (star && star.parentNode) star.parentNode.removeChild(star); return null; }
    var doc = report.ownerDocument, t = doc.createElement('div');
    t.innerHTML = h;
    var nov = t.firstChild;
    try { stil(doc); } catch (e) {}
    if (star && star.parentNode) star.parentNode.replaceChild(nov, star);
    else {
      var main = report.querySelector('.ot-main'), pm = main && main.querySelector('.pm');
      if (!main) return null;
      if (pm && pm.parentNode === main) main.insertBefore(nov, pm.nextSibling);
      else main.insertBefore(nov, main.firstChild);
    }
    svyazatVse(report, nov);
    try { dosje(report, nov); } catch (e) {}
    setTimeout(function () { if (nov.parentNode) svyazatVse(report, nov); }, 0);
    try { if (self.dlkGoal) self.dlkGoal('plitki_view', { n: nov.querySelectorAll('.pl__t--vnim').length }); } catch (e) {}
    return nov;
  }
  // svyazi(report, o) — ответ «Кто рядом» пришёл: перерисовать плитку «Связи» (o — модель js/krug.js или null при сбое)
  function svyazi(report, o) {
    var li = report && report.querySelector('.pl li[data-pl="svyazi"]');
    if (!li) return null;
    var x = svyaziPlitka(o || { sost: 'oshibka' }), t = report.ownerDocument.createElement('ul');
    t.innerHTML = plitkaHtml(x);
    var nov = t.firstChild;
    li.parentNode.replaceChild(nov, li);
    try { svyazat(report, nov, 7); } catch (e) {}
    return nov;
  }

  return { sobrat: sobrat, html: html, mount: mount, dosje: dosje, svyazi: svyazi, svyaziPlitka: svyaziPlitka, stil: stil, den: den, CSS: CSS };
});
