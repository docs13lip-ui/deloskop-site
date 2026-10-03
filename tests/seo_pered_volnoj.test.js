// [Ночные запуски] seo-pered-volnoj-v1 (03.10.2026): ТЗ [Продукт · Маркетинг] — claude/Продукт_SEO_аудит_живого_перед_волной_03.10.md, разд. 2.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');

function vseStranicy(dir = K, out = []) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.name.startsWith('.') || ['node_modules', 'tests', 'deploy', 'сайт'].includes(d.name)) continue;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) vseStranicy(p, out);
    else if (d.name.endsWith('.html')) out.push(path.relative(K, p));
  }
  return out;
}

test('2.1: на «Нагрузку по отраслям 2025» ссылаются ≥ 4 страницы, в т. ч. хаб /nalogi/ и две статьи', () => {
  const U = 'href="/nalogi/nagruzka-po-otraslyam-2025/"';
  const s = vseStranicy().filter((f) => !f.startsWith('nalogi/nagruzka-po-otraslyam-2025/') && chitat(f).includes(U));
  assert.ok(s.length >= 4, 'входящих: ' + s.join(', '));
  for (const f of ['nalogi/index.html', 'nalogi/statya-54-1-nk-prostymi-slovami/index.html', 'nalogi/priznaki-tehnicheskoj-kompanii/index.html']) {
    assert.ok(s.includes(f), f);
  }
  const hab = chitat('nalogi/index.html');
  const karty = [...hab.matchAll(/<a class="card" href="([^"]+)"/g)].map((m) => m[1]);
  assert.strictEqual(karty[1], '/nalogi/nagruzka-po-otraslyam-2025/', 'в хабе — второй карточкой');
  assert.ok(hab.includes('<b>Налоговая нагрузка по отраслям за 2025 год</b>'));
  assert.ok(hab.includes('Средняя нагрузка и рентабельность по видам деятельности, таблица ФНС с датой'));
  for (const f of ['nalogi/statya-54-1-nk-prostymi-slovami/index.html', 'nalogi/priznaki-tehnicheskoj-kompanii/index.html']) {
    const more = chitat(f).match(/<section class="more">[\s\S]*?<\/section>/)[0];
    assert.ok(more.includes('Средняя налоговая нагрузка по вашей отрасли за 2025 год'), f);
  }
});

test('2.2: хабы /115-fz/ и /nalogi/ — title и description по ТЗ, в пределах 70/160', () => {
  const ozhid = {
    '115-fz/index.html': '115-ФЗ простыми словами: блокировка счёта и запрос банка — Делоскоп',
    'nalogi/index.html': 'Налоги и контрагенты: статья 54.1 НК, нагрузка, вычеты НДС — Делоскоп',
  };
  for (const [f, t] of Object.entries(ozhid)) {
    const h = chitat(f);
    assert.ok(h.includes('<title>' + t + '</title>'), f);
    assert.ok(h.includes('og:title" content="' + t + '"'), f);
    const d = h.match(/name="description" content="([^"]*)"/)[1];
    assert.ok(t.length <= 70 && d.length >= 70 && d.length <= 160, f + ': ' + d.length);
    assert.ok(h.includes('og:description" content="' + d + '"'), f + ': og:description = description');
  }
});

test('2.2: хабы «Разборов» — вводная строка из dela.json (число и последний разбор), не руками', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const forma = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'разбор' : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'разбора' : 'разборов');
  for (const [f, rz] of [['praktika/index.html', null], ['praktika/115-fz/index.html', '115-fz'], ['praktika/nalogi/index.html', 'nalogi']]) {
    const sp = D.razbory.filter((r) => !rz || r.razdel === rz);
    const lid = chitat(f).match(/<p class="lid">([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ');
    // [Право] 03.10 10:20 разд. 4 и 14:30 разд. 2: обзор Президиума ВС (vid: obzor) или карточка без суда — «…судебных решений и позиций ведомств»
    const vid = sp.every((r) => r.dela.every((d) => (d.sud || '').trim() && d.vid !== 'obzor')) ? ' решений ВС, КС и арбитражных судов' : ' судебных решений и позиций ведомств';
    assert.ok(lid.includes(sp.length + ' ' + forma(sp.length) + vid), f + ': ' + lid);
    assert.ok(lid.includes('Последний — «' + sp[0].h1.replace(/\u00a0/g, ' ').replace(/«/g, '„').replace(/»/g, '“')), f);
  }
  execFileSync('python3', [path.join(K, 'tests/sobrat_praktika.py'), '--check'], { stdio: 'pipe' });
});

test('2.3: /obnovleniya/ — последние записи ленты стоят в HTML для робота, той же разметкой, что у скрипта', () => {
  const h = chitat('obnovleniya/index.html');
  const L = JSON.parse(chitat('obnovleniya.json')).obnovleniya;
  const m = h.match(/<div id="list"><!--lenta-->([\s\S]*?)<!--\/lenta--><\/div>/);
  assert.ok(m, 'метки <!--lenta--> внутри #list');
  const ids = [...m[1].matchAll(/<section class="u" id="([^"]+)">/g)].map((x) => x[1]);
  assert.ok(ids.length >= Math.min(10, L.length) && ids.length <= 20, 'записей: ' + ids.length);
  const vse = L.map((u) => u.id);
  assert.deepStrictEqual(ids, vse.slice(vse.indexOf(ids[0]), vse.indexOf(ids[0]) + ids.length), 'подряд и в порядке ленты');
  assert.ok(vse.indexOf(ids[0]) <= 10, 'блок не отстал от ленты больше чем на 10 записей — запустите tests/postavit_vremya.py');
  assert.ok(!m[1].includes('Загружаю'));
  assert.ok(h.includes("fetch(\"/obnovleniya.json\""), 'скрипт по-прежнему дорисовывает полную ленту');
  const slova = h.slice(h.indexOf('<main'), h.indexOf('</main>')).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  assert.ok(slova > 300, 'слов в <main>: ' + slova);
});

test('2.5: каждый адрес sitemap-companies.xml существует файлом (в sitemap — только собранные карточки)', () => {
  if (!fs.existsSync(path.join(K, 'sitemap-companies.xml'))) return;
  const locs = [...chitat('sitemap-companies.xml').matchAll(/<loc>https:\/\/deloskop\.ru(\/[^<]*)<\/loc>/g)].map((x) => x[1]);
  assert.ok(locs.length > 0);
  for (const u of locs) {
    assert.ok(/^\/company\/\d{10}-[a-z0-9-]+\/$/.test(u), u + ': только юрлица (10 цифр ИНН), slug латиницей');
    const f = path.join(K, u, 'index.html');
    assert.ok(fs.existsSync(f), u + ' — нет файла');
    assert.ok(!/noindex/.test(fs.readFileSync(f, 'utf8').slice(0, 4000)), u + ' — в sitemap, но noindex');
  }
});
