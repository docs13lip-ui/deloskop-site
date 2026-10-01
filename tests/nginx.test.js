// nastoyashij-404-v2 ([Ночные запуски] 01.10.2026): сервер сайта для Dockerfile-приложения Timeweb.
// 1) Статические проверки deploy/nginx.conf, Dockerfile, .dockerignore — всегда.
// 2) Если на машине есть nginx (на ubuntu-latest в GitHub он предустановлен; путь можно задать NGINX_BIN) —
//    поднимаем его на копии конфига с root = репозиторий и проверяем ответы: 404, 301, 302, 200, заголовки.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const CONF = fs.readFileSync(path.join(KOREN, 'deploy/nginx.conf'), 'utf8');
const DOCKERFILE = fs.readFileSync(path.join(KOREN, 'Dockerfile'), 'utf8');
const IGNORE = fs.readFileSync(path.join(KOREN, '.dockerignore'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));

test('конфиг: настоящая 404 и никакого «все адреса → главная»', () => {
  assert.match(CONF, /^\s*error_page 404 \/404\.html;/m);
  assert.doesNotMatch(CONF, /try_files[^;]*\/index\.html/, 'SPA-фолбэк на index.html вернул бы мягкую 404');
  assert.match(CONF, /location \/ \{\s*try_files \$uri \$uri\/ =404;/);
  assert.match(CONF, /absolute_redirect off;/, 'TLS снимает Timeweb — редиректы без схемы и порта');
});

test('Dockerfile: порт = listen, конфиг в conf.d, проверка nginx -t при сборке', () => {
  const expose = /^EXPOSE (\d+)/m.exec(DOCKERFILE);
  assert.ok(expose, 'Timeweb требует EXPOSE');
  assert.match(CONF, new RegExp('listen ' + expose[1] + ' default_server;'));
  assert.match(DOCKERFILE, /COPY deploy\/nginx\.conf \/etc\/nginx\/conf\.d\/default\.conf/);
  assert.match(DOCKERFILE, /nginx -t/);
  assert.match(DOCKERFILE, /^FROM nginx:\d+\.\d+-alpine$/m, 'версия образа закреплена');
});

test('.dockerignore: служебное и данные карточек не попадают на сайт', () => {
  for (const p of ['.git', '.github', 'tests', '**/*.py', '**/*.jsonl', '**/*.md']) assert.ok(IGNORE.includes(p), p);
  // всё, что нужно сайту, — не исключено
  for (const p of ['index.html', '404.html', 'css', 'js', 'fonts', 'robots.txt', 'sitemap.xml', 'obnovleniya.json']) {
    assert.ok(fs.existsSync(path.join(KOREN, p)), p + ' есть в репозитории');
    assert.ok(!IGNORE.includes(p), p + ' не исключён');
  }
});

test('короткие адреса из скрипта мягкой 404 перенесены в сервер', () => {
  const idx = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  const m = /a=\{([^}]*)\}/.exec(idx);
  assert.ok(m, 'карта коротких адресов в index.html');
  for (const [, ot, kuda] of m[1].matchAll(/'([^']+)':'([^']+)'/g)) {
    assert.ok(CONF.replace(/[ \t]+/g, ' ').includes(`location = ${ot} { return 301 ${kuda}$is_args$args; }`), ot);
  }
  assert.ok(CONF.includes('return 302 /?inn=$1;'), '/company/ИНН без страницы → проверка по ИНН');
});

function najtiNginx() {
  const kandidaty = [process.env.NGINX_BIN, '/usr/sbin/nginx', '/usr/local/sbin/nginx', '/usr/local/nginx/sbin/nginx'].filter(Boolean);
  for (const k of kandidaty) if (fs.existsSync(k)) return k;
  const w = spawnSync('sh', ['-c', 'command -v nginx'], { encoding: 'utf8' });
  return w.status === 0 && w.stdout.trim() ? w.stdout.trim() : null;
}
function mimeTypes(bin) {
  const v = spawnSync(bin, ['-V'], { encoding: 'utf8' });
  const out = (v.stdout || '') + (v.stderr || '');
  const cp = /--conf-path=(\S+)/.exec(out);
  const pref = /--prefix=(\S+)/.exec(out);
  const kand = [cp && path.join(path.dirname(cp[1]), 'mime.types'), pref && path.join(pref[1], 'conf/mime.types'), '/etc/nginx/mime.types'];
  return kand.find(k => k && fs.existsSync(k)) || null;
}
function zapros(port, put, metod = 'GET') {
  return new Promise((ok, ne) => {
    const r = http.request({ host: '127.0.0.1', port, path: encodeURI(put), method: metod, headers: { 'Accept-Encoding': 'gzip' } }, res => {
      let telo = Buffer.alloc(0);
      res.on('data', c => { telo = Buffer.concat([telo, c]); });
      res.on('end', () => ok({ kod: res.statusCode, h: res.headers, telo }));
    });
    r.on('error', ne); r.end();
  });
}

const BIN = najtiNginx();
const MIME = BIN && mimeTypes(BIN);

test('живой nginx: коды ответов и заголовки', { skip: !(BIN && MIME) && 'nginx не найден — проверены только файлы' }, async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deloskop-nginx-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const server = CONF.replace('listen 80 default_server;', `listen 127.0.0.1:${port} default_server;`)
    .replace('root /usr/share/nginx/html;', `root ${KOREN};`);
  fs.writeFileSync(path.join(tmp, 'site.conf'), server);
  fs.writeFileSync(path.join(tmp, 'nginx.conf'), `daemon on; pid ${tmp}/nginx.pid; error_log ${tmp}/error.log;
events { worker_connections 64; }
http { include ${MIME}; default_type application/octet-stream; access_log off;
  client_body_temp_path ${tmp}/b; proxy_temp_path ${tmp}/p; fastcgi_temp_path ${tmp}/f; uwsgi_temp_path ${tmp}/u; scgi_temp_path ${tmp}/s;
  include ${tmp}/site.conf; }`);
  const proverka = spawnSync(BIN, ['-t', '-p', tmp, '-c', path.join(tmp, 'nginx.conf')], { encoding: 'utf8' });
  assert.strictEqual(proverka.status, 0, proverka.stderr);
  const pusk = spawnSync(BIN, ['-p', tmp, '-c', path.join(tmp, 'nginx.conf')], { encoding: 'utf8' });
  assert.strictEqual(pusk.status, 0, pusk.stderr);
  t.after(() => { spawnSync(BIN, ['-p', tmp, '-c', path.join(tmp, 'nginx.conf'), '-s', 'stop']); });
  for (let i = 0; i < 50; i++) { try { await zapros(port, '/robots.txt'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }

  const glavnaya = await zapros(port, '/');
  assert.strictEqual(glavnaya.kod, 200);
  assert.strictEqual(glavnaya.h['cache-control'], 'no-cache');
  assert.strictEqual(glavnaya.h['x-content-type-options'], 'nosniff');
  assert.strictEqual(glavnaya.h['content-encoding'], 'gzip');

  const net = await zapros(port, '/net-takoj-stranicy-xyz/');
  assert.strictEqual(net.kod, 404, 'выдуманный адрес → 404');
  const telo404 = require('zlib').gunzipSync(net.telo).toString('utf8');
  assert.match(telo404, /Страница не найдена/);
  assert.doesNotMatch(telo404, /rel="canonical" href="https:\/\/deloskop\.ru\/"/, 'не главная');
  assert.strictEqual((await zapros(port, '/nalogi/net-takoj-stati/')).kod, 404);
  assert.strictEqual((await zapros(port, '/js/net-takogo.js')).kod, 404);
  assert.strictEqual((await zapros(port, '/fonts/net.woff2')).kod, 404);

  for (const p of ['/nalogi/', '/nalogi/dokumenty-kontragenta-po-summe-sdelki/', '/115-fz/', '/praktika/', '/tarify/', '/sitemap.xml', '/robots.txt', '/obnovleniya.json', '/404.html', '/css/shapka.css', '/js/shapka.js', '/favicon.svg', '/721cac83d28c340b1b944aebe5909900.txt', '/yandex_d591aeadaadcae21.html']) {
    assert.strictEqual((await zapros(port, p)).kod, 200, p);
  }
  assert.strictEqual((await zapros(port, '/404.html')).h['x-robots-tag'], 'noindex');
  assert.strictEqual((await zapros(port, '/favicon.svg')).h['cache-control'], 'public, max-age=2592000');

  const bezSlesha = await zapros(port, '/nalogi');
  assert.strictEqual(bezSlesha.kod, 301);
  assert.strictEqual(bezSlesha.h.location, '/nalogi/', 'относительный адрес — без http:// и порта');

  const kab = await zapros(port, '/cabinet?x=1');
  assert.strictEqual(kab.kod, 301);
  assert.strictEqual(kab.h.location, '/cabinet.html?x=1');
  assert.strictEqual((await zapros(port, '/report/')).h.location, '/report.html');

  const komp = await zapros(port, '/company/7707083893-pao-sberbank/');
  assert.strictEqual(komp.kod, 302);
  assert.strictEqual(komp.h.location, '/?inn=7707083893');
  assert.strictEqual((await zapros(port, '/company/abc/')).kod, 404);

  for (const p of ['/tests/nginx.test.js', '/tests/kartochki.py', '/.github/workflows/indexnow.yml', '/.git/config', '/deploy/nginx.conf', '/.gitignore']) {
    assert.strictEqual((await zapros(port, p)).kod, 404, p);
  }
  assert.strictEqual((await zapros(port, '/', 'HEAD')).h.server, 'nginx', 'без номера версии');
});
