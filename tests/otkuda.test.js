// «Откуда данные» (js/otkuda.js) — опись источников под отчётом на экране проверки по ИНН.
// node --test tests/otkuda.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const O = require('../js/otkuda.js');
const KOREN = path.join(__dirname, '..');
const NB = '\u00a0';

// Форма живого ответа /api/check 02.10 (поля и тексты — как у API; компания вымышленная)
function damia(status) {
  const o = {};
  [['sudy', 'Арбитражные суды', 'https://kad.arbitr.ru/'], ['bankrotstvo', 'Банкротство', 'https://bankrot.fedresurs.ru/'], ['fssp', 'Приставы', 'https://fssp.gov.ru/iss/ip/'],
    ['priostanovki', 'Счета: решения ФНС о приостановлении', 'https://service.nalog.ru/bi.do'], ['mery', 'Обеспечительные меры ФНС', ''],
    ['rnp', 'Недобросовестные поставщики (РНП)', 'https://zakupki.gov.ru/epz/dishonestsupplier/search/results.html'], ['kontrakty', 'Госконтракты', '']]
    .forEach(([k, n, u]) => { o[k] = { nazvanie: n, istochnik: 'источник ' + k, status, prichina: status === 'ne_provereno' ? 'источник временно недоступен' : undefined, proverit_samim: u || undefined }; });
  o.polnota = { provereno: 0, iz: 7 }; o.platnyj = false; o.versiya = 'damia-v1.4';
  return o;
}
function otvet(over) {
  return Object.assign({
    company: { inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2015-03-10', director_name: 'Иванов Иван Иванович', address: 'г Москва, ул Примерная, д 1' },
    risk_level: 'low', risk_title: 'Низкий риск', verdict: 'Работать можно.', checked_at: '2026-10-01T22:30:00Z',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' },
    ],
    damia: damia('ne_provereno'),
    zsk: { level: 'low', title: 'Низкая вероятность', cbr_url: 'https://www.cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/' },
    dossier: {
      data_dates: 'ЕГРЮЛ/ЕГРИП — на 29.09.2026; задолженность — на 01.09.2026',
      charts: { revenue: [{ year: 2023, value: 100 }, { year: 2024, value: 120 }, { year: 2025, value: 130 }], profit: [{ year: 2025, value: 5 }] },
    },
  }, over || {});
}

test('даты наборов разбираются из строки досье', () => {
  assert.deepStrictEqual(O.datyNaborov('ЕГРЮЛ/ЕГРИП — на 29.09.2026; задолженность — на 01.09.2026'),
    [{ metka: 'ЕГРЮЛ/ЕГРИП', data: '29.09.2026' }, { metka: 'задолженность', data: '01.09.2026' }]);
  // формат после daty-api-v1: «последнее изменение записи … — дата» без «на»
  const d = O.datyNaborov('ЕГРЮЛ/ЕГРИП — на 02.10.2026; последнее изменение записи ЕГРЮЛ/ЕГРИП — 30.06.2026; уплаченные налоги — на 31.12.2025');
  assert.strictEqual(d.length, 3);
  assert.strictEqual(d[1].data, '30.06.2026');
  assert.deepStrictEqual(O.datyNaborov(''), []);
  assert.deepStrictEqual(O.datyNaborov(null), []);
});

test('опись: ЕГРЮЛ, ФНС, ГИР БО ответили; 7 внешних реестров — нет; расчёт отдельно и не в счёт', () => {
  const o = O.istochniki(otvet());
  assert.strictEqual(o.dataPr, '02.10.2026'); // 22:30 UTC = 01:30 МСК следующего дня
  assert.strictEqual(o.oprosheno, 10);
  assert.strictEqual(o.otvetili, 3);
  const k = o.spisok.map((x) => x.k);
  assert.deepStrictEqual(k.slice(0, 3), ['egrul', 'sig:ФНС, открытые данные', 'girbo']);
  assert.strictEqual(k[k.length - 1], 'raschet');
  assert.strictEqual(o.spisok[0].data, 'на' + NB + '29.09.2026');
  assert.strictEqual(o.spisok[1].data, 'на' + NB + '01.09.2026');
  assert.strictEqual(o.spisok[1].chto, 'задолженность по налогам');
  assert.strictEqual(o.spisok[2].data, 'за 2023–2025' + NB + 'гг.');
  const sudy = o.spisok.find((x) => x.k === 'damia:sudy');
  assert.strictEqual(sudy.znak, '○');
  assert.strictEqual(sudy.status, 'net');
  assert.strictEqual(sudy.ssylka, 'https://kad.arbitr.ru/');
  assert.strictEqual(o.spisok.find((x) => x.k === 'raschet').znak, '◆');
});

test('ответивший внешний реестр — ●, «нашли» и «не нашли» оба считаются ответом', () => {
  const dm = damia('not_found'); dm.sudy.status = 'found'; dm.sudy.data_svedeniy = '2026-09-30';
  const o = O.istochniki(otvet({ damia: dm }));
  assert.strictEqual(o.otvetili, 10);
  assert.strictEqual(o.spisok.find((x) => x.k === 'damia:sudy').data, 'на' + NB + '30.09.2026');
  assert.strictEqual(o.spisok.find((x) => x.k === 'damia:fssp').data, 'на' + NB + '02.10.2026');
  assert.ok(o.spisok.every((x) => x.znak !== '○'));
});

test('нет отчётности — ГИР БО «○ не ответил» со ссылкой; у ИП строки ГИР БО и адреса нет', () => {
  const o = O.istochniki(otvet({ dossier: { data_dates: '' } }));
  const g = o.spisok.find((x) => x.k === 'girbo');
  assert.strictEqual(g.znak, '○');
  assert.strictEqual(g.ssylka, 'https://bo.nalog.gov.ru/');
  const ip = O.istochniki(otvet({ company: { inn: '770000000012', kind: 'INDIVIDUAL', status: 'ACTIVE' } }));
  assert.ok(!ip.spisok.some((x) => x.k === 'girbo'));
  assert.strictEqual(ip.spisok[0].nazv, 'ЕГРИП (ФНС)');
  assert.ok(!/адрес|руководител/.test(ip.spisok[0].chto));
});

test('последнее изменение записи и уплаченные налоги — из data_dates, если API их отдаёт', () => {
  const o = O.istochniki(otvet({ signals: [], dossier: { data_dates: 'ЕГРЮЛ/ЕГРИП — на 02.10.2026; последнее изменение записи ЕГРЮЛ/ЕГРИП — 30.06.2026; уплаченные налоги — на 31.12.2025', charts: {} } }));
  assert.strictEqual(o.spisok[0].dop, 'последнее изменение записи — 30.06.2026');
  const p = o.spisok.find((x) => x.k === 'paytax');
  assert.ok(p);
  assert.strictEqual(p.data, 'на' + NB + '31.12.2025');
});

test('HTML: счётчик, точки, легенда; ФИО и адрес не выводятся; ссылки — только https', () => {
  const r = otvet();
  r.damia.sudy.proverit_samim = 'javascript:alert(1)';
  const h = O.html(r);
  assert.ok(h.includes('Откуда данные'));
  assert.ok(h.includes('ответили 3 из 10' + NB + 'источников'));
  assert.ok(h.includes('●●●○○○○○○○'));
  assert.ok(h.includes('не значит «не нашли»'));
  assert.ok(h.includes('Это оценка риска, а не решение банка.'));
  assert.ok(!h.includes('Иванов'));
  assert.ok(!h.includes('Примерная'));
  assert.ok(!h.includes('javascript:'));
  assert.ok(h.includes('href="/indeks/"'));
});

test('общая причина у всех не ответивших — один раз под списком; разные — в своих строках', () => {
  const h = O.html(otvet());
  assert.ok(h.includes('Не ответили 7 из 10: источник временно недоступен.'));
  assert.strictEqual(h.split('источник временно недоступен').length - 1, 1);
  assert.ok(h.includes('>не ответил</span>'), 'строка без ссылки и причины — «не ответил»');
  const r = otvet(); r.damia.rnp.prichina = 'реестр на обслуживании';
  const h2 = O.html(r);
  assert.ok(!h2.includes('Не ответили 7'));
  assert.ok(h2.includes('реестр на обслуживании'));
});

test('пустой ответ — пусто; склонение счётчика', () => {
  assert.strictEqual(O.html(null), '');
  assert.strictEqual(O.html({}), '');
  const r = otvet({ damia: {}, signals: [], dossier: {} });
  assert.ok(O.html(r).includes('ответили 1 из 2' + NB + 'источников'));
  const r1 = otvet({ damia: {}, signals: [], dossier: {}, company: { inn: '770000000012' } });
  assert.ok(O.html(r1).includes('ответили 1 из 1' + NB + 'источника'));
});

test('тексты: без превосходных степеней и обещаний; ИИ не упоминаем', () => {
  const src = fs.readFileSync(path.join(KOREN, 'js', 'otkuda.js'), 'utf8');
  const h = O.html(otvet());
  [/гарантир/i, /лучш/i, /самый/i, /100\s?%/, /\bИИ\b/, /нейросет/i].forEach((re) => assert.ok(!re.test(h), re));
  assert.ok(!/[\u00a0]/.test(src), 'в исходнике нет неразрывных пробелов — только \\u00a0');
});

test('index.html: модуль подключён и монтируется вместо строки «Источники»', () => {
  const s = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  assert.ok(s.includes('<script src="/js/otkuda.js" defer></script>'));
  assert.ok(s.includes("Otkuda.mount(report.querySelector('.src'),r)"));
  assert.ok(s.indexOf('Otkuda.mount') > s.indexOf("var ub=report.querySelector('[data-usl]')"), 'после отрисовки отчёта');
});
