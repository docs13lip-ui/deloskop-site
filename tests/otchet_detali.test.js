// otchet-detali-v1 (19.10.2026): сторож деталей отчёта на телефоне.
// 1) вкладки отчёта — одна строка при 3 и 4 вкладках (390 и 600 px); 2) рамка-сирота у кольца Индекса в тёмной теме —
// тёмный слой повторяет сброс свойства ниже по каскаду; 3) ссылки на первоисточник называют его, разные цели — разный текст;
// 4) «на 0 ₽» в итоге судов → «сумма исков в картотеке не указана»; 5) режим отчёта прячет витрину и разделы главной.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const NB = '\u00a0';
const I = require(path.join(KOREN, 'js/istochniki.js'));
let pw = null;
try { pw = require('playwright'); } catch (e) { pw = null; }

test('ссылки «проверить …»: известные первоисточники названы, у разных адресов — разный текст', () => {
  const sprav = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/reestry-sami.json'), 'utf8'));
  const adresa = sprav.reestry.map((x) => x.ssylka).concat([
    'https://kad.arbitr.ru/', 'https://bankrot.fedresurs.ru/', 'https://fedresurs.ru/', 'https://fssp.gov.ru/iss/ip/',
    'https://zakupki.gov.ru/epz/dishonestsupplier/search/results.html', 'https://service.nalog.ru/bi.do',
    'https://www.cbr.ru/fmp_check/', 'https://www.cbr.ru/finorg/foinfo/?ogrn=1027700132195', 'https://egrul.nalog.ru/']);
  const poTekstu = new Map();
  for (const u of adresa) {
    const t = I.samiTekst(u);
    assert.ok(/^проверить /.test(t), u + ' → ' + t);
    assert.notStrictEqual(t, 'проверьте сами', u);
    const host = new URL(u).host + new URL(u).pathname.split('/')[1];
    if (poTekstu.has(t)) assert.strictEqual(poTekstu.get(t), host, 'один текст у разных первоисточников: ' + t);
    poTekstu.set(t, host);
  }
  assert.strictEqual(I.samiTekst('https://kad.arbitr.ru/'), 'проверить в' + NB + 'картотеке арбитражных дел');
  assert.strictEqual(I.samiTekst('https://example.org/x'), 'проверить на' + NB + 'example.org');
  assert.strictEqual(I.samiTekst(''), 'проверьте сами');
});

test('модули отчёта зовут samiTekst, а не пишут «проверьте сами» сами', () => {
  for (const f of ['js/sushchestvennoe.js', 'js/otkuda.js', 'js/reestry-sami.js']) {
    const s = fs.readFileSync(path.join(KOREN, f), 'utf8');
    assert.ok(/samiT\(/.test(s), f);
    assert.ok(!/>проверьте сами<\/a>/.test(s), f + ': текст ссылки зашит');
  }
});

test('суды: «на 0 ₽» → «сумма исков в картотеке не указана»; ненулевая сумма — как была', () => {
  const b = { itog: 'Дел, где компания — ответчик: 2, из них по нашей оценке не завершены 2 на 0' + NB + '₽. Сведения на 12.10.2026, 11:40.' };
  I.sudyNol(b);
  assert.strictEqual(b.itog, 'Дел, где компания — ответчик: 2, из них по нашей оценке не завершены 2; сумма исков в' + NB + 'картотеке не' + NB + 'указана. Сведения на 12.10.2026, 11:40.');
  assert.ok(b.itog_prezhnij.includes('на 0'));
  const c = { itog: 'не завершены 3 на 1,2 млн ₽.' }; I.sudyNol(c);
  assert.strictEqual(c.itog, 'не завершены 3 на 1,2 млн ₽.');
  assert.strictEqual(c.itog_prezhnij, undefined);
});

test('тёмный слой повторяет сброс свойства ниже по каскаду (рамка-сирота у кольца Индекса на 390)', () => {
  const kod = 'import sys; sys.path.insert(0, "tests"); import tema_temnaya as t; print(t.pravila(sys.stdin.read()))';
  const css = '.a{border-right:1px solid rgba(0,0,0,.08);padding:4px}@media (max-width:520px){.a{border-right:0}.b{border:0}}';
  const out = execFileSync('python3', ['-c', kod], { cwd: KOREN, input: css, encoding: 'utf8' });
  assert.ok(out.includes('[data-theme=dark] .a{border-right:1px solid rgba(255,255,255,0.132)}'), out);
  assert.ok(/@media \(max-width:520px\)\{\[data-theme=dark\] \.a\{border-right:0\}\}/.test(out), out);
  assert.ok(!out.includes('.b{'), 'селектор без перекраски — не трогаем: ' + out);
  const tema = fs.readFileSync(path.join(KOREN, 'css/tema.css'), 'utf8');
  assert.ok(/@media \(max-width:520px\)\{\[data-theme=dark\] \.ex-ix\{border-right:0\}/.test(tema), 'css/tema.css пересобран');
  assert.ok(/@media \(max-width:860px\)\{\[data-theme=dark\] \.ot-ix\{border-right:0\}/.test(tema), 'css/tema.css: .ot-ix');
});

test('режим отчёта: разделы главной скрыты, под отчётом — «Другие инструменты»; номер проверки — в подвале отчёта', () => {
  const css = fs.readFileSync(path.join(KOREN, 'css/otchet.css'), 'utf8');
  assert.ok(css.includes('.rezhim-otcheta main#top>:not(.hero){display:none}'));
  const js = fs.readFileSync(path.join(KOREN, 'js/otchet.js'), 'utf8');
  assert.ok(/'ot-dr'/.test(js) && /data-goal="otchet_drugie"/.test(js));
  assert.ok(/'ot-nom'/.test(js));
  const idx = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  assert.ok(/<main id="top">\s*<section class="hero/.test(idx), 'первый раздел главной — .hero (его режим отчёта оставляет)');
  for (const u of ['/proverit-schet/', '/kontragenty-iz-vypiski/', '/nalichnye/', '/skoraya-115-fz/', '/praktika/']) {
    assert.ok(fs.existsSync(path.join(KOREN, u, 'index.html')), u);
  }
});

test('Chromium 390 и 600: 3 и 4 вкладки — одна строка, без выхода за полосу', { skip: !pw && 'нет playwright' }, async () => {
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  let b;
  try { b = await pw.chromium.launch(exe ? { executablePath: exe } : {}); } catch (e) { return; }
  const css = fs.readFileSync(path.join(KOREN, 'css/vizual2.css'), 'utf8');
  const kn = (n) => ['Все факты', 'Глазами банка', 'Глазами налоговой', 'Связи'].slice(0, n)
    .map((t, i) => '<button type="button" role="tab" aria-selected="' + (i ? 'false' : 'true') + '">' + t + '</button>').join('');
  try {
    for (const w of [360, 390, 600]) {
      const p = await b.newPage({ viewport: { width: w, height: 600 } });
      await p.setContent('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css +
        '</style><body style="margin:0;font:16px system-ui"><div style="padding:0 20px"><div class="ex-vid ot-vid" role="tablist">' + kn(4) +
        '</div></div><div class="ex-vid" role="tablist">' + kn(3) + '</div></body>');
      const r = await p.$$eval('[role=tablist]', (ls) => ls.map((l) => {
        const L = l.getBoundingClientRect();
        const t = [...l.children].map((x) => x.getBoundingClientRect());
        return { strok: new Set(t.map((x) => Math.round(x.top))).size, vne: t.filter((x) => x.right > L.right + 0.5 || x.left < L.left - 0.5).length, h: Math.min(...t.map((x) => x.height)) };
      }));
      for (const x of r) {
        assert.strictEqual(x.strok, 1, w + ': вкладки в одну строку');
        assert.strictEqual(x.vne, 0, w + ': вкладка за краем полосы');
        assert.ok(x.h >= 44, w + ': высота ' + x.h);
      }
      await p.close();
    }
  } finally { await b.close(); }
});
