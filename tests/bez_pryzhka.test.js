// bez-pryzhka-v1 (21.10.2026, [Ночные запуски]): отчёт после проверки — без сдвига вёрстки (стандарт «глубина в каждой детали»: CLS ≤ 0,01).
// Замер в Chromium — tests/zamer_proverki.js (390 px: 0,074 → 0; по ссылке /?inn=: 0,031 → 0,005).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const kor = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(kor, f), 'utf8');

test('строка «Готово» на ≤ 979 px гаснет, а не схлопывается (место остаётся — отчёт не прыгает вверх)', () => {
  const css = chitat('css/otchet.css');
  const pravila = [...css.matchAll(/\.rezhim-otcheta \.hero-text \.note\.ok\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(pravila.length, 'правило для .note.ok в режиме отчёта есть');
  for (const p of pravila) {
    assert.doesNotMatch(p, /position\s*:\s*absolute|height\s*:\s*1px|display\s*:\s*none/, 'не вынимаем строку из потока: ' + p);
  }
  assert.ok(pravila.some((p) => /opacity\s*:\s*0\b/.test(p)), 'строка гаснет через opacity (роль status её по-прежнему озвучивает)');
});

test('кольцо отчёта ставится в колбэке наблюдателя сразу, а не таймером (до отрисовки и до снимка View Transition)', () => {
  const js = chitat('js/zhivoj-indeks.js');
  const m = /new MutationObserver\(function \(\) \{([^\n]*)\}\)/.exec(js);
  assert.ok(m, 'наблюдатель есть');
  const telo = m[1];
  const sinhr = telo.indexOf('otchety()'), tajmer = telo.indexOf('setTimeout');
  assert.ok(sinhr >= 0 && tajmer >= 0 && sinhr < tajmer, 'otchety() — до таймера, вне его: ' + telo);
});
