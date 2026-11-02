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

test('/politika/: цели 7 и 8 дословно по тексту [Право], редакция 2 ноября 2026 (sobytiya-v1)', () => {
  const t = chitat('politika/index.html');
  const s = bezTegov(t);
  for (const f of [
    'Отзыв в форме «Голос клиента»: текст и тема. Если вы вошли — отзыв связан с аккаунтом. Цель — улучшать сервис. Основание — договор (оферта). Хранится, пока есть аккаунт; отзыв гостя — без связи с человеком.',
    'Мы считаем просмотры страниц сами, без файлов cookie. Сохраняем только адрес страницы сайта, вид источника перехода (например, «поиск Яндекса» или «ВКонтакте») и час. IP-адрес используем меньше 2 секунд — чтобы не посчитать один просмотр дважды — и не сохраняем. Связать записи с человеком нельзя. Если в браузере включён запрет отслеживания, просмотр не учитываем.',
    // sobytiya-v1: строка [Право] 01.11 (разд. 2, п. 5) дословно
    'Так же, без cookie и IP, считаем, сколько раз за день нажали кнопки отчёта («Запросить документы», «В досье», «Следить», «Перепроверить») — только общее число по каждой кнопке.',
  ]) assert.ok(s.includes(f), 'в политике нет: ' + f.slice(0, 40));
  assert.ok(t.includes('<p class="meta">Редакция от 2 ноября 2026 '));
  assert.ok(t.includes('"dateModified": "2026-11-02"'));
  // seo-svyazi-v1: lastmod — по смене текста страницы (tests/sitemap_lastmod.py), не раньше редакции
  const lm = chitat('sitemap.xml').match(/<loc>https:\/\/deloskop\.ru\/politika\/<\/loc><lastmod>([\d-]+)</);
  assert.ok(lm && lm[1] >= '2026-10-20');
});

// sobytiya-v1 (02.11.2026, [Ночные запуски]): события M1–M2 по 5 условиям [Право] 01.11 (claude/Право_✎_дефлятор_617-9_события_152ФЗ_Разбор_36_01.11.md, разд. 2).
test('события: на сервер — только вид из белого списка; те же отказы, что у просмотров', () => {
  assert.deepStrictEqual(S.teloSobytiya('deystvie_dokumenty', OKR), { sobytie: 'deystvie_dokumenty' });
  assert.deepStrictEqual(S.teloSobytiya('perepoverka_7_60', { ...OKR, pathname: '/report.html', search: '?inn=7707083893' }), { sobytie: 'perepoverka_7_60' }, 'ни пути, ни ИНН');
  for (const v of ['pdf', 'report_opened', '7707083893', '', undefined]) assert.strictEqual(S.teloSobytiya(v, OKR), null, String(v));
  assert.strictEqual(S.teloSobytiya('deystvie_dosje', { ...OKR, dnt: '1' }), null, 'DNT');
  assert.strictEqual(S.teloSobytiya('deystvie_dosje', { ...OKR, gpc: true }), null, 'Sec-GPC');
  assert.strictEqual(S.teloSobytiya('deystvie_dosje', { ...OKR, webdriver: true }), null, 'робот');
  assert.strictEqual(S.teloSobytiya('deystvie_dosje', { ...OKR, pathname: '/cabinet.html' }), null, 'кабинет');
  assert.strictEqual(S.teloSobytiya('deystvie_dosje', { ...OKR, host: 'localhost' }), null, 'не наш домен');
  for (const v of Object.keys(S.VIDY)) assert.ok(!/ip|inn|report|user|put|id$/i.test(v), 'вид события без идентификаторов: ' + v);
});

test('события: какая кнопка нажата — 4 вопроса, полоса отчёта, кнопка «Следить» в разборах', () => {
  const el = (sel, attrs) => ({ closest: (q) => (q === sel ? { getAttribute: (k) => attrs[k] } : null) });
  assert.strictEqual(S.vidKlika(el('[data-q4-act]', { 'data-q4-act': 'docs' })), 'deystvie_dokumenty');
  assert.strictEqual(S.vidKlika(el('[data-q4-act]', { 'data-q4-act': 'dosje' })), 'deystvie_dosje');
  assert.strictEqual(S.vidKlika(el('[data-q4-act]', { 'data-q4-act': 'slezh' })), 'deystvie_slezhenie');
  assert.strictEqual(S.vidKlika(el('[data-q4-act]', { 'data-q4-act': 'copy' })), null, '«Скопировать список» — не действие');
  assert.strictEqual(S.vidKlika(el('[data-cel]', { 'data-cel': 'otchet_sled' })), 'deystvie_slezhenie');
  assert.strictEqual(S.vidKlika(el('[data-cel]', { 'data-cel': 'otchet_pasport' })), 'deystvie_dosje');
  assert.strictEqual(S.vidKlika(el('[data-cel]', { 'data-cel': 'otchet_sravnit' })), null);
  assert.strictEqual(S.vidKlika(el('[data-slezh-knopka]', {})), 'deystvie_slezhenie');
  assert.strictEqual(S.vidKlika(null), null);
  // атрибуты, на которые опирается счёт, живы в модулях
  assert.ok(chitat('js/chetyre-voprosa.js').includes('data-q4-act'));
  assert.ok(/cel: svoj \? 'shchit_sled' : 'otchet_sled'/.test(chitat('js/otchet.js')));
  assert.ok(chitat('js/otchet.js').includes("cel: 'otchet_pasport'"));
  assert.ok(chitat('js/slezh-knopka.js').includes('data-slezh-knopka'));
});

function brauzerSob({ dnt = null, vkl = true } = {}) {
  const zaprosy = []; const dsob = {};
  const okno = {
    location: { hostname: 'deloskop.ru', pathname: '/report.html', search: '?inn=7707083893' },
    navigator: { doNotTrack: dnt },
    document: { readyState: 'loading', referrer: '', addEventListener: (t, f) => { dsob[t] = f; } },
    addEventListener: () => {},
    fetch: (u, o) => { zaprosy.push(JSON.parse(o.body)); return Promise.resolve({}); },
  };
  let kod = chitat('js/schetchik.js');
  if (vkl) kod = kod.replace('var VKL = false;', 'var VKL = true;');
  vm.runInNewContext(kod, { window: okno, setTimeout });
  const klik = (act) => dsob.click({ target: { closest: (q) => (q === '[data-q4-act]' ? { getAttribute: () => act } : null) } });
  return { zaprosy, klik, okno };
}

test('события в браузере: выключены до API; включены — первое действие + вид, повтор не шлём; DNT — ничего', () => {
  const vyk = brauzerSob({ vkl: false });
  vyk.klik('docs');
  assert.strictEqual(vyk.zaprosy.length, 0, 'до выкладки API сайт событий не шлёт');
  assert.ok(chitat('js/schetchik.js').includes('var VKL = false;'), 'включение — одной строкой после API');

  const b = brauzerSob();
  b.klik('docs'); b.klik('docs'); b.klik('slezh'); b.klik('close');
  assert.deepStrictEqual(b.zaprosy, [{ sobytie: 'deystvie_pervoe' }, { sobytie: 'deystvie_dokumenty' }, { sobytie: 'deystvie_slezhenie' }]);
  b.okno.dlkSobytie('perepoverka_7_60'); b.okno.dlkSobytie('chto_ugodno');
  assert.deepStrictEqual(b.zaprosy.slice(3), [{ sobytie: 'perepoverka_7_60' }]);

  const n = brauzerSob({ dnt: '1' });
  n.klik('docs'); n.okno.dlkSobytie('perepoverka_7_60');
  assert.strictEqual(n.zaprosy.length, 0, 'DNT — ни одного события');
});

test('перепроверка 7–60 дней: считает браузер, на сервер — только вид; ИП не считаем', () => {
  const DEN = 864e5;
  const zapusk = (bylo) => {
    const hran = { dlk_nedavnie: JSON.stringify(bylo) }; const vyzovy = [];
    const w = { localStorage: { getItem: (k) => hran[k] || null, setItem: (k, v) => { hran[k] = v; } }, dlkSobytie: (v) => vyzovy.push(v) };
    vm.runInNewContext(chitat('js/nedavnie.js'), { window: w, self: w, document: undefined, Date });
    return { N: w.Nedavnie, vyzovy };
  };
  const t = Date.now();
  let z = zapusk([{ inn: '7707083893', name: 'А', t: t - 10 * DEN }]);
  z.N.add({ inn: '7707083893', name: 'А' });
  assert.deepStrictEqual(z.vyzovy, ['perepoverka_7_60']);
  z = zapusk([{ inn: '7707083893', name: 'А', t: t - 2 * DEN }]); z.N.add({ inn: '7707083893' });
  assert.deepStrictEqual(z.vyzovy, [], '2 дня — рано');
  z = zapusk([{ inn: '7707083893', name: 'А', t: t - 90 * DEN }]); z.N.add({ inn: '7707083893' });
  assert.deepStrictEqual(z.vyzovy, [], '90 дней — уже новая проверка');
  z = zapusk([{ inn: '500100732259', name: 'ИП', t: t - 10 * DEN }]); z.N.add({ inn: '500100732259' });
  assert.deepStrictEqual(z.vyzovy, [], 'ИП — не считаем');
  z = zapusk([]); z.N.add({ inn: '7707083893' });
  assert.deepStrictEqual(z.vyzovy, [], 'первая проверка — не перепроверка');
  assert.strictEqual(z.N.okno(0, 7 * DEN), true); assert.strictEqual(z.N.okno(0, 61 * DEN), false);
});
