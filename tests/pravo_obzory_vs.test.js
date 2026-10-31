// Строки «Где в законе» об Обзорах ВС 2026 ([Право] 26.10, ✎ 00:40 25.10 — (а), (в), (г) «да»; (б) «Вокфорс» в Обзоре № 2 — нет до сверки).
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'praktika/dela.json'), 'utf8'));
const r = (s) => D.razbory.find((x) => x.slug === s);
const zakon = (s) => r(s).zakon.map((z) => z[0]).join('\n');
test('Обзоры ВС 2026: две строки на месте, строка КС № 12-П снята', () => {
  assert.match(zakon('povtornaya-vyezdnaya-proverka-vs-2026'), /Обзор судебной практики Верховного суда РФ № 2 \(2026\), утв\. Президиумом ВС РФ, п\. 24/);
  // (в) 67-КАД25-12-К8 в Обзоре № 2 — [Право] 31.10: «нет, не подтверждено» — строку сняли (pravo-stroki-3110-v1).
  assert.doesNotMatch(zakon('ks-12-p-svidetel-po-svoej-proverke'), /67-КАД25-12-К8/);
  assert.match(zakon('podarok-ot-roditelya-ip-ndfl-vs-2026'), /№ 3 \(2026\), п\. 33 \(дело № 44-КАД26-3-К7/);
});
test('«Вокфорс» — без Обзора № 2 до сверки [Право]', () => {
  assert.doesNotMatch(zakon('vokfors-rekonstrukciya'), /№ 2 \(2026\)/);
});
