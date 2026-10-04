// [Ночные-3] indeks-v-otchete-v1 (+ v1.1 — приёмка [Продукт · Данные] 03.10 15:55): Индекс в проверке без ожидания API — ответ /api/check → факты открытой методики v1.0 → число
// (ТЗ [Продукт · Данные и Индекс] 03.10 13:35, разд. 1.6 (а)–(ж); Планёрка 03.10 (а)). node --test tests/indeks_otvet.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const K = path.join(__dirname, '..');
const IO = require('../js/indeks-otvet.js');
const KALK = require('../indeks/indeks.js');
const M = require('../indeks/metodika-v1.json');
const NB = ' ';

// «чистая компания» — та же форма, что фикстура tests/sushchestvennoe.test.js (поля и тексты — как у API; компания вымышленная)
function otvet(over) {
  return Object.assign({
    company: { inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2015-03-10', invalid: false, address_invalid: false },
    risk_level: 'low', checked_at: '2026-10-01T22:30:00Z',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ', as_of: null },
      { id: 'age', title: 'Возраст компании', status: 'ok', detail: 'С 10.03.2015', source: 'ЕГРЮЛ', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' },
    ],
    damia: { sudy: { status: 'ne_provereno' }, fssp: { status: 'ne_provereno' }, bankrotstvo: { status: 'ne_provereno' }, rnp: { status: 'ne_provereno' } },
    dossier: { kpi: [{ label: 'Выручка за 2025', value: 48.2e6 }],
      charts: { revenue: [{ year: 2024, value: 40e6 }, { year: 2025, value: 48.2e6 }], profit: [{ year: 2025, value: -1.5e6 }] } },
  }, over || {});
}
const s = (title, detail, status, o) => Object.assign({ id: 'x', title, detail, status, source: 'ЕГРЮЛ', as_of: null }, o || {});
const s_ = (r, ...x) => { r.signals = r.signals.concat(x); return r; };

test('(б) чистая компания: 72 + «больше 10 лет» +3 = 75, полнота 75 %, 3 из 7 источников', () => {
  const v = IO.vid(otvet());
  assert.strictEqual(v.rezhim, 'chislo');
  assert.strictEqual(v.ball, 75);
  assert.strictEqual(v.polnota, 75);
  assert.strictEqual(v.istochnikov, 3);
  assert.strictEqual(v.uroven, 'Без серьёзных сигналов');
  assert.deepStrictEqual(v.vklady.map((x) => x.id), ['vozrast_10g']);
  assert.strictEqual(IO.podpis(v), 'По открытой методике v' + M.versiya + ' · 3' + NB + 'из' + NB + '7 источников · полнота 75' + NB + '%');
});

test('браузер = калькулятор /indeks/ (тот же indeks.js = indeks_v1.py): число из фактов ответа совпадает с прямым расчётом', () => {
  const r = s_(otvet(), s('Массовый руководитель', '12 компаний', 'warn'), s('Среднесписочная численность', '0 человек за 2025 год', 'warn', { source: 'ФНС, открытые данные', as_of: '01.09.2026' }));
  const x = IO.izOtveta(r);
  assert.deepStrictEqual(Object.keys(x.fakty).filter((k) => x.fakty[k]).sort(), ['massovyj_rukovoditel', 'shtat_0_1', 'vozrast_10g']);
  const pryamo = KALK.rasschitat(M, x.fakty, x.dostupno);
  assert.strictEqual(IO.vid(r).ball, pryamo.indeks);
  assert.strictEqual(pryamo.indeks, 72 - 10 - 8 + 3);
});

// (а) все строки NA_ZHIVOM из tests/kommentarii.test.js → фактор методики, «нейтрально» или «числа нет» (неизвестный сигнал)
const NA_ZHIVOM = (() => {
  const t = fs.readFileSync(path.join(__dirname, 'kommentarii.test.js'), 'utf8');
  const a = t.indexOf('const NA_ZHIVOM = ['), b = t.indexOf('];', a) + 2;
  return Function(t.slice(a, b).replace('const NA_ZHIVOM =', 'return'))();
})();
const OZH = {
  'Недостоверность адреса или руководителя|есть отметка о недостоверности адреса': 'nedostovernyj_adres',
  'Адрес|сведения недостоверны (отметка ФНС)': 'nedostovernyj_adres',
  'Адрес|массовый адрес: 54 компании': 'massovyj_adres',
  'Массовый руководитель|12 компаний': 'massovyj_rukovoditel',
  'Массовый адрес или руководитель|да': 'massovyj_adres',
  'Задолженность по налогам|1,2 млн ₽': 'nedoimka',
  'Приостановление операций по счетам|2 решения': 'blokirovka_fns',
  'ФССП|3 производства на 410 000 ₽': 'NEIZV',
  'Статус|Банкротство': 'bankrotstvo',
  'Статус|Ликвидирована': 'likvidirovana',
  'Статус|Исключение из ЕГРЮЛ (недействующая)': 'reshenie_ob_isklyuchenii',
  'Статус|Компания ликвидируется или ФНС готовит её исключение из ЕГРЮЛ': 'reshenie_ob_isklyuchenii',
  'Статус|Компания исключена из ЕГРЮЛ': 'likvidirovana',
  'Компания исключена из ЕГРЮЛ|': 'likvidirovana',
  'Статус|Юрлицо исключено из ЕГРЮЛ как недействующее': 'likvidirovana',
  'Статус|ФНС исключила компанию из ЕГРЮЛ': 'likvidirovana',
  'Среднесписочная численность|0 человек за 2025 год': 'shtat_0_1',
  'Среднесписочная численность|14 человек за 2025 год': 'shtat_10',
  'Доходы и расходы|отчётность за 2025 год не сдана': 'net_buhotchetnosti',
  'Низкая налоговая нагрузка|0,4 % при норме 2,1 %': '', // не берём до налогов без взносов — в «Не учитывали»
  'Прогноз ЗСК (наша оценка): высокий уровень риска|': '', // наша оценка — фактом рядом, не в балл
  'Красная группа ЗСК Банка России|': 'NEIZV',
  'Дисквалификация руководителя|да': 'diskvalifikaciya',
};
test('(а) живые строки /api/check → фактор методики, «нейтрально» или «числа нет»', () => {
  const b0 = IO.izOtveta(otvet()).fakty;
  assert.ok(NA_ZHIVOM.length >= 27);
  for (const [[title, detail, status]] of NA_ZHIVOM) {
    const x = IO.izOtveta(s_(otvet(), s(title, detail, status)));
    const nov = Object.keys(x.fakty).filter((k) => x.fakty[k] && !b0[k]);
    const kl = title + '|' + detail, gde = kl + ' · ' + status;
    let ozh = OZH[kl];
    if (ozh === undefined) ozh = /исключени|упрощ/i.test(kl) ? 'reshenie_ob_isklyuchenii' : '';
    if (status === 'ok') ozh = '';
    if (ozh === 'NEIZV') { assert.ok(x.neizvestnye.length, gde); continue; }
    assert.strictEqual(x.neizvestnye.length, 0, gde);
    assert.deepStrictEqual(nov, ozh ? [ozh] : [], gde);
  }
});

test('(в) неизвестная warn/bad-строка → числа нет, текст «считаем»; сигнал остаётся в фактах', () => {
  const v = IO.vid(s_(otvet(), s('Связи с компаниями из реестра иноагентов', 'да', 'warn')));
  assert.strictEqual(v.rezhim, 'neizv');
  assert.strictEqual(v.ball, undefined);
  const h = IO.htmlKolonka(v);
  assert.ok(h.includes('Индекс — считаем') && h.includes('методика v1 пока не' + NB + 'оценивает'));
  assert.ok(!/ot-ix__big/.test(h));
});

test('минус из неподключённого источника (приставы без DaMIA) — числа нет, а не завышенное число', () => {
  const r = s_(otvet(), s('Долги у приставов', '12 млн ₽', 'bad', { source: 'ФССП' }));
  assert.strictEqual(IO.vid(r).rezhim, 'neizv');
  r.damia.fssp.status = 'provereno';
  const v = IO.vid(r);
  assert.strictEqual(v.rezhim, 'chislo');
  assert.ok(v.vklady.some((x) => x.id === 'pristavy_krupnye'));
});

test('(г) полнота < 60 % → ни числа, ни уровня: «Собрано N % данных…» (v1.1)', () => {
  const r = otvet();
  r.signals[3].as_of = '01.05.2026'; // набор ФНС старше 3 месяцев → fns не учтён: 30 + 20 = 50 %
  const v = IO.vid(r);
  assert.strictEqual(v.rezhim, 'sokr');
  assert.strictEqual(v.polnota, 50);
  assert.strictEqual(v.uroven, undefined);
  const h = IO.htmlKolonka(v);
  assert.ok(h.includes('Индекс — данных пока' + NB + 'мало'));
  assert.ok(h.includes('Собрано 50' + NB + '% данных — число и' + NB + 'уровень покажем, когда наберётся 60' + NB + '%.'));
  assert.ok(h.includes('Не хватает: налоги и штат — свежего набора ФНС'));
  assert.ok(!/ot-ix__big/.test(h));
  assert.ok(!/ot-ix__lv--/.test(h));
  // граница: «дата набора + 3 месяца» включительно — ещё свежий
  const r2 = otvet({ checked_at: '2026-12-01T09:00:00Z' });
  assert.strictEqual(IO.izOtveta(r2).dostupno.fns, true);
  const r3 = otvet({ checked_at: '2026-12-02T09:00:00Z' });
  assert.strictEqual(IO.izOtveta(r3).dostupno.fns, false);
});

test('бухотчётность: «не раскрыта» — не источник (не «0»); «не сдана» — источник ответил', () => {
  const r = otvet(); r.dossier.charts = {};
  assert.strictEqual(IO.izOtveta(r).dostupno.girbo, false);
  s_(r, s('Доходы и расходы', 'отчётность за 2025 год не сдана', 'warn'));
  const x = IO.izOtveta(r);
  assert.strictEqual(x.dostupno.girbo, true);
  assert.ok(x.fakty.net_buhotchetnosti);
});

test('(д) серверное число главнее: r.indeks есть — браузер не считает; лист показывает 40', () => {
  const r = otvet({ indeks: 40, polnota: 80 });
  assert.strictEqual(IO.vid(r).rezhim, 'server');
  const O = require('../js/otchet.js');
  const h = O.htmlIndeksIz(r, IO);
  assert.ok(/ot-ix__big n">40</.test(h));
  assert.ok(!h.includes('По открытой методике'));
  // нет серверного числа — колонку даёт браузер
  const h2 = O.htmlIndeksIz(otvet(), IO);
  assert.ok(/ot-ix__big n">75</.test(h2) && h2.includes('Почему 75') && h2.includes('<a href="/indeks/">методика</a>'));
  assert.ok(h2.includes('Не учитывали в этот раз: суды, приставы, банкротство, закупки — источник не' + NB + 'подключён'));
  assert.ok(h2.includes('Не проверено — не значит «не обнаружено».'));
  // модуля нет — как раньше: «считаем»
  assert.ok(O.htmlIndeksIz(otvet(), null).includes('Индекс — считаем'));
  // dossier.score — никогда
  assert.strictEqual(IO.vid(otvet({ dossier: { score: 91 } })).ball === 91, false);
});

test('(е) двусмысленный «Статус» → не «Стоп», потолок 25; однозначный — «Стоп»', () => {
  const r = s_(otvet(), s('Статус', 'Компания ликвидируется или ФНС готовит её исключение из ЕГРЮЛ', 'bad'));
  r.signals.splice(0, 1);
  const v = IO.vid(r);
  assert.strictEqual(v.rezhim, 'chislo');
  assert.ok(v.ball <= 25);
  assert.strictEqual(v.potolok.znachenie, 25);
  const L = otvet(); L.company.status = 'LIQUIDATING'; L.company.state_code = '101';
  const vs = IO.vid(L);
  assert.strictEqual(vs.rezhim, 'stop');
  assert.strictEqual(vs.stop, 'Компания в процессе ликвидации');
  assert.ok(IO.htmlKolonka(vs).includes('Стоп'));
  const I = otvet(); I.company.status = 'LIQUIDATING'; I.company.state_code = '105';
  assert.strictEqual(IO.vid(I).rezhim, 'chislo');
  const X = otvet(); X.company.status = 'LIQUIDATING'; // кода нет — двусмысленно
  assert.strictEqual(IO.vid(X).rezhim, 'chislo');
});

test('ИП — числа нет; ряды ГИР БО: убыток 2 года, капитал меньше нуля, выручка упала вдвое', () => {
  assert.strictEqual(IO.vid(otvet({ company: { inn: '770000000012', kind: 'INDIVIDUAL' } })).rezhim, 'ip');
  const r = otvet();
  r.dossier.charts = { revenue: [{ year: 2024, value: 100e6 }, { year: 2025, value: 40e6 }], profit: [{ year: 2024, value: -1 }, { year: 2025, value: -2 }], balance: { year: 2025, equity: -5e6 } };
  const f = IO.izOtveta(r).fakty;
  assert.ok(f.ubytok_2_goda && f.chistye_aktivy_minus && f.vyruchka_upala);
  assert.strictEqual(IO.rubli('1,2 млн ₽'), 1.2e6);
  assert.strictEqual(IO.rubli('410 000 ₽'), 410000);
});

test('«Что изменилось»: «Индекс: 75 → 59 с проверки 30.09» (снимок только в браузере)', () => {
  const D = require('../js/dinamika.js');
  const a = D.snimok(otvet({ checked_at: '2026-09-30T09:00:00Z' }));
  const b = D.snimok(s_(otvet(), s('Массовый руководитель', '12 компаний', 'warn'), s('Адрес', 'массовый адрес: 54 компании', 'warn')));
  assert.strictEqual(a.ix, 75);
  assert.strictEqual(b.ix, 59);
  const izm = D.sravnit(a, b);
  assert.ok(izm.some((x) => x.ton === 'huzhe' && x.t === 'Индекс: 75 → 59 с' + NB + 'проверки 30.09'), JSON.stringify(izm));
  assert.strictEqual(D.snimok(otvet({ indeks: 40, polnota: 80 })).ix, 40, 'серверное число — в снимок');
  assert.strictEqual(D.snimok(s_(otvet(), s('Красная группа ЗСК Банка России', '', 'bad'))).ix, undefined, 'без числа — без строки');
});

test('Паспорт: без серверного числа — балл по открытой методике и «Как считали»; серверное с малой полнотой — «считаем»', () => {
  const P = require('../js/pasport-kontragenta.js');
  const U = require('../js/usloviya.js');
  const IV = require('../js/indeks-vorota.js');
  const p = P.sobrat(otvet(), { usloviya: U, indeksVorota: IV, indeksOtvet: IO });
  const ix = p.razdely.find((x) => x.id === 'indeks');
  assert.strictEqual(p.meta.indeks.ball, 75);
  assert.ok(ix.fakty.some((f) => f.tekst === 'Балл' && f.znachenie === '75 из 99 — Без серьёзных сигналов'));
  assert.ok(ix.fakty.some((f) => f.tekst === 'Как считали' && new RegExp('^По открытой методике v' + M.versiya.replace(/\./g, '\\.') + ' · 3.из.7 источников: база 72, компании больше 10 лет \\+3\\.$').test(f.znachenie)));
  const p2 = P.sobrat(otvet({ indeks: 72, polnota: 40 }), { usloviya: U, indeksVorota: IV, indeksOtvet: IO });
  assert.strictEqual(p2.meta.indeks.ball, null);
  const p3 = P.sobrat(otvet(), { usloviya: U, indeksVorota: IV });
  assert.strictEqual(p3.meta.indeks.ball, null, 'без модуля — как раньше');
});

test('(ж) 222-ФЗ и 38-ФЗ: в модуле нет «надёжн», «вероятн», «шанс», «лучш»; карточки /company/ модуль не грузят', () => {
  const t = fs.readFileSync(path.join(K, 'js/indeks-otvet.js'), 'utf8');
  for (const w of ['надёжн', 'надежн', 'вероятн', 'шанс', 'лучш', 'гарант']) assert.ok(!t.toLowerCase().includes(w), w);
  const html = fs.readFileSync(path.join(K, 'index.html'), 'utf8');
  assert.ok(html.indexOf('/indeks/indeks.js') < html.indexOf('/js/indeks-otvet.js') && html.indexOf('/js/indeks-otvet.js') < html.indexOf('/js/otchet.js'));
  const pk = fs.readFileSync(path.join(K, 'pasport/kontragent/index.html'), 'utf8');
  assert.ok(pk.includes('<script src="/js/indeks-otvet.js"></script>') && pk.includes('zhdatMetodiku('));
  const comp = path.join(K, 'company');
  for (const d of fs.readdirSync(comp)) {
    const f = path.join(comp, d, 'index.html');
    if (fs.existsSync(f)) assert.ok(!fs.readFileSync(f, 'utf8').includes('indeks-otvet'), d);
  }
});

// v1.1 — приёмка [Продукт · Данные и Индекс] 03.10 15:55: «сокращённые данные» не ругают компанию без сигналов
test('v1.1 «Сбер»: 4 зелёные строки, отчётности в ответе нет → sokr 55 %, ни одного названия уровня, без тона', () => {
  const r = otvet(); r.dossier.charts = {};
  const v = IO.vid(r);
  assert.strictEqual(v.rezhim, 'sokr');
  assert.strictEqual(v.polnota, 55);
  const h = IO.htmlKolonka(v);
  const pr = IO.txtSokr(v) + '.';
  M.urovni.forEach((u) => {
    assert.ok(!h.includes(u.nazvanie), 'в колонке нет уровня «' + u.nazvanie + '»');
    assert.ok(!pr.includes(u.nazvanie), 'в Паспорте нет уровня «' + u.nazvanie + '»');
  });
  assert.ok(!/ot-ix__lv--/.test(h));
  assert.ok(h.includes('Не хватает: бухотчётность — за' + NB + 'прошлый год в' + NB + 'ответе её нет.'));
  assert.ok(!/не\sподключён/.test(IO.neHvataet(v)));
  assert.strictEqual(IO.ball(r), null);
});

test('v1.1 источник «ФНС» — только открытые наборы: свежая дисквалификация не засчитывает старый набор долгов', () => {
  const r = otvet();
  r.signals[3].as_of = '01.05.2026';
  s_(r, s('Дисквалифицированные лица', 'Нет', 'ok', { source: 'ФНС, реестр дисквалифицированных лиц', as_of: '27.09.2026' }),
    s('Приостановление операций по счетам', 'Нет', 'ok', { source: 'Сервис ФНС', as_of: '01.10.2026' }));
  assert.strictEqual(IO.izOtveta(r).dostupno.fns, false);
  r.signals[3].as_of = '01.09.2026';
  assert.strictEqual(IO.izOtveta(r).dostupno.fns, true);
});

// v1.2 — [Право · Юрист 115-ФЗ] 03.10 16:07, разд. 1 п. 1 и п. 4
test('v1.2 заголовок «Индекс — данных пока мало»; «по сокращённым данным» на экране проверки нет', () => {
  const r = otvet(); r.dossier.charts = {};
  const h = IO.htmlKolonka(IO.vid(r));
  assert.ok(h.includes('<div class="ot-ix__ne">Индекс — данных пока' + NB + 'мало</div>'));
  assert.ok(!/сокращённ/.test(h));
  assert.ok(!/сокращённ/.test(fs.readFileSync(path.join(K, 'js', 'indeks-otvet.js'), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), 'в коде (без комментариев) нет «сокращённ»');
});

test('v1.2 банк (ОКВЭД 64.19) без ГИР БО: «организация сдаёт её в Банк России, а не в ГИР БО» — без «её нет»', () => {
  const r = otvet(); r.dossier.charts = {}; r.company.okved = '64.19';
  const v = IO.vid(r);
  assert.strictEqual(v.rezhim, 'sokr');
  const h = IO.htmlKolonka(v);
  assert.ok(h.includes('Не хватает: бухотчётность — организация сдаёт её в' + NB + 'Банк России, а не в' + NB + 'ГИР' + NB + 'БО.'));
  assert.ok(!h.includes('ответе её нет'));
  assert.ok(IO.strokaNe(v).includes('Банк России'));
  // не банк (64.9x — прочие финансовые услуги) — прежняя строка
  r.company.okved = '64.92';
  assert.ok(IO.htmlKolonka(IO.vid(r)).includes('прошлый год в' + NB + 'ответе её нет'));
});

test('v1.2 проверка банка совпадает с bank(c) из js/sushchestvennoe.js', () => {
  const S = require('../js/sushchestvennoe.js');
  ['64.19', '64.1', '64.11', '64.92', '65.12', '', undefined].forEach((ok) => {
    const r = otvet(); r.dossier.charts = {}; if (ok !== undefined) r.company.okved = ok;
    const banka = /Банк России/.test(IO.strokaNe(IO.vid(r)));
    assert.strictEqual(banka, S.bank(r.company), 'ОКВЭД ' + ok);
  });
});
