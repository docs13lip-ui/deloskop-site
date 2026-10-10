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
# glavnaya-v2 (01.10): на главной — не карточки тарифов, а строка «Сколько стоит» с ценами из tarify.json;
# калькулятор ошибки — на своей странице /nalogi/kalkulyator-tehnicheskij-postavshchik/
nbr = lambda x: f'{x:,}'.replace(',', '\u00a0')
for tid in ('start', 'pro', 'biznes'):
    ok(f'главная: {tid} — цена месяца из tarify.json', f'<span data-cena="{tid}.mesyac">{nbr(T[tid]["mesyac"])}</span>' in main)
ok('главная: строка «Сколько стоит» — скидка за год из tarify.json (20%)',
   all(round((1 - T[x]['god'] / (T[x]['mesyac'] * 12)) * 100) in (20, 21) for x in ('start', 'pro', 'biznes')) and 'на&nbsp;20% дешевле' in main)
ok('главная: кнопок оплаты нет — они на /tarify/', 'data-tarif=' not in main and 'Оплачивать помесячно' not in main)
ok('главная: ссылка на /tarify/', 'href="/tarify/"' in main)
ok('главная: ссылка на калькулятор', 'href="/nalogi/kalkulyator-tehnicheskij-postavshchik/"' in main)
KALK = rd('nalogi/kalkulyator-tehnicheskij-postavshchik/index.html')
ok('калькулятор: год «Про» из tarify.json', f'<span data-cena="pro.god">{nbr(T["pro"]["god"])}</span>' in KALK)
ok('калькулятор: считает от года «Про» со страницы, а не от зашитой цифры', "data-cena=\"pro.god\"" in KALK and 'GOD/tot' in KALK)

pg = rd('tarify/index.html')
sys.path.insert(0, os.path.join(R, 'tests'))
import beta as _B  # beta-v1: кнопки оплаты проверяем в «платном» виде — они спрятаны, а не потеряны
_platnyj = lambda t: _B.vidimoe(_B.primenit(t, False, polosa=''))
emb = re.search(r'<script type="application/json" id="tarify-data">(.*?)</script>', pg, re.S).group(1)
import copy as _copy  # tarify-bez-karty-v1: сборщик ставит dlya_bez_karty вместо dlya при "karta": false и убирает поле
_De = _copy.deepcopy(D)
for _t in _De['tarify']:
    _bk = _t.pop('dlya_bez_karty', None)
    if _bk and _De.get('karta') is False:
        _t['dlya'] = _bk
ok('страница: встроенные данные = tarify.json', json.loads(emb) == _De)
nb = ' '
R_ = lambda x: f'{x:,}'.replace(',', nb) + nb + '₽'
# oplata-schet-v1 (владелец 10.10.2026, п. 2): без карты по умолчанию «За год», с картой — «Помесячно» (владелец 26.09.2026)
_god0 = D.get('karta', True) is False
if _god0:
    ok('страница: по счёту по умолчанию «За год»', '<button type="button" data-period="god" aria-pressed="true" class="on">За год <em>−20%</em></button>' in pg
       and '<button type="button" data-period="mes" aria-pressed="false">Помесячно</button>' in pg)
else:
    ok('страница: по умолчанию «Помесячно»', '<button type="button" data-period="mes" aria-pressed="true" class="on">Помесячно</button>' in pg)
ok('страница: tarify.js берёт начальный период с нажатой кнопки', '[data-period][aria-pressed="true"]' in rd('tarify/tarify.js') and 'var period = "mes"' not in rd('tarify/tarify.js'))
for tid in ('start', 'pro', 'biznes'):
    t = T[tid]
    ek = t["mesyac"] * 12 - t["god"]
    if _god0:
        mg = -(-t["god"] // 12)
        ok(f'страница: карточка {tid} — за год: месяц при оплате за год крупно', f'>{R_(mg)}</b><span data-m="в месяц" data-y="в месяц при оплате за год">в месяц при оплате за год</span>' in pg)
        ok(f'страница: карточка {tid} — год одним платежом и экономия', f'>{R_(t["god"])} одним платежом — экономия {R_(ek)}</div>' in pg)
        ok(f'страница: карточка {tid} — главная «Оплатить год», вторая «Счёт на месяц — цена»',
           re.search(f'data-tarif="{tid}" data-srok="god" (data-oplata-)?href="/schet/\\?tarif={tid}&amp;srok=god">Оплатить год</a>', pg)
           and re.search(f'data-tarif="{tid}" data-srok="mes" (data-oplata-)?href="/schet/\\?tarif={tid}&amp;srok=mes">Счёт на месяц — {R_(t["mesyac"])}</a>', pg))
    else:
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
for _nm, _html in (('страница', _platnyj(pg)),):  # glavnaya-v2: на главной кнопок тарифов больше нет
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
_na_glavnoj = {int(re.sub(r'\D', '', m)) for m in re.findall(r'(\d[\d\u00a0\u202f ]*)(?:&nbsp;|[\u00a0 ])₽ за год', main)}
ok('главная: годовых цен руками нет (glavnaya-v2 — только строка с месяцем)', _na_glavnoj <= _goda)
ok('/tarify/: подпись «в месяц при оплате за год» у цены года', pg.count('data-y="в месяц при оплате за год"') == 3)

# ---------- tarify-v3: прайс «после беты» (владелец 30.09.2026) — ступени, разовые, дополнения ----------
PK, PR, PS = D['paket_pasportov'], D['pasport_razovyj'], D['pasport_svoj']
ok('v3: пакета «10 полных отчётов — 990 ₽» больше нет (99 ₽ за штуку против 490 ₽ разового)', 'paket_otchetov' not in D
   and all('10 полных отчётов' not in rd(f) for f in ('index.html', 'tarify/index.html', 'osnovatel/index.html', 'tarify/tarify.js')))
ok('v3: пакет — 3 развёрнутые проверки за 990 ₽', (PK['shtuk'], PK['cena_rub']) == (3, 990) and PK.get('razovo') is True)
ok('v3: разовый Паспорт — 490 ₽, Паспорт своей компании — 990 ₽ в год, в «Про» бесплатно',
   PR['cena_rub'] == 490 and PS['cena_rub'] == 990 and PS['srok'] == 'god' and PS['v_tarife'] == 'pro')
_sht = PK['cena_rub'] / PK['shtuk']
ok('v3: лестница цены — разовый дороже штуки в пакете, штука в пакете дороже Паспорта в любом тарифе',
   PR['cena_rub'] > _sht and all(_sht > T[x]['mesyac'] / T[x]['otchetov'] for x in ('start', 'pro', 'biznes')))
ok('v3: в тарифах развёрнутых проверок 3 / 20 / 80', [T[x]['otchetov'] for x in ('start', 'pro', 'biznes')] == [3, 20, 80]
   and all(f'{T[x]["otchetov"]} развёрнут' in ' '.join(T[x]['chto']) for x in ('start', 'pro', 'biznes')))
ok('v3: бесплатно — 3 быстрые проверки в день, в тарифах быстрые без лимита', '3 быстрые проверки в день' in T['free']['chto']
   and all('Быстрые проверки без лимита' in T[x]['chto'] for x in ('start', 'pro')))
ok('v3: «Паспорт своей компании» — в «Про»', 'Паспорт своей компании с проверкой подлинности' in T['pro']['chto'])
_vse = main + pg + rd('osnovatel/index.html')
ok('v3: слов «полный отчёт» и «базовые проверки» на страницах цен больше нет', not re.search(r'полн\w+ отч[её]т|Базов\w+ провер', _vse))
ok('v3: цены не обещают DaMIA — «контроль блокировок у партнёров» снят', 'блокировок у 3 партнёров' not in _vse and 'DaMIA' not in pg)
_DOP = D['dopolneniya']
ok('v3: «Сторож» — 190 / 490 / 990 ₽ за 10 / 50 / 200 компаний', [(u['kompanij'], u['mesyac']) for u in _DOP['storozh']['urovni']] == [(10, 190), (50, 490), (200, 990)])
ok('v3: +1 сотрудник в «Про» — 745 ₽ (половина месяца «Про»)', _DOP['sotrudnik_pro']['mesyac'] * 2 == T['pro']['mesyac'])
ok('v3: «Исполнители» — только после уведомления РКН: на сайте не показываем', _DOP['ispolniteli']['pokazyvat'] is False and 'Исполнители' not in re.sub(r'<script type="application/json" id="tarify-data">.*?</script>', '', pg, flags=re.S))
_vid = _B.vidimoe(pg)
_pl = _platnyj(pg)
for k, p in (('pasport_razovyj', PR), ('paket_pasportov', PK), ('pasport_svoj', PS)):
    c = f'{p["cena_rub"]:,}'.replace(',', nb)
    ok(f'v3: /tarify/ — карточка {k}, цена из tarify.json', f'id="r-{k}"' in pg and f'<span data-cena="{k}">{c}</span>' in pg)
    ok(f'v3: /tarify/ — {k}: без беты кнопка «Купить» ведёт в форму счёта', f'data-schet data-produkt="{k}" href="/schet/?produkt={k}">Купить за {c}{nb}₽</a>' in _pl)
    ok(f'v3: js/schet.js знает, что будет после оплаты {k}', f'    {k}: "' in rd('js/schet.js'))
if D.get('beta') is True:
    ok('v3: в бете у разовых — «В бете — бесплатно», кнопок «Купить» не видно', 'Купить за' not in _vid and _vid.count('В бете — бесплатно') >= 3 + 3)
for x in _DOP.values():
    if isinstance(x, dict) and x.get('pokazyvat') and not x.get('gotovo'):
        ok(f'v3: «{x["nazvanie"]}» — в строке «скоро», без кнопки', f'<li><b>{x["nazvanie"]}</b>' in pg and 'data-produkt="' + [k for k, v in _DOP.items() if v is x][0] not in pg)
ok('v3: во встроенных данных калькулятора — пакет развёрнутых проверок', '"paket_pasportov"' in pg)

# ---------- start390-v1: стартовая цена «Старта» (решение владельца 03.10.2026) — данные и репетиция снятия беты ----------
if not os.environ.get('START390_BEZ_REPETICII'):
    import subprocess as _sp
    _r = _sp.run([sys.executable, os.path.join(R, 'tests', 'test_startovaya.py')], capture_output=True, text=True)
    print(_r.stdout.rstrip())
    ok('start390: tests/test_startovaya.py', _r.returncode == 0)

print(f'\n{n} проверок пройдено')
