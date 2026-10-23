/* Делоскоп — «Перепроверить до…» и напоминание в календаре (23.10.2026).
 * Под реквизитами отчёта одна строка: «Перепроверить до {дата проверки + 30 дней}» и кнопка «Напомнить в календаре».
 * Почему 30 дней: открытые наборы ФНС (недоимка, численность, налоги, спецрежимы) обновляются раз в месяц,
 * а запись ЕГРЮЛ может смениться в любой день — проверка не на всю жизнь.
 * Файл .ics (RFC 5545) собирается в браузере: на сервер ничего не уходит, в файле — только название компании,
 * ИНН и ссылка на новую проверку. Событие — на весь день, за день до даты «Перепроверить до».
 * Чистые функции (srok, ics) — без DOM и сети, их проверяет tests/perepoverit.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Perepoverit = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DNEJ = 30;
  var NB = '\u00a0';
  var SAJT = 'https://deloskop.ru/';

  function z(n) { return (n < 10 ? '0' : '') + n; }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // день проверки по Москве (UTC+3): «2026-10-23» как есть; момент — в московский день
  function denProverki(s) {
    s = String(s || '').trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var t = Date.parse(s);
    if (!isFinite(t)) return null;
    var d = new Date(t + 3 * 3600 * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  function ru(t) { var d = new Date(t); return z(d.getUTCDate()) + '.' + z(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }
  function ymd(t) { var d = new Date(t); return d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate()); }
  function chistyjInn(s) { s = String(s == null ? '' : s).replace(/\D/g, ''); return /^(\d{10}|\d{12})$/.test(s) ? s : ''; }

  /* { inn, imya, proveren: 'ДД.ММ.ГГГГ', do: 'ДД.ММ.ГГГГ', napomnit: 'ГГГГММДД', konec: 'ГГГГММДД', ssylka } | null */
  function srok(r) {
    if (!r || !r.company) return null;
    var c = r.company;
    var inn = chistyjInn(c.inn);
    var den = denProverki(r.checked_at);
    if (!inn || den == null) return null;
    var dodo = den + DNEJ * 864e5;
    return {
      inn: inn,
      imya: String(c.name_short || c.name_full || ('ИНН ' + inn)).replace(/\s+/g, ' ').trim(),
      proveren: ru(den), 'do': ru(dodo),
      napomnit: ymd(dodo - 864e5), konec: ymd(dodo),
      ssylka: SAJT + '?inn=' + inn + '&utm_source=ics'
    };
  }

  // RFC 5545 §3.3.11: \ ; , и перевод строки — экранируются
  function tekst(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  // RFC 5545 §3.1: строка не длиннее 75 октетов, продолжение — CRLF + пробел; символ UTF-8 не режем
  function slozhit(line) {
    var out = [], cur = '', n = 0, lim = 75;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i], code = line.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < line.length) { ch += line[++i]; }
      var b = ch.length > 1 ? 4 : code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
      if (n + b > lim) { out.push(cur); cur = ' '; n = 1; lim = 75; }
      cur += ch; n += b;
    }
    out.push(cur);
    return out.join('\r\n');
  }
  function shtamp(t) {
    var d = new Date(t);
    return d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate()) + 'T' + z(d.getUTCHours()) + z(d.getUTCMinutes()) + z(d.getUTCSeconds()) + 'Z';
  }

  // текст файла .ics; seichas — мс (для DTSTAMP), по умолчанию — сейчас
  function ics(s, seichas) {
    if (!s) return '';
    var zag = 'Перепроверить ' + s.imya + ' перед следующей оплатой';
    var opis = 'Проверка в Делоскопе от ' + s.proveren + '. Перепроверить до ' + s['do'] +
      ': сведения реестров меняются, открытые данные ФНС обновляются раз в месяц.\n' + s.ssylka;
    var L = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Deloskop//Perepoverit//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:perepoverit-' + s.inn + '-' + s.konec + '@deloskop.ru',
      'DTSTAMP:' + shtamp(seichas == null ? Date.now() : seichas),
      'DTSTART;VALUE=DATE:' + s.napomnit,
      'DTEND;VALUE=DATE:' + s.konec,
      'SUMMARY:' + tekst(zag),
      'DESCRIPTION:' + tekst(opis),
      'URL:' + s.ssylka,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT9H', 'DESCRIPTION:' + tekst(zag), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ];
    return L.map(slozhit).join('\r\n') + '\r\n';
  }

  var POCHEMU = 'Сведения реестров меняются: запись ЕГРЮЛ — в любой день, открытые данные ФНС обновляются раз в' + NB + 'месяц.';
  var KNOPKA = '<button type="button" class="pp__b" data-act="ics">Напомнить в' + NB + 'календаре</button>';

  // клетка реквизитов (как «Проверено»): срок + кнопка; заменяет пустую клетку сетки 2 × 2
  function kletka(s) {
    if (!s) return '';
    return '<div class="rkv__pp" data-pp><dt title="' + esc(POCHEMU) + '">Перепроверить до</dt><dd>' + esc(s['do']) +
      '<small>через ' + DNEJ + NB + 'дней после проверки</small>' + KNOPKA + '</dd></div>';
  }
  // отдельная строка — если реквизитов нет
  function html(s) {
    if (!s) return '';
    return '<div class="pp" data-pp><p class="pp__t">Перепроверить до <b>' + esc(s['do']) + '</b>' +
      '<small>' + esc(POCHEMU) + '</small></p>' + KNOPKA + '</div>';
  }

  var CSS = '.pp{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;padding:12px 0;border-bottom:1px solid var(--line,#E6E6E1)}' +
    '.pp__t{margin:0;font-size:var(--t-15,15px);color:var(--ink,#1D1D1F);min-width:0}' +
    '.pp__t b{font-weight:600;font-variant-numeric:tabular-nums}' +
    '.pp__t small{display:block;font-size:var(--t-13,13px);color:var(--muted,#6B6B70);margin-top:2px}' +
    '.pp__b{min-height:44px;border:1px solid var(--line,#D9D9D4);background:transparent;font:inherit;font-size:var(--t-15,15px);font-weight:600;' +
    'border-radius:var(--r-small,10px);padding:10px 16px;cursor:pointer;color:var(--ink,#1D1D1F)}' +
    '.pp__b:hover,.pp__b:focus-visible{border-color:var(--accent,#0B63E5);color:var(--accent,#0B63E5)}' +
    '.rkv__pp .pp__b{display:block;margin-top:2px;min-height:44px;padding:0;border:0;font-size:var(--t-13,13px);color:var(--accent,#0B63E5);text-align:left;text-decoration:underline;text-underline-offset:3px}' +
    '.rkv__pp .pp__b:hover,.rkv__pp .pp__b:focus-visible{text-decoration-thickness:2px}' +
    '@media (max-width:600px){.pp .pp__b{width:100%}}' +
    '@media print{.pp__b{display:none!important}}';

  function stil(doc) {
    if (!doc || doc.getElementById('pp-css')) return;
    var st = doc.createElement('style'); st.id = 'pp-css'; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st);
  }

  function skachat(doc, s) {
    var txt = ics(s);
    var imya = 'perepoverit-' + s.inn + '.ics';
    var url, blob = null;
    try { blob = new Blob([txt], { type: 'text/calendar;charset=utf-8' }); url = URL.createObjectURL(blob); }
    catch (e) { url = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(txt); }
    var a = doc.createElement('a');
    a.href = url; a.download = imya; a.rel = 'noopener'; a.style.display = 'none';
    (doc.body || doc.documentElement).appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); if (blob) try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
  }

  // Браузер: строка — сразу под реквизитами (или под шапкой отчёта). Своя компания («Щит») — без строки.
  function mount(report, r) {
    if (!report) return false;
    var s = srok(r);
    if (!s) return false;
    var doc = report.ownerDocument || document;
    try { stil(doc); } catch (e) {}
    var rkv = report.querySelector('.rkv');
    var w = doc.createElement(rkv ? 'dl' : 'div');
    w.innerHTML = rkv ? kletka(s) : html(s);
    var el = w.firstChild;
    var pod = report.querySelector('.report-head');
    if (rkv) rkv.appendChild(el);
    else if (pod && pod.parentNode) pod.parentNode.insertBefore(el, pod.nextSibling);
    else report.insertBefore(el, report.firstChild);
    var b = el.querySelector('[data-act="ics"]');
    if (b) b.onclick = function () {
      try { skachat(doc, s); } catch (e) {}
      try { if (window.dlkGoal) window.dlkGoal('perepoverit_ics'); } catch (e) {}
      b.textContent = 'Файл календаря скачан';
    };
    return true;
  }

  return { srok: srok, ics: ics, html: html, kletka: kletka, mount: mount, slozhit: slozhit, DNEJ: DNEJ, CSS: CSS };
});
