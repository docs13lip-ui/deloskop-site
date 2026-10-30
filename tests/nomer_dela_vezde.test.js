// nomer-dela-v2 (26.10.2026, [Ночные запуски]): номер дела не рвётся по дефису — на всём сайте, а не только в ленте и /praktika/.
// До правки (замер main 2787c21e): 14 номеров вне <span class="nw"> на 6 страницах — статьи /115-fz/ и /nalogi/, главная
// (блок «Как решают суды»), /kontragenty-iz-vypiski/. Ставят: tests/tipograf_statej.py (nomera — рамка страниц),
// tests/sobrat_faq.py (ответы FAQ), tests/sobrat_praktika.py (glavnaya). Знаки номера те же — только <span class="nw">.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const K = path.join(__dirname, '..');
const NOMER = /[0-9]{2,3}-(?:ЭС|КГ|КАД|АД|ЭК|АПГ|УД|КП)[0-9]{2}-[0-9]+|[АA][0-9]{2}-[0-9]+\/[0-9]{4}/g;

function stranicy(d = K, o = []) {
  for (const f of fs.readdirSync(d)) {
    if (f.startsWith('.') || f === 'node_modules' || f === 'tests') continue;
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) stranicy(p, o); else if (f.endsWith('.html')) o.push(p);
  }
  return o;
}

function vneSpan(html) {
  const a = html.indexOf('<main'), b = html.indexOf('</main>');
  if (a < 0 || b < 0) return [];
  const m = html.slice(a, b).replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/<summary\b[\s\S]*?<\/summary>|<span class="pk__m">[^<]*(?:<span class="nw">[^<]*<\/span>[^<]*)*<\/span>/g, '')
    .replace(/<span class="nw">[^<]*<\/span>/g, '');
  const out = [];
  for (const kus of m.split(/<[^>]*>/)) for (const x of kus.matchAll(NOMER)) out.push(x[0]);
  return out;
}

test('ни на одной странице сайта номер дела в тексте <main> не стоит вне <span class="nw">', () => {
  const plohie = [];
  for (const p of stranicy()) {
    const v = vneSpan(fs.readFileSync(p, 'utf8'));
    if (v.length) plohie.push(path.relative(K, p) + ': ' + v.join(', '));
  }
  assert.deepStrictEqual(plohie, [], 'номер дела рвётся по дефису:\n' + plohie.join('\n'));
});

test('обёртка не двоится и не попадает в <summary>, атрибуты и JSON-LD', () => {
  for (const p of stranicy()) {
    const h = fs.readFileSync(p, 'utf8');
    assert.ok(!/<span class="nw"><span class="nw">/.test(h), path.relative(K, p) + ': двойная обёртка');
    for (const s of h.match(/<summary\b[\s\S]*?<\/summary>/g) || [])
      assert.ok(!/<span class="nw">[0-9АA][^<]*-/.test(s), path.relative(K, p) + ': номер обёрнут в <summary> (flex)');
    for (const j of h.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [])
      assert.ok(!j.includes('class=\\"nw\\"') && !j.includes('class="nw"'), path.relative(K, p) + ': разметка в JSON-LD');
    for (const t of h.match(/<[^>]+>/g) || [])
      assert.ok(!/="[^"]*<span class/.test(t), path.relative(K, p) + ': разметка в атрибуте');
  }
});

test('статья «ЗСК контрагента»: номер в тексте и в ответе FAQ обёрнут, в FAQPage — без разметки', () => {
  const h = fs.readFileSync(path.join(K, '115-fz/proverit-kontragenta-zsk-po-inn/index.html'), 'utf8');
  assert.ok((h.match(/<span class="nw">305-ЭС25-1505<\/span>/g) || []).length >= 2);
  const ld = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.ok(ld.includes('305-ЭС25-1505') && !ld.includes('<span'));
});

test('типограф и сборщики идемпотентны: --check зелёный', () => {
  execFileSync('python3', ['tests/tipograf_statej.py', '--check'], { cwd: K });
  execFileSync('python3', ['tests/sobrat_faq.py', '--check'], { cwd: K });
});
