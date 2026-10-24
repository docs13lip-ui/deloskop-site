// tipograf-daty-v1 (24.10.2026): «17 апреля 2026» и «ООО «Пример»» рвалось между числом и месяцем, месяцем и годом — замер Chromium
// на 87 страницах (без /company/): 92 разрыва на 390 и 1280 px (перечень недружественных государств — 22, лента — 24,
// разборы, главная, /indeks/, /o-proekte/). Правило — одно на все сборщики: tests/tipograf_statej.py (PRAVILA),
// sobrat_praktika.tipograf, sobrat_faq.tipo, data_rus в sobrat_nedruzh/ofshory/statusy/rynok, «Пульс» и даты ленты
// в sobrat_lentu и tipo() в скриптах ленты/калькулятора (obnovleniya.js, obnovleniya/index.html, tarify/tarify.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MES = 'января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря';
const RX = new RegExp('(?:(?:^|[^0-9])[0-9]{1,2} (?:' + MES + ')(?![а-яё])|(?:' + MES + ') [0-9]{4}(?![0-9]))', 'g');
// Не трогаем: /company/ (сборщик Ночных-2, kartochka_render.py — свой сторож tests/test_kartochki_tipograf.py) и юридические документы — дата редакции в них
// читается счётом и актом байт в байт (tipograf_statej: «Редакция от…» и блоки сборщиков не типографим).
const MIMO = new Set(['company', 'oferta', 'politika', 'soglasie', 'cookies', 'vozvrat', 'rassylki', 'rekvizity', 'partneram/usloviya']);

function stranicy(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name.startsWith('.') || f.name === 'node_modules' || f.name === 'tests') continue;
    const p = path.join(dir, f.name);
    if (MIMO.has(path.relative(ROOT, p).split(path.sep).join('/'))) continue;
    if (f.isDirectory()) stranicy(p, out);
    else if (f.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function vidimyj(html) {
  return html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
    .split(/(<[^>]*>)/).filter((c) => !c.startsWith('<')).join('');
}

test('на страницах сайта «17 апреля 2026» — через неразрывные пробелы', () => {
  const plohie = [];
  for (const p of stranicy(ROOT)) {
    const m = vidimyj(fs.readFileSync(p, 'utf8')).match(RX);
    if (m) plohie.push(path.relative(ROOT, p) + ' — ' + m.length + ': ' + m.slice(0, 2).join(' | '));
  }
  assert.deepStrictEqual(plohie, []);
});

test('tipo() в скриптах ленты и калькулятора держит дату вместе — как Python', () => {
  const kod = 'import sys; sys.path.insert(0, "tests"); import tipograf_statej as T; ' +
    'print(T.tekst("от 17 апреля 2026 г.; 2017 марта; 123 мая; 1 Мая; 5 марта; ООО «Пример», ТАО «x»"))';
  const py = execFileSync('python3', ['-c', kod], { cwd: ROOT, encoding: 'utf8' }).trim();
  assert.strictEqual(py, 'от&nbsp;17&nbsp;апреля&nbsp;2026&nbsp;г.; 2017 марта; 123 мая; 1 Мая; 5&nbsp;марта; ООО&nbsp;«Пример», ТАО «x»');
  for (const f of ['obnovleniya.js', 'obnovleniya/index.html', 'tarify/tarify.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = s.match(/function tipo\(s\)\{[\s\S]*?\\u2011"\);\}/);
    assert.ok(m, f);
    const tipo = new Function(m[0] + '; return tipo;')();
    const js = tipo('от 17 апреля 2026 г.; 2017 марта; 123 мая; 1 Мая; 5 марта; ООО «Пример», ТАО «x»');
    assert.strictEqual(js.replace(/ /g, '&nbsp;'), py, f);
  }
});

test('JSON-LD /reyting/ — без «&nbsp;» (типограф не трогает разметку для поиска)', () => {
  const h = fs.readFileSync(path.join(ROOT, 'reyting', 'index.html'), 'utf8');
  const ld = h.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];
  assert.ok(ld.length > 0);
  for (const b of ld) assert.ok(!/&nbsp;|&#8209;/.test(b), b.slice(0, 200));
});
