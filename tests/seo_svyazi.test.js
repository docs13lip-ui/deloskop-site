// seo-svyazi-v1 (24.10.2026, план [Маркетинг] 24.10 «Яндекс, ВК, Mail.ru, статистика», разд. 1.3 и 2.2 п. 3):
// (1) sameAs (сообщество ВК) в каждом Organization «Делоскоп» — Яндекс связывает сайт и сообщество;
// (2) «Мы во ВКонтакте» в подвале всех страниц; (3) lastmod в sitemap.xml — по смене текста страницы
// (tests/sitemap_lastmod.py, реестр data/lastmod.json), а не руками: главная стояла 2026-10-01 при правках 22–24.10.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VK = 'https://vk.com/deloskop_ru';
const chit = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function stranicy(dir = ROOT, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name.startsWith('.') || f.name === 'node_modules' || f.name === 'tests') continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) stranicy(p, out);
    else if (f.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const VSE = stranicy();

test('sameAs: в каждом Organization «Делоскоп» — сообщество ВК; JSON-LD разбирается', () => {
  let n = 0;
  const bez = [];
  for (const p of VSE) {
    const s = fs.readFileSync(p, 'utf8');
    for (const m of s.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      const ld = JSON.parse(m[1]);
      const obhod = (x) => {
        if (Array.isArray(x)) return x.forEach(obhod);
        if (!x || typeof x !== 'object') return;
        if (x['@type'] === 'Organization' && x.name === 'Делоскоп') {
          n++;
          if (!(Array.isArray(x.sameAs) && x.sameAs.includes(VK))) bez.push(path.relative(ROOT, p));
        }
        Object.values(x).forEach(obhod);
      };
      obhod(ld);
    }
  }
  assert.ok(n >= 200, 'Organization «Делоскоп» найдено ' + n);
  assert.deepStrictEqual(bez, []);
  // в sameAs — чистый адрес, без меток
  assert.ok(!VSE.some((p) => /"sameAs": \[[^\]]*utm_/.test(fs.readFileSync(p, 'utf8'))));
});

test('подвал: «Мы во ВКонтакте» на всех страницах с подвалом, rel="me noopener", источник — sobrat_shapku', () => {
  const src = chit('tests/sobrat_shapku.py');
  assert.match(src, /\("Мы во ВКонтакте", VK \+ "\?utm_source=site"\)/);
  const bez = [];
  for (const p of VSE) {
    const s = fs.readFileSync(p, 'utf8');
    const m = s.match(/<!--podval-->[\s\S]*?<!--\/podval-->/);
    if (!m) continue;
    if (!m[0].includes('<a href="' + VK + '?utm_source=site" rel="me noopener">Мы&nbsp;во&nbsp;ВКонтакте</a>')) bez.push(path.relative(ROOT, p));
  }
  assert.deepStrictEqual(bez, []);
  assert.ok(chit('partials/obolochka.json').includes(VK + '?utm_source=site'), 'карточки из API — та же оболочка');
});

test('lastmod: реестр совпадает с текстом страниц (python3 tests/sitemap_lastmod.py --check)', () => {
  const out = execFileSync('python3', ['tests/sitemap_lastmod.py', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /без изменений/);
});

test('lastmod: не раньше даты смены текста и dateModified; главная — свежая', () => {
  const sm = chit('sitemap.xml');
  const R = JSON.parse(chit('data/lastmod.json'));
  assert.ok(Object.keys(R).length >= 40);
  for (const [url, z] of Object.entries(R)) {
    const m = sm.match(new RegExp('<loc>https://deloskop\\.ru' + url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</loc><lastmod>([\\d-]+)<'));
    assert.ok(m, url);
    assert.ok(m[1] >= z.d, url + ': ' + m[1] + ' < ' + z.d);
    const f = url === '/' ? 'index.html' : url.replace(/^\//, '') + (url.endsWith('/') ? 'index.html' : '');
    const dm = (chit(f).match(/"dateModified": ?"(\d{4}-\d{2}-\d{2})/) || [])[1];
    if (dm) assert.ok(m[1] >= dm, url + ': lastmod раньше dateModified');
  }
  assert.ok(R['/'].d >= '2026-10-24', 'главная менялась 24.10 (Разбор № 27 на витрине)');
  for (const u of ['/praktika/', '/reyting/', '/zhurnal/']) assert.ok(!(u in R), u + ' — lastmod ведёт свой сборщик');
});

test('lastmod: отпечаток не видит шапку, подвал, полосу беты, скрипты и неразрывные пробелы', () => {
  const kod = 'import sys; sys.path.insert(0, "tests"); import sitemap_lastmod as L; ' +
    'a = "<title>Т</title><body><!--shapka-->x<!--/shapka--><p>Текст в&nbsp;банк</p><!--beta-polosa-->b<!--/beta-polosa--><script>1</script><!--podval-->п<!--/podval--></body>"; ' +
    'b = "<title>Т</title><body><!--shapka-->y<!--/shapka--><p>Текст в банк</p><!--beta-polosa-->c<!--/beta-polosa--><script>2</script><!--podval-->р<!--/podval--></body>"; ' +
    'c = "<title>Т</title><body><p>Другой текст</p></body>"; ' +
    'print(L.otpechatok(a) == L.otpechatok(b), L.otpechatok(a) == L.otpechatok(c))';
  assert.strictEqual(execFileSync('python3', ['-c', kod], { cwd: ROOT, encoding: 'utf8' }).trim(), 'True False');
});
