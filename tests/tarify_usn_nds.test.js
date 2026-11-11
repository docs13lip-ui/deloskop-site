// usn-dohody-v1 (доп. 01.11 11:05) — калькулятор /tarify/ «Что стоит на кону»: «УСН ≠ риск 0».
// С 2026 упрощенцы с доходом больше 20 млн ₽ — плательщики НДС; кто платит 22% и берёт вычет, рискует вычетом
// (строки [Право] 30.10, правка первой фразы — claude/Право_✎_дефлятор_617-9_события_152ФЗ_Разбор_36_01.11.md, разд. 1).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const T = require('../tarify/tarify.js');
const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'tarify/tarify.json'), 'utf8'));
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');

test('УСН + НДС 22% с вычетом: на кону вычет (+ штраф и пени), при 15% — ещё расходы без НДС', () => {
  const S = 1220000, r = D.raschet;
  const vychet = S * r.nds / (100 + r.nds);
  const u6 = T.okupaemost(D, { summa: S, rezhim: 'usn6', nds22: true, oborot: 0 }, 14300);
  assert.strictEqual(Math.round(u6.nalog), Math.round(vychet));
  assert.ok(u6.naKonu > u6.nalog, 'штраф и пени сверху');
  const u15 = T.okupaemost(D, { summa: S, rezhim: 'usn15', nds22: true, oborot: 0 }, 14300);
  assert.strictEqual(Math.round(u15.nalog), Math.round(vychet + (S - vychet) * 0.15));
  // ОСН флаг nds22 не трогает
  const osn = T.okupaemost(D, { summa: S, rezhim: 'osn', oborot: 0 }, 14300);
  assert.strictEqual(T.okupaemost(D, { summa: S, rezhim: 'osn', nds22: true, oborot: 0 }, 14300).nalog, osn.nalog);
});

test('без НДС 22% — как было: УСН 6% — 0, УСН 15% — 15% от суммы', () => {
  assert.strictEqual(T.okupaemost(D, { summa: 1000000, rezhim: 'usn6', oborot: 0 }, 14300).naKonu, 0);
  assert.strictEqual(T.okupaemost(D, { summa: 1000000, rezhim: 'usn15', oborot: 0 }, 14300).nalog, 150000);
});

test('/tarify/: галочка НДС 22% в сборщике и на странице; подпись при нуле не обещает действий налоговой', () => {
  const html = chitat('tarify/index.html');
  assert.ok(/<label class="g" id="p-nds22-l" hidden><input id="p-nds22" type="checkbox">/.test(html), 'галочка на странице');
  assert.ok(chitat('tests/sobrat_tarify.py').includes('id="p-nds22-l"'), 'галочка — в источнике сборщика');
  const js = chitat('tarify/tarify.js');
  assert.ok(js.includes('nds22: $("p-nds22").checked'));
  assert.ok(js.includes('$("p-nds22-l").hidden = vvod.rezhim === "osn";'));
  assert.ok(!/налоговая не снимет/.test(js), 'не обещаем, что налоговая чего-то не сделает');
  assert.ok(!/вычетов нет/.test(js), 'у упрощенца на НДС 22% вычеты есть');
});

test('статья 54.1: первая фраза абзаца #usn-dohody — в редакции [Право] 01.11', () => {
  const p = chitat('nalogi/statya-54-1-nk-prostymi-slovami/index.html').match(/<p id="usn-dohody">([\s\S]*?)<\/p>/)[1];
  assert.ok(p.includes('По&nbsp;расходам снимать нечего&nbsp;— в&nbsp;вашем налоге их&nbsp;нет.'));
  assert.ok(!/налоговая не(&nbsp;| )снимет/.test(p));
});

test('/tarify/: скрытые галочки калькулятора правда скрыты (.g не перебивает [hidden])', () => {
  // на живом 01.11: «налоговая снимет и расходы по налогу на прибыль» видна и на УСН — .g{display:grid} сильнее [hidden]
  const html = chitat('tarify/index.html');
  assert.ok(html.includes('.g[hidden]{display:none}'));
  assert.ok(chitat('tests/sobrat_tarify.py').includes('.g[hidden]{display:none}'));
});
