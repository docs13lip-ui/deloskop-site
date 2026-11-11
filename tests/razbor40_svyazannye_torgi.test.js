// razbor40-v1 ([Ночные запуски] 06.11): Разбор № 40 «Связанные компании на одних торгах — картель» — текст [Право] 05.11 разд. 6
// с заменами [Право] 06.11 (claude/Право_✎_Разбор_40_рамка_14.32_06.11.md): рамка «связанные компании», не «группа»;
// «учредитель» — не признак дела; санкция только ч. 2 ст. 14.32 КоАП (ч. 1 не упоминаем), с потолком 1/25 выручки.
// 307-ЭС26-4283 — полный текст сверен по garant (Ночные 05.11), 193-ПЭК26 — копия sudact, дата (18/19.10) — Штаб на vsrf.ru, пока «октябрь 2026».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-');
const SLUG = 'svyazannye-kompanii-na-torgah-kartel-vs-2026';

test('Разбор № 40: данные — ВС № 307-ЭС26-4283 от 10.07.2026, «Договоры», первым, копия, razbor40_check, ≥ 2 входящие', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'dogovory');
  assert.ok(D.razbory.slice(0, 4).some((x) => x.slug === SLUG), 'новые разборы — первыми'); // razbor41-v1 (07.11): № 41 встал первым; razbor43-v1 (11.11): +1
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog + ' ' + d.sverka_vid), ['№ 307-ЭС26-4283 2026-07-10 В пользу УФАС kopiya']);
  assert.ok(r.dela[0].delo.includes('А56-932/2025'));
  assert.strictEqual(r.knopka.cel, 'razbor40_check');
  assert.ok(!/учредител/i.test(JSON.stringify(r)), 'учредителя в деле нет');
  assert.ok(Object.values(D.ssylki_s_sajta).filter((v) => Array.isArray(v) && v.includes(SLUG)).length >= 2, '≥ 2 входящие');
});

test('Разбор № 40: текст — рамка «связанные», группой не были, только ч. 2 ст. 14.32 с потолком, арифметика в примере, 193-ПЭК26 без дня', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  for (const s of ['десяти закупках', 'одного IP-адреса', '0,5–1 %', 'группой не были вовсе', 'ч. 7 ст. 11', 'ч. 2 ст. 14.32 КоАП', '1/25', 'не меньше 100 000 ₽', 'от 20 000 до 50 000 ₽', 'не данные дела', 'А56-932/2025'])
    assert.ok(t.includes(s), s);
  assert.ok(!/учредител|ч\. 1 ст\. 14\.32|одна группа|компании группы/i.test(t), 'старая рамка и ч. 1 — убраны');
  assert.ok(!/1[89] октября/.test(t), 'день 193-ПЭК26 — после сверки Штабом');
  assert.strictEqual((t.match(/<blockquote/g) || []).length, 1, 'цитата одна');
  assert.ok(!/ошибочно не учли/.test(t), 'в 193-ПЭК26 иначе: «ошибочно не учтена судами…» — в кавычки не ставим');
  const vne = t.replace(/<div class="primer">[\s\S]*?<\/div>/, '');
  assert.ok(!/10 млн|от 1 до 5 млн/.test(vne), 'расчёт вне примера');
});

test('Разбор № 40: страница — честная строка «Сверено», FAQPage, форма ИНН, хаб «Договоры»', () => {
  const s = un(chitat('praktika/dogovory/' + SLUG + '/index.html'));
  assert.ok(/"@type": ?"FAQPage"/.test(s) && s.includes('data-goal="razbor40_check"'));
  assert.ok(s.includes('по полному тексту в копии правовой базы, с сайтом Верховного суда ещё сверяем'));
  assert.ok(s.includes('<form class="dl__f" action="/"'));
  assert.ok(un(chitat('praktika/dogovory/index.html')).includes('/praktika/dogovory/' + SLUG + '/'));
});
