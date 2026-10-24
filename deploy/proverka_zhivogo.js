#!/usr/bin/env node
// nginx-proverka-v1 ([Ночные запуски] 24.10.2026) — проверка живого сайта после переезда на nginx
// (план [Маркетинг] 24.10, разд. 1.3 и 6 п. 1; deploy/PEREEZD.md, шаг 4).
//
//   node deploy/proverka_zhivogo.js                       — deloskop.ru: 404, редиректы, сжатие, кэш, закрытые папки
//   node deploy/proverka_zhivogo.js --sitemap             — плюс каждый адрес обеих карт сайта: 200, без редиректа, canonical = адрес
//   node deploy/proverka_zhivogo.js https://<тех-домен>   — то же для технического домена приложения
//   --json                                                — ответ одной строкой JSON (для запусков по расписанию)
//
// Код выхода 0 — всё ✓, 1 — есть ✗, 2 — сайт не ответил. Ничего не пишет, только читает (GET/HEAD).
// Тот же набор проверок CI гоняет на локальном nginx в tests/nginx.test.js — правило в конфиге и проверка не разойдутся.
// Из облака за прокси: NODE_USE_ENV_PROXY=1 node deploy/proverka_zhivogo.js
'use strict';

const BOEVOJ = 'https://deloskop.ru';
const PAKET = /\/js\/b\/yadro\.[0-9a-f]{10}\.js/;
const KLYUCH_INDEXNOW = '721cac83d28c340b1b944aebe5909900';

function sluchajno() { return Math.random().toString(36).slice(2, 10); }
// Старое приложение (Caddy, тип «HTML/CSS/JS») на любой адрес отдаёт главную с кодом 200 — так и пишем.
function kak(r) {
  if (r.kod === 200 && /rel="canonical" href="https:\/\/deloskop\.ru\/"/.test(r.text)) return '200 — главная вместо нужного ответа';
  return `${r.kod}${r.h.location ? ' ' + r.h.location : ''}`;
}

async function zapros(baza, put, { metod = 'GET', telo = true } = {}) {
  const r = await fetch(baza + put, {
    method: metod, redirect: 'manual',
    headers: { 'Accept-Encoding': 'gzip, br', 'User-Agent': 'deloskop-proverka/1' },
    signal: AbortSignal.timeout(20000),
  });
  const h = {};
  r.headers.forEach((v, k) => { h[k] = v; });
  const text = telo && metod !== 'HEAD' ? await r.text() : '';
  return { kod: r.status, h, text };
}

// Каждая проверка: имя (что видит человек), зачем (что значит ✗), функция → строка-ошибка или '' (✓) или {ok, info}.
function proverki(baza) {
  const P = [];
  const p = (imya, zachem, fn) => P.push({ imya, zachem, fn });

  p('Сервер — наш nginx', 'домен ещё на старом приложении — переключите deloskop.ru на deloskop-site-nginx (Timeweb → Домены и SSL)', async () => {
    const r = await zapros(baza, '/', { metod: 'HEAD' });
    return /^nginx/i.test(r.h.server || '') ? '' : `сервер «${r.h.server || 'не назван'}»`;
  });

  p('Выдуманный адрес — честная 404', 'на битый адрес приходит главная с кодом 200 — Яндекс видит дубли главной (мягкая 404)', async () => {
    for (const put of [`/proverka-${sluchajno()}/`, `/nalogi/${sluchajno()}/`, `/${sluchajno()}.html`]) {
      const r = await zapros(baza, put);
      if (r.kod !== 404) return `${put} → ${kak(r)}`;
      if (!/Страница не найдена/.test(r.text)) return `${put} → 404, но не наша страница «Страница не найдена»`;
      if (/rel="canonical" href="https:\/\/deloskop\.ru\/"/.test(r.text)) return `${put} → 404 с текстом главной`;
    }
    return '';
  });

  p('Адрес без слеша → 301 на адрес со слешем', 'ответ не тот, что задан в deploy/nginx.conf (старое приложение отвечает по-своему)', async () => {
    const r = await zapros(baza, '/nalogi', { telo: false });
    return r.kod === 301 && r.h.location === '/nalogi/' ? '' : `/nalogi → ${kak(r)}`;
  });

  p('Короткие адреса → 301', '/cabinet и /report/ должны вести на страницы, а не на главную', async () => {
    for (const [ot, kuda] of [['/cabinet?x=1', '/cabinet.html?x=1'], ['/report/', '/report.html']]) {
      const r = await zapros(baza, ot);
      if (r.kod !== 301 || r.h.location !== kuda) return `${ot} → ${kak(r)}`;
    }
    return '';
  });

  p('Карточка без страницы → проверка по ИНН', '/company/<ИНН>-… без файла должна вести на /?inn=<ИНН>', async () => {
    const r = await zapros(baza, `/company/7707083893-net-${sluchajno()}/`);
    return r.kod === 302 && r.h.location === '/?inn=7707083893' ? '' : `→ ${kak(r)}`;
  });

  p('Адрес отчёта /otchet/<ИНН>/ — открыт людям, закрыт поиску', 'без него флаг OTCHET_PUT в index.html включать нельзя', async () => {
    const r = await zapros(baza, '/otchet/7707083893/', { telo: false });
    if (r.kod !== 200) return `→ ${r.kod}`;
    return /noindex/.test(r.h['x-robots-tag'] || '') ? '' : 'нет X-Robots-Tag: noindex';
  });

  p('Служебное закрыто (404)', 'служебный адрес отвечает не 404: либо файл виден снаружи, либо вместо 404 — главная', async () => {
    for (const put of ['/tests/kartochki.py', '/tests/nginx.test.js', '/deploy/nginx.conf', '/deploy/PEREEZD.md', '/.github/workflows/indexnow.yml', '/.git/config']) {
      const r = await zapros(baza, put);
      if (r.kod !== 404) return `${put} → ${kak(r)}`;
    }
    return '';
  });

  p('Сжатие страниц', 'главная уходит без сжатия (~150 КБ вместо ~40 КБ) — медленнее на телефоне', async () => {
    const r = await zapros(baza, '/');
    const enc = r.h['content-encoding'] || '';
    return /^(gzip|br)$/.test(enc) ? { ok: true, info: `${enc}, ${Math.round(Buffer.byteLength(r.text) / 1024)} КБ без сжатия` } : 'content-encoding нет';
  });

  p('Страницы переспрашиваются (no-cache)', 'без Cache-Control браузер может показать старую версию страницы после выкладки', async () => {
    const r = await zapros(baza, '/', { metod: 'HEAD' });
    return r.h['cache-control'] === 'no-cache' ? '' : `Cache-Control: ${r.h['cache-control'] || 'нет'}`;
  });

  p('Пакеты скриптов — кэш на год', 'пакеты с отпечатком не кэшируются надолго — лишние запросы при каждом заходе', async () => {
    const gl = await zapros(baza, '/');
    const paket = (gl.text.match(PAKET) || [])[0];
    if (!paket) return 'на главной нет пакета /js/b/yadro.<отпечаток>.js';
    const r = await zapros(baza, paket, { metod: 'HEAD' });
    if (r.kod !== 200) return `${paket} → ${r.kod}`;
    return /max-age=31536000/.test(r.h['cache-control'] || '') && /immutable/.test(r.h['cache-control']) ? '' : `Cache-Control: ${r.h['cache-control'] || 'нет'}`;
  });

  p('Картинки и шрифты — кэш на 30 дней', 'иконки и шрифты переспрашиваются при каждом заходе', async () => {
    const r = await zapros(baza, '/favicon.svg', { metod: 'HEAD' });
    return /max-age=2592000/.test(r.h['cache-control'] || '') ? '' : `Cache-Control: ${r.h['cache-control'] || 'нет'}`;
  });

  p('Защитные заголовки', 'нет nosniff / Referrer-Policy', async () => {
    const r = await zapros(baza, '/', { metod: 'HEAD' });
    if (r.h['x-content-type-options'] !== 'nosniff') return 'нет X-Content-Type-Options: nosniff';
    return r.h['referrer-policy'] ? '' : 'нет Referrer-Policy';
  });

  p('Файлы для поисковиков на месте', 'Яндекс не найдёт карту сайта, подтверждение прав или ключ IndexNow', async () => {
    const rob = await zapros(baza, '/robots.txt');
    if (rob.kod !== 200 || !/^text\/plain/.test(rob.h['content-type'] || '') || !/Sitemap:/i.test(rob.text)) return `robots.txt → ${rob.kod} ${rob.h['content-type'] || ''}`;
    for (const put of ['/sitemap.xml', '/sitemap-companies.xml']) {
      const r = await zapros(baza, put);
      if (r.kod !== 200 || !/xml/.test(r.h['content-type'] || '') || !/<urlset/.test(r.text)) return `${put} → ${r.kod} ${r.h['content-type'] || ''}`;
    }
    const ya = await zapros(baza, '/yandex_d591aeadaadcae21.html');
    if (ya.kod !== 200) return `подтверждение Вебмастера → ${ya.kod}`;
    const kl = await zapros(baza, `/${KLYUCH_INDEXNOW}.txt`);
    return kl.kod === 200 && kl.text.trim() === KLYUCH_INDEXNOW ? '' : `ключ IndexNow → ${kl.kod}`;
  });
  return P;
}

// Каждый адрес обеих карт сайта: 200 сразу (без редиректа), canonical = сам адрес, без noindex.
async function kartaSajta(baza, potokov = 6) {
  const loc = [];
  for (const put of ['/sitemap.xml', '/sitemap-companies.xml']) {
    const r = await zapros(baza, put);
    for (const m of r.text.matchAll(/<loc>([^<]+)<\/loc>/g)) loc.push(m[1].trim());
  }
  const oshibki = [];
  let i = 0;
  async function rabotnik() {
    while (i < loc.length) {
      const adres = loc[i++];
      const put = adres.replace(BOEVOJ, '');
      try {
        const r = await zapros(baza, put);
        const can = (r.text.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
        const robots = (r.text.match(/<meta name="robots" content="([^"]+)"/) || [])[1] || '';
        if (r.kod !== 200) oshibki.push(`${put} → ${r.kod}${r.h.location ? ' ' + r.h.location : ''}`);
        else if (can !== adres) oshibki.push(`${put} — canonical ${can || 'нет'}`);
        else if (/noindex/.test(robots) || /noindex/.test(r.h['x-robots-tag'] || '')) oshibki.push(`${put} — noindex в карте сайта`);
      } catch (e) { oshibki.push(`${put} — ${e.name === 'TimeoutError' ? 'нет ответа 20 с' : e.message}`); }
    }
  }
  await Promise.all(Array.from({ length: potokov }, rabotnik));
  return { vsego: loc.length, oshibki };
}

async function proverit(baza = BOEVOJ, { sitemap = false } = {}) {
  baza = baza.replace(/\/+$/, '');
  const itog = [];
  for (const { imya, zachem, fn } of proverki(baza)) {
    let otvet;
    try { otvet = await fn(); } catch (e) { otvet = e.name === 'TimeoutError' ? 'нет ответа 20 с' : e.message; }
    const ok = typeof otvet === 'object' ? otvet.ok : otvet === '';
    itog.push({ imya, ok, chto: ok ? (otvet.info || '') : otvet, zachem: ok ? '' : zachem });
  }
  if (sitemap) {
    const k = await kartaSajta(baza);
    itog.push({
      imya: `Карта сайта: все ${k.vsego} адресов отвечают 200, canonical = адрес`,
      ok: k.vsego > 0 && k.oshibki.length === 0,
      chto: k.oshibki.slice(0, 15).join('; ') + (k.oshibki.length > 15 ? `; и ещё ${k.oshibki.length - 15}` : ''),
      zachem: k.oshibki.length ? 'Яндекс тратит обход на редиректы и ошибки из карты сайта' : '',
      oshibki: k.oshibki,
    });
  }
  return itog;
}

module.exports = { proverit, kartaSajta, BOEVOJ };

if (require.main === module) {
  const args = process.argv.slice(2);
  const baza = args.find(a => /^https?:\/\//.test(a)) || BOEVOJ;
  const json = args.includes('--json');
  proverit(baza, { sitemap: args.includes('--sitemap') }).then(itog => {
    const ok = itog.filter(x => x.ok).length;
    if (json) console.log(JSON.stringify({ baza, ok, vsego: itog.length, itog, kogda: new Date().toISOString() }));
    else {
      console.log(`Проверка ${baza} — ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК\n`);
      for (const x of itog) {
        console.log(`${x.ok ? '✓' : '✗'} ${x.imya}${x.chto ? ' — ' + x.chto : ''}`);
        if (!x.ok) console.log(`    что это значит: ${x.zachem}`);
      }
      console.log(`\nИтог: ${ok} из ${itog.length} ✓` + (ok === itog.length ? ' — переезд в порядке.' : ''));
    }
    process.exit(ok === itog.length ? 0 : 1);
  }).catch(e => { console.error('Сайт не ответил: ' + e.message); process.exit(2); });
}
