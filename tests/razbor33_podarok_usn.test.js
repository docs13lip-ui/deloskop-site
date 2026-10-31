// razbor33-v1 ([Ночные запуски] 31.10): Разбор № 33 «Подарок от бабушки и упрощёнка» — текст [Право · Налоговый юрист] 30.10
// (claude/Право_Разбор_33_подарок_ИП_УСН_30.10.md). Определение ВС от 20.10.2026 № 305-ЭС26-10933 (А41-72872/2025) — отказ в передаче.
// ◐ PDF из облака закрыт: цитат в кавычках нет (пересказ), сумма доначисления не выдумана; имя ИП не публикуем.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-');
const SLUG = 'podarok-ot-rodstvennika-usn-vs-2026';
const URL = '/praktika/nalogi/' + SLUG + '/';
const R27 = 'podarok-ot-roditelya-ip-ndfl-vs-2026';

test('Разбор № 33: данные — ВС № 305-ЭС26-10933 от 20.10.2026, «Налоги», среди свежих, связка с № 27', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'nalogi');
  assert.ok(D.razbory.slice(0, 4).some((x) => x.slug === SLUG), 'новые разборы — первыми');
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog), ['№ 305-ЭС26-10933 2026-10-20 В пользу налогоплательщика']);
  assert.ok(r.dela[0].delo.includes('А41-72872/2025') && /отказ в передаче/.test(r.dela[0].delo), 'это отказ в передаче, а не решение коллегии');
  assert.strictEqual(r.knopka.cel, 'razbor33_check');
  assert.ok(r.pohozhie.includes(R27));
  assert.ok(D.razbory.find((x) => x.slug === R27).pohozhie.includes(SLUG), '№ 27 → № 33');
});

test('Разбор № 33: текст по [Право], без цитат до сверки, без суммы дела, без имён', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  for (const s of ['п. 8 ст. 250 НК', '№ 309-ЭС24-21782', '№ 305-ЭС26-10933', '120 000 ₽', '300 000 ₽', 'п. 6 ст. 100 НК', 'не данные дела', 'не решение коллегии'])
    assert.ok(t.includes(s), s);
  for (const d of ['2025-02-12', '2025-12-15', '2026-03-02', '2026-06-17', '2026-10-20']) assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(!/blockquote|«по своей природе/.test(t), 'цитаты — после сверки по PDF');
  assert.ok(!/(?<!не )гарантир/i.test(t));
  assert.ok(!/[А-ЯЁ][а-яё]+(ов|ев|ина)(а)? [А-ЯЁ]\. ?[А-ЯЁ]\./.test(t), 'имён нет');
  const s = un(chitat('praktika/nalogi/' + SLUG + '/index.html'));
  assert.ok(/"@type": ?"FAQPage"/.test(s) && s.includes('razbor33_check'));
});

test('Разбор № 27: вопрос об УСН больше не «открыт» — ответ и ссылка на № 33', () => {
  const t = un(chitat('tests/praktika/' + R27 + '.html'));
  assert.ok(t.includes('№ 305-ЭС26-10933') && t.includes(URL));
  const F = JSON.parse(chitat('praktika/faq.json')).razbory[R27];
  const q = F.find((x) => /УСН/.test(x.v));
  assert.strictEqual(q.o[0], 'Похоже, что нет.');
  assert.ok(un(chitat('praktika/nalogi/' + R27 + '/index.html')).includes(URL));
});
