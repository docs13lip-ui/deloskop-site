// plyusy-minusy-v1 [Ночные запуски] 16.11: «Плюсы и минусы» за 10 секунд (план отчёта 15.11, п. 1.2).
// Форма ответа — живой /api/check 16.11 02:10 (крупный банк: 946 идущих дел как ответчик и 353 производства у приставов,
// а dossier.concerns сервера пуст — «Существенных замечаний нет»). Компании ниже вымышленные.
// node --test tests/plyusy_minusy.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const PM = require('../js/plyusy-minusy.js');
const bezNb = (t) => String(t).replace(/ /g, ' ').replace(/\u2060/g, '');
const teksty = (a) => a.map((x) => bezNb(x.t));

function otvet(o) {
  o = o || {};
  return {
    company: Object.assign({ inn: '7700000001', kind: 'LEGAL', name_short: 'ООО "ОБРАЗЕЦ"', status: 'ACTIVE', reg_date: '2007-10-24' }, o.company || {}),
    checked_at: '2026-11-16', risk_level: 'low', verdict: 'Работать можно.',
    signals: o.signals || [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП' },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ' },
      { id: 'age', title: 'Возраст компании', status: 'ok', detail: 'С 24.10.2007', source: 'ЕГРЮЛ' },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.10.2026' }
    ],
    nedostovernost: { adres: false, rukovoditel: null },
    damia: o.damia || {
      sudy: { nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через Checko)', status: 'polucheno', sostoyanie: 'found',
        data_svedeniy: '2026-11-12T19:10+03:00', podzagolovok: 'Суды общей юрисдикции не проверяли',
        dannye: { vsego: 6748, otvetchik_nezaversheno: 946, otvetchik_summa_nezaversheno: 24542188319.38 } },
      fssp: { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', status: 'polucheno', sostoyanie: 'found', data_svedeniy: '2026-11-12T19:10+03:00',
        dannye: { otkryto: 353, ostatok: 22961651.11, ostatok_tochno: false } },
      bankrotstvo: { nazvanie: 'Банкротство', istochnik: 'ЕФРСБ (через Checko)', status: 'polucheno', sostoyanie: 'not_found', data_svedeniy: '2026-11-12T01:01+03:00' },
      priostanovki: { nazvanie: 'Счета: решения ФНС о приостановлении', status: 'ne_provereno', sostoyanie: 'not_checked' },
      rnp: { nazvanie: 'Недобросовестные поставщики (РНП)', status: 'polucheno', sostoyanie: 'not_found', data_svedeniy: '2026-11-12T19:10+03:00' },
      kontrakty: { nazvanie: 'Госконтракты', status: 'polucheno', sostoyanie: 'found', dannye: { vsego: 34193 } },
      polnota: { provereno: 5, iz: 7 }, platnyj: false, versiya: 'damia-v1.4'
    },
    zsk: o.zsk || { level: 'low', title: 'Низкая вероятность', groups: [] },
    dossier: Object.assign({ strengths: ['Руководитель не менялся 17 лет 1 месяц'], concerns: [], kpi: [], charts: {} }, o.dossier || {})
  };
}

test('суды и приставы, которых нет в concerns сервера, — в минусах, с суммой; «от» — вниз', () => {
  const S = PM.sobrat(otvet());
  assert.deepStrictEqual(teksty(S.minusy), ['946 незавершённых дел, где компания — ответчик; требования к компании — 24,5 млрд ₽', 'Производства у приставов: 353, остаток долга — не меньше 22,9 млн ₽']);
  assert.strictEqual(S.minusy[0].nazv, 'Арбитражные суды');
  assert.strictEqual(S.minusy[0].data, '12.11.2026');
});

test('плюсы — по порядку важности; госконтракты и «не в РНП» — только у поставщика', () => {
  const S = PM.sobrat(otvet());
  assert.deepStrictEqual(teksty(S.plyusy), ['Действующая компания', 'Недоимки и долгов по пеням и штрафам в открытых данных ФНС не нашли — сведения на 01.10.2026', 'Нет сообщений о банкротстве',
    'Нет отметок о недостоверности', 'На рынке 19 лет', 'Госконтракты как поставщик: 34 193', 'Руководитель не менялся 17 лет',
    'Не нашли в реестре недобросовестных поставщиков на 12.11.2026']);
  const bezDaty = otvet(); delete bezDaty.damia.rnp.data_svedeniy;
  assert.ok(!teksty(PM.sobrat(bezDaty).plyusy).some((x) => /недобросовест/.test(x)), 'без даты набора «не нашли в РНП» не пишем ([Право] № 53)');
  const r = otvet(); r.damia.kontrakty.sostoyanie = 'not_found';
  const t = teksty(PM.sobrat(r).plyusy);
  assert.ok(!t.some((x) => /РНП|недобросовест|Госконтракты/.test(x)), t.join(' | '));
});

test('«Не проверено» — реестры без ответа и суды общей юрисдикции, а не «чисто»', () => {
  const S = PM.sobrat(otvet());
  assert.deepStrictEqual(S.ne.map((x) => x.t), ['приостановки счетов', 'суды общей юрисдикции']);
  assert.ok(!teksty(S.plyusy).some((x) => /приостанов/.test(x)));
  const h = bezNb(PM.html(S));
  assert.match(h, /Не проверено:<\/b> приостановки счетов, суды общей юрисдикции — не проверяли ≠ не нашли/);
});

test('минусы: налоговый долг, нет сотрудников, статус, недостоверность, прочие признаки — коротко', () => {
  const r = otvet({ signals: [
    { id: 'status', title: 'Статус', status: 'bad', detail: 'Ликвидируется', source: 'ЕГРЮЛ' },
    { id: 'address', title: 'Адрес', status: 'bad', detail: 'Недостоверный адрес', source: 'ЕГРЮЛ' },
    { id: 'tax', title: 'Долги по налогам', status: 'warn', detail: '131 865 ₽ (недоимка, пени и штрафы)', as_of: '01.10.2026' },
    { id: 'staff', title: 'Сотрудники', status: 'warn', detail: 'Среднесписочная численность: 0' },
    { id: 'tax_burden', title: 'Низкая налоговая нагрузка', status: 'warn', detail: 'Доходы 63 220 602 000 ₽, уплачено налогов 0 ₽' },
    { id: 'mass_address', title: 'Адрес многих компаний', status: 'warn', detail: '12 компаний' }
  ], damia: {}, dossier: { strengths: [], concerns: ['Налоговый долг 131 865 ₽', 'Руководитель сменился 2 месяца назад'] } });
  const t = teksty(PM.sobrat(r).minusy);
  assert.deepStrictEqual(t, ['Статус: ликвидируется', 'Отметка о недостоверности адреса', 'Долг по налогам 131 865 ₽',
    'Нет сотрудников по данным ФНС', 'Низкая налоговая нагрузка', 'Адрес многих компаний: 12 компаний', 'Руководитель сменился 2 месяца назад']);
  assert.ok(!t.some((x) => /63/.test(x)), 'сумма из длинного значения признака в строку не идёт');
});

test('отчётность: свежая — плюс, старая — «Не проверено» с годами, не минус; ИП — без руководителя и отчётности', () => {
  const r = otvet({ dossier: { charts: { revenue: [{ year: 2023, value: 1 }, { year: 2024, value: 5e6 }] } } });
  assert.ok(teksty(PM.sobrat(r).plyusy).includes('Отчётность за 2024 год в ГИР БО'));
  const st = otvet({ dossier: { charts: { revenue: [{ year: 2021, value: 5e6 }] } } });
  // otchetnost-ne-minus-v1 ([Право] 17.11, п. 1.3): закрытый доступ к ГИР БО — «нет данных», не минус
  assert.ok(!teksty(PM.sobrat(st).minusy).some((x) => /тч[её]тност/.test(x)), 'старая отчётность — не минус');
  assert.ok(teksty(PM.sobrat(st).ne).includes('финансы за 2022–2025 годы (в открытых данных их нет)'), teksty(PM.sobrat(st).ne).join(' | '));
  const ip = otvet({ company: { inn: '770000000012', kind: 'INDIVIDUAL' }, dossier: { charts: { revenue: [{ year: 2024, value: 5e6 }] } } });
  const ti = teksty(PM.sobrat(ip).plyusy).join(' | ');
  assert.ok(!/Руководитель|Отчётность/.test(ti), ti);
});

test('ЗСК — минус только при средней и высокой; у молодой компании возраст — минус', () => {
  const r = otvet({ zsk: { level: 'medium', title: 'Средняя вероятность', groups: [] }, company: { reg_date: '2026-05-10' },
    signals: [{ id: 'age', title: 'Возраст компании', status: 'warn', detail: 'С 10.05.2026', source: 'ЕГРЮЛ' }] });
  const t = teksty(PM.sobrat(r).minusy);
  assert.ok(t.includes('Наш прогноз по признакам ЗСК: средняя вероятность — не оценка Банка России'), t.join(' | '));
  assert.ok(t.includes('На рынке 6 месяцев'), t.join(' | '));
});

test('разметка: не больше 6 плюсов на виду, остальные — под «Ещё N»; без красного', () => {
  const S = PM.sobrat(otvet());
  const h = PM.html(S);
  const vidno = h.replace(/<details[\s\S]*?<\/details>/g, '');
  assert.strictEqual((vidno.match(/<li data-pm=/g) || []).length, 6 + S.minusy.length);
  assert.match(h, /<summary>Ещё 2<\/summary>/);
  const vse = PM.html(S, { vse: true });
  assert.ok(!/<details/.test(vse) && (vse.match(/<li data-pm=/g) || []).length === S.plyusy.length + S.minusy.length, 'в PDF-досье — все строки');
  assert.match(h, /data-pm="damia_sudy" data-pm-nazv="Арбитражные суды"/);
  // цвет — латунь и нейтральные: ни одного «красного» оттенка (R заметно больше G и B), ни классов светофора
  const krasnye = (PM.CSS.match(/#[0-9A-Fa-f]{6}\b/g) || []).filter((c) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    return r - g > 60 && r - b > 60;
  });
  assert.deepStrictEqual(krasnye, []);
  assert.ok(!/\b(?:bad|warn|red)\b/.test(PM.CSS + h));
  assert.strictEqual(PM.html(PM.sobrat({})), '');
});

test('подключено: главная (после «Денег на кону»), PDF-досье, пакет «otchet»', () => {
  const kor = path.join(__dirname, '..');
  const ind = fs.readFileSync(path.join(kor, 'index.html'), 'utf8');
  assert.ok(ind.indexOf('PlyusyMinusy.mount(report,r)') > ind.indexOf('DengiNaKonu.mount(report,r)'));
  const rep = fs.readFileSync(path.join(kor, 'report.html'), 'utf8');
  assert.match(rep, /<script src="\/js\/plyusy-minusy\.js"><\/script>/);
  assert.match(rep, /PlyusyMinusy\.html\(PlyusyMinusy\.sobrat\(R\),\{vse:true\}\)/);
  const karta = JSON.parse(fs.readFileSync(path.join(kor, 'partials/sborka.json'), 'utf8'));
  assert.ok(karta.pakety.otchet.includes('js/plyusy-minusy.js'));
});

test('устаревшие сведения реестра (stale) — не плюс, а «Не проверено» с датой', () => {
  const r = otvet();
  Object.assign(r.damia.rnp, { status: 'stale', sostoyanie: 'stale', data_svedeniy: '2026-10-12T11:40+03:00' });
  const S = PM.sobrat(r);
  assert.ok(!teksty(S.plyusy).some((x) => /недобросовест/.test(x)));
  assert.ok(S.ne.map((x) => bezNb(x.t)).includes('РНП (сведения на 12.10.2026)'));
});

// otchetnost-ne-minus-v1 [Ночные запуски] 17.11
test('старая отчётность: годы по дате проверки (до июня — на год меньше), одна строка «Не проверено», минусов не прибавляет', () => {
  const a = otvet({ dossier: { charts: { revenue: [{ year: 2023, value: 5e6 }] } } });
  a.checked_at = '2026-11-16';
  assert.deepStrictEqual(teksty(PM.sobrat(a).ne).filter((x) => /финансы/.test(x)), ['финансы за 2024–2025 годы (в открытых данных их нет)']);
  const b = otvet({ dossier: { charts: { revenue: [{ year: 2024, value: 5e6 }] } } });
  b.checked_at = '2027-03-10';  // до июня отчётность за 2026 ещё не ждём: нет только 2025
  assert.deepStrictEqual(teksty(PM.sobrat(b).ne).filter((x) => /финансы/.test(x)), ['финансы за 2025 год (в открытых данных их нет)']);
  const s = PM.sobrat(a), h = PM.html(s);
  assert.match(bezNb(h), /Не проверено:<\/b> финансы за 2024–2025 годы \(в открытых данных их нет\)/);
  assert.match(h, new RegExp('data-minusy="' + s.minusy.length + '"'));
  assert.ok(!/Последняя отчётность/.test(bezNb(h)));
});
