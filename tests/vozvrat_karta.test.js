// vozvrat-chestno-v1 ([Ночные запуски] 12.10.2026; [Право · Юрист 115-ФЗ] 11.10 14:40 — «/vozvrat/ — строки о карте
// прятать по флагу karta, оферту не трогать»). Пока "karta": false (эквайринга и онлайн-кассы нет, гражданам — QR СБП
// без чека до кассы), страница возврата не обещает автопродление и чек возврата. Сборку в обе стороны — на копии сайта.
// node --test tests/vozvrat_karta.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const K = path.join(__dirname, '..');
// tipograf-yur-v1: юридические документы прогнаны типографом — сверяем текст без учёта вида пробела и дефиса
const bezVidaYur = (f, s) => (/^(oferta|politika|soglasie|cookies|vozvrat|rassylki|partneram\/usloviya)\//.test(f)
  ? s.replace(/<main[\s\S]*<\/main>/, (m) => m.replace(/&nbsp;|\u00a0/g, ' ').replace(/&#8209;|\u2011/g, '-')) : s); // только <main>: шапка и подвал — байт в байт
const chitat = (f) => bezVidaYur(f, fs.readFileSync(path.join(K, f), 'utf8'));
const D = JSON.parse(chitat('tarify/tarify.json'));

// видимое: без <template>, скриптов и стилей
const vidimoe = (h) => h.replace(/<template[\s\S]*?<\/template>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<style[\s\S]*?<\/style>/g, '');
const ZAPRET = [/автопродл/i, /чек возврата/i, /списани/i, /оплачивали картой/i];
const OSTAETSYA = ['В течение 10 дней с даты заявления деньги вернутся тем же способом, которым вы платили.',
  'Как вернуть', 'Основания', 'Пример: тариф «Про» за год'];

function sobrat(...flagi) { // сборки подряд в одной копии: sobrat(true, false) — туда и обратно
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vozvrat-karta-'));
  const kop = path.join(tmp, 'site');
  fs.cpSync(K, kop, { recursive: true, filter: (s) => !/[\\/](\.git|node_modules|company|__pycache__)$/.test(s) });
  const f = path.join(kop, 'tarify/tarify.json');
  for (const karta of flagi) {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    d.karta = karta;
    fs.writeFileSync(f, JSON.stringify(d, null, 2));
    execFileSync('python3', ['-W', 'ignore', 'tests/sobrat_tarify.py', '.'], { cwd: kop, stdio: 'pipe' });
  }
  const h = bezVidaYur('vozvrat/', fs.readFileSync(path.join(kop, 'vozvrat/index.html'), 'utf8'));
  fs.rmSync(tmp, { recursive: true, force: true });
  return h;
}

test('живой /vozvrat/ при karta:false — без автопродления и чека возврата', () => {
  if (D.karta !== false) return; // при подключённом эквайринге проверяет третий тест
  const v = vidimoe(chitat('vozvrat/index.html'));
  for (const z of ZAPRET) assert.ok(!z.test(v), 'на странице видно: ' + z);
  for (const s of OSTAETSYA) assert.ok(v.includes(s), 'пропало: ' + s);
});

test('разметка <!--karta--> на месте: две части, обе — внутри пары меток', () => {
  const h = chitat('vozvrat/index.html');
  const bloki = h.match(/<!--karta-->[\s\S]*?<!--\/karta-->/g) || [];
  assert.strictEqual(bloki.length, 2, 'две части: строка о чеке и раздел «Автопродление»');
  assert.ok(bloki.some((b) => b.includes('чек возврата')));
  assert.ok(bloki.some((b) => b.includes('<h2>Автопродление</h2>')));
});

test('сборка karta:true → всё видно; обратно karta:false → байт в байт как живой файл', () => {
  const da = vidimoe(sobrat(true));
  assert.ok(da.includes('При оплате картой или СБП мы направим чек возврата.'));
  assert.ok(da.includes('<h2>Автопродление</h2>'));
  assert.ok(!da.includes('data-karta'));
  const net = sobrat(true, false);
  if (D.karta === false) assert.strictEqual(net, chitat('vozvrat/index.html'), 'сборка идемпотентна');
  for (const z of ZAPRET) assert.ok(!z.test(vidimoe(net)), 'karta:false видно: ' + z);
});

test('оферту не трогаем (условия карты в ней — условные, [Право] 11.10)', () => {
  assert.ok(!chitat('oferta/index.html').includes('<!--karta-->'));
});
