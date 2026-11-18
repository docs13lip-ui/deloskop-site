/* Делоскоп — «Главное» на первом экране отчёта (pervyj-ekran-otcheta-v1; план команды 18.11, разд. 3 пп. 1–2 и разд. 4:
 * «ответ на первом экране телефона», «сумма с масштабом к выручке»).
 * Замер 18.11 (Магнит, 1280×800 и 390×844): «Плюсы и минусы» начинались на 2-м экране компьютера и на 3-м телефона —
 * на первом экране были название, реквизиты проверки и кольцо Индекса, но ни одного факта.
 * Что: под названием компании (на компьютере — в пустой левой половине шапки, рядом с реквизитами; на телефоне — под строкой
 * «Ответ») — до трёх главных фактов и, если есть, одна строка мелкого. Строки — те же слова, что в «Плюсах и минусах»
 * (js/plyusy-minusy.js, слова юриста 16–17.11), новых утверждений нет. К каждой сумме (иски, приставы, недоимка) — доля от
 * выручки последнего года ГИР БО, как в «Деньгах на кону» (правило юриста 12.11 п. 3: нет выручки, отчёт старше двух лет
 * или банк — доли нет).
 * Порядок — по весу, а не по порядку источников: статус, банкротство, приостановки, РНП, обеспечительные меры, недостоверность —
 * всегда первыми; суммы от 10 % выручки — тоже; суммы меньше 0,1 % выручки — не в главном, а одной строкой «мелкое» внизу;
 * свободные места — плюсы. Внизу — ссылка ко всем плюсам и минусам (их число).
 * Те же доли подписываются и в строках «Плюсов и минусов» (podpisatDoli).
 * Чистые функции sobrat и html — без DOM и сети, их проверяет tests/glavnoe.test.js. Своя компания (Щит) — без блока.
 * itog-glavnoe-v1 (слова юриста 18.11 02:10, п. 2): над фактами — итог одной строкой, сразу под ним «Не проверяли: …»,
 * внизу — что значит «существенно». Три вида итога:
 *   «Есть M существенных минуса на дату» — событие без суммы (статус, банкротство, приостановки, РНП, меры, недостоверность)
 *     или сумма от 0,1 % выручки;
 *   «Существенных минусов не нашли — по K проверенным источникам на дату» — только если минусов нет вовсе или все они — суммы
 *     меньше 0,1 % выручки (любой другой минус без суммы — возраст, штат, прогноз ЗСК — уже не «не нашли»);
 *   «Плюсов N, минусов M — по K проверенным источникам на дату» — во всех прочих случаях, в том числе когда сумму не с чем
 *     сравнить (нет выручки, банк, ИП) — тогда строка «Масштаб не посчитать: …».
 * K — сколько источников ответили (реестр, открытые данные ФНС, ГИР БО, каждый внешний реестр с ответом «есть» / «не нашли»);
 * дата — дата проверки. Оценочных слов о компании нет — только счёт фактов (222-ФЗ, п. 3 ст. 2; сторож — tests/glavnoe.test.js).
 * zapros-glavnoe-v1 (план 18.11, разд. 4 «перегнать»: «что запросить у этой компании перед оплатой по найденным минусам»):
 * под минусами «Главного» — «Что запросить по этим минусам»: до трёх документов из того же списка «Что запросить у них»
 * (js/usloviya.js, decide().docs — слова юриста и п. 16 письма ФНС от 10.03.2021 № БВ-4-7/3060@), только те, что отвечают
 * на минус, стоящий в «Главном» (налог → справка КНД 1120101, приставы → погашение, приостановка → отмена решения,
 * недостоверность → исправление записи и помещение, прогноз ЗСК → второй банк). Новых слов нет; ссылка открывает весь список
 * и готовое письмо. Нет такого минуса или нет модуля условий — блока нет. Налог меньше 500 ₽ (остаток) — не минус, справки нет. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkGlavnoe = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = ' ';
  var MAKS = 3;          // главных строк
  var MELKO = 0.001;     // меньше 0,1 % выручки — «мелкое» (план 18.11, разд. 3 п. 2)
  var KRUPNO = 0.1;      // от 10 % — вес как у статуса (порог «Денег на кону»: srednyaya)
  // минусы без суммы, которые решают про деньги сразу (как начало PORYADOK_M в js/plyusy-minusy.js)
  var TYAZHELYE = ['status', 'damia_bankrotstvo', 'damia_priostanovki', 'damia_rnp', 'damia_mery', 'address'];

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function num(v) { var n = Number(v); return v !== null && v !== '' && v !== undefined && isFinite(n) ? n : null; }
  function ip(r) { var c = (r && r.company) || {}; return c.kind === 'INDIVIDUAL' || String(c.inn || '').replace(/\D/g, '').length === 12; }
  function bank(r) { return /^64\.1(\.|\d|$)/.test(String(((r && r.company) || {}).okved || '')); }
  function godNa(r, segodnya) {
    var d = r && r.checked_at ? new Date(r.checked_at) : null;
    return (d && !isNaN(d) ? d : segodnya || new Date()).getFullYear();
  }

  // Выручка для масштаба — та же, что в «Деньгах на кону»: dengi.vyruchka (после сверки js/istochniki.js), не старше двух лет
  function vyruchka(r, segodnya) {
    if (!r || ip(r) || bank(r)) return null;
    var V = r.dengi && r.dengi.vyruchka, s = V && num(V.summa), g = V && num(V.god);
    if (!(s > 0) || !g || godNa(r, segodnya) - g > 2) return null;
    return { summa: s, god: g };
  }

  // Сумма за строкой «Плюсов и минусов» (только минусы с деньгами)
  function summa(r, k) {
    var dm = (r && r.damia) || {}, dn;
    if (k === 'damia_sudy') { dn = (dm.sudy && dm.sudy.dannye) || {}; return num(dn.otvetchik_summa_nezaversheno); }
    if (k === 'damia_fssp') { dn = (dm.fssp && dm.fssp.dannye) || {}; return num(dn.ostatok); }
    if (k === 'tax_debt') {
      var s = (r.dengi && Array.isArray(r.dengi.sostavlyayushchie) ? r.dengi.sostavlyayushchie : []).filter(function (x) { return x && x.vid === 'nedoimka'; })[0];
      return s ? num(s.summa) : null;
    }
    return null;
  }

  function nolTochno(r, k, sm) {
    if (k !== 'damia_fssp' || sm !== 0) return false;
    var dn = (((r && r.damia) || {}).fssp || {}).dannye || {};
    return dn.ostatok_tochno === true && (!dn.ostatok_ohvat || dn.ostatok_ohvat === 'vse');
  }

  // состояние блока реестра — как в js/plyusy-minusy.js (после js/istochniki.js status, в сыром ответе sostoyanie)
  function sost(b) {
    if (!b || typeof b !== 'object') return '';
    var s = b.status;
    if (s === 'polucheno' || s === 'ne_provereno' || !s) s = b.sostoyanie || (s === 'ne_provereno' ? 'not_checked' : '');
    return s;
  }
  // сколько источников ответили: реестр (ЕГРЮЛ/ЕГРИП), открытые данные ФНС, ГИР БО, каждый внешний реестр с ответом
  function istochnikov(r, S) {
    var I = {}, sig = Array.isArray(r && r.signals) ? r.signals : [];
    function est(ids) { return sig.some(function (x) { return x && ids.indexOf(x.id) >= 0 && /^(ok|warn|bad)$/.test(x.status); }); }
    if (est(['status', 'address', 'age'])) I.reestr = 1;
    if (est(['tax_debt', 'tax', 'employees', 'staff'])) I.fns = 1;
    if (S && S.plyusy.some(function (x) { return x.k === 'otchetnost'; })) I.girbo = 1;
    var dm = (r && r.damia) || {};
    Object.keys(dm).forEach(function (k) {
      var b = dm[k], q = sost(b);
      if (b && typeof b === 'object' && b.nazvanie && (q === 'found' || q === 'not_found')) I['d_' + k] = 1;
    });
    return Object.keys(I).length;
  }
  function dataProverki(r, segodnya) {
    var t = Date.parse((r && r.checked_at) || ''), d = new Date((isFinite(t) ? t : (segodnya || new Date()).getTime()) + 3 * 3600 * 1000);
    var dd = d.getUTCDate(), mm = d.getUTCMonth() + 1;
    return (dd < 10 ? '0' : '') + dd + '.' + (mm < 10 ? '0' : '') + mm + '.' + d.getUTCFullYear();
  }
  var SOBYTIYA = 'банкротство, ликвидация или' + NB + 'исключение из' + NB + 'реестра, недостоверность, приостановка счетов, обеспечительные меры, запись в' + NB + 'РНП';
  function masshtab(r, segodnya) {
    if (ip(r)) return 'Масштаб не' + NB + 'посчитать: у' + NB + 'ИП нет бухгалтерской отчётности в' + NB + 'ГИР' + NB + 'БО';
    if (bank(r)) return 'Масштаб не' + NB + 'посчитать: суммы банка к' + NB + 'выручке не' + NB + 'соотносим';
    return 'Масштаб не' + NB + 'посчитать: выручка за' + NB + (godNa(r, segodnya) - 1) + NB + 'год в' + NB + 'открытых данных не' + NB + 'найдена';
  }
  // itog(r, S, M, V, segodnya) → { vid: 'est' | 'net' | 'schet', t, ne: [строки], porog, masshtab } или null
  function itog(r, S, M, V, segodnya) {
    var K = istochnikov(r, S);
    if (!K) return null;
    var na = 'на' + NB + dataProverki(r, segodnya);
    var po = 'по' + NB + K + NB + (K % 10 === 1 && K % 100 !== 11 ? 'проверенному источнику' : 'проверенным источникам');
    var sush = M.filter(function (x) { return x.sush; }).length;
    var bezMasshtaba = M.some(function (x) { return x.summa > 0 && x.d == null; });
    var prochie = M.filter(function (x) { return !x.sush && x.ves !== 0; }).length;
    var ne = S.ne.map(function (x) { return x.t; }).filter(function (t, i, a) { return a.indexOf(t) === i; });
    var porog = 'Существенно — ' + (V ? 'сумма от' + NB + '0,1' + NB + '% выручки за' + NB + V.god + NB + 'год (ГИР' + NB + 'БО) или событие без суммы: ' :
      'событие без суммы: ') + SOBYTIYA;
    // nalog-ostatok-otcheta-v1: налог меньше 500 ₽ — не минус, а «Остаток: …» сразу под «Не проверяли» (как на карточках)
    var ost = (S.ostatok || []).map(function (x) { return x.t; });
    var o = { vid: '', t: '', ne: ne, ostatok: ost, porog: '', masshtab: bezMasshtaba ? masshtab(r, segodnya) : '' };
    if (sush > 0) {
      o.vid = 'est';
      o.t = 'Есть ' + sush + NB + skl(sush, 'существенный минус', 'существенных минуса', 'существенных минусов') + ' ' + na;
      o.porog = porog;
    } else if (!prochie && !bezMasshtaba) {
      o.vid = 'net';
      o.t = 'Существенных минусов не' + NB + 'нашли' + NB + '— ' + po + ' ' + na;
      o.porog = porog;
    } else {
      o.vid = 'schet';
      o.t = 'Плюсов ' + S.plyusy.length + ', минусов ' + S.minusy.length + NB + '— ' + po + ' ' + na;
    }
    return o;
  }

  function procent(d) {
    var p = d * 100;
    if (p < 1) return (Math.round(p * 10) / 10).toFixed(1).replace('.', ',');
    return String(Math.round(p));
  }
  // «меньше 0,1 % выручки за 2024 год» · «0,6 % выручки за 2024 год» · «12 % выручки…» · «больше выручки за 2024 год»
  function dolyaTekst(d, god) {
    var za = ' выручки за' + NB + god + NB + 'год';
    if (d < MELKO) return 'меньше 0,1' + NB + '%' + za;
    if (d >= 1) return 'больше' + za;
    return procent(d) + NB + '%' + za;
  }

  // sobrat(r, segodnya, PM) → { glavnoe: [{znak, t, ist, data, k, dolya}], melkoe: [...], plyusov, minusov } или null
  function sobrat(r, segodnya, PM) {
    PM = PM || (typeof self !== 'undefined' ? self.PlyusyMinusy : null);
    if (!PM || !r || !r.company) return null;
    var S = PM.sobrat(r, segodnya);
    if (!S || (!S.plyusy.length && !S.minusy.length)) return null;
    var V = vyruchka(r, segodnya);
    var M = S.minusy.map(function (x, i) {
      var sm = summa(r, x.k), d = V && sm > 0 ? sm / V.summa : null;
      // nol-pristavy-v1: точный ноль у приставов (неимущественные требования) — не «сумма неизвестна» (вес 2), а ниже любых денег от 0,1 % выручки;
      // в «Мелкое к выручке» не кладём — к выручке его не соотнести (живой /api/check 18.11 02:10, ПАО «Газпром»)
      var ves = TYAZHELYE.indexOf(x.k) >= 0 ? 3 : nolTochno(r, x.k, sm) ? 1 : d == null ? 2 : d >= KRUPNO ? 3 : d >= MELKO ? 2 : 0;
      // существенно (слова юриста 18.11 п. 2): событие без суммы из TYAZHELYE или сумма от 0,1 % выручки
      var sush = TYAZHELYE.indexOf(x.k) >= 0 || (d != null && d >= MELKO);
      return { znak: 'minus', k: x.k, t: x.t, ist: x.ist, data: x.data, dolya: d != null ? dolyaTekst(d, V.god) : '', ves: ves, i: i,
        sush: sush, summa: sm, d: d };
    }).sort(function (a, b) { return b.ves - a.ves || a.i - b.i; });
    var it = itog(r, S, M, V, segodnya);
    // vyvod-glavnoe-v1: существенные минусы по весу — их называет пояснение под выводом (js/usloviya.js), чтобы оно
    // не говорило «серьёзных признаков не найдено» рядом с «Есть N существенных минусов»
    if (it) it.sushchestvennye = M.filter(function (x) { return x.sush; }).map(function (x) { return { k: x.k, t: x.t, dolya: x.dolya }; });
    var glavnoe = M.filter(function (x) { return x.ves > 0; }).slice(0, MAKS);
    var melkoe = M.filter(function (x) { return x.ves === 0; });
    S.plyusy.slice(0, Math.max(0, MAKS - glavnoe.length)).forEach(function (x) {
      glavnoe.push({ znak: 'plus', k: x.k, t: x.t, ist: x.ist, data: x.data, dolya: '' });
    });
    // «тяжёлых» минусов больше трёх — остальные не прячем: счётчик внизу ведёт ко всем
    [glavnoe, melkoe].forEach(function (L) { L.forEach(function (x) { delete x.ves; delete x.i; delete x.sush; delete x.summa; delete x.d; }); });
    return { glavnoe: glavnoe, melkoe: melkoe, god: V ? V.god : null, plyusov: S.plyusy.length, minusov: S.minusy.length, itog: it };
  }

  // минус «Главного» → документы списка «Что запросить у них» (js/usloviya.js DOCS), отвечающие именно на него
  var ZAPROS = { director_change: ['powerNew'], tax_debt: ['taxCert'], damia_fssp: ['fssp'], damia_priostanovki: ['unblock'], address: ['fixRecord', 'premises'], zsk: ['bank'] };
  var ZAPROS_MAKS = 3;
  // zapros(G, docs) → [{ id, t }] — только документы, которые есть в списке условий (docs — decide(r).docs), по порядку минусов
  function zapros(G, docs) {
    if (!G || !Array.isArray(G.glavnoe) || !Array.isArray(docs)) return [];
    var est = {}, out = [];
    docs.forEach(function (d) { if (d && d.id && d.title) est[d.id] = d.title; });
    G.glavnoe.forEach(function (x) {
      if (x.znak !== 'minus') return;
      (ZAPROS[x.k] || []).forEach(function (id) {
        if (est[id] && out.length < ZAPROS_MAKS && !out.some(function (y) { return y.id === id; })) out.push({ id: id, t: est[id] });
      });
    });
    return out;
  }

  function skl(n, a, b, c) { var k = Math.abs(n) % 100, d = k % 10; return k > 10 && k < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c; }
  // тире не переносится в начало строки: «компании — 180 млн ₽»
  function tire(t) { return esc(t).replace(/ — /g, NB + '— '); }
  function stroka(x) {
    var meta = [x.ist, x.data ? 'на' + NB + x.data : ''].filter(Boolean).join(' · ');
    return '<li class="gl1__s gl1__s--' + x.znak + '" data-gl="' + esc(x.k) + '"><span class="gl1__t">' + tire(x.t) +
      (x.dolya ? ' <span class="gl1__d">(' + esc(x.dolya) + ')</span>' : '') + '</span>' +
      (meta ? '<small>' + esc(meta) + '</small>' : '') + '</li>';
  }
  function zaprosHtml(Z) {
    if (!Array.isArray(Z) || !Z.length) return '';
    return '<div class="gl1__z" data-zapros="' + Z.length + '"><p class="gl1__zh">Что запросить по' + NB + 'этим минусам</p><ul>' +
      Z.map(function (d) { return '<li data-doc="' + esc(d.id) + '">' + tire(d.t) + '</li>'; }).join('') + '</ul>' +
      '<button type="button" class="gl1__zv">Весь список и' + NB + 'готовое письмо' + NB + '↓</button></div>';
  }
  function html(G) {
    if (!G || (!G.glavnoe.length && !G.melkoe.length)) return '';
    var m = G.melkoe, ml = '';
    if (m.length) {
      // юрист 18.11 01:30, разд. 2 «мелочь вслух не пишем»: не «Мелкое», а «Небольшие суммы (меньше 0,1 % выручки за год)» —
      // как на карточках (chto-za-kompaniya-v1); доля уже в подписи, у строки её не повторяем
      ml = '<p class="gl1__m"><span>Небольшие суммы' + (G.god ? ' (меньше 0,1' + NB + '% выручки за' + NB + G.god + NB + 'год)' : '') + ':</span> ' + tire(m[0].t) +
        (m.length > 1 ? ' и' + NB + 'ещё ' + (m.length - 1) : '') + '</p>';
    }
    var vse = 'Все плюсы и' + NB + 'минусы: ' + G.plyusov + NB + 'и' + NB + G.minusov + NB + '↓';
    var I = G.itog, it = '', por = '';
    if (I && I.t) {
      it = '<p class="gl1__i gl1__i--' + esc(I.vid) + '">' + tire(I.t) + '</p>' +
        (I.ne.length ? '<p class="gl1__ne"><span>Не' + NB + 'проверяли:</span> ' + I.ne.map(esc).join(', ') + '</p>' : '') +
        (I.ostatok || []).map(function (t) { return '<p class="gl1__ne gl1__ost">' + tire(t) + '</p>'; }).join('') +
        (I.masshtab ? '<p class="gl1__ne">' + esc(I.masshtab) + '</p>' : '');
      if (I.porog) por = '<p class="gl1__por">' + tire(I.porog) + '</p>';
    }
    return '<section class="gl1" aria-labelledby="gl1-h" data-glavnoe="' + G.glavnoe.length + '" data-melkoe="' + m.length + '"' +
      (I && I.vid ? ' data-itog="' + esc(I.vid) + '"' : '') + '>' +
      '<h2 id="gl1-h" class="gl1__h">Главное</h2>' + it +
      '<ul class="gl1__l">' + G.glavnoe.map(stroka).join('') + '</ul>' + ml + zaprosHtml(G.zapros) + por +
      '<a class="gl1__vse" href="#pm-h" aria-label="' + esc('Все плюсы и минусы: ' + G.plyusov + ' ' + skl(G.plyusov, 'плюс', 'плюса', 'плюсов') +
        ' и ' + G.minusov + ' ' + skl(G.minusov, 'минус', 'минуса', 'минусов')) + '">' + vse + '</a>' +
      '</section>';
  }

  var CSS =
    '.gl1{margin:16px 0 0;padding:14px 0 0;border-top:1px solid var(--line,#E3DDCD);max-width:560px}' +
    '.gl1__h{margin:0 0 6px;font-size:13px;line-height:1.4;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#5B6783)}' +
    '.gl1__i{margin:0 0 2px;font-size:17px;line-height:1.35;font-weight:600;color:var(--ink,#0B1B3A);text-wrap:pretty}' +
    '.gl1__ne{margin:0 0 6px;font-size:13px;line-height:1.5;color:var(--muted,#5B6783)}' +
    '.gl1__ne span{font-weight:600;color:var(--ink-2,#3A4868)}' +
    '.gl1__por{margin:6px 0 0 22px;font-size:12px;line-height:1.45;color:var(--muted,#5B6783)}' +
    '.gl1__l{list-style:none;margin:0;padding:0}' +
    '.gl1__s{position:relative;padding:5px 0 5px 22px}' +
    '.gl1__s::before{position:absolute;left:2px;top:5px;font-weight:600;line-height:1.4;font-size:15px}' +
    '.gl1__s--plus::before{content:"+";color:var(--mat-zhdu,#7A5C14)}' +
    '.gl1__s--minus::before{content:"\\2212";color:var(--ink,#0B1B3A)}' +
    '[data-theme=dark] .gl1__s--plus::before{color:var(--mat-zhdu-t,#D9B45A)}' +
    '.gl1__t{display:block;font-size:15px;line-height:1.4}' +
    '.gl1__d{font-variant-numeric:tabular-nums;color:var(--ink-2,#3A4868)}' +
    '.gl1__s small{display:block;font-size:12px;line-height:1.4;color:var(--muted,#5B6783)}' +
    '.gl1__m{margin:4px 0 0;padding-left:22px;font-size:13px;line-height:1.5;color:var(--muted,#5B6783)}' +
    '.gl1__m span{font-weight:600;color:var(--ink-2,#3A4868)}' +
    '.gl1__vse{display:inline-block;margin:8px 0 0 22px;font-size:13px;line-height:1.4;color:var(--ink,#0B1B3A);text-decoration:underline;' +
      'text-decoration-color:var(--line,#E3DDCD);text-underline-offset:.2em}' +
    '.gl1__vse:hover{text-decoration-color:currentColor}' +
    '.gl1__z{margin:8px 0 0 22px;padding:8px 0 0 12px;border-left:2px solid var(--mat-zhdu,#7A5C14)}' +
    '[data-theme=dark] .gl1__z{border-left-color:var(--mat-zhdu-t,#D9B45A)}' +
    '.gl1__zh{margin:0 0 2px;font-size:13px;line-height:1.4;font-weight:600;color:var(--ink-2,#3A4868)}' +
    '.gl1__z ul{margin:0;padding:0 0 0 18px;font-size:13px;line-height:1.5;color:var(--ink,#0B1B3A)}' +
    '.gl1__z li{margin:2px 0}' +
    '.gl1__zv{display:inline-block;margin:4px 0 0;padding:0;border:0;background:none;font:inherit;cursor:pointer;font-size:13px;line-height:1.4;color:var(--ink,#0B1B3A);text-decoration:underline;' +
      'text-decoration-color:var(--line,#E3DDCD);text-underline-offset:.2em}' +
    '.gl1__zv:hover{text-decoration-color:currentColor}.usl details{scroll-margin-top:96px}' +
    '.pm__d{font-weight:400;font-variant-numeric:tabular-nums;color:var(--ink-2,#3A4868)}.pm{scroll-margin-top:96px}' +
    '@media (max-width:640px){.gl1{margin-top:12px;padding-top:12px}.gl1__vse{padding:12px 0;margin-top:0}.gl1__zv{padding:10px 0;margin:0}}' +
    '@media print{.gl1__vse,.gl1__zv{display:none}}';

  function stil(doc) {
    if (!doc || doc.getElementById('gl1-css')) return;
    var s = doc.createElement('style'); s.id = 'gl1-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Доли — и в строках «Плюсов и минусов» (план 18.11, разд. 3 п. 2: «каждая сумма рядом с долей от выручки»)
  function podpisatDoli(report, r, segodnya) {
    var V = vyruchka(r, segodnya);
    if (!report || !V) return 0;
    var n = 0;
    ['damia_sudy', 'damia_fssp', 'tax_debt'].forEach(function (k) {
      var li = report.querySelector('.pm__k--minus li[data-pm="' + k + '"]'), sm = summa(r, k);
      if (!li || !(sm > 0) || li.querySelector('.pm__d')) return;
      var t = li.querySelector('.pm__t');
      if (!t) return;
      var b = report.ownerDocument.createElement('span');
      b.className = 'pm__d';
      b.textContent = ' (' + dolyaTekst(sm / V.summa, V.god) + ')';
      t.appendChild(b);
      n++;
    });
    return n;
  }

  // «Что запросить у них» — <details> в «Условиях сделки» (js/usloviya.js), смонтированных раньше «Главного»
  function spisokZaprosa(report) {
    var det = null;
    [].slice.call(report.querySelectorAll('.usl details')).some(function (d) {
      var s = d.querySelector('summary'); if (s && /Что запросить/.test(s.textContent)) { det = d; return true; } return false;
    });
    return det;
  }

  // mount(report, r) — после PlyusyMinusy.mount: в шапку листа (.ot-who), под название и строку «Ответ»
  function mount(report, r, o) {
    o = o || {};
    if (!report || !r) return null;
    var who = report.querySelector('.ot-hd .ot-who'), star = report.querySelector('.gl1');
    if (star && star.parentNode) star.parentNode.removeChild(star);
    var doc = report.ownerDocument;
    try { stil(doc); podpisatDoli(report, r); } catch (e) {}
    var G = who ? sobrat(r) : null;
    // zapros-glavnoe-v1: документы — из того же расчёта, что «Условия сделки» ниже (одна правда на странице)
    var U = o.usloviya || (typeof self !== 'undefined' ? self.Usloviya : null);
    if (G && U && U.decide) { try { G.zapros = zapros(G, U.decide(r).docs); } catch (e) { G.zapros = []; } }
    var h = who ? html(G) : '';
    if (!h) return null;
    var t = doc.createElement('div');
    t.innerHTML = h;
    var nov = t.firstChild;
    who.appendChild(nov);
    var a = nov.querySelector('.gl1__vse'), pm = report.querySelector('.pm');
    if (a && !pm) a.parentNode.removeChild(a);
    else if (a) a.addEventListener('click', function (e) {
      e.preventDefault();
      try { pm.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (x) { pm.scrollIntoView(); }
      try { if (self.dlkGoal) self.dlkGoal('glavnoe_vse'); } catch (x) {}
    });
    var z = nov.querySelector('.gl1__zv');
    if (z && !spisokZaprosa(report)) z.parentNode.removeChild(z);
    else if (z) z.addEventListener('click', function (e) {
      var det = spisokZaprosa(report);
      e.preventDefault();
      if (!det) return;
      det.open = true;
      try { det.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (x) { det.scrollIntoView(); }
      try { var s = det.querySelector('summary'); if (s) s.focus({ preventScroll: true }); } catch (x) {}
      try { if (self.dlkGoal) self.dlkGoal('glavnoe_zapros'); } catch (x) {}
    });
    return nov;
  }

  return { sobrat: sobrat, zapros: zapros, ZAPROS: ZAPROS, html: html, mount: mount, stil: stil, podpisatDoli: podpisatDoli, dolyaTekst: dolyaTekst, vyruchka: vyruchka,
    summa: summa, itog: itog, istochnikov: istochnikov, CSS: CSS, MAKS: MAKS, MELKO: MELKO, KRUPNO: KRUPNO };
});
