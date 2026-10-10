// schet-konversiya-v1 — [Ночные запуски] 10.10.2026. Решение владельца 10.10 п. 3
// (claude/Решения_владельца_10.10_оплата_по_счёту_год_3700_счёт_бухгалтеру.md): QR по ГОСТ Р 56042-2014 на счёте,
// «Отправить счёт бухгалтеру», цели Метрики schet_zapros / schet_buhgalteru / schet_oplachen.
// Тексты и рамки — [Право] 10.10 (claude/Право_ответы_✎_рейтинг_реорганизация_Делобух_счёт_бухгалтеру_10.10.md, разд. 7).
// Запуск: node --test tests/schet_konversiya.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const DOK = chitat('js/schet-dokument.js');
const STR = chitat('schet/dokument/index.html');
const FORMA = chitat('js/schet.js');

function buh() {
  const m = /var BUH = (\{[\s\S]*?\n  \});/.exec(DOK);
  assert.ok(m, 'тексты формы — в одном объекте BUH');
  return vm.runInNewContext('(' + m[1] + ')');
}

test('отметка согласия — дословно [Право] (152-ФЗ: адрес третьего лица)', () => {
  assert.strictEqual(buh().soglasie, 'Подтверждаю, что бухгалтер согласен получить счёт на этот адрес');
  assert.match(DOK, /name="soglasie" required/);
  assert.match(DOK, /if \(!sg\.checked\)/, 'без отметки не отправляем');
});

test('тест-запрет слов [Право] в текстах формы: не реклама, без давления и чужих цен', () => {
  const vse = Object.values(buh()).join(' ').toLowerCase();
  for (const s of ['успейте', 'последн', 'скидк', 'только сегодня', 'основател', '390', '490'])
    assert.ok(!vse.includes(s), 'запрещено: ' + s);
});

test('форма — только когда API отдаёт buhgalteru: true; не на оплаченном, аннулированном счёте и заявке', () => {
  assert.match(DOK, /d\.buhgalteru !== true/);
  for (const s of ['oplachen', 'annulirovan', 'zayavka']) assert.ok(new RegExp('function buhHtml[\\s\\S]*?d\\.status === "' + s + '"').test(DOK), s);
  assert.match(FORMA, /j\.buhgalteru === true/, 'ссылка на экране «Счёт готов» — тоже по флагу API');
  assert.match(FORMA, /#buhgalteru/);
});

test('почта бухгалтера не уходит в Метрику: цели без значений из полей', () => {
  const celi = DOK.match(/dlkGoal\([^)]*\)/g) || [];
  assert.ok(celi.length >= 2);
  for (const c of celi) assert.ok(!/email|\bv\b|pochta|em\.value/.test(c), c);
  assert.match(DOK, /dlkGoal\("schet_buhgalteru", \{ mesto: "schet" \}\)/);
  assert.match(DOK, /dlkGoal\("schet_oplachen"/);
  assert.match(FORMA, /dlkGoal\("schet_zapros"/);
  const KL = /var KLYUCHI = \{([\s\S]*?)\};/.exec(chitat('js/metrika.js'))[1];
  for (const k of ['mesto', 'produkt', 'vid', 'sost']) assert.ok(new RegExp('\\b' + k + ': 1').test(KL), 'ключ в белом списке Метрики: ' + k);
});

test('«счёт оплачен» — один раз на счёт, localStorage в try', () => {
  assert.match(DOK, /try \{ if \(localStorage\.getItem\("dlk_oplachen_" \+ n\)\)/);
});

test('страница счёта: кодировщик QR подключён до schet-dokument.js; форма и плашки в печать не идут, QR — идёт', () => {
  const i = STR.indexOf('/js/qr-platezh.js'), j = STR.indexOf('/js/schet-dokument.js');
  assert.ok(i > 0 && i < j);
  assert.match(STR, /@media print\{[^}]*\.buh[^}]*display:none/);
  assert.match(STR, /@media print\{[\s\S]*?\.qrp__k svg\{width:32mm;height:32mm\}/);
  assert.ok(!/@media print\{[^}]*\.qrp[,{]/.test(STR), 'QR в PDF остаётся');
});

test('QR — только из данных самого счёта (сумма и назначение как в счёте, правило О1) и не на оплаченном', () => {
  assert.match(DOK, /summa: d\.itogo, naznachenie: d\.naznachenie/);
  assert.match(DOK, /function qrHtml[\s\S]*?d\.status === "oplachen" \|\| d\.status === "annulirovan"/);
});
