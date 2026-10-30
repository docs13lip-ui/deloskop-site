// forma-razbora-v1 (30.10.2026, [Ночные запуски]): ИНН — прямо в блоке действия разбора.
// Было: под разбором кнопка «Проверить покупателя по ИНН» вела на главную, и ИНН там вводили заново.
// Стало: поле ИНН и кнопка в тёмном блоке; форма уходит на /?inn=… — главная сразу строит отчёт (innIzAdresa).
// 1) Кнопка на главную про одну компанию («… по ИНН», «Проверить по ИНН», «Проверить свою компанию») — форма;
//    остальные (Скорая, Щит, выписка, Паспорт, «Проверь счёт», «Проверить контрагентов») — ссылкой, как были.
// 2) Форма: GET на «/», поле inn (10 или 12 цифр, обязательное, цифровая клавиатура), подпись = подсказка,
//    цель Метрики — та же knopka.cel; кнопка — текст из dela.json; ровно одна главная кнопка в блоке.
// 3) Подпись поля — из кнопки: «Проверить покупателя по ИНН» → «ИНН покупателя».
// 4) Вид: в ряд на компьютере, столбиком на телефоне; рамка поля ≥ 3 : 1, подсказка ≥ 4,5 : 1 к фону блока.
// 5) Отправка формы считается целью praktika_cta (sposob «forma»), как раньше клик по ссылке.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const D = JSON.parse(chitat('praktika/dela.json'));
const RAZBORY = D.razbory || D;
const KOMU = /^Проверить ([а-яё]+[ая]) по ИНН$/;
const forma = (k) => k.url === '/' && (KOMU.test(k.knopka) || k.knopka === 'Проверить по ИНН' || k.knopka.startsWith('Проверить свою компанию'));
const blok = (s) => { const m = s.match(/<section class="dl"[\s\S]*?<\/section>/); return m ? m[0] : ''; };

test('у разборов с проверкой одной компании — поле ИНН в блоке действия; у остальных — ссылка', () => {
  let n = 0;
  for (const r of RAZBORY) {
    const s = chitat(`praktika/${r.razdel}/${r.slug}/index.html`);
    const b = blok(s);
    assert.ok(b, `${r.slug}: нет блока действия`);
    const k = r.knopka;
    if (forma(k)) {
      n += 1;
      assert.ok(!/<a class="btn"/.test(b), `${r.slug}: осталась ссылка-кнопка`);
      const f = b.match(/<form class="dl__f" action="\/" method="get"( data-goal="([a-z0-9_]+)")? data-otkuda="razbor">([\s\S]*?)<\/form>/);
      assert.ok(f, `${r.slug}: нет формы GET на «/»`);
      assert.strictEqual(f[2] || null, k.cel || null, `${r.slug}: цель Метрики`);
      const inp = f[3].match(/<input [^>]*>/)[0];
      for (const a of ['name="inn"', 'inputmode="numeric"', 'maxlength="12"', 'pattern="\\d{10}|\\d{12}"', ' required'])
        assert.ok(inp.includes(a), `${r.slug}: у поля нет ${a}`);
      const pod = inp.match(/placeholder="([^"]+)"/)[1];
      assert.ok(inp.includes(`aria-label="${pod}"`), `${r.slug}: подпись поля ≠ подсказке`);
      assert.ok(/^ИНН [а-яё ]+$/.test(pod), `${r.slug}: подпись «${pod}»`);
      const kn = f[3].match(/<button class="btn" type="submit">([^<]+)<\/button>/);
      assert.ok(kn, `${r.slug}: нет кнопки отправки`);
      assert.strictEqual(kn[1].replace(/\u00a0/g, ' '), k.knopka, `${r.slug}: текст кнопки`);
      if (/ по ИНН$/.test(k.knopka)) assert.ok(kn[1].endsWith('по\u00a0ИНН'), `${r.slug}: «по ИНН» не рвётся`);
    } else {
      assert.ok(!/<form/.test(b), `${r.slug}: форма там, где действие — не проверка одной компании`);
      assert.ok(/<a class="btn" href="[^"]+"/.test(b), `${r.slug}: нет ссылки-кнопки`);
    }
    assert.strictEqual((b.match(/class="btn"/g) || []).length, 1, `${r.slug}: одна главная кнопка`);
  }
  assert.ok(n >= 13, 'форм подозрительно мало: ' + n);
});

test('подпись поля — из кнопки (винительный = родительный у одушевлённых)', () => {
  const pole = (slug) => {
    const r = RAZBORY.find((x) => x.slug === slug);
    return blok(chitat(`praktika/${r.razdel}/${r.slug}/index.html`)).match(/placeholder="([^"]+)"/)[1];
  };
  assert.strictEqual(pole('zalog-odna-veshch-iz-pyati-vs-2026'), 'ИНН покупателя');
  assert.strictEqual(pole('podarok-ot-roditelya-ip-ndfl-vs-2026'), 'ИНН арендатора');
  assert.strictEqual(pole('reorganizaciya-kontragenta-dosrochnyj-vozvrat-ks-17-p'), 'ИНН правопреемника');
  assert.strictEqual(pole('utochnenka-i-peni-ens'), 'ИНН вашей компании');
  assert.strictEqual(pole('isklyuchili-iz-egryul-dolg-s-direktora'), 'ИНН компании');
});

test('главная берёт ИНН из адреса и сразу строит отчёт', () => {
  const g = chitat('index.html');
  assert.ok(/function innIzAdresa\(\)/.test(g) && g.includes("new URLSearchParams(location.search).get('inn')"));
});

// контраст: смесь белого с альфой поверх фона блока
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const kontrast = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const smes = (fon, al) => fon.map((c) => Math.round(c + (255 - c) * al));

test('вид формы: ряд → столбик на телефоне; рамка ≥ 3 : 1, подсказка ≥ 4,5 : 1 (светлая и тёмная тема)', () => {
  const css = chitat('css/praktika.css');
  assert.ok(/\.pr \.dl__f\{display:flex;flex-wrap:wrap/.test(css));
  assert.ok(/@media \(max-width:520px\)\{\.pr \.dl__f\{flex-direction:column\}\.pr \.dl__f input,\.pr \.dl__f \.btn\{width:100%\}\.pr \.dl__f input\{flex:0 0 auto\}/.test(css), 'в столбике поле не растягивается в высоту (flex-basis 220px)');
  assert.ok(/\.pr \.dl__f input\{[^}]*min-height:50px/.test(css), 'поле той же высоты, что кнопка (≥ 44 px)');
  assert.ok(/\.pr \.dl__f input:focus\{outline:2px solid var\(--accent\)/.test(css), 'видимый фокус');
  const ramka = +css.match(/\.pr \.dl__f input\{[^}]*border:1\.5px solid var\(--dl-ramka,rgba\(255,255,255,(\.\d+)\)\)/)[1];
  const pole = +css.match(/\.pr \.dl__f input\{[^}]*background:var\(--dl-pole,rgba\(255,255,255,(\.\d+)\)\)/)[1];
  // блок тёмный в обеих темах: авто-слой тёмной темы не должен «переводить» цвета поля
  assert.ok(!/\.dl__f/.test(chitat('css/tema.css')), 'css/tema.css перекрашивает поле формы разбора');
  const pods = hex(css.match(/\.pr \.dl__f input::placeholder\{color:(#[0-9A-Fa-f]{6})/)[1]);
  const svetlaya = hex(css.match(/--dark:(#[0-9A-Fa-f]{6})/)[1]);
  const temnaya = hex(chitat('css/tema.css').match(/--dark:(#[0-9A-Fa-f]{3,6})/)[1].replace(/^#(\w)(\w)(\w)$/, '#$1$1$2$2$3$3'));
  for (const fon of [svetlaya, temnaya]) {
    assert.ok(kontrast(smes(fon, ramka), fon) >= 3, 'рамка поля: ' + kontrast(smes(fon, ramka), fon).toFixed(2));
    assert.ok(kontrast(pods, smes(fon, pole)) >= 4.5, 'подсказка: ' + kontrast(pods, smes(fon, pole)).toFixed(2));
    assert.ok(kontrast([255, 255, 255], smes(fon, pole)) >= 4.5, 'набранный ИНН');
  }
});

test('отправка формы разбора — цель praktika_cta (sposob «forma»)', () => {
  const m = chitat('js/metrika.js');
  assert.ok(/function izRazboraForma\(e\)[\s\S]*?closest\("\.pr \.dl form"\)[\s\S]*?"praktika_cta"[\s\S]*?sposob: "forma"/.test(m));
  assert.ok(/addEventListener\("submit", izRazboraForma, true\)/.test(m));
});
