// nomer-dela-v1 (25.10.2026, [Ночные запуски]): номер дела «309-ЭС24-21782», «А40-183390/2024», «№ 12-П» не рвётся по дефису.
// Замер Chromium до правки: лента /obnovleniya/ — 10 разрывов номера на 390 px, 16 на 320, 3 на 1280.
// Знаки номера не меняются (U+2011 не ставим — номер перестал бы находиться в kad.arbitr и на vsrf): только <span class="nw">.
// 1) nd() в скрипте страницы = tipograf_statej.nomer_dela (робот видит то же, что посетитель);
// 2) в ленте и на /praktika/ нет номера дела вне <span class="nw"> в тексте <main> — кроме flex-контейнеров <summary> и
//    <span class="pk__m">: там <span> стал бы отдельным flex-элементом (вопрос выходил за край на 320 px, «№» отрывался от номера
//    на gap 12 px) — и там обёртки быть не должно; в JSON-LD и атрибутах разметки нет;
// 3) .nw{white-space:nowrap} — в общих стилях; текст страниц без разметки — прежний.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const NOMER = /[0-9]{2,3}-(?:ЭС|КГ|КАД|АД|ЭК|АПГ|УД|КП)[0-9]{2}-[0-9]+|[АA][0-9]{2}-[0-9]+\/[0-9]{4}/g;

function ndIz(src) {
  const a = src.indexOf('function nd(s){');
  assert.ok(a >= 0, 'нет function nd в скрипте /obnovleniya/');
  const b = src.indexOf('return a+W+b+"</span>";});}', a);
  assert.ok(b > a, 'конец nd не найден');
  return src.slice(a, b + 'return a+W+b+"</span>";});}'.length);
}

function vneSpan(html) {
  // номера в тексте <main> (между тегами), не обёрнутые в <span class="nw">
  const a = html.indexOf('<main'), b = html.indexOf('</main>');
  const m = html.slice(a, b).replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<summary\b[\s\S]*?<\/summary>|<span class="pk__m">[^<]*(?:<span class="nw">[^<]*<\/span>[^<]*)*<\/span>/g, '').replace(/<span class="nw">[^<]*<\/span>/g, '');
  const out = [];
  for (const kus of m.split(/<[^>]*>/)) for (const x of kus.matchAll(NOMER)) out.push(x[0]);
  return out;
}

test('nd() в скрипте /obnovleniya/ = tipograf_statej.nomer_dela на всех текстах ленты', () => {
  const src = chitat('obnovleniya/index.html');
  const fn = ndIz(src);
  assert.ok(!fn.includes('(?<'), 'lookbehind — старые iOS не разберут скрипт');
  const ctx = {};
  vm.runInNewContext(fn + ';this.nd=nd;', ctx);
  const L = JSON.parse(chitat('obnovleniya.json')).obnovleniya;
  const t = [];
  for (const u of L) { t.push(u.zagolovok || '', u.kuda_pisat || ''); for (const x of u.chto_novogo || []) t.push(x); for (const p of u.chto_proverit || []) t.push(p.tekst || ''); }
  t.push('№&nbsp;309-ЭС24-21782', 'дело А40-183390/2024', '№ 12-П и № 860-П', '305-ЭС21-6579(2)', '67-КАД25-12-К8', '115-ФЗ', '1309-ЭС24-2', 'п. 5-П');
  const py = JSON.parse(execFileSync('python3', ['-c',
    'import sys,json; sys.path.insert(0,"tests"); import tipograf_statej as T;' +
    'print(json.dumps([T.nomer_dela(x) for x in json.load(sys.stdin)]))'], { cwd: K, input: JSON.stringify(t), maxBuffer: 64 * 1024 * 1024 }).toString());
  t.forEach((x, i) => assert.strictEqual(ctx.nd(x), py[i], 'текст: ' + x.slice(0, 80)));
  assert.strictEqual(ctx.nd('(№&nbsp;309-ЭС24-21782).'), '(№&nbsp;<span class="nw">309-ЭС24-21782</span>).');
  assert.strictEqual(ctx.nd('№ 12-П.'), '№ <span class="nw">12-П</span>.');
  assert.strictEqual(ctx.nd('1309-ЭС24-2'), '1309-ЭС24-2', 'не номер дела — не трогаем');
  for (const pole of ['esc(u.zagolovok)', 'esc(t)', 'esc(p.tekst)', 'esc(u.kuda_pisat)']) {
    const vse = src.split('tipo(' + pole + ')').length - 1;
    assert.ok(vse > 0 && vse === src.split('nd(tipo(' + pole + '))').length - 1, pole + ' без nd()');
  }
});

test('лента и /praktika/: номер дела в тексте — только внутри <span class="nw">', () => {
  const stranicy = ['obnovleniya/index.html'];
  (function obhod(d) {
    for (const f of fs.readdirSync(path.join(K, d), { withFileTypes: true })) {
      if (f.isDirectory()) obhod(path.join(d, f.name)); else if (f.name === 'index.html') stranicy.push(path.join(d, f.name));
    }
  })('praktika');
  let vsego = 0;
  for (const f of stranicy) {
    const h = chitat(f);
    assert.deepStrictEqual(vneSpan(h), [], f);
    vsego += (h.match(/<span class="nw">[^<]*[0-9]-(?:ЭС|КГ|КАД|АД|ЭК|УД|КП|П\b)/g) || []).length;
    for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.ok(!m[1].includes('<span'), f + ': разметка в JSON-LD');
    assert.ok(!/="[^"]*<span class="nw">/.test(h), f + ': разметка в атрибуте');
    for (const m of h.matchAll(/<summary\b[\s\S]*?<\/summary>|<span class="pk__m">[^<]*(?:<span class="nw">[^<]*<\/span>[^<]*)*<\/span>/g)) assert.ok(!/<span class="nw">[^<]*[0-9]-[А-ЯA-Z]/.test(m[0]), f + ': номер дела обёрнут во flex-контейнере (<summary>, .pk__m) — разъедется строка');
  }
  assert.ok(vsego > 40, 'обёрнутых номеров ' + vsego);
});

test('.nw — без переноса в общих стилях; текст без разметки прежний', () => {
  assert.match(chitat('partials/shapka.css'), /\.nw\{white-space:nowrap\}/);
  const py = execFileSync('python3', ['-c',
    'import sys; sys.path.insert(0,"tests"); import tipograf_statej as T, re;' +
    's="Определение № 309-ЭС25-9697, дело № А07-18520/2024, Постановление № 12-П";' +
    'print(re.sub(r"<[^>]+>","",T.nomer_dela(s))==s)'], { cwd: K }).toString().trim();
  assert.strictEqual(py, 'True');
});
