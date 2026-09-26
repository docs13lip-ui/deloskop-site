// Единый подвал, документы продавца, шрифт со своего сервера (site-v3, 26.09.2026).
// Запуск: node --test tests/podval.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const DOKI = ['oferta', 'vozvrat', 'politika', 'soglasie', 'rekvizity'];
const stranicy = () => {
  const vse = execSync('git ls-files "*.html"', { cwd: KOREN, encoding: 'utf8' }).split('\n')
    .concat(DOKI.map(d => d + '/index.html'))
    .filter(f => f && !f.startsWith('"') && !f.startsWith('сайт/') && f !== 'admin.html' && !/^(yandex_[0-9a-f]+|google[0-9a-f]+)\.html$/.test(f) && !f.includes('tests/') && !f.startsWith('partials/'))
    .filter(f => fs.existsSync(path.join(KOREN, f)));
  return [...new Set(vse)];
};
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const podval = t => { const m = t.match(/<!--podval-->[\s\S]*?<!--\/podval-->/g); return m || []; };

test('на каждой публичной странице ровно один подвал, и он одинаковый', () => {
  const s = stranicy();
  assert.ok(s.length >= 30, 'страниц ' + s.length);
  const obrazec = podval(chitat('index.html'))[0];
  assert.ok(obrazec && obrazec.includes('/oferta/') && obrazec.includes('/politika/') && obrazec.includes('/vozvrat/'));
  for (const f of s) {
    const t = chitat(f);
    assert.strictEqual(podval(t).length, 1, f + ': подвалов ' + podval(t).length);
    assert.strictEqual(podval(t)[0], obrazec, f + ': подвал отличается — запустите python3 tests/sobrat_shapku.py');
    assert.ok(!/<footer[\s>]/.test(t), f + ': остался старый <footer>');
    assert.ok(t.includes('/css/podval.css'), f + ': нет /css/podval.css');
  }
});

test('шрифт — со своего сервера, без fonts.googleapis.com', () => {
  for (const f of stranicy()) {
    const t = chitat(f);
    assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(t), f + ': ссылка на Google Fonts');
    assert.ok(t.includes('/css/fonts.css'), f + ': нет /css/fonts.css');
  }
  const css = fs.readFileSync(path.join(KOREN, 'css/fonts.css'), 'utf8');
  for (const m of css.matchAll(/url\((\/fonts\/[^)]+)\)/g)) {
    assert.ok(fs.existsSync(path.join(KOREN, m[1])), 'нет файла ' + m[1]);
  }
});

test('podval.css собран из токенов ds.css — своих цветов нет', () => {
  const css = fs.readFileSync(path.join(KOREN, 'css/podval.css'), 'utf8');
  const ds = fs.readFileSync(path.join(KOREN, 'css/ds.css'), 'utf8');
  const cveta = new Set((ds.match(/:root\{[\s\S]*?\n\}/)[0].match(/#[0-9A-Fa-f]{3,6}\b/g)));
  for (const c of css.match(/#[0-9A-Fa-f]{3,6}\b/g) || []) assert.ok(cveta.has(c), 'чужой цвет ' + c);
  const pravila = css.split('\n').slice(2).join('\n');
  assert.ok(!/#[0-9A-Fa-f]{3,6}\b/.test(pravila), 'цвет вне токенов в правилах подвала');
});

test('документы продавца: title ≤ 70, description ≤ 160, canonical, JSON-LD, sitemap, без noindex', () => {
  const sitemap = chitat('sitemap.xml');
  for (const d of DOKI) {
    const t = chitat(d + '/index.html');
    const title = t.match(/<title>([^<]*)<\/title>/)[1];
    const desc = t.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.ok(title.length <= 70, d + ' title ' + title.length);
    assert.ok(desc.length <= 160, d + ' description ' + desc.length);
    assert.ok(t.includes(`<link rel="canonical" href="https://deloskop.ru/${d}/">`), d + ' canonical');
    assert.ok(t.includes('application/ld+json'), d + ' JSON-LD');
    assert.ok(!/noindex/.test(t), d + ' noindex');
    assert.ok(sitemap.includes(`<loc>https://deloskop.ru/${d}/</loc>`), d + ' нет в sitemap');
    assert.ok(t.includes('/css/ds.css'), d + ' на ds.css');
    assert.ok(!/<style/.test(t), d + ': свои стили на странице документа');
  }
});

test('оферта — в лицензионной редакции налогового юриста, без выделенного НДС', () => {
  const t = chitat('oferta/index.html');
  assert.ok(t.includes('простой неисключительной лицензии'));
  assert.ok(t.includes('п. 1 ст. 145 НК РФ'));
  assert.ok(t.includes('на дату открытия доступа'));
  assert.ok(!/НДС 2[02]\s?%/.test(t), 'выделенный НДС в оферте');
  assert.ok(t.includes('<!--r:ispolnitel-->') && t.includes('<!--rekvizity-->'));
});

test('пока реквизиты не заполнены — строки ИП в подвале нет, в документах ссылка на /rekvizity/', () => {
  const r = JSON.parse(chitat('rekvizity.json'));
  const p = podval(chitat('index.html'))[0];
  if (!r.fio || !r.inn || !r.ogrnip) {
    assert.ok(!/ОГРНИП/.test(p));
    assert.ok(chitat('oferta/index.html').includes('сведения о котором указаны в разделе'));
    assert.ok(chitat('rekvizity/index.html').includes('появятся здесь сразу после государственной регистрации'));
  } else {
    assert.ok(p.includes('ОГРНИП ' + r.ogrnip));
  }
});

test('форма счёта: согласие ведёт на отдельный текст согласия (ч. 1 ст. 9 152-ФЗ)', () => {
  const js = chitat('js/schet.js');
  assert.ok(js.includes('href="/soglasie/"'));
  assert.ok(js.includes('href="/oferta/"'));
});

test('налоговые правки п. 36 на месте', () => {
  assert.ok(!chitat('delopis/index.html').includes('он возместит налог'));
  assert.ok(chitat('nalogi/nedostovernyj-adres-egryul/index.html').includes('пп. «ф» п. 1 ст. 23'));
  assert.ok(!chitat('kontragenty-iz-vypiski/index.html').includes('пп. 17–21'));
  assert.ok(chitat('115-fz/snyatie-nalichnyh-s-raschetnogo-scheta/index.html').includes('шкала 13–22%'));
});

test('лента: запись 2026-09-26-6 есть и id уникальны', () => {
  const d = JSON.parse(chitat('obnovleniya.json'));
  assert.ok(d.obnovleniya.some(e => e.id === '2026-09-26-6'));
  const ids = d.obnovleniya.map(x => x.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});
