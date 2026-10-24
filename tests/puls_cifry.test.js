// Сторож «Пульса проекта» на /o-proekte/ ([Ночные запуски] puls-cifry-v1, 24.10.2026).
// Было: числа стояли руками на 11.10 («285 обновлений», «112 карточек», «18 разборов», «44 статьи»),
// скрипт страницы через полсекунды подменял 285 на длину ленты — число прыгало на глазах,
// а три других отставали. Теперь их пишет tests/sobrat_lentu.py из файлов сайта; здесь сверяем.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'o-proekte', 'index.html'), 'utf8');
const lenta = JSON.parse(fs.readFileSync(path.join(ROOT, 'obnovleniya.json'), 'utf8')).obnovleniya;
const MES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function cifry() {
  const re = /<div class="cifra"><b(?: data-c="\w+")?>(\d+)<\/b><span(?: data-c-l)?>(.*?)<\/span><\/div>/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push({ n: +m[1], podpis: m[2] });
  return out;
}
function stranicy(hab) {
  let n = 0;
  const obhod = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = path.join(d, e.name);
      if (fs.existsSync(path.join(p, 'index.html'))) n++;
      obhod(p);
    }
  };
  obhod(path.join(ROOT, hab));
  return n;
}
function forma(n, f) {
  const d = n % 100, k = n % 10;
  return d > 10 && d < 20 ? f[2] : k === 1 ? f[0] : k > 1 && k < 5 ? f[1] : f[2];
}

test('четыре числа «Пульса» — по файлам сайта', () => {
  const c = cifry();
  assert.strictEqual(c.length, 4, 'на /o-proekte/ четыре цифры');
  const kart = fs.readdirSync(path.join(ROOT, 'company'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{10}(\d{2})?-/.test(e.name)
      && fs.existsSync(path.join(ROOT, 'company', e.name, 'index.html'))).length;
  const razb = JSON.parse(fs.readFileSync(path.join(ROOT, 'praktika', 'dela.json'), 'utf8')).razbory.length;
  const stati = stranicy('115-fz') + stranicy('nalogi');
  assert.deepStrictEqual(c.map((x) => x.n), [lenta.length, kart, razb, stati]);
});

test('число записей совпадает с тем, что поставит скрипт страницы — ничего не прыгает', () => {
  const c = cifry()[0];
  assert.strictEqual(c.n, lenta.length);
  const f = forma(lenta.length, ['обновление', 'обновления', 'обновлений']);
  assert.strictEqual(c.podpis.replace(/&nbsp;/g, ' '), f + ' в ленте с 25 сентября 2026',  // tipograf-daty-v1: год — тоже неразрывно
   
    'подпись — та же, что пишет скрипт (textContent)');
  assert.match(html, /z\.textContent=a\.length/, 'скрипт по-прежнему берёт длину ленты');
});

test('формы слов при числе', () => {
  const [z, k, r, s] = cifry();
  assert.ok(z.podpis.startsWith(forma(z.n, ['обновление', 'обновления', 'обновлений']) + ' '));
  assert.ok(k.podpis.startsWith(forma(k.n, ['карточка', 'карточки', 'карточек']) + ' '));
  assert.ok(r.podpis.startsWith(forma(r.n, ['разбор', 'разбора', 'разборов']) + ' '));
  assert.ok(s.podpis.startsWith(forma(s.n, ['статья', 'статьи', 'статей']) + ' '));
  assert.strictEqual(forma(21, ['разбор', 'разбора', 'разборов']), 'разбор');
  assert.strictEqual(forma(112, ['карточка', 'карточки', 'карточек']), 'карточек');
});

test('«Цифры на …» — день верхней записи ленты', () => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(lenta[0].id);
  const den = +m[3] + '&nbsp;' + MES[+m[2] - 1] + '&nbsp;' + m[1];  // tipograf-daty-v1
  assert.ok(html.includes('<p class="cap">Цифры на&nbsp;' + den + '.</p>'), 'подпись: ' + den);
});
