// skorost-otveta-v1 (16.11.2026, план 15.11 п. 6): /api/check на главной — срок, один повтор при обрыве, без «чужого» ответа.
// node --test tests/skorost_otveta.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const h = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function telo(imya) {
  const i = h.indexOf('function ' + imya + '(');
  assert.ok(i > 0, 'нет функции ' + imya);
  let k = h.indexOf('{', i), g = 0, j = k;
  for (; j < h.length; j++) { if (h[j] === '{') g++; else if (h[j] === '}' && --g === 0) break; }
  return h.slice(i, j + 1);
}
const VARY = h.match(/var SROK_MS=40000,DOLGO_MS=12000,POVTOR_MS=1500,nomerProverki=0,acProverki=null,dolgoT=0,STALO=\{stalo:1\};/);

// Песочница: таймеры — ручные (крутим время сами), fetch — сценарий по номеру вызова.
function pesochnica(scenarij) {
  let seichas = 0, id = 0;
  const tajmery = [];
  const vyzovy = [];
  class AC { constructor() { this.signal = { aborted: false, l: [] }; } abort() { this.signal.aborted = true; this.signal.l.forEach((f) => f()); } }
  const ctx = {
    vyzovy, Promise, Error, String,
    window: { AbortController: AC }, AbortController: AC,
    setTimeout(f, ms) { tajmery.push({ id: ++id, f, t: seichas + ms }); return id; },
    clearTimeout(x) { const i = tajmery.findIndex((z) => z.id === x); if (i >= 0) tajmery.splice(i, 1); },
    fetch(u, opt) {
      const n = vyzovy.length; vyzovy.push(u);
      return new Promise((res, rej) => {
        if (opt.signal) opt.signal.l.push(() => { const e = new Error('abort'); e.name = 'AbortError'; rej(e); });
        scenarij(n, res, rej);
      });
    },
  };
  vm.createContext(ctx);
  vm.runInContext(VARY[0] + telo('zaprosProverki') + ';this.zp=zaprosProverki;this.novaya=function(){return ++nomerProverki};', ctx);
  async function vremya(ms) {
    const do_ = seichas + ms;
    for (;;) {
      await new Promise((r) => setImmediate(r));
      tajmery.sort((a, b) => a.t - b.t);
      const z = tajmery[0];
      if (!z || z.t > do_) break;
      tajmery.shift(); seichas = z.t; z.f();
    }
    seichas = do_;
    await new Promise((r) => setImmediate(r));
  }
  return { ctx, vremya, vyzovy };
}
const otvet = (s, j) => ({ ok: s >= 200 && s < 300, status: s, json: () => Promise.resolve(j) });

test('переменные и функции объявлены до runCheck (иначе ?inn= при загрузке получил бы NaN и вечный «чужой» ответ)', () => {
  assert.ok(VARY, 'строка переменных skorost-otveta-v1');
  const r = h.indexOf('function runCheck(v,o){');
  assert.ok(h.indexOf(VARY[0]) < r && h.indexOf('function zaprosProverki(') < r && h.indexOf('function oshibkaProverki(') < r);
});

test('обычный ответ — сразу, без повтора', async () => {
  const p = pesochnica((n, res) => res(otvet(200, { company: { inn: '7707083893' } })));
  const m = p.ctx.novaya();
  const x = await p.ctx.zp('/api/check?q=7707083893', m);
  assert.strictEqual(x.s, 200); assert.strictEqual(x.n, 0); assert.strictEqual(p.vyzovy.length, 1);
});

test('обрыв сети — один тихий повтор через 1,5 с; второй обрыв — ошибка «set», без третьего запроса', async () => {
  let p = pesochnica((n, res, rej) => (n === 0 ? rej(new TypeError('Failed to fetch')) : res(otvet(200, {}))));
  let x = p.ctx.zp('/u', p.ctx.novaya());
  await p.vremya(1400); assert.strictEqual(p.vyzovy.length, 1, 'до 1,5 с не повторяем');
  await p.vremya(200); assert.strictEqual(p.vyzovy.length, 2);
  x = await x; assert.strictEqual(x.n, 1, 'n=1 — повтор помог (цель sost: povtor_pomog)');

  p = pesochnica((n, res, rej) => rej(new TypeError('Failed to fetch')));
  const z = p.ctx.zp('/u', p.ctx.novaya()).then(() => 'ok', (e) => e);
  await p.vremya(5000);
  const e = await z;
  assert.ok(!e.tajmaut); assert.strictEqual(e.n, 1); assert.strictEqual(p.vyzovy.length, 2);
});

test('502/503/504 — один повтор; 500 и 4xx — без повтора', async () => {
  for (const [kod, zhdem] of [[502, 2], [503, 2], [504, 2], [500, 1], [422, 1], [429, 1]]) {
    const p = pesochnica((n, res) => res(otvet(n === 0 ? kod : 200, {})));
    const x = p.ctx.zp('/u', p.ctx.novaya());
    await p.vremya(2000);
    const r = await x;
    assert.strictEqual(p.vyzovy.length, zhdem, String(kod));
    assert.strictEqual(r.s, zhdem === 2 ? 200 : kod, String(kod));
  }
});

test('срок 40 с: запрос отменён, ошибка «tajmaut», повтора нет', async () => {
  const p = pesochnica(() => {}); // сервер молчит
  const z = p.ctx.zp('/u', p.ctx.novaya()).then(() => 'ok', (e) => e);
  await p.vremya(39000); assert.strictEqual(p.vyzovy.length, 1);
  await p.vremya(6000);
  const e = await Promise.race([z, new Promise((r) => setImmediate(() => r('visit')))]);
  assert.strictEqual(e.tajmaut, true); assert.strictEqual(p.vyzovy.length, 1, 'после срока не повторяем');
});

test('новая проверка: прежний ответ — STALO (отчёт не перерисует), прежний запрос отменён', async () => {
  const otlozh = [];
  const p = pesochnica((n, res) => otlozh.push(res));
  const s1 = p.ctx.zp('/a', p.ctx.novaya()).then(() => 'ok', (e) => e);
  const ac1 = p.ctx.acProverki;
  p.ctx.novaya(); if (ac1) ac1.abort(); // так делает runCheck
  const e = await Promise.race([s1, new Promise((r) => setImmediate(() => r('visit')))]);
  assert.strictEqual(e, p.ctx.STALO, 'отменённый запрос сразу отбрасывается — без повтора через 1,5 с');
  await p.vremya(5000); assert.strictEqual(p.vyzovy.length, 1, 'отменённую проверку не повторяем');
  // и ответ, пришедший уже после смены номера, тоже отбрасывается
  const p2 = pesochnica((n, res) => otlozh.push(res));
  const s2 = p2.ctx.zp('/b', p2.ctx.novaya()).then(() => 'ok', (er) => er);
  p2.ctx.novaya();
  otlozh[otlozh.length - 1](otvet(200, {}));
  assert.strictEqual(await s2, p2.ctx.STALO);
  // 502 по уже сменённой проверке — не повторяем
  const p4 = pesochnica((n, res) => otlozh.push(res));
  const s4 = p4.ctx.zp('/d', p4.ctx.novaya()).then(() => 'ok', (er) => er);
  p4.ctx.novaya(); otlozh[otlozh.length - 1](otvet(502, {}));
  await p4.vremya(5000);
  assert.strictEqual(await s4, p4.ctx.STALO); assert.strictEqual(p4.vyzovy.length, 1);
  // ответ пришёл, пока разбирали тело, началась новая проверка — тоже отбрасывается
  let telo_ = null;
  const p3 = pesochnica((n, res) => res({ ok: true, status: 200, json: () => new Promise((r) => { telo_ = r; }) }));
  const s3 = p3.ctx.zp('/c', p3.ctx.novaya()).then(() => 'ok', (er) => er);
  await p3.vremya(0);
  p3.ctx.novaya(); telo_({});
  assert.strictEqual(await s3, p3.ctx.STALO);
});

test('runCheck: номер и отмена до запроса; «дольше обычного» через 12 с; STALO молча; ошибки — с кнопкой и целью', () => {
  const r = telo('runCheck');
  const f = r.indexOf('zaprosProverki(');
  assert.ok(r.indexOf('var moj=++nomerProverki') > 0 && r.indexOf('acProverki.abort()') < f);
  assert.match(r, /DOLGO_MS\)/);
  assert.match(r, /note\.textContent='Реестры отвечают дольше обычного…'/, 'одной строкой на 390 px — иначе сдвиг вёрстки');
  assert.match(r, /\.catch\(function\(e\)\{if\(e===STALO\)return;clearTimeout\(dolgoT\)/);
  assert.match(r, /dlkGoal\('check_oshibka',\{vid:tj\?'tajmaut':'set'/);
  assert.match(r, /dlkGoal\('check_oshibka',\{vid:'server',kod:String\(x\.s\)\}\)/);
  assert.match(r, /sost:'povtor_pomog'/);
  assert.match(r, /typeof x\.j\.detail==='string'/, 'detail списком (422) не печатать как [object Object]');
  assert.doesNotMatch(r, /fetch\(CAPI/, 'запрос — только через zaprosProverki');
  // ключи цели — из белого списка Метрики
  const km = fs.readFileSync(path.join(__dirname, '..', 'js', 'metrika.js'), 'utf8').match(/var KLYUCHI = \{([\s\S]*?)\};/)[1];
  for (const k of ['vid', 'kod', 'n', 'sost']) assert.ok(new RegExp('\\b' + k + ': 1').test(km), k);
});

test('oshibkaProverki: текст и кнопка «Проверить ещё раз», нажатие — та же проверка', () => {
  let vyzov = null;
  const uzly = [];
  const note = { className: '', textContent: '', appendChild(b) { uzly.push(b); } };
  const ctx = {
    note, runCheck(v, o) { vyzov = [v, o]; },
    document: { createElement() { return { l: {}, addEventListener(t, f) { this.l[t] = f; } }; } },
  };
  vm.createContext(ctx);
  vm.runInContext(telo('oshibkaProverki') + ';oshibkaProverki("Сервис не ответил.","7707083893",{primer:true});', ctx);
  assert.strictEqual(note.className, 'note err');
  assert.strictEqual(uzly.length, 1);
  assert.strictEqual(uzly[0].type, 'button');
  assert.strictEqual(uzly[0].textContent, 'Проверить ещё раз');
  uzly[0].l.click();
  assert.strictEqual(JSON.stringify(vyzov), JSON.stringify(['7707083893', { primer: true }]));
  assert.match(h, /\.note-povtor\{[^}]*color:inherit/, 'кнопка — цветом строки, без своего цвета числом');
});
