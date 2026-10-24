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
  for (const f of ['не позднее 7 дней после вашего письменного заявления (п. 5 ст. 859 ГК РФ)', '(абз. 2 п. 5 ст. 7.7 115-ФЗ)', '(п. 6 ст. 7.7)',
    'МВК — 6 месяцев (ст. 7.8 115-ФЗ)', 'Поздняя «красная» зона не оправдывает просрочку.', '№ Ф05-300/2024', 'А40-42087/2023']) {
    assert.ok(t.includes(f), 'нет: ' + f);
  }
  // пример — по ответу [Право] 24.10, разд. 2: при «красной» зоне до заявления остаток не выдают целиком
  assert.ok(t.includes('все 1 200 000 ₽ ждут её снятия: при расторжении остаток не выдают (абз. 2 п. 5 ст. 7.7 115-ФЗ)'));
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

// [Право] 24.10 (claude/Право_ответы_✎_24.10_остаток_красная_зона_пошлины_ИС_Разбор_27.md, разд. 2): абз. 2 п. 5 ст. 7.7 115-ФЗ —
// остаток клиенту «красной» зоны при расторжении не выдают, исключения — только абз. 7 и 10 п. 6 (банкротство, выплаты
// участникам после исключения из ЕГРЮЛ). Налоги, зарплата, кредит, 30 000 ₽ на жизнь ИП — операции по счёту, не выдача остатка.
// Было: «на жизнь 90 000 ₽ в месяц, за 6 месяцев не больше 540 000 ₽» — читатель ждал денег, которых не будет. [Ночные запуски] 24.10.
test('разбор № 5: «красная» зона до заявления — остаток не выдают, 30 000 ₽ — не из остатка', () => {
  const s = chitat('praktika/115-fz/ostatok-pri-zakrytii-scheta/index.html');
  const t = un(s);
  for (const n of ['540 000', '660 000', '90 000']) assert.ok(!t.includes(n), 'осталась сумма «на жизнь из остатка»: ' + n);
  const kon = un(s.slice(s.indexOf('Сколько на кону'), s.indexOf('</div>', s.indexOf('class="primer"'))));
  assert.ok(!/30 000/.test(kon), '«Сколько на кону» считает 30 000 ₽');
  // «до 30 000 ₽ в месяц» — только в утверждённой фразе, что это платежи по счёту, а не выдача остатка
  const fr = 'до 30 000 ₽ в месяц на жизнь ИП — это платежи по счёту, пока он работает, а не выдача остатка (п. 6 ст. 7.7).';
  const vse = t.split('до 30 000 ₽ в месяц').length - 1;
  const verno = t.split(fr).length - 1;
  assert.ok(verno >= 1 && vse === verno, '«до 30 000 ₽ в месяц» рядом с остатком без оговорки: ' + vse + ' / ' + verno);
  assert.ok(t.includes('Исключений для остатка всего два: банкротство и выплаты участникам после исключения компании из реестра.'));
  assert.ok(!/правило другое: банк не выдаёт остаток/.test(t), 'старая формулировка');
  // FAQ — тот же текст и в разметке FAQPage
  const ld = JSON.parse(s.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g).map((x) => x.replace(/<\/?script[^>]*>/g, '')).find((x) => x.includes('FAQPage')));
  const q = [].concat(ld['@graph'] || ld).find((x) => x['@type'] === 'FAQPage').mainEntity.find((x) => /«красной» зоне ЗСК\?$/.test(x.name));
  assert.ok(q.acceptedAnswer.text.includes('Исключений для остатка всего два'), 'FAQPage: старый ответ');
  // «Где в законе»: два исключения и ред. 283-ФЗ; dateModified — дата правки
  assert.ok(t.includes('абз. 2 п. 5, абз. 7 и 10 п. 6 ст. 7.7 и ст. 7.8 Федерального закона № 115-ФЗ'));
  assert.ok(/"dateModified": "2026-10-2\d"/.test(s) && !s.includes('"dateModified": "2026-10-05"'));
});

test('разбор № 5: «Скорая», сценарий «Расторгает договор счёта», не считает «на жизнь из остатка»', () => {
  const e = chitat('skoraya-115-fz/engine.js');
  const a = e.indexOf('\n    rastorzhenie: {'); const b = e.indexOf('\n    }', a);
  const r = un(e.slice(a, b));
  assert.ok(a > 0 && !/30 000|на жизнь/.test(r), 'в сценарии «Расторгает договор счёта» — выплаты из остатка');
});
