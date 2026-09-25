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
for tid in ('start', 'pro', 'biznes'):
    t = T[tid]
    ok(f'главная: {tid} помесячно {t["mesyac"]}', f'data-m="{r(t["mesyac"])}"' in main)
    ok(f'главная: {tid} в месяц при оплате за год', f'data-y="{r(math.ceil(t["god"] / 12))}"' in main)
    ok(f'главная: {tid} цена года и экономия', f'{r(t["god"])} за год — экономия {r(t["mesyac"] * 12 - t["god"])}' in main)
ok('главная: калькулятор ошибки считает от года «Про»', f'tot?{T["pro"]["god"]}/tot' in main and f'<b>{r(T["pro"]["god"])}</b>' in main)
ok('главная: ссылка на /tarify/', 'href="/tarify/' in main)
ok('главная: пакет отчётов', f'10 полных отчётов за {r(D["paket_otchetov"]["cena"])}' in main)

pg = rd('tarify/index.html')
emb = re.search(r'<script type="application/json" id="tarify-data">(.*?)</script>', pg, re.S).group(1)
ok('страница: встроенные данные = tarify.json', json.loads(emb) == D)
nb = ' '
for tid in ('start', 'pro', 'biznes'):
    t = T[tid]
    ok(f'страница: карточка {tid}', f'{t["god"]:,}'.replace(',', nb) + nb + '₽ за год' in pg)
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
ok('лента: новое обновление первым, id уникальны', ids[0] == '2026-09-26-2' and len(ids) == len(set(ids)))
ok('лента: есть что проверить со ссылками', all(x.get('ssylka') for x in ob[0]['chto_proverit']))
for f in ('115-fz/zablokirovali-schet-chto-delat/index.html', '115-fz/zsk-zony-riska/index.html'):
    ok(f'{f}: МВК — до 20 рабочих дней', not re.search(r'(комиссия рассматривает её|рассмотрение —) 15', rd(f)) and re.search(r'до 20(\u00a0|&nbsp;| )рабочих', rd(f)))
print(f'\n{n} проверок пройдено')
