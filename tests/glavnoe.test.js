// pervyj-ekran-otcheta-v1 [Ночные запуски] 18.11: «Главное» на первом экране отчёта (решение владельца 18.11, разд. 3 пп. 1–2).
// Форма ответа — живой /api/check 18.11 01:05 (ПАО «Магнит»: 3 незавершённых дела на 35 905 ₽ при выручке 412 млн ₽ за 2024).
// Компании ниже вымышленные. node --test tests/glavnoe.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const PM = require('../js/plyusy-minusy.js');
const G = require('../js/glavnoe.js');
const bez = (t) => String(t).replace(/[ ⁠]/g, ' ');
const SEG = new Date('2026-11-18T01:00:00+03:00');

function otvet(o) {
  o = o || {};
  return {
    company: Object.assign({ inn: '7700000001', kind: 'LEGAL', name_short: 'ООО "ОБРАЗЕЦ"', status: 'ACTIVE', reg_date: '2007-10-24', okved: '47.11' }, o.company || {}),
    checked_at: '2026-11-18T01:05:00+03:00', risk_level: 'low',
    signals: o.signals || [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП' },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Нет', source: 'ЕГРЮЛ' },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '2026-10-01' }
    ],
    damia: o.damia || {
      sudy: { nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через Checko)', sostoyanie: 'found', data_svedeniy: '2026-11-12T23:38+03:00',
        dannye: { otvetchik_nezaversheno: 3, otvetchik_summa_nezaversheno: 35905 } },
      fssp: { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', sostoyanie: 'not_found', data_svedeniy: '2026-11-12T23:38+03:00', dannye: { otkryto: 0, ostatok: 0 } }
    },
    dengi: o.dengi === undefined ? { vyruchka: { summa: 412062000, god: 2024 }, sostavlyayushchie: [{ vid: 'nedoimka', summa: 0 }] } : o.dengi,
    dossier: { strengths: [], concerns: [], kpi: [], charts: {} }
  };
}

test('мелкий иск (< 0,1 % выручки) — не в главном, а строкой «Небольшие суммы (меньше 0,1 % выручки за год)»; свободные места — плюсы', () => {
  const g = G.sobrat(otvet(), SEG, PM);
  assert.strictEqual(g.glavnoe.length, 3);
  assert.ok(g.glavnoe.every((x) => x.znak === 'plus'), 'одни плюсы');
  assert.strictEqual(g.melkoe.length, 1);
  assert.strictEqual(bez(g.melkoe[0].dolya), 'меньше 0,1 % выручки за 2024 год');
  const h = bez(G.html(g));
  // nalog-ostatok-otcheta-v1 (юрист 18.11, разд. 2 «мелочь вслух не пишем»): подпись — как на карточках, доля в подписи, не у строки
  assert.match(h, /Небольшие суммы \(меньше 0,1 % выручки за 2024 год\):<\/span> 3 незавершённых дела/);
  assert.ok(!/Мелкое/.test(h), 'слова «Мелкое» больше нет');
  assert.ok(!/\(меньше 0,1 % выручки за 2024 год\)<\/p>/.test(h), 'доля не повторяется у строки');
  assert.match(h, /Все плюсы и минусы: \d+ и 1 ↓/);
});

test('крупный иск (≥ 10 % выручки) — первым, с долей; приостановка счетов — всегда в главном', () => {
  const r = otvet();
  r.damia.sudy.dannye.otvetchik_summa_nezaversheno = 206031000; // 50 %
  r.damia.priostanovki = { nazvanie: 'Счета: решения ФНС о приостановлении', istochnik: 'ФНС', sostoyanie: 'found', data_svedeniy: '2026-11-17' };
  const g = G.sobrat(r, SEG, PM);
  assert.deepStrictEqual(g.glavnoe.slice(0, 2).map((x) => x.k).sort(), ['damia_priostanovki', 'damia_sudy']);
  const s = g.glavnoe.filter((x) => x.k === 'damia_sudy')[0];
  assert.strictEqual(bez(s.dolya), '50 % выручки за 2024 год');
  assert.strictEqual(g.melkoe.length, 0);
});

test('доли: 0,6 %, 12 %, «больше выручки»; без выручки, у банка и у ИП — доли нет', () => {
  assert.strictEqual(bez(G.dolyaTekst(0.0057, 2025)), '0,6 % выручки за 2025 год');
  assert.strictEqual(bez(G.dolyaTekst(0.123, 2025)), '12 % выручки за 2025 год');
  assert.strictEqual(bez(G.dolyaTekst(1.7, 2025)), 'больше выручки за 2025 год');
  const r = otvet({ dengi: null });
  const g = G.sobrat(r, SEG, PM);
  assert.ok(g.glavnoe.some((x) => x.k === 'damia_sudy' && x.dolya === ''), 'без выручки иск — в главном, без доли');
  assert.strictEqual(G.vyruchka(otvet({ company: { okved: '64.19' } }), SEG), null, 'банк');
  assert.strictEqual(G.vyruchka(otvet({ company: { inn: '770000000001', kind: 'INDIVIDUAL' } }), SEG), null, 'ИП');
  assert.strictEqual(G.vyruchka(otvet({ dengi: { vyruchka: { summa: 1e9, god: 2023 } } }), SEG), null, 'отчёт старше двух лет');
});

test('слова строк — те же, что в «Плюсах и минусах» (новых утверждений нет)', () => {
  const r = otvet();
  const S = PM.sobrat(r, SEG), g = G.sobrat(r, SEG, PM);
  const vse = S.plyusy.concat(S.minusy).map((x) => x.t);
  g.glavnoe.concat(g.melkoe).forEach((x) => assert.ok(vse.indexOf(x.t) >= 0, x.t));
});

test('главная: модуль в пакете otchet и вызывается после «Плюсов и минусов», только для чужой компании', () => {
  const kor = path.join(__dirname, '..');
  const karta = JSON.parse(fs.readFileSync(path.join(kor, 'partials/sborka.json'), 'utf8'));
  assert.ok(karta.pakety.otchet.indexOf('js/glavnoe.js') > karta.pakety.otchet.indexOf('js/plyusy-minusy.js'));
  const ix = fs.readFileSync(path.join(kor, 'index.html'), 'utf8');
  const a = ix.indexOf('PlyusyMinusy.mount(report,r)'), b = ix.indexOf('DlkGlavnoe.mount(report,r)');
  assert.ok(a > 0 && b > a);
  assert.match(ix, /if\(!svoj&&window\.DlkGlavnoe\)/);
});

test('без оценок компании и без «ИИ»: запрещённые слова в модуле', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'js/glavnoe.js'), 'utf8');
  assert.ok(!/надёжн|благонадёжн|рекомендуем|нет долгов|\bИИ\b|нейросет/i.test(js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
});

// nol-pristavy-v1 [Ночные запуски] 18.11 02:10: живой /api/check ПАО «Газпром» — 2 производства неимущественного характера,
// ostatok 0, ostatok_tochno true; раньше строка «Производства у приставов: 2» (без суммы) шла в «Главном» как долг неизвестного размера.
test('точный ноль у приставов: «остаток долга — 0 ₽», вес ниже денег от 0,1 % выручки, в «Мелкое к выручке» не попадает', () => {
  const r = otvet();
  r.damia.fssp = { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', sostoyanie: 'found', data_svedeniy: '2026-11-12T23:38+03:00',
    dannye: { otkryto: 2, ostatok: 0, ostatok_ohvat: 'vse', ostatok_tochno: true } };
  r.damia.sudy.dannye.otvetchik_summa_nezaversheno = 8241240; // 2 % — выше нуля у приставов (иски существенны от 1 %, pravo-sdelka-v1)
  const g = G.sobrat(r, SEG, PM);
  assert.deepStrictEqual(g.glavnoe.slice(0, 2).map((x) => x.k), ['damia_sudy', 'damia_fssp']);
  const f = g.glavnoe[1];
  assert.strictEqual(bez(f.t), 'Производства у приставов: 2, остаток долга — 0 ₽');
  assert.strictEqual(f.dolya, '');
  assert.strictEqual(g.melkoe.length, 0);
});

test('ноль не точный или по части производств — остаток не пишем, вес как у неизвестной суммы', () => {
  [{ ostatok_tochno: false, ostatok_ohvat: 'vse' }, { ostatok_tochno: true, ostatok_ohvat: 'pervye_20' }, {}].forEach((o) => {
    const r = otvet();
    r.damia.fssp = { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', sostoyanie: 'found', data_svedeniy: '2026-11-12',
      dannye: Object.assign({ otkryto: 2, ostatok: 0 }, o) };
    const g = G.sobrat(r, SEG, PM);
    const f = g.glavnoe.filter((x) => x.k === 'damia_fssp')[0];
    assert.ok(f, JSON.stringify(o));
    assert.strictEqual(bez(f.t), 'Производства у приставов: 2');
    assert.strictEqual(g.glavnoe[0].k, 'damia_fssp');
  });
});

// itog-glavnoe-v1 [Ночные запуски] 18.11: итог одной строкой словами юриста 18.11 02:10 (п. 2) + «Не проверяли» + порог «существенно»
const ZAPRET = /надёжн|надежн|чист[аяо]|можно платить|безопасн/i;

test('itog-glavnoe-v1: только мелкое — «Существенных минусов не нашли — по K проверенным источникам на дату», порог с годом выручки', () => {
  const g = G.sobrat(otvet(), SEG, PM);
  assert.strictEqual(g.itog.vid, 'net');
  assert.strictEqual(bez(g.itog.t), 'Существенных минусов не нашли — по 4 проверенным источникам на 18.11.2026');
  assert.match(bez(g.itog.porog), /^Существенно — сумма от 0,1 % выручки за 2024 год \(ГИР БО\) или событие без суммы: банкротство/);
  const h = bez(G.html(g));
  assert.match(h, /data-itog="net"/);
  assert.ok(h.indexOf('gl1__i') < h.indexOf('gl1__l'), 'итог — над фактами');
  assert.doesNotMatch(h, ZAPRET);
});

test('itog-glavnoe-v1: иск от 0,1 % выручки и приостановка — «Есть 2 существенных минуса на дату»; один — «существенный минус»', () => {
  const r = otvet();
  r.damia.sudy.dannye.otvetchik_summa_nezaversheno = 4120620; // 1 %
  let g = G.sobrat(r, SEG, PM);
  assert.strictEqual(g.itog.vid, 'est');
  assert.strictEqual(bez(g.itog.t), 'Есть 1 существенный минус на 18.11.2026');
  r.damia.priostanovki = { nazvanie: 'Счета: решения ФНС о приостановлении', istochnik: 'ФНС', sostoyanie: 'found', data_svedeniy: '2026-11-17' };
  g = G.sobrat(r, SEG, PM);
  assert.strictEqual(bez(g.itog.t), 'Есть 2 существенных минуса на 18.11.2026');
  assert.doesNotMatch(bez(G.html(g)), ZAPRET);
});

test('itog-glavnoe-v1: сумму не с чем сравнить (нет выручки) — не «не нашли», а счёт плюсов и минусов + «Масштаб не посчитать»', () => {
  const g = G.sobrat(otvet({ dengi: null }), SEG, PM);
  assert.strictEqual(g.itog.vid, 'schet');
  assert.match(bez(g.itog.t), /^Плюсов \d+, минусов 1 — по 4 проверенным источникам на 18\.11\.2026$/);
  assert.strictEqual(bez(g.itog.masshtab), 'Масштаб не посчитать: выручка за 2025 год в открытых данных не найдена');
  assert.strictEqual(g.itog.porog, '');
  assert.doesNotMatch(bez(G.html(g)), /Существенн/);
});

test('itog-glavnoe-v1: минус без суммы (нет сотрудников) — тоже не «не нашли»', () => {
  const r = otvet();
  r.signals.push({ id: 'employees', title: 'Сотрудники', status: 'warn', detail: '0', source: 'ФНС, открытые данные', as_of: '2025-12-31' });
  const g = G.sobrat(r, SEG, PM);
  assert.strictEqual(g.itog.vid, 'schet');
});

test('itog-glavnoe-v1: реестр не ответил — «Не проверяли: …» сразу под итогом и не в счёте источников', () => {
  const r = otvet();
  r.damia.mery = { nazvanie: 'ФНС: обеспечительные меры', istochnik: 'ФНС', sostoyanie: 'not_checked' };
  r.damia.rnp = { nazvanie: 'РНП', istochnik: 'ЕИС', sostoyanie: 'not_checked' };
  const g = G.sobrat(r, SEG, PM);
  assert.strictEqual(bez(g.itog.t), 'Существенных минусов не нашли — по 4 проверенным источникам на 18.11.2026');
  assert.deepStrictEqual(g.itog.ne.map(bez), ['обеспечительные меры ФНС', 'РНП']);
  const h = bez(G.html(g));
  assert.match(h, /<\/p><p class="gl1__ne"><span>Не проверяли:<\/span> обеспечительные меры ФНС, РНП<\/p><ul/);
});

test('itog-glavnoe-v1: один источник — «по 1 проверенному источнику»; ни одного — итога нет', () => {
  const r = otvet({ signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ' }], damia: {} });
  const g = G.sobrat(r, SEG, PM);
  assert.match(bez(g.itog.t), /по 1 проверенному источнику на 18\.11\.2026$/);
  assert.strictEqual(G.istochnikov({ signals: [], damia: {} }, { plyusy: [] }), 0);
});

// nalog-ostatok-otcheta-v1 [Ночные запуски] 18.11 08:05: юрист · налоги 18.11 01:30, разд. 5 — налог меньше 500 ₽ не минус, а остаток
// строкой («Остаток: задолженность по налогам по набору ФНС на {дата} — X ₽»), без нормы. Форма — живой /api/check 18.11 08:10
// (ООО «Экопэт»: tax_debt warn «1 ₽ (недоимка, пени и штрафы)», as_of «01.10.2026», dengi nedoimka 1). Компания ниже вымышленная.
function sNalogom(summa) {
  const r = otvet({ damia: {
    sudy: { nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через Checko)', sostoyanie: 'not_found', data_svedeniy: '2026-11-13T09:15+03:00', dannye: {} },
    fssp: { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', sostoyanie: 'not_found', data_svedeniy: '2026-11-13T09:15+03:00', dannye: { otkryto: 0, ostatok: 0 } } } });
  r.signals[2] = { id: 'tax_debt', title: 'Задолженность по налогам', status: 'warn', detail: summa.toLocaleString('ru-RU') + ' ₽ (недоимка, пени и штрафы)', source: 'ФНС, открытые данные', as_of: '01.10.2026' };
  r.dengi.sostavlyayushchie = [{ vid: 'nedoimka', summa: summa }];
  r.dossier.concerns = ['Налоговый долг ' + summa + ' ₽'];
  return r;
}
test('налог 1 ₽ — не минус: «Остаток: …» под «Не проверяли» в «Главном» и под «Не проверено» в «Плюсах и минусах»; итог «не нашли»', () => {
  const r = sNalogom(1);
  const S = PM.sobrat(r, SEG);
  assert.ok(!S.minusy.some((x) => x.k === 'tax_debt'), 'не в минусах');
  assert.strictEqual(S.ostatok.length, 1);
  assert.strictEqual(bez(S.ostatok[0].t), 'Остаток: задолженность по налогам по набору ФНС на 01.10.2026 — 1 ₽');
  const g = G.sobrat(r, SEG, PM);
  assert.strictEqual(g.itog.vid, 'net');
  const h = bez(G.html(g));
  assert.match(h, /Существенных минусов не нашли/);
  assert.match(h, /<p class="gl1__ne gl1__ost">Остаток: задолженность по налогам по набору ФНС на 01\.10\.2026 — 1 ₽<\/p>/);
  const pm = bez(PM.html(S));
  assert.match(pm, /<p class="pm__ost" data-pm-ost="tax_debt">Остаток: задолженность по налогам по набору ФНС на 01\.10\.2026 — 1 ₽<\/p>/);
  assert.ok(!/Долг по налогам/.test(pm + h), 'слов «Долг по налогам» нет');
  assert.ok(!/ст\.\s*69|ст\.\s*70|норм/i.test(pm + h), 'норму до сверки не пишем');
});
test('налог 499 ₽ — остаток; 500 ₽ и больше — минус «Долг по налогам» с долей выручки, как было', () => {
  assert.strictEqual(PM.sobrat(sNalogom(499), SEG).ostatok.length, 1);
  [500, 412062].forEach((n) => {
    const S = PM.sobrat(sNalogom(n), SEG);
    assert.strictEqual(S.ostatok.length, 0, String(n));
    assert.ok(S.minusy.some((x) => x.k === 'tax_debt' && /^Долг по налогам/.test(bez(x.t))), String(n));
  });
  const g = G.sobrat(sNalogom(412062), SEG, PM);
  const t = g.glavnoe.filter((x) => x.k === 'tax_debt')[0];
  assert.strictEqual(bez(t.dolya), '0,1 % выручки за 2024 год');
});
test('сумма без «Денег на кону» — из detail сигнала; нет суммы — минус, как было (неизвестное не прячем)', () => {
  const r = sNalogom(3);
  r.dengi = null;
  assert.strictEqual(PM.sobrat(r, SEG).ostatok.length, 1);
  r.signals[2].detail = 'Есть задолженность';
  const S = PM.sobrat(r, SEG);
  assert.strictEqual(S.ostatok.length, 0);
  assert.ok(S.minusy.some((x) => x.k === 'tax_debt'));
});

// zapros-glavnoe-v1 [Ночные запуски] 18.11 19:05: «Что запросить по этим минусам» — документы из списка «Условий сделки»
// (js/usloviya.js decide().docs), только те, что отвечают на минус в «Главном» (план 18.11, разд. 4 «перегнать»).
const U = require('../js/usloviya.js');
const zaprosOf = (r) => { const g = G.sobrat(r, SEG, PM); g.zapros = G.zapros(g, U.decide(r).docs); return g; };

test('zapros-glavnoe-v1: каждый документ карты есть в словаре DOCS условий — слова не свои', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'usloviya.js'), 'utf8');
  Object.keys(G.ZAPROS).forEach((k) => G.ZAPROS[k].forEach((id) => assert.match(src, new RegExp('\\n\\s+' + id + ': \\{'), id)));
});

test('zapros-glavnoe-v1: долг по налогам и приостановка — справка КНД 1120101 и отмена решения ФНС, тем же текстом, что в «Что запросить у них»', () => {
  const r = sNalogom(412062);
  r.damia.priostanovki = { nazvanie: 'Счета: решения ФНС о приостановлении', istochnik: 'ФНС', sostoyanie: 'found', data_svedeniy: '2026-11-17' };
  r.signals.push({ id: 'priostanovki', title: 'Приостановка операций по счетам', status: 'bad', detail: 'Есть решение', source: 'ФНС' });
  const docs = U.decide(r).docs;
  const g = zaprosOf(r);
  const ids = g.zapros.map((x) => x.id);
  assert.deepStrictEqual(ids, ['unblock', 'taxCert'], 'по порядку минусов: приостановка выше долга');
  g.zapros.forEach((x) => assert.strictEqual(x.t, docs.filter((d) => d.id === x.id)[0].title, 'текст из DOCS'));
  assert.ok(g.zapros.length <= 3);
  const h = bez(G.html(g));
  assert.match(h, /<p class="gl1__zh">Что можно запросить у компании<\/p>/); // pravo-sdelka-v1: подпись юристов 19.11
  assert.match(h, /Справка об исполнении обязанности по уплате налогов \(КНД 1120101\)/);
  assert.match(h, /<button type="button" class="gl1__zv">Весь список и готовое письмо ↓<\/button>/);
  assert.ok(h.indexOf('gl1__l') < h.indexOf('gl1__z'), 'под фактами');
  assert.doesNotMatch(h, ZAPRET);
});

test('zapros-glavnoe-v1: нет минуса с документом (мелкий иск) — блока нет; налог 1 ₽ (остаток) — справку не просим', () => {
  [otvet(), sNalogom(1)].forEach((r) => {
    const g = zaprosOf(r);
    assert.deepStrictEqual(g.zapros, []);
    assert.doesNotMatch(G.html(g), /gl1__z/);
  });
});

test('zapros-glavnoe-v1: документа нет в списке условий — не показываем (одна правда на странице); без условий — блока нет', () => {
  const r = sNalogom(412062);
  const g = G.sobrat(r, SEG, PM);
  assert.deepStrictEqual(G.zapros(g, [{ id: 'power', title: 'x' }]), []);
  assert.deepStrictEqual(G.zapros(g, null), []);
  assert.deepStrictEqual(G.zapros(null, []), []);
  assert.doesNotMatch(G.html(g), /gl1__z/);
});

test('zapros-glavnoe-v1: приставы и приостановка блоком damia (без сигналов, как в живом ответе) — в «Что запросить у них» и в «Главном»; точный ноль — нет', () => {
  const r = otvet();
  r.damia.fssp = { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', status: 'polucheno', sostoyanie: 'found', data_svedeniy: '2026-11-12',
    dannye: { otkryto: 4, ostatok: 2500000, ostatok_ohvat: 'vse', ostatok_tochno: true } };
  r.damia.priostanovki = { nazvanie: 'Счета: решения ФНС о приостановлении', istochnik: 'ФНС', sostoyanie: 'found', data_svedeniy: '2026-11-17' };
  const d = U.decide(r);
  assert.ok(d.docs.some((x) => x.id === 'fssp') && d.docs.some((x) => x.id === 'unblock'), JSON.stringify(d.docs.map((x) => x.id)));
  const g = zaprosOf(r);
  assert.deepStrictEqual(g.zapros.map((x) => x.id), ['unblock', 'fssp']);
  r.damia.fssp.dannye.ostatok = 0; delete r.damia.priostanovki;
  assert.ok(!U.decide(r).docs.some((x) => x.id === 'fssp'), 'точный ноль — не «погашение»');
});

// povtor-rukovoditel-v1 [Ночные запуски] 18.11 20:05: смена руководителя — минус «Главного» без документа; в списке условий
// для него уже есть «Решение о назначении нового директора и его подпись на договоре» (decide().docs, powerNew)
test('povtor-rukovoditel-v1: смена руководителя в «Главном» — просим решение о назначении, тем же текстом; строка одна', () => {
  const r = otvet();
  r.dossier.concerns = ['Недавняя смена руководителя'];
  r.signals.push({ id: 'director_change', title: 'Руководитель сменился недавно', status: 'warn', detail: 'Иванов Иван Иванович — с 21.05.2026', source: 'ЕГРЮЛ' });
  const docs = U.decide(r).docs;
  const g = zaprosOf(r);
  assert.strictEqual(g.glavnoe.filter((x) => /руководител/i.test(x.t)).length, 1);
  assert.deepStrictEqual(g.zapros.map((x) => x.id), ['powerNew']);
  assert.strictEqual(g.zapros[0].t, docs.filter((d) => d.id === 'powerNew')[0].title);
  assert.match(bez(G.html(g)), /Решение о назначении нового директора и его подпись на договоре/);
});

// vyvod-glavnoe-v1 [Ночные запуски] 19.11 00:20: пояснение под выводом не спорит с «Главным». Живой /api/check 8602060185
// (19.11 00:13): «Работать можно. Серьёзных признаков риска не найдено» под выводом и «Есть 1 существенный минус» — иски
// 169,2 млн ₽ (0,1 % выручки) — в «Главном» на том же экране. Компании ниже вымышленные.
const SERYOZNYH = 'Серьёзных признаков риска не найдено';
const krupnyjIsk = () => otvet({ damia: {
  sudy: { nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через Checko)', sostoyanie: 'found', data_svedeniy: '2026-11-13T09:17+03:00',
    dannye: { otvetchik_nezaversheno: 34, otvetchik_summa_nezaversheno: 169231336.84 } },
  fssp: { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', sostoyanie: 'not_found', data_svedeniy: '2026-11-13T09:17+03:00', dannye: { otkryto: 0, ostatok: 0 } }
}, dengi: { vyruchka: { summa: 113976150000, god: 2025 }, sostavlyayushchie: [] } });
// pravo-sdelka-v1: иски от 1 % выручки — существенны; тот же ответ с исками на 2 % выручки
const ochenKrupnyjIsk = () => { const r = krupnyjIsk(); r.damia.sudy.dannye.otvetchik_summa_nezaversheno = 2279523000; return r; };

test('pravo-sdelka-v1: иски 0,15 % выручки (сетевая компания) — не существенный минус: ни в «Главном», ни в «Небольших суммах», итог не «est»', () => {
  const g = G.sobrat(krupnyjIsk(), SEG, PM);
  assert.notStrictEqual(g.itog.vid, 'est');
  assert.strictEqual(g.itog.sushchestvennye.length, 0);
  assert.ok(!g.glavnoe.some((x) => x.k === 'damia_sudy') && !g.melkoe.some((x) => x.k === 'damia_sudy'));
  assert.strictEqual(G.POROG_ISKOV, 0.01);
});

test('vyvod-glavnoe-v1: один существенный минус — вместо «не найдено» итог «Главного» и сам минус с долей выручки, теми же словами', () => {
  const g = G.sobrat(ochenKrupnyjIsk(), SEG, PM);
  assert.strictEqual(g.itog.vid, 'est');
  assert.strictEqual(g.itog.sushchestvennye.length, 1);
  const t = bez(U.poGlavnomu(g.itog, SERYOZNYH));
  assert.ok(!/не найдено/.test(t), t);
  assert.ok(t.startsWith(bez(g.itog.t) + ': '), t);
  assert.ok(t.includes(bez(g.itog.sushchestvennye[0].t)), 'строка минуса — та же, что в «Главном»');
  assert.ok(/\(\d+(,\d+)? % выручки за 2025 год\)$/.test(t), t);
});

test('vyvod-glavnoe-v1: существенных нет, или пояснение не говорит «не найдено», или «Главного» нет — пояснение как было', () => {
  const g = G.sobrat(otvet(), SEG, PM);                    // мелкий иск — итог не «est»
  assert.notStrictEqual(g.itog.vid, 'est');
  assert.strictEqual(U.poGlavnomu(g.itog, SERYOZNYH), SERYOZNYH);
  const k = G.sobrat(ochenKrupnyjIsk(), SEG, PM).itog;
  assert.strictEqual(U.poGlavnomu(k, 'Не проверяли: суды. Перед крупной оплатой посмотрите их сами'), 'Не проверяли: суды. Перед крупной оплатой посмотрите их сами');
  assert.strictEqual(U.poGlavnomu(null, SERYOZNYH), SERYOZNYH);
  assert.strictEqual(U.poGlavnomu({ vid: 'est', t: 'Есть 1 существенный минус на 18.11.2026', sushchestvennye: [] }, SERYOZNYH), SERYOZNYH);
});

test('vyvod-glavnoe-v1: несколько существенных — итог и куда смотреть, без перечня (он в «Главном»)', () => {
  const it = { vid: 'est', t: 'Есть 2 существенных минуса на 18.11.2026', sushchestvennye: [{ t: 'а', dolya: '' }, { t: 'б', dolya: '' }] };
  assert.strictEqual(bez(U.poGlavnomu(it, SERYOZNYH)), 'Есть 2 существенных минуса на 18.11.2026 — первыми в «Главном»');
});

test('vyvod-glavnoe-v1: usloviya берёт итог «Главного» при отрисовке (один раз за проверку) и только в пояснении без причин', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'usloviya.js'), 'utf8');
  assert.ok(/st\.itogG = itogGlavnogo\(win, r\)/.test(src));
  assert.ok(/v\.reasons\.length \? v\.reasons\.join\(', '\) : poGlavnomu\(st\.itogG, chestnoPoyasnenie\(/.test(src));
});
