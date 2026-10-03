// glavnaya-v2 (01.10.2026): новая главная по ТЗ [Продукт] — claude/Продукт_новая_главная_шаг2_ответы_01.10.md, разд. 2.9.
// Порядок блоков, «Разборы дел» из dela.json, FAQPage = видимым вопросам, запретные слова, калькулятор на своей странице.
// Запуск: node --test tests/glavnaya.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const vidimoe = (t) => t.replace(/<template\b[^>]*>[\s\S]*?<\/template>/g, '');
const G = chitat('index.html');
const MAIN = vidimoe(G.slice(G.indexOf('<main'), G.indexOf('</main>')));
const tekst = (t) => t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\u00a0/g, ' ');

test('порядок блоков: hero → входы → Щит → разборы → ошибка → доверие → цены → вопросы', () => {
  const ids = ['class="hero"', 'id="vhody"', 'id="shield"', 'id="praktika"', 'id="oshibka"', 'id="doverie"', 'id="price"', 'id="faq"'];
  const poz = ids.map((x) => MAIN.indexOf(x));
  assert.ok(poz.every((p) => p > 0), 'все блоки на месте: ' + ids.filter((x, i) => poz[i] < 0).join(', '));
  assert.deepStrictEqual([...poz].sort((a, b) => a - b), poz);
  assert.strictEqual((MAIN.match(/<section\b/g) || []).length, ids.length, 'лишних секций нет');
});

test('первый экран: H1, title и description по ТЗ', () => {
  assert.match(G, /<h1>Перед оплатой&nbsp;— проверить\. Если банк спросил&nbsp;— ответить\.<\/h1>/);
  const title = /<title>([^<]+)<\/title>/.exec(G)[1];
  const desc = /<meta name="description" content="([^"]+)"/.exec(G)[1];
  assert.ok(title.length <= 70, 'title ' + title.length);
  assert.ok(desc.length >= 120 && desc.length <= 160, 'description ' + desc.length);
  assert.match(MAIN, /class="doverie-str"[^>]*>У&nbsp;каждого факта&nbsp;— источник и&nbsp;дата/);
  assert.match(MAIN, /href="#doverie"/);
});

test('«Разборы дел»: 3 карточки, все адреса существуют, обе рубрики', () => {
  const blok = /<!--praktika-glavnaya-->([\s\S]*?)<!--\/praktika-glavnaya-->/.exec(G)[1];
  const ssylki = [...blok.matchAll(/<a href="(\/praktika\/[^"]+)"/g)].map((m) => m[1]);
  assert.strictEqual(ssylki.length, 3);
  for (const s of ssylki) assert.ok(fs.existsSync(path.join(KOREN, s, 'index.html')), 'нет страницы ' + s);
  const D = JSON.parse(chitat('praktika/dela.json'));
  const razdely = new Set(ssylki.map((s) => s.split('/')[2]));
  assert.ok(Object.keys(D.razdely).every((r) => razdely.has(r)), 'по одному из каждого раздела');
  for (const m of blok.matchAll(/<span>([^<]+)<\/span>/g)) assert.match(m[1], /·.*(№|обзор судебной практики).*·\s*\d{1,2}\s\S+\s\d{4}/, 'строка «суд · № (или обзор ВС, razbor9-v1) · дата»');
  assert.match(MAIN, /<a href="\/praktika\/" data-praktika-gl>/);
  assert.match(chitat('js/metrika.js'), /praktika_cta", \{ otkuda: "glavnaya"/);
});

test('FAQ: 6 вопросов, FAQPage = видимым вопросам', () => {
  const vidnye = [...MAIN.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1]);
  assert.strictEqual(vidnye.length, 6);
  const ld = JSON.parse(/<!--ld-glavnaya--><script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(G)[1]);
  const faq = ld.find((x) => x['@type'] === 'FAQPage');
  assert.deepStrictEqual(faq.mainEntity.map((q) => q.name), vidnye);
  const org = ld.find((x) => x['@type'] === 'Organization');
  assert.ok(org && !/ИНН|ОГРН/.test(JSON.stringify(org)), 'Organization без реквизитов ИП');
  assert.ok(!ld.some((x) => x.potentialAction), 'SearchAction не ставим, пока главная не запускает проверку по ?inn= сама');
});

test('запретное на главной: «скоро», персональный разбор, Индекс, гарантии, «безопасно»', () => {
  const t = tekst(MAIN);
  for (const [re, pochemu] of [[/скоро/i, '«скоро» — обещание несуществующего'], [/Персональн\S* разбор/i, 'услуги ещё нет'],
    [/Индекс Делоскопа/, 'ворота Индекса закрыты (п. 71)'], [/гарантиру(ем|ет)(?! ли)|гарантия/i, 'гарантии'], [/безопасн/i, '«безопасно»']]) {
    assert.ok(!re.test(t), pochemu + ': ' + (t.match(re) || [''])[0]);
  }
});

test('цены на главной — только строкой из tarify.json, кнопок оплаты нет', () => {
  const T = JSON.parse(chitat('tarify/tarify.json'));
  for (const x of T.tarify.filter((x) => x.mesyac)) {
    const m = new RegExp('<span data-cena="' + x.id + '\\.mesyac">([^<]+)</span>').exec(G);
    assert.ok(m, 'нет цены ' + x.id);
    assert.strictEqual(+m[1].replace(/\D/g, ''), x.mesyac);
  }
  assert.ok(!/data-tarif=|href="\/schet\//.test(G));
  assert.match(MAIN, /href="\/tarify\/"/);
});

test('калькулятор — на своей странице, в sitemap и в хабе /nalogi/', () => {
  const U = '/nalogi/kalkulyator-tehnicheskij-postavshchik/';
  const K = chitat(U.slice(1) + 'index.html');
  assert.match(G, new RegExp('href="' + U + '"'));
  assert.ok(!/id="sv-sum"/.test(G), 'на главной калькулятора больше нет');
  assert.match(K, /id="sv-sum"/);
  assert.match(K, /<h1 id="calc-h">Во что обойдётся «технический» поставщик<\/h1>/);
  assert.match(K, /Это пример расчёта по нормам Налогового кодекса, а не прогноз/);
  assert.match(K, /"@type": "BreadcrumbList"/);
  assert.ok(!/SoftwareApplication/.test(K));
  assert.match(K, /data-goal="article_to_tool" data-otkuda="kalkulyator"/);
  assert.match(chitat('sitemap.xml'), new RegExp('<loc>https://deloskop.ru' + U + '</loc>'));
  assert.match(chitat('nalogi/index.html'), new RegExp('href="' + U + '"'));
});

test('калькулятор: формула та же, что была на главной (22/122, 25%, 20/40%, пени за 2 года)', () => {
  const K = chitat('nalogi/kalkulyator-tehnicheskij-postavshchik/index.html');
  const js = /\(function\(\)\{\n  var \$=function[\s\S]*?\n\}\)\(\);/.exec(K)[0];
  const el = {};
  const mk = (id, v) => (el[id] = { value: v, checked: false, hidden: false, textContent: '', addEventListener() {} });
  ['sv-sum', 'sv-exp', 'sv-int', 'sv-exp-row', 'sv-vat', 'sv-pr', 'sv-fp', 'sv-fine', 'sv-pen', 'sv-tot', 'sv-x'].forEach((i) => mk(i, ''));
  el['sv-sum'].value = '1 220 000';
  const document = { getElementById: (i) => el[i], querySelector: () => ({ textContent: '14 300' }) };
  new Function('document', js)(document);
  const n = (s) => +s.replace(/\D/g, '');
  assert.strictEqual(n(el['sv-vat'].textContent), 220000);
  assert.strictEqual(n(el['sv-fine'].textContent), 44000);
  const pen = 220000 * 0.14 * (30 / 300 + 60 / 150 + 640 / 300);
  assert.strictEqual(n(el['sv-pen'].textContent), Math.round(pen));
  assert.strictEqual(n(el['sv-tot'].textContent), Math.round(220000 + 44000 + pen));
});

test('калькулятор: ключевая ставка в формуле и в подписи = tarify.json (сменится 23.10 — красное здесь)', () => {
  const K = chitat('nalogi/kalkulyator-tehnicheskij-postavshchik/index.html');
  const R = JSON.parse(chitat('tarify/tarify.json')).raschet;
  assert.strictEqual(+/var KEY=([\d.]+)/.exec(K)[1], R.klyuchevaya_stavka);
  const pct = String(Math.round(R.klyuchevaya_stavka * 10000) / 100).replace('.', ',');
  assert.ok(K.includes('по нынешней ключевой ставке ' + pct + '%'), 'подпись к пеням: ' + pct + '%');
});
