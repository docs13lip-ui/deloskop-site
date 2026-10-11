// dostup-o2-v1: срок открытия доступа после оплаты по счёту — один на весь сайт, как в оферте (О2 [Право] 10.10):
// «не позднее рабочего дня, следующего за днём зачисления оплаты». Оплату по счёту подтверждаем вручную —
// обещание «в день поступления денег» нарушалось бы при зачислении в выходной или ночью (п. 2 ч. 3 ст. 5 38-ФЗ).
// Прежний текст оферты в бете (<!--v-bete-->…<!--/v-bete-->) уходит сам при включении оплат — его не считаем.
// Граждан картой не обещаем (О6): при "karta": false — «Для граждан оплата откроется позже…».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const PROPUSK = new Set(['node_modules', '.git', 'tests']);
function obhod(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!PROPUSK.has(e.name)) obhod(p, out); }
    else if (/\.(html|js|json)$/.test(e.name) && e.name !== 'obnovleniya.json') out.push(p);
  }
  return out;
}
const FAJLY = obhod(KOREN, []).concat([path.join(KOREN, 'tests/sobrat_tarify.py')]);
const SP = '(?:\\s|&nbsp;|\\u00a0)+';
const V_DEN = new RegExp('[вВ]' + SP + 'день' + SP + '(?:поступления|зачисления)' + SP + '(?:денег|оплаты)', 'g');

test('нигде не обещаем доступ «в день поступления/зачисления» денег или оплаты', () => {
  const plohie = [];
  for (const f of FAJLY) {
    const t = fs.readFileSync(f, 'utf8').replace(/<!--v-bete-->[\s\S]*?<!--\/v-bete-->/g, '');
    const m = t.match(V_DEN);
    if (m) plohie.push(path.relative(KOREN, f) + ': ' + m.join(' | '));
  }
  assert.deepStrictEqual(plohie, []);
});

test('гражданам не обещаем оплату картой (О6), текст [Право] — в форме счёта', () => {
  const s = fs.readFileSync(path.join(KOREN, 'js/schet.js'), 'utf8');
  assert.ok(!/Физлицам оплата картой/.test(s));
  assert.ok(s.includes('Для граждан оплата откроется позже — напишите на help@deloskop.ru, сообщим.'));
});

test('сроки доступа — формулой оферты: главная, /tarify/ (сборщик), основатель, реквизиты', () => {
  const W = 'не позднее рабочего дня, следующего за днём зачисления';
  const n = s => s.replace(/&nbsp;| /g, ' ');
  for (const f of ['index.html', 'osnovatel/index.html', 'rekvizity/index.html', 'js/schet.js', 'js/osnovatel.js', 'tests/sobrat_tarify.py'])
    assert.ok(n(fs.readFileSync(path.join(KOREN, f), 'utf8')).toLowerCase().includes(W), f);
  const of = n(fs.readFileSync(path.join(KOREN, 'oferta/index.html'), 'utf8'));
  assert.ok(of.includes('Доступ открывается не позднее рабочего дня, следующего за днём зачисления оплаты на наш счёт'));
});
