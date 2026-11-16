/* Делоскоп — «Суды и приставы подробно» в отчёте по ИНН (план отчёта 15.11, п. 5; приоритет 16.11, п. 1).
 * Плитки «Суды» и «Приставы» (js/plitki.js) дают число; здесь — что за ним стоит, без ухода на чужие сайты:
 *   Суды — сколько дел, где компания ответчик, в картотеке и сколько не завершены, суммы требований, 5 последних дел
 *          (номер со ссылкой на карточку в КАД, дата, истец, суд, сумма, стадия) и «Показать все загруженные».
 *   Приставы — открытые производства и остаток, предметы взыскания группами (налоги и взносы, зарплата, штрафы,
 *          госпошлины по суду, прочее) по загруженным производствам, 5 последних (номер, дата, предмет, остаток, отдел).
 * Честно о полноте: сервер отдаёт часть списка («загружены 30 последних из 5 652») — так и пишем, суммы групп —
 * «по загруженным»; дела, где компания истец или третье лицо, и суды общей юрисдикции сервер не запрашивает —
 * строкой «Не проверяли» (не проверяли ≠ не нашли). Пустой ответ — «Не нашли на дату …», сбой — «Не проверили».
 * ФИО граждан и ИП из сторон не показываем (маска js/istochniki.js; здесь — повторно, на случай иного пути данных).
 * Цвет — латунь и нейтральные, без красного: вывод не обещаем. Данные — из готового /api/check (damia.sudy, damia.fssp),
 * новых запросов нет. Плитки «Суды» и «Приставы» ведут сюда (js/plitki.js, cel), раздел раскрывается.
 * goskontrakty-v1 (план отчёта 15.11, п. 5, 16.11): третий раздел — «Госконтракты»: сколько контрактов и договоров как
 *   поставщик (44-ФЗ и 223-ФЗ отдельно), когда последний, запись в РНП, заказчики и 10 последних контрактов со ссылкой
 *   на карточку в ЕИС. Сумму — только если сервер посчитал её по всем (иначе часть выдали бы за целое); заказчиков —
 *   с подписью «по N последним». Не проверяли: закупки, где компания заказчик, и исполнение (расторжения, неустойки).
 * Чистые функции sobrat и html — без DOM и сети, их проверяет tests/sudy_pristavy.test.js и tests/goskontrakty.test.js. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkSudyPristavy = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var NB = ' ', POKAZ = 5;

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
  function num(v) { var n = Number(v); return v !== null && v !== undefined && v !== '' && typeof v !== 'boolean' && isFinite(n) ? n : null; }
  // деньги: «2,6 млрд ₽»; vniz — «не меньше» (округляем вниз, чтобы «от» не стало больше правды)
  function den(v, vniz) {
    var a = Math.abs(v), z = function (x) { return (vniz ? Math.floor(x * 10) / 10 : Math.round(x * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, ''); };
    if (a >= 1e12) return z(a / 1e12) + NB + 'трлн' + NB + '₽';
    if (a >= 1e9) return z(a / 1e9) + NB + 'млрд' + NB + '₽';
    if (a >= 1e6) return z(a / 1e6) + NB + 'млн' + NB + '₽';
    if (a >= 1e3) return chislo(vniz ? Math.floor(a / 1e3) : a / 1e3) + NB + 'тыс.' + NB + '₽';
    return chislo(a) + NB + '₽';
  }
  function dmy(v) {
    var s = String(v || ''), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return m[3] + '.' + m[2] + '.' + m[1];
    return /^\d{2}\.\d{2}\.\d{4}$/.test(s) ? s : '';
  }
  function klyuchDaty(v) { var s = dmy(v); return s ? s.slice(6) + s.slice(3, 5) + s.slice(0, 2) : ''; }
  function sost(b) {
    if (!b || typeof b !== 'object') return '';
    var s = b.status;
    if (s === 'polucheno' || s === 'ne_provereno' || !s) s = b.sostoyanie || (s === 'ne_provereno' ? 'not_checked' : '');
    return s;
  }
  // маска сторон: та же, что в js/istochniki.js (если он есть на странице); иначе — свои правила того же смысла
  var RE_IP = /^\s*(ИП|индивидуальный\s+предприниматель)(\s|$)/i;
  var RE_FIO = [/^\s*[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s+[А-ЯЁ]\.\s*(?:[А-ЯЁ]\.?)?\s*$/, /^\s*[А-ЯЁ]\.\s*(?:[А-ЯЁ]\.)?\s*[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s*$/,
    /^\s*(?:[А-ЯЁ][А-ЯЁа-яё-]+\s+){2,3}(?:[А-ЯЁ][А-ЯЁа-яё-]*(?:вич|вна|ична|ВИЧ|ВНА|ИЧНА)|[Оо]глы|[Кк]ызы|ОГЛЫ|КЫЗЫ)\s*$/];
  function storona(v) {
    if (typeof v !== 'string') return '';
    var I = root && root.DlkIstochniki;
    if (I && typeof I.storona === 'function') v = I.storona(v);
    if (RE_IP.test(v)) return 'индивидуальный предприниматель';
    for (var i = 0; i < RE_FIO.length; i++) if (RE_FIO[i].test(v)) return 'физическое лицо';
    return v.replace(/\s+/g, ' ').trim();
  }
  function storony(a) {
    if (typeof a === 'string') a = [a];
    if (!Array.isArray(a)) return '';
    var s = a.map(function (x) { return storona(typeof x === 'string' ? x : x && (x.naimenovanie || x.name) || ''); }).filter(Boolean);
    if (!s.length) return '';
    return s.length > 2 ? s.slice(0, 2).join(', ') + ' и' + NB + 'ещё ' + (s.length - 2) : s.join(', ');
  }
  // ссылка наружу — только на сайты картотек и реестров (kad.arbitr.ru, fssp.gov.ru, zakupki.gov.ru); иное не ставим
  function ssylka(u) { u = String(u || ''); return /^https:\/\/(kad\.arbitr\.ru|fssp\.gov\.ru|zakupki\.gov\.ru)\//.test(u) ? u : ''; }
  var TIP = { 'Г': 'исковое', 'Б': 'о' + NB + 'банкротстве', 'А': 'административное' };
  function ist(b) {
    var s = String((b && b.istochnik) || '').replace(/\s*\(через [^)]*\)\s*$/, ''), d = dmy(b && b.data_svedeniy);
    var cerez = /\(через ([^)]*)\)/.exec(String((b && b.istochnik) || ''));
    return (s || 'реестр') + (cerez ? ' (через ' + cerez[1] + ')' : '') + (d ? ', сведения на' + NB + d : '');
  }

  // ---- Предметы взыскания у приставов — группы. Порядок проверки важен: «Госпошлина» — не налог, а судебные расходы ----
  var GRUPPY = [
    { k: 'nalogi', t: 'Налоги и взносы', re: /налог|взнос|пени|недоимк|ФНС|ИФНС|страхов/i },
    { k: 'zarplata', t: 'Зарплата', re: /заработн|оплат\S* труда|зарплат/i },
    { k: 'shtrafy', t: 'Штрафы', re: /штраф/i },
    { k: 'poshliny', t: 'Госпошлины по суду', re: /пошлин/i },
    { k: 'prochee', t: 'Прочее', re: /.?/ }
  ];
  function gruppa(p) {
    var t = String((p && p.predmet) || '');
    if (/пошлин/i.test(t)) return 'poshliny';
    for (var i = 0; i < GRUPPY.length - 1; i++) if (GRUPPY[i].re.test(t)) return GRUPPY[i].k;
    return p && p.nalog_zarplata === true ? 'nalogi' : 'prochee';
  }

  function sudy(b) {
    var st = sost(b), o = { k: 'sudy', zag: 'Суды', ist: ist(b), sami: ssylka(b && b.proverit_samim) || 'https://kad.arbitr.ru/' };
    if (!b) { o.vid = 'ne'; o.tekst = 'Не проверили: картотека арбитражных дел не ответила.'; return o; }
    if (st === 'not_found') { o.vid = 'pusto'; o.tekst = 'Не нашли дел, где компания — ответчик' + (dmy(b.data_svedeniy) ? ', на' + NB + dmy(b.data_svedeniy) : '') + '.'; return o; }
    if (st !== 'found') { o.vid = 'ne'; o.tekst = st === 'stale' ? 'Сведения устарели' + (dmy(b.data_svedeniy) ? ' (на' + NB + dmy(b.data_svedeniy) + ')' : '') + ' — откройте картотеку сами.' : 'Не проверили: картотека арбитражных дел сегодня не ответила.'; return o; }
    var d = b.dannye || {}, vs = num(d.otvetchik), vsAll = num(d.vsego), nz = num(d.otvetchik_nezaversheno),
      sz = num(d.otvetchik_summa_nezaversheno), sv = num(d.otvetchik_summa_vsego);
    if (vs === null) vs = vsAll;
    o.vid = 'est';
    // слова — правовая сверка 16.11, п. 1: «за всё время» и «на X» шире данных (Checko отдаёт часть списка; сумма исков — не долг)
    var dd = dmy(b.data_svedeniy), naD = dd ? ' на' + NB + dd : '';
    o.kratko = nz !== null ? chislo(nz) + NB + skl(nz, 'незавершённое дело', 'незавершённых дела', 'незавершённых дел') + ', где компания — ответчик' + (nz > 0 && sz > 0 ? ' · требования к' + NB + 'компании — ' + den(sz) : '')
      : (vs !== null ? chislo(vs) + NB + skl(vs, 'дело', 'дела', 'дел') + ' в' + NB + 'картотеке' : 'дела в картотеке');
    o.fakty = [];
    if (vs !== null) o.fakty.push({ t: 'Ответчик — дел в' + NB + 'картотеке' + (dd ? ' (на' + NB + dd + ')' : ''), z: chislo(vs) + (sv > 0 ? '; требования — ' + den(sv) : '') });
    if (nz !== null) o.fakty.push({ t: 'Не завершены' + naD, z: nz > 0 ? chislo(nz) + (sz > 0 ? '; требования — ' + den(sz) : '') : 'не нашли', vnim: nz > 0 });
    var dela = (Array.isArray(d.dela) ? d.dela : []).filter(function (x) { return x && (x.nomer || x.data); }).map(function (x) {
      var s = num(x.summa), pb = String(x.pobeditel || '').trim();
      return {
        nomer: String(x.nomer || 'без номера'), href: ssylka(x.ssylka), data: dmy(x.data), kd: klyuchDaty(x.data),
        istec: storony(x.istcy || x.istec), sud: String(x.sud || '').trim(), tip: TIP[x.tip] || '',
        summa: s > 0 ? den(s) : 'без суммы', idet: x.aktivno === true,
        stadiya: x.aktivno === true ? 'идёт' : x.aktivno === false ? 'завершено' + (pb && !/не\s*определ/i.test(pb) ? ': ' + pb.toLowerCase() : '') : ''
      };
    });
    dela.sort(function (a, b2) { return a.kd < b2.kd ? 1 : a.kd > b2.kd ? -1 : 0; });
    o.spisok = dela;
    var vsego = vs !== null ? vs : dela.length;
    o.pro = dela.length ? (dela.length < vsego ? 'Загружены ' + chislo(dela.length) + ' ' + skl(dela.length, 'последнее', 'последних', 'последних') + ' из' + NB + chislo(vsego) + ' — остальные в' + NB + 'картотеке' : '') : 'Список дел здесь не показан — откройте картотеку.';
    o.ne = 'Не проверяли: дела, где компания истец или третье лицо' + (/общей юрисдикции/i.test(String(b.podzagolovok || '')) ? ', и суды общей юрисдикции' : '') + ' — не проверяли не значит «нет».';
    return o;
  }

  function pristavy(b) {
    var st = sost(b), o = { k: 'fssp', zag: 'Приставы', ist: ist(b), sami: ssylka(b && b.proverit_samim) || 'https://fssp.gov.ru/iss/ip/' };
    if (!b) { o.vid = 'ne'; o.tekst = 'Не проверили: банк данных ФССП не ответил.'; return o; }
    if (st === 'not_found') { o.vid = 'pusto'; o.tekst = 'Не нашли открытых производств' + (dmy(b.data_svedeniy) ? ' на' + NB + dmy(b.data_svedeniy) : '') + '.'; return o; }
    if (st !== 'found') { o.vid = 'ne'; o.tekst = st === 'stale' ? 'Сведения устарели' + (dmy(b.data_svedeniy) ? ' (на' + NB + dmy(b.data_svedeniy) + ')' : '') + ' — откройте банк данных сами.' : 'Не проверили: банк данных ФССП сегодня не ответил.'; return o; }
    var d = b.dannye || {}, ot = num(d.otkryto), zv = num(d.zapisej_vsego), os = num(d.ostatok), n = ot !== null ? ot : zv, tochno = d.ostatok_tochno !== false;
    var pr = (Array.isArray(d.proizvodstva) ? d.proizvodstva : []).filter(function (x) { return x && (x.nomer || x.data); }).map(function (x) {
      var s = num(x.summa), ok = num(x.ostatok);
      return { nomer: String(x.nomer || 'без номера'), data: dmy(x.data), kd: klyuchDaty(x.data), predmet: String(x.predmet || 'предмет не указан').trim(),
        gr: gruppa(x), ostatok: ok !== null ? ok : null, summa: s, otdel: String(x.otdel || '').trim(),
        dolg: ok > 0 ? den(ok) + (s > ok ? ' из' + NB + den(s) : '') : ok === 0 ? 'погашено' + (s > 0 ? ' (' + den(s) + ')' : '') : (s > 0 ? den(s) : 'без суммы') };
    });
    pr.sort(function (a, b2) { return a.kd < b2.kd ? 1 : a.kd > b2.kd ? -1 : 0; });
    o.vid = 'est';
    o.kratko = (n !== null ? chislo(n) + NB + skl(n, 'производство', 'производства', 'производств') : 'производства есть') + (os > 0 ? ' · остаток долга — ' + (tochno ? den(os) : 'не' + NB + 'меньше ' + den(os, true)) : '');
    o.fakty = [];
    if (n !== null) o.fakty.push({ t: 'Открыто производств', z: chislo(n), vnim: n > 0 });
    if (os > 0) o.fakty.push({ t: 'Остаток долга', z: tochno ? den(os) : 'не меньше ' + den(os, true), vnim: true });
    var po = {}, gr = [];
    pr.forEach(function (x) { var g = po[x.gr] || (po[x.gr] = { n: 0, s: 0 }); g.n++; if (x.ostatok > 0) g.s += x.ostatok; });
    GRUPPY.forEach(function (g) { if (po[g.k]) gr.push({ k: g.k, t: g.t, n: po[g.k].n, s: po[g.k].s > 0 ? den(po[g.k].s) : '' }); });
    o.gruppy = gr;
    o.spisok = pr;
    var vsego = n !== null ? n : pr.length;
    o.pro = pr.length ? (pr.length < vsego ? 'Группы и список — по ' + chislo(pr.length) + ' ' + skl(pr.length, 'последнему', 'последним', 'последним') + ' из' + NB + chislo(vsego) + ' производств' : '') + (!tochno && os > 0 ? (pr.length < vsego ? '; остаток' : 'Остаток') + ' посчитан не по всем производствам' : '') : 'Список производств здесь не показан — откройте банк данных.';
    return o;
  }

  // ---- Госконтракты (damia.kontrakty) и РНП (damia.rnp): компания — поставщик ----
  var ZAKON = { '44': 'По 44-ФЗ (госзаказчики)', '223': 'По 223-ФЗ (госкомпании)' };
  function kontrakty(b, rnp, inn) {
    var st = sost(b), rs = sost(rnp), rd = rnp && dmy(rnp.data_svedeniy);
    var o = { k: 'kontrakty', zag: 'Госконтракты', ist: ist(b || rnp),
      sami: /^\d{10}(\d{2})?$/.test(String(inn || '')) ? 'https://zakupki.gov.ru/epz/contract/search/results.html?searchString=' + inn : 'https://zakupki.gov.ru/epz/contract/search/results.html' };
    var rnpN = null;
    if (rs === 'found') { var rdd = rnp.dannye || {}; rnpN = num(rdd.vsego); if (!(rnpN > 0)) rnpN = Array.isArray(rdd.deystvuyushie) && rdd.deystvuyushie.length ? rdd.deystvuyushie.length : null; }
    var rnpFakt = rs === 'found' ? { t: 'Реестр недобросовестных поставщиков', z: (rnpN > 0 ? chislo(rnpN) + NB + skl(rnpN, 'действующая запись', 'действующие записи', 'действующих записей') : 'есть запись') + (rd ? ' на' + NB + rd : ''), vnim: true }
      : rs === 'not_found' ? { t: 'Реестр недобросовестных поставщиков', z: 'нет действующих записей' + (rd ? ' на' + NB + rd : '') }
      // устаревшие (js/istochniki.js ustarevanie: старше 30 дней) — дата и «устарели», не «нет»; без ответа — причина, если сервер её дал
      : rs === 'stale' ? { t: 'Реестр недобросовестных поставщиков', z: rnp.status_do === 'not_found' ? (rd ? 'на' + NB + rd + ' записей не было' : 'записей не было') + ' — сведения устарели' : 'сведения' + (rd ? ' на' + NB + rd : '') + ' устарели' }
      : { t: 'Реестр недобросовестных поставщиков', z: 'не проверено' + (rnp && typeof rnp.prichina === 'string' && rnp.prichina ? ': ' + rnp.prichina : '') };
    if (st !== 'found' && rs !== 'found') {
      if (!b) { o.vid = 'ne'; o.tekst = 'Не проверили: реестр контрактов ЕИС не ответил.'; return o; }
      if (st === 'not_found') { o.vid = 'pusto'; o.tekst = 'Не нашли контрактов, где компания — поставщик' + (dmy(b.data_svedeniy) ? ', на' + NB + dmy(b.data_svedeniy) : '') + (rs === 'not_found' ? '; в РНП записей нет' : '') + '.'; return o; }
      o.vid = 'ne'; o.tekst = st === 'stale' ? 'Сведения устарели' + (dmy(b.data_svedeniy) ? ' (на' + NB + dmy(b.data_svedeniy) + ')' : '') + ' — откройте ЕИС сами.' : 'Не проверили: реестр контрактов ЕИС сегодня не ответил.'; return o;
    }
    var d = (st === 'found' && b.dannye) || {}, vs = st === 'found' ? num(d.vsego) : st === 'not_found' ? 0 : null, pz = d.po_zakonam || {};
    var sp = (Array.isArray(d.poslednie) ? d.poslednie : []).filter(function (x) { return x && (x.nomer || x.data); }).map(function (x) {
      var s = num(x.summa), fz = String(x.fz || '');
      return { nomer: String(x.nomer || 'без номера'), href: ssylka(x.ssylka), data: dmy(x.data), kd: klyuchDaty(x.data),
        zakazchik: storona(x.zakazchik || ''), summa: s > 0 ? den(s) : 'без суммы', fz: fz === '44' || fz === '223' ? fz + '-ФЗ' : '' };
    });
    sp.sort(function (a, b2) { return a.kd < b2.kd ? 1 : a.kd > b2.kd ? -1 : 0; });
    o.vid = 'est';
    o.kratko = (vs !== null ? chislo(vs) + NB + skl(vs, 'контракт или договор', 'контракта и договора', 'контрактов и договоров') + ' как поставщик' : 'контракты есть')
      + (rs === 'found' ? ' · есть запись в' + NB + 'реестре недобросовестных поставщиков' + (rd ? ' на' + NB + rd : '') : '');
    o.fakty = [];
    ['44', '223'].forEach(function (z) { var n = pz[z] && num(pz[z].vsego); if (n !== null && n !== undefined) o.fakty.push({ t: ZAKON[z], z: chislo(n) }); });
    if (!o.fakty.length && vs !== null) o.fakty.push({ t: 'Контрактов и договоров', z: chislo(vs) });
    if (num(d.summa) > 0 && d.summa_ohvat === 'vse') o.fakty.push({ t: 'Сумма всех', z: den(num(d.summa)) });
    if (sp.length && sp[0].data) o.fakty.push({ t: 'Последний контракт', z: sp[0].data });
    o.fakty.push(rnpFakt);
    // заказчики — только по загруженным, с подписью «по N последним»; без названия в группу не идёт
    var po = {}, por = [];
    sp.forEach(function (x) { var z = x.zakazchik; if (!z) return; if (!po[z]) { po[z] = 0; por.push(z); } po[z]++; });
    // показываем, только если есть повторяющийся заказчик (сосредоточенность), и не больше трёх — иначе это шум из разовых
    o.gruppy = por.some(function (z) { return po[z] > 1; }) ? por.map(function (z, i) { return { k: 'z' + i, t: z, n: po[z], s: '' }; }).sort(function (a, b2) { return b2.n - a.n; }).slice(0, 3) : [];
    o.gruppyZag = 'Заказчики — по' + NB + chislo(sp.length) + ' ' + skl(sp.length, 'последнему', 'последним', 'последним');
    o.spisok = sp;
    var vsego = vs !== null ? vs : sp.length;
    o.pro = sp.length ? (sp.length < vsego ? 'Загружены ' + chislo(sp.length) + ' ' + skl(sp.length, 'последний', 'последних', 'последних') + ' из' + NB + chislo(vsego) + ' — остальные в' + NB + 'ЕИС' : '')
      : (vsego > 0 ? 'Список контрактов здесь не показан — откройте ЕИС' : '');
    o.ne = 'Не проверяли: закупки, где компания — заказчик, и как исполнены контракты (расторжения, неустойки) — не проверяли не значит «нет».';
    return o;
  }

  function sobrat(r) {
    if (!r || !r.company) return null;
    var dm = r.damia || {}, blk = function (k) { var b = dm[k]; return b && typeof b === 'object' && b.nazvanie ? b : null; };
    var S = blk('sudy'), F = blk('fssp'), K = blk('kontrakty'), R = blk('rnp');
    if (!S && !F && !K && !R) return null;
    var a = [sudy(S), pristavy(F)];
    if (K || R) a.push(kontrakty(K, R, r.company.inn));
    return { razdely: a };
  }

  function strokaDela(x) {
    return '<li class="dl__s">' +
      '<div class="dl__s1">' + (x.href ? '<a href="' + esc(x.href) + '" target="_blank" rel="noopener nofollow">' + esc(x.nomer) + '</a>' : '<b>' + esc(x.nomer) + '</b>') +
        (x.data ? '<span class="dl__d">' + esc(x.data) + '</span>' : '') + '<span class="dl__sum">' + esc(x.summa) + '</span></div>' +
      '<div class="dl__s2">' + (x.istec ? 'Истец: ' + esc(x.istec) : 'Истец не указан') + (x.sud ? ' · ' + esc(x.sud) : '') + (x.tip ? ' · ' + esc(x.tip) : '') +
        (x.stadiya ? ' · <span class="dl__st' + (x.idet ? ' dl__st--idet' : '') + '">' + esc(x.stadiya) + '</span>' : '') + '</div></li>';
  }
  function strokaIp(x) {
    return '<li class="dl__s">' +
      '<div class="dl__s1"><b>' + esc(x.nomer) + '</b>' + (x.data ? '<span class="dl__d">' + esc(x.data) + '</span>' : '') + '<span class="dl__sum">' + esc(x.dolg) + '</span></div>' +
      '<div class="dl__s2">' + esc(x.predmet) + (x.otdel ? ' · ' + esc(x.otdel) : '') + '</div></li>';
  }
  function strokaKontrakta(x) {
    return '<li class="dl__s">' +
      '<div class="dl__s1">' + (x.href ? '<a href="' + esc(x.href) + '" target="_blank" rel="noopener nofollow">' + esc(x.nomer) + '</a>' : '<b>' + esc(x.nomer) + '</b>') +
        (x.data ? '<span class="dl__d">' + esc(x.data) + '</span>' : '') + '<span class="dl__sum">' + esc(x.summa) + '</span></div>' +
      '<div class="dl__s2">' + (x.zakazchik ? 'Заказчик: ' + esc(x.zakazchik) : 'Заказчик не указан') + (x.fz ? ' · ' + esc(x.fz) : '') + '</div></li>';
  }
  function spisok(o) {
    var f = o.k === 'sudy' ? strokaDela : o.k === 'kontrakty' ? strokaKontrakta : strokaIp, a = o.spisok || [];
    if (!a.length) return '';
    var h = '<ol class="dl__l">' + a.slice(0, POKAZ).map(f).join('') + '</ol>';
    if (a.length > POKAZ) h += '<details class="dl__eshche"><summary>Показать все загруженные (' + chislo(a.length) + ')</summary><ol class="dl__l" start="' + (POKAZ + 1) + '">' + a.slice(POKAZ).map(f).join('') + '</ol></details>';
    return h;
  }
  function razdel(o) {
    if (o.vid !== 'est') {
      return '<div class="dl__r dl__r--' + o.vid + '" data-dl="' + o.k + '"><div class="dl__sm"><span class="dl__z">' + o.zag + '</span><span class="dl__k">' + esc(o.tekst) + '</span></div>' +
        '<p class="dl__i">' + esc(o.ist) + ' · <a href="' + esc(o.sami) + '" target="_blank" rel="noopener nofollow">проверить самим</a></p></div>';
    }
    var h = '<details class="dl__r dl__r--est" data-dl="' + o.k + '"><summary class="dl__sm"><span class="dl__z">' + o.zag + '</span><span class="dl__k">' + esc(o.kratko) + '</span></summary><div class="dl__t">';
    if (o.fakty.length) h += '<dl class="dl__f">' + o.fakty.map(function (f) { return '<div' + (f.vnim ? ' class="dl__f--vnim"' : '') + '><dt>' + esc(f.t) + '</dt><dd>' + esc(f.z) + '</dd></div>'; }).join('') + '</dl>';
    if (o.gruppy && o.gruppy.length) h += '<p class="dl__gh">' + esc(o.gruppyZag || 'Что взыскивают') + '</p><ul class="dl__g">' + o.gruppy.map(function (g) { return '<li data-gr="' + g.k + '"><span>' + esc(g.t) + '</span><b>' + chislo(g.n) + '</b>' + (g.s ? '<small>' + esc(g.s) + '</small>' : '') + '</li>'; }).join('') + '</ul>';
    if (o.spisok.length) h += '<p class="dl__gh">' + (o.k === 'sudy' ? 'Последние дела' : o.k === 'kontrakty' ? 'Последние контракты' : 'Последние производства') + '</p>' + spisok(o);
    if (o.pro) h += '<p class="dl__p">' + esc(o.pro) + '.</p>';
    if (o.ne) h += '<p class="dl__p dl__p--ne">' + esc(o.ne) + '</p>';
    h += '<p class="dl__i">' + esc(o.ist) + ' · <a href="' + esc(o.sami) + '" target="_blank" rel="noopener nofollow">' + (o.k === 'sudy' ? 'открыть картотеку' : o.k === 'kontrakty' ? 'открыть ЕИС' : 'открыть банк данных ФССП') + '</a></p></div></details>';
    return h;
  }
  function html(m) {
    if (!m || !m.razdely || !m.razdely.length) return '';
    var zag = m.razdely.some(function (o) { return o.k === 'kontrakty'; }) ? 'Суды, приставы, госконтракты — подробно' : 'Суды и приставы — подробно';
    return '<section class="dl" aria-labelledby="dl-h"><h3 class="dl__h" id="dl-h">' + zag + '</h3>' + m.razdely.map(razdel).join('') + '</section>';
  }

  var CSS =
    '.dl{margin:0 0 20px}' +
    '.dl__h{margin:0 0 10px;font-size:15px;line-height:1.4;font-weight:600;color:var(--ink-2,#3A4868)}' +
    '.dl__r{margin:0 0 8px;border:1px solid var(--line,#E3DDCD);border-radius:10px;background:var(--card,#fff)}' +
    '.dl__r--ne{border-style:dashed}' +
    '.dl .dl__r>.dl__sm{display:flex;gap:12px;align-items:baseline;text-align:left;padding:12px 14px;list-style:none;cursor:default}' +
    'summary.dl__sm{cursor:pointer}' +
    'summary.dl__sm::-webkit-details-marker{display:none}' +
    'summary.dl__sm::after{content:"";margin-left:auto;flex:none;width:8px;height:8px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:translateY(-2px) rotate(45deg);transition:transform .2s;opacity:.6}' +
    'details[open]>summary.dl__sm::after{transform:translateY(2px) rotate(-135deg)}' +
    'summary.dl__sm:focus-visible{outline:2px solid var(--mat-fokus,#A07A28);outline-offset:2px;border-radius:10px}' +
    '.dl__z{flex:none;min-width:84px;font-size:15px;font-weight:600}' +
    '.dl__k{font-size:15px;line-height:1.4;color:var(--ink-2,#3A4868);font-variant-numeric:tabular-nums}' +
    '.dl__r--ne .dl__k,.dl__r--pusto .dl__k{color:var(--muted,#5B6783)}' +
    '.dl__r--ne .dl__i,.dl__r--pusto .dl__i{margin:0;padding:0 14px 12px}' +
    '.dl__t{padding:0 14px 12px}' +
    '.dl__f{margin:0 0 10px;display:flex;flex-wrap:wrap;gap:6px 24px}' +
    '.dl__f div{min-width:0}' +
    '.dl__f dt{font-size:12px;color:var(--muted,#5B6783)}' +
    '.dl__f dd{margin:0;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}' +
    '.dl__f--vnim dd{box-shadow:inset 0 -2px 0 var(--mat-zhdu,#7A5C14)}' +
    '.dl__gh{margin:12px 0 6px;font-size:13px;font-weight:600;color:var(--ink-2,#3A4868)}' +
    '.dl__g{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}' +
    '.dl__g li{display:flex;gap:6px;align-items:baseline;padding:4px 10px;border:1px solid var(--line,#E3DDCD);border-radius:999px;font-size:13px}' +
    '.dl__g b{font-variant-numeric:tabular-nums}' +
    '.dl__g small{font-size:12px;color:var(--muted,#5B6783)}' +
    '.dl__l{margin:0;padding:0;list-style:none}' +
    '.dl__s{padding:8px 0;border-top:1px solid var(--line,#E3DDCD)}' +
    '.dl__s1{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;font-size:15px}' +
    '.dl__s1 a{font-weight:600}' +
    '.dl__d{font-size:13px;color:var(--muted,#5B6783);font-variant-numeric:tabular-nums}' +
    '.dl__sum{margin-left:auto;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.dl__s2{margin-top:2px;font-size:13px;line-height:1.4;color:var(--ink-2,#3A4868);overflow-wrap:anywhere}' +
    '.dl__st--idet{color:var(--mat-zhdu,#7A5C14);font-weight:600}' +
    '.dl__eshche>summary{margin:6px 0;font-size:13px;cursor:pointer;color:var(--accent,#1F3A8A)}' +
    '.dl__p{margin:8px 0 0;font-size:13px;line-height:1.4;color:var(--muted,#5B6783)}' +
    '.dl__i{margin:8px 0 0;font-size:12px;line-height:1.4;color:var(--muted,#5B6783)}' +
    '[data-theme=dark] .dl__f--vnim dd{box-shadow:inset 0 -2px 0 var(--mat-zhdu-t,#D9B45A)}' +
    '[data-theme=dark] .dl__st--idet{color:var(--mat-zhdu-t,#D9B45A)}' +
    '[data-theme=dark] summary.dl__sm:focus-visible{outline-color:var(--mat-fokus-t,#D9B45A)}' +
    '@media (prefers-reduced-motion:reduce){summary.dl__sm::after{transition:none}}' +
    '@media (max-width:640px){.dl .dl__r>.dl__sm{flex-direction:column;align-items:flex-start;gap:2px;padding:10px 12px;position:relative;padding-right:32px}.dl__k{min-width:0;max-width:100%}summary.dl__sm::after{position:absolute;right:14px;top:16px}.dl__t{padding:0 12px 10px}.dl__z{min-width:0}.dl__k{font-size:13px}.dl__r--ne .dl__i,.dl__r--pusto .dl__i{padding:0 12px 10px}}' +
    '@media print{.dl{break-inside:avoid}.dl__r{border-color:#ccc}}';

  function stil(doc) {
    if (!doc || doc.getElementById('dl-css')) return;
    var s = doc.createElement('style'); s.id = 'dl-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // mount(report, r) — сразу под плитками (.pl), иначе под «Плюсами и минусами» (.pm), иначе первым в .ot-main
  function mount(report, r) {
    if (!report) return null;
    var star = report.querySelector('.dl'), h = html(sobrat(r));
    if (!h) { if (star && star.parentNode) star.parentNode.removeChild(star); return null; }
    var doc = report.ownerDocument, t = doc.createElement('div');
    t.innerHTML = h;
    var nov = t.firstChild;
    try { stil(doc); } catch (e) {}
    if (star && star.parentNode) star.parentNode.replaceChild(nov, star);
    else {
      var main = report.querySelector('.ot-main');
      if (!main) return null;
      var pered = main.querySelector('.pl') || main.querySelector('.pm');
      if (pered && pered.parentNode === main) main.insertBefore(nov, pered.nextSibling);
      else main.insertBefore(nov, main.firstChild);
    }
    Array.prototype.forEach.call(nov.querySelectorAll('details.dl__r'), function (d) {
      d.addEventListener('toggle', function () { try { if (d.open && self.dlkGoal) self.dlkGoal('dela_otkryt', { k: d.getAttribute('data-dl') }); } catch (e) {} });
    });
    return nov;
  }

  return { sobrat: sobrat, html: html, mount: mount, stil: stil, gruppa: gruppa, storona: storona, CSS: CSS, POKAZ: POKAZ };
});
