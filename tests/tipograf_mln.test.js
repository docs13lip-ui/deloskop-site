// tipograf-mln-v1 (24.10.2026): «2,43 млн ₽» рвалось между «млн» и «₽» — в лиде Разбора № 27 на 1280 px «₽»
// уезжал на следующую строку; по сайту так стояло 311 мест на 42 страницах (разборы, статьи, рейтинг, лента).
// Правило — одно на все сборщики: tests/tipograf_statej.py (PRAVILA), sobrat_praktika.tipograf, sobrat_faq.tipo
// и tipo() в скриптах ленты/калькулятора (obnovleniya.js, obnovleniya/index.html, tarify/tarify.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RX = /(?:млн|млрд|трлн|тыс\.) ₽/g;

function stranicy(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name.startsWith('.') || f.name === 'node_modules' || f.name === 'tests') continue;
    // /company/ собирает tests/kartochka_render.py (Ночные-2): 4 карточки — «…на 36,1 млрд ₽» в «Перед оплатой»
    // (kap.group(1), строки ~3501/3674) — правка их сборщиком, тогда убрать это исключение.
    if (dir === ROOT && f.name === 'company') continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) stranicy(p, out);
    else if (f.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function vidimyj(html) {
  return html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
    .split(/(<[^>]*>)/).filter((c) => !c.startsWith('<')).join('');
}

test('на страницах сайта «млн ₽», «млрд ₽», «тыс. ₽» — через неразрывный пробел', () => {
  const plohie = [];
  for (const p of stranicy(ROOT)) {
    const n = (vidimyj(fs.readFileSync(p, 'utf8')).match(RX) || []).length;
    if (n) plohie.push(path.relative(ROOT, p) + ' — ' + n);
  }
  assert.deepStrictEqual(plohie, []);
});

test('tipo() в скриптах ленты и калькулятора держит «млн ₽» вместе', () => {
  for (const f of ['obnovleniya.js', 'obnovleniya/index.html', 'tarify/tarify.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(s.includes('.replace(/(млн|млрд|трлн|тыс\\.) (?=₽)/g,"$1\\u00a0")'), f);
  }
});

test('tipograf_statej.tekst: «2,43 млн ₽» и «412 тыс. ₽» не рвутся, прочее — как было', () => {
  const kod = 'import sys; sys.path.insert(0, "tests"); import tipograf_statej as T; ' +
    'print(T.tekst("снял 2,43 млн ₽ и 412 тыс. ₽; млн рублей; ₽ 5"))';
  const out = execFileSync('python3', ['-c', kod], { cwd: ROOT, encoding: 'utf8' }).trim();
  assert.strictEqual(out, 'снял 2,43&nbsp;млн&nbsp;₽ и&nbsp;412&nbsp;тыс.&nbsp;₽; млн рублей; ₽ 5');
});
