// indeks-yasno-v1 (ТЗ [Продукт] 03.10 22:55 разд. 2): одно «из» на листе; единый подстрочник пилюли;
// title /indeks/ без номера версии; «Чем Индекс отличается от баллов ФНС» — текст [Права] 22:10 дословно.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const TITLE = 'Индекс Делоскопа: признаки риска компании — открытая методика';
const TEKST = 'Индекс Делоскопа считается по открытым данным и опубликованной методике, а выписку ФНС формирует налоговая по своим сведениям — в том числе по декларациям, которых в открытом доступе нет. Совпадение не обещаем: Индекс — наша оценка, баллы — оценка налоговой.';
const plain = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

test('/indeks/: title, og:title и headline — без номера версии', () => {
  const h = chitat('indeks/index.html');
  assert.ok(h.includes('<title>' + TITLE + '</title>'));
  assert.ok(h.includes('<meta property="og:title" content="' + TITLE + '">'));
  assert.ok(h.includes('"headline": "' + TITLE + '"'));
  assert.ok(TITLE.length <= 70);
  assert.ok(!/<title>[^<]*v1\.\d/.test(h), 'версия в title будет врать после правки методики');
});

test('/indeks/: блок «Чем Индекс отличается от баллов ФНС» и вопрос — дословно, в тексте, в details и в FAQPage', () => {
  const h = chitat('indeks/index.html');
  assert.match(h, /<h3 id="bally-fns">Чем Индекс отличается от&nbsp;баллов ФНС<\/h3>/);
  const blok = h.slice(h.indexOf('id="bally-fns"'), h.indexOf('</div>', h.indexOf('id="bally-fns"')));
  assert.ok(plain(blok).includes(TEKST));
  assert.ok(h.includes('<details><summary>Индекс Делоскопа — это баллы ФНС?</summary><p>Нет. ' + TEKST + '</p></details>'));
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const faq = ld.find((x) => x['@type'] === 'FAQPage');
  const q = faq.mainEntity.find((x) => x.name === 'Индекс Делоскопа — это баллы ФНС?');
  assert.ok(q && q.acceptedAnswer.text === 'Нет. ' + TEKST);
  // вопросы на странице и в разметке совпадают
  const det = [...h.matchAll(/<details><summary>([^<]+)<\/summary>/g)].map((m) => m[1]);
  assert.deepStrictEqual(det, faq.mainEntity.map((x) => x.name));
  // без «рейтинга благонадёжности» и обещаний совпадения
  assert.ok(!/благонад[её]жност/i.test(h));
  assert.ok(!/совпад[её]т с баллами/i.test(plain(h)));
});

test('/indeks/: ссылки на статью о баллах ФНС нет, пока статьи нет в main', () => {
  const est = fs.existsSync(path.join(K, 'nalogi/vypiska-ocenki-fns-bally/index.html'));
  if (!est) assert.ok(!chitat('indeks/index.html').includes('/nalogi/vypiska-ocenki-fns-bally/'));
});

test('подстрочник пилюли — единое правило: 12,5/1,45, --muted, tabular-nums, без отрицательного отступа', () => {
  const c = chitat('css/otchet.css');
  const m = c.match(/\.ot-ix__pod\{([^}]*)\}/);
  assert.ok(m);
  assert.match(m[1], /font-size:12\.5px/);
  assert.match(m[1], /line-height:1\.45/);
  assert.match(m[1], /color:var\(--muted,#6B6B70\)/);
  assert.match(m[1], /margin-top:4px/);
  assert.match(m[1], /font-variant-numeric:tabular-nums/);
  assert.ok(!/margin-top:-/.test(m[1]));
});

test('опись «Откуда данные» — «ответили N из M запрошенных», слово «источников» в итоге не используется', () => {
  const s = chitat('js/otkuda.js');
  assert.ok(s.includes("skl(o.oprosheno, 'запрошенного', 'запрошенных', 'запрошенных')"));
  assert.ok(!s.includes("skl(o.oprosheno, 'источника', 'источников', 'источников')"));
});
