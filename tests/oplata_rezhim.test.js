// oplata-rezhim-v1 — сторож «живое = режим» (п. 428 Очереди; claude/Экосистема_одно_состояние_оплаты_31.10.md).
// Один выключатель — tarify/tarify.json → "oplata_rezhim" (pauza | schet | vse); флаги и сборка — tests/oplata_rezhim.py.
// Проверяем собранный сайт, а не намерения: каждая страница с половинами <!--oplata--> / <!--v-bete--> показывает
// ту половину, которую требует режим; QR СБП (qr.nspk.ru) есть только при vse; /tarify/ собран из того же tarify.json.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const R = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(R, 'tarify', 'tarify.json'), 'utf8'));
const REZHIM = D.oplata_rezhim;
const FLAGI = {
  pauza: { beta: true, karta: false, oplata_kartoj: false },
  schet: { beta: false, karta: false, oplata_kartoj: false },
  vse: { beta: false },
};
const PROPUSK = new Set(['.git', 'node_modules', 'сайт', 'tests', 'deploy']);

function fajly(dir, ext, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (PROPUSK.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fajly(p, ext, out);
    else if (ext.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}
const HTML = fajly(R, ['.html']);
const BLOK = /<!--oplata-->([\s\S]*?)<!--\/oplata-->(?:<!--v-bete-->([\s\S]*?)<!--\/v-bete-->)?/g;
const vTemplate = (s, tag) => s === '' || (s.startsWith('<template ' + tag + '>') && s.endsWith('</template>'));
const rel = (p) => path.relative(R, p);

test('tarify.json: режим оплаты — pauza, schet или vse, и флаги с ним сходятся', () => {
  assert.ok(['pauza', 'schet', 'vse'].includes(REZHIM), '"oplata_rezhim" = ' + JSON.stringify(REZHIM));
  for (const [k, v] of Object.entries(FLAGI[REZHIM])) {
    assert.strictEqual(D[k], v, `"${k}" при режиме ${REZHIM} должен быть ${v} — меняйте режим: python3 tests/oplata_rezhim.py ${REZHIM}`);
  }
  // без онлайн-кассы деньги граждан не принимаем; касса есть — значит и режим vse
  assert.strictEqual(D.kassa === true, REZHIM === 'vse', '"kassa": true ⇔ режим vse');
});

test('каждая страница показывает половину, которую требует режим', () => {
  const pauza = REZHIM === 'pauza';
  const ploho = [];
  let blokov = 0;
  for (const f of HTML) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(BLOK)) {
      blokov++;
      const opl = m[1];
      const bet = m[2] || '';
      const ok = pauza ? vTemplate(opl, 'data-oplata') && !(bet && vTemplate(bet, 'data-v-bete'))
                       : !(opl && vTemplate(opl, 'data-oplata')) && vTemplate(bet, 'data-v-bete');
      if (!ok) { ploho.push(rel(f)); break; }
    }
  }
  assert.ok(blokov > 20, 'половин оплаты на сайте подозрительно мало: ' + blokov);
  assert.deepStrictEqual(ploho, [], `не в режиме ${REZHIM} (запустите python3 tests/oplata_rezhim.py ${REZHIM})`);
});

test('метка режима для скриптов: «beta» на /tarify/ и /schet/ — только при паузе', () => {
  for (const f of ['tarify/index.html', 'schet/index.html']) {
    const s = fs.readFileSync(path.join(R, f), 'utf8');
    assert.strictEqual(s.includes('<meta name="deloskop-rezhim" content="beta">'), REZHIM === 'pauza', f);
  }
});

test('QR СБП (рабочая ссылка qr.nspk.ru) — только в режиме vse', () => {
  const QR = /qr\.nspk\.ru\/[A-Z0-9]{8,}/;  // настоящая ссылка банка, а не упоминание в комментарии
  const s = fajly(R, ['.html', '.js']).filter((f) => QR.test(fs.readFileSync(f, 'utf8'))).map(rel);
  if (REZHIM !== 'vse') assert.deepStrictEqual(s, [], 'ссылка НСПК на сайте без кассы');
});

test('/tarify/ собран из этого же tarify.json (режим в странице = режим в источнике)', () => {
  const s = fs.readFileSync(path.join(R, 'tarify', 'index.html'), 'utf8');
  const m = s.match(/<script type="application\/json" id="tarify-data">([\s\S]*?)<\/script>/);
  assert.ok(m, 'нет tarify-data на /tarify/');
  assert.strictEqual(JSON.parse(m[1]).oplata_rezhim, REZHIM, 'запустите python3 tests/sobrat_tarify.py .');
});
