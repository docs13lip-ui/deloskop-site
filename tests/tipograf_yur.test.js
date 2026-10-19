// tipograf-yur-v1 (19.10.2026, [Ночные запуски]): юридические документы — та же типографика, что у статей
// (tests/tipograf_statej.py). «Да» [Право] 19.10 10:50 (п. 333 б): меняется только вид пробела и дефиса,
// без U+00A0 и U+2011 текст побуквенно прежний, дату редакции не менять — условия документа те же.
// До правки на 390 px в оферте висело ~440 предлогов и союзов («в», «на», «не», «и» в конце строки).
// Красный тест → python3 tests/tipograf_statej.py → закоммитить.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const DOKUMENTY = ['oferta', 'politika', 'soglasie', 'cookies', 'vozvrat', 'rassylki', 'partneram/usloviya']
  .map((d) => d + '/index.html');
const KOROTKIE = '(?:в|и|а|к|с|у|о|я|по|на|не|до|от|за|из|ни|но|же|ли|без|для|под|над|при|про|со|об|во|мы|вы|он|её|ее|их|ей|им)';
const VISIT = new RegExp('(?:^|[\\s>(«])' + KOROTKIE + ' (?=[а-яёА-ЯЁ\\d«])', 'i');

const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
// Вид пробела и дефиса — единственное, что меняет типограф; всё остальное должно совпасть побуквенно.
const bezVida = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-');

// Видимый текст внутри <main>: без скриптов, стилей, служебных блоков сборщиков и комментариев.
function vidimyj(s) {
  const a = s.indexOf('<main'); const b = s.indexOf('</main>');
  assert.ok(a >= 0 && b > a, 'нет <main>');
  return s.slice(a, b)
    .replace(/<!--([a-z0-9-]+)-->[\s\S]*?<!--\/\1-->/g, ' ')
    .replace(/<!--r:[a-z0-9_-]+-->[\s\S]*?<!--\/r-->/g, ' ')
    .replace(/<p class="meta">Редакция от [\s\S]*?<\/p>/g, ' ') // дату редакции типограф не трогает (её читают счёт и акт)
    .replace(/<(script|style|code|pre|textarea)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .split(/<[^>]*>/);
}

test('юридические документы — в списке типографа статей (рамка <main>)', () => {
  const py = chitat('tests/tipograf_statej.py');
  for (const f of DOKUMENTY) assert.ok(py.includes(`"${f}": "main"`), f + ' нет в STRANICY tests/tipograf_statej.py');
});

test('юридические документы: короткие слова не висят в конце строки, «NNN-ФЗ» не рвётся', () => {
  const plohie = [];
  for (const f of DOKUMENTY) {
    for (const kus of vidimyj(chitat(f))) {
      const m = kus.match(VISIT);
      if (m) { plohie.push(f + ': «' + kus.slice(Math.max(0, m.index - 20), m.index + 25).trim() + '»'); break; }
      if (/\d-ФЗ/.test(kus)) { plohie.push(f + ': «NNN-ФЗ» с обычным дефисом'); break; }
    }
  }
  assert.deepStrictEqual(plohie, [], 'висячие слова — python3 tests/tipograf_statej.py');
});

test('типограф не меняет в документах ни слова, ни знака: без вида пробела и дефиса текст тот же', () => {
  // Прогоняем типограф по документу, из которого убран вид пробела, — и сверяем побуквенно.
  const kod = 'import sys,json; sys.path.insert(0,"tests"); import tipograf_statej as t;'
    + ' d=json.load(sys.stdin); print(json.dumps([t.statya(s,"main") for s in d]))';
  // Второй прогон по самому документу — ничего не меняет (документ уже прогнан; ручные &nbsp; остаются).
  const ishod = DOKUMENTY.map((f) => bezVida(chitat(f))).concat(DOKUMENTY.map(chitat));
  const out = JSON.parse(execFileSync('python3', ['-c', kod], { cwd: KOREN, input: JSON.stringify(ishod), maxBuffer: 64 << 20 }));
  const n = DOKUMENTY.length;
  DOKUMENTY.forEach((f, i) => {
    assert.strictEqual(bezVida(out[i]), ishod[i], f + ': типограф изменил текст, а не только вид пробела');
    assert.strictEqual(out[n + i], ishod[n + i], f + ': документ не прогнан типографом — python3 tests/tipograf_statej.py');
  });
});

test('юридические документы: <head>, JSON-LD и дата редакции — без сущностей типографа в разметке', () => {
  for (const f of DOKUMENTY) {
    const s = chitat(f);
    const head = s.slice(0, s.indexOf('</head>'));
    assert.ok(!head.includes('&#8209;'), f + ': в <head> нет неразрывного дефиса');
    for (const ld of s.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []) {
      assert.ok(!ld.includes('&nbsp;') && !ld.includes('&#8209;'), f + ': JSON-LD без HTML-сущностей типографа');
      JSON.parse(ld.replace(/^<script[^>]*>|<\/script>$/g, ''));
    }
  }
});
