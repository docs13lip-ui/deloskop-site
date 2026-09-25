/*! Делоскоп · Щит · «Наличные глазами банка» — интерфейс. Ничего не отправляет в сеть. */
(function () {
  'use strict';
  var E = window.DeloskopShield, TX = window.DeloskopShieldTexts, DEMO = window.DeloskopShieldDemo;
  var $ = function (id) { return document.getElementById(id); };
  var drop = $('drop'), file = $('file'), out = $('out'), msg = $('msg'), cashbiz = $('cashbiz');
  var MAX = 20 * 1024 * 1024, last = null;

  /* ---------- Типографика по «Ководству»: 41,5%, 1 265 000 ₽, неразрывные пробелы ---------- */
  var NB = ' ', TH = ' ';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function grp(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, TH); }
  function rub(x) {
    x = Math.round(x || 0);
    if (Math.abs(x) >= 1e6) {
      var m = x / 1e6, s = (Math.abs(m) >= 100 ? Math.round(m) : Math.round(m * 10) / 10).toString().replace('.', ',');
      return s + NB + 'млн' + NB + '₽';
    }
    return grp(x) + NB + '₽';
  }
  function rubFull(x) { return grp(Math.round(x || 0)) + NB + '₽'; }
  function pct(x) {
    var v = (x || 0) * 100;
    var s = v >= 10 || v === 0 ? String(Math.round(v)) : String(Math.round(v * 10) / 10).replace('.', ',');
    return s + '%';
  }
  var MONTH_IN = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
  var MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  var MONTH_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function dateRu(t) { var d = new Date(t); return d.getUTCDate() + NB + MONTH_GEN[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  function monthRu(key) { var p = key.split('-'); return MONTH_IN[+p[1] - 1] + ' ' + p[0]; }

  function vars(s, r) {
    return {
      share: pct(s.value), sharePer100: Math.round((s.value || 0) * 100), amount: rub(s.amount), count: s.count,
      days: s.days, window: s.window, month: s.month ? monthRu(s.month) : '', avg: s.id === 'deposit_big' ? rub(s.avg) : pct(s.avg),
      risk: rub(s.risk), week: s.weekStart ? dateRu(s.weekStart) : ''
    };
  }
  function signalText(s, r) {
    var t = TX.signals[s.id]; if (!t) return '';
    var v = vars(s, r);
    if (s.id === 'deposit_big') v.amount = rub(s.value);
    if (s.id === 'vague_cash') v.amount = rub(s.value);
    if (s.id === 'big_cash') v.count = s.value;
    if (s.level === 0 && t.calm) return E.fill(t.calm, v);
    if (s.id === 'tax_share' && !s.amount && t.zero) { v.turnover = rub(r.totals.inCp); return E.fill(t.zero, v); }
    var tpl = s.id === 'big_cash' && s.note === 'ip' && t.textIP ? t.textIP : E.pickVariant(t.text, r.client.inn, s.id);
    return E.fill(tpl, v);
  }

  var ICON = [
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M7.5 12.5l3 3 6-6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 7v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1.3" fill="currentColor"/></svg>',
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l10 18H2L12 3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="18" r="1.2" fill="currentColor"/></svg>'
  ];
  var ST = ['в норме', 'внимание', 'опасно'];
  function status(level) { return '<span class="st s' + level + '">' + ICON[level].replace('width="22" height="22"', 'width="14" height="14"') + ST[level] + '</span>'; }
  function sigLevel(r, id) { for (var i = 0; i < r.signals.length; i++) if (r.signals[i].id === id) return r.signals[i].level; return 0; }

  function render(r, isDemo) {
    var L = TX.levels[r.level], h = [];
    var who = isDemo ? 'Пример · вымышленная компания' : (esc(r.client.name || 'Ваша компания') + (r.client.inn ? ' · ИНН ' + esc(r.client.inn) : ''));
    h.push('<section class="verdict l' + r.level + '" aria-live="polite"><div class="who">' + who + ' · ' + dateRu(r.period.start) + ' — ' + dateRu(r.period.end) + '</div>' +
      '<div class="big">' + ICON[r.level] + esc(L.name) + '</div>' +
      '<p><b>Риск вопросов и блокировки со стороны банка: ' + L.block + '.</b> ' + esc(L.lead) + '</p></section>');

    h.push('<div class="tiles">' +
      '<div class="tile"><small>Наличными от расходов</small><b>' + pct(r.shares.cash) + '</b><span>' + rub(r.totals.cashOut) + '</span><br>' + status(sigLevel(r, 'cash_share')) + '</div>' +
      '<div class="tile"><small>Транзит за ' + E.CONFIG.transitDays + NB + 'рабочих дня</small><b>' + pct(r.shares.transit) + '</b><span>поступлений ушло в наличные или «себе»</span><br>' + status(sigLevel(r, 'transit')) + '</div>' +
      '<div class="tile"><small>Налоги к обороту</small><b>' + pct(r.shares.tax) + '</b><span>ориентир банков — 0,9%</span><br>' + status(sigLevel(r, 'tax_share')) + '</div>' +
      '</div>');

    var m = r.money;
    h.push('<section class="money"><small>Встанет, если банк ограничит счёт на ' + m.blockDays + NB + 'рабочих дней</small><div class="sum">' + rubFull(m.atStake) + '</div>' +
      '<p>Столько денег окажется недоступно на время проверки: остаток на счёте и поступления, которые придут за эти дни. Это оценка по вашей выписке — Щит нужен, чтобы до этого не дошло.</p>' +
      '<div class="split"><div>Остаток на счёте<b>' + rub(m.balance) + '</b></div><div>Поступления за ' + m.blockDays + NB + 'рабочих дней<b>' + rub(m.inflowAtStake) + '</b></div>' +
      (m.hiddenSalaryRisk ? '<div>Риск доначислений по «наличным без следа»<b>до ' + rub(m.hiddenSalaryRisk) + '</b></div>' : '') + '</div></section>');

    if (r.todo.length) {
      h.push('<section class="todo"><h2>Три дела на эту неделю</h2><ol>');
      r.todo.forEach(function (id) { var t = TX.signals[id]; h.push('<li><b>' + esc(t.title) + '.</b> ' + esc(t.todo[0]) + '</li>'); });
      h.push('</ol></section>');
    }

    if (r.months.length) {
      var maxV = Math.max(0.35, Math.max.apply(null, r.months.map(function (x) { return x.cashShare; })) * 1.15);
      var refPct = E.CONFIG.weekCashShare / maxV * 100;
      h.push('<section class="chart"><h2>Доля наличных в расходах по месяцам</h2><div class="sub">Пунктир — 30%: доля, которую Банк России считает признаком обналичивания через карты за неделю</div>' +
        '<div class="bars" role="img" aria-label="Доля наличных по месяцам: ' + r.months.map(function (x) { return monthRu(x.key) + ' — ' + pct(x.cashShare); }).join(', ') + '">' +
        '<div class="ref" style="bottom:' + refPct.toFixed(1) + '%"><span>30%</span></div>');
      r.months.forEach(function (x) {
        h.push('<div class="bar" tabindex="0"><div class="tip">' + monthRu(x.key) + ': наличными ' + rub(x.cashOut) + ' из ' + rub(x.outAll) + '</div><em>' + pct(x.cashShare) + '</em><i style="height:' + (x.cashShare / maxV * 100).toFixed(1) + '%"></i></div>');
      });
      h.push('</div><div class="months">' + r.months.map(function (x) { var p = x.key.split('-'); return '<span>' + MONTH_SHORT[+p[1] - 1] + '</span>'; }).join('') + '</div></section>');
    }

    var act = r.signals.filter(function (s) { return s.level > 0; }).sort(function (a, b) { return b.level - a.level; });
    if (act.length) {
      h.push('<section class="sig-wrap"><h2>Что увидит банк</h2>');
      act.forEach(function (s) {
        var t = TX.signals[s.id];
        h.push('<article class="sig"><div class="hd"><h3>' + esc(t.title) + '</h3>' + status(s.level) + '</div><p>' + esc(signalText(s, r)) + '</p><ul>' +
          t.todo.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><div class="src2">Основание: ' + esc(s.source) + '</div></article>');
      });
      h.push('</section>');
    }

    if (r.strengths.length) {
      h.push('<section class="strong"><h2>Что уже хорошо</h2><ul>' + r.strengths.map(function (k) { return '<li>' + esc(TX.strengths[k]) + '</li>'; }).join('') + '</ul></section>');
    }

    var notes = r.warnings.slice();
    if (r.counts.skipped) notes.push('Пропущено документов без суммы или даты: ' + r.counts.skipped + '.');
    if (r.totals.tax === 0) notes.push('С этого счёта не видно налоговых платежей. Если налоги платятся с другого счёта — загрузите и его выписку.');
    h.push('<div class="after"><button class="btn2" type="button" id="print">Сохранить отчёт в PDF</button><button class="ghost" type="button" id="again">Разобрать другую выписку</button></div>' +
      '<p class="note">Документов в выписке: ' + r.counts.docs + '. ' + esc(notes.join(' ')) + ' Расчёт — оценка по открытым правилам Банка России и 115-ФЗ, а не решение банка. Пороги: версия ' + esc(r.version) + '.</p>');

    out.innerHTML = h.join('');
    out.hidden = false;
    $('print').onclick = function () { window.print(); };
    $('again').onclick = function () { out.hidden = true; file.value = ''; msg.textContent = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); };
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function run(input, isDemo) {
    try {
      var p = E.parse1C(input);
      last = { p: p, demo: isDemo };
      var r = E.analyze(p, { cashBusiness: cashbiz.checked });
      msg.textContent = isDemo ? 'Это пример на вымышленной компании. Загрузите свою выписку — разбор займёт секунды.' : 'Готово. Файл разобран на вашем компьютере.';
      render(r, isDemo);
    } catch (e) {
      out.hidden = true;
      msg.textContent = (TX.errors[e.message] || 'Не удалось прочитать файл. Нужна выписка в формате 1С (текстовый файл).');
    }
  }

  function readFile(f) {
    if (!f) return;
    if (f.size > MAX) { msg.textContent = TX.errors.TOO_BIG; return; }
    msg.textContent = 'Читаем выписку…';
    var fr = new FileReader();
    fr.onload = function () { run(new Uint8Array(fr.result), false); };
    fr.onerror = function () { msg.textContent = 'Не удалось открыть файл.'; };
    fr.readAsArrayBuffer(f);
  }

  file.addEventListener('change', function () { readFile(file.files[0]); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
  $('demo').addEventListener('click', function () { run(DEMO.demo(), true); });
  cashbiz.addEventListener('change', function () { if (last) { var r = E.analyze(last.p, { cashBusiness: cashbiz.checked }); render(r, last.demo); } });
})();
