// [Ночные запуски] seo-pered-volnoj-v1.1 (03.10.2026): вводные абзацы хабов /115-fz/ и /nalogi/ и строка хабов «Практики» —
// тексты и правило [Право] 03.10 10:20 (claude/Право_хабы_115_налоги_исключение_ЕГРЮЛ_03.10.md, разд. 1, 2, 4).
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const tekst = (h) => h.replace(/<[^>]+>/g, '').replace(/ /g, ' ');

const VVOD = {
  '115-fz/index.html':
    'Банк вправе запросить документы по операции, отказать в её проведении или ограничить интернет-банк, если операция вызывает у него подозрения (ст. 7 Федерального закона № 115-ФЗ). Часто дело не в нарушении, а в том, как операции выглядят со стороны: крупное снятие наличных, частые переводы самому себе, деньги, которые приходят и сразу уходят дальше. Здесь — что делать в первый день, как ответить на запрос банка и как заранее увидеть свою компанию глазами банка. В каждой статье — ссылки на нормы и дата редакции.',
  'nalogi/index.html':
    'Налоговая может отказать в вычете НДС и не учесть расходы, если решит, что сделку на деле исполнил не ваш контрагент или что её главная цель — уменьшить налог (п. 2 ст. 54.1 НК РФ). Но нарушения самого поставщика по закону не могут быть единственной причиной отказа (п. 3 ст. 54.1 НК РФ). Снизить риск помогают проверка поставщика до оплаты и доказательства этой проверки на дату сделки. Здесь — как проверить контрагента по ИНН, сколько платить вперёд незнакомой компании, как сравнить свою нагрузку со средней по отрасли и что делать, если пришло письмо о смене реквизитов.',
};

test('вводный абзац хаба — дословно текст [Право], один раз, сразу под подзаголовком и до карточек', () => {
  for (const [f, t] of Object.entries(VVOD)) {
    const h = chitat(f);
    const m = [...h.matchAll(/<p class="vvod">([\s\S]*?)<\/p>/g)];
    assert.strictEqual(m.length, 1, f);
    assert.strictEqual(tekst(m[0][1]), t, f);
    assert.ok(h.indexOf('class="vvod"') > h.indexOf('<h1>') && h.indexOf('class="vvod"') < h.indexOf('<div class="cards"'), f);
    assert.ok(/\.vvod\{/.test(h), f + ': стиль .vvod');
    // типографика: номер нормы не отрывается от цифры
    assert.ok(!/(ст\.|п\.|№) \d/.test(m[0][1]), f + ': неразрывный пробел после «ст.», «п.», «№»');
  }
});

test('в абзацах нет снятых [Право] формулировок', () => {
  const vse = Object.keys(VVOD).map((f) => tekst(chitat(f).match(/<p class="vvod">([\s\S]*?)<\/p>/)[1])).join(' ');
  for (const z of ['остановить операцию', 'Чаще всего', 'красной', 'кажется ему необычной', 'Защита —', 'гарантир', 'дата сверки']) {
    assert.ok(!vse.includes(z), z);
  }
});

test('строка хабов «Практики»: «опубликован {дата}»; без судебного акта — «судебных решений и позиций ведомств»', () => {
  for (const f of ['praktika/index.html', 'praktika/115-fz/index.html', 'praktika/nalogi/index.html']) {
    const lid = tekst(chitat(f).match(/<p class="lid">([\s\S]*?)<\/p>/)[1]);
    assert.ok(/Последний — «[^»]+», опубликован \d{1,2} [а-я]+ \d{4}/.test(lid), f + ': ' + lid);
  }
  const kod = `
import sys, importlib.util
sys.path.insert(0, ${JSON.stringify(path.join(K, 'tests'))})
spec = importlib.util.spec_from_file_location("sp", ${JSON.stringify(path.join(K, 'tests/sobrat_praktika.py'))})
sp = importlib.util.module_from_spec(spec); spec.loader.exec_module(sp)
sud = {"h1": "А", "data": "2026-10-03", "dela": [{"sud": "Верховный суд РФ"}]}
min_ = {"h1": "Б", "data": "2026-10-02", "dela": [{"organ": "Минфин России"}]}
bez = {"h1": "В", "data": "2026-10-01"}
print(sp.svodka_haba([sud]))
print(sp.svodka_haba([sud, min_]))
print(sp.svodka_haba([bez]))
`;
  const [a, b, c] = execFileSync('python3', ['-c', kod], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(a.includes('1 разбор решений ВС, КС и арбитражных судов') && a.includes('опубликован 3 октября 2026'), a);
  assert.ok(b.includes('2 разбора судебных решений и позиций ведомств'), b);
  assert.ok(c.includes('судебных решений и позиций ведомств'), 'без поля — второй вариант: ' + c);
});
