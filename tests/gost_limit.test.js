// gost-limit-10-sait-v1: сколько быстрых проверок в день без входа — одно число на весь сайт.
// Источник — tarify/tarify.json → gost_v_den (так же считает API: /api/health → gost_v_den, решение 10.10).
// Полоса беты и /tarify/ берут число из файла сами (tests/beta.py, tests/sobrat_tarify.py), экран лимита — js/limit.js;
// во всех остальных текстах сайта число сверяет этот тест: поменяли лимит в tarify.json — тест покажет каждое место.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'tarify/tarify.json'), 'utf8'));
const G = T.gost_v_den;

// отдаваемые файлы сайта; лента обновлений — история (там «3 в день» было правдой на свою дату), тесты и CI — не страницы
const PROPUSK = new Set(['.git', '.github', 'node_modules', 'tests', 'deploy']);
const BEZ = new Set(['obnovleniya.json', 'obnovleniya/index.html']);
function fajly(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!PROPUSK.has(e.name)) out.push(...fajly(path.join(dir, e.name), r)); }
    else if (/\.(html|js|json)$/.test(e.name) && !BEZ.has(r)) out.push(r);
  }
  return out;
}
const tekst = (s) => s.replace(/&nbsp;| |&#160;/g, ' ').replace(/<[^>]+>/g, '');
// «10 проверок в день», «3 бесплатные проверки в день», «бесплатно, 10 в день», «бесплатной, 10 в день», «Завтра — снова 10»
const SHABLONY = [
  // chislo-bystryh-v1 (12.10): + «N быстрых проверок в день» — до 12.10 тест его не видел, и /tarify/ с главной говорили «3»
  /(\d+) (?:(?:бесплатн|быстр)[а-яё]+ )?проверк[а-яё]* в день/g,
  /бесплатн[а-яё]*, (\d+) в день/g,
  /бесплатно (\d+) в день/g,
  /Завтра — снова (\d+)/g,
];

test('tarify.json: gost_v_den — целое больше нуля', () => {
  assert.ok(Number.isInteger(G) && G > 0, 'gost_v_den = ' + G);
  assert.ok(typeof T._gost_v_den === 'string' && T._gost_v_den.length > 20, 'нет пояснения _gost_v_den');
});

test('во всех текстах сайта число проверок без входа = tarify.json → gost_v_den', () => {
  const plohie = [];
  let vsego = 0;
  for (const f of fajly(ROOT)) {
    const s = tekst(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    for (const re of SHABLONY) {
      for (const m of s.matchAll(re)) {
        vsego++;
        if (+m[1] !== G) plohie.push(f + ': «' + m[0] + '»');
      }
    }
  }
  assert.deepStrictEqual(plohie.slice(0, 20), [], 'число проверок в день — из tarify.json (' + G + '); всего расхождений: ' + plohie.length);
  assert.ok(vsego >= 10, 'тест ничего не нашёл — шаблоны устарели? нашли: ' + vsego);
});

test('полоса беты и /tarify/ — число подставлено, заглушек {{G}} на страницах нет', () => {
  for (const f of ['index.html', 'tarify/index.html', 'partneram/index.html']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!s.includes('{{G}}'), f + ': осталась заглушка {{G}} — запустите python3 tests/sobrat_shapku.py');
  }
  for (const p of ['beta-a.html', 'beta-b.html', 'beta-c.html']) {
    const s = fs.readFileSync(path.join(ROOT, 'partials', p), 'utf8');
    assert.ok(s.includes('{{G}}&nbsp;в&nbsp;день'), p + ': число — заглушкой {{G}}, его подставит сборщик');
  }
  const t = tekst(fs.readFileSync(path.join(ROOT, 'tarify/index.html'), 'utf8'));
  assert.ok(t.includes('Бесплатно навсегда: ' + G + ' '), '/tarify/: «Бесплатно навсегда: ' + G + ' …»');
});

test('экран лимита: число из tarify.json, без файла — то же число по умолчанию', () => {
  const L = require('../js/limit.js');
  const NB = ' ';
  const r = L.tekst({ tarify: L.iz(T), beta: true });
  assert.ok(r.stroka.startsWith('Завтра' + NB + '— снова ' + G + '.'), r.stroka);
  assert.strictEqual(r.zag, 'На' + NB + 'сегодня бесплатные проверки закончились');
  const bez = L.tekst({ tarify: null, beta: true });
  assert.ok(bez.stroka.startsWith('Завтра' + NB + '— снова ' + G + '.'), 'запасное число в js/limit.js (LIMIT) ≠ gost_v_den: ' + bez.stroka);
  const svoj = L.tekst({ tarify: L.iz(Object.assign({}, T, { gost_v_den: 25 })), beta: true });
  assert.ok(svoj.stroka.startsWith('Завтра' + NB + '— снова 25.'), 'limit.js не берёт число из tarify.json: ' + svoj.stroka);
});
