// doverie-2 (30.10.2026) — единые статусы источников и правило «устарело».
// Воспроизведение на main 5afb005c: живой /api/check 30.10 21:30 отдаёт ФССП, РНП и банкротство из DaMIA «not_found» по сведениям
// на 14.10 (новые запросы к DaMIA не проходят с 12.10) — отчёт показывал их как свежее «не найдено», Индекс засчитывал в полноту,
// а замороженные источники обещали «обновите отчёт завтра». Теперь: старше срока источника → stale (не «чисто», не в полноте),
// найденное остаётся видно с датой, замороженный источник — «сейчас не обновляется». Реестр — data/istochniki.json.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I = require('../js/istochniki.js');
const IO = require('../js/indeks-otvet.js');
const SU = require('../js/sushchestvennoe.js');
const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const plain = (s) => String(s).replace(/&nbsp;|\u00a0/g, ' ');

function otvet(checked, data) {
  return {
    company: { inn: '7736186950', kind: 'LEGAL', status: 'ACTIVE', name_short: 'ООО «Тест»', reg_date: '1998-07-27' },
    checked_at: checked, risk_level: 'low', signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая' }],
    damia: {
      sudy: { nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через DaMIA)', status: 'polucheno', sostoyanie: 'found',
        data_svedeniy: data, itog: 'Компания — ответчик в 4 незавершённых делах.', uroven: 'warn', dannye: { vsego: 500 } },
      bankrotstvo: { nazvanie: 'Банкротство', istochnik: 'Картотека арбитражных дел (через DaMIA)', status: 'polucheno', sostoyanie: 'not_found',
        data_svedeniy: data, itog: 'Дел о банкротстве не найдено.' },
      fssp: { nazvanie: 'Исполнительные производства', istochnik: 'ФССП (через DaMIA)', status: 'polucheno', sostoyanie: 'not_found',
        data_svedeniy: data, itog: 'Действующих исполнительных производств не найдено.', dannye: {} },
      rnp: { nazvanie: 'РНП', istochnik: 'ЕИС (через DaMIA)', status: 'polucheno', sostoyanie: 'not_found', data_svedeniy: data, itog: 'Записей нет.' },
      priostanovki: { nazvanie: 'Приостановки', istochnik: 'ФНС (через DaMIA)', status: 'ne_provereno', sostoyanie: 'not_checked',
        prichina: 'сегодня источник недоступен для новых проверок — обновите отчёт завтра',
        itog_ne_provereno: 'Не проверяли: сегодня источник недоступен для новых проверок — обновите отчёт завтра.' },
      polnota: { provereno: 5, iz: 7 }
    }
  };
}
const STAROE = () => I.dopolnit(otvet('2026-10-30T18:30:00Z', '2026-10-14T04:08+03:00'));
const SVEZHEE = () => I.dopolnit(otvet('2026-10-15T09:00:00Z', '2026-10-14T04:08+03:00'));

test('реестр: копия в js/istochniki.js совпадает с data/istochniki.json', () => {
  const R = JSON.parse(chitat('data/istochniki.json'));
  const izJson = {};
  R.istochniki.filter((x) => x.damia).forEach((x) => { izJson[x.id] = { damia: x.damia, ustarelo_dney: x.ustarelo_dney, sostoyanie: x.sostoyanie, s: x.zamorozhen_s }; });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(I.REESTR)), izJson);
  assert.deepStrictEqual(Object.keys(R.statusy), I.STATUSY);
});

test('воспроизведение: «не найдено» 16-дневной давности — не «чисто»: stale, вне полноты, вне Индекса', () => {
  const r = STAROE(), dm = r.damia;
  ['fssp'].forEach((k) => {
    assert.strictEqual(dm[k].status, 'stale', k);
    assert.strictEqual(dm[k].status_edinyj, 'stale');
    assert.match(plain(dm[k].status_edinyj_tekst), /Данные устарели: сведения на 14\.10\.2026/);
    assert.ok(!/^В источнике записей нет|не найдено/i.test(dm[k].status_edinyj_tekst), dm[k].status_edinyj_tekst);
  });
  assert.strictEqual(dm.rnp.status, 'not_found', 'ЕИС устаревает через 30 дней — 16 дней ещё свежо');
  // банкротство из устаревшей картотеки заменено свежей отметкой ЕГРЮЛ (вне полноты), полнота не выросла
  assert.ok(dm.bankrotstvo.iz_egryul, 'банкротство — по ЕГРЮЛ');
  assert.deepStrictEqual(dm.polnota, { provereno: 2, iz: 7, ustarelo: 3 });
  const x = IO.izOtveta(r);
  assert.strictEqual(x.dostupno.fssp, false, 'ФССП в полноту Индекса не идёт');
  assert.strictEqual(x.dostupno.sudy, false, 'суды в полноту Индекса не идут');
  assert.strictEqual(I.uchten(dm.sudy), false);
});

test('найденный негатив в устаревшей группе виден — с датой и пометкой «могли измениться»', () => {
  const dm = STAROE().damia;
  assert.strictEqual(dm.sudy.status, 'found');
  assert.strictEqual(dm.sudy.ustarelo, true);
  assert.strictEqual(dm.sudy.status_edinyj, 'found');
  assert.match(plain(dm.sudy.status_edinyj_tekst), /^Данные на 14\.10\.2026 — могли измениться\. Компания — ответчик/);
  const f = SU.fakty(STAROE());
  const vse = f.spisok.concat(f.eshche).map((z) => z.k);
  assert.ok(vse.includes('damia_sudy'), 'дела суда остались среди фактов: ' + vse.join(','));
  assert.ok(f.neProvereno.some((z) => z.k === 'fssp'), 'устаревшие ФССП — среди непроверенного');
});

test('свежие сведения (на 1 день) — без изменений', () => {
  const dm = SVEZHEE().damia;
  assert.strictEqual(dm.fssp.status, 'not_found');
  assert.strictEqual(dm.fssp.status_edinyj, 'not_found');
  assert.match(plain(dm.fssp.status_edinyj_tekst), /^В источнике записей нет — на 14\.10\.2026\.$/);
  assert.ok(!dm.sudy.ustarelo);
  assert.deepStrictEqual(dm.polnota, { provereno: 5, iz: 7 });
});

test('замороженный источник без ответа не обещает «обновите завтра»', () => {
  const dm = STAROE().damia;
  assert.strictEqual(dm.priostanovki.status_edinyj, 'not_connected');
  assert.strictEqual(plain(dm.priostanovki.itog_ne_provereno), 'Не проверяли: источник сейчас не обновляется.');
  assert.match(dm.priostanovki.prichina_api, /завтра/, 'слово API сохранено отдельно');
  assert.ok(!/завтра/.test(JSON.stringify([dm.priostanovki.prichina, dm.priostanovki.itog_ne_provereno, dm.priostanovki.status_edinyj_tekst])));
});

test('семь единых статусов: у каждого свой текст, «неизвестно» ≠ «нарушений нет»', () => {
  const B = { found: { status: 'found', itog: 'Есть дело.' }, not_found: { status: 'not_found', data_svedeniy: '2026-10-29' },
    not_connected: { status: 'not_checked' }, error: { status: 'not_checked', oshibka: true }, stale: { status: 'stale', data_svedeniy: '2026-10-01' },
    not_applicable: { status: 'not_applicable', prichina: 'Для ИП не применяется.' }, user: { status: 'not_checked', otmetka_polzovatelya: true } };
  const teksty = new Set();
  I.STATUSY.forEach((k) => {
    assert.strictEqual(I.statusIstochnika(B[k]), k, k);
    const t = I.statusTekst(B[k]); teksty.add(t);
    assert.ok(!/нарушений нет|риска нет|чисто/i.test(t), k + ': ' + t);
  });
  assert.strictEqual(teksty.size, 7);
});

test('страницы говорят о судах одно и то же: заморожены — «не обновляются», ЦБ — «не получаем», без «как есть» и «новый иск»', () => {
  const kr = plain(chitat('kak-rabotaet/index.html'));
  assert.ok(!/Суды пока не подключены/.test(kr));
  assert.match(kr, /Суды, приставы и госзакупки сейчас не обновляются/);
  const ix = plain(chitat('indeks/index.html')) + plain(chitat('indeks/metodika-v1.json'));
  assert.ok(!/как есть/.test(ix), '/indeks/: «показываем группу ЦБ как есть» — неверно, мы её не получаем');
  assert.ok(!/новый иск/.test(ix), '/indeks/: суды не обновляются — «новый иск» не пересчитывает Индекс');
  assert.match(ix, /Мы эту группу не получаем и не подменяем/);
});
