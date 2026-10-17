// tipograf-praktika-v1 (17.10.2026, [Ночные запуски]): «Разборы дел» /praktika/ — та же типографика, что у статей
// /115-fz/ и /nalogi/ (tests/tipograf_statej.py). До 17.10 sobrat_praktika.tipograf() не знал коротких слов —
// на 18 разборах висело ~1 700 предлогов и союзов («в», «на», «не», «и» в конце строки на 390 px).
// Красный тест → python3 tests/sobrat_praktika.py (сборщик сам зовёт tipograf_statej.statya) → закоммитить.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'praktika/dela.json'), 'utf8'));
const KOROTKIE = '(?:в|и|а|к|с|у|о|я|по|на|не|до|от|за|из|ни|но|же|ли|без|для|под|над|при|про|со|об)';
const VISIT = new RegExp('(?:^|[\\s>(«])' + KOROTKIE + ' (?=[а-яёА-ЯЁ\\d«])', 'i');

// Видимый текст внутри тега: без скриптов, стилей, служебных блоков сборщиков и комментариев.
function vidimyj(s, teg) {
  const a = s.indexOf('<' + teg); const b = s.indexOf('</' + teg + '>');
  assert.ok(a >= 0 && b > a, 'нет <' + teg + '>');
  return s.slice(a, b)
    .replace(/<!--([a-z0-9-]+)-->[\s\S]*?<!--\/\1-->/g, ' ')
    .replace(/<(script|style|code|pre|textarea)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .split(/<[^>]*>/);
}

const stranicy = [['praktika/index.html', 'main'], ['praktika/115-fz/index.html', 'main'], ['praktika/nalogi/index.html', 'main']]
  .concat(D.razbory.map((r) => [`praktika/${r.razdel}/${r.slug}/index.html`, 'article']));

test('разборы и хабы /praktika/: короткие слова не висят в конце строки', () => {
  const plohie = [];
  for (const [f, teg] of stranicy) {
    const s = fs.readFileSync(path.join(KOREN, f), 'utf8');
    for (const kus of vidimyj(s, teg)) {
      const m = kus.match(VISIT);
      if (m) { plohie.push(f + ': «' + kus.slice(Math.max(0, m.index - 20), m.index + 25).trim() + '»'); break; }
    }
  }
  assert.deepStrictEqual(plohie, [], 'висячие слова — python3 tests/sobrat_praktika.py');
});

test('разборы: «NNN-ФЗ» в тексте не рвётся по дефису, JSON-LD и <head> типограф не трогает', () => {
  for (const [f, teg] of stranicy) {
    const s = fs.readFileSync(path.join(KOREN, f), 'utf8');
    for (const kus of vidimyj(s, teg)) assert.ok(!/\d-ФЗ/.test(kus), f + ': «NNN-ФЗ» с обычным дефисом');
    const head = s.slice(0, s.indexOf('</head>'));
    assert.ok(!head.includes('&#8209;'), f + ': в <head> нет неразрывного дефиса');
    for (const ld of s.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []) {
      assert.ok(!ld.includes('&nbsp;') && !ld.includes('&#8209;'), f + ': JSON-LD без HTML-сущностей типографа');
      JSON.parse(ld.replace(/^<script[^>]*>|<\/script>$/g, ''));
    }
  }
});

test('сборщик /praktika/ зовёт общий типограф статей', () => {
  const k = fs.readFileSync(path.join(KOREN, 'tests/sobrat_praktika.py'), 'utf8');
  assert.ok(/import tipograf_statej as TS/.test(k) && /TS\.statya\(/.test(k));
});
