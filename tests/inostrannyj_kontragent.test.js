// pravo-stroki-3110-v1 ([Ночные запуски] 31.10): строка [Право] 31.10 об иностранном контрагенте в чек-листе
// «Проверка контрагента перед договором» (claude/Право_✎_иностранный_контрагент_Обзоры_ВС_Разбор_35_31.10.md, разд. 1)
// и строки Обзора ВС № 3 (2026), п. 33 в разборах № 27 и № 33 (разд. 3).
// Условия [Право]: без «запрещено»/«нельзя», без дат вступления в силу; одна ссылка на перечень из текста + карточка «Читайте также».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/‑/g, '-');
const PER = '/nalogi/nedruzhestvennye-gosudarstva-perechen/';
const CHEK = 'nalogi/proverka-kontragenta-pered-dogovorom/index.html';

const abzac = () => {
  const m = un(chitat(CHEK)).match(/<p id="inostrannyj">([\s\S]*?)<\/p>/);
  assert.ok(m, 'абзац #inostrannyj есть');
  return m[1];
};

test('Чек-лист: абзац об иностранном контрагенте — текст [Право], указы № 81 и № 95, порог 10 млн ₽ в месяц', () => {
  const a = abzac().replace(/<[^>]+>/g, '');
  for (const f of [
    'Иностранный контрагент или иностранный владелец.',
    'сверьте страну с перечнем недружественных государств',
    'с разрешения правительственной комиссии (Указ Президента от 01.03.2022 № 81)',
    'свыше 10 млн ₽ в месяц возвращают через счёт типа «С» (Указ Президента от 05.03.2022 № 95)',
    'Платёж в обход этого порядка суд может признать ничтожным.',
  ]) assert.ok(a.includes(f), f);
  assert.ok(!/запрещ|нельзя|вступ\w* в силу/i.test(a), 'без «запрещено», «нельзя» и дат вступления в силу');
});

test('Чек-лист: одна ссылка на перечень из текста <main> + карточка «Читайте также»', () => {
  const s = un(chitat(CHEK));
  const main = s.slice(s.indexOf('<main'), s.indexOf('<section class="more"'));
  const v = main.split('href="' + PER + '"').length - 1;
  assert.strictEqual(v, 1, 'из текста — ровно одна ссылка');
  assert.ok(abzac().includes('href="' + PER + '"'), 'и она — в абзаце об иностранном контрагенте');
  const more = s.slice(s.indexOf('<section class="more"'));
  assert.ok(more.slice(0, more.indexOf('</section>')).includes(PER), 'карточка «Читайте также» на месте');
  assert.ok(s.includes('cons_doc_LAW_410578') && s.includes('cons_doc_LAW_537231'), 'в источниках — Указ № 81 и обзор № 8/2026');
});

test('Разборы № 27 и № 33: строка Обзора № 3 (2026), п. 33 — по [Право] 31.10; про УСН — честная оговорка', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const zakon = (slug) => D.razbory.find((x) => x.slug === slug).zakon.map((z) => z[0]);
  const r27 = zakon('podarok-ot-roditelya-ip-ndfl-vs-2026').filter((z) => z.includes('44-КАД26-3-К7'));
  assert.strictEqual(r27.length, 1);
  assert.ok(r27[0].includes('важна только близость родства') && r27[0].includes('не статус ИП'));
  const r33 = zakon('podarok-ot-rodstvennika-usn-vs-2026').filter((z) => z.includes('44-КАД26-3-К7'));
  assert.strictEqual(r33.length, 1);
  assert.ok(r33[0].startsWith('Рядом:') && r33[0].includes('Про УСН обзор не говорит'));
  // (б) «Вокфорс» в Обзоре № 2 и (в) 67-КАД25-12-К8 — [Право] 31.10: «нет», не ставим.
  assert.ok(!zakon('vokfors-rekonstrukciya').some((z) => z.includes('Обзор судебной практики Верховного суда РФ № 2 (2026)')));
  assert.ok(!JSON.stringify(D).includes('67-КАД25-12-К8'));
  for (const f of ['praktika/nalogi/podarok-ot-roditelya-ip-ndfl-vs-2026/index.html', 'praktika/nalogi/podarok-ot-rodstvennika-usn-vs-2026/index.html']) {
    assert.ok(un(chitat(f)).includes('44-КАД26-3-К7'), 'собрано в ' + f);
  }
});
