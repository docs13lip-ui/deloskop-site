// «ЗСК простыми словами» → «Чем грозит вам: пример»: красная зона ограничивает у поставщика списания
// и выдачу наличных, а не зачисления (п. 5–6 ст. 7.7 115-ФЗ; текст [Право] 02.10.2026 14:30).
// Фраза «платежи ему банк может задерживать или отклонять» противоречила закону — не должна вернуться.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const norm = (t) => t.replace(/&nbsp;|&#160;| /g, ' ').replace(/&#8209;|‑/g, '-');
const html = (f) => norm(fs.readFileSync(path.join(KOREN, f), 'utf8'));

function obojti(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'tests') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) obojti(p, out);
    else if (/\.(html|json|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('зачисления поставщику из красной зоны не «задерживают и не отклоняют» — нигде на сайте', () => {
  const plohie = obojti(KOREN).filter((f) => /платежи ему банк может задерживать/.test(norm(fs.readFileSync(f, 'utf8'))));
  assert.deepEqual(plohie.map((f) => path.relative(KOREN, f)), []);
});

test('пример в «ЗСК простыми словами» — текст [Право] и ссылка на «платить ли»', () => {
  const s = html('115-fz/zsk-zony-riska/index.html');
  const i = s.indexOf('Чем грозит вам: пример');
  assert.ok(i > 0);
  const blok = s.slice(i, s.indexOf('<h2', i + 10));
  // Текст [Право] 02.10 14:30 (claude/Право_ЗСК_пример_Разбор5_остаток_02.10.md, разд. 1) — дословно.
  assert.ok(blok.includes('Ваш платёж такой поставщик, скорее всего, получит, но тратить деньги с этого счёта почти не сможет: закон оставляет ему налоги, зарплату не больше, чем в прошлом месяце, и ещё несколько обязательных выплат (п. 5–6 ст. 7.7 115-ФЗ). Поставка может сорваться.'));
  assert.ok(blok.includes('href="/115-fz/proverit-kontragenta-zsk-po-inn/#platit-li"'));
  assert.ok(html('115-fz/proverit-kontragenta-zsk-po-inn/index.html').includes('id="platit-li"'));
});

test('законопроект ID 170956 — только «следить»: в sroki.json есть, на страницах нет', () => {
  const S = JSON.parse(fs.readFileSync(path.join(KOREN, 'sroki.json'), 'utf8'));
  const z = S.sroki.find((x) => x.id === 'zakonoproekt_170956_chastichnoe_sovpadenie');
  assert.ok(z && z.gde.length === 0 && /170956/.test(z.istochnik));
  const naStranicah = obojti(KOREN).filter((f) => f.endsWith('.html') && /170956|частичном совпадении/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(naStranicah.map((f) => path.relative(KOREN, f)), []);
});
