/*!
 * Делоскоп · «Что проверено» в досье контрагента (report.html) — честная опись проверки (Ф5, Ночные 30.09).
 *
 * Было: постоянный абзац «проверено: ЕГРЮЛ, недостоверность, долги, … дисквалифицированные» — печатался всегда,
 * даже если источник не ответил. А досье клиент несёт как часть доказательств должной осмотрительности.
 * Стало: опись собирается из ответа сервера —
 *   ● «Получено» — только то, что реально пришло: строки светофора (r.signals) с источником и датой сведений,
 *     сведения ЕГРЮЛ/ЕГРИП (есть карточка), отчётность (есть досье с цифрами), блоки DaMIA со статусом found/not_found;
 *   ○ «Не проверяли» — ожидаемые пункты, которых в ответе нет, и внешние реестры без ответа (суды, банкротство,
 *     приставы, РНП, приостановки) — со ссылкой «проверьте сами» на первоисточник.
 * «Не проверяли» ≠ «не нашли» (Юрист 115-ФЗ, 27.09; аудит 27.09, п. Д).
 * Внешние реестры и ссылки берём из PasportKontragenta.RAZDELY (один источник правды с Паспортом), если он загружен.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChtoProvereno = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Что обычно есть в проверке по открытым данным ФНС и ЕГРЮЛ. re — по названию строки светофора.
  var OZHIDAEM = [
    { id: 'egrul', nazv: 'Сведения ЕГРЮЛ: статус, адрес, руководитель, виды деятельности', ist: 'ЕГРЮЛ' },
    { id: 'nedostovernost', nazv: 'Отметки ФНС о недостоверности сведений', re: /недостовер/i, sam: [{ tekst: 'egrul.nalog.ru', url: 'https://egrul.nalog.ru/' }] },
    { id: 'dolgi', nazv: 'Задолженность по налогам', re: /долг|задолж|недоимк/i, sam: [{ tekst: 'pb.nalog.ru', url: 'https://pb.nalog.ru/' }] },
    { id: 'pravonarusheniya', nazv: 'Налоговые правонарушения и штрафы', re: /правонаруш|штраф/i, sam: [{ tekst: 'pb.nalog.ru', url: 'https://pb.nalog.ru/' }] },
    { id: 'chislennost', nazv: 'Среднесписочная численность', re: /численност|сотрудник/i, sam: [{ tekst: 'pb.nalog.ru', url: 'https://pb.nalog.ru/' }] },
    { id: 'otchetnost', nazv: 'Бухгалтерская отчётность, доходы и расходы', re: /отч[её]тност|доход|выручк|расход/i, sam: [{ tekst: 'bo.nalog.gov.ru', url: 'https://bo.nalog.gov.ru/' }] },
    { id: 'uplacheno', nazv: 'Уплаченные налоги и взносы', re: /уплач|налоги и взнос/i, sam: [{ tekst: 'pb.nalog.ru', url: 'https://pb.nalog.ru/' }] },
    { id: 'rezhim', nazv: 'Специальные налоговые режимы', re: /спецрежим|налогов\S* режим|УСН|ЕСХН|патент/i, sam: [{ tekst: 'pb.nalog.ru', url: 'https://pb.nalog.ru/' }] },
    { id: 'diskval', nazv: 'Реестр дисквалифицированных лиц', re: /дисквалиф/i, sam: [{ tekst: 'service.nalog.ru/disqualified.do', url: 'https://service.nalog.ru/disqualified.do' }] }
  ];
  // Внешние реестры — если PasportKontragenta не загружен (запасной список; тест сверяет его с RAZDELY)
  var VNESHNIE = [
    { id: 'sudy', nazv: 'Арбитражные суды и банкротство', damia: ['sudy', 'bankrotstvo'],
      sam: [{ tekst: 'kad.arbitr.ru', url: 'https://kad.arbitr.ru/' }, { tekst: 'bankrot.fedresurs.ru', url: 'https://bankrot.fedresurs.ru/' }] },
    { id: 'scheta', nazv: 'Счета: приостановки и обеспечительные меры ФНС', damia: ['priostanovki', 'mery'],
      sam: [{ tekst: 'service.nalog.ru/bi.do', url: 'https://service.nalog.ru/bi.do' }] },
    { id: 'pristavy', nazv: 'Исполнительные производства', damia: ['fssp'],
      sam: [{ tekst: 'fssp.gov.ru/iss/ip', url: 'https://fssp.gov.ru/iss/ip' }] },
    { id: 'goszakaz', nazv: 'Госзаказ: контракты и РНП', damia: ['kontrakty', 'rnp'],
      sam: [{ tekst: 'zakupki.gov.ru — РНП', url: 'https://zakupki.gov.ru/epz/dishonestsupplier/search/results.html' },
        { tekst: 'zakupki.gov.ru — контракты', url: 'https://zakupki.gov.ru/epz/contract/search/results.html' }] },
    // Стоп-листы (Ночные 30.09 15:05): красная группа ЗСК — за капчей Банка России, автоматически не берём; клиент проверяет сам.
    { id: 'stoplisty', nazv: 'Стоп-листы', damia: [], vneshnij: true,
      sam: [{ tekst: 'cbr.ru — проверка по ИНН', url: 'https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/' },
        { tekst: 'cbr.ru — список нелегальных', url: 'https://www.cbr.ru/inside/warning-list/' },
        { tekst: 'fedsfm.ru — перечень', url: 'https://www.fedsfm.ru/documents/terrorists-catalog-portal-act' }] }
  ];

  var STOP = /перечн|росфинмониторинг|экстремист|террор|санкц|стоп-лист|нелегальн/i;

  function dataRu(v) {
    if (!v) return '';
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '.' + m[2] + '.' + m[1] : String(v);
  }

  /* Дисквалификация «получена», только если источник назвал отметку (bad/warn) или ответил реестр дисквалифицированных лиц ФНС — и есть дата. */
  function diskvalProveren(s) {
    if (!s || !s.as_of) return false;
    if (s.status === 'bad' || s.status === 'warn') return true;
    return /реестр\S*\s+дисквалифицир/i.test(String(s.source || ''));
  }

  function vneshnie(razdely) {
    if (!razdely || !razdely.length) return VNESHNIE;
    var out = razdely.filter(function (x) { return (x.damia && x.damia.length) || x.vneshnij; }).map(function (x) {
      return { id: x.id, nazv: x.title, damia: x.damia || [],
        sam: (x.sam || []).map(function (a) { return { tekst: a[0], url: a[1] }; }) };
    });
    return out.length ? out : VNESHNIE;
  }

  /* r — ответ /api/report/{id}. Возвращает { polucheno: [{nazv, ist, data}], ne_proveryali: [{nazv, sam}], na: 'ДД.ММ.ГГГГ' } */
  function sobrat(r, opt) {
    r = r || {};
    opt = opt || {};
    var c = r.company || {};
    var sig = (r.signals || []).filter(function (s) { return s && s.title; });
    var ip = c.kind === 'INDIVIDUAL' || String(c.inn || '').length === 12;
    var ispolzovano = {};
    var polucheno = [], ne = [];

    OZHIDAEM.forEach(function (p) {
      if (p.id === 'egrul') {
        if (c.inn && (c.status || c.name_full || c.name_short))
          polucheno.push({ id: p.id, nazv: ip ? 'Сведения ЕГРИП: статус, дата регистрации, виды деятельности' : p.nazv, ist: ip ? 'ЕГРИП' : 'ЕГРЮЛ', data: dataRu(r.checked_at) });
        else ne.push({ id: p.id, nazv: p.nazv, sam: [{ tekst: 'egrul.nalog.ru', url: 'https://egrul.nalog.ru/' }] });
        return;
      }
      var s = null;
      for (var i = 0; i < sig.length; i++) if (!ispolzovano[i] && p.re.test(sig[i].title)) { s = sig[i]; ispolzovano[i] = true; break; }
      var dossier = p.id === 'otchetnost' && r.dossier && ((r.dossier.kpi && r.dossier.kpi.length) || (r.dossier.charts && r.dossier.charts.revenue && r.dossier.charts.revenue.length));
      if (s && p.id === 'diskval' && !diskvalProveren(s))
        // karta-v2 (Ф7): DaData management.disqualified не заполняется — «нет» из пустого поля не проверка
        ne.push({ id: p.id, nazv: p.nazv, sam: [{ tekst: 'service.nalog.ru/disqualified.do', url: 'https://service.nalog.ru/disqualified.do' }] });
      else if (s) polucheno.push({ id: p.id, nazv: p.nazv, ist: s.source || '', data: dataRu(s.as_of) });
      else if (dossier) polucheno.push({ id: p.id, nazv: p.nazv, ist: 'ГИР БО', data: '' });
      else ne.push({ id: p.id, nazv: p.nazv, sam: p.sam || [] });
    });
    // строки светофора сверх ожидаемых — тоже получены, под своим названием
    sig.forEach(function (s, i) {
      if (!ispolzovano[i]) polucheno.push({ id: 'signal', nazv: String(s.title), ist: s.source || '', data: dataRu(s.as_of) });
    });
    // внешние реестры: получено только при ответе источника (found / not_found), иначе — «не проверяли» + «проверьте сами»
    var dm = r.damia || {};
    vneshnie(opt.razdely).forEach(function (v) {
      var otvet = v.damia.map(function (k) { return dm[k]; }).filter(function (b) { return b && (b.status === 'found' || b.status === 'not_found'); });
      if (otvet.length) polucheno.push({ id: v.id, nazv: v.nazv, ist: otvet[0].istochnik || '', data: dataRu(otvet[0].data_svedeniy) });
      // стоп-листы приходят строкой светофора (список Банка России, перечни Росфинмониторинга) — с датой она уже в «Получено»
      else if (v.id === 'stoplisty' && sig.some(function (s) { return s.as_of && STOP.test(s.title); })) return;
      else ne.push({ id: v.id, nazv: v.nazv, sam: v.sam });
    });
    return { polucheno: polucheno, ne_proveryali: ne, na: dataRu(r.checked_at) };
  }

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }); }

  /* HTML блока для report.html (строкой — как остальной отчёт). В печати ссылки остаются адресами. */
  function html(o) {
    var li = function (x) {
      var m = [x.ist, x.data ? 'на ' + x.data : ''].filter(Boolean).join(', ');
      return '<li class="cp-ok"><span class="cp-i" aria-hidden="true">●</span><span>' + esc(x.nazv) + (m ? '<small>' + esc(m) + '</small>' : '') + '</span></li>';
    };
    var li2 = function (x) {
      var sam = (x.sam || []).map(function (a) { return '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.tekst) + '</a>'; }).join(', ');
      return '<li class="cp-net"><span class="cp-i" aria-hidden="true">○</span><span>' + esc(x.nazv) + (sam ? '<small>Проверьте сами: ' + sam + '</small>' : '') + '</span></li>';
    };
    var h = '<div class="cp">';
    h += '<h3>Получено' + (o.na ? ' при проверке ' + esc(o.na) : '') + ' — ' + o.polucheno.length + '</h3>';
    h += o.polucheno.length ? '<ul>' + o.polucheno.map(li).join('') + '</ul>' : '<p class="cp-p">Сведений из источников в ответе нет.</p>';
    if (o.ne_proveryali.length) {
      h += '<h3>Не проверяли — ' + o.ne_proveryali.length + '</h3>';
      h += '<p class="cp-p">Источник не подключён или не ответил. Это не значит, что там ничего нет.</p>';
      h += '<ul>' + o.ne_proveryali.map(li2).join('') + '</ul>';
    }
    return h + '</div>';
  }

  return { OZHIDAEM: OZHIDAEM, VNESHNIE: VNESHNIE, sobrat: sobrat, html: html, dataRu: dataRu };
});
