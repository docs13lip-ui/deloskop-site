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

function brauzerPam({ vkl = true, dnt = null, hran = {}, slomano = false, den = 20000 } = {}) {
  const zaprosy = [];
  const ls = slomano ? { getItem() { throw new Error('нет'); }, setItem() { throw new Error('нет'); }, removeItem() { throw new Error('нет'); } }
    : { getItem: (k) => (k in hran ? hran[k] : null), setItem: (k, v) => { hran[k] = String(v); }, removeItem: (k) => { delete hran[k]; } };
  const okno = {
    location: { hostname: 'deloskop.ru', pathname: '/report.html', search: '?inn=7707083893' },
    navigator: { doNotTrack: dnt }, localStorage: ls,
    document: { readyState: 'loading', referrer: '', addEventListener: () => {} },
    addEventListener: () => {},
    fetch: (u, o) => { zaprosy.push(JSON.parse(o.body)); return Promise.resolve({}); },
  };
  let kod = chitat('js/schetchik.js');
  if (vkl) kod = kod.replace('var VKL = false;', 'var VKL = true;');
  const Dt = class extends Date {}; Dt.now = () => den * 864e5 + 3600e3;
  const ctx = vm.createContext({ window: okno, self: okno, setTimeout, Date: Dt });
  vm.runInContext(kod, ctx);
  vm.runInContext(chitat('js/nedavnie.js'), ctx);
  return { zaprosy: () => zaprosy.filter((z) => z.sobytie), N: okno.Nedavnie, hran };
}
const P = brauzerPam().N.pamyat;

test('pamyat-proverok-v1: первая, повторная, возврат; 200 записей; 61 день; ИП не пишем', () => {
  const D = 20000;
  const r = P.proverka(null, '7707083893', D);
  assert.deepStrictEqual(Array.from(r.vidy), ['proverka_novaya']);
  assert.strictEqual(JSON.stringify(r.p.d), JSON.stringify({ 7707083893: D }));
  const vid = (x) => Array.from(x.vidy);
  assert.deepStrictEqual(vid(P.proverka(r.p, '7707083893', D)), [], 'тот же день — не новая и не повтор');
  assert.deepStrictEqual(vid(P.proverka(r.p, '7707083893', D + 6)), ['vozvrat_3_30'], '6 дней — возврат, но ещё не перепроверка');
  assert.deepStrictEqual(vid(P.proverka(r.p, '7707083893', D + 10)), ['vozvrat_3_30', 'perepoverka_7_60']);
  assert.deepStrictEqual(vid(P.proverka(r.p, '7707083893', D + 45)), ['perepoverka_7_60'], '45 дней — повтор, не возврат');
  assert.deepStrictEqual(vid(P.proverka(r.p, '7707083893', D + 61)), ['proverka_novaya'], '61 день — запись удалена');
  assert.strictEqual(P.proverka(r.p, '500100732259', D), null, 'ИП (12 цифр) не пишем');
  assert.strictEqual(P.proverka(r.p, '0000000000', D), null);
  assert.strictEqual(P.proverka(r.p, '77070838', D), null);
  const v = P.vozvrat({ d: { 7707083893: D - 5 } }, D);
  assert.deepStrictEqual(vid(v), ['vozvrat_3_30']);
  assert.deepStrictEqual(vid(P.vozvrat(v.p, D)), [], 'второй раз за день — нет');
  assert.deepStrictEqual(vid(P.vozvrat(v.p, D + 1)), ['vozvrat_3_30']);
  assert.deepStrictEqual(vid(P.vozvrat({ d: { 7707083893: D - 2 } }, D)), [], '2 дня — рано');
  assert.deepStrictEqual(vid(P.vozvrat({ d: { 7707083893: D - 31 } }, D)), [], '31 день — уже не возврат');
  let p = null;
  for (let i = 0; i < 205; i++) p = P.proverka(p, String(7700000000 + i), D - 50 + Math.floor(i / 5)).p;
  assert.strictEqual(Object.keys(p.d).length, 200, 'не больше 200');
  assert.ok(!('7700000000' in p.d) && '7700000204' in p.d, 'вытесняется самая старая');
  const c = P.chist({ d: { 7707083893: D, 500100732259: D, 1234567890: 'x', 1111111111: D + 3, 2222222222: D - 61 }, vz: 'x' }, D);
  assert.strictEqual(JSON.stringify(c), JSON.stringify({ d: { 7707083893: D }, vz: 0 }), 'ИП, не число, будущее и старше 60 дней — вон');
  assert.ok(/^\{"d":\{"\d{10}":\d+\},"vz":\d+\}$/.test(JSON.stringify(P.proverka(null, '7707083893', D).p)), 'в памяти — только ИНН ЮЛ и номер дня');
});

test('pamyat-proverok-v1 в браузере: выключено — ни памяти, ни событий; включено — только {sobytie}; DNT и без хранилища — тишина', () => {
  const vyk = brauzerPam({ vkl: false });
  vyk.N.add({ inn: '7707083893', name: 'А' }); vyk.N.render(null);
  assert.ok(!('dlk_pamyat' in vyk.hran), 'до API память не пишется');
  assert.strictEqual(vyk.zaprosy().length, 0);

  const b = brauzerPam();
  b.N.add({ inn: '7707083893' }); b.N.add({ inn: '7707083894' }); b.N.add({ inn: '7707083893' }); b.N.add({ inn: '500100732259' }); b.N.add({ inn: '0000000000' });
  assert.deepStrictEqual(b.zaprosy(), [{ sobytie: 'proverka_novaya' }, { sobytie: 'proverka_novaya' }], 'по разу на компанию, тело — только вид');
  assert.deepStrictEqual(Object.keys(JSON.parse(b.hran.dlk_pamyat).d).sort(), ['7707083893', '7707083894'], 'ИП и пример — мимо памяти');

  const v = brauzerPam({ hran: { dlk_pamyat: JSON.stringify({ d: { 7707083893: 19990 } }) } });
  v.N.render(null); v.N.render(null);
  assert.deepStrictEqual(v.zaprosy(), [{ sobytie: 'vozvrat_3_30' }], 'вернулся через 10 дней — один возврат в день');
  v.N.add({ inn: '7707083893' });
  assert.deepStrictEqual(v.zaprosy().slice(1), [{ sobytie: 'perepoverka_7_60' }], 'повтор через 10 дней — из памяти, не из списка из 5');

  const n = brauzerPam({ dnt: '1', hran: { dlk_pamyat: JSON.stringify({ d: { 7707083893: 19990 } }) } });
  n.N.add({ inn: '7707083894' }); n.N.render(null);
  assert.strictEqual(n.zaprosy().length, 0, 'DNT — ни одного события');
  assert.ok(!JSON.parse(n.hran.dlk_pamyat).d['7707083894'], 'DNT — и память не пополняется');

  const s = brauzerPam({ slomano: true });
  assert.doesNotThrow(() => { s.N.add({ inn: '7707083893' }); s.N.render(null); });
  assert.strictEqual(s.zaprosy().length, 0, 'без хранилища — ни событий, ни ошибок');

  assert.ok(!/dlkSobytie\('perepoverka_7_60'\)/.test(chitat('js/nedavnie.js')), 'повтор не ищем в списке из 5');
  assert.ok(/removeItem\('dlk_pamyat'\)/.test(chitat('js/nedavnie.js')), '«Очистить список» стирает и память');
});

test('pamyat-proverok-v1: события включаются только вместе со строкой о памяти в /politika/ (✎ [Право] п. 459)', () => {
  const vkl = /var VKL = true;/.test(chitat('js/schetchik.js'));
  if (vkl) assert.ok(/dlk_pamyat|памят[ьи] проверок/i.test(chitat('politika/index.html')), 'VKL = true без текста юристов о памяти на устройстве');
});
