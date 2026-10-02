// Разбор 115-ФЗ № 5 «Остаток при закрытии счёта» ([Ночные запуски] 02.10.2026 15:05; текст — [Право] 02.10 14:30, разд. 2).
// Держит: нормы и цифры текста [Право], кнопку в сценарий «Расторгает договор счёта», FAQ только из текста, ссылки с трёх страниц.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/ /g, ' ').replace(/&nbsp;/g, ' ').replace(/&#8209;/g, '-').replace(/<[^>]+>/g, '');
const URL = '/praktika/115-fz/ostatok-pri-zakrytii-scheta/';

test('разбор № 5: нормы, грань по дате и расчёт примера', () => {
  const t = un(chitat('praktika/115-fz/ostatok-pri-zakrytii-scheta/index.html'));
  for (const f of ['не позднее 7 дней после вашего письменного заявления (п. 5 ст. 859 ГК РФ)', '(п. 5 ст. 7.7 115-ФЗ)', '(п. 6 ст. 7.7)',
    'МВК — 6 месяцев (ст. 7.8 115-ФЗ)', 'Поздняя «красная» зона не оправдывает просрочку.', '№ Ф05-300/2024', 'А40-42087/2023']) {
    assert.ok(t.includes(f), 'нет: ' + f);
  }
  // пример: 3 × 30 000 = 90 000 в месяц; × 6 = 540 000; 1 200 000 − 540 000 = 660 000
  assert.strictEqual(3 * 30000 * 6, 540000);
  assert.strictEqual(1200000 - 540000, 660000);
  assert.ok(t.includes('3 × 30 000 = 90 000 ₽') && t.includes('540 000 ₽') && t.includes('660 000 ₽'));
  assert.ok(!/задерживать или отклонять|гарантир\S* (возврат|победу|исход)/i.test(t));
});

test('разбор № 5: кнопка — сценарий Скорой «rastorzhenie», шаги — rastorzhenie и zsk', () => {
  const s = chitat('praktika/115-fz/ostatok-pri-zakrytii-scheta/index.html');
  assert.ok(s.includes('class="btn" href="/skoraya-115-fz/?s=rastorzhenie"'));
  assert.ok(s.includes('href="/skoraya-115-fz/?s=zsk"'));
  const e = chitat('skoraya-115-fz/engine.js');
  assert.ok(/\n    rastorzhenie: \{/.test(e) && /\n    zsk: \{/.test(e));
});

test('разбор № 5: входящие ссылки с «ЗСК простыми словами», «Заблокировали счёт» и «Скорой»', () => {
  for (const f of ['115-fz/zsk-zony-riska/index.html', '115-fz/zablokirovali-schet-chto-delat/index.html', 'skoraya-115-fz/index.html']) {
    assert.ok(chitat(f).includes(`href="${URL}"`), f);
  }
});

// Правки [Право] 02.10 16:20 (claude/Право_ст859_Разбор5_Разбор8_личный_счёт_ИП_02.10.md, разд. 1) — [Ночные запуски] 22:05.
test('разбор № 5: исключение п. 3 ст. 858 ГК, без обещания исхода и без «дня в запас»', () => {
  const t = un(chitat('praktika/115-fz/ostatok-pri-zakrytii-scheta/index.html'));
  const s = chitat('skoraya-115-fz/engine.js'); // без un(): в JS есть «<» и «>»
  const g = 'эти ограничения переходят на остаток (п. 3 ст. 858 ГК РФ)';
  assert.ok(t.includes(g), 'разбор: нет п. 3 ст. 858');
  assert.ok(s.includes(g) && s.includes('(п. 5 ст. 859 ГК РФ)'), 'Скорая: нет п. 3 ст. 858 / п. 5 ст. 859');
  assert.ok(t.includes('Пока заявления нет, срок не идёт — подайте его в первый же день.'));
  assert.ok(t.includes('значит, банк уже просрочил.'));
  assert.ok(!/остаток ваш|в запас/.test(t), 'обещание исхода или двусмысленная подпись');
  assert.ok(t.includes('(п. 5 ст. 859 ГК РФ). Если банк опоздал'), 'лид — с нормой в скобках');
});
