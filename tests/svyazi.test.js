// vizual-v3.2 «Связи» (18.10.2026, [Ночные запуски]): третья вкладка отчёта — граф связей из ответа /api/check.
// Сторож: только данные из ответа (слова и числа — как пришли), ИП — без вкладки, новых запросов нет,
// модуль в пакете отчёта, крючки в vizual2.js, reduce — один кадр. Кадр на 40 узлах и вид 1280/390 — Chromium при сборке комплекта.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(K, 'js/svyazi.js'), 'utf8');
const v2 = fs.readFileSync(path.join(K, 'js/vizual2.js'), 'utf8');
const Svyazi = require('../js/svyazi.js');

const OTVET = {
  company: { inn: '7700000000', kind: 'LEGAL', name_short: 'ООО «ОБРАЗЕЦ»', name_full: 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «ОБРАЗЕЦ»' },
  signals: [
    { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет' },
    { id: 'mass_dir', title: 'Массовый руководитель', status: 'warn', detail: 'Руководитель ещё в 12 компаниях' }
  ],
  dossier: { sections: [
    { id: 'profile', rows: [['Юридический адрес', '101000, г Москва, ул Образцовая, д 1'], ['Налоговая инспекция', 'ИФНС № 0 по г. Москве'], ['Филиалы и представительства', '3']] },
    { id: 'management', rows: [['Генеральный директор', 'Иванов Иван Иванович'], ['Руководит с', '01.02.2020 (6 лет)'], ['Уставный капитал', '10 000 ₽'], ['Учредитель', 'Петров Пётр Петрович']] },
    { id: 'activity', rows: [['Основной вид деятельности', '62.01 — Разработка компьютерного программного обеспечения']] }
  ] }
};

test('модель: только строки и признаки из ответа, слово в слово', () => {
  const m = Svyazi.model(OTVET);
  assert.ok(m);
  assert.strictEqual(m.centr.zag, 'ООО «ОБРАЗЕЦ»');
  assert.deepStrictEqual(m.uzly.map((u) => u.k), ['rukovoditel', 'uchreditel', 'adres', 'inspekciya', 'vid', 'filialy']);
  const vse = JSON.stringify(OTVET);
  for (const u of m.uzly) for (const t of [u.zag, u.znach, u.pod]) {
    if (!t) continue;
    if (u.k === 'rukovoditel' && t === 'Руководит с 01.02.2020 (6 лет)') continue; // подпись = строка «Руководит с» целиком
    assert.ok(vse.includes(JSON.stringify(t).slice(1, -1)), 'не из ответа: ' + t);
  }
  const ruk = m.uzly[0], adr = m.uzly[2];
  assert.strictEqual(ruk.znach, 'Иванов Иван Иванович');
  assert.strictEqual(ruk.ton, 'warn'); // «Массовый руководитель» из signals
  assert.strictEqual(ruk.pod, 'Руководитель ещё в 12 компаниях');
  assert.strictEqual(adr.ton, 'ok');
  assert.ok(!m.uzly.some((u) => /Уставный капитал/.test(u.zag)), 'капитал — не связь');
});

test('ИП, пустой ответ, своя компания и меньше двух узлов — вкладки нет', () => {
  assert.strictEqual(Svyazi.model({ ...OTVET, company: { ...OTVET.company, kind: 'INDIVIDUAL' } }), null);
  assert.strictEqual(Svyazi.model(null), null);
  assert.strictEqual(Svyazi.model({ company: OTVET.company, dossier: { sections: [{ id: 'profile', rows: [['Юридический адрес', 'г Москва']] }] } }), null);
});

test('без сетевых запросов, хранилищ и библиотек; reduce — один кадр', () => {
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|localStorage|import\s*\(|https?:\/\//);
  assert.match(js, /if \(tiho\) \{ phi = cel = 0; risovat\(\); return; \}/);
  assert.match(js, /attributeFilter: \['data-theme'\]/); // смена темы — кадр заново
});

test('подключение: пакет отчёта, крючки vizual2, модель кладёт главная', () => {
  const sb = JSON.parse(fs.readFileSync(path.join(K, 'partials/sborka.json'), 'utf8'));
  assert.ok(sb.pakety.otchet.includes('js/svyazi.js'));
  assert.match(v2, /if \(W\.Svyazi && Svyazi\.est\(f\)\) vid\.push\(\['svyazi', 'Связи', 'Связи компании'\]\);/);
  assert.match(v2, /if \(v === 'svyazi' && W\.Svyazi\) Svyazi\.pokazat\(spis, f, zhivo\);/);
  assert.match(v2, /function nazad\(\) \{ if \(W\.Svyazi\) Svyazi\.ubrat\(spis\);/);
  const gl = fs.readFileSync(path.join(K, 'index.html'), 'utf8');
  assert.ok(gl.includes('if(window.Svyazi){try{Svyazi.zapomnit(report,svoj?null:r)}catch(e){}}'));
});

test('кадр на 40 узлах укладывается в бюджет вызовов (рисование — только дуги, линии, текст)', () => {
  const m = { centr: { zag: 'Компания', pod: '' }, uzly: [] };
  for (let i = 0; i < 40; i++) m.uzly.push({ k: 'u', zag: 'Строка ' + i, znach: 'Значение номер ' + i, pod: '', ton: ['ok', 'warn', 'bad', 'neutral'][i % 4] });
  let n = 0;
  const cx = new Proxy({}, { get: (o, k) => (k === 'measureText' ? (t) => ({ width: t.length * 7 }) : k in o ? o[k] : () => { n++; }), set: (o, k, v) => { o[k] = v; return true; } });
  const C = { ink: '#000', muted: '#666', accent: '#00f', soft: '#eef', line: '#ddd', surface: '#fff', ok: '#0a0', warn: '#a60', bad: '#a00', font: 'sans-serif' };
  const t0 = process.hrtime.bigint();
  for (let k = 0; k < 100; k++) Svyazi._kadr(cx, m, 900, 320, k / 50, C);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 100;
  assert.ok(n / 100 < 40 * 10 + 20, 'вызовов на кадр: ' + n / 100);
  assert.ok(ms < 1, 'кадр ' + ms.toFixed(3) + ' мс без браузера');
});

// vizual-v3.2b (18.10.2026, [Ночные запуски]): связи из реестров DaMIA и подпись источника с датой
test('3.2b: суды, приставы, госзаказ, РНП — только где источник ответил и есть что показать; подпись — «итог» ответа', () => {
  const r = JSON.parse(JSON.stringify(OTVET));
  r.company.fetched_at = '2026-10-18T06:36:45+00:00';
  r.damia = {
    sudy: { nazvanie: 'Арбитражные суды', status: 'polucheno', data_svedeniy: '2026-10-12T11:40+03:00', itog: 'Дел, где компания — ответчик: 2.', dannye: { vsego: 1449, otvetchik_nezaversheno: 2 } },
    fssp: { nazvanie: 'Приставы', status: 'found', data_svedeniy: '2026-10-12T11:40+03:00', itog: 'Открыто 3.', dannye: { otkryto: 3 } },
    kontrakty: { nazvanie: 'Госконтракты', status: 'ne_provereno', itog_ne_provereno: 'Не проверяли.' },
    rnp: { nazvanie: 'РНП', status: 'polucheno', dannye: { vsego: 0 }, itog: 'Нет.' }
  };
  const m = Svyazi.model(r);
  const d = m.uzly.filter((u) => /^(sudy|fssp|kontrakty|rnp)$/.test(u.k));
  assert.deepStrictEqual(d.map((u) => u.k), ['sudy', 'fssp'], 'не проверено и ноль — без узла');
  assert.strictEqual(d[0].znach, '1\u00a0449 дел в картотеке');
  assert.strictEqual(d[0].pod, 'Дел, где компания — ответчик: 2.');
  assert.strictEqual(d[0].ton, 'warn');
  assert.strictEqual(d[1].znach, '3 открытых производства');
  assert.match(m.ist, /ЕГРЮЛ на 18\.10\.2026, картотека арбитражных дел на 12\.10\.2026, ФССП на 12\.10\.2026\./);
  assert.match(m.ist, /неполную картину за полную не выдаём\.$/);
  assert.doesNotMatch(js, /state_actuality_date \?|ist = .*state_actuality_date/, 'дата ЕГРЮЛ — не дата изменения записи');
  assert.doesNotMatch(m.ist, /!|аффилирован|группа лиц/i);
});

test('3.2b: карточка растёт вместе с оборотом «Связи» (граф по кнопке не накрывает то, что ниже)', () => {
  assert.match(v2, /vn\.style\.minHeight = vys0 \+ 'px'; \/\/ ушли со «Связей» — база\s+if \(vn\.getAttribute\('data-vid'\) !== 'svyazi'\) return;/);
  assert.match(v2, /Math\.max\(vys0, Math\.ceil\(zad\.scrollHeight\)\)/);
  assert.match(v2, /\}\)\.observe\(spis\);/);
});
