// podelitsya-v1 (24.10.2026, план [Маркетинг] 24.10 разд. 6 п. 3): «Поделиться» под статьями и разборами.
// Ставит tests/sobrat_shapku.py (podelitsya) на каждую страницу с JSON-LD Article и <article>, кроме /company/.
// Простые ссылки ВК / Telegram / ОК с меткой utm_medium=share, без чужих скриптов; «Скопировать» и «Ещё…» — js/podelitsya.js.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PODEL = require('../js/podelitsya.js');

function stranicy(dir = ROOT, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name.startsWith('.') || f.name === 'node_modules' || f.name === 'tests' || f.name === 'company') continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) stranicy(p, out);
    else if (f.name === 'index.html') out.push(p);
  }
  return out;
}
const STATI = stranicy().map((p) => [path.relative(ROOT, p), fs.readFileSync(p, 'utf8')])
  .filter(([, s]) => /"@type": ?"Article"/.test(s) && s.includes('</article>'));
const BLOK = /<!--podelitsya-->([\s\S]*?)<!--\/podelitsya-->/g;

test('каждая статья и разбор — ровно один блок «Поделиться», сразу после текста', () => {
  assert.ok(STATI.length >= 40, 'статей с Article мало: ' + STATI.length);
  for (const [f, s] of STATI) {
    const m = [...s.matchAll(BLOK)];
    assert.strictEqual(m.length, 1, f);
    assert.ok(s.indexOf('</article>\n<!--podelitsya-->') !== -1, f + ': блок не сразу после </article>');
  }
});

test('ссылки ведут на эту же страницу (canonical) с меткой площадки; без скриптов и iframe площадок', () => {
  for (const [f, s] of STATI) {
    const kanon = s.match(/<link rel="canonical" href="([^"]+)">/)[1];
    const b = s.match(BLOK)[0];
    assert.ok(b.includes('data-url="' + kanon + '"'), f);
    for (const [kod, host] of [['vk', 'https://vk.com/share.php?url='], ['tg', 'https://t.me/share/url?url='], ['ok', 'https://connect.ok.ru/offer?url=']]) {
      const a = b.match(new RegExp('href="' + host.replace(/[.?/]/g, '\\$&') + '([^"&]+)[^"]*"[^>]*data-podel="' + kod + '"'));
      assert.ok(a, f + ': нет ссылки ' + kod);
      assert.strictEqual(decodeURIComponent(a[1]), kanon + '?utm_source=' + kod + '&utm_medium=share', f + ' ' + kod);
    }
    assert.ok(!/<script|<iframe|vk\.com\/js|openapi/.test(b), f);
    assert.ok((b.match(/rel="noopener nofollow"/g) || []).length === 3, f);
  }
  const vse = stranicy().map((p) => fs.readFileSync(p, 'utf8')).join('');
  assert.ok(!/vk\.com\/js\/api|telegram-widget|connect\.ok\.ru\/connect\.js/.test(vse), 'на сайте появился скрипт площадки');
});

test('карточки /company/ и хабы — без блока (карточки рисует kartochka_render)', () => {
  const kart = fs.readdirSync(path.join(ROOT, 'company')).filter((d) => fs.existsSync(path.join(ROOT, 'company', d, 'index.html')));
  for (const d of kart.slice(0, 40)) assert.ok(!fs.readFileSync(path.join(ROOT, 'company', d, 'index.html'), 'utf8').includes('podelitsya'), d);
  for (const f of ['praktika/index.html', 'nalogi/index.html', '115-fz/index.html', 'index.html']) {
    assert.ok(!fs.readFileSync(path.join(ROOT, f), 'utf8').includes('<!--podelitsya-->'), f);
  }
});

test('кнопки, которым нужен скрипт, скрыты в разметке; utm — склеивает robots.txt', () => {
  const [, s] = STATI[0];
  const b = s.match(BLOK)[0];
  assert.ok(/data-podel="copy" hidden/.test(b) && /data-podel="sys" hidden/.test(b));
  assert.ok(/role="status" aria-live="polite"/.test(b));
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  assert.ok(/Clean-param: [^\n]*utm_source[^\n]*utm_medium/.test(robots));
});

test('js: адрес для «Скопировать» — без запроса и якоря; «Ещё…» только на сенсорном экране', () => {
  assert.strictEqual(PODEL.adres('https://deloskop.ru/nalogi/a/?utm_source=vk#x'), 'https://deloskop.ru/nalogi/a/');
  assert.strictEqual(PODEL.adres('', 'https://deloskop.ru/b/#y'), 'https://deloskop.ru/b/');
  assert.deepStrictEqual(PODEL.pokazat(true, true, false), { copy: true, sys: false });
  assert.deepStrictEqual(PODEL.pokazat(true, true, true), { copy: true, sys: true });
  assert.deepStrictEqual(PODEL.pokazat(false, false, true), { copy: false, sys: false });
});

test('js/podelitsya.js — в пакете «ядро»; цель share_click', () => {
  const sb = JSON.parse(fs.readFileSync(path.join(ROOT, 'partials', 'sborka.json'), 'utf8'));
  assert.ok(sb.pakety.yadro.includes('js/podelitsya.js'));
  const js = fs.readFileSync(path.join(ROOT, 'js', 'podelitsya.js'), 'utf8');
  assert.ok(js.includes('"share_click"'));
});
