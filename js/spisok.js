/*
 * Делоскоп · «Проверка справочника контрагентов» (spisok-iz-1s-v1, 19.11.2026; п. 21 заданий Штаба,
 * рамка юристов 30.10 «Делоскоп: проверка справочника контрагентов»).
 *
 * Человек выгружает справочник «Контрагенты» из учётной программы (xlsx или csv) или вставляет столбец ИНН.
 * Файл разбирается здесь, в браузере. На сервер (POST /api/spisok) уходят ТОЛЬКО 10-значные ИНН организаций
 * с верной контрольной цифрой; названия из файла остаются на экране человека. 12-значные (ИП и граждане) —
 * считаем и не отправляем. До 200 организаций за раз.
 *
 * Слова итога — те же, что в отчёте: «Остаток: задолженность по налогам…» меньше 500 ₽ — не минус
 * (nalog-ostatok-otcheta-v1); смена руководителя — без ФИО (povtor-rukovoditel-v1). Сервер отвечает по своей
 * базе за 30 дней и только по ЕГРЮЛ и открытым данным ФНС — суды, приставы и банкротство в итог списка не входят,
 * так и пишем («Не проверяли в списке»).
 * Чистые функции — для Node (tests/spisok.test.js); mount — интерфейс.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DlkSpisok = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NB = '\u00a0';
  var MAKS = 200, OSTATOK_DO = 500;

  // ---------- ИНН ----------
  function kontrol(s, ves) { var x = 0; for (var i = 0; i < ves.length; i++) x += ves[i] * +s.charAt(i); return x % 11 % 10; }
  function innOk(s) {
    s = String(s || '');
    if (/^\d{10}$/.test(s)) return kontrol(s, [2, 4, 10, 3, 5, 9, 4, 6, 8]) === +s.charAt(9);
    if (/^\d{12}$/.test(s)) return kontrol(s, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === +s.charAt(10) && kontrol(s, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === +s.charAt(11);
    return false;
  }
  // «7707083893/770701001», «ИНН 7707083893», «7707083893.0» (число в Excel) → «7707083893»
  function innIzYachejki(v) {
    var t = String(v == null ? '' : v).replace(/[\s\u00a0]/g, '').replace(/\.0+$/, '');
    var m = /^(?:ИНН:?)?(\d{12}|\d{10})(?:$|[\/\\,;|]|КПП)/i.exec(t);
    return m ? m[1] : null;
  }

  // ---------- текст: кодировка и CSV ----------
  function tekstIzBajtov(buf) {
    var u = new Uint8Array(buf);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u).replace(/^﻿/, ''); } catch (_) { /* не UTF-8 — выгрузки 1С бывают в windows-1251 */ }
    try { return new TextDecoder('windows-1251').decode(u); } catch (_) { return new TextDecoder('utf-8').decode(u); }
  }
  function razdelitel(str) {
    var pervye = str.split(/\r?\n/).slice(0, 20).join('\n'), luchshij = ';', n = -1;
    [';', '\t', ','].forEach(function (d) { var k = pervye.split(d).length; if (k > n) { n = k; luchshij = d; } });
    return luchshij;
  }
  function csv(str) {
    var d = razdelitel(str), stroki = [], r = [], pole = '', kav = false;
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      if (kav) { if (c === '"') { if (str.charAt(i + 1) === '"') { pole += '"'; i++; } else kav = false; } else pole += c; continue; }
      if (c === '"' && pole === '') kav = true;
      else if (c === d) { r.push(pole); pole = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && str.charAt(i + 1) === '\n') i++; r.push(pole); stroki.push(r); r = []; pole = ''; }
      else pole += c;
    }
    if (pole !== '' || r.length) { r.push(pole); stroki.push(r); }
    return stroki.filter(function (x) { return x.some(function (y) { return String(y).trim(); }); });
  }

  // ---------- xlsx: свой разбор zip (без внешних библиотек) ----------
  function u16(b, i) { return b[i] | (b[i + 1] << 8); }
  function u32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 16777216; }
  function zipFajly(buf) {
    var b = new Uint8Array(buf), konec = -1;
    for (var i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { konec = i; break; }
    if (konec < 0) throw new Error('ne_zip');
    var n = u16(b, konec + 10), p = u32(b, konec + 16), fajly = {}, dek = new TextDecoder('utf-8');
    for (var k = 0; k < n; k++) {
      if (u32(b, p) !== 0x02014b50) break;
      var metod = u16(b, p + 10), szh = u32(b, p + 20), dl = u16(b, p + 28), dop = u16(b, p + 30), kom = u16(b, p + 32), lok = u32(b, p + 42);
      var imya = dek.decode(b.subarray(p + 46, p + 46 + dl));
      var nachalo = lok + 30 + u16(b, lok + 26) + u16(b, lok + 28);
      fajly[imya] = { metod: metod, dannye: b.subarray(nachalo, nachalo + szh) };
      p += 46 + dl + dop + kom;
    }
    return fajly;
  }
  function raspakovat(f) {
    if (f.metod === 0) return Promise.resolve(new TextDecoder('utf-8').decode(f.dannye));
    if (f.metod !== 8 || typeof DecompressionStream === 'undefined') return Promise.reject(new Error('ne_raspakovat'));
    var potok = new Blob([f.dannye]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(potok).text();
  }
  function xmlTekst(s) {
    return String(s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); }).replace(/&amp;/g, '&');
  }
  function stolbec(ref) { var m = /^([A-Z]+)/.exec(ref || ''), n = 0; if (!m) return -1; for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return n - 1; }
  // лист → строки; общие строки (sharedStrings) — по номеру; формулы — по сохранённому значению <v>
  function listVStroki(xml, obshchie) {
    var stroki = [];
    (xml.match(/<row\b[\s\S]*?<\/row>/g) || []).forEach(function (row) {
      var r = [], sled = 0;
      (row.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []).forEach(function (c) {
        var ref = /\br="([A-Z]+\d+)"/.exec(c), t = /\bt="(\w+)"/.exec(c), v = /<v>([\s\S]*?)<\/v>/.exec(c), is = /<is>([\s\S]*?)<\/is>/.exec(c);
        var k = ref ? stolbec(ref[1]) : sled; sled = k + 1;
        var znach = '';
        if (t && t[1] === 's' && v) znach = obshchie[+v[1]] || '';
        else if (t && t[1] === 'inlineStr' && is) znach = xmlTekst(is[1]);
        else if (v) znach = xmlTekst(v[1]);
        r[k] = znach;
      });
      for (var i = 0; i < r.length; i++) if (r[i] == null) r[i] = '';
      if (r.some(function (x) { return String(x).trim(); })) stroki.push(r);
    });
    return stroki;
  }
  function xlsx(buf) {
    var f;
    try { f = zipFajly(buf); } catch (e) { return Promise.reject(e); }
    var listy = Object.keys(f).filter(function (k) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(k); })
      .sort(function (a, b) { return +/\d+/.exec(a.slice(14))[0] - +/\d+/.exec(b.slice(14))[0]; });
    if (!listy.length) return Promise.reject(new Error('ne_xlsx'));
    var ss = f['xl/sharedStrings.xml'];
    return Promise.all([ss ? raspakovat(ss) : Promise.resolve(''), raspakovat(f[listy[0]])]).then(function (x) {
      var obshchie = (x[0].match(/<si>[\s\S]*?<\/si>/g) || []).map(function (si) {
        return (si.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || []).map(xmlTekst).join('');   // без <rPh> — подсказок чтения
      });
      return listVStroki(x[1], obshchie);
    });
  }

  // ---------- столбцы и список ----------
  var ZAG_INN = /^\s*инн(?![а-яё])/i, ZAG_IMYA = /^\s*(наименование|полное наименование|краткое наименование|контрагент|название|организация)(?![а-яё])/i;
  function stolbcy(stroki) {
    for (var i = 0; i < Math.min(stroki.length, 15); i++) {
      var r = stroki[i], inn = -1, imya = -1;
      for (var k = 0; k < r.length; k++) {
        var t = String(r[k] || '');
        if (inn < 0 && ZAG_INN.test(t)) inn = k;                       // «ИНН», «ИНН/КПП», «ИНН контрагента»
        if (imya < 0 && ZAG_IMYA.test(t)) imya = k;
      }
      if (inn >= 0) return { zag: i, inn: inn, imya: imya };
    }
    // заголовка нет — столбец, где больше всего ИНН с верной контрольной цифрой
    var schet = [];
    stroki.forEach(function (r) { r.forEach(function (v, k) { var x = innIzYachejki(v); if (x && innOk(x)) schet[k] = (schet[k] || 0) + 1; }); });
    var luchshij = -1, n = 0;
    schet.forEach(function (c, k) { if (c > n) { n = c; luchshij = k; } });
    return luchshij < 0 ? null : { zag: -1, inn: luchshij, imya: -1 };
  }
  // stroki → { org: [{inn, imya}], ip, neVerno, povtor, lishnie }
  function spisok(stroki) {
    var s = stolbcy(stroki), ot = { org: [], ip: 0, neVerno: 0, povtor: 0, lishnie: 0, stolbecNajden: !!s };
    if (!s) return ot;
    var bylo = {};
    for (var i = s.zag + 1; i < stroki.length; i++) {
      var r = stroki[i], syroe = String(r[s.inn] == null ? '' : r[s.inn]).trim();
      if (!syroe) continue;
      var inn = innIzYachejki(syroe);
      if (!inn || !innOk(inn)) { if (/\d{9,}/.test(syroe.replace(/\s/g, ''))) ot.neVerno++; continue; }
      if (inn.length === 12) { ot.ip++; continue; }                         // ИП и граждане — не отправляем
      if (bylo[inn]) { ot.povtor++; continue; }
      bylo[inn] = 1;
      if (ot.org.length >= MAKS) { ot.lishnie++; continue; }
      ot.org.push({ inn: inn, imya: s.imya >= 0 ? String(r[s.imya] || '').trim().slice(0, 200) : '' });
    }
    return ot;
  }
  // вставленный текст: строки таблицы (есть разделитель) или просто ИНН через пробел и перенос
  function izTeksta(str) {
    str = String(str || '');
    if (/[;\t]/.test(str)) return spisok(csv(str));
    // ИНН внутри строки может быть с пробелами («7707 083 893»), но не через перенос строки
    var stroki = (str.match(/\d[\d \u00a0]{8,}\d/g) || []).map(function (x) { return [x.replace(/[ \u00a0]/g, '')]; });
    return spisok(stroki);
  }

  // ---------- ответ сервера → строки итога ----------
  function chislo(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
  function dmy(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  // факт сервера → {t, minus}: смена руководителя — без ФИО; налог меньше 500 ₽ — остаток, не минус
  function fakt(s) {
    s = String(s || '');
    var ruk = /^(Руководитель сменился[^:]*):\s*[^—]*?—\s*(с\s+\d{2}\.\d{2}\.\d{4})(.*)$/.exec(s);
    if (ruk) return { t: ruk[1] + ': ' + ruk[2] + ruk[3], minus: true };
    var nal = /^Задолженность по налогам:\s*([\d\s\u00a0]+)\s*₽.*?на\s+(\d{2}\.\d{2}\.\d{4})/.exec(s);
    if (nal) {
      var sum = +nal[1].replace(/[\s\u00a0]/g, '');
      if (sum > 0 && sum < OSTATOK_DO) return { t: 'Остаток: задолженность по' + NB + 'налогам по' + NB + 'набору ФНС на' + NB + nal[2] + ' — ' + chislo(sum) + NB + '₽', minus: false };
    }
    return { t: s, minus: true };
  }
  var STATUS = [
    [/likvidir|liquidated/i, 'Ликвидирована'], [/likvidac|liquidating/i, 'В ликвидации'], [/bankrot|bankrupt/i, 'Банкротство'],
    [/isklyuch|exclud/i, 'Исключена из ЕГРЮЛ'], [/reorg/i, 'Реорганизация'], [/prekrash|terminat/i, 'Деятельность прекращена']
  ];
  function statusSlovami(st) {
    if (!st || /^(dejstvuet|active)$/i.test(st)) return '';
    for (var i = 0; i < STATUS.length; i++) if (STATUS[i][0].test(st)) return STATUS[i][1];
    return 'Статус по' + NB + 'ЕГРЮЛ: ' + st;
  }
  // gruppa: stop (статус не «действует») → minus → ne (не проверили) → chisto; порядок на экране тот же
  function stroka(x, imya) {
    var o = { inn: x.inn, imya: imya || '', ssylka: '/?inn=' + x.inn, data: dmy(x.data_svedeniy), fakty: [], ostatok: [] };
    if (x.oshibka || x.itog === 'ne_provereno' || !x.status) { o.gruppa = 'ne'; o.itog = 'Нет в' + NB + 'базе Делоскопа за' + NB + '30' + NB + 'дней — откройте отчёт, проверим сейчас'; return o; }
    (x.fakty || []).forEach(function (f) { var z = fakt(f); (z.minus ? o.fakty : o.ostatok).push(z.t); });
    var st = statusSlovami(x.status);
    if (st) { o.gruppa = 'stop'; o.itog = st; return o; }
    var n = o.fakty.length;
    o.gruppa = n ? 'minus' : 'chisto';
    o.itog = n ? 'Минусов по' + NB + 'ЕГРЮЛ и' + NB + 'ФНС: ' + n : 'Минусов по' + NB + 'ЕГРЮЛ и' + NB + 'ФНС не' + NB + 'нашли';
    return o;
  }
  var PORYADOK = { stop: 0, minus: 1, ne: 2, chisto: 3 };
  function itog(otvet, org) {
    var imena = {}; (org || []).forEach(function (x) { imena[x.inn] = x.imya; });
    var s = ((otvet && otvet.stroki) || []).filter(function (x) { return /^\d{10}$/.test(String(x.inn)); })
      .map(function (x) { return stroka(x, imena[x.inn]); });
    s.sort(function (a, b) { return PORYADOK[a.gruppa] - PORYADOK[b.gruppa] || b.fakty.length - a.fakty.length; });
    var n = { stop: 0, minus: 0, ne: 0, chisto: 0 }; s.forEach(function (x) { n[x.gruppa]++; });
    return { stroki: s, n: n, vsego: s.length };
  }
  function plural(n, a, b, c) { var m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }
  function svodka(it) {
    var n = it.n, ch = [];
    if (n.stop) ch.push('у' + NB + n.stop + ' — ликвидация, банкротство или реорганизация');
    if (n.minus) ch.push('у' + NB + n.minus + NB + 'есть минусы');
    if (n.ne) ch.push(n.ne + NB + 'не' + NB + 'проверили');
    if (n.chisto) ch.push('у' + NB + n.chisto + NB + 'минусов не' + NB + 'нашли');
    return 'Проверили ' + it.vsego + NB + plural(it.vsego, 'организацию', 'организации', 'организаций') + (ch.length ? ': ' + ch.join(', ') : '') + '.';
  }
  // CSV для «Скачать итог»: ; и BOM — так его открывает Excel и загружает 1С
  function csvItoga(it) {
    function p(v) { v = String(v == null ? '' : v).replace(/\u00a0/g, ' '); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var r = [['ИНН', 'Наименование (из вашего файла)', 'Итог', 'Минусы', 'Остаток', 'Сведения на', 'Отчёт']];
    it.stroki.forEach(function (x) { r.push([x.inn, x.imya, x.itog, x.fakty.join(' | '), x.ostatok.join(' | '), x.data, 'https://deloskop.ru' + x.ssylka]); });
    return '﻿' + r.map(function (x) { return x.map(p).join(';'); }).join('\r\n') + '\r\n';
  }

  // ---------- интерфейс ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cel(imya) { try { if (window.dlkGoal) window.dlkGoal(imya); } catch (_) { /* Метрика не мешает */ } }
  function mount(o) {
    var d = document, $ = function (id) { return d.getElementById(id); };
    var drop = $('sp-drop'), file = $('sp-file'), pole = $('sp-tekst'), knopka = $('sp-knopka'), msg = $('sp-msg'), out = $('sp-out');
    var API = (o && o.api) != null ? o.api : (/deloskop\.ru$/.test(location.hostname) ? 'https://api.deloskop.ru' : '');
    var tek = null, it = null;
    function soobshch(t) { msg.textContent = t || ''; }
    function prinyat(sp) {
      tek = sp;
      if (!sp.stolbecNajden || !sp.org.length) {
        knopka.disabled = true; out.hidden = true;
        soobshch(sp.ip ? 'В файле только ИНН из 12 цифр — предпринимателей и граждан списком не проверяем. Их можно проверить по одному на главной.' :
          'Не нашли ИНН организаций. Нужен столбец «ИНН» — или вставьте ИНН в поле, по одному в строке.');
        return;
      }
      var ch = ['Нашли ' + sp.org.length + NB + plural(sp.org.length, 'организацию', 'организации', 'организаций')];
      if (sp.ip) ch.push(sp.ip + NB + plural(sp.ip, 'ИНН', 'ИНН', 'ИНН') + ' из' + NB + '12' + NB + 'цифр (предприниматели и граждане) не' + NB + 'отправляем');
      if (sp.povtor) ch.push(sp.povtor + NB + plural(sp.povtor, 'повтор', 'повтора', 'повторов') + ' убрали');
      if (sp.neVerno) ch.push(sp.neVerno + NB + 'с' + NB + 'неверной контрольной цифрой пропустили');
      if (sp.lishnie) ch.push('ещё ' + sp.lishnie + ' — сверх 200 за' + NB + 'раз: проверьте следующим файлом');
      soobshch(ch.join('; ') + '.');
      knopka.disabled = false;
    }
    function chitat(f) {
      if (!f) return;
      soobshch('Читаем файл у вас в браузере…');
      f.arrayBuffer().then(function (buf) {
        var b = new Uint8Array(buf.slice(0, 4));
        if (b[0] === 0x50 && b[1] === 0x4b) return xlsx(buf).then(spisok);
        if (b[0] === 0xd0 && b[1] === 0xcf) throw new Error('xls');
        return izTeksta(tekstIzBajtov(buf));
      }).then(prinyat, function (e) {
        knopka.disabled = true;
        soobshch(e && e.message === 'xls' ? 'Это файл старого формата Excel (.xls). Сохраните список как «Лист Excel 2007» (.xlsx) или CSV и загрузите снова.' :
          'Не получилось прочитать файл. Сохраните список как .xlsx или .csv — или вставьте столбец ИНН в поле ниже.');
      });
    }
    function narisovat() {
      var h = '<p class="sp-svodka">' + esc(svodka(it)) + '</p>' +
        '<p class="sp-ne">Не проверяли в' + NB + 'списке: арбитражные суды, приставов, банкротство, приостановки счетов, госконтракты&nbsp;— они в' + NB + 'отчёте по' + NB + 'каждой компании.</p>' +
        '<div class="sp-btns"><button type="button" id="sp-csv">Скачать итог (CSV)</button></div><ol class="sp-list">';
      it.stroki.forEach(function (x) {
        h += '<li class="sp-r ' + x.gruppa + '"><div class="sp-h"><b>' + esc(x.imya || 'ИНН ' + x.inn) + '</b><a href="' + esc(x.ssylka) + '" target="_blank" rel="noopener">Отчёт&nbsp;›</a></div>' +
          '<div class="sp-m">' + (x.imya ? 'ИНН ' + x.inn + ' · ' : '') + esc(x.itog) + (x.data ? ' · сведения на' + NB + x.data : '') + '</div>' +
          (x.fakty.length ? '<ul>' + x.fakty.slice(0, 3).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '') +
          (x.ostatok.length ? '<p class="sp-o">' + esc(x.ostatok.join('. ')) + '</p>' : '') + '</li>';
      });
      out.innerHTML = h + '</ol>';
      out.hidden = false;
      $('sp-csv').addEventListener('click', function () {
        var a = d.createElement('a'), url = URL.createObjectURL(new Blob([csvItoga(it)], { type: 'text/csv;charset=utf-8' }));
        a.href = url; a.download = 'deloskop-itog-spiska.csv'; d.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        cel('spisok_csv');
      });
      if (window.DlkTipo) window.DlkTipo.uzly(out);
    }
    function proverit() {
      if (!tek || !tek.org.length) return;
      if (!API) { soobshch('Проверка списка работает на deloskop.ru.'); return; }
      knopka.disabled = true; knopka.textContent = 'Проверяем…';
      cel('spisok_1s');
      fetch(API + '/api/spisok', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inn: tek.org.map(function (x) { return x.inn; }) }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (x) {
          knopka.disabled = false; knopka.textContent = 'Проверить список';
          if (x.s === 200 && x.j && x.j.stroki) { it = itog(x.j, tek.org); narisovat(); out.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
          if (x.s === 429 && window.dlkLimit) { msg.textContent = ''; window.dlkLimit.pokazat(msg, { stranica: 'spisok' }); return; }
          soobshch('Сервер не принял список. Попробуйте ещё раз через минуту — файл читать заново не нужно.');
        }, function () { knopka.disabled = false; knopka.textContent = 'Проверить список'; soobshch('Нет связи с сервером. Попробуйте ещё раз через минуту.'); });
    }
    file.addEventListener('change', function () { chitat(file.files && file.files[0]); });
    ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (ev) { chitat(ev.dataTransfer && ev.dataTransfer.files[0]); });
    var t; pole.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { if (pole.value.trim()) prinyat(izTeksta(pole.value)); }, 300); });
    knopka.addEventListener('click', proverit);
  }

  return {
    innOk: innOk, innIzYachejki: innIzYachejki, tekstIzBajtov: tekstIzBajtov, csv: csv, xlsx: xlsx, listVStroki: listVStroki,
    stolbcy: stolbcy, spisok: spisok, izTeksta: izTeksta, fakt: fakt, statusSlovami: statusSlovami, stroka: stroka, itog: itog,
    svodka: svodka, csvItoga: csvItoga, mount: mount, MAKS: MAKS, OSTATOK_DO: OSTATOK_DO
  };
});
