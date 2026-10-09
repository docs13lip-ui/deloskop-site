// /partneram/ «Бухгалтерам и партнёрам: два способа» — partneram-v1, [Ночные-3] 04.10.2026.
// ТЗ [Продукт] 04.10 11:55 (claude/Продукт_страница_бухгалтерам_два_способа_ответы_✎_полоса_390_04.10.md, разд. 1);
// [Право] 04.10 12:30 (claude/Право_партнёры_отчёты_клиентам_ИП_FAQ_ЭСП_ЦБ_402ФЗ_04.10.md, разд. 3–4.1):
// FAQ об ИП — без фразы о слежении (кабинет принимает ИНН из 12 цифр); карточка Б — только вместе с п. 3.2.1 оферты.
// Запуск: node --test tests/partneram.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const T = JSON.parse(chitat('tarify/tarify.json'));
const html = chitat('partneram/index.html');
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const tekst = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');
const vidimo = tekst(main.replace(/<template[\s\S]*?<\/template>/g, ' '));

test('38-ФЗ: нет «зарабат», «успейте», сумм дохода; «гарант» — только в вопросе с ответом «Нет.»', () => {
  assert.ok(!/зарабат|успейте|до\s*\d+\s*тыс|₽\s*к\s*чеку/i.test(vidimo), vidimo.match(/зарабат|успейте/i));
  const g = (vidimo.match(/[^.?]*гарант[^.?]*\?\s*\S+/gi) || []);
  assert.strictEqual(g.length, 1);
  assert.ok(/Нет\.$/.test(g[0].trim()), g[0]);
  assert.ok(!/Рекомендуем/.test(main), 'карточки равного веса — без «Рекомендуем»');
});

test('ставки и цифры тарифов подставлены из tarify.json (а не вписаны руками)', () => {
  const S = T.partner_stavka;
  const tar = Object.fromEntries(T.tarify.map((t) => [t.id, t]));
  const span = [...main.matchAll(/<span data-partner="(\w+)">([^<]*)<\/span>/g)];
  assert.ok(span.length >= 5);
  for (const [, k, v] of span) assert.strictEqual(v, String(S[k]), k);
  const t = [...main.matchAll(/<span data-tarif="(\w+)\.(\w+)">([^<]*)<\/span>/g)];
  assert.ok(t.length >= 6);
  for (const [, id, pole, v] of t) assert.strictEqual(v, String(tar[id][pole]), id + '.' + pole);
  // сборщик сам приводит страницу к tarify.json
  assert.ok(chitat('tests/sobrat_tarify.py').includes("'partneram/index.html'"));
});

test('ровно одна главная кнопка, цели Метрики, «Стать партнёром» ведёт на почту (кабинета партнёра нет)', () => {
  assert.strictEqual((main.match(/btn--primary/g) || []).length, 1);
  assert.ok(/href="\/\?utm_source=partneram" data-goal="partner_proverka">Проверить контрагента клиента</.test(main));
  assert.ok(/href="mailto:help@deloskop\.ru\?subject=[^"]+" data-goal="partner_start">Стать партнёром/.test(main));
  assert.ok(!/partner.*cabinet|cabinet\.html#partn/i.test(main));
});

test('FAQ: ИП — без обещания о слежении (кабинет ставит на слежение и 12 цифр)', () => {
  assert.ok(vidimo.includes('Быстрая проверка ИП работает. Сведения об ИП мы не публикуем на открытых страницах.'));
  const kab = chitat('cabinet.html');
  if (/ИП на слежение не ставим|не ставим ИП на слежение/.test(vidimo)) {
    assert.ok(!/10 цифр у компании или 12 у ИП'\);return\}\s*var b=this/.test(kab), 'фраза о слежении есть, а кабинет принимает ИНН ИП');
  }
  assert.ok(!/слежени[^.]*ИП|ИП[^.]*слежени/.test(vidimo));
  assert.ok(vidimo.includes('Гарантирует ли проверка, что клиенту не заблокируют счёт? Нет. Решение принимает банк. Делоскоп помогает заметить риски заранее и подготовить документы.'));
  assert.ok(html.includes('"@type": "FAQPage"') && html.includes('"name": "Можно ли проверять компании-ИП?"'));
});

test('бета-блок — только в бете (половина <!--v-bete-->)', () => {
  const m = main.match(/<!--oplata-->([\s\S]*?)<!--\/oplata--><!--v-bete-->([\s\S]*?)<!--\/v-bete-->/);
  // beta-data-v1: дата — из tarify.json → beta_do (сборщик), после конца дня span убирает браузер
  assert.ok(m && /всё бесплатно<span data-beta-srok(="\d{4}-\d{2}-\d{2}")? data-beta-vkl>( по&nbsp;\d{1,2}&nbsp;[а-я]+ включительно)?<\/span>\./.test(m[2]));
  if (T.beta) assert.ok(!m[2].startsWith('<template')); else assert.ok(m[2].startsWith('<template data-v-bete>'));
});

test('страница настоящая: в sitemap, в подвале «Компания», крошки условий ведут на /partneram/', () => {
  assert.ok(chitat('sitemap.xml').includes('<loc>https://deloskop.ru/partneram/</loc>'));
  assert.ok(html.includes('<link rel="canonical" href="https://deloskop.ru/partneram/">'));
  assert.ok(html.includes('"@type": "BreadcrumbList"'));
  const pod = JSON.parse(chitat('partials/obolochka.json')).podval;
  assert.ok(/aria-label="Компания">[\s\S]*?<a href="\/partneram\/">Бухгалтерам и партнёрам<\/a>/.test(pod));
  const u = chitat('partneram/usloviya/index.html');
  assert.ok(u.includes('<a href="/">Делоскоп</a> › <a href="/partneram/">Партнёрам</a> › <span>Условия</span>'));
  assert.ok(u.includes('"name": "Партнёрам", "item": "https://deloskop.ru/partneram/"'));
});

test('[Право] 4.1: в оферте п. 3.2.1 об отчётах клиентам бухгалтера — карточка Б без него не выходит', () => {
  const o = tekst(chitat('oferta/index.html'));
  assert.ok(o.includes('3.2.1. Пользователь, который оказывает бухгалтерские, юридические или консультационные услуги, вправе использовать Отчёты при оказании этих услуг своим клиентам'));
  assert.ok(o.includes('Персональные данные из Отчёта Пользователь передаёт только в объёме, нужном клиенту для этой сделки.'));
  assert.ok(!/передавайте Паспорт|название (вашей )?бухфирмы/i.test(vidimo), 'показ Паспортов клиентам — ждёт [Право] до 08.10');
});
