// pult-statistika-v1 (24.10.2026): экран «Сегодня» в админке — 8 плиток, цифра → смысл → что сделать (план [Маркетинг] 24.10, разд. 3.2).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const G = require('../js/admin-segodnya.js');
const chitat = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const S = JSON.parse(chitat('data/pult_slova.json'));
const T = Date.parse('2026-10-24T15:00:00Z');

const POLNAYA = {
  est: true, sformirovano: '2026-10-24T15:00:00Z', chas_msk: 18,
  lyudi: { segodnya: 412, vchera_k_chasu: 380, vchera: 530, nedelya: 3100, proshlaya_nedelya: 2600, zahody_nedelya: 1240 },
  proverki: { segodnya: 57, gosti: 41, voshedshie: 16, limit: 3, porog: 10, vchera: 70, nedelya: 402 },
  otkuda: { poisk_yandex: 700, pryamoj: 300, vk: 120, dzen: 60, telegram: 40, sajty: 20, vnutri: 5000 },
  voronka: { prishli: 1240, proverka: 402, otchet: 310, vhod: 25, slezhenie: 9 },
  chitayut: [{ put: '/nalogi/nds-usn-2026/', n: 300 }, { put: '/', n: 900 }, { put: '/company/7707083893-sberbank/', n: 120 }],
  posty: [{ kampaniya: 'rubrika-115', n: 40 }, { kampaniya: 'kartochka-dnya', n: 12 }],
  poisk: { v_poiske: 214, pokazy: 5400, kliki: 160, poziciya: 14.26, isklyucheny: 12 },
  golos: { sutki: 2, nedelya: 9, temy: { sudy: 4, api: 3, bank: 2 }, poslednij: '2026-10-24T11:00:00Z' }
};

test('(1) полная сводка — 8 плиток по порядку, у каждой есть «что значит» и «что сделать», без жаргона', () => {
  const p = G.plitki(POLNAYA, S, T);
  assert.deepStrictEqual(p.map(x => x.id), ['lyudi', 'proverki', 'otkuda', 'voronka', 'chitayut', 'posty', 'poisk', 'golos']);
  for (const x of p) {
    assert.ok(x.smysl && x.smysl.length > 10, x.id + ': что значит');
    assert.ok(x.delat && /^(Что сделать:|Делать ничего не нужно\.)/.test(x.delat), x.id + ': что сделать — ' + x.delat);
    assert.ok(G.bezZhargona(x), x.id + ': жаргон — ' + JSON.stringify(x));
    assert.ok(!/\{|\}/.test(x.smysl + x.podpis + x.delat), x.id + ': невставленный шаблон');
  }
});

test('(2) Люди: цифра сегодня, «вчера к этому часу», рост к прошлой неделе; спад ≥ 40 % — жёлтая с советом про посты', () => {
  let p = G.plLyudi(POLNAYA.lyudi, S);
  assert.strictEqual(p.cvet, 'ok'); assert.strictEqual(p.cifra, '412'); assert.strictEqual(p.podpis, 'просмотров сегодня');
  assert.match(p.smysl, /Вчера к этому часу — 380\./); assert.match(p.smysl, /на 19\u00a0% больше прошлой недели/);
  assert.match(p.primechanie, /без cookie/);
  p = G.plLyudi({ segodnya: 30, nedelya: 900, proshlaya_nedelya: 2000 }, S);
  assert.strictEqual(p.cvet, 'warn'); assert.match(p.smysl, /на 55\u00a0% меньше/); assert.match(p.delat, /посты/);
  assert.match(p.smysl, /Вчера к этому часу — нет данных/, 'нет поля — «нет данных», а не 0');
  assert.strictEqual(G.plLyudi({ segodnya: 1, nedelya: 1 }, S).podpis, 'просмотр сегодня');
});

test('(3) «нет данных» ≠ «0»: null — серая «не подключено», ноль — цифра 0', () => {
  const net = G.plProverki(null, S), nol = G.plProverki({ segodnya: 0, gosti: 0, voshedshie: 0 }, S);
  assert.strictEqual(net.cvet, 'seryj'); assert.strictEqual(net.cifra, '—'); assert.strictEqual(net.smysl, S.proverki.net);
  assert.strictEqual(nol.cifra, '0'); assert.match(nol.smysl, /ещё не было/);
  assert.strictEqual(G.plChitayut(null, S).cifra, '—'); assert.strictEqual(G.plChitayut([], S).cifra, '0');
  assert.strictEqual(G.plPosty(null, S).smysl, S.posty.net); assert.strictEqual(G.plPosty([], S).cifra, '0');
  // шаг пути без данных — строка «нет данных», в сравнение потерь не входит
  const v = G.plVoronka({ prishli: 100, proverka: 40, otchet: null, vhod: 5, slezhenie: 2 }, S);
  assert.strictEqual(v.stroki[2].n, null); assert.strictEqual(v.stroki[2].proc, null); assert.strictEqual(v.stroki[3].proc, null);
  assert.strictEqual(v.stroki[4].proc, 40);
});

test('(4) Проверки: гости/вошедшие; упёрлись в лимит — жёлтая «им нужен вход»', () => {
  const p = G.plProverki(POLNAYA.proverki, S);
  assert.strictEqual(p.cvet, 'warn');
  assert.match(p.smysl, /Гости — 41, вошедшие — 16/);
  assert.match(p.smysl, /3 человека упёрлись в лимит 10 проверок в день — им нужен вход/);
  assert.match(p.delat, /Войти/);
  assert.strictEqual(G.plProverki({ segodnya: 5, gosti: 5, limit: 0 }, S).cvet, 'ok');
});

test('(5) Откуда: заходы извне (внутренние переходы не в счёт), доли по убыванию; ВК 0 при ≥ 20 заходах — жёлтая', () => {
  let p = G.plOtkuda(POLNAYA.otkuda, S);
  assert.strictEqual(p.cifra, '1 240'); assert.strictEqual(p.cvet, 'ok');
  assert.deepStrictEqual(p.stroki.map(s => s.tekst).slice(0, 3), ['Поиск Яндекса', 'Прямые заходы', 'ВКонтакте']);
  assert.strictEqual(p.stroki[0].proc, 56); assert.match(p.smysl, /Больше всего — Поиск Яндекса: 56\u00a0%/);
  assert.ok(!p.stroki.some(s => /vnutri/.test(s.tekst)));
  assert.match(p.primechanie, /грубая оценка/);
  p = G.plOtkuda({ poisk_yandex: 30, pryamoj: 10, vk: 0 }, S);
  assert.strictEqual(p.cvet, 'warn'); assert.match(p.smysl, /ВКонтакте не дал ни одного перехода/);
  assert.strictEqual(G.plOtkuda({ poisk_yandex: 5 }, S).cvet, 'ok', 'мало заходов — про ВК не судим');
});

test('(6) Путь посетителя: % от предыдущего шага, шаг с наибольшей потерей помечен; мало заходов — без выводов', () => {
  const p = G.plVoronka(POLNAYA.voronka, S);
  assert.deepStrictEqual(p.stroki.map(s => s.proc), [null, 32, 77, 8, 36]);
  assert.strictEqual(p.cifra, '32 %');
  const hud = p.stroki.filter(s => s.hudshij);
  assert.strictEqual(hud.length, 1); assert.strictEqual(hud[0].kluch, 'vhod');
  assert.match(p.smysl, /«Вошли в кабинет»: дальше идут 8\u00a0%/); assert.strictEqual(p.cvet, 'warn');
  const malo = G.plVoronka({ prishli: 7, proverka: 3 }, S);
  assert.strictEqual(malo.cvet, 'seryj'); assert.match(malo.smysl, /мало людей/);
});

test('(7) Что читают: топ по убыванию, тип страницы словами, ссылки — только пути сайта', () => {
  const p = G.plChitayut(POLNAYA.chitayut, S);
  assert.deepStrictEqual(p.stroki.map(s => s.tip), ['главная', 'статья о налогах', 'карточка компании']);
  assert.strictEqual(p.cifra, '900'); assert.strictEqual(p.smysl, 'Первое место — главная.');
  assert.strictEqual(G.plChitayut([{ put: '/nalogi/x/', n: 5 }], S).smysl, 'Первое место — «/nalogi/x/» — статья о налогах.');
  assert.strictEqual(G.tipStranicy('/praktika/115-fz/x/', S.chitayut.tipy), 'разбор дела');
  assert.strictEqual(G.tipStranicy('/kak-vidit-bank/', S.chitayut.tipy), 'страница сайта');
  const dlinnyj = G.plChitayut(Array.from({ length: 15 }, (_, i) => ({ put: '/a' + i + '/', n: i })), S);
  assert.strictEqual(dlinnyj.stroki.length, 10);
});

test('(8) Посты, Поиск, Голос: без токена Яндекса — серая с подсказкой; исключённые — жёлтая; тишина — «нет N дней»', () => {
  const po = G.plPosty(POLNAYA.posty, S);
  assert.strictEqual(po.cifra, '52'); assert.match(po.smysl, /«rubrika-115» — 40 переходов/);
  const net = G.plPoisk(null, S);
  assert.strictEqual(net.cvet, 'seryj'); assert.match(net.smysl, /Подключите токен Яндекса — шаг в Главном/);
  const pk = G.plPoisk(POLNAYA.poisk, S);
  assert.strictEqual(pk.cvet, 'warn'); assert.match(pk.smysl, /средняя позиция — 14,3/); assert.match(pk.smysl, /12 страниц/);
  assert.strictEqual(pk.metka, 'по Вебмастеру');
  const g = G.plGolos(POLNAYA.golos, S, T);
  assert.match(g.smysl, /суды и банкротства — 4, выгрузку данных — 3, отчёт для банка — 2/);
  const tish = G.plGolos({ sutki: 0, nedelya: 0, poslednij: '2026-10-15T10:00:00Z' }, S, T);
  assert.match(tish.smysl, /^Новых отзывов нет 9 дней\. За неделю — 0\.$/); assert.strictEqual(tish.cvet, 'seryj');
});

test('(9) сервер без сводки (старый) — 8 серых с одной причиной; пустая сводка {est:true} — все серые «не подключено», не нули', () => {
  const st = G.plitki({ est: false }, S, T);
  assert.strictEqual(st.length, 8); assert.ok(st.every(p => p.cvet === 'seryj' && p.smysl === S.net_svodki));
  const pust = G.plitki({ est: true }, S, T);
  assert.ok(pust.every(p => p.cvet === 'seryj' && p.cifra === '—'), JSON.stringify(pust.map(p => [p.id, p.cifra])));
  for (const p of st.concat(pust)) assert.ok(G.bezZhargona(p), p.zag);
});

test('(10) шаблоны и словарь: {n|…} склоняет, у словаря нет жаргона и невидимых ключей', () => {
  assert.strictEqual(G.fmt('{n} {n|просмотр|просмотра|просмотров}', { n: 1234 }), '1 234 просмотра');
  assert.strictEqual(G.fmt('{n|человек упёрся|человека упёрлись|человек упёрлись}', { n: 11 }), 'человек упёрлись');
  const vse = JSON.stringify(S);
  assert.ok(!/\b(5xx|latency|uptime|endpoint|API|HTTP|timeout)\b/.test(vse.replace(/"api"/g, '')), 'жаргон в словаре');
  for (const k of ['lyudi', 'proverki', 'otkuda', 'voronka', 'chitayut', 'posty', 'poisk', 'golos']) {
    assert.ok(S[k] && S[k].zag && S[k].net, k);
  }
});

test('(11) админка: «Сегодня» — первым экраном, выше «Сейчас»; скрипт подключён и стартует после summary; 390 — в столбик', () => {
  const a = chitat('admin.html');
  const i = a.indexOf('id="sgSek"');
  assert.ok(i > 0 && i < a.indexOf('id="pultSek"') && i < a.indexOf('id="schSek"'));
  for (const id of ['sgKogda', 'sgSvyaz', 'sgPlitki']) assert.ok(a.includes('id="' + id + '"'), id);
  assert.ok(a.includes('<script src="/js/admin-segodnya.js"></script>'));
  assert.ok(a.includes('DlkSegodnya.start(API)'));
  assert.ok(/<div class="pult" id="sgPlitki"/.test(a), 'та же сетка, что «Сейчас»: 2 колонки, на телефоне — одна');
  const js = chitat('js/admin-segodnya.js');
  assert.ok(js.includes('/api/admin/pult/segodnya') && js.includes('credentials: "include"') && js.includes('"/data/pult_slova.json"'));
  assert.strictEqual(G.PERIOD_MS, 60000);
});
