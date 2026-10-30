// [Ночные запуски] 30.10 — kalk-peni-v1 (Главное, сроки «до 04.11»: строка «пени по старым периодам — проверьте уточнёнки» в /nalogi/).
// Калькулятор «технического» поставщика считает пени за 2 года; кто уже подавал уточнёнку за период сделки, должен знать,
// что срок по пеням считают от неё (ВС № 306-ЭС26-4683, Разбор № 30). Текст — дословно [Право] 28.10 (Разбор № 30 и строка для /nalogi/).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const KALK = fs.readFileSync(path.join(KOREN, 'nalogi/kalkulyator-tehnicheskij-postavshchik/index.html'), 'utf8');
const RAZBOR = fs.readFileSync(path.join(KOREN, 'praktika/nalogi/utochnenka-i-peni-ens/index.html'), 'utf8');
const tekst = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

test('в калькуляторе под расчётом пеней — строка про уточнёнки со ссылкой на Разбор № 30', () => {
  const m = KALK.match(/<p class="note" id="peni-utochnenka">([\s\S]*?)<\/p>/);
  assert.ok(m, 'строка #peni-utochnenka есть');
  assert.match(m[1], /href="\/praktika\/nalogi\/utochnenka-i-peni-ens\/"/);
  assert.match(tekst(m[1]), /Пени по старым периодам — проверьте уточнёнки/);
  assert.ok(!/гарантир|незаконн|отмен|спиш/i.test(tekst(m[1])), 'без обещания исхода');
  // строка — внутри формы расчёта, после примечания о пенях (а не в конце страницы)
  assert.ok(KALK.indexOf('id="peni-utochnenka"') > KALK.indexOf('Пени считаем за 2 года'));
  assert.ok(KALK.indexOf('id="peni-utochnenka"') < KALK.indexOf('id="sv-pen"'));
});

test('фраза о счёте сроков совпадает с текстом Разбора № 30 (не пересказ)', () => {
  const fraza = 'Счёт сроков идёт не от года налога, а от того, что вы подали и что решила инспекция.';
  assert.ok(tekst(RAZBOR).includes(fraza), 'фраза есть в разборе');
  assert.ok(tekst(KALK).includes(fraza), 'фраза есть в калькуляторе');
});
