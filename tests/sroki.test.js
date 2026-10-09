// Цифры с датой жизни (sroki.json): ни одна ставка, порог или срок на сайте не устареет молча.
// Краснеет: (1) со следующего дня после proverit_do; (2) если фразы из gde больше нет в файле
// (текст поменяли — поправьте sroki.json); (3) если дата ставки ЦБ разошлась с tarify.json.
// Запуск: node --test tests/sroki.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const S = JSON.parse(fs.readFileSync(path.join(KOREN, 'sroki.json'), 'utf8'));
const T = JSON.parse(fs.readFileSync(path.join(KOREN, 'tarify/tarify.json'), 'utf8'));
const norm = (t) => t.replace(/&nbsp;|&#160;| | /g, ' ');
const segodnyaMsk = (d = new Date()) => new Date(d.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);

test('sroki.json: у каждой цифры есть всё нужное', () => {
  const ids = new Set();
  assert.ok(S.sroki.length >= 10);
  for (const s of S.sroki) {
    assert.ok(/^[a-z0-9_]+$/.test(s.id), 'id: ' + s.id);
    assert.ok(!ids.has(s.id), 'повтор id ' + s.id); ids.add(s.id);
    for (const k of ['cifra', 'pochemu_menyaetsya', 'sverka', 'otvetstvennyj']) assert.ok(s[k], s.id + ': нет ' + k);
    assert.match(s.istochnik, /^https:\/\//, s.id + ': источник — ссылка');
    assert.ok(!/(kontur|zachestnyibiznes|rusprofile|checko|list-org)\./.test(s.istochnik), s.id + ': источник — первоисточник, не сервис');
    assert.match(s.proverit_do, /^\d{4}-\d{2}-\d{2}$/, s.id);
    assert.ok(Array.isArray(s.gde), s.id);
  }
});

test('sroki.json: фразы на месте — цифра действительно стоит на сайте', () => {
  for (const s of S.sroki) for (const g of s.gde) {
    const f = path.join(KOREN, g.fajl);
    assert.ok(fs.existsSync(f), `${s.id}: нет файла ${g.fajl}`);
    assert.ok(norm(fs.readFileSync(f, 'utf8')).includes(norm(g.ishchem)),
      `${s.id}: в ${g.fajl} больше нет «${g.ishchem}». Текст поменяли — обновите sroki.json (фразу и сверку).`);
  }
});

test('sroki.json: ни одна цифра не просрочена', () => {
  const d = segodnyaMsk();
  const prosrocheno = S.sroki.filter((s) => d > s.proverit_do)
    .map((s) => `${s.id} (${s.cifra}) — перепроверить до ${s.proverit_do}, отвечает ${s.otvetstvennyj}, источник ${s.istochnik}`);
  assert.deepEqual(prosrocheno, [], 'Пора сверить цифры:\n' + prosrocheno.join('\n'));
});

test('sroki.json: дата ставки ЦБ — та же, что в tarify.json', () => {
  const s = S.sroki.find((x) => x.id === 'stavka_cb');
  assert.equal(s.proverit_do, T.raschet.klyuchevaya_stavka_sleduyushchee_reshenie);
});

test('sroki.json: логика дат — день срока зелёный, следующий красный', () => {
  assert.equal('2026-12-15' > '2026-12-15', false);
  assert.equal('2026-12-16' > '2026-12-15', true);
  assert.equal(segodnyaMsk(new Date('2026-12-15T21:30:00Z')), '2026-12-16');
});

// usn_limit_2027_deflyator (10.10.2026, [Ночные запуски]): цифры из проектов (приказ не принят) — в «ne_publikuem».
// Краснеет, если такая цифра появилась на странице, в скрипте или данных сайта раньше, чем её разрешили [Право].
test('sroki.json: цифры «не публикуем» не стоят на сайте', () => {
  const zapret = S.sroki.flatMap((s) => (s.ne_publikuem || []).map((f) => [s.id, f]));
  assert.ok(zapret.length >= 1);
  const propusk = new Set(['.git', 'node_modules', 'tests', 'deploy', '.github']);
  const fajly = [];
  const obojti = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (propusk.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) obojti(p);
      else if (/\.(html|js|json|xml|txt)$/.test(e.name) && !['sroki.json', 'obnovleniya.json'].includes(e.name)) fajly.push(p);
    }
  };
  obojti(KOREN);
  assert.ok(fajly.length > 100, 'обход сайта');
  const najdeno = [];
  for (const f of fajly) {
    const t = norm(fs.readFileSync(f, 'utf8'));
    for (const [id, fr] of zapret) if (t.includes(fr)) najdeno.push(`${path.relative(KOREN, f)}: «${fr}» (${id})`);
  }
  assert.deepEqual(najdeno, [], 'Цифра из проекта попала на сайт — до опубликования акта не ставим:\n' + najdeno.join('\n'));
});
