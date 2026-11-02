// sverka-odna-data-v1 ([Ночные запуски] 02.11.2026): на одной странице — одна дата сверки.
// Было на живом: /nalogi/nedruzhestvennye-gosudarstva-perechen/ — «Перечень сверен 30 октября 2026» под таблицей
// и «Действующая редакция сверена 10 октября 2026 года» в «Источниках»; dateModified 2026-10-10.
// Две даты сверки на одной странице — читатель не знает, какой верить. Карточки /company/ не смотрим: у них своя сборка.
// Запуск: node --test tests/sverka_odna_data.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const MES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const DATA = new RegExp('[Сс]верен[аоы]?\\s+(\\d{1,2} (?:' + MES.join('|') + ') 20\\d\\d)', 'g');
const NE_SMOTRIM = new Set(['company', 'node_modules', '.git', 'tests']);

function stranicy(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) { if (!NE_SMOTRIM.has(f.name)) stranicy(path.join(dir, f.name), out); }
    else if (f.name === 'index.html') out.push(path.join(dir, f.name));
  }
  return out;
}
const plain = (t) => t.replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('на каждой странице все «сверен(а) <дата>» совпадают', () => {
  const vse = stranicy(KOREN, []);
  assert.ok(vse.length > 50, 'страниц найдено: ' + vse.length);
  const raznye = [];
  for (const f of vse) {
    const d = new Set([...plain(fs.readFileSync(f, 'utf8')).matchAll(DATA)].map((m) => m[1]));
    if (d.size > 1) raznye.push(path.relative(KOREN, f) + ': ' + [...d].join(' / '));
  }
  assert.deepStrictEqual(raznye, []);
});

test('недружественные: дата сверки под таблицей, в «Источниках» и dateModified — из data_sverki; сборщик без изменений', () => {
  const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/nedruzhestvennye-430r.json'), 'utf8'));
  const s = fs.readFileSync(path.join(KOREN, 'nalogi/nedruzhestvennye-gosudarstva-perechen/index.html'), 'utf8');
  const [g, m, d] = D.istochnik.data_sverki.split('-');
  const ru = Number(d) + ' ' + MES[Number(m) - 1] + ' ' + g;
  const t = plain(s);
  assert.ok(t.includes('Перечень сверен ' + ru), 'под таблицей');
  assert.ok(t.includes('Действующая редакция сверена ' + ru + ' года.'), 'в источниках');
  const dm = s.match(/"dateModified": "(\d{4}-\d{2}-\d{2})"/)[1];
  assert.ok(dm >= D.istochnik.data_sverki, 'dateModified ' + dm + ' < ' + D.istochnik.data_sverki);
  execFileSync('python3', [path.join(KOREN, 'tests/sobrat_nedruzh.py'), '--check'], { stdio: 'pipe' });
});
