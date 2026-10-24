// avtor-praktika-v1 (23.10.2026, [Ночные запуски]; ТЗ [Продукт] 23.10 С3 + Д6): один автор на всём сайте —
// «Команда Делоскопа» (решение владельца 11.10). Article/TechArticle статей, разборов и журнала — один объект с @id
// https://deloskop.ru/o-proekte/#komanda; узел с тем же @id — на /o-proekte/ (AboutPage.author).
// Хаб /praktika/: лид — одна мысль, сводка (число, дата, последний разбор) — строкой .svodka из dela.json.
// Красный тест → поправить источник (tests/sobrat_praktika.py — AVTOR, svodka_haba) или статью → сборщики → закоммитить.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const ID = 'https://deloskop.ru/o-proekte/#komanda';
const PRO_SAJT = ['.github', 'node_modules', 'tests', '.git'];

function html(dir = KOREN, out = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    if (PRO_SAJT.includes(n.name)) continue;
    const p = path.join(dir, n.name);
    if (n.isDirectory()) html(p, out);
    else if (/\.(html|json|xml|js)$/.test(n.name)) out.push(p);
  }
  return out;
}

function ldUzly(s) {
  const out = [];
  for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const j = JSON.parse(m[1]);
    for (const u of [].concat(j)) out.push(u);
  }
  return out;
}

test('прежней подписи «Редакция Делоскопа» на сайте нет — ни в тексте, ни в разметке', () => {
  const s = ['Редакция', 'Делоскопа'].join(' ');
  const plohie = html().filter((f) => fs.readFileSync(f, 'utf8').includes(s)).map((f) => path.relative(KOREN, f));
  assert.deepStrictEqual(plohie, []);
  for (const f of ['sobrat_praktika.py', 'sobrat_zhurnal.py']) {
    assert.ok(!fs.readFileSync(path.join(__dirname, f), 'utf8').includes(s), f);
  }
});

test('у каждого Article/TechArticle автор — «Команда Делоскопа» с одним @id', () => {
  const plohie = [];
  let n = 0;
  for (const f of html().filter((x) => x.endsWith('.html'))) {
    for (const u of ldUzly(fs.readFileSync(f, 'utf8'))) {
      if (!/Article$/.test(u['@type'] || '') || u['@type'] === 'NewsArticle') continue;
      n++;
      const a = u.author || {};
      if (a['@id'] !== ID || a.name !== 'Команда Делоскопа' || a.url !== 'https://deloskop.ru/o-proekte/') plohie.push(path.relative(KOREN, f));
    }
  }
  assert.ok(n >= 45, 'Article найдено ' + n);
  assert.deepStrictEqual(plohie, []);
});

test('/o-proekte/: узел «Команда Делоскопа» с тем же @id и AboutPage.author', () => {
  const uz = ldUzly(fs.readFileSync(path.join(KOREN, 'o-proekte/index.html'), 'utf8'));
  const k = uz.find((u) => u['@id'] === ID);
  assert.ok(k && k['@type'] === 'Organization' && k.name === 'Команда Делоскопа');
  assert.strictEqual(k.parentOrganization['@id'], 'https://deloskop.ru/#organization');
  assert.strictEqual(uz.find((u) => u['@type'] === 'AboutPage').author['@id'], ID);
});

test('хабы /praktika/: лид без сводки, сводка — из dela.json и ссылкой на последний разбор', () => {
  const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'praktika/dela.json'), 'utf8'));
  for (const razdel of [null, ...Object.keys(D.razdely)]) {
    const f = razdel ? `praktika/${razdel}/index.html` : 'praktika/index.html';
    const s = fs.readFileSync(path.join(KOREN, f), 'utf8');
    const sp = D.razbory.filter((r) => !razdel || r.razdel === razdel);
    const lid = s.match(/<p class="lid lid--hab">([\s\S]*?)<\/p>/);
    const sv = s.match(/<p class="svodka">([\s\S]*?)<\/p>/);
    assert.ok(lid && sv, f);
    assert.ok(!/\d+\s*разбор/.test(lid[1]) && !/Последний/i.test(lid[1]), f + ': в лиде нет числа и даты');
    assert.ok(new RegExp('^' + sp.length + '(?:&nbsp;| |\u00a0)разбор').test(sv[1]), f + ': число разборов');  // tipograf-chisla-v1: «28 разборов» неразрывно
    assert.ok(sv[1].includes(`<time datetime="${sp[0].data}">`), f + ': дата последнего');
    assert.ok(sv[1].includes(`<a href="/praktika/${sp[0].razdel}/${sp[0].slug}/">`), f + ': ссылка на последний');
    assert.ok(s.indexOf('class="svodka"') < s.indexOf('class="razd"'), f + ': сводка над разделами');
  }
  const css = fs.readFileSync(path.join(KOREN, 'css/praktika.css'), 'utf8');
  assert.match(css, /\.pr \.svodka\{[^}]*font-size:13px[^}]*color:var\(--muted\)/);
  assert.match(css, /@media \(max-width:600px\)\{\.pr \.lid--hab\{font-size:17px\}\}/);
});

// pravo-2310-razd1 (23.10, [Ночные запуски]; ответ [Право] 23.10 на ✎ 04:50): в лиде хаба /praktika/ — реквизиты источника,
// верно и для разборов по письмам Минфина/ФНС (прежнее «номер дела и ссылка на текст акта» — нет).
test('хаб /praktika/: в лиде — «реквизиты источника: номер дела или письма»', () => {
  const s = fs.readFileSync(path.join(KOREN, 'praktika/index.html'), 'utf8');
  const lid = s.match(/<p class="lid lid--hab">([\s\S]*?)<\/p>/)[1].replace(/&nbsp;| /g, ' ');
  assert.ok(lid.includes('У каждого разбора — реквизиты источника: номер дела или письма и ссылка на текст.'), lid);
  assert.ok(!lid.includes('текст акта'), lid);
});
