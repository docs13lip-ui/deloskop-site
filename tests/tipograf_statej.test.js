// tipograf-statej-v1 (17.10.2026, [Ночные запуски]): в статьях /115-fz/ и /nalogi/ предлоги не висят в конце строки,
// «6 месяцев», «30 000 ₽», «слово — тире» и «115‑ФЗ» не рвутся переносом (Дизайн_система_v1: неразрывные пробелы).
// Красный тест → python3 tests/tipograf_statej.py (правит сам, повторный запуск ничего не меняет) → закоммитить.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const SKRIPT = path.join(__dirname, 'tipograf_statej.py');

function tipograf(html) {
  const kod = 'import sys,importlib.util as u;s=u.spec_from_file_location("t",sys.argv[1]);m=u.module_from_spec(s);'
    + 's.loader.exec_module(m);sys.stdout.write(m.statya(sys.stdin.read()))';
  return execFileSync('python3', ['-c', kod, SKRIPT], { input: html, encoding: 'utf8' });
}

test('статьи /115-fz/ и /nalogi/ доведены типографом', () => {
  execFileSync('python3', [SKRIPT, '--check'], { stdio: 'pipe' });
});

test('правила: короткие слова, числа, тире, номера, 115‑ФЗ', () => {
  const v = tipograf('<article><p>Ответьте в срок по 115-ФЗ — за 6 месяцев, штраф 30 000 ₽, ст. 7 и № 595-ФЗ.</p></article>');
  assert.strictEqual(v, '<article><p>Ответьте в&nbsp;срок по&nbsp;115&#8209;ФЗ&nbsp;— за&nbsp;6&nbsp;месяцев, штраф 30&nbsp;000&nbsp;₽, '
    + 'ст.&nbsp;7 и&nbsp;№&nbsp;595&#8209;ФЗ.</p></article>');
});

test('не трогаем: атрибуты, скрипты, служебные блоки сборщиков, текст вне <article>, слова и буквы', () => {
  const html = '<p>в шапке</p><article><a title="в банк" href="/a/">в банк</a><script>var s = "в банк";</script>'
    + '<!--faq--><p>в банк</p><!--/faq--><code>и т. д.</code><p>Лев в банке</p></article><p>в подвале</p>';
  const v = tipograf(html);
  assert.ok(v.startsWith('<p>в шапке</p>') && v.endsWith('<p>в подвале</p>'));
  assert.ok(v.includes('title="в банк"') && v.includes('var s = "в банк";') && v.includes('<!--faq--><p>в банк</p><!--/faq-->'));
  assert.ok(v.includes('<code>и т. д.</code>'));
  assert.ok(v.includes('>в&nbsp;банк</a>') && v.includes('Лев в&nbsp;банке'), '«в» на конце слова «Лев» — не предлог');
  const bez = (s) => s.replace(/&nbsp;/g, ' ').replace(/&#8209;/g, '-');
  assert.strictEqual(bez(v), html, 'меняются только пробелы и дефис');
  assert.strictEqual(tipograf(v), v, 'повторный запуск ничего не меняет');
});

test('страница «Запрос банка»: «Коротко» без висячих предлогов, символ NBSP — только сущностью', () => {
  const s = fs.readFileSync(path.join(KOREN, '115-fz/zapros-banka-po-115-fz-kak-otvetit/index.html'), 'utf8');
  const lead = s.match(/<div class="lead">([\s\S]*?)<\/div>/)[1];
  assert.ok(lead.includes('Отвечайте в&nbsp;срок из&nbsp;запроса'));
  assert.ok(!/(?:^|[\s>])(?:в|и|а|к|с|у|о|по|на|не|до|от|за|из) [а-яё]/i.test(lead), 'висячий предлог в «Коротко»');
  assert.ok(!s.includes('\u00a0'), 'NBSP символом — только &nbsp;');
});
