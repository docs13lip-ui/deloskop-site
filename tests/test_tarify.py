"""Сверка цен и страниц: python3 tests/test_tarify.py (из корня репозитория)."""
import json, math, os, re, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
D = json.loads(rd('tarify/tarify.json'))
T = {t['id']: t for t in D['tarify']}
n = 0
def ok(name, cond):
    global n
    if not cond:
        print('✗', name); sys.exit(1)
    n += 1; print('✓', name)

def r(x):  # как на главной: обычный пробел
    return f'{x:,}'.replace(',', ' ') + ' ₽'

main = rd('index.html')
ok('главная: переключатель «−20%»', 'За год <em>−20%</em>' in main)
ok('главная: по умолчанию «Помесячно»', '<button type="button" data-period="m" class="on" aria-pressed="true">Помесячно</button>' in main)
for tid in ('start', 'pro', 'biznes'):
    t = T[tid]
    ek = t["mesyac"] * 12 - t["god"]
    ok(f'главная: {tid} крупно цена месяца {t["mesyac"]}', f'data-m="{r(t["mesyac"])}" data-y="{r(math.ceil(t["god"] / 12))}">{r(t["mesyac"])}</b>' in main)
    rn = lambda x: f'{x:,}'.replace(',', '\u00a0') + '\u00a0₽'
    ok(f'главная: {tid} под ценой — год и экономия (неразрывные пробелы)', f'>или {rn(t["god"])} за год — экономия {rn(ek)}</div>' in main)
    ok(f'главная: {tid} две кнопки', f'data-tarif="{tid}" data-srok="mes"' in main and f'data-tarif="{tid}" data-srok="god"' in main
       and f'>Оплатить год — {r(t["god"])}</a>' in main)
ok('главная: кнопок «Оплачивать помесячно» — три', main.count('>Оплачивать помесячно</a>') == 3)
ok('главная: старых «Подключить «…»» не осталось', 'Подключить «' not in main)
ok('главная: калькулятор ошибки считает от года «Про»', f'tot?{T["pro"]["god"]}/tot' in main and f'<b>{r(T["pro"]["god"])}</b>' in main)
ok('главная: ссылка на /tarify/', 'href="/tarify/' in main)
ok('главная: пакет отчётов', f'10 полных отчётов за {r(D["paket_otchetov"]["cena"])}' in main)

pg = rd('tarify/index.html')
sys.path.insert(0, os.path.join(R, 'tests'))
import beta as _B  # beta-v1: кнопки оплаты проверяем в «платном» виде — они спрятаны, а не потеряны
_platnyj = lambda t: _B.vidimoe(_B.primenit(t, False, polosa=''))
emb = re.search(r'<script type="application/json" id="tarify-data">(.*?)</script>', pg, re.S).group(1)
ok('страница: встроенные данные = tarify.json', json.loads(emb) == D)
nb = ' '
R_ = lambda x: f'{x:,}'.replace(',', nb) + nb + '₽'
ok('страница: по умолчанию «Помесячно»', '<button type="button" data-period="mes" aria-pressed="true" class="on">Помесячно</button>' in pg)
ok('страница: tarify.js стартует с помесячно', 'var period = "mes"' in rd('tarify/tarify.js'))
for tid in ('start', 'pro', 'biznes'):
    t = T[tid]
    ek = t["mesyac"] * 12 - t["god"]
    ok(f'страница: карточка {tid} — месяц крупно', f'>{R_(t["mesyac"])}</b><span data-m="в месяц" data-y="в месяц при оплате за год">в месяц</span>' in pg)
    ok(f'страница: карточка {tid} — год и экономия', f'>или {R_(t["god"])} за год — экономия {R_(ek)}</div>' in pg)
    ok(f'страница: карточка {tid} — две кнопки', f'data-tarif="{tid}" data-srok="mes"' in pg and f'>Оплатить год — {R_(t["god"])}</a>' in pg)
ok('страница: цены месяца в описании для поиска', all(R_(T[x]["mesyac"]) in re.search(r'<meta name="description" content="([^"]+)"', pg).group(1) for x in ('start', 'pro', 'biznes')))
ok('страница: FAQ «Можно платить помесячно?»', 'Можно платить помесячно?' in pg)
ok('страница: по счёту — месяц, квартал или год', 'по счёту</a> на месяц, квартал или год' in pg)
ok('страница: canonical', '<link rel="canonical" href="https://deloskop.ru/tarify/">' in pg)
ok('страница: нет «цифра пробел %»', not re.search(r'\d[  ]%', re.sub(r'<(script|style)[^>]*>.*?</\1>', '', pg, flags=re.S)))
ok('страница: FAQ-разметка', '"FAQPage"' in pg)
for href in set(re.findall(r'href="(/[^"#?]*)', pg)):
    p = href.strip('/')
    exists = os.path.exists(os.path.join(R, p, 'index.html')) or os.path.exists(os.path.join(R, p)) or p == ''
    ok(f'ссылка {href} существует', exists)

ok('sitemap: /tarify/', '<loc>https://deloskop.ru/tarify/</loc>' in rd('sitemap.xml'))
ob = json.loads(rd('obnovleniya.json'))['obnovleniya']
ids = [o['id'] for o in ob]
ok('лента: запись тарифов есть, id уникальны', '2026-09-26-3' in ids and len(ids) == len(set(ids)))
ok('лента: есть что проверить со ссылками', all(x.get('ssylka') for x in ob[0]['chto_proverit']))
for f in ('115-fz/zablokirovali-schet-chto-delat/index.html', '115-fz/zsk-zony-riska/index.html'):
    ok(f'{f}: МВК — до 20 рабочих дней', not re.search(r'(комиссия рассматривает её|рассмотрение —) 15', rd(f)) and re.search(r'до 20(\u00a0|&nbsp;| )рабочих', rd(f)))
# ---------- п. 23: кнопки тарифов ведут на форму «Получить счёт», а не в mailto ----------
import re as _re2
for _nm, _html in (('страница', _platnyj(pg)), ('главная', _platnyj(open(os.path.join(R, 'index.html'), encoding='utf-8').read()))):
    _kn = _re2.findall(r'<a class="cta[^"]*" data-tarif="([a-z]+)" data-srok="([a-z]+)" href="([^"]+)"', _html)
    ok(f'{_nm}: 6 кнопок тарифов с data-tarif/data-srok', len(_kn) == 6)
    ok(f'{_nm}: кнопки ведут на /schet/ с тем же тарифом и сроком',
       all(h == f'/schet/?tarif={t}&amp;srok={s}' for t, s, h in _kn))
    ok(f'{_nm}: нет mailto на кнопках тарифов', 'mailto:help@deloskop.ru?subject' not in _html)
    ok(f'{_nm}: подключена форма js/schet.js', '<script src="/js/schet.js" defer></script>' in _html)
    ok(f'{_nm}: «часть доказательств», а не «доказательство осмотрительности»', 'доказательство осмотрительности' not in _html)
ok('страница: «Без НДС» с нормой', 'освобождён от НДС (п. 1 ст. 145 НК РФ)' in pg)
_sp = open(os.path.join(R, 'schet/index.html'), encoding='utf-8').read()
ok('/schet/: noindex и не в sitemap', 'name="robots" content="noindex"' in _sp and '/schet/' not in open(os.path.join(R, 'sitemap.xml'), encoding='utf-8').read())
ok('/schet/dokument/: noindex', 'content="noindex"' in open(os.path.join(R, 'schet/dokument/index.html'), encoding='utf-8').read())

# п. 72 (а): на главной нет годовых цен, которых нет в tarify.json (на живом 26.09 были 4 900 / 14 900 / 49 900 против 4 700 / 14 300 / 47 900)
_goda = {T[x]["god"] for x in ('start', 'pro', 'biznes')}
_na_glavnoj = {int(re.sub(r'\D', '', m)) for m in re.findall(r'(\d[\d\u00a0\u202f ]*)[\u00a0 ]₽ за год', main)}
ok('главная: все цены «за год» = tarify.json', _na_glavnoj <= _goda and len(_na_glavnoj) > 0)
ok('главная и /tarify/: подпись «в месяц при оплате за год» у цены года', main.count('data-y="в месяц при оплате за год"') == 3 and pg.count('data-y="в месяц при оплате за год"') == 3)

print(f'\n{n} проверок пройдено')
