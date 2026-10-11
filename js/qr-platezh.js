/* Делоскоп — QR-код для оплаты счёта из приложения банка (ГОСТ Р 56042-2014, «ST00012» — UTF-8).
   schet-konversiya-v1 (решение команды 10.10, п. 3). Без внешних библиотек: свой кодировщик QR
   (байтовый режим, уровень коррекции M, версии 1–40, выбор маски по штрафам ISO/IEC 18004).
   Рисует SVG — одинаково чётко на экране и в PDF (печать браузера в A4).
   Чистые функции экспортируются для автотестов (node): tests/qr_platezh.test.js. */
(function (root) {
  "use strict";

  // ---------- строка платежа по ГОСТ Р 56042-2014 ----------
  // Обязательные: Name, PersonalAcc, BankName, BIC, CorrespAcc. Дополнительные: Sum (в копейках), Purpose, PayeeINN, PayerINN.
  // Разделитель «|» внутри значений запрещён — заменяем пробелом; переводы строк — тоже.
  function chist(v) { return String(v == null ? "" : v).replace(/[|\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim(); }
  function stroka(r) {
    if (!r || !r.name || !/^\d{20}$/.test(r.rs || "") || !/^\d{9}$/.test(r.bik || "") || !/^\d{20}$/.test(r.ks || "") || !r.bank) return "";
    var p = ["ST00012", "Name=" + chist(r.name), "PersonalAcc=" + r.rs, "BankName=" + chist(r.bank), "BIC=" + r.bik, "CorrespAcc=" + r.ks];
    if (r.summa > 0) p.push("Sum=" + Math.round(r.summa * 100));
    if (r.naznachenie) p.push("Purpose=" + chist(r.naznachenie).slice(0, 210));
    if (/^\d{10}$|^\d{12}$/.test(r.inn || "")) p.push("PayeeINN=" + r.inn);
    if (/^\d{10}$|^\d{12}$/.test(r.inn_platelshchika || "")) p.push("PayerINN=" + r.inn_platelshchika);
    return p.join("|");
  }

  function utf8(s) {
    var b = [], i, c, d;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) { d = s.charCodeAt(i + 1); if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; } }
      if (c < 0x80) b.push(c);
      else if (c < 0x800) b.push(0xC0 | c >> 6, 0x80 | c & 63);
      else if (c < 0x10000) b.push(0xE0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else b.push(0xF0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    }
    return b;
  }

  // ---------- кодировщик QR (уровень M) ----------
  // таблицы ISO/IEC 18004, уровень M, индекс — версия (0 не используется)
  var ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
  var BLOKI_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
  var FORMAT_M = 0; // биты уровня M в строке формата

  function syryeModuli(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dannyeKodov(v) { return Math.floor(syryeModuli(v) / 8) - ECC_M[v] * BLOKI_M[v]; }

  function gfUmn(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
  function rsDelitel(st) {
    var r = [], i, j, k = 1; for (i = 0; i < st - 1; i++) r.push(0); r.push(1);
    for (i = 0; i < st; i++) { for (j = 0; j < r.length; j++) { r[j] = gfUmn(r[j], k); if (j + 1 < r.length) r[j] ^= r[j + 1]; } k = gfUmn(k, 2); }
    return r;
  }
  function rsOstatok(dannye, del) {
    var r = del.map(function () { return 0; });
    dannye.forEach(function (b) {
      var f = b ^ r.shift(); r.push(0);
      del.forEach(function (c, i) { r[i] ^= gfUmn(c, f); });
    });
    return r;
  }

  function kodirovat(tekst) {
    var bajty = utf8(tekst), v, dlina;
    for (v = 1; v <= 40; v++) {
      dlina = 4 + (v <= 9 ? 8 : 16) + bajty.length * 8;
      if (dlina <= dannyeKodov(v) * 8) break;
    }
    if (v > 40) return null;
    var bity = [];
    function dob(x, n) { for (var i = n - 1; i >= 0; i--) bity.push((x >>> i) & 1); }
    dob(4, 4); dob(bajty.length, v <= 9 ? 8 : 16); bajty.forEach(function (b) { dob(b, 8); });
    var emk = dannyeKodov(v) * 8;
    dob(0, Math.min(4, emk - bity.length));
    dob(0, (8 - bity.length % 8) % 8);
    for (var pad = 0xEC; bity.length < emk; pad ^= 0xEC ^ 0x11) dob(pad, 8);
    var kody = []; for (var i = 0; i < bity.length; i += 8) { var b = 0; for (var j = 0; j < 8; j++) b = b << 1 | bity[i + j]; kody.push(b); }
    return { v: v, moduli: kvadrat(v, peremeshat(v, kody)) };
  }

  function peremeshat(v, dannye) {
    var nb = BLOKI_M[v], ecc = ECC_M[v], vsego = Math.floor(syryeModuli(v) / 8), korotkih = nb - vsego % nb, kor = Math.floor(vsego / nb);
    var del = rsDelitel(ecc), bloki = [], k = 0, i, j;
    for (i = 0; i < nb; i++) {
      var d = dannye.slice(k, k + kor - ecc + (i < korotkih ? 0 : 1)); k += d.length;
      var e = rsOstatok(d, del);
      if (i < korotkih) d.push(0);
      bloki.push(d.concat(e));
    }
    var r = [];
    for (i = 0; i < bloki[0].length; i++) for (j = 0; j < bloki.length; j++) if (i !== kor - ecc || j >= korotkih) r.push(bloki[j][i]);
    return r;
  }

  function vyravnivanie(v) {
    if (v === 1) return [];
    var n = Math.floor(v / 7) + 2, shag = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2, r = [6];
    for (var p = v * 4 + 10; r.length < n; p -= shag) r.splice(1, 0, p);
    return r;
  }

  function kvadrat(v, kody) {
    var N = v * 4 + 17, m = [], sl = [], x, y, i, j;
    for (y = 0; y < N; y++) { m.push(new Array(N).fill(false)); sl.push(new Array(N).fill(false)); }
    function st(x, y, c) { m[y][x] = c; sl[y][x] = true; }
    for (i = 0; i < N; i++) { st(6, i, i % 2 === 0); st(i, 6, i % 2 === 0); }
    function poisk(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
        if (xx >= 0 && xx < N && yy >= 0 && yy < N) st(xx, yy, d !== 2 && d !== 4);
      }
    }
    poisk(3, 3); poisk(N - 4, 3); poisk(3, N - 4);
    var al = vyravnivanie(v), n = al.length;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      if (i === 0 && j === 0 || i === 0 && j === n - 1 || i === n - 1 && j === 0) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) st(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    format(m, sl, N, 0, st);
    if (v >= 7) {
      var r = v; for (i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      var b = v << 12 | r;
      for (i = 0; i < 18; i++) { var c = ((b >>> i) & 1) !== 0, a = N - 11 + i % 3, bb = Math.floor(i / 3); st(a, bb, c); st(bb, a, c); }
    }
    // данные зигзагом
    var k = 0;
    for (var pr = N - 1; pr >= 1; pr -= 2) {
      if (pr === 6) pr = 5;
      for (var t = 0; t < N; t++) for (j = 0; j < 2; j++) {
        x = pr - j; var vverh = ((pr + 1) & 2) === 0; y = vverh ? N - 1 - t : t;
        if (!sl[y][x] && k < kody.length * 8) { m[y][x] = ((kody[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0; k++; }
      }
    }
    // маска с наименьшим штрафом
    var luchshaya = -1, minSh = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      maska(m, sl, N, mk); format(m, sl, N, mk, st);
      var sh = shtraf(m, N);
      if (sh < minSh) { minSh = sh; luchshaya = mk; }
      maska(m, sl, N, mk);
    }
    maska(m, sl, N, luchshaya); format(m, sl, N, luchshaya, st);
    return m;
  }

  function format(m, sl, N, mk, st) {
    var d = FORMAT_M << 3 | mk, r = d, i;
    for (i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    var b = (d << 10 | r) ^ 0x5412;
    function bit(i) { return ((b >>> i) & 1) !== 0; }
    for (i = 0; i <= 5; i++) st(8, i, bit(i));
    st(8, 7, bit(6)); st(8, 8, bit(7)); st(7, 8, bit(8));
    for (i = 9; i < 15; i++) st(14 - i, 8, bit(i));
    for (i = 0; i < 8; i++) st(N - 1 - i, 8, bit(i));
    for (i = 8; i < 15; i++) st(8, N - 15 + i, bit(i));
    st(8, N - 8, true);
  }

  function maska(m, sl, N, mk) {
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var inv;
      switch (mk) {
        case 0: inv = (x + y) % 2 === 0; break;
        case 1: inv = y % 2 === 0; break;
        case 2: inv = x % 3 === 0; break;
        case 3: inv = (x + y) % 3 === 0; break;
        case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: inv = x * y % 2 + x * y % 3 === 0; break;
        case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
        default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
      }
      if (!sl[y][x] && inv) m[y][x] = !m[y][x];
    }
  }

  function shtraf(m, N) {
    var r = 0, x, y, temn = 0;
    function linii(get) {
      for (var a = 0; a < N; a++) {
        var cvet = null, dl = 0, ist = [0, 0, 0, 0, 0, 0, 0];
        function dobIst(d) { if (ist[0] === 0) d += N; ist.pop(); ist.unshift(d); }
        function shablon() { var n = ist[1], core = n > 0 && ist[2] === n && ist[3] === n * 3 && ist[4] === n && ist[5] === n; return (core && ist[0] >= n * 4 && ist[6] >= n ? 1 : 0) + (core && ist[6] >= n * 4 && ist[0] >= n ? 1 : 0); }
        cvet = false; dl = 0; ist = [0, 0, 0, 0, 0, 0, 0];
        for (var b = 0; b < N; b++) {
          var c = get(a, b);
          if (c === cvet) { dl++; if (dl === 5) r += 3; else if (dl > 5) r++; }
          else { dobIst(dl); if (!cvet) r += shablon() * 40; cvet = c; dl = 1; }
        }
        if (cvet) { dobIst(dl); dl = 0; }
        dl += N; dobIst(dl); r += shablon() * 40;
      }
    }
    linii(function (a, b) { return m[a][b]; });
    linii(function (a, b) { return m[b][a]; });
    for (y = 0; y < N - 1; y++) for (x = 0; x < N - 1; x++) { var c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) r += 3; }
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (m[y][x]) temn++;
    var vsego = N * N, k = Math.ceil(Math.abs(temn * 20 - vsego * 10) / vsego) - 1;
    return r + k * 10;
  }

  // SVG: один path, поле 4 модуля; размер задаёт CSS
  function svg(tekst, podpis) {
    var q = tekst && kodirovat(tekst); if (!q) return "";
    var N = q.moduli.length, d = "", x, y;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (q.moduli[y][x]) d += "M" + (x + 4) + " " + (y + 4) + "h1v1h-1z";
    var w = N + 8;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + w + '" shape-rendering="crispEdges" role="img" aria-label="' + (podpis || "QR-код для оплаты") + '"><rect width="' + w + '" height="' + w + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  var api = { stroka: stroka, kodirovat: kodirovat, svg: svg, utf8: utf8 };
  root.DeloskopQR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
