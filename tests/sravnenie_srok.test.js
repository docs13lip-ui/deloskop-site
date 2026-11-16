// sravnenie-srok-v1 (16.11.2026): /sravnit/ — обе проверки со сроком, повтором и без «чужого» ответа (как главная, skorost-otveta-v1).
// node --test tests/sravnenie_srok.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const S = require('../js/sravnenie.js');
const ROOT = path.join(__dirname, '..');
const sp = (s) => String(s).replace(/ /g, ' ');

// окно-заглушка: таймеры вручную, fetch — по сценарию
function okno(otvety) {
  const timers = [];
  let id = 0, vyzovy = 0;
  class AC { constructor() { this.signal = { aborted: false, on: null }; } abort() { this.signal.aborted = true; if (this.signal.on) this.signal.on(); } }
  const w = {
    AbortController: AC,
    setTimeout(f, ms) { timers.push({ id: ++id, f, ms }); return id; },
    clearTimeout(i) { const k = timers.findIndex((t) => t.id === i); if (k >= 0) timers.splice(k, 1); },
    fetch(u, opt) {
      const sc = otvety[vyzovy++] || 'visit';
      return new Promise((res, rej) => {
        if (opt.signal) opt.signal.on = () => rej(new Error('abort'));
        if (sc === 'visit') return; // висит до abort
        if (sc === 'set') return rej(new TypeError('Failed to fetch'));
        res({ status: sc.s, ok: sc.s >= 200 && sc.s < 300, json: () => Promise.resolve(sc.j || {}) });
      });
    },
  };
  w.tik = async (ms) => { // запустить таймеры со сроком ≤ ms
    await new Promise((r) => setImmediate(r));
    timers.filter((t) => t.ms <= ms).forEach((t) => { w.clearTimeout(t.id); t.f(); });
    await new Promise((r) => setImmediate(r));
  };
  w.vyzovy = () => vyzovy;
  return w;
}

test('срок 40 с: зависший источник отвечает {tajmaut}, без повтора', async () => {
  const w = okno(['visit']), Z = S.sozdatZapros(w), moj = Z.novaya();
  const p = Z.zapros('/api/check?q=1', moj);
  await w.tik(S.SROK_MS);
  const x = await p;
  assert.strictEqual(x.ok, false); assert.strictEqual(x.tajmaut, true); assert.strictEqual(w.vyzovy(), 1);
});

test('обрыв сети и 502 — один тихий повтор; второй обрыв — {set}', async () => {
  let w = okno([{ s: 502 }, { s: 200, j: { company: { inn: '1' } } }]), Z = S.sozdatZapros(w);
  let p = Z.zapros('/x', Z.novaya());
  await w.tik(1500);
  let x = await p;
  assert.strictEqual(x.ok, true); assert.strictEqual(x.n, 1); assert.strictEqual(w.vyzovy(), 2);
  w = okno(['set', 'set']); Z = S.sozdatZapros(w);
  p = Z.zapros('/x', Z.novaya());
  await w.tik(1500);
  x = await p;
  assert.strictEqual(x.set, true); assert.strictEqual(w.vyzovy(), 2);
});

test('новое сравнение отменяет прежние запросы: их ответ не приходит в таблицу', async () => {
  const w = okno(['visit', 'visit']), Z = S.sozdatZapros(w);
  const m1 = Z.novaya();
  const p1 = Z.zapros('/a', m1), p2 = Z.zapros('/b', m1);
  const m2 = Z.novaya(); // отменяет оба
  assert.ok(!Z.svezhaya(m1) && Z.svezhaya(m2));
  await assert.rejects(p1, (e) => e && e.stalo === 1);
  await assert.rejects(p2, (e) => e && e.stalo === 1);
});

test('текст ошибки: какая компания и почему; повтор — только когда он может помочь', () => {
  const ok = { ok: true, s: 200 };
  let t = S.tekstOshibki({ ok: false, s: 0, tajmaut: true }, ok);
  assert.match(sp(t.tekst), /^Не получилось проверить первую компанию: реестры не ответили за 40 секунд — так бывает/);
  assert.strictEqual(t.povtor, true);
  t = S.tekstOshibki(ok, { ok: false, s: 422, j: { detail: 'Компания не найдена.' } });
  assert.strictEqual(t.tekst, 'Не получилось проверить вторую компанию: компания не найдена.');
  assert.strictEqual(t.povtor, false);
  t = S.tekstOshibki(ok, { ok: false, s: 422, j: { detail: [{ msg: 'x' }] } }); // список FastAPI — не выводим
  assert.strictEqual(t.tekst, 'Не получилось проверить вторую компанию: сервер не принял запрос.');
  t = S.tekstOshibki({ ok: false, s: 0, set: true }, { ok: false, s: 0, set: true });
  assert.strictEqual(t.tekst, 'Не получилось проверить обе компании: сервис не ответил, проверьте интернет.');
  t = S.tekstOshibki({ ok: false, s: 503 }, { ok: false, s: 0, set: true });
  assert.strictEqual(t.tekst, 'Не получилось проверить обе компании: первую — сервер не смог собрать отчёт, вторую — сервис не ответил, проверьте интернет.');
  assert.deepStrictEqual([S.vidOshibki({ ok: false, s: 504 }), S.vidOshibki({ ok: false, s: 404 }), S.vidOshibki(ok)], ['server', '', '']);
});

test('страница: запросы только через sozdatZapros, ожидание «дольше обычного», кнопка и стиль повтора', () => {
  const js = fs.readFileSync(path.join(ROOT, 'js/sravnenie.js'), 'utf8');
  const mount = js.slice(js.indexOf('function mount('));
  assert.doesNotMatch(mount, /w\.fetch\(/, 'fetch — только внутри sozdatZapros (срок и повтор)');
  assert.match(mount, /Реестры отвечают дольше обычного…/);
  assert.match(mount, /Сравнить ещё раз/);
  assert.match(mount, /check_oshibka', \{ stranica: 'sravnit'/);
  const css = fs.readFileSync(path.join(ROOT, 'css/sravnit.css'), 'utf8');
  assert.match(css, /\.sv-forma \.sv-povtor\{[^}]*background:none[^}]*min-height:44px/, 'ссылка, а не вторая кнопка формы');
  assert.match(mount, /ubratChuzhuyu\(a, b\);\n\s+var t = tekstOshibki/, 'таблица другой пары под ошибкой не остаётся');
});
