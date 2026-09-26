// Единая шапка (claude/Дизайн_шапка_логотип_и_Скорая_v2.md §1.7) и «Что нового» без автооткрытия.
// Запуск: node --test tests/*.test.*
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const LOGO = '<svg width="36" height="32" viewBox="0 0 72 64" fill="none" aria-hidden="true"><path d="M36 18.1A16 16 0 0 1 36 45.9A16 16 0 0 1 36 18.1Z" fill="#0B63E5"/><circle cx="28" cy="32" r="16" stroke="#1D1D1F" stroke-width="4.5"/><circle cx="44" cy="32" r="16" stroke="#1D1D1F" stroke-width="4.5"/></svg>';

function stranicy() {
  const vse = execSync('git ls-files "*.html"', { cwd: KOREN, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const d of ['oferta', 'politika', 'soglasie', 'vozvrat', 'rekvizity', 'cookies']) vse.push(d + '/index.html');
  return [...new Set(vse)].filter(f => fs.existsSync(path.join(KOREN, f)) && f !== 'admin.html'
    && !/^(yandex_[0-9a-f]+|google[0-9a-f]+)\.html$/.test(f) && !f.startsWith('сайт/') && !f.startsWith('"') && !f.startsWith('tests/') && !f.startsWith('partials/'));
}
const SHAPKA = '<!--shapka-->\n' + chitat('partials/shapka.html').replace(/^\n+|\n+$/g, '') + '\n<!--/shapka-->';
const blok = t => (t.match(/<!--shapka-->[\s\S]*?<!--\/shapka-->/g) || []);

test('шапка есть на всех страницах, ровно одна и байт в байт как partials/shapka.html', () => {
  const f = stranicy();
  assert.ok(f.length >= 32, 'страниц ' + f.length);
  for (const s of f) {
    const t = chitat(s);
    const b = blok(t);
    assert.strictEqual(b.length, 1, s + ': блоков шапки ' + b.length);
    assert.strictEqual(b[0], SHAPKA, s + ': шапка отличается от partials/shapka.html — запустите tests/sobrat_shapku.py');
    assert.strictEqual((t.match(/<!--podval-->/g) || []).length, 1, s + ': подвал');
    assert.ok(!/<header class="(top|hdr)"/.test(t), s + ': осталась старая шапка');
  }
});

test('логотип — фирменная линза, дважды (шапка и мобильное меню), без favicon', () => {
  const p = chitat('partials/shapka.html');
  assert.strictEqual(p.split(LOGO).length - 1, 2);
  assert.strictEqual((p.match(/viewBox="0 0 72 64"/g) || []).length, 2);
  assert.ok(!p.includes('favicon'));
});

test('5 пунктов меню, без aria-current/is-active/style, цвета — только цвета логотипа', () => {
  const p = chitat('partials/shapka.html');
  const nav = p.slice(p.indexOf('<ul class="shapka__list">'), p.indexOf('</nav>'));
  const punkty = [...nav.matchAll(/<li(?: class="shapka__dd")?>\s*<(?:a|button) class="shapka__link"[^>]*>([^<]+)/g)].map(m => m[1].trim());
  assert.deepStrictEqual(punkty, ['Проверка', 'Выписка', '115-ФЗ', 'Индекс', 'Тарифы']);
  assert.ok(!/aria-current|is-active|style=/.test(p));
  const hex = (p.match(/#[0-9A-Fa-f]{3,6}\b/g) || []).filter(x => !['#0B63E5', '#1D1D1F'].includes(x));
  assert.deepStrictEqual(hex, []);
});

test('все ссылки шапки ведут на существующие страницы', () => {
  const p = chitat('partials/shapka.html');
  for (const [, h] of p.matchAll(/href="([^"#]+)(?:#[^"]*)?"/g)) {
    if (!h.startsWith('/')) continue;
    const f = h.endsWith('/') ? h.slice(1) + 'index.html' : h.slice(1);
    assert.ok(fs.existsSync(path.join(KOREN, f || 'index.html')), 'нет страницы ' + h);
  }
});

test('каждая страница подключает shapka.css, shapka.js и obnovleniya.js, есть цель #main', () => {
  for (const s of stranicy()) {
    const t = chitat(s);
    assert.ok(t.includes('<link rel="stylesheet" href="/css/shapka.css">'), s + ': shapka.css');
    assert.ok(t.includes('<script src="/js/shapka.js" defer></script>'), s + ': shapka.js');
    assert.ok(t.includes('<script src="/obnovleniya.js" defer></script>'), s + ': obnovleniya.js');
    assert.ok(/id="main"/.test(t), s + ': нет id="main"');
    assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(t), s + ': Google Fonts');
  }
});

test('css/shapka.css собран и на токенах: своих цветов нет, кроме затемнения фона', () => {
  const src = chitat('partials/shapka.css');
  const hex = src.match(/#[0-9A-Fa-f]{3,6}\b/g) || [];
  assert.deepStrictEqual(hex, [], 'в partials/shapka.css свои hex-цвета: ' + hex.join(', '));
  assert.ok(!/font:(?!inherit[;}])[^;}]*\binherit\b/.test(src), 'font:… inherit браузер выбрасывает целиком');
  const css = chitat('css/shapka.css');
  assert.ok(css.includes('--accent:#0B63E5'), 'токены ds.css не попали в css/shapka.css');
  assert.ok(css.endsWith(src), 'css/shapka.css устарел — запустите tests/sobrat_shapku.py');
});

test('«Что нового»: окно само не открывается, плавающей кнопки нет', () => {
  const js = chitat('obnovleniya.js');
  assert.ok(!js.includes('dlo-pill'), 'осталась плавающая кнопка');
  assert.ok(!/get\(\)\s*!==\s*u\.id\)\s*show/.test(js), 'осталось автооткрытие');
  assert.ok(js.includes('deloskop:whatsnew'), 'окно должно открываться по событию из шапки');
  assert.ok(chitat('js/shapka.js').includes('deloskop:whatsnew'));
});

test('Метрика: код только в js/metrika.js и только после «Принять»; баннер и /cookies/ на месте', () => {
  for (const s of stranicy()) {
    const t = chitat(s);
    assert.ok(!/mc\.yandex\.ru|ym\(\d/.test(t), s + ': код Метрики прямо в странице — нужен только через js/metrika.js');
    assert.ok(t.includes('<script src="/js/metrika.js" defer></script>'), s + ': нет js/metrika.js');
  }
  const js = chitat('js/metrika.js');
  assert.ok(js.includes('113083788') && js.includes('webvisor: false'));
  assert.ok(/if \(v === "all"\) zagruzit\(\)/.test(js), 'загрузка счётчика — только при выборе «all»');
  assert.ok(js.includes('Только необходимые') && js.includes('/cookies/'));
  assert.ok(fs.existsSync(path.join(KOREN, 'cookies/index.html')));
  assert.ok(chitat('sitemap.xml').includes('https://deloskop.ru/cookies/'));
});
