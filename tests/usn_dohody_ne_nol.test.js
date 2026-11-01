// usn-dohody-v1 — «УСН „доходы“ ≠ риск 0» и в текстах статей, не только в расчёте (doverie-v1, решение владельца 30.10, задание Master).
// Строки — claude/Право_доверие_строки_30.10.md и …_тексты_правил_30.10.md, разд. 2: «Не пишем: „налогового риска нет“, „риск 0“».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const tekst = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;| /g, ' ').replace(/&#8209;/g, '-').replace(/\s+/g, ' ');

function stranicy(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name.startsWith('.') || ['node_modules', 'tests', 'company'].includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) stranicy(p, out); else if (f.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const ZAPRET = /(упрощ[её]нк\S*|УСН)\s*«доходы»[^.]{0,120}?(нулев|риска? нет|риск\S* 0\b|претензий [^.]{0,20}не будет)/i;

test('ни одна страница не обещает «нулевой» налоговый риск на УСН «доходы»', () => {
  const plohie = stranicy(KOREN, []).filter((p) => ZAPRET.test(tekst(fs.readFileSync(p, 'utf8'))))
    .map((p) => path.relative(KOREN, p));
  assert.deepStrictEqual(plohie, []);
});

test('сторож ловит старую фразу (проверка самого сторожа)', () => {
  assert.ok(ZAPRET.test('Если вы на упрощёнке «доходы», налоговый риск по расходам нулевой, но'));
  assert.ok(!ZAPRET.test('На УСН «доходы» расходы не снимут. Нулевой ставки нет.'));
});

test('/nalogi/statya-54-1-…/: для УСН «доходы» — развилка по НДС, вычет из той же таблицы', () => {
  const html = fs.readFileSync(path.join(KOREN, 'nalogi/statya-54-1-nk-prostymi-slovami/index.html'), 'utf8');
  const m = html.match(/<p id="usn-dohody">([\s\S]*?)<\/p>/);
  assert.ok(m, 'абзац #usn-dohody есть');
  const t = tekst(m[1]);
  assert.match(t, /зависит от НДС/);
  assert.match(t, /22%/);
  assert.match(t, /5% или 7%/);
  assert.match(t, /115-ФЗ/);
  const vychet = tekst(html).match(/Вычет НДС \(ставка 22%, в сумме 1 200 000 ₽\) (\d{1,3}(?: \d{3})*) ₽/);
  assert.ok(vychet, 'строка вычета в таблице');
  assert.ok(t.includes(vychet[1] + ' ₽'), 'сумма в абзаце = вычет в таблице: ' + vychet[1]);
  assert.strictEqual(Math.round(1200000 * 22 / 122), Number(vychet[1].replace(/ /g, '')));
});
