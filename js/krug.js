/* Делоскоп — «Кто рядом»: круг компании через людей (krug-v1, 13.11.2026; решение команды 13.11 «связи через людей»,
 * экран — [команда] 13.11 п. 2, слова — [команда] ✎ 9 и ✎ 11 от 13.11).
 * Что: организации с тем же руководителем, участником или учредителем-организацией — по ИНН из ЕГРЮЛ (не по имени).
 * Данные — GET /api/krug?inn=<ИНН организации> (api-krug-v1): в ответе нет ни ФИО, ни ИНН людей — и здесь их нет.
 * Где: экран проверки по ИНН, только организации; не ИП, не «своя компания» (режим «проверить себя» — отдельный шаг),
 * не карточки /company/. Сразу после «Существенных фактов», перед «Все данные из реестров».
 * Честно: «рядом никого» — только когда сервер сверял весь ЕГРЮЛ; сверял часть — так и пишем; нет ответа — «не проверили».
 * Долги и суды организаций круга сервер пока отдаёт только сводкой, без привязки к строке, — в строках их не пишем.
 * Прекращённые — только за последние 3 года (✎ 9 п. 2), способ — словами ЕГРЮЛ, без оценки человека.
 * Слова-квалификации (ст. 105.1 и 54.1 НК, ст. 152 ГК) не используем — список сторожит tests/krug.test.js.
 * Цели Метрики: krug_view {sost, n}, krug_perehod {status} — без ИНН и названий.
 * Выключатель — VKL (false — блока нет, запроса нет). */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkKrug = api;
})(typeof self !== 'undefined' ? self : this, function (W) {
  'use strict';
  var VKL = true;
  var NB = ' ';
  var POKAZAT = 5, MAKS = 25, SROK_LET = 3, ZHDAT_MS = 9000;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function skl(n, a, b, c) { var m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; }
  function data(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  // ровно одна пара прямых кавычек → «ёлочки» (как в строке поиска); есть DlkImya — его правило с вложенными
  function imya(n) {
    var I = W && W.DlkImya;
    if (I && I.kavychki) { try { return I.kavychki(String(n || '')); } catch (e) {} }
    n = String(n == null ? '' : n);
    return (n.match(/"/g) || []).length === 2 ? n.replace(/"([^"]+)"/, '«$1»') : n;
  }

  // Состояние — словами ЕГРЮЛ (✎ 9 п. 3); тёплая метка — ликвидация и банкротство
  var ST = { LIQUIDATING: 'ликвидируется', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' };
  var WARN = { LIQUIDATING: 1, LIQUIDATED: 1, BANKRUPT: 1 };
  var SVYAZ = { rukovoditel: 'тот же руководитель', uchastnik: 'общий участник', uchreditel_org: 'через учредителя-организацию' };

  var T = {
    zag: 'Кто рядом',
    pod: 'Организации с тем же руководителем, участником или учредителем-организацией. Связь' + NB + '— по ИНН из ЕГРЮЛ, не по совпадению имени.',
    zhdem: 'Собираем связи по ЕГРЮЛ…',
    oshibka: 'Связи не проверили' + NB + '— источник не ответил. Это не значит, что их нет.',
    netVBaze: 'Связи не проверили' + NB + '— этой организации ещё нет в нашей базе связей. Это не значит, что их нет.',
    ao: 'Акционеров в ЕГРЮЛ нет' + NB + '— у акционерного общества видим только руководителя.',
    dolgi: 'Суды и долги у приставов организаций рядом здесь не проверяем' + NB + '— откройте нужную, отчёт по ней покажет.',
    isklyuchena: 'Если эта фирма вам должна, долг можно попробовать взыскать с её руководителя или участников через суд. Срок считают с момента, когда вы узнали о прекращении фирмы.',
    deystvie: 'откройте организацию с меткой' + NB + '— в её отчёте проверим суды, приставов и банкротство.', // [команда] 13.11 18:40 п. 3.2: «покажет» обещал ответ источника
    ogovorka: 'Общий руководитель или участник не означает общего бизнеса, контроля или нарушений.'
  };

  function prekrashchena(o) { return o.status === 'LIQUIDATED' || !!o.god_po; }

  // raschet(j, segodnya) → модель блока. j — ответ /api/krug; null/не объект — «не проверили»
  function raschet(j, segodnya) {
    var god = (segodnya || new Date()).getFullYear();
    if (!j || typeof j !== 'object' || !Array.isArray(j.organizacii)) return { sost: 'oshibka', stroki: [], eshche: [] };
    var ogr = Array.isArray(j.ogranicheniya) ? j.ogranicheniya.map(String) : [];
    var sv = j.svodka || {}, nd = j.na_daty || {};
    var polno = sv.polnota ? sv.polnota === 'polno' : !ogr.some(function (x) { return /только организации/i.test(x); });
    var o = {
      sost: 'est', stroki: [], eshche: [], polno: polno,
      podpis: String(j.podpis || ''), ao: ogr.some(function (x) { return /акционер/i.test(x); }),
      egrul: data(nd.egrul || j.data_svedenij), krug: data(nd.krug),
      isklyucheny: Math.max(0, Math.round(Number(sv.isklyucheny_nedejstvuyushchie) || 0))
    };
    var seen = {};
    var a = j.organizacii.filter(function (x) {
      if (!x || !/^\d{10}$/.test(String(x.inn || '')) || seen[x.inn]) return false; // только организации; люди и ИП — никогда
      seen[x.inn] = 1;
      // прекращённые — только за 3 года (✎ 9 п. 2); без года прекращения — не показываем, не угадываем
      if (prekrashchena(x)) return Number(x.god_po) > 0 && god - Number(x.god_po) <= SROK_LET;
      return true;
    });
    // порядок (ТЗ api-krug-v1): ликвидация и банкротство → прекращённые за 3 года → действующие → прочие; внутри — порядок сервера
    function ves(x) { return x.status === 'BANKRUPT' || x.status === 'LIQUIDATING' ? 0 : prekrashchena(x) ? 1 : x.status === 'ACTIVE' ? 2 : 3; }
    a = a.map(function (x, i) { return [ves(x), i, x]; }).sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; })
      .map(function (p) { return p[2]; }).slice(0, MAKS);
    if (!a.length) {
      o.sost = ogr.some(function (x) { return /нет в базе/i.test(x); }) ? 'net_v_baze' : polno ? 'pusto' : 'pusto_chast';
      return o;
    }
    var schet = { dejstvuyut: 0, trevoga: 0, prekrashcheny: 0, prochie: 0 };
    var stroki = a.map(function (x) {
      var svz = (Array.isArray(x.svyaz) ? x.svyaz : [x.svyaz]).map(function (s) { return SVYAZ[s]; }).filter(Boolean);
      var dolya = x.svyaz && String(x.svyaz).indexOf('uchastnik') >= 0 && Number(x.dolya_pct) > 0 && Number(x.dolya_pct) <= 100 ? Number(x.dolya_pct) : null;
      var c = [];
      if (x.gorod) c.push(String(x.gorod));
      var pr = prekrashchena(x);
      if (x.god_s && !pr) c.push('с' + NB + x.god_s); // у прекращённой годы скажет строка «ликвидирована в … г.»
      if (pr) {
        var kto = svz[0] === SVYAZ.rukovoditel ? 'руководителем' : svz[0] === SVYAZ.uchastnik ? 'участником' : '';
        c.push((ST[x.status] || 'прекращена') + ' в' + NB + x.god_po + NB + 'г.');
        if (kto) c.push('на дату прекращения ' + kto + ' был тот же человек (ЕГРЮЛ)');
        else if (svz.length) c.push(svz.join(', '));
      } else if (svz.length) c.push(svz.join(', ') + (dolya ? ', доля ' + String(dolya).replace('.', ',') + NB + '%' : ''));
      if (x.obshchij_adres) c.push('тот же адрес');
      if (x.obshchij_okved) c.push('тот же вид деятельности');
      if (x.status === 'ACTIVE' && !pr) schet.dejstvuyut++;
      else if (pr) schet.prekrashcheny++;
      else if (WARN[x.status]) schet.trevoga++;
      else schet.prochie++;
      return { inn: String(x.inn), t: imya(x.name), s: c.join(NB + '· '), tag: pr ? '' : (ST[x.status] || ''), warn: !!WARN[x.status] && !pr, status: String(x.status || ''), pr: pr };
    });
    o.stroki = stroki.slice(0, POKAZAT);
    o.eshche = stroki.slice(POKAZAT);
    o.n = stroki.length;
    o.vsego = Math.max(Number(sv.vsego) || 0, stroki.length);
    o.schet = schet;
    o.svodka = svodka(o);
    o.dejstvie = schet.trevoga > 0;
    return o;
  }

  // «Рядом 5 организаций: 3 действуют, 1 в банкротстве, 1 прекращена за 3 года» (✎ 9 п. 5, без оценки человека)
  function svodka(o) {
    var s = o.schet, ch = [];
    if (s.dejstvuyut) ch.push(s.dejstvuyut + ' ' + skl(s.dejstvuyut, 'действует', 'действуют', 'действуют'));
    if (s.trevoga) ch.push(s.trevoga + ' ' + skl(s.trevoga, 'ликвидируется или в банкротстве', 'ликвидируются или в банкротстве', 'ликвидируются или в банкротстве'));
    var isk = Math.min(o.isklyucheny || 0, s.prekrashcheny);
    if (s.prekrashcheny) ch.push(s.prekrashcheny + ' ' + skl(s.prekrashcheny, 'прекращена', 'прекращены', 'прекращены') + ' за' + NB + SROK_LET + NB + 'года' +
      (isk ? ' (' + (isk === 1 ? 'одна' : isk) + ' ' + skl(isk, 'исключена налоговой как недействующая', 'исключены налоговой как недействующие', 'исключены налоговой как недействующие') + ')' : ''));
    if (s.prochie) ch.push(s.prochie + ' ' + skl(s.prochie, 'в реорганизации или другом состоянии', 'в реорганизации или другом состоянии', 'в реорганизации или другом состоянии'));
    var n = o.n;
    return 'Рядом ' + n + NB + skl(n, 'организация', 'организации', 'организаций') + (ch.length ? ': ' + ch.join(', ') : '') + '.';
  }

  var CSS = '.krug{display:grid;gap:12px;padding:20px 22px;border-radius:16px;border:1px solid var(--line,#E6E6E1);background:var(--surface,transparent);margin:16px 0 0}' +
    '.krug__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px}.krug__h h2{margin:0;font-size:20px;font-weight:600;letter-spacing:-.01em}' +
    '.krug__h span{font-size:13px;color:var(--muted,#66666B)}.krug p{margin:0}' +
    '.krug__pod{font-size:13px;line-height:1.5;color:var(--muted,#66666B);max-width:640px}' +
    '.krug__sv{font-size:17px;line-height:1.45;font-weight:600;letter-spacing:-.005em}' +
    '.krug__zh{font-size:15px;color:var(--muted,#66666B)}' +
    '.krug__ne{font-size:15px;line-height:1.5}' +
    '.krug__act{font-size:15px;line-height:1.5;padding:10px 14px;border-radius:10px;background:var(--surface-2,#F2F2EE)}.krug__act b{font-weight:600}' +
    '.krug__sp{list-style:none;margin:0;padding:0;border-top:1px solid var(--line,#E6E6E1)}' +
    '.krug__sp li{border-bottom:1px solid var(--line,#E6E6E1)}' +
    '.krug__sp a{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:baseline;gap:2px 12px;padding:10px 0;color:inherit;text-decoration:none}' +
    '.krug__sp a:hover .krug__t,.krug__sp a:focus-visible .krug__t{text-decoration:underline;text-underline-offset:3px}' +
    '.krug__sp a:focus-visible{outline:2px solid var(--accent,#0A84FF);outline-offset:2px;border-radius:10px}' +
    '.krug__t{font-size:15px;line-height:1.4;overflow-wrap:anywhere}' +
    '.krug__s{grid-column:1/-1;font-size:13px;line-height:1.45;color:var(--muted,#66666B);overflow-wrap:anywhere}' +
    '.krug__m{font-size:12px;line-height:1.3;padding:2px 8px;border-radius:999px;background:var(--surface-2,#F2F2EE);color:var(--ink-2,#3A3A3F);white-space:nowrap}' +
    '.krug__m--w{background:var(--warn-bg,#FFF4E5);color:var(--warn,#B25E00)}' +
    '.krug__pr .krug__t{color:var(--ink-2,#3A3A3F)}' +
    '.krug__e>summary{cursor:pointer;list-style:none;font-size:15px;padding:10px 0;color:var(--accent,#0A84FF)}.krug__e>summary::-webkit-details-marker{display:none}' +
    '.krug__e[open]>summary{display:none}.krug__e .krug__sp{border-top:0}' +
    '.krug__og{font-size:12px;line-height:1.5;color:var(--muted,#66666B)}' +
    '@media (max-width:520px){.krug{padding:16px}.krug__sv{font-size:15px}}' +
    '@media print{.krug{break-inside:avoid;border-color:#ccc}.krug__e>summary{display:none}.krug__e:not([open])>*{display:block}}';

  function stroka(x) {
    return '<li' + (x.pr ? ' class="krug__pr"' : '') + '><a href="/?inn=' + esc(x.inn) + '" data-krug-status="' + esc(x.status.toLowerCase()) + '">' +
      '<span class="krug__t">' + esc(x.t) + '</span>' +
      (x.tag ? '<span class="krug__m' + (x.warn ? ' krug__m--w' : '') + '">' + esc(x.tag) + '</span>' : '<span></span>') +
      (x.s ? '<span class="krug__s">' + esc(x.s) + '</span>' : '') + '</a></li>';
  }

  function html(o) {
    if (!o) return '';
    var telo;
    if (o.sost === 'zhdem') telo = '<p class="krug__zh" role="status">' + esc(T.zhdem) + '</p>';
    else if (o.sost === 'oshibka') telo = '<p class="krug__ne">' + esc(T.oshibka) + '</p>';
    else if (o.sost === 'net_v_baze') telo = '<p class="krug__ne">' + esc(T.netVBaze) + '</p>';
    else if (o.sost === 'pusto') telo = '<p class="krug__ne">Рядом никого: руководитель и участники не связаны с другими организациями по ЕГРЮЛ' + (o.egrul ? ' на ' + esc(o.egrul) : '') + '.</p>';
    else if (o.sost === 'pusto_chast') telo = '<p class="krug__ne">Рядом никого не нашли, но сверили не весь ЕГРЮЛ' + (o.podpis ? ', а ' + esc(o.podpis.replace(/^по\s+/, 'только по ')) : '') + '. Это не значит, что связей нет.</p>';
    else {
      telo = '<p class="krug__sv">' + esc(o.svodka) + '</p>' +
        (o.vsego > o.n && o.n >= MAKS ? '<p class="krug__pod">Показываем ' + o.n + ' из ' + o.vsego + '.</p>' : '') +
        (o.dejstvie ? '<p class="krug__act"><b>Что сделать:</b> ' + esc(T.deystvie) + '</p>' : '') +
        (o.isklyucheny && o.schet.prekrashcheny ? '<p class="krug__act"><b>Про фирму, исключённую налоговой:</b> ' + esc(T.isklyuchena) + '</p>' : '') +
        '<ul class="krug__sp">' + o.stroki.map(stroka).join('') + '</ul>' +
        (o.eshche.length ? '<details class="krug__e"><summary>Ещё ' + o.eshche.length + NB + skl(o.eshche.length, 'организация', 'организации', 'организаций') + '</summary><ul class="krug__sp">' + o.eshche.map(stroka).join('') + '</ul></details>' : '') +
        (!o.polno && o.podpis ? '<p class="krug__pod">Сверили ' + esc(o.podpis.replace(/^по\s+/, 'по ')) + ', не весь ЕГРЮЛ.</p>' : '') +
        '<p class="krug__pod">' + esc(T.dolgi) + '</p>';
    }
    var est = o.sost === 'est' || o.sost === 'pusto' || o.sost === 'pusto_chast';
    var podval = est ? '<p class="krug__og">Источник: ЕГРЮЛ' + (o.egrul ? ', на ' + esc(o.egrul) : '') + (o.krug ? '; связи собраны ' + esc(o.krug) : '') + '. ' +
      (o.ao ? esc(T.ao) + ' ' : '') + esc(T.ogovorka) + '</p>' : '';
    return '<section class="krug" aria-labelledby="krug-h" data-krug="' + esc(o.sost) + '">' +
      '<div class="krug__h"><h2 id="krug-h">' + esc(T.zag) + '</h2><span>связи через руководителя и участников</span></div>' +
      '<p class="krug__pod">' + esc(T.pod) + '</p>' + telo + podval + '</section>';
  }

  function stil(doc) {
    if (!doc || doc.getElementById('krug-css')) return;
    var s = doc.createElement('style'); s.id = 'krug-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  function organizaciya(r) {
    var c = (r && r.company) || {}, inn = String(c.inn || '').replace(/\D/g, '');
    return c.kind !== 'INDIVIDUAL' && /^\d{10}$/.test(inn) ? inn : '';
  }

  // Куда: перед «Все данные из реестров» (после «Существенных фактов»); нет — в конец основной колонки листа
  function vstavit(report, h) {
    var doc = report.ownerDocument, t = doc.createElement('div');
    t.innerHTML = h;
    var nov = t.firstChild, star = report.querySelector('.krug');
    if (star && star.parentNode) { star.parentNode.replaceChild(nov, star); return nov; }
    var g = report.querySelector('.sut__g'), main = report.querySelector('.ot-main'), sig = report.querySelector('table.sig');
    if (g && g.parentNode) g.parentNode.insertBefore(nov, g);
    else if (main) main.appendChild(nov);
    else if (sig && sig.parentNode) sig.parentNode.insertBefore(nov, sig.nextSibling);
    else return null;
    return nov;
  }

  function cel(imya, p) { if (W && W.dlkGoal) { try { W.dlkGoal(imya, p); } catch (e) {} } }

  function zagruzit(api, inn, fetchFn) {
    if (!fetchFn) return Promise.resolve(null);
    var u = (api || '') + '/api/krug?inn=' + encodeURIComponent(inn);
    var tajmer, stop = new Promise(function (res) { tajmer = setTimeout(function () { res(null); }, ZHDAT_MS); });
    var zapros = fetchFn(u, { credentials: 'include' }).then(function (x) { return x && x.ok ? x.json() : null; }).catch(function () { return null; });
    return Promise.race([zapros, stop]).then(function (j) { clearTimeout(tajmer); return j; });
  }

  // mount(report, r, {api, fetch, vkl, segodnya}) → Promise<модель|null>. Повторная проверка заменяет блок; ИП, «своя» — блока нет.
  function mount(report, r, opts) {
    opts = opts || {};
    var star = report && report.querySelector && report.querySelector('.krug');
    var inn = organizaciya(r), vkl = opts.vkl === undefined ? VKL : opts.vkl;
    if (!report || !inn || !vkl) { if (star && star.parentNode) star.parentNode.removeChild(star); return Promise.resolve(null); }
    var metka = {}; report.__krug = metka;
    try { stil(report.ownerDocument); } catch (e) {}
    vstavit(report, html({ sost: 'zhdem' }));
    var f = opts.fetch || (W && W.fetch ? W.fetch.bind(W) : null);
    return zagruzit(opts.api, inn, f).then(function (j) {
      if (report.__krug !== metka) return null;
      var o = raschet(j, opts.segodnya);
      var el = vstavit(report, html(o));
      if (el) el.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a[data-krug-status]') : null;
        if (a) cel('krug_perehod', { status: a.getAttribute('data-krug-status') });
      });
      cel('krug_view', { sost: o.sost, n: o.n ? (o.n > 10 ? '11+' : String(o.n)) : '0' });
      return o;
    });
  }

  return { VKL: VKL, T: T, ST: ST, SVYAZ: SVYAZ, raschet: raschet, svodka: svodka, html: html, mount: mount, vstavit: vstavit, zagruzit: zagruzit, organizaciya: organizaciya, CSS: CSS };
});
