/*!
 * Делоскоп · Экран результата «4 вопроса» в отчёте о контрагенте (report.html) — ekran-4-voprosa-v1.
 * Задание команды 30.10 (макет «4 вопроса»): экран отвечает на четыре вопроса —
 *   1. Что это значит для сделки — вывод одной строкой и строка аванса в трёх состояниях (cap > 0 / 0 / не считаем);
 *   2. Насколько полна проверка  — «Проверено N из M групп источников», сразу под строкой аванса, не сворачивается;
 *   3. Что сделать до оплаты     — одна главная кнопка (документы из правил вывода) и две второстепенные;
 *   4. Что нашли                 — у каждого факта источник и дата: ▲ сигнал → ● подтверждено → ○ неизвестно.
 * Правила (держит tests/ekran_4_voprosa.test.js):
 *   • «неизвестно» (stale, not_connected, error, n_a, user) — нейтральный цвет и пунктир; классов warn/bad/high у него нет;
 *   • ▲ только у строки, для которой правила знают код признака (Usloviya.signalId → id);
 *   • устаревшее найденное (иски на 12.10) не прячем: строка «○ данные устарели» несёт текст блока с найденным;
 *   • группы источников — реестр data/istochniki.json (копия ниже сверяется тестом), без «Группы риска Банка России»:
 *     это не источник сведений о компании, его видит только банк; не применимое (ГИР БО у ИП) в M не входит;
 *   • вывод и аванс — те же Usloviya.decide, что в «Условиях сделки» ниже, с версией правила и датой.
 * Чистые функции — без DOM и сети; mount() — тонкая обвязка для страницы.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChetyreVoprosa = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var NB = ' ';

  // Копия реестра (id, название, где проверить самим, через сколько дней устаревает, блоки ответа) — tests сверяют с JSON
  var GRUPPY = [
    { id: 'egrul', nazv: 'ЕГРЮЛ и ЕГРИП', sam: 'https://egrul.nalog.ru/', ustarelo_dney: 7 },
    { id: 'fns_open', nazv: 'Открытые данные ФНС', sam: 'https://www.nalog.gov.ru/opendata/', ustarelo_dney: 62 },
    { id: 'girbo', nazv: 'Бухотчётность ГИР БО', sam: 'https://bo.nalog.gov.ru/', ustarelo_dney: null },
    { id: 'kad', nazv: 'Картотека арбитражных дел', sam: 'https://kad.arbitr.ru/', damia: ['sudy', 'bankrotstvo'] },
    { id: 'fssp', nazv: 'ФССП', sam: 'https://fssp.gov.ru/iss/ip', damia: ['fssp'] },
    { id: 'eis', nazv: 'ЕИС: РНП и контракты', sam: 'https://zakupki.gov.ru/', damia: ['rnp', 'kontrakty'] },
    { id: 'efrsb', nazv: 'Федресурс и ЕФРСБ', sam: 'https://bankrot.fedresurs.ru/' },
    { id: 'nalog_bi', nazv: 'Решения ФНС о приостановлении операций и обеспечительные меры', sam: 'https://service.nalog.ru/bi.do', damia: ['priostanovki', 'mery'] }
  ];
  var KOROTKO = { egrul: 'ЕГРЮЛ', fns_open: 'открытые данные ФНС', girbo: 'бухотчётность', kad: 'суды', fssp: 'приставы', eis: 'РНП и контракты', nalog_bi: 'приостановки счетов', efrsb: 'сообщения о банкротстве (ЕФРСБ)' };
  var NEIZV = { stale: 1, not_connected: 1, error: 1, n_a: 1, user: 1 };
  var METKA_NEIZV = { stale: 'устарело · не входит в полноту', not_connected: 'не проверяли', error: 'источник не ответил', n_a: 'не применяется', user: 'со слов пользователя' };

  function modul(imya, put) {
    if (root && root[imya]) return root[imya];
    if (typeof module === 'object' && typeof require === 'function') { try { return require(put); } catch (e) {} }
    return null;
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function z2(n) { return (n < 10 ? '0' : '') + n; }
  // любая дата ответа → «ДД.ММ.ГГГГ» (as_of уже бывает по-русски; ISO читаем как дату без часового сдвига)
  function dmy(v) {
    var t = String(v == null ? '' : v).trim(), m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(t);
    if (m) return t;
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
  }
  function iso(v) { var d = dmy(v); return d ? d.slice(6) + '-' + d.slice(3, 5) + '-' + d.slice(0, 2) : ''; }
  function dni(a, b) { var x = Date.parse(iso(a)), y = Date.parse(iso(b)); return isFinite(x) && isFinite(y) ? Math.floor((y - x) / 864e5) : null; }
  function plural(n, a, b, c) { var d = n % 10, s = n % 100; return d === 1 && s !== 11 ? a : d >= 2 && d <= 4 && (s < 12 || s > 14) ? b : c; }
  function spisok(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1]; }
  function zaglavnaya(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function ip(r) { var c = (r && r.company) || {}; return c.kind === 'INDIVIDUAL' || String(c.inn || '').length === 12; }

  function statusBloka(b) {
    var I = modul('DlkIstochniki', './istochniki.js');
    if (b && b.status_edinyj) return b.status_edinyj;
    return I ? I.statusIstochnika(b) : (b && (b.status === 'found' || b.status === 'not_found') ? b.status : 'not_connected');
  }

  // ---------- 2. Группы источников ----------
  // r → [{ id, nazv, status: 'ok' | stale | not_connected | error | n_a | user, data, tekst, sam }]
  function gruppy(r) {
    r = r || {};
    var c = r.company || {}, sig = Array.isArray(r.signals) ? r.signals : [], dm = r.damia && typeof r.damia === 'object' ? r.damia : {};
    var na = dmy(r.checked_at);
    return GRUPPY.map(function (g) {
      var o = { id: g.id, nazv: g.nazv, sam: g.sam, status: 'not_connected', data: '', tekst: '' };
      if (g.id === 'egrul') {
        if (c.inn && (c.status || c.name_full || c.name_short)) { o.status = 'ok'; o.data = na; }
        else o.tekst = 'Сведений реестра в' + NB + 'ответе нет.';
        return o;
      }
      if (g.id === 'fns_open') {
        var d = '';
        sig.forEach(function (s) {
          if (!s || !s.as_of || !/ФНС/i.test(String(s.source || '')) || /ЕГР(ЮЛ|ИП)/i.test(String(s.source || ''))) return;
          var x = dmy(s.as_of); if (x && (!d || iso(x) > iso(d))) d = x;
        });
        if (!d) { o.tekst = 'Строк из открытых данных ФНС в' + NB + 'ответе нет.'; return o; }
        o.data = d;
        var n = dni(d, na);
        if (n != null && n > g.ustarelo_dney) { o.status = 'stale'; o.tekst = 'Набор ФНС на' + NB + d + ' — сведения могли измениться.'; }
        else o.status = 'ok';
        return o;
      }
      if (g.id === 'girbo') {
        if (ip(r)) { o.status = 'n_a'; o.tekst = 'Предприниматели не сдают бухотчётность в ГИР БО.'; return o; }
        var D = r.dossier || {}, rev = D.charts && D.charts.revenue;
        var otch = sig.filter(function (s) { return s && /отч[её]тн/i.test(String(s.title || '')) && /ГИР|бухгалт/i.test(String(s.source || '')); })[0];
        if ((rev && rev.length) || otch) {
          o.status = 'ok';
          var god = rev && rev.length ? rev[rev.length - 1] : null;
          god = god && (god.year || god.god || god.x);
          o.data = god && /^\d{4}$/.test(String(god)) ? 'за ' + god + ' год' : otch && otch.as_of ? dmy(otch.as_of) : '';
        } else o.tekst = 'Отчётности в' + NB + 'ответе нет.';
        return o;
      }
      if (!g.damia) { o.tekst = 'Источник пока не' + NB + 'подключён.'; return o; }
      var bloki = g.damia.map(function (k) { return dm[k]; }).filter(function (b) { return b && typeof b === 'object' && !b.iz_egryul; });
      if (!bloki.length) { o.tekst = 'Источник пока не' + NB + 'подключён.'; return o; }
      var st = bloki.map(statusBloka);
      var staryj = bloki.filter(function (b, i) { return st[i] === 'stale' || b.ustarelo; });
      var dd = bloki.map(function (b) { return dmy(b.data_svedeniy); }).filter(Boolean).sort(function (a, b) { return iso(a) < iso(b) ? -1 : 1; });
      o.data = dd.length ? dd[0] : '';
      o.tekst = bloki.map(function (b) { return b.status_edinyj_tekst || ''; }).filter(function (t, i, a) { return t && a.indexOf(t) === i; }).join(' ');
      if (staryj.length) o.status = 'stale';
      else if (st.every(function (x) { return x === 'not_applicable'; })) o.status = 'n_a';
      else if (st.every(function (x) { return x === 'found' || x === 'not_found' || x === 'not_applicable'; })) o.status = 'ok';
      else if (st.indexOf('error') >= 0) o.status = 'error';
      else if (st.indexOf('user') >= 0) o.status = 'user';
      else o.status = 'not_connected';
      if (o.status !== 'ok' && !o.tekst) o.tekst = 'Источник пока не' + NB + 'подключён.';
      return o;
    });
  }

  // → { n, m, sloty: [true|false], tekst, ustarelo: [], ne: [] }
  function polnota(G) {
    var prim = G.filter(function (g) { return g.status !== 'n_a'; });
    var n = prim.filter(function (g) { return g.status === 'ok'; }).length, m = prim.length;
    var ust = prim.filter(function (g) { return g.status === 'stale'; }), ne = prim.filter(function (g) { return g.status !== 'ok' && g.status !== 'stale'; });
    var t = ['Проверено ' + n + NB + 'из' + NB + m + ' ' + plural(m, 'группы', 'групп', 'групп') + ' источников.'];
    if (ust.length) {
      var daty = ust.map(function (g) { return g.data; }).filter(Boolean), odna = daty.length && daty.every(function (x) { return x === daty[0]; });
      t.push(zaglavnaya(spisok(ust.map(function (g) { return KOROTKO[g.id]; }))) + (odna ? ' — сведения на' + NB + daty[0] + ', устарели.' : ' — сведения устарели.'));
    }
    if (ne.length) t.push('Не' + NB + 'проверяли: ' + spisok(ne.map(function (g) { return KOROTKO[g.id]; })) + '.');
    if (ust.length || ne.length) {
      var pro = [];
      if (ust.concat(ne).some(function (g) { return g.id === 'kad' || g.id === 'efrsb'; })) pro.push('споров');
      if (ust.concat(ne).some(function (g) { return g.id === 'fssp' || g.id === 'fns_open' || g.id === 'nalog_bi'; })) pro.push('долгов');
      t.push('Это не' + NB + 'значит, что ' + (pro.length ? spisok(pro) : 'записей') + ' нет.');
    }
    return { n: n, m: m, sloty: prim.map(function (g) { return g.status === 'ok'; }), tekst: t, ustarelo: ust, ne: ne };
  }

  // ---------- 1. Что это значит ----------
  function dataPravila(p) { var m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(p || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function vyvod(r, v) {
    var U = modul('Usloviya', './usloviya.js');
    if (!v && U) { try { v = U.decide(r); } catch (e) { v = null; } }
    if (!v) return { ton: 'ned', tekst: (r && r.verdict) || 'Вывод не посчитан', avans: '', pravilo: '' };
    var ton = /^Предварительно/.test(v.headline || '') ? 'ned' : v.tone;
    var pr = (v.predel && v.predel.pravilo) || (U && U.METODIKA && U.METODIKA.PRAVILO) || '', dp = dataPravila(pr);
    var sost = (v.predel && v.predel.sostoyanie) || (v.cap > 0 ? 'positive' : v.cap === 0 ? 'zero' : 'insufficient_data'), a;
    var money = U ? U.money : function (x) { return Math.round(x) + NB + '₽'; };
    if (sost === 'positive') a = 'Предоплата — до' + NB + money(v.cap) + '. Расчёт по' + NB + 'правилу от' + NB + dp + '.';
    else if (sost === 'zero') a = 'Без предоплаты. Основание: ' + ((v.reasons && v.reasons[0]) || v.capRule || 'правило Делоскопа') + '.';
    else if (sost === 'finorg') a = 'Сумму аванса не' + NB + 'считаем: это банк или страховая организация.';
    else a = 'Сумму аванса не' + NB + 'считаем: неизвестны возраст и' + NB + 'выручка компании. Запросите у' + NB + 'контрагента последнюю бухгалтерскую отчётность.';
    return { ton: ton, tekst: v.headline || '', avans: a, pravilo: dp, docs: v.docs || [] };
  }

  // ---------- 3. Что сделать ----------
  function deystviya(r, vv, opt) {
    opt = opt || {};
    var c = (r && r.company) || {}, docs = (vv && vv.docs) || [], n = docs.length, inn = String(c.inn || '');
    var gl = n ? { vid: 'docs', tekst: 'Запросить у' + NB + 'поставщика ' + n + NB + plural(n, 'документ', 'документа', 'документов'), docs: docs.map(function (d) { return d.ask || d.title; }) }
      : { vid: 'pdf', tekst: 'Скачать отчёт PDF' };
    var vt = [];
    if (!ip(r) && opt.id) vt.push({ vid: 'dosje', tekst: 'В досье сделки', href: '/pasport/kontragent/?id=' + encodeURIComponent(opt.id) + '#sd' });
    if (/^\d{10}$/.test(inn)) vt.push({ vid: 'slezh', tekst: 'Следить', href: '/cabinet.html?inn=' + inn + '#watch' });
    return { glavnoe: gl, vtorye: vt };
  }

  // ---------- 4. Что нашли ----------
  function fakty(r, G) {
    var U = modul('Usloviya', './usloviya.js'), na = dmy(r && r.checked_at), sig = [], ok = [], unk = [];
    ((r && r.signals) || []).forEach(function (s) {
      if (!s || !s.title) return;
      var t = String(s.title) + (s.detail ? ': ' + String(s.detail).charAt(0).toLowerCase() + String(s.detail).slice(1) : '');
      var data = s.as_of ? dmy(s.as_of) : /ЕГР/i.test(String(s.source || '')) ? na : '';
      var o = { t: t, s: [s.source || '', data ? 'на' + NB + data : ''].filter(Boolean).join(' · ') };
      var kod = U && U.signalId ? U.signalId(s) : null;
      if ((s.status === 'bad' || s.status === 'warn') && kod && kod.id) { o.vid = s.status; sig.push(o); }
      else { o.vid = 'ok'; ok.push(o); }
    });
    sig.sort(function (a, b) { return a.vid === b.vid ? 0 : a.vid === 'bad' ? -1 : 1; });
    (G || []).forEach(function (g) {
      if (g.status === 'ok') return;
      var kak = { stale: 'данные устарели', not_connected: 'не проверяли', error: 'источник не ответил', n_a: 'не применяется', user: 'со слов пользователя' }[g.status];
      unk.push({ vid: 'unk', status: g.status, t: g.nazv + ' — ' + kak, z: g.tekst, sam: g.status === 'n_a' ? '' : g.sam, s: METKA_NEIZV[g.status] });
    });
    return sig.concat(ok, unk);
  }

  function sobrat(r, opt) {
    opt = opt || {};
    var G = gruppy(r), vv = vyvod(r, opt.v);
    return { vyvod: vv, polnota: polnota(G), deystviya: deystviya(r, vv, opt), fakty: fakty(r, G), gruppy: G };
  }

  // ---------- разметка ----------
  var CSS = '' +
    '.q4{--unk:var(--ink2,#48484C);--unk-bg:var(--surface-2,#EEEEEA);--unk-line:var(--muted,#6B6B70);display:grid;gap:20px;grid-template-columns:minmax(0,1fr);margin:20px 0 8px}' +
    '@media(min-width:1024px){.q4{grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:start}.q4-itog{position:sticky;top:80px}}' +
    '.q4-k{background:var(--bg,#F5F5F2);border-radius:16px;padding:20px}' +
    '.q4-q{font-size:13px;line-height:1.3;color:var(--muted,#6B6B70);text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;display:flex;gap:8px;align-items:center;font-weight:600}' +
    '.q4-q b{flex:none;display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--card,#fff);color:var(--ink2,#48484C);font-size:12px}' +
    '.q4-v{font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-.01em;margin:0 0 6px;color:var(--ink,#1D1D1F)}' +
    '.q4-v i{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:10px;vertical-align:2px;background:var(--ok,#16723F)}' +
    '.q4-v.cap i{background:var(--warn,#9A5B00)}.q4-v.post i,.q4-v.stop i{background:var(--bad,#B3261E)}.q4-v.ned i{background:var(--muted,#6B6B70)}' +
    '.q4-avans{margin:0 0 16px;color:var(--ink2,#48484C);font-size:15px}.q4-avans small{color:var(--muted,#6B6B70);font-size:13px}' +
    '.q4-poln{background:var(--unk-bg);border:1px dashed var(--unk-line);border-radius:16px;padding:12px 14px;margin:0 0 18px;color:var(--unk);font-size:15px}' +
    '.q4-poln strong{color:var(--ink,#1D1D1F)}.q4-poln.vse{border-style:solid;border-color:var(--line,#E6E6E1);background:var(--card,#fff)}' +
    '.q4-bar{display:flex;gap:4px;margin:0 0 10px}.q4-bar span{flex:1;height:6px;border-radius:3px;background:var(--ok,#16723F);transform-origin:left;animation:q4-ros .5s cubic-bezier(.2,.7,.2,1) both}' +
    '.q4-bar span.u{background:transparent;border:1px dashed var(--unk-line);animation:none}' +
    '@keyframes q4-ros{from{transform:scaleX(0)}to{transform:scaleX(1)}}@media(prefers-reduced-motion:reduce){.q4-bar span{animation:none}}' +
    '.q4-b{display:flex;align-items:center;justify-content:center;text-align:center;min-height:48px;border-radius:999px;font:inherit;font-weight:600;font-size:17px;line-height:1.2;text-decoration:none;padding:6px 20px;width:100%;cursor:pointer;border:0}' +
    '.q4-b.p{background:var(--accent,#0B63E5);color:var(--on-accent,#fff)}.q4-b.s{background:var(--card,#fff);box-shadow:inset 0 0 0 1px var(--line-2,var(--line));color:var(--ink)}' +
    '.q4-b:focus-visible{outline:3px solid var(--accent,#0B63E5);outline-offset:2px}.q4-b.s:hover{box-shadow:inset 0 0 0 1px var(--accent,#0B63E5);color:var(--accent,#0B63E5)}' +
    '.q4-dop{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:10px}' +
    '.q4-f{display:grid;grid-template-columns:22px minmax(0,1fr);gap:2px 10px;padding:12px 0;border-top:1px solid var(--line,#E6E6E1)}' +
    '.q4-f:first-of-type{border-top:0}.q4-f>span{grid-column:2;overflow-wrap:anywhere}.q4-f .m{grid-column:1;grid-row:1/5;font-size:15px;line-height:22px;text-align:center}' +
    '.q4-f .t{font-weight:500;color:var(--ink,#1D1D1F)}.q4-f .z{color:var(--ink2,#48484C);font-size:15px}.q4-f .s{color:var(--muted,#6B6B70);font-size:13px}' +
    '.q4-f.ok .m{color:var(--ok,#16723F)}' +
    '.q4-f.sig-warn{background:var(--warn-bg,#FFF4E0);border-radius:10px;padding:12px;border-top:0;margin:4px 0}.q4-f.sig-warn .m{color:var(--warn,#9A5B00)}' +
    '.q4-f.sig-bad{background:var(--bad-bg,#FDECEA);border-radius:10px;padding:12px;border-top:0;margin:4px 0}.q4-f.sig-bad .m{color:var(--bad,#B3261E)}' +
    '.q4-f.unk{background:var(--unk-bg);border:1px dashed var(--unk-line);border-radius:10px;padding:12px;margin:4px 0}.q4-f.unk .m{color:var(--muted,#6B6B70)}.q4-f.unk .t{color:var(--unk)}' +
    '.q4-f a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
    '.q4-leg{color:var(--muted,#6B6B70);font-size:13px;margin:12px 0 0}' +
    '.q4-dlg{border:0;border-radius:16px;padding:24px;background:var(--card,#fff);max-width:min(560px,calc(100vw - 32px));color:var(--ink,#1D1D1F);box-shadow:0 24px 60px rgba(0,0,0,.2)}' +
    '.q4-dlg::backdrop{background:rgba(17,17,19,.45)}.q4-dlg h3{margin:0 0 12px;font-size:20px}.q4-dlg ol{margin:0 0 16px;padding-left:20px;display:flex;flex-direction:column;gap:8px}' +
    '.q4-dlg .q4-dop{margin-top:0}' +
    '[data-theme=dark] .q4-b.s{box-shadow:inset 0 0 0 1px #3A3A40}[data-theme=dark] .q4-q b{background:var(--surface-2)}' +
    '@media print{.q4{grid-template-columns:1fr}.q4-itog{position:static}.q4-dej,.q4-dlg{display:none!important}.q4-k,.q4-poln,.q4-f,.q4-bar span{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';

  function html(o) {
    var v = o.vyvod, p = o.polnota, d = o.deystviya, h = '';
    h += '<section class="q4-k q4-itog" aria-label="Итог">';
    h += '<h2 class="q4-q"><b aria-hidden="true">1</b>Что это значит для сделки</h2>';
    h += '<p class="q4-v ' + esc(v.ton) + '"><i aria-hidden="true"></i>' + esc(v.tekst) + '</p>';
    h += '<p class="q4-avans">' + esc(v.avans) + (v.avans ? ' <small>◆' + NB + 'рассчитано Делоскопом' + (v.pravilo ? ', правила расчёта от' + NB + esc(v.pravilo) : '') + '</small>' : '') + '</p>';
    h += '<div class="q4-poln' + (p.n === p.m ? ' vse' : '') + '" role="note" aria-label="Насколько полна проверка">';
    h += '<p class="q4-q" style="margin-bottom:10px"><b aria-hidden="true">2</b>Насколько полна проверка</p>';
    h += '<div class="q4-bar" aria-hidden="true">' + p.sloty.map(function (x) { return '<span' + (x ? '' : ' class="u"') + '></span>'; }).join('') + '</div>';
    h += '<strong>' + esc(p.tekst[0]) + '</strong>' + (p.tekst.length > 1 ? ' ' + esc(p.tekst.slice(1).join(' ')) : '') + '</div>';
    h += '<div class="q4-dej"><h2 class="q4-q"><b aria-hidden="true">3</b>Что сделать до оплаты</h2>';
    h += '<button class="q4-b p" type="button" data-q4-act="' + esc(d.glavnoe.vid) + '">' + esc(d.glavnoe.tekst) + '</button>';
    if (d.vtorye.length) h += '<div class="q4-dop">' + d.vtorye.map(function (x) { return '<a class="q4-b s" href="' + esc(x.href) + '" data-q4-act="' + esc(x.vid) + '">' + esc(x.tekst) + '</a>'; }).join('') + '</div>';
    if (d.glavnoe.vid === 'docs') {
      h += '<dialog class="q4-dlg" data-q4-dlg aria-labelledby="q4-dlg-h"><h3 id="q4-dlg-h">Что запросить у' + NB + 'поставщика до оплаты</h3><ol>' +
        d.glavnoe.docs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' +
        '<div class="q4-dop"><button class="q4-b p" type="button" data-q4-act="copy">Скопировать список</button><button class="q4-b s" type="button" data-q4-act="close">Закрыть</button></div></dialog>';
    }
    h += '</div></section>';
    h += '<section class="q4-k" aria-label="Что нашли"><h2 class="q4-q"><b aria-hidden="true">4</b>Что нашли — у' + NB + 'каждого факта источник и' + NB + 'дата</h2>';
    h += o.fakty.map(function (f) {
      var cls = f.vid === 'unk' ? 'unk' : f.vid === 'ok' ? 'ok' : 'sig-' + f.vid;
      var m = f.vid === 'unk' ? ['○', 'неизвестно'] : f.vid === 'ok' ? ['●', 'подтверждено источником'] : ['▲', 'сигнал'];
      var z = f.z || '';
      return '<div class="q4-f ' + cls + '"' + (f.status ? ' data-status="' + esc(f.status) + '"' : '') + '><span class="m" role="img" aria-label="' + m[1] + '">' + m[0] + '</span>' +
        '<span class="t">' + esc(f.t) + '</span>' +
        (z || f.sam ? '<span class="z">' + esc(z) + (f.sam ? (z ? ' ' : '') + 'Проверьте сами: <a href="' + esc(f.sam) + '" target="_blank" rel="noopener">' + esc(f.sam.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</a>' : '') + '</span>' : '') +
        (f.s ? '<span class="s">' + esc(f.s) + '</span>' : '') + '</div>';
    }).join('');
    h += '<p class="q4-leg">●' + NB + 'подтверждено источником · ▲' + NB + 'сигнал · ○' + NB + 'неизвестно · ◆' + NB + 'рассчитано Делоскопом</p></section>';
    return h;
  }

  function mount(box, r, opt) {
    if (!box || !r) return null;
    opt = opt || {};
    var doc = box.ownerDocument;
    if (doc && !doc.getElementById('q4-css')) { var st = doc.createElement('style'); st.id = 'q4-css'; st.textContent = CSS; doc.head.appendChild(st); }
    var o = sobrat(r, opt);
    box.className = (box.className ? box.className + ' ' : '') + 'q4';
    box.innerHTML = html(o);
    var dlg = box.querySelector('[data-q4-dlg]'), cel = root && root.dlkGoal;
    box.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-q4-act]') : null; if (!b) return;
      var a = b.getAttribute('data-q4-act');
      if (cel && a !== 'close' && a !== 'copy') try { cel('q4_deystvie', { vid: a }); } catch (_) {}
      if (a === 'pdf') { if (root.print) root.print(); }
      else if (a === 'docs' && dlg) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
      else if (a === 'close' && dlg) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
      else if (a === 'copy') {
        var txt = o.deystviya.glavnoe.docs.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n');
        var done = function () { b.textContent = 'Список скопирован'; };
        try { root.navigator.clipboard.writeText(txt).then(done, function () { root.prompt('Скопируйте список:', txt); }); } catch (_) { root.prompt('Скопируйте список:', txt); }
      }
    });
    return o;
  }

  return { GRUPPY: GRUPPY, gruppy: gruppy, polnota: polnota, vyvod: vyvod, deystviya: deystviya, fakty: fakty, sobrat: sobrat, html: html, mount: mount, CSS: CSS, NEIZV: NEIZV };
});
