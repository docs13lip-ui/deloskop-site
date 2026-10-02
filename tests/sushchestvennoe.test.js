// «Только существенные факты» + свёрнутая «Все данные из реестров» (js/sushchestvennoe.js) — экран проверки по ИНН.
// node --test tests/sushchestvennoe.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../js/sushchestvennoe.js');
const KOREN = path.join(__dirname, '..');
const NB = '\u00a0';

// Форма живого ответа /api/check 02.10 (поля и тексты — как у API; компания вымышленная)
function damiaNe() {
  const o = {};
  [['sudy', 'Арбитражные суды', 'https://kad.arbitr.ru/'], ['bankrotstvo', 'Банкротство', 'https://bankrot.fedresurs.ru/'], ['fssp', 'Приставы', 'https://fssp.gov.ru/iss/ip/'],
    ['priostanovki', 'Счета: решения ФНС о приостановлении', 'https://service.nalog.ru/bi.do'], ['mery', 'Обеспечительные меры ФНС', ''],
    ['rnp', 'Недобросовестные поставщики (РНП)', 'https://zakupki.gov.ru/'], ['kontrakty', 'Госконтракты', '']]
    .forEach(([k, n, u]) => { o[k] = { nazvanie: n, istochnik: 'источник ' + k, status: 'ne_provereno', prichina: 'источник временно недоступен', proverit_samim: u || undefined }; });
  o.polnota = { provereno: 0, iz: 7 }; o.platnyj = false; o.versiya = 'damia-v1.4';
  return o;
}
function otvet(over) {
  return Object.assign({
    company: { inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2015-03-10', director_name: 'Иванов Иван Иванович', director_since: '2019-05-20', address: 'г Москва, ул Примерная, д 1', invalid: false, address_invalid: false },
    risk_level: 'low', risk_title: 'Низкий риск', verdict: 'Работать можно.', checked_at: '2026-10-01T22:30:00Z',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ', as_of: null },
      { id: 'age', title: 'Возраст компании', status: 'ok', detail: 'С 10.03.2015', source: 'ЕГРЮЛ', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' },
    ],
    zsk: { level: 'low', title: 'Низкая вероятность', cbr_url: 'https://www.cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/',
      groups: [{ typology: 'Признаки «технической» компании', items: ['Заявлено 56 видов деятельности'] }] },
    damia: damiaNe(),
    dossier: {
      kpi: [{ label: 'Выручка за 2025', value: 48.2e6 }, { label: 'Чистая прибыль за 2025', value: -1.5e6 }],
      charts: { revenue: [{ year: 2024, value: 40e6 }, { year: 2025, value: 48.2e6 }], profit: [{ year: 2025, value: -1.5e6 }] },
      data_dates: 'ЕГРЮЛ/ЕГРИП — на 29.09.2026; задолженность — на 01.09.2026',
      sections: [
        { id: 'profile', title: 'Профиль', rows: [['ИНН / КПП', '7700000001 / 770001001'], ['Юридический адрес', 'г Москва, ул Примерная, д 1']], comment: 'Так часто делают фирмы-однодневки', tone: 'warn' },
        { id: 'management', title: 'Руководство и собственники', rows: [['Генеральный директор', 'Иванов Иван Иванович']] },
        { id: 'dynamics', title: 'Финансовая динамика по годам', rows: [['2025', 'выручка 48,2 млн ₽'], ['Источник', 'ГИР БО ФНС, годовая бухгалтерская отчётность']] },
      ],
    },
  }, over || {});
}

test('чистая компания: 7 фактов в заданном порядке, у каждого источник и дата', () => {
  const f = S.fakty(otvet());
  assert.deepStrictEqual(f.spisok.map((x) => x.k), ['status', 'address', 'tax_debt', 'otchetnost', 'rukovoditel', 'age', 'zsk']);
  assert.strictEqual(f.eshche.length, 0);
  for (const x of f.spisok) { assert.ok(x.ist, x.k + ': источник'); assert.match(x.data, /^\d{2}\.\d{2}\.\d{4}$/, x.k + ': дата'); }
  const po = Object.fromEntries(f.spisok.map((x) => [x.k, x]));
  assert.strictEqual(po.status.data, '02.10.2026', 'дата проверки — по Москве (22:30 UTC = 01:30 МСК следующего дня)');
  assert.strictEqual(po.status.ist, 'ЕГРЮЛ', 'ЕГРЮЛ/ЕГРИП → ЕГРЮЛ для компании');
  assert.strictEqual(po.address.znach, 'Нет');
  assert.strictEqual(po.tax_debt.data, '01.09.2026', 'дата набора ФНС из ответа');
  assert.strictEqual(po.otchetnost.znach, '48,2' + NB + 'млн' + NB + '₽ · убыток 1,5' + NB + 'млн' + NB + '₽');
  assert.strictEqual(po.otchetnost.data, '31.12.2025');
  assert.strictEqual(po.rukovoditel.znach, 'Не менялся 7' + NB + 'лет · с' + NB + '20.05.2019');
  assert.strictEqual(po.age.znach, '11' + NB + 'лет · с' + NB + '10.03.2015');
  assert.match(po.zsk.nazv, /наша оценка, не статус Банка России/);
});

test('замечания — первыми; больше 7 — остаток уходит в «Все данные из реестров»', () => {
  const r = otvet();
  r.signals = r.signals.concat([
    { id: 'mass_address', title: 'Массовый адрес', status: 'warn', detail: 'Зарегистрировано 54 компании', source: 'ФНС, открытые данные', as_of: '01.09.2026' },
    { id: 'tax_debt2', title: 'Долг у приставов', status: 'bad', detail: '1,2 млн ₽', source: 'ФССП', as_of: '30.09.2026' },
  ]);
  r.company.director_since = '2026-08-01';
  const f = S.fakty(r);
  assert.deepStrictEqual(f.spisok.slice(0, 3).map((x) => x.k), ['tax_debt2', 'mass_address', 'rukovoditel']);
  assert.strictEqual(f.spisok.length, S.MAKS);
  assert.deepStrictEqual(f.eshche.map((x) => x.k), ['age', 'zsk']);
  assert.match(f.spisok[2].znach, /^Сменился 2\u00a0месяца назад/);
  const h = S.html(r);
  assert.match(h, /ещё 2 — в\u00a0разделе «Все данные из реестров»/);
  assert.match(S.glubina(r).razdely[0].zag, /Ещё признаки/);
});

test('найденное во внешнем реестре — среди существенных фактов, с источником', () => {
  const r = otvet();
  r.damia.fssp = { nazvanie: 'Приставы', istochnik: 'ФССП', status: 'found', itog: 'Есть исполнительные производства', uroven: 'bad', data_svedeniy: '2026-09-30' };
  const f = S.fakty(r);
  assert.strictEqual(f.spisok[0].k, 'damia_fssp');
  assert.strictEqual(f.spisok[0].data, '30.09.2026');
  assert.ok(!f.neProvereno.some((x) => x.k === 'fssp'));
});

test('«не проверяли ≠ не нашли»: непроверенные источники названы, со ссылками «проверьте сами»', () => {
  const h = S.html(otvet());
  assert.match(h, /Не проверяли в этот раз: арбитражные суды, банкротство, приставы, приостановки счетов, обеспечительные меры ФНС, РНП, госконтракты — источник временно недоступен\./);
  assert.match(h, /Не проверено — не значит «не обнаружено»/);
  assert.match(h, /<a href="https:\/\/kad\.arbitr\.ru\/" target="_blank" rel="noopener">проверьте сами<\/a>/);
  const r = otvet(); for (const k of Object.keys(r.damia)) if (r.damia[k].status) r.damia[k].status = 'not_found';
  assert.ok(!/Не проверяли/.test(S.html(r)));
});

test('глубина: разделы досье без комментариев, источник раздела, даты наборов', () => {
  const g = S.glubina(otvet());
  assert.deepStrictEqual(g.razdely.map((s) => s.zag), ['Профиль', 'Руководство и собственники', 'Финансовая динамика по годам', 'Внешние реестры', 'Из чего сложился прогноз ЗСК']);
  assert.strictEqual(g.razdely[0].ist, 'ЕГРЮЛ, на 02.10.2026');
  assert.strictEqual(g.razdely[2].ist, 'ГИР БО ФНС, годовая бухгалтерская отчётность', 'строка «Источник» стала подписью');
  assert.ok(!g.razdely[2].stroki.some((x) => x[0] === 'Источник'));
  const h = S.html(otvet());
  assert.match(h, /<details class="sut__g"><summary><span>Все данные из реестров<\/span><small>5\u00a0разделов<\/small><\/summary>/);
  assert.match(h, /Даты наборов: ЕГРЮЛ\/ЕГРИП — на 29\.09\.2026/);
  assert.ok(!/однодневк/.test(h), 'комментарии досье в глубину не берём — только данные');
  assert.ok(!/NaN|undefined|Infinity|\[object/.test(h));
});

test('ИП: без адреса, руководителя и отчётности; реестр — ЕГРИП', () => {
  const r = otvet({ company: { inn: '500100732259', kind: 'INDIVIDUAL', status: 'ACTIVE', reg_date: '2020-01-15', director_name: 'Петров Пётр Петрович', director_since: '2020-01-15', address: 'г Химки, ул Лесная, д 5' } });
  r.signals[0].source = 'ЕГРЮЛ/ЕГРИП';
  const f = S.fakty(r);
  assert.deepStrictEqual(f.spisok.map((x) => x.k), ['status', 'tax_debt', 'age', 'zsk']);
  assert.strictEqual(f.spisok[0].ist, 'ЕГРИП');
  const h = S.html(r);
  assert.ok(!/Петров|Химки|Лесная|Примерная|Иванов/.test(h), 'нет ФИО и адресов человека');
});

test('экранирование и пустые ответы', () => {
  const r = otvet();
  r.signals[0].detail = '<img src=x onerror=alert(1)>';
  assert.ok(!/<img/.test(S.html(r)));
  assert.strictEqual(S.html({}), '');
  assert.strictEqual(S.html(null), '');
  assert.strictEqual(S.mount(null, otvet()), false);
});

test('тексты модуля — без запрещённых слов и обещаний исхода', () => {
  const src = fs.readFileSync(path.join(KOREN, 'js/sushchestvennoe.js'), 'utf8').replace(/^\s*\/\*[\s\S]*?\*\//m, '');
  assert.ok(!/надёжн|надежн|гарант|лучш|однодневк|искусственн|нейросет|(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)/i.test(src));
});

test('главная: модуль подключён, вызывается после отрисовки, не в режиме «Щит»', () => {
  const ind = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  assert.match(ind, /<script src="\/js\/sushchestvennoe\.js" defer><\/script>/);
  assert.match(ind, /if\(!svoj&&window\.Sushchestvennoe\)\{try\{Sushchestvennoe\.mount\(report\.querySelector\('\.rows'\),r\)\}catch\(e\)\{\}\}/);
  assert.match(ind, /Прогноз ЗСК · наша оценка/, 'запасная строка без модуля осталась');
});

test('Щит: строки проверки свёрнуты в «Все данные из реестров» — у каждой источник и дата, без повторов', () => {
  const r = otvet();
  r.signals.push({ id: 'mass', title: 'Массовый адрес', status: 'warn', detail: 'Зарегистрировано 54 компании', source: 'ФНС, открытые данные', as_of: '01.09.2026' });
  const h = S.htmlSvoj(r);
  assert.ok(h.startsWith('<details class="sut__g"><summary>'), 'свёрнуто, без open');
  assert.ok(!/<details[^>]*open/.test(h));
  assert.ok(!/Существенные факты/.test(h), 'в Щите нет второго списка фактов');
  const f = S.fakty(r), n = f.spisok.length + f.eshche.length;
  assert.match(h, new RegExp('<small>' + n + '\u00a0признак(а|ов)? · \\d+\u00a0раздел'));
  assert.match(h, /<h4>Признаки из проверки<\/h4>/);
  assert.strictEqual((h.match(/<h4>/g) || []).length, 1 + S.glubina(r).razdely.filter((s) => s.zag !== 'Ещё признаки').length);
  assert.ok(!/Ещё признаки/.test(h), 'признаки — одним разделом');
  assert.match(h, /Массовый адрес<small>ФНС, открытые данные · на\u00a001\.09\.2026<\/small>/);
  assert.match(h, /Не проверяли в этот раз: /);
  assert.match(h, /проверьте сами/, 'ссылка на сервис ЦБ у прогноза ЗСК');
  assert.ok(!/однодневк|NaN|undefined|\[object/.test(h));
});

test('Щит, ИП: в свёрнутых данных нет ФИО и адреса', () => {
  const r = otvet({ company: { inn: '500100732259', kind: 'INDIVIDUAL', status: 'ACTIVE', reg_date: '2020-01-15', director_name: 'Петров Пётр Петрович', address: 'г Химки, ул Лесная, д 5' } });
  const h = S.htmlSvoj(r);
  assert.ok(h.length > 0);
  assert.ok(!/Петров|Химки|Лесная|Примерная|Иванов/.test(h));
  assert.strictEqual(S.htmlSvoj({}), '');
  assert.strictEqual(S.mountSvoj(null, otvet()), false);
});

test('главная: в режиме «Щит» строки сворачиваются после разбора, только если разбор построен', () => {
  const ind = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  const i1 = ind.indexOf('shR=Shchit.mount(ub,r)'), i2 = ind.indexOf("Sushchestvennoe.mountSvoj(report.querySelector('.rows'),r,ub)");
  assert.ok(i1 > 0 && i2 > i1, 'после Shchit.mount');
  assert.match(ind, /if\(svoj&&shR&&window\.Sushchestvennoe\)\{try\{Sushchestvennoe\.mountSvoj/);
});
