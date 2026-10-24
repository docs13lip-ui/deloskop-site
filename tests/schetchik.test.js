// noch-2010-schetchik (20.10.2026, [Ночные запуски]): свой счёт просмотров без cookie — сайт-часть pult-v2.
// Тексты /politika/ (цели 7 и 8) — дословно [Право] 19.10 10:50 (claude/Право_ответы_✎_п321_п333_…_19.10.md).
// Сервер POST /api/ping {p, r} считает, только когда SCHETCHIK=1; до этого отвечает 204.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const S = require('../js/schetchik.js');
const bezTegov = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-');

const OKR = { host: 'deloskop.ru', pathname: '/nalogi/', search: '', referrer: '' };

test('на сервер — только путь и адрес сайта, откуда пришли', () => {
  assert.deepStrictEqual(S.telo({ ...OKR, referrer: 'https://yandex.ru/search/?text=проверка+ИНН+7707083893' }),
    { p: '/nalogi/', r: 'https://yandex.ru' });
  assert.deepStrictEqual(S.telo({ ...OKR, pathname: '/', search: '?inn=7707083893&x=1' }), { p: '/', r: '' }, 'ИНН из адресной строки не уходит');
  assert.strictEqual(S.put('/', '?utm_source=VK&utm_medium=post'), '/?utm_source=vk', 'из меток — только utm_source');
  assert.strictEqual(S.put('/', '?utm_source=7707083893'), '/', 'цифры вместо метки — не метка');
  assert.strictEqual(S.put('/company/7707083893-sberbank/', ''), '/company/7707083893-sberbank/', 'ИНН компании — публичная карточка');
  assert.strictEqual(S.put('/otchet/500100732259/', ''), '/otchet/*/', 'ИНН ИП (12 цифр) → *');
  assert.strictEqual(S.put('/x/304500116000157/', ''), '/x/*/', 'ОГРНИП (15 цифр) → *');
  assert.strictEqual(S.otkuda('android-app://ru.yandex.searchplugin/'), '', 'не http — пусто');
});

test('не считаем: «Не отслеживать», GPC, роботы, кабинет, админка, чужой домен', () => {
  assert.strictEqual(S.telo({ ...OKR, dnt: '1' }), null);
  assert.strictEqual(S.telo({ ...OKR, gpc: true }), null);
  assert.strictEqual(S.telo({ ...OKR, webdriver: true }), null);
  for (const p of ['/cabinet.html', '/cabinet/', '/admin.html', '/admin'])
    assert.strictEqual(S.telo({ ...OKR, pathname: p }), null, p);
  for (const h of ['localhost', '127.0.0.1', 'deloskop.ru.evil.com', 'xn--d1aqfcdhhif.xn--p1ai'])
    assert.strictEqual(S.telo({ ...OKR, host: h }), null, h);
  assert.ok(S.telo({ ...OKR, host: 'www.deloskop.ru' }));
});

function brauzer({ dnt = null, prerendering = false } = {}) {
  const zaprosy = []; const sob = {}; const dsob = {};
  const okno = {
    location: { hostname: 'deloskop.ru', pathname: '/115-fz/', search: '?utm_source=dzen' },
    navigator: { doNotTrack: dnt },
    document: { readyState: 'complete', referrer: 'https://dzen.ru/a/xyz?u=1', prerendering,
      addEventListener: (t, f) => { dsob[t] = f; } },
    addEventListener: (t, f) => { sob[t] = f; },
    requestIdleCallback: (f) => f(),
    fetch: (u, o) => { zaprosy.push({ u, o }); return Promise.resolve({}); },
  };
  vm.runInNewContext(chitat('js/schetchik.js'), { window: okno, setTimeout });
  return { zaprosy, sob, dsob };
}

test('браузер: один запрос без cookie, keepalive; DNT — ни одного; prerender — после показа; «Назад» из кэша — ещё один', () => {
  const b = brauzer();
  assert.strictEqual(b.zaprosy.length, 1);
  const { u, o } = b.zaprosy[0];
  assert.strictEqual(u, 'https://api.deloskop.ru/api/ping');
  assert.strictEqual(o.credentials, 'omit');
  assert.strictEqual(o.keepalive, true);
  assert.deepStrictEqual(JSON.parse(o.body), { p: '/115-fz/?utm_source=dzen', r: 'https://dzen.ru' });
  b.sob.pageshow({ persisted: false });
  assert.strictEqual(b.zaprosy.length, 1);
  b.sob.pageshow({ persisted: true });
  assert.strictEqual(b.zaprosy.length, 2);

  assert.strictEqual(brauzer({ dnt: '1' }).zaprosy.length, 0);
  const pr = brauzer({ prerendering: true });
  assert.strictEqual(pr.zaprosy.length, 0, 'prerender — не просмотр');
  pr.dsob.prerenderingchange();
  assert.strictEqual(pr.zaprosy.length, 1);
});

test('счётчик — в общем пакете «yadro» и отдельным тегом в sobrat_shapku', () => {
  const sb = JSON.parse(chitat('partials/sborka.json'));
  assert.ok(sb.pakety.yadro.includes('js/schetchik.js'));
  assert.ok(chitat('tests/sobrat_shapku.py').includes('SCHETCHIK_JS = \'<script src="/js/schetchik.js" defer></script>\''));
  assert.ok(!/localStorage|document\.cookie|sendBeacon/.test(chitat('js/schetchik.js')), 'без хранилища браузера и cookie');
});

test('/politika/: цели 7 и 8 дословно по тексту [Право], редакция 20 октября 2026', () => {
  const t = chitat('politika/index.html');
  const s = bezTegov(t);
  for (const f of [
    'Отзыв в форме «Голос клиента»: текст и тема. Если вы вошли — отзыв связан с аккаунтом. Цель — улучшать сервис. Основание — договор (оферта). Хранится, пока есть аккаунт; отзыв гостя — без связи с человеком.',
    'Мы считаем просмотры страниц сами, без файлов cookie. Сохраняем только адрес страницы сайта, вид источника перехода (например, «поиск Яндекса» или «ВКонтакте») и час. IP-адрес используем меньше 2 секунд — чтобы не посчитать один просмотр дважды — и не сохраняем. Связать записи с человеком нельзя. Если в браузере включён запрет отслеживания, просмотр не учитываем.',
  ]) assert.ok(s.includes(f), 'в политике нет: ' + f.slice(0, 40));
  assert.ok(t.includes('<p class="meta">Редакция от 20 октября 2026 '));
  assert.ok(t.includes('"dateModified": "2026-10-20"'));
  // seo-svyazi-v1: lastmod — по смене текста страницы (tests/sitemap_lastmod.py), не раньше редакции
  const lm = chitat('sitemap.xml').match(/<loc>https:\/\/deloskop\.ru\/politika\/<\/loc><lastmod>([\d-]+)</);
  assert.ok(lm && lm[1] >= '2026-10-20');
});
