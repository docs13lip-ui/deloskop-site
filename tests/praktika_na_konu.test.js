// [Ночные запуски] 24.10.2026 03:05 — «На кону» в карточках хабов /praktika/ без повтора.
// На живом (24.10): «правила «светофора» для всех компаний и ИП и правила «светофора» для всех компаний и ИП» (оба круга ВС по ЗСК),
// «2,6 млрд ₽ и 2,6 млрд ₽» (один спор «Красцветмета»). Одинаковая ставка двух дел — одной строкой; разные — через «и».
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const HABY = ['praktika/index.html', 'praktika/115-fz/index.html', 'praktika/nalogi/index.html'];
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-').replace(/<[^>]+>/g, '');

test('хабы /praktika/: в «На кону» нет «X и X»', () => {
  let vsego = 0;
  for (const f of HABY) {
    const html = fs.readFileSync(path.join(KOREN, f), 'utf8');
    for (const m of html.matchAll(/<span class="pk__k">([\s\S]*?)<\/span><\/a>/g)) {
      vsego++;
      const t = un(m[1]).replace(/^На кону — /, '');
      const chasti = t.split(' и ');
      for (let i = 1; i < chasti.length; i++) {
        for (let k = 1; i - k >= 0 && i + k <= chasti.length; k++) {
          const a = chasti.slice(i - k, i).join(' и '), b = chasti.slice(i, i + k).join(' и ');
          assert.notStrictEqual(a, b, f + ': повтор в «На кону — ' + t + '»');
        }
      }
    }
  }
  assert.ok(vsego >= 20, 'карточек разборов на хабах: ' + vsego);
});

test('dela.json: у разборов из нескольких дел одинаковая ставка встречается — сборщик её не повторяет', () => {
  const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'praktika/dela.json'), 'utf8'));
  const html = un(fs.readFileSync(path.join(KOREN, 'praktika/index.html'), 'utf8'));
  for (const r of D.razbory) {
    const k = r.dela.map((x) => x.na_konu_kratko || x.na_konu);
    const odna = [...new Set(k)].join(' и ');
    assert.ok(html.includes('На кону — ' + un(odna)) || !html.includes(un(r.h1)), r.slug + ': ожидали «На кону — ' + odna + '»');
  }
});
