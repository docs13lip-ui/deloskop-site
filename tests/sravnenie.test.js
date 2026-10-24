// sravnit-v1 — «Сравнить двух поставщиков» (js/sravnenie.js, /sravnit/; ТЗ [Продукт] 23.10 Ф2). node --test tests/sravnenie.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.self = global; // модули отчёта регистрируются в self — как в браузере
global.IndeksOtvet = require('../js/indeks-otvet.js');
global.Sushchestvennoe = require('../js/sushchestvennoe.js');
global.Usloviya = require('../js/usloviya.js');
global.StatusKod = require('../js/status-kod.js');
global.DlkInn = require('../js/inn.js');
const S = require('../js/sravnenie.js');
const NB = ' ';
const sp = (s) => String(s).replace(/ /g, ' ');

// ответы /api/check в той форме, что отдаёт живой API (поля, которые читает сравнение)
function otvet(o) {
  o = o || {};
  return {
    company: Object.assign({ inn: '7736050003', kind: 'LEGAL', name_short: 'ПАО «Альфа»', status: 'ACTIVE', reg_date: '1993-02-25', okved: '46.71.4' }, o.company || {}),
    risk_level: o.risk_level || 'low',
    verdict: 'Работать можно. Серьёзных признаков риска не найдено.',
    signals: o.signals || [
      { title: 'Статус', status: 'ok', detail: 'Действующая' },
      { title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет' },
      { title: 'Задолженность по налогам', status: 'ok', detail: 'Нет' }],
    zsk: o.zsk || { level: 'low', title: 'Низкая вероятность' },
    dossier: { kpi: o.kpi || [{ label: 'Выручка за 2025', value: 48000000, delta: 12 }, { label: 'Долг перед бюджетом', value: null, text: 'Нет' }] },
    damia: o.damia || { sudy: { status: 'polucheno', data_svedeniy: '2026-10-12T11:40+03:00', dannye: { vsego: 3, otvetchik: 1, otvetchik_nezaversheno: 0 } } },
    checked_at: '2026-10-23T08:00:00+03:00'
  };
}
const SEJCHAS = Date.parse('2026-10-23T08:00:00+03:00');

test('(1) ввод: ИП не сравниваем, один ИНН дважды — нет, опечатка — до запроса', () => {
  assert.strictEqual(S.proverit('7736050003', '500100732259'), S.IP_TEKST);
  assert.strictEqual(S.IP_TEKST, 'Сравнивать можно только организации.', 'текст [Право] 23.10 — без «не публикуем»');
  assert.ok(/один и тот же/.test(S.proverit('7736050003', '7736050003')));
  assert.ok(/обеих/.test(S.proverit('7736050003', '')));
  assert.ok(/опечатка|контрольн/i.test(S.proverit('7736050003', '7707083890')), 'контрольная цифра — DlkInn');
  assert.strictEqual(S.proverit('7736050003', '7707083893'), '');
});

test('(2) девять строк из ТЗ, у каждой — тон из четырёх; значения — из ответа, не придуманы', () => {
  const R = S.stroki(otvet(), otvet({ company: { inn: '7707083893', name_short: 'ООО «Бета»', reg_date: '2026-03-01' } }), { sejchas: SEJCHAS });
  assert.deepStrictEqual(R.map((x) => x.k), ['indeks', 'status', 'vozrast', 'vyruchka', 'nedoimka', 'sudy', 'zsk', 'predoplata', 'vyvod']);
  for (const x of R) for (const y of [x.a, x.b]) {
    assert.ok(['ok', 'warn', 'bad', 'neutral'].includes(y.ton), x.k + ': ' + y.ton);
    assert.ok(y.t && typeof y.t === 'string', x.k + ': пусто');
  }
  const v = R.find((x) => x.k === 'vozrast');
  assert.strictEqual(sp(v.a.t), '33 года');
  assert.strictEqual(sp(v.b.t), '7 месяцев');
  assert.strictEqual(v.b.ton, 'warn', 'моложе года — внимание');
  assert.ok(v.raznye, 'возраст расходится по тону — подсвечен');
  const vy = R.find((x) => x.k === 'vyruchka');
  assert.strictEqual(sp(vy.a.t), '48,0 млн ₽');
  assert.strictEqual(sp(vy.a.pod), 'за 2025 год · +12 % к прошлому');
});

test('(3) «не проверяли» — не «не нашли»: суды без ответа источника и выручка без отчётности', () => {
  const R = S.stroki(otvet({ damia: { sudy: { status: 'ne_provereno' } }, kpi: [] }), otvet(), { sejchas: SEJCHAS });
  const s = R.find((x) => x.k === 'sudy');
  assert.strictEqual(s.a.t, 'Не проверяли');
  assert.strictEqual(s.a.ton, 'neutral');
  assert.strictEqual(sp(s.b.t), 'Незавершённых дел ответчиком нет');
  const v = R.find((x) => x.k === 'vyruchka');
  assert.strictEqual(v.a.t, 'Нет в ответе');
  assert.ok(!v.raznye && !s.raznye, 'пробел в данных с одной стороны — не «расходятся»');
});

test('(4) итог — подсчёт отметок, без «лучше»; поровну и ноль — честно', () => {
  const plohaya = otvet({ company: { inn: '7707083893', name_short: 'ООО «Бета»' }, risk_level: 'medium', zsk: { level: 'medium', title: 'Средняя вероятность' },
    signals: [{ title: 'Адрес', status: 'warn', detail: 'Массовый адрес' }, { title: 'Задолженность по налогам', status: 'bad', detail: '1,2 млн ₽' }] });
  const t = sp(S.itog(otvet(), plohaya));
  assert.strictEqual(t, 'У ПАО «Альфа» меньше отметок «внимание» и «серьёзно»: 0 против 3 (3 отметки у ООО «Бета»).');
  assert.strictEqual(sp(S.itog(plohaya, plohaya)), 'Отметок «внимание» и «серьёзно» поровну: 3 и 3.');
  assert.strictEqual(sp(S.itog(otvet(), otvet())), 'Ни в одном отчёте нет отметок «внимание» и «серьёзно».');
  for (const x of [t, S.itog(plohaya, plohaya)]) assert.ok(!/лучше|надёжнее|рекоменд/i.test(x), x);
  const R = S.stroki(otvet(), plohaya, { sejchas: SEJCHAS });
  assert.ok(R.find((x) => x.k === 'nedoimka').raznye && R.find((x) => x.k === 'zsk').raznye);
});

test('(5) вёрстка: вкладки A | B | «Разница», ссылки на полные отчёты, без «лучше»; страница и главная', () => {
  const h = S.html(otvet(), otvet({ company: { inn: '7707083893', name_short: 'ООО «Бета»', reg_date: '2026-03-01' } }), { sejchas: SEJCHAS });
  assert.strictEqual((h.match(/role="tab"/g) || []).length, 3);
  assert.ok(h.includes('data-sv-vid="r">Разница'));
  assert.ok(h.includes('href="/?inn=7736050003"') && h.includes('href="/?inn=7707083893"'));
  assert.ok(/sv-r--raz/.test(h));
  assert.ok(!/лучше/i.test(h.replace(/<[^>]+>/g, '')));
  const p = fs.readFileSync(path.join(ROOT, 'sravnit/index.html'), 'utf8');
  assert.ok(p.includes('<link rel="canonical" href="https://deloskop.ru/sravnit/">'));
  assert.ok(/из(&nbsp;| )10 бесплатных в(&nbsp;| )день уйдут 2/.test(p), 'предупреждение о двух проверках — до запроса');
  assert.ok(/\/js\/b\/sravnit\.[0-9a-f]{10}\.js/.test(p) && /\/js\/b\/otchet\.[0-9a-f]{10}\.js/.test(p));
  assert.ok(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').includes('<loc>https://deloskop.ru/sravnit/</loc>'));
  const g = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(g.includes("location.replace('/sravnit/?a='+innIzAdresa()+'&b='+qvs)") && g.includes("var qi=svs?'':"), '/?inn=A&vs=B → /sravnit/, без проверки на главной');
  const O = require('../js/otchet.js');
  const a = O.dejstviya({ company: { inn: '7736050003' } });
  assert.strictEqual(a.filter((x) => x.glavnaya).length, 1, 'главная кнопка по-прежнему одна');
  assert.deepStrictEqual(a[a.length - 1], { t: '+' + NB + 'Сравнить с другой компанией', href: '/sravnit/?a=7736050003', cel: 'otchet_sravnit', tihaya: true });
  assert.ok(!O.dejstviya({ company: { inn: '770000000012' } }).some((x) => /Сравнить/.test(x.t)), 'ИП — без сравнения');
  assert.ok(!O.dejstviya({ company: { inn: '7736050003' } }, true).some((x) => /Сравнить/.test(x.t)), 'Щит — без сравнения');
});

test('(6) ответы [Право] 23.10: «не проверено» — рядом с итогом и вне подсчёта; подпись с датой; отказ ИП без «не публикуем»', () => {
  const nepr = otvet({ company: { inn: '7707083893', name_short: 'ООО «Бета»' }, damia: { sudy: { status: 'ne_provereno' } }, zsk: { level: null },
    signals: [{ title: 'Адрес', status: 'warn', detail: 'Массовый адрес' }] });
  assert.strictEqual(S.otmetki(nepr), 1, '«не проверяли» в подсчёт не входит');
  assert.strictEqual(sp(S.neproveno(otvet(), nepr)), 'У ООО «Бета» не проверены 2 строки — в подсчёт они не входят.');
  assert.strictEqual(S.neproveno(otvet(), otvet()), '');
  const odna = otvet({ damia: { sudy: { status: 'ne_provereno' } } });
  assert.strictEqual(sp(S.neproveno(odna, nepr)), 'Не проверены строки: у ПАО «Альфа» — 1, у ООО «Бета» — 2. В подсчёт они не входят.');
  const pyat = otvet({ company: { inn: '7707083893', name_short: 'ООО «Бета»' }, damia: { sudy: { status: 'x' } }, zsk: {}, signals: [], kpi: [] });
  assert.ok(/не проверены 3 строки/.test(sp(S.neproveno(otvet(), pyat))), sp(S.neproveno(otvet(), pyat)));
  const h = sp(S.html(otvet(), nepr, { sejchas: SEJCHAS }).replace(/<[^>]+>/g, ' '));
  assert.ok(h.includes('Это подсчёт отметок по открытым сведениям на 23.10.2026, а не оценка компаний. С кем работать — решаете вы.'), 'подпись [Право]');
  assert.ok(h.includes('У ООО «Бета» не проверены 2 строки'));
  assert.ok(!/надёжн|лучше|рейтинг|рекоменд/i.test(h), '222-ФЗ: без оценочных слов');
  const p = sp(fs.readFileSync(path.join(ROOT, 'sravnit/index.html'), 'utf8').replace(/&nbsp;/g, ' '));
  assert.ok(p.includes('Сравнивать можно только организации'));
  assert.ok(!/не публикуем/.test(p), 'на /sravnit/ — без «не публикуем» (ответ [Право])');
  assert.ok(p.includes('а не оценка компаний. С кем работать — решаете вы.'));
});
