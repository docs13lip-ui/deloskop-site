// «Что изменилось» по кабинету (js/dinamika.js, izm-kabinet-v1): прошлая проверка с другого устройства —
// из ответов /api/me/checks и /api/report/{id}, без новых данных на сервере и без записи в браузер.
// node --test tests/izm_kabinet.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../js/dinamika.js');
const KOREN = path.join(__dirname, '..');
const NB = ' ';
const CHAS = 3600e3;

function otvet(over) {
  return Object.assign({
    company: { inn: '7736050003', kind: 'LEGAL', status: 'ACTIVE', name_short: 'ПАО «Пример»', director_since: '2007-04-12', invalid: false },
    risk_level: 'low', checked_at: '2026-10-02T10:00:00Z', report_id: 'R-NEW',
    signals: [{ id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет' }],
    zsk: { level: 'low' }, dossier: { charts: {} },
  }, over || {});
}
const SPISOK = { checks: [
  { inn: '7736050003', created_at: '2026-10-02T09:58:00Z', risk_level: 'low', report_id: 'R-NEW' },   // текущая
  { inn: '7736050003', created_at: '2026-10-02T09:30:00Z', risk_level: 'low', report_id: 'R-HOUR' },  // меньше часа назад
  { inn: '7736050003', created_at: '2026-09-12T08:00:00Z', risk_level: 'medium', report_id: 'R-SEP' },
  { inn: '7736050003', created_at: '2026-08-01T08:00:00Z', risk_level: 'low', report_id: 'R-AUG' },
  { inn: '7707083893', created_at: '2026-09-30T08:00:00Z', risk_level: 'low', report_id: 'R-OTHER' },
  { inn: '7736050003', created_at: '2026-09-20T08:00:00Z', risk_level: 'low' },                        // без досье
] };
const PROSHLYJ = otvet({ checked_at: '2026-09-12T08:00:00Z', report_id: 'R-SEP', risk_level: 'medium',
  signals: [{ id: 'tax_debt', title: 'Задолженность по налогам', status: 'bad', detail: 'Есть' }] });

function fakeFetch(otvety, zhurnal) {
  return (u, o) => {
    zhurnal.push([u, o && o.credentials]);
    const k = Object.keys(otvety).find((x) => u.endsWith(x));
    if (!k) return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(otvety[k]) });
  };
}
// маленький «DOM»: отчёт с блоком .izm (или без) и .din
function fakeReport(sIzm) {
  const vstavleno = [];
  const roditel = {
    replaceChild(nov, star) { vstavleno.push(['zamena', nov.html]); },
    insertBefore(nov, pered) { vstavleno.push(['pered', nov.html]); },
  };
  const at = {};
  return {
    vstavleno,
    setAttribute(k, v) { at[k] = String(v); }, getAttribute(k) { return k in at ? at[k] : null; },
    querySelector(sel) {
      if (sel === '.izm') return sIzm ? { parentNode: roditel } : null;
      if (sel === '.din') return { parentNode: roditel };
      return null;
    },
    ownerDocument: { createElement: () => { const el = {}; Object.defineProperty(el, 'innerHTML', { set(h) { el.firstChild = { html: h }; } }); return el; } },
  };
}

test('прошлая проверка: та же компания, раньше больше чем на час, с досье, не текущая', () => {
  const t = Date.parse('2026-10-02T10:00:00Z');
  assert.deepStrictEqual(D.predydushchaya(SPISOK.checks, '7736050003', t, 'R-NEW'), { id: 'R-SEP', t: Date.parse('2026-09-12T08:00:00Z') });
  assert.strictEqual(D.predydushchaya(SPISOK.checks, '7700000000', t, ''), null);
  assert.strictEqual(D.predydushchaya(null, '7736050003', t, ''), null);
  assert.strictEqual(D.predydushchaya([{ inn: '7736050003', created_at: 'вчера', report_id: 'X' }], '7736050003', t, ''), null);
});

test('кабинет нужен, только если там проверка новее снимка браузера больше чем на час', () => {
  const srv = { id: 'R', t: Date.parse('2026-09-12T08:00:00Z') };
  assert.strictEqual(D.nuzhenKabinet(null, srv), true);
  assert.strictEqual(D.nuzhenKabinet({ pervyj: true }, srv), true);
  assert.strictEqual(D.nuzhenKabinet({ s: { t: srv.t - 5 * CHAS } }, srv), true);
  assert.strictEqual(D.nuzhenKabinet({ s: { t: srv.t - 30 * 60e3 } }, srv), false, 'та же проверка — браузер не хуже');
  assert.strictEqual(D.nuzhenKabinet({ s: { t: srv.t + CHAS } }, srv), false);
  assert.strictEqual(D.nuzhenKabinet(null, null), false);
});

test('вошедший, снимка в браузере нет → сравнение с досье из кабинета заменяет «Запомнили…»', async () => {
  const zh = [];
  const r = otvet();
  D.html(r, { ls: { getItem: () => null, setItem() {} } }); // первая проверка на этом устройстве
  const rep = fakeReport(true);
  const rez = await D.dogruzit(rep, r, { api: 'https://api.example', voshel: true, fetch: fakeFetch({ '/api/me/checks': SPISOK, '/api/report/R-SEP': PROSHLYJ }, zh) });
  assert.ok(rez && rez.id === 'R-SEP');
  assert.deepStrictEqual(zh, [['https://api.example/api/me/checks', 'include'], ['https://api.example/api/report/R-SEP', undefined]]);
  assert.deepStrictEqual(rez.izm.map((x) => x.ton + ': ' + x.t), [
    'luchshe: Оценка риска: средний → низкий',
    'luchshe: Задолженность по налогам: риск → норма',
  ]);
  assert.strictEqual(rep.vstavleno.length, 1);
  const [kak, h] = rep.vstavleno[0];
  assert.strictEqual(kak, 'zamena');
  assert.match(h, new RegExp('Что изменилось с вашей проверки 12' + NB + 'сентября'));
  assert.match(h, new RegExp('<a href="/report.html\\?id=R-SEP" target="_blank" rel="noopener">досье от' + NB + '12\\.09\\.2026</a> из вашего кабинета'));
  assert.match(h, /data-izm="kabinet"/);
  assert.ok(!/NaN|undefined/.test(h));
});

test('без изменений — честная строка со ссылкой на досье; блока .izm нет — встаёт перед «Динамикой»', async () => {
  const r = otvet();
  const pr = otvet({ checked_at: '2026-09-12T08:00:00Z' });
  D.html(r, { ls: null });
  const rep = fakeReport(false);
  const rez = await D.dogruzit(rep, r, { api: '', voshel: true, fetch: fakeFetch({ '/api/me/checks': SPISOK.checks, '/api/report/R-SEP': pr }, []) });
  assert.deepStrictEqual(rez.izm, []);
  assert.strictEqual(rep.vstavleno[0][0], 'pered');
  assert.match(rep.vstavleno[0][1], new RegExp('С вашей проверки 12' + NB + 'сентября существенных изменений нет'));
  assert.match(rep.vstavleno[0][1], /Сравнили с <a [^>]+>досье от/);
});

test('не вошёл, кабинет не ответил, досье другой компании, отчёт уже сменился — ничего не трогаем', async () => {
  const r = otvet();
  const zh = [];
  assert.strictEqual(await D.dogruzit(fakeReport(true), r, { api: '', voshel: false, fetch: fakeFetch({}, zh) }), null);
  assert.strictEqual(zh.length, 0, 'не вошедшему — ни одного запроса');
  const rep1 = fakeReport(true);
  assert.strictEqual(await D.dogruzit(rep1, r, { api: '', voshel: true, fetch: fakeFetch({}, []) }), null);
  assert.strictEqual(rep1.vstavleno.length, 0);
  const chuzhoj = otvet({ company: { inn: '7707083893', status: 'ACTIVE' }, checked_at: '2026-09-12T08:00:00Z' });
  const rep2 = fakeReport(true);
  assert.strictEqual(await D.dogruzit(rep2, r, { api: '', voshel: true, fetch: fakeFetch({ '/api/me/checks': SPISOK, '/api/report/R-SEP': chuzhoj }, []) }), null);
  assert.strictEqual(rep2.vstavleno.length, 0);
  // пока шёл запрос, проверили другую компанию — метка отчёта другая
  const rep3 = fakeReport(true);
  const f = fakeFetch({ '/api/me/checks': SPISOK, '/api/report/R-SEP': PROSHLYJ }, []);
  const p = D.dogruzit(rep3, r, { api: '', voshel: true, fetch: f });
  rep3.setAttribute('data-izm-k', '7707083893:1');
  assert.strictEqual(await p, null);
  assert.strictEqual(rep3.vstavleno.length, 0);
});

test('снимок браузера новее кабинета — второй запрос не делаем', async () => {
  const ls = { st: {}, getItem(k) { return this.st[k] || null; }, setItem(k, v) { this.st[k] = v; } };
  D.html(otvet({ checked_at: '2026-09-30T10:00:00Z', report_id: 'R-0930' }), { ls });
  const r = otvet();
  D.html(r, { ls });
  const zh = [];
  const rez = await D.dogruzit(fakeReport(true), r, { api: '', voshel: true, fetch: fakeFetch({ '/api/me/checks': SPISOK, '/api/report/R-SEP': PROSHLYJ }, zh) });
  assert.strictEqual(rez, null);
  assert.deepStrictEqual(zh.map((x) => x[0]), ['/api/me/checks']);
});

test('главная зовёт догрузку после раскладки листа; тексты без запрещённых слов', () => {
  const ind = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  const i1 = ind.indexOf('Otchet.razlozhit(report,r'), i2 = ind.indexOf('Dinamika.dogruzit(report,r,{api:CAPI})');
  assert.ok(i1 > 0 && i2 > i1, 'догрузка — после Otchet.razlozhit');
  const src = fs.readFileSync(path.join(KOREN, 'js/dinamika.js'), 'utf8');
  assert.ok(!/надёжн|надежн|гарант|лучш|однодневк|нейросет|(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)/i.test(src.replace(/^\s*\/\*[\s\S]*?\*\//m, '')));
});
