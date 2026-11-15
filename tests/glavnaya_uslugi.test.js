// glavnaya-uslugi-v1 + kozha-bez-kosmosa-v1 (15.11.2026, решения владельца: «главная должна продавать услуги и грамотно показать,
// что может проект»; «один шаблон — как будто на коже, фон синеватый как на знаке, и латунь; космос лишний»).
// Запуск: node --test tests/glavnaya_uslugi.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const est = (f) => fs.existsSync(path.join(KOREN, f));
const G = chitat('index.html');
const tekst = (t) => t.replace(/<svg[\s\S]*?<\/svg>|<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');
const sekciya = (id) => { const a = G.indexOf('id="' + id + '"'); return G.slice(a, G.indexOf('</section>', a)); };

test('«Что умеет Делоскоп»: шесть плиток, у каждой — ситуация, название, что получите и действие; адреса существуют', () => {
  const s = sekciya('uslugi');
  const plitki = s.match(/<li><a href="[^"]+" data-usluga="[a-z]+">[\s\S]*?<\/a><\/li>/g) || [];
  assert.strictEqual(plitki.length, 6);
  const adresa = new Set();
  for (const p of plitki) {
    const href = /href="([^"]+)"/.exec(p)[1];
    adresa.add(href);
    assert.ok(est(href.endsWith('/') ? href.slice(1) + 'index.html' : href.slice(1)), 'нет страницы ' + href);
    for (const t of ['small', 'b', 'span', 'i']) assert.match(p, new RegExp('<' + t + '[ >]'), 'в плитке ' + href + ' нет <' + t + '>');
    assert.match(p, /<svg[^>]+aria-hidden="true"/, 'значок скрыт от читалки');
  }
  assert.strictEqual(adresa.size, 6, 'плитки ведут на разные страницы');
  assert.match(s, /href="\/vse-vozmozhnosti\/"/, 'ссылка на полный каталог');
});

test('«Что умеет Делоскоп»: без цен, обещаний и запретных слов', () => {
  const t = tekst(sekciya('uslugi'));
  for (const re of [/₽|руб/i, /!/, /лучш|№ ?1|первым/i, /скоро|в разработке/i, /гарант/i, /безопасн/i, /Индекс Делоскопа/, /искусственн|нейросет|\bИИ\b/i, /аффилирован/i]) {
    assert.ok(!re.test(t), 'в разделе услуг: ' + (t.match(re) || [''])[0]);
  }
});

test('«Условия»: три карточки и главное действие в конце страницы — к строке проверки', () => {
  const s = sekciya('price');
  assert.strictEqual((s.match(/<li>/g) || []).length, 3);
  assert.match(s, /<a class="vit-btn" href="\/#inn" data-ceny-go>Проверить компанию/);
  assert.ok(!/₽/.test(s));
});

test('космоса нет: «живое небо» не грузится ни на одной странице, файлов нет', () => {
  assert.ok(!est('js/nebo.js'));
  assert.ok(!fs.readdirSync(path.join(KOREN, 'js/b')).some((f) => /^nebo\./.test(f)), 'пакета nebo нет');
  assert.ok(!/nebo/i.test(chitat('js/shapka.js').replace(/\/\/.*$/gm, '')), 'шапка небо не грузит');
  assert.ok(!/nebo/.test(chitat('partials/shapka.html')) && !/nebo/.test(chitat('partials/sborka.json')));
  for (const f of ['index.html', 'report.html', 'cabinet.html', 'tarify/index.html', 'praktika/index.html', 'o-proekte/index.html']) {
    assert.ok(!/data-nebo-src|js\/b\/nebo\./.test(chitat(f)), f + ': ссылка на небо');
  }
});

test('один фон: в тёмной теме — тиснёная кожа на весь сайт, первый экран главной вторым слоем её не кладёт', () => {
  const tema = chitat('css/tema.css');
  assert.match(tema, /\[data-theme=dark\] body::after\{background:url\(\/img\/faktura-kozha\.webp\) 0 0\/160px 160px;opacity:\.85\}/);
  assert.ok(tema.indexOf('faktura-kozha') < tema.indexOf('/*<avto>*/'), 'правило — в ручной части, сборщик тёмной темы его не трогает');
  assert.ok(est('img/faktura-kozha.webp') && fs.statSync(path.join(KOREN, 'img/faktura-kozha.webp')).size < 16000);
  assert.match(G, /\[data-theme="dark"\] \.hero::before\{display:none\}/);
});
