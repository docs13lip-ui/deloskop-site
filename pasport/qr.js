/*
 * Делоскоп · QR-код своими силами (ISO/IEC 18004, байтовый режим, версии 1–10).
 * Без библиотек и внешних запросов: ссылка на паспорт не уходит ни в какие сервисы.
 * DeloQR.matrix(text, 'Q') → {size, version, ecl, mask, dark: [[bool]]}
 * DeloQR.svg(text, opt)    → строка SVG в фирменном стиле (линза в центре, если хватает запаса коррекции)
 */
(function (root) {
  'use strict';

  var ECC_PER_BLOCK = { // индекс = версия
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
    Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
    H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28]
  };
  var BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
    Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
    H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8]
  };
  var ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };
  var ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  var MAX_VERSION = 10;

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) {
      var na = Math.floor(v / 7) + 2;
      r -= (25 * na - 10) * na - 55;
      if (v >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(v, ecl) {
    return Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[ecl][v] * BLOCKS[ecl][v];
  }

  // --- поле Галуа GF(256), многочлен 0x11D ---
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }
  function rsDivisor(degree) {
    var res = [];
    for (var i = 0; i < degree - 1; i++) res.push(0);
    res.push(1);
    var root = 1;
    for (i = 0; i < degree; i++) {
      for (var j = 0; j < res.length; j++) {
        res[j] = gfMul(res[j], root);
        if (j + 1 < res.length) res[j] ^= res[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return res;
  }
  function rsRemainder(data, divisor) {
    var res = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ res.shift();
      res.push(0);
      divisor.forEach(function (coef, i) { res[i] ^= gfMul(coef, factor); });
    });
    return res;
  }

  function utf8(text) {
    var out = [], s = unescape(encodeURIComponent(String(text)));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function encodeData(bytes, v, ecl) {
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4);
    put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCodewords(v, ecl) * 8;
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var cw = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    return cw;
  }

  function addEcc(data, v, ecl) {
    var nb = BLOCKS[ecl][v], ecLen = ECC_PER_BLOCK[ecl][v];
    var raw = Math.floor(rawModules(v) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    var div = rsDivisor(ecLen), blocks = [], k = 0;
    for (var i = 0; i < nb; i++) {
      var len = shortLen - ecLen + (i < nShort ? 0 : 1);
      var dat = data.slice(k, k + len);
      k += len;
      var ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var out = [];
    for (i = 0; i < blocks[0].length; i++) {
      for (var j = 0; j < blocks.length; j++) {
        if (i !== shortLen - ecLen || j >= nShort) out.push(blocks[j][i]);
      }
    }
    return out;
  }

  function Grid(size) {
    this.size = size;
    this.m = []; this.f = [];
    for (var y = 0; y < size; y++) {
      this.m.push(new Array(size).fill(false));
      this.f.push(new Array(size).fill(false));
    }
  }
  Grid.prototype.set = function (x, y, dark) { this.m[y][x] = !!dark; this.f[y][x] = true; };

  function drawFunction(g, v) {
    var s = g.size, i, dx, dy;
    for (i = 0; i < s; i++) { g.set(6, i, i % 2 === 0); g.set(i, 6, i % 2 === 0); }
    [[3, 3], [s - 4, 3], [3, s - 4]].forEach(function (c) {
      for (dy = -4; dy <= 4; dy++) for (dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), x = c[0] + dx, y = c[1] + dy;
        if (x >= 0 && x < s && y >= 0 && y < s) g.set(x, y, d !== 2 && d !== 4);
      }
    });
    var pos = ALIGN[v], n = pos.length;
    for (i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (dy = -2; dy <= 2; dy++) for (dx = -2; dx <= 2; dx++)
        g.set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    drawFormat(g, 'L', 0); // резервируем место, настоящие биты — после выбора маски
    if (v >= 7) {
      var rem = v;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var bits = (v << 12) | rem;
      for (i = 0; i < 18; i++) {
        var bit = (bits >>> i) & 1, a = s - 11 + i % 3, b = Math.floor(i / 3);
        g.set(a, b, bit); g.set(b, a, bit);
      }
    }
  }

  function drawFormat(g, ecl, mask) {
    var data = (ECL_BITS[ecl] << 3) | mask, rem = data, i, s = g.size;
    for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;
    function bit(k) { return (bits >>> k) & 1; }
    for (i = 0; i <= 5; i++) g.set(8, i, bit(i));
    g.set(8, 7, bit(6)); g.set(8, 8, bit(7)); g.set(7, 8, bit(8));
    for (i = 9; i < 15; i++) g.set(14 - i, 8, bit(i));
    for (i = 0; i < 8; i++) g.set(s - 1 - i, 8, bit(i));
    for (i = 8; i < 15; i++) g.set(8, s - 15 + i, bit(i));
    g.set(8, s - 8, 1);
  }

  function drawCodewords(g, cw) {
    var s = g.size, i = 0, total = cw.length * 8;
    for (var right = s - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < s; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j, up = ((right + 1) & 2) === 0, y = up ? s - 1 - vert : vert;
          if (!g.f[y][x] && i < total) {
            g.m[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
            i++;
          }
        }
      }
    }
  }

  var MASKS = [
    function (x, y) { return (x + y) % 2 === 0; },
    function (x, y) { return y % 2 === 0; },
    function (x) { return x % 3 === 0; },
    function (x, y) { return (x + y) % 3 === 0; },
    function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
    function (x, y) { return x * y % 2 + x * y % 3 === 0; },
    function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; },
    function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }
  ];
  function applyMask(g, k) {
    for (var y = 0; y < g.size; y++) for (var x = 0; x < g.size; x++)
      if (!g.f[y][x] && MASKS[k](x, y)) g.m[y][x] = !g.m[y][x];
  }

  function penalty(g) {
    var s = g.size, m = g.m, p = 0, x, y, dark = 0;
    function lines(get) {
      for (var a = 0; a < s; a++) {
        var run = 1, line = [];
        for (var b = 0; b < s; b++) {
          line.push(get(a, b));
          if (b > 0) {
            if (line[b] === line[b - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; }
            else run = 1;
          }
        }
        var pat = [true, false, true, true, true, false, true];
        for (b = 0; b + 7 <= s; b++) {
          var ok = true;
          for (var k = 0; k < 7; k++) if (line[b + k] !== pat[k]) { ok = false; break; }
          if (!ok) continue;
          var lightBefore = true, lightAfter = true;
          for (k = 1; k <= 4; k++) {
            if (b - k >= 0 && line[b - k]) lightBefore = false;
            if (b + 6 + k < s && line[b + 6 + k]) lightAfter = false;
          }
          if (lightBefore || lightAfter) p += 40;
        }
      }
    }
    lines(function (a, b) { return m[a][b]; });
    lines(function (a, b) { return m[b][a]; });
    for (y = 0; y < s - 1; y++) for (x = 0; x < s - 1; x++) {
      var c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
    }
    for (y = 0; y < s; y++) for (x = 0; x < s; x++) if (m[y][x]) dark++;
    var total = s * s, k2 = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    return p + Math.max(0, k2) * 10;
  }

  function matrix(text, ecl, minVersion) {
    ecl = ECL_BITS.hasOwnProperty(ecl) ? ecl : 'Q';
    var bytes = utf8(text), v;
    for (v = Math.max(1, minVersion || 1); v <= MAX_VERSION; v++) {
      var need = 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
      if (need <= dataCodewords(v, ecl) * 8) break;
    }
    if (v > MAX_VERSION) throw new Error('QR: слишком длинный текст (' + bytes.length + ' байт)');
    var cw = addEcc(encodeData(bytes, v, ecl), v, ecl);
    var best = null, bestP = Infinity;
    for (var k = 0; k < 8; k++) {
      var g = new Grid(17 + 4 * v);
      drawFunction(g, v);
      drawCodewords(g, cw);
      applyMask(g, k);
      drawFormat(g, ecl, k);
      var p = penalty(g);
      if (p < bestP) { bestP = p; best = { g: g, mask: k }; }
    }
    return { size: best.g.size, version: v, ecl: ecl, mask: best.mask, dark: best.g.m, fn: best.g.f };
  }

  // --- SVG в стиле Делоскопа ---
  function svg(text, opt) {
    opt = opt || {};
    var ink = opt.ink || '#1D1D1F', accent = opt.accent || '#0B63E5', bg = opt.bg || '#FFFFFF';
    var q = matrix(text, opt.ecl || 'Q'), s = q.size, quiet = 4, full = s + quiet * 2;
    // Линза в центре — только если под ней нет выравнивающего узора (версии до 6) и запас коррекции Q/H.
    var logo = opt.logo !== false && q.version <= 6 && (q.ecl === 'Q' || q.ecl === 'H');
    var lr = logo ? Math.floor(s * 0.11) : -1, c = (s - 1) / 2;
    function inFinder(x, y) { return (x < 7 && y < 7) || (x >= s - 7 && y < 7) || (x < 7 && y >= s - 7); }
    function underLogo(x, y) { return logo && Math.abs(x - c) <= lr + 0.5 && Math.abs(y - c) <= lr + 0.5; }
    var d = '';
    for (var y = 0; y < s; y++) {
      for (var x = 0; x < s; x++) {
        if (!q.dark[y][x] || inFinder(x, y) || underLogo(x, y)) continue;
        var run = 1;
        while (x + run < s && q.dark[y][x + run] && !inFinder(x + run, y) && !underLogo(x + run, y)) run++;
        d += 'M' + (x + quiet) + ' ' + (y + quiet) + 'h' + run + 'v1h-' + run + 'z';
        x += run - 1;
      }
    }
    // Искатели — строго квадратные: скругление ломает распознавание у части сканеров (проверено OpenCV).
  function finder(fx, fy) {
      var X = fx + quiet, Y = fy + quiet;
      return '<rect x="' + (X + 0.5) + '" y="' + (Y + 0.5) + '" width="6" height="6" fill="none" stroke="' + ink + '" stroke-width="1"/>' +
        '<rect x="' + (X + 2) + '" y="' + (Y + 2) + '" width="3" height="3" fill="' + accent + '"/>';
    }
    var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + full + ' ' + full + '" width="' + (opt.size || 176) + '" height="' + (opt.size || 176) + '"' +
      ' shape-rendering="crispEdges" role="img" aria-label="' + (opt.label || 'QR-код') + '">' +
      '<rect width="' + full + '" height="' + full + '" fill="' + bg + '"/>' +
      '<path d="' + d + '" fill="' + ink + '"/>' +
      '<g shape-rendering="geometricPrecision">' + finder(0, 0) + finder(s - 7, 0) + finder(0, s - 7);
    if (logo) {
      var cx = c + quiet + 0.5, cy = c + quiet + 0.5, r = lr * 0.62, off = r * 0.5, sw = Math.max(0.35, r * 0.2);
      out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (lr + 0.9) + '" fill="' + bg + '"/>' +
        '<path d="M' + cx + ' ' + (cy - r * 0.866) + 'A' + r + ' ' + r + ' 0 0 1 ' + cx + ' ' + (cy + r * 0.866) + 'A' + r + ' ' + r + ' 0 0 1 ' + cx + ' ' + (cy - r * 0.866) + 'Z" fill="' + accent + '"/>' +
        '<circle cx="' + (cx - off) + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + ink + '" stroke-width="' + sw + '"/>' +
        '<circle cx="' + (cx + off) + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + ink + '" stroke-width="' + sw + '"/>';
    }
    return out + '</g></svg>';
  }

  var api = { matrix: matrix, svg: svg, _dataCodewords: dataCodewords };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeloQR = api;
})(typeof self !== 'undefined' ? self : this);
