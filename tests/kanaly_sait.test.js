// kanaly-v1 (10.10.2026, [Ночные-3]): страница /boty/ и кнопки «Написать в MAX / ВКонтакте».
// Пока ссылок нет (бот не прошёл модерацию, нет «да» [Право] на пункт о ботах в /politika/) — кнопок не видно,
// /boty/ закрыта от поиска и не в sitemap. Ссылки — только max.ru, vk.me, t.me по https.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const K = require('../js/kanaly.js');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const D = JSON.parse(chitat('data/kanaly.json'));

test('ссылки: только https и свой домен канала; пустая — канала нет', () => {
  assert.deepStrictEqual(K.ssylki({ max: '', vk: '', tg: '' }), {});
  assert.deepStrictEqual(K.ssylki({ max: 'https://max.ru/deloskop_bot', vk: 'https://vk.me/deloskop', tg: 'https://t.me/DeloskopBot' }),
    { max: 'https://max.ru/deloskop_bot', vk: 'https://vk.me/deloskop', tg: 'https://t.me/DeloskopBot' });
  for (const plohaya of ['http://max.ru/x', 'https://max.ru.evil.ru/x', 'javascript:alert(1)', 'https://vk.com/deloskop', 'https://t.me/a b']) {
    assert.deepStrictEqual(K.ssylki({ max: plohaya, vk: plohaya, tg: plohaya }), {}, plohaya);
  }
  // в файле — только разрешённые адреса или пусто
  for (const k of ['max', 'vk', 'tg']) assert.ok(D[k] === '' || K.ssylki(D)[k] === D[k], k);
});

test('primenit: без ссылок кнопки и блок скрыты, текст «готовим» виден; со ссылкой — наоборот', () => {
  const el = (attrs) => ({ hidden: !!attrs.hidden, href: '', rel: '', getAttribute: (n) => attrs[n] });
  const knopki = [el({ 'data-kanal': 'max', hidden: true }), el({ 'data-kanal': 'vk', hidden: true })];
  const blok = [{ hidden: true }], net = [{ hidden: false }];
  const doc = { querySelectorAll: (s) => (s === '[data-kanal]' ? knopki : s === '[data-kanaly-blok]' ? blok : net) };
  assert.strictEqual(K.primenit(doc, {}), false);
  assert.ok(knopki.every((k) => k.hidden) && blok[0].hidden && !net[0].hidden);
  assert.strictEqual(K.primenit(doc, { max: 'https://max.ru/deloskop_bot' }), true);
  assert.strictEqual(knopki[0].href, 'https://max.ru/deloskop_bot?start=sait');
  assert.ok(!knopki[0].hidden && knopki[1].hidden && !blok[0].hidden && net[0].hidden);
});

test('/boty/: пока ссылок нет — noindex и не в sitemap; кнопки скрыты в разметке; без обещаний и лишних слов', () => {
  const s = chitat('boty/index.html');
  const est = Object.keys(K.ssylki(D)).length > 0;
  if (!est) {
    assert.ok(s.includes('<meta name="robots" content="noindex, follow">'));
    assert.ok(!chitat('sitemap.xml').includes('https://deloskop.ru/boty/'));
  }
  assert.ok(s.includes('<script src="/js/kanaly.js" defer></script>'));
  assert.ok(/<link rel="canonical" href="https:\/\/deloskop\.ru\/boty\/">/.test(s));
  for (const m of s.match(/<a [^>]*data-kanal="[a-z]+"[^>]*>/g)) assert.ok(/ hidden/.test(m), m);
  const tekst = s.slice(s.indexOf('<main'), s.indexOf('</main>')).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  for (const slovo of ['лучш', 'гарантир', 'надёжн', 'нейросет', 'искусствен', '№ 1', '!']) assert.ok(!tekst.includes(slovo), slovo);
  assert.ok(tekst.includes('данные ИП мы не публикуем'));
});

test('главная: кнопка «Написать в MAX» есть, но скрыта, пока нет ссылки; кабинет подставляет ИНН из ссылки бота', () => {
  const s = chitat('index.html');
  assert.ok(s.includes('<script src="/js/kanaly.js" defer></script>'));
  assert.ok(/<p class="note kanaly-glav" data-kanaly-blok hidden><a data-kanal="max" hidden>Написать в&nbsp;MAX<\/a>/.test(s));
  const c = chitat('cabinet.html');
  const m = c.match(/var m=(\/\[\?&\]inn=[^;]+\/)\.exec\(location\.search\)/);
  assert.ok(m, 'нет подстановки ИНН');
  const rx = eval(m[1]); // eslint-disable-line no-eval
  assert.strictEqual(rx.exec('?utm_source=max&utm_medium=bot&inn=7712345671')[1], '7712345671');
  assert.strictEqual(rx.exec('?inn=500100732259'), null, 'ИНН ИП не подставляем');
});

test('скрытая кнопка не проступает: .btn с display:inline-flex перебивал бы hidden — правило display:none на обеих страницах', () => {
  for (const f of ['boty/index.html', 'index.html']) {
    assert.ok(chitat(f).includes('[data-kanal][hidden],[data-kanaly-blok][hidden]{display:none!important}'), f);
  }
});
