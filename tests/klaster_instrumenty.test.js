// klaster-instrumenty-v1 (30.10.2026, [Ночные запуски]): к инструментам и пояснениям ведут статьи, где о них думают.
// Замер ссылок из <main> страниц sitemap.xml (шапка и подвал не в счёт) на main 876ddc55:
// «Как вас видит банк» держалась на 1 входе (только «Наличные»), калькулятор «Ваша налоговая нагрузка против отрасли» — на 2
// (хаб /nalogi/ и таблица ФНС по отраслям). Читатель статьи о запросе банка или о ЗСК не находил страницу,
// которая показывает его компанию глазами банка; читатель калькулятора «технического» поставщика — проверку своей нагрузки.
// 1) У каждой страницы из ВАЖНЫЕ — не меньше MIN входов из <main> других страниц.
// 2) Добавленные карточки «Читайте также»: заголовок — буква в букву h1 страницы, на которую ведут.
// 3) «Как вас видит банк» в блоке «Что ещё посмотреть» отсылает к калькулятору нагрузки.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const PROPUSK = new Set(['.git', 'tests', 'partials', 'node_modules', 'сайт']);
const MIN = 4;
const VAZHNYE = ['/kak-vidit-bank/', '/nalogi/nagruzka/'];

function stranicy() {
  const out = new Map();
  (function obhod(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (PROPUSK.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) obhod(p);
      else if (e.name.endsWith('.html')) {
        let u = '/' + path.relative(K, p).split(path.sep).join('/');
        if (u.endsWith('/index.html')) u = u.slice(0, -'index.html'.length);
        out.set(u, fs.readFileSync(p, 'utf8'));
      }
    }
  })(K);
  return out;
}

const VSE = stranicy();
const glavnoe = (h) => { const m = h.match(/<main[\s\S]*?<\/main>/); return m ? m[0] : ''; };
const noindex = (h) => /<meta name="robots" content="[^"]*noindex/.test(h);
const tekst = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/&#8209;/g, '‑').replace(/\s+/g, ' ').trim();
const h1 = (h) => { const m = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/); return m ? tekst(m[1]) : ''; };

test(`у инструментов и пояснений — не меньше ${MIN} входов из текста других страниц`, () => {
  const malo = [];
  for (const t of VAZHNYE) {
    assert.ok(VSE.has(t), `нет страницы ${t}`);
    assert.ok(!noindex(VSE.get(t)), `${t} закрыта от поиска`);
    assert.ok(fs.readFileSync(path.join(K, 'sitemap.xml'), 'utf8').includes(`<loc>https://deloskop.ru${t}</loc>`), `${t} не в sitemap.xml`);
    const otkuda = [];
    for (const [u, h] of VSE) {
      if (u === t || noindex(h)) continue;
      const m = glavnoe(h);
      if (m.includes(`href="${t}"`) || m.includes(`href="${t}#`)) otkuda.push(u);
    }
    if (otkuda.length < MIN) malo.push(`${t} — ${otkuda.length}: ${otkuda.join(', ')}`);
  }
  assert.deepStrictEqual(malo, [], 'мало входов');
});

const DOBAVLENO = {
  '/kak-vidit-bank/': ['/115-fz/zapros-banka-po-115-fz-kak-otvetit/', '/115-fz/zsk-zony-riska/', '/115-fz/v-cifrah/', '/115-fz/snyatie-nalichnyh-s-raschetnogo-scheta/'],
  '/nalogi/nagruzka/': ['/nalogi/kalkulyator-tehnicheskij-postavshchik/'],
};

test('добавленные карточки «Читайте также»: заголовок = h1, без повторов в блоке', () => {
  for (const [t, gde] of Object.entries(DOBAVLENO)) {
    const zag = h1(VSE.get(t));
    assert.ok(zag, `${t}: нет h1`);
    for (const u of gde) {
      const blok = (VSE.get(u) || '').match(/<section class="more">[\s\S]*?<\/section>/);
      assert.ok(blok, `${u}: нет «Читайте также»`);
      const k = blok[0].match(new RegExp(`<a class="card" href="${t.replace(/[/]/g, '\\/')}">[\\s\\S]*?<b>([\\s\\S]*?)<\\/b>`));
      assert.ok(k, `${u}: нет карточки на ${t}`);
      assert.strictEqual(tekst(k[1]), zag, `${u}: заголовок карточки не совпадает с h1 ${t}`);
      const hrefs = [...blok[0].matchAll(/<a class="card" href="([^"#]+)/g)].map((m) => m[1]);
      assert.strictEqual(new Set(hrefs).size, hrefs.length, `${u}: повтор карточки`);
      assert.ok(!hrefs.includes(u), `${u}: карточка на саму себя`);
    }
  }
});

test('«Как вас видит банк» отсылает к калькулятору нагрузки — в навигации «Что ещё посмотреть»', () => {
  const nav = VSE.get('/kak-vidit-bank/').match(/<nav class="kvb-dalshe"[\s\S]*?<\/nav>/);
  assert.ok(nav, 'нет блока «Что ещё посмотреть»');
  assert.match(nav[0], /<a href="\/nalogi\/nagruzka\/">Нагрузка глазами налоговой&nbsp;→<\/a>/);
});
