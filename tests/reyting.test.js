// Рейтинг по открытой отчётности /reyting/ (reyting-v1, 10.10.2026; решение владельца 10.10 04:35, п. 3).
// Сборщик — tests/sobrat_reyting.py: цифры только с опубликованных карточек /company/, у каждой таблицы — источник и дата.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const STR = path.join(KOREN, 'reyting', 'index.html');
const chitat = () => fs.readFileSync(STR, 'utf8');
const vidimyj = h => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\u00a0/g, ' ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const dannye = () => JSON.parse(execFileSync('python3', ['-c',
  "import sys,json;sys.path.insert(0,'tests');import sobrat_reyting as R;D=R.sobrat_dannye(R.kartochki());" +
  "f=lambda L,v:[[k['inn'],k[v]['v'],k[v]['god'],k[v].get('izm')] for k in L];" +
  "print(json.dumps({'vsego':D['vsego'],'god':D['god'],'vyr':f(D['vyruchka'],'vyruchka'),'rost':f(D['rost'],'vyruchka'),'pr':f(D['pribyl'],'pribyl'),'ub':f(D['ubytok'],'pribyl'),'otkryt':R.OTKRYT}))"],
  { cwd: KOREN, encoding: 'utf8' }));

test('страница собрана из текущих карточек (после сборки карточек — python3 tests/sobrat_reyting.py)', () => {
  execFileSync('python3', [path.join(KOREN, 'tests', 'sobrat_reyting.py'), '--check'], { cwd: KOREN, encoding: 'utf8' });
});

test('до «да» [Право] — noindex и адреса нет в sitemap', () => {
  const D = dannye(), h = chitat();
  if (!D.otkryt) {
    assert.match(h, /<meta name="robots" content="noindex, nofollow">/);
    for (const sm of ['sitemap.xml', 'sitemap-companies.xml']) {
      const p = path.join(KOREN, sm);
      if (fs.existsSync(p)) assert.doesNotMatch(fs.readFileSync(p, 'utf8'), /\/reyting\//, sm);
    }
  }
});

// reyting-v1.1: «да» [Право] 10.10 10:07, разд. 1 — страница в индексе
test('после «да» [Право] — без noindex, одна строка в sitemap.xml, ссылка из хаба /company/, title ≤ 70, description ≤ 160', () => {
  const D = dannye(), h = chitat();
  if (!D.otkryt) return;
  const golova = h.slice(0, h.indexOf('</head>'));
  assert.doesNotMatch(golova, /noindex/);
  assert.match(golova, /<link rel="canonical" href="https:\/\/deloskop\.ru\/reyting\/">/);
  const sm = fs.readFileSync(path.join(KOREN, 'sitemap.xml'), 'utf8');
  assert.strictEqual((sm.match(/<loc>https:\/\/deloskop\.ru\/reyting\/<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length, 1, 'sitemap.xml');
  const smk = path.join(KOREN, 'sitemap-companies.xml');
  if (fs.existsSync(smk)) assert.doesNotMatch(fs.readFileSync(smk, 'utf8'), /\/reyting\//, 'в sitemap-companies.xml — не дублировать');
  const hab = fs.readFileSync(path.join(KOREN, 'company', 'index.html'), 'utf8');
  assert.strictEqual((hab.match(/<!--reyting--><p class="co-reg caption"><a href="\/reyting\/">/g) || []).length, 1, 'ссылка из хаба');
  const title = golova.match(/<title>([^<]*)<\/title>/)[1].replace(/&nbsp;/g, ' ');
  const desc = golova.match(/<meta name="description" content="([^"]*)"/)[1].replace(/&nbsp;/g, ' ');
  assert.ok(title.length <= 70, 'title ' + title.length);
  assert.ok(desc.length <= 160, 'description ' + desc.length);
});

test('тексты [Право] 10.10 дословно: «не кредитный рейтинг» и канал исправления ошибки', () => {
  const v = vidimyj(chitat()).replace(/\s+/g, ' ').replace(/ ([:.,])/g, '$1');
  assert.ok(v.includes('Это не кредитный рейтинг, не оценка компании и не совет, с кем работать: только цифры из бухгалтерской отчётности (ГИР БО) и ЕГРЮЛ — с годом отчётности и датой сведений.'));
  assert.ok(v.includes('Нашли ошибку в цифре — напишите на help@deloskop.ru: проверим по отчётности и исправим.'));
});

test('нет ИНН из 12 цифр и ФИО (152-ФЗ); у компаний без отчётности за год — не «0», их просто нет в таблице', () => {
  const h = chitat(), v = vidimyj(h);
  assert.doesNotMatch(h, /(^|[^\d])\d{12}([^\d]|$)/, '12 цифр подряд — похоже на ИНН ИП');
  assert.doesNotMatch(v, /[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(ович|евич|ьич|овна|евна|ична|инична)(?![а-яё])/, 'ФИО');
  assert.doesNotMatch(v, /[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.\s?[А-ЯЁ]\./, 'Фамилия И. О.');
  for (const [, z] of h.matchAll(/<td class="num ry-z">([\s\S]*?)<\/td>/g)) {
    assert.doesNotMatch(z.replace(/&nbsp;/g, ' '), /(^|[^\d,])0 (тыс\. |млн |млрд )?₽/, 'ноль в таблице: ' + z);
  }
});

test('таблицы упорядочены по цифре, одна таблица — один год, только юрлица', () => {
  const D = dannye();
  assert.ok(D.vsego >= 10, 'мало карточек');
  const ubyv = (L, i) => L.every((r, j) => j === 0 || L[j - 1][i] >= r[i]);
  assert.ok(ubyv(D.vyr, 1), 'выручка не по убыванию');
  assert.ok(ubyv(D.rost, 3), 'рост не по убыванию');
  assert.ok(ubyv(D.pr, 1), 'прибыль не по убыванию');
  assert.ok(D.ub.every(r => r[1] < 0) && D.pr.every(r => r[1] > 0), 'прибыль и убыток перепутаны');
  assert.ok(D.vyr.every(r => r[2] === D.god), 'в таблице выручки — разные годы');
  for (const L of [D.vyr, D.rost, D.pr, D.ub]) for (const r of L) assert.match(r[0], /^\d{10}$/, 'не юрлицо: ' + r[0]);
});

test('у каждой таблицы — источник, дата сведений и статус; «не вошли» объяснено', () => {
  const h = chitat();
  const sekcii = h.split('<section class="co-sec').slice(1);
  const s_tabl = sekcii.filter(s => s.includes('<table'));
  assert.ok(s_tabl.length >= 3, 'таблиц меньше трёх');
  for (const s of s_tabl) assert.match(s, /class="co-src ry-src">[^<]*(сведения на \d{2}\.\d{2}\.\d{4}|дата регистрации)[^<]*● подтверждено источником/, 'таблица без источника и даты');
  const v = vidimyj(h);
  if (/не вошли \d+/.test(v)) assert.match(v, /не значит, что её нет у компании/);
});

test('цифры на странице — ровно как на карточке компании', () => {
  const h = chitat();
  const stroki = [...h.matchAll(/<tr><td class="ry-n num">\d+<\/td><td class="ry-k"><a href="(\/company\/[^"]+)">[\s\S]*?<td class="num ry-z">(?:<b class="ry-big">[^<]*<\/b><span class="ry-izm">)?([^<]*?₽)/g)];
  assert.ok(stroki.length >= 20, 'мало строк с суммой');
  const pr = x => x.replace(/&nbsp;|\u00a0/g, ' ');
  for (const [, url, summa] of stroki) {
    const k = pr(fs.readFileSync(path.join(KOREN, url, 'index.html'), 'utf8'));
    assert.ok(k.includes(pr(summa).trim()), `${url}: на карточке нет суммы «${pr(summa).trim()}»`);
  }
});

test('слова: без оценки надёжности и советов, ИИ не упоминаем, без данных ИП', () => {
  const v = vidimyj(chitat());
  assert.doesNotMatch(v, /надёжн|надежн|лучш|рекоменд|благонадёжн|гарантир|нейросет|(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)/i);
  assert.doesNotMatch(v, /ОГРНИП|ИНН\s*\d{12}\b/);
  assert.match(v, /не оценка компании и не совет/);
  assert.match(v, /Индивидуальных предпринимателей здесь нет/);
  assert.doesNotMatch(v, /"|\.\.\.| - /, 'типографика: прямые кавычки, «...» или дефис вместо тире');
});

test('одно главное действие — проверка по ИНН; ссылки на карточки живые', () => {
  const h = chitat();
  assert.strictEqual((h.match(/btn--primary/g) || []).length, 1);
  for (const [, u] of h.matchAll(/href="(\/company\/\d{10}-[^"]+)"/g)) assert.ok(fs.existsSync(path.join(KOREN, u, 'index.html')), u);
});
