/* Делоскоп · Скорая 115-ФЗ — интерфейс. Всё локально, без сети. */
(function () {
  'use strict';
  var S = window.Skoraya;
  var KEY = 'deloskop.skoraya.v1';
  var $ = function (id) { return document.getElementById(id); };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function money(v) { var n = parseFloat(String(v || '').replace(/[^\d,.]/g, '').replace(',', '.')); return isFinite(n) ? n : 0; }

  var st = { sc: '', form: 'ooo', eventDate: '', dueDate: '', zskBank: 'cb', turnover: '', payroll: '', ops: [], checked: {}, lf: {}, letterEdited: false, letter: '', stmt: null };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && typeof saved === 'object') for (var k in saved) st[k] = saved[k]; } catch (e) { /* приватный режим */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ничего */ } }

  function toast(t) { var el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 1800); }

  /* ---------- Шаг 1 ---------- */
  var scBtns = document.querySelectorAll('#sc button');
  function paintSc() { scBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.sc === st.sc)); }); }
  scBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      st.sc = b.dataset.sc; st.letterEdited = false; paintSc(); paintStepB(); save();
      $('stepB').hidden = false;
      $('stepB').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ---------- Шаг 2 ---------- */
  var opsBox = $('ops');
  Object.keys(S.OPS).forEach(function (k) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'pill'; b.dataset.op = k; b.textContent = S.OPS[k].t;
    b.addEventListener('click', function () {
      var i = st.ops.indexOf(k); if (i >= 0) st.ops.splice(i, 1); else st.ops.push(k);
      paintOps(); save(); if (!$('out').hidden) render();
    });
    opsBox.appendChild(b);
  });
  function paintOps() { opsBox.querySelectorAll('.pill').forEach(function (b) { b.setAttribute('aria-pressed', String(st.ops.indexOf(b.dataset.op) >= 0)); }); }
  document.querySelectorAll('[data-form]').forEach(function (b) {
    b.addEventListener('click', function () { st.form = b.dataset.form; paintForm(); save(); if (!$('out').hidden) render(); });
  });
  function paintForm() { document.querySelectorAll('[data-form]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.form === st.form)); }); }
  function paintStepB() {
    $('dueWrap').hidden = st.sc !== 'zapros';
    $('zskWrap').hidden = st.sc !== 'zsk';
    $('payWrap').hidden = st.sc !== 'zsk';
  }
  [['eventDate', 'eventDate'], ['dueDate', 'dueDate'], ['zskBank', 'zskBank'], ['turnover', 'turnover'], ['payroll', 'payroll']].forEach(function (p) {
    var el = $(p[0]); el.value = st[p[1]] || (p[0] === 'zskBank' ? 'cb' : '');
    el.addEventListener('input', function () { st[p[1]] = el.value; save(); });
    el.addEventListener('change', function () { st[p[1]] = el.value; save(); if (!$('out').hidden) render(); });
  });
  ['turnover', 'payroll'].forEach(function (id) {
    $(id).addEventListener('blur', function () { var n = money(this.value); if (n > 0) { this.value = S.num(n); st[id] = this.value; save(); } });
  });

  /* Выписка */
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (ev) { readFiles(ev.dataTransfer.files); });
  $('file').addEventListener('change', function () { readFiles(this.files); this.value = ''; });
  function readFiles(files) {
    files = Array.prototype.slice.call(files || []); if (!files.length) return;
    Promise.all(files.map(function (f) { return f.arrayBuffer(); })).then(function (bufs) {
      var texts = bufs.map(function (b) { return S.decodeBytes(new Uint8Array(b)); });
      if (texts.some(function (t) { return !t; })) { showStmtErr('Не похоже на выписку 1С. В банке или 1С выберите «Выгрузить в 1С» — получится файл .txt.'); return; }
      /* несколько файлов: склеиваем документы, дубли отсеет движок */
      var head = texts[0].split(/СекцияДокумент/)[0];
      var body = texts.map(function (t) { var i = t.indexOf('СекцияДокумент'); return i >= 0 ? t.slice(i).replace(/КонецФайла\s*$/, '') : ''; }).join('\n');
      var r = S.parseStatement(head + body);
      if (!r.ok) { showStmtErr(r.error); return; }
      st.stmt = r;
      if (!money(st.turnover) && r.monthlyOut > 0) { st.turnover = S.num(r.monthlyOut); $('turnover').value = st.turnover; }
      if (r.cash > 0 && st.ops.indexOf('nalichnye') < 0) { st.ops.push('nalichnye'); paintOps(); }
      save(); paintStmt(); if (!$('out').hidden) render();
    });
  }
  function showStmtErr(t) { var el = $('stmt'); el.hidden = false; el.innerHTML = '<span style="color:var(--bad)">' + esc(t) + '</span>'; }
  function paintStmt() {
    var r = st.stmt, el = $('stmt'); if (!r) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = 'Выписка разобрана: ' + S.num(r.docs) + ' ' + S.plural(r.docs, 'операция', 'операции', 'операций') +
      (r.from ? ' с ' + S.humanY(r.from) + ' по ' + S.humanY(r.to) : '') + '. Списания в месяц — около ' + esc(S.rubShort(r.monthlyOut)) + '.' +
      (r.cash > 0 ? ' Наличными снято ' + esc(S.rubShort(r.cash)) + ' — ' + Math.round(r.cashShare * 100) + '% списаний.' : '');
  }

  $('go').addEventListener('click', function () {
    if (!st.sc) { $('stepA').scrollIntoView({ behavior: 'smooth' }); return; }
    render(); $('out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('reset').addEventListener('click', function () {
    try { localStorage.removeItem(KEY); } catch (e) { }
    location.reload();
  });

  /* ---------- Результат ---------- */
  function render() {
    var today = todayIso();
    var inp = { scenario: st.sc, today: today, eventDate: st.eventDate || today, dueDate: st.dueDate, zskBank: st.zskBank, form: st.form, turnover: money(st.turnover), payroll: money(st.payroll) };
    var p = S.buildPlan(inp);
    var h = [];
    h.push('<div class="verdict ' + p.info.tone + '"><small>' + esc(p.info.short) + '</small><b>' + esc(p.info.verdict) + '</b><p>' + esc(p.info.what) + '</p></div>');

    h.push('<div class="sec"><h3>Три дела на сегодня</h3><ol class="three">' + p.tasks.map(function (t) { return '<li><span>' + linkify(esc(t)) + '</span></li>'; }).join('') + '</ol></div>');

    h.push('<div class="sec"><h3>Сроки</h3><ol class="tl">' + p.steps.map(function (s) {
      var yr = +today.slice(0, 4);
      var d = s.date ? '<div class="d' + (s.isToday ? ' today' : '') + '">' + (s.isToday ? 'Сегодня' : esc(S.humanShort(s.date))) + '<em>' + (s.isToday ? esc(S.humanShort(s.date)) : (+s.date.slice(0, 4) !== yr ? s.date.slice(0, 4) + ', ' : '') + esc(S.weekday(s.date))) + '</em></div>' : '<div class="d">—</div>';
      return '<li class="' + s.kind + (s.passed ? ' passed' : '') + '">' + d + '<div class="t">' + esc(s.label) + (s.note ? '<i>' + esc(s.note) + '</i>' : '') + (s.basis ? '<span class="basis">' + esc(s.basis) + '</span>' : '') + '</div></li>';
    }).join('') + '</ol><div class="legend"><span><i class="y"></i>ваш шаг</span><span><i></i>шаг банка</span><span><i class="r"></i>срок ответа</span><span><i class="l"></i>последний день</span></div>' +
      (p.calendarNote ? '<p class="note">' + esc(p.calendarNote) + '</p>' : '') + '</div>');

    h.push('<div class="sec"><h3>' + esc(p.works.title) + '</h3><div class="box"><ul>' + p.works.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' + (p.works.basis ? '<p class="basis" style="margin:8px 0 0">' + esc(p.works.basis) + '</p>' : '') + '</div></div>');

    if (p.money) {
      h.push('<div class="sec"><h3>Сколько денег встанет в пути</h3><div class="money">' +
        '<div><b>' + esc(S.rubShort(p.money.perDay)) + '</b><span>платежей в каждый рабочий день ограничения</span></div>' +
        '<div><b>' + esc(S.rubShort(p.money.fast.sum)) + '</b><span>' + esc(p.money.fast.label) + ' — ' + p.money.fast.days + ' ' + S.plural(p.money.fast.days, 'рабочий день', 'рабочих дня', 'рабочих дней') + '</span></div>' +
        '<div><b>' + esc(S.rubShort(p.money.slow.sum)) + '</b><span>' + esc(p.money.slow.label) + ' — до ' + p.money.slow.days + ' ' + S.plural(p.money.slow.days, 'рабочего дня', 'рабочих дней', 'рабочих дней') + '</span></div>' +
        '</div><p class="note">Это не убыток, а платежи, которые задержатся: поставщикам, сотрудникам, налоговой. Каждый день, выигранный быстрым и полным ответом, возвращает ' + esc(S.rubShort(p.money.perDay)) + ' в оборот.</p></div>');
    }

    var cashOp = st.ops.indexOf('nalichnye') >= 0 || (st.stmt && st.stmt.cash > 0);
    if (cashOp) {
      var cs = st.stmt && st.stmt.cash > 0 ? 'По выписке наличными ушло ' + S.rubShort(st.stmt.cash) + ' — ' + Math.round(st.stmt.cashShare * 100) + '% всех списаний. ' : '';
      h.push('<div class="sec"><h3>Наличные — отдельное внимание</h3><div class="box"><p style="margin:0;color:var(--ink2)">' + esc(cs) + 'Банк смотрит не на сам факт снятия, а на то, объяснима ли цель и сходится ли она с документами. Покажите, на что ушли деньги: ведомости, авансовые отчёты с чеками, закупочные акты. Налоги и зарплату платите безналично — это самый сильный аргумент. Подробнее — в статье <a href="/115-fz/snyatie-nalichnyh-s-raschetnogo-scheta/">о снятии наличных</a>.</p></div></div>');
    }

    var groups = S.docsFor(st.ops, p.scenario);
    h.push('<div class="sec docs"><h3>Документы</h3><p class="note" style="margin:0 0 10px">Отмеченное попадёт в список приложений к письму.</p>' + groups.map(function (g, gi) {
      var mvkExtra = '';
      if (g.mvk && st.stmt && (st.stmt.topIn.length || st.stmt.topOut.length)) {
        mvkExtra = '<div class="stmt"><b>Из вашей выписки — крупнейшие контрагенты</b>' + tbl('Поступления', st.stmt.topIn) + tbl('Списания', st.stmt.topOut) + '<p class="note">Для комиссии нужны операции с 1 января прошлого года — проверьте, что выписка покрывает этот период.</p></div>';
      }
      return '<fieldset class="' + (g.mvk ? 'mvk' : '') + '"><legend>' + esc(g.group) + '</legend>' + g.items.map(function (it, ii) {
        var id = 'd' + gi + '_' + ii, on = st.checked[it] ? ' checked' : '';
        return '<label for="' + id + '"><input type="checkbox" id="' + id + '" data-doc="' + esc(it) + '"' + on + '><span>' + esc(it) + '</span></label>';
      }).join('') + mvkExtra + '</fieldset>';
    }).join('') + '</div>');

    h.push('<div class="sec letter"><h3>' + esc(letterTitle(p.scenario)) + '</h3><div class="grid noprint">' + letterFields(p.scenario) + '</div>' +
      '<div class="f" style="margin-top:14px"><label for="letter">Черновик — можно править прямо здесь</label><textarea id="letter" spellcheck="true"></textarea></div>' +
      '<div class="acts"><button type="button" class="pri" id="copy">Скопировать</button><button type="button" id="dl">Скачать для Word</button><button type="button" id="pr">Распечатать план и письмо</button><button type="button" id="rebuild" hidden>Пересобрать из полей</button></div></div>');

    h.push('<div class="sec"><h3>Чего не делать</h3><ul class="dont">' + p.dont.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>');

    h.push('<div class="upsell"><h3>Чтобы не возвращаться сюда</h3><p>Большинство ограничений предсказуемо: доля налогов, наличные, транзит, ненадёжные поставщики. Щит Делоскопа показывает вашу компанию глазами банка и налоговой — до того, как вопросы задаст банк.</p><a href="/#shield">Открыть Щит</a></div>');

    var out = $('out'); out.innerHTML = h.join(''); out.hidden = false;
    wire(p.scenario);
  }
  function linkify(s) {
    return s.replace('сервис ФНС «Банкинформ»', '<a href="https://service.nalog.ru/bi.do" target="_blank" rel="noopener">сервис ФНС «Банкинформ»</a>')
      .replace('на сайте Банка России', '<a href="https://cbr.ru/counteraction_m_ter/platform_zsk" target="_blank" rel="noopener">на сайте Банка России</a>');
  }
  function tbl(title, rows) {
    if (!rows.length) return '';
    return '<table><tr><th>' + esc(title) + '</th><th>ИНН</th><th class="n">Сумма</th></tr>' + rows.map(function (r) { return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.inn || '—') + '</td><td class="n">' + esc(S.rub(r.sum)) + '</td></tr>'; }).join('') + '</table>';
  }
  function letterTitle(sc) {
    return { zapros: 'Ответ на запрос банка', otkaz: 'Заявление в банк', dbo: 'Заявление в банк', rastorzhenie: 'Заявление об остатке', zsk: st.zskBank === 'bank' ? 'Заявление в межведомственную комиссию' : 'Заявление в Банк России', unknown: 'Заявление в банк' }[sc];
  }
  var LF = {
    bank: ['Банк', 'АО «Банк»'], company: ['Компания или ИП', 'ООО «Леон»'], inn: ['ИНН', '10 или 12 цифр'], account: ['Расчётный счёт', '40702810…'],
    reqNo: ['Номер запроса', ''], opDate: ['Дата операции', ''], opSum: ['Сумма операции, ₽', ''], opCounterparty: ['Контрагент', 'ООО «Ромашка», ИНН …'],
    newBank: ['Новый банк и БИК', ''], newAccount: ['Новый счёт', ''], contact: ['Телефон или почта для связи', ''], signer: ['Кто подписывает', 'Генеральный директор И. И. Иванов'],
    explanation: ['Суть: кто контрагент, за что платёж, где подтверждение', '']
  };
  function fieldsFor(sc) {
    var f = ['bank', 'company', 'inn', 'account'];
    if (sc === 'zapros') f.push('reqNo');
    if (sc === 'otkaz' || sc === 'zapros' || sc === 'unknown') f.push('opDate', 'opSum', 'opCounterparty');
    if (sc === 'rastorzhenie') f.push('newBank', 'newAccount');
    if (sc === 'zsk') f = ['company', 'inn'];
    f.push('contact', 'signer', 'explanation');
    return f;
  }
  function letterFields(sc) {
    return fieldsFor(sc).map(function (k) {
      var type = k === 'opDate' ? 'date' : 'text', v = esc(st.lf[k] || ''), lbl = esc(LF[k][0]), ph = esc(LF[k][1]);
      if (k === 'explanation') return '<div class="f full"><label for="lf_' + k + '">' + lbl + '</label><textarea id="lf_' + k + '" data-lf="' + k + '" placeholder="Например: ООО «Ромашка» — наш поставщик упаковки с 2024 года. Платёж 120 000 ₽ — по счёту № 45 за партию коробок, поставка 23 сентября по УПД № 118. Сумма соответствует обычным закупкам: за последние 6 месяцев 5 таких поставок.">' + v + '</textarea></div>';
      return '<div class="f"><label for="lf_' + k + '">' + lbl + '</label><input id="lf_' + k + '" type="' + type + '" data-lf="' + k + '" placeholder="' + ph + '" value="' + v + '"' + (k === 'inn' ? ' inputmode="numeric" maxlength="12"' : '') + (k === 'opSum' ? ' inputmode="numeric"' : '') + '></div>';
    }).join('');
  }
  function attachments() {
    var list = []; document.querySelectorAll('#out [data-doc]').forEach(function (c) { if (c.checked) list.push(c.dataset.doc); }); return list;
  }
  function composeLetter(sc) {
    var f = {}; for (var k in st.lf) f[k] = st.lf[k];
    f.opSum = money(st.lf.opSum); f.today = todayIso(); f.eventDate = st.eventDate; f.zskBank = st.zskBank;
    return S.buildLetter(sc, f, attachments());
  }
  function wire(sc) {
    var ta = $('letter');
    ta.value = st.letterEdited && st.letter ? st.letter : composeLetter(sc);
    $('rebuild').hidden = !st.letterEdited;
    function regen() { if (!st.letterEdited) { ta.value = composeLetter(sc); st.letter = ta.value; save(); } }
    document.querySelectorAll('#out [data-lf]').forEach(function (el) { el.addEventListener('input', function () { st.lf[el.dataset.lf] = el.value; save(); regen(); }); });
    document.querySelectorAll('#out [data-doc]').forEach(function (c) { c.addEventListener('change', function () { if (c.checked) st.checked[c.dataset.doc] = 1; else delete st.checked[c.dataset.doc]; save(); regen(); }); });
    ta.addEventListener('input', function () { st.letterEdited = true; st.letter = ta.value; $('rebuild').hidden = false; save(); });
    $('rebuild').addEventListener('click', function () { st.letterEdited = false; ta.value = composeLetter(sc); st.letter = ta.value; this.hidden = true; save(); });
    $('copy').addEventListener('click', function () {
      var done = function () { toast('Скопировано'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, function () { ta.select(); document.execCommand('copy'); done(); });
      else { ta.select(); document.execCommand('copy'); done(); }
    });
    $('dl').addEventListener('click', function () {
      var html = '<html><head><meta charset="utf-8"><style>body{font-family:"Times New Roman",serif;font-size:14pt;line-height:1.5}p{margin:0 0 10pt}</style></head><body>' +
        ta.value.split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('') + '</body></html>';
      var blob = new Blob(['﻿', html], { type: 'application/msword' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'deloskop-zayavlenie.doc';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    $('pr').addEventListener('click', function () { ta.style.height = ta.scrollHeight + 'px'; window.print(); });
  }

  /* ---------- Старт ---------- */
  paintSc(); paintOps(); paintForm(); paintStepB(); paintStmt();
  if (!st.eventDate) { $('eventDate').value = todayIso(); }
  if (st.sc) { $('stepB').hidden = false; }
  var q = new URLSearchParams(location.search).get('s');
  if (q && S.SCENARIOS[q]) { st.sc = q; paintSc(); paintStepB(); $('stepB').hidden = false; }
})();
