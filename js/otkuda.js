/* Делоскоп — «Откуда данные» на экране проверки по ИНН (решение владельца 02.10 «солиднее, техничнее, понятнее»:
 * «блок «Откуда данные»: сколько реестров опрошено, когда обновлены, статус каждого»).
 * Опись собирается только из ответа /api/check — ничего не дорисовываем:
 *   ● источник ответил — что из него взяли и на какую дату сведения;
 *   ○ не ответил — так и пишем, со ссылкой «проверьте сами» («не проверяли ≠ не нашли»);
 *   ◆ рассчитано Делоскопом — светофор и прогноз ЗСК, со ссылкой на методику.
 * Расчёт в счёт «опрошенных источников» не входит. Чистые функции (istochniki, html) — без DOM и сети,
 * их проверяет tests/otkuda.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Otkuda = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = '\u00a0';
  var DAMIA_PORYADOK = ['sudy', 'bankrotstvo', 'fssp', 'priostanovki', 'mery', 'rnp', 'kontrakty'];
  // что из внешнего реестра берём — коротко, для строки описи
  var DAMIA_CHTO = { sudy: 'дела, где компания — сторона', bankrotstvo: 'дела о банкротстве', fssp: 'исполнительные производства',
    priostanovki: 'решения о приостановлении операций по счетам', mery: 'запрет распоряжаться имуществом',
    rnp: 'записи о недобросовестном поставщике', kontrakty: 'контракты 44-ФЗ и 223-ФЗ' };

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function z(n) { return (n < 10 ? '0' : '') + n; }
  function dmy(s) {
    if (!s) return '';
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
  }
  function skl(n, a, b, c) {
    var m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c;
  }
  function ip(r) { return String(((r || {}).company || {}).inn || '').length === 12; }
  // банк — ОКВЭД 64.1x, та же проверка, что bank(c) в js/sushchestvennoe.js и js/indeks-otvet.js
  function bank(c) { return /^64\.1(\.|\d|$)/.test(String((c || {}).okved || '')); }
  var BANK_GIRBO = 'организация сдаёт её в' + NB + 'Банк России; в' + NB + 'ГИР' + NB + 'БО её передаёт Банк России, доступ может быть ограничен (ч.' + NB + '9 и' + NB + '12 ст.' + NB + '18' + NB + '402-ФЗ)';
  var CBR_BANK = 'https://www.cbr.ru/finorg/foinfo/';
  // «402-ФЗ)» на 390 px рвался по дефису — номер закона со скобкой одним куском (после esc), как в sushchestvennoe.js
  function nw(h) { return String(h).replace(/(\d+-ФЗ\))/g, '<span style="white-space:nowrap">$1</span>'); }
  function chistyj(u) { return /^https:\/\/[^\s"<>]+$/.test(u || '') ? u : ''; }

  // «ЕГРЮЛ/ЕГРИП — на 29.09.2026; задолженность — на 01.09.2026» → [{metka, data}]
  function datyNaborov(s) {
    return String(s || '').split(';').map(function (ch) {
      var m = /^\s*(.+?)\s+—\s+(?:на\s+)?(\d{2}\.\d{2}\.\d{4})\s*$/.exec(ch);
      return m ? { metka: m[1], data: m[2] } : null;
    }).filter(Boolean);
  }
  function godyRyada(ch) {
    var g = {};
    ['revenue', 'profit', 'income_tax'].forEach(function (k) {
      (Array.isArray((ch || {})[k]) ? ch[k] : []).forEach(function (x) {
        if (x && isFinite(parseInt(x.year, 10)) && x.value != null && x.value !== '' && isFinite(Number(x.value))) g[parseInt(x.year, 10)] = 1;
      });
    });
    return Object.keys(g).map(Number).sort(function (a, b) { return a - b; });
  }

  // Опись источников: { spisok: [{znak, nazv, chto, data, status, ssylka}], otvetili, oprosheno, dataPr }
  function istochniki(r, opt) {
    opt = opt || {};
    if (!r || !r.company) return { spisok: [], otvetili: 0, oprosheno: 0, dataPr: '' };
    var c = r.company, fl = ip(r), reestr = fl ? 'ЕГРИП' : 'ЕГРЮЛ';
    var t = Date.parse(r.checked_at || ''), msk = new Date((isFinite(t) ? t : (opt.segodnya || new Date()).getTime()) + 3 * 3600 * 1000);
    var dataPr = z(msk.getUTCDate()) + '.' + z(msk.getUTCMonth() + 1) + '.' + msk.getUTCFullYear();
    var D = r.dossier || {}, daty = datyNaborov(D.data_dates);
    function dataPo(re) { for (var i = 0; i < daty.length; i++) if (re.test(daty[i].metka)) return daty[i].data; return ''; }
    var spisok = [];

    // 1. ЕГРЮЛ/ЕГРИП — карточка компании пришла
    var dEgr = dataPo(/^ЕГР(ЮЛ|ИП)/i);
    var chtoEgr = fl ? 'статус, дата регистрации, виды деятельности' : 'статус, адрес и отметки о недостоверности, руководитель, дата регистрации, виды деятельности';
    spisok.push({ k: 'egrul', znak: '●', nazv: reestr + ' (ФНС)', chto: chtoEgr, data: dEgr ? 'на' + NB + dEgr : 'на' + NB + dataPr, status: 'ok' });
    var dIzm = dataPo(/последнее изменение/i);
    if (dIzm) spisok[0].dop = 'последнее изменение записи — ' + dIzm;

    // 2. Прочие источники строк светофора (открытые данные ФНС и т. п.), сгруппированные по названию
    var gruppy = {}, poryadok = [];
    (r.signals || []).forEach(function (s) {
      if (!s || !s.source || /^ЕГР(ЮЛ|ИП)/.test(s.source)) return;
      var key = String(s.source);
      if (!gruppy[key]) { gruppy[key] = { chto: [], data: '' }; poryadok.push(key); }
      if (s.title) gruppy[key].chto.push(String(s.title).toLowerCase());
      if (s.as_of && !gruppy[key].data) gruppy[key].data = dmy(s.as_of);
    });
    var dPay = dataPo(/уплаченные налоги/i);
    poryadok.forEach(function (key) {
      var g = gruppy[key];
      var dat = g.data || (/ФНС/.test(key) ? dataPo(/задолженность/i) : '');
      spisok.push({ k: 'sig:' + key, znak: '●', nazv: key, chto: g.chto.join(', '), data: dat ? 'на' + NB + dat : '', status: 'ok' });
    });
    if (dPay && !poryadok.some(function (k) { return /ФНС/.test(k); })) {
      spisok.push({ k: 'paytax', znak: '●', nazv: 'ФНС, открытые данные', chto: 'уплаченные налоги и взносы', data: 'на' + NB + dPay, status: 'ok' });
    }

    // 3. ГИР БО — годовая бухотчётность (у ИП её нет — строку не показываем)
    if (!fl) {
      var gody = godyRyada(D.charts);
      if (gody.length) {
        var pos = gody[gody.length - 1];
        spisok.push({ k: 'girbo', znak: '●', nazv: 'ГИР БО (ФНС)', chto: 'бухотчётность: выручка, прибыль, налог на прибыль',
          data: gody.length > 1 ? 'за ' + gody[0] + '–' + pos + NB + 'гг.' : 'за ' + pos + NB + 'г.', status: 'ok' });
      } else if (bank(c)) {
        // bank-girbo-v2 [Ночные-3] 04.10: у банка пустой ответ ГИР БО — не «отчётности нет», а как устроено: сдаёт в Банк России,
        // в ГИР БО передаёт Банк России, доступ может быть ограничен (ч. 9 и 12 ст. 18 402-ФЗ) — текст [Право · Налоговый]
        // 04.10 11:30 разд. 1.4 + 12:30 разд. 1, как в «Существенных фактах»; «проверьте сами» — карточка банка на cbr.ru.
        spisok.push({ k: 'girbo', znak: '○', nazv: 'ГИР БО (ФНС)', chto: 'бухотчётность', data: '', status: 'net',
          prichina: BANK_GIRBO, ssylka: CBR_BANK + (/^\d{13}$/.test(String(c.ogrn || '')) ? '?ogrn=' + c.ogrn : '') });
      } else {
        spisok.push({ k: 'girbo', znak: '○', nazv: 'ГИР БО (ФНС)', chto: 'бухотчётность', data: '', status: 'net',
          prichina: 'отчётности в ответе нет', ssylka: 'https://bo.nalog.gov.ru/' });
      }
    }

    // 4. Внешние реестры (суды, банкротство, приставы, …) — как ответили
    var dm = r.damia || {};
    DAMIA_PORYADOK.concat(Object.keys(dm).filter(function (k) { return DAMIA_PORYADOK.indexOf(k) < 0; })).forEach(function (k) {
      var b = dm[k];
      if (!b || typeof b !== 'object' || !b.nazvanie || !b.status || b.status === 'not_applicable') return;
      var otv = b.status === 'found' || b.status === 'not_found';
      spisok.push({ k: 'damia:' + k, znak: otv ? '●' : '○', nazv: b.nazvanie, chto: DAMIA_CHTO[k] || '',
        data: otv ? 'на' + NB + (dmy(b.data_svedeniy) || dataPr) : '', status: otv ? 'ok' : 'net',
        prichina: otv ? '' : (b.prichina || 'ответа нет'), ssylka: otv ? '' : chistyj(b.proverit_samim) });
    });

    var oprosheno = spisok.length, otvetili = spisok.filter(function (x) { return x.status === 'ok'; }).length;

    // 5. Рассчитано Делоскопом — не источник, в счёт не входит
    var rasch = [];
    if (r.risk_title) rasch.push('светофор риска');
    if (r.zsk && r.zsk.title) rasch.push('прогноз ЗСК — наша оценка, не статус Банка России');
    if (rasch.length) spisok.push({ k: 'raschet', znak: '◆', nazv: 'Расчёт Делоскопа', chto: rasch.join('; '), data: dataPr, status: 'raschet', ssylka: '/indeks/' });

    return { spisok: spisok, otvetili: otvetili, oprosheno: oprosheno, dataPr: dataPr };
  }

  function stroka(x) {
    var st = x.status === 'ok' ? 'ответил' : x.status === 'net' ? 'не ответил' : 'рассчитано';
    var hvost = x.status === 'net'
      ? (x.prichina ? nw(esc(x.prichina)) : '') + (x.ssylka ? (x.prichina ? ' · ' : '') + '<a href="' + esc(x.ssylka) + '" target="_blank" rel="noopener">проверьте сами</a>' : '') || 'не ответил'
      : x.status === 'raschet' ? '<a href="' + esc(x.ssylka) + '">методика</a>' : esc(x.data || '');
    return '<li class="otk__r otk__r--' + x.status + '" data-ist="' + esc(x.k) + '">' +
      '<span class="otk__z" aria-label="' + st + '">' + x.znak + '</span>' +
      '<span class="otk__n"><b>' + esc(x.nazv) + '</b>' + (x.chto ? '<small>' + esc(x.chto) + (x.dop ? '; ' + esc(x.dop) : '') + '</small>' : '') + '</span>' +
      '<span class="otk__d">' + hvost + '</span></li>';
  }

  function html(r, opt) {
    var o = istochniki(r, opt);
    if (!o.spisok.length) return '';
    // одна и та же причина у всех, кто не ответил, — пишем её один раз под списком, а не в каждой строке
    var net = o.spisok.filter(function (x) { return x.status === 'net'; }), obshchaya = '';
    if (net.length > 1 && net.every(function (x) { return x.prichina && x.prichina === net[0].prichina; })) {
      obshchaya = net[0].prichina;
      o.spisok = o.spisok.map(function (x) { return x.status === 'net' ? Object.assign({}, x, { prichina: '' }) : x; });
    }
    var tochki = o.spisok.filter(function (x) { return x.status !== 'raschet'; }).map(function (x) { return x.znak; }).join('');
    return '<details class="otk"><summary><span class="otk__t">Откуда данные</span>' +
      '<span class="otk__s">ответили ' + o.otvetili + ' из ' + o.oprosheno + NB + skl(o.oprosheno, 'источника', 'источников', 'источников') +
      ' · проверка ' + o.dataPr + '</span><span class="otk__m" aria-hidden="true">' + tochki + '</span></summary>' +
      '<ul>' + o.spisok.map(stroka).join('') + '</ul>' +
      (obshchaya ? '<p class="otk__p otk__p--net">Не ответили ' + net.length + ' из ' + o.oprosheno + ': ' + nw(esc(obshchaya)) + '.</p>' : '') +
      '<p class="otk__p">● ответил · ○ не ответил — не значит «не нашли» · ◆ рассчитано Делоскопом. Это оценка риска, а не решение банка.</p></details>';
  }

  var CSS = '.otk{margin-top:12px;border-top:1px solid var(--line,#E6E6E1);font-size:13px;color:var(--ink2,#48484C)}' +
    '.otk summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px;padding:12px 0}' +
    '.otk summary::-webkit-details-marker{display:none}' +
    '.otk__t{font-size:14px;font-weight:600;color:var(--ink,#1D1D1F)}' +
    '.otk__t::after{content:"";display:inline-block;width:6px;height:6px;margin-left:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-3px) rotate(45deg);transition:transform .2s}' +
    '.otk[open] .otk__t::after{transform:translateY(0) rotate(225deg)}' +
    '.otk__s{font-variant-numeric:tabular-nums;color:var(--muted,#6B6B70)}' +
    '.otk__m{margin-left:auto;letter-spacing:2px;color:var(--muted,#6B6B70);font-size:12px}' +
    '.otk ul{list-style:none;margin:0;padding:0}' +
    '.otk__r{display:grid;grid-template-columns:16px minmax(0,1fr) auto;gap:4px 10px;padding:8px 0;border-top:1px solid #EFEFEA;align-items:baseline}' +
    '.otk__z{color:var(--ok,#16723F)}.otk__r--net .otk__z{color:var(--muted,#6B6B70)}.otk__r--raschet .otk__z{color:var(--ink2,#48484C)}' +
    '.otk__n{display:grid;gap:2px;min-width:0}.otk__n b{font-weight:500;color:var(--ink,#1D1D1F)}.otk__n small{font-size:12px;color:var(--muted,#6B6B70)}' +
    '.otk__d{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.otk__d a{color:var(--accent,#0B63E5)}' +
    '.otk__r--net .otk__d{white-space:normal;max-width:220px}' +
    '.otk__p{margin:8px 0 0;font-size:12px;color:var(--muted,#6B6B70)}' +
    '@media (max-width:520px){.otk__r{grid-template-columns:16px minmax(0,1fr)}.otk__d{grid-column:2;text-align:left;white-space:normal;max-width:none}.otk__m{display:none}}' +
    '@media print{.otk:not([open])>*:not(summary){display:block}.otk__m{display:none}}';

  function stil(doc) {
    if (!doc || doc.getElementById('otk-css')) return;
    var s = doc.createElement('style'); s.id = 'otk-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Браузер: заменяет строку «Источники: …» под отчётом на опись источников. Ошибка — строка остаётся как была.
  function mount(el, r, opt) {
    if (!el) return false;
    var h = '';
    try { h = html(r, opt); } catch (e) { h = ''; }
    if (!h) return false;
    try { stil(el.ownerDocument || document); } catch (e) {}
    var w = (el.ownerDocument || document).createElement('div');
    w.innerHTML = h;
    el.parentNode.replaceChild(w.firstChild, el);
    return true;
  }

  return { istochniki: istochniki, datyNaborov: datyNaborov, html: html, mount: mount, CSS: CSS };
});
