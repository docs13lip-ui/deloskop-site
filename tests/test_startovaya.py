"""Стартовая цена «Старта» 390 ₽ (start390-v1): python3 tests/test_startovaya.py (из корня; вызывается и из tests/test_tarify.py).

Решение владельца 03.10.2026 ≈20:30 — claude/Решения_владельца_03.10_Старт_390_и_НДС-2027.md;
тексты сайта и оферты — [Право] 03.10.2026 21:10, разд. 1 (claude/Право_Старт_390_оферта_НДС-2027_Вокфорс_03.10.md).
Проверяем: данные; что сейчас (в бете) на сайте ничего не поменялось; и «генеральную репетицию» снятия беты
на копии репозитория — без «да» на годовую цену сборка останавливается, с «да» цена одна везде, оферта с п. 3.9,
повторная сборка ничего не меняет, tests/test_tarify.py зелёный.
"""
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(R, 'tests'))
import startovaya as STV  # noqa: E402

rd = lambda koren, p: open(os.path.join(koren, p), encoding='utf-8').read()
n = 0


def ok(name, cond):
    global n
    if not cond:
        print('✗', name)
        sys.exit(1)
    n += 1
    print('✓', name)


def kartochka_starta(pg):
    return re.search(r'<div class="plan" id="t-start">.*?<!--/v-bete-->', pg, re.S).group(0)


D = json.loads(rd(R, 'tarify/tarify.json'))
T = STV.start(D)
ST = T['startovaya']

# ---------- данные ----------
ok('данные: стартовая цена — 390 ₽ в месяц', ST['mesyac'] == 390)
ok('данные: годовая — по публичному правилу «× 12 × 0,8 вниз до сотни» (3 700 ₽, не 3 740 ₽ — [Право] разд. 0 п. 1)',
   ST['god'] == STV.god_po_pravilu(ST['mesyac'], D['skidka_god_procent']) == 3700)
ok('данные: окно первой оплаты — 14.10…31.12.2026, цена держится 12 месяцев',
   (ST['pervaya_oplata_s'], ST['pervaya_oplata_do'], ST['sohranyaetsya_mes']) == ('2026-10-14', '2026-12-31', 12))
ok('данные: обычная цена «Старта» до включения — 490 / 4 700 ₽', STV.aktivna(D) or (T['mesyac'], T['god']) == (490, 4700))
ok('данные: Про, Бизнес, разовый Паспорт — без изменений', [(t['mesyac'], t['god']) for t in D['tarify'] if t['id'] in ('pro', 'biznes')] == [(1490, 14300), (4990, 47900)]
   and D['pasport_razovyj']['cena_rub'] == 490)
ok(f'срок: до {STV.SROK_RESHENIYA:%d.%m.%Y} владелец решает цену «Старта» с 2027 года (снять поле startovaya или новое решение)',
   datetime.date.today() < STV.SROK_RESHENIYA)

# ---------- сейчас ----------
pg = rd(R, 'tarify/index.html')
of = rd(R, 'oferta/index.html')
if not STV.aktivna(D):
    ok('сейчас: стартовая цена не включена — на /tarify/ строки нет, «Старт» 490 ₽', 'class="startovaya"' not in pg and '<b data-m="490&nbsp;₽"' in kartochka_starta(pg).replace(STV.NB, '&nbsp;'))  # oplata-schet-v1: крупно — месяц или «за год», цена месяца — в data-m
    ok('сейчас: в оферте п. 3.9 ещё нет — появится вместе с ценой', 'id="start"' not in of)
else:
    ok('после включения: строка на /tarify/ и п. 3.9 в оферте', 'class="startovaya"' in pg and '<li id="start">' in of)

# ---------- репетиция снятия беты на копии ----------
tmp = tempfile.mkdtemp(prefix='start390-')
K = os.path.join(tmp, 'site')
shutil.copytree(R, K, ignore=shutil.ignore_patterns('.git', 'node_modules'))


def zapis(d):
    p = os.path.join(K, 'tarify/tarify.json')
    s = open(p, encoding='utf-8').read()
    s = s.replace('"beta": true', '"beta": false', 1)
    s = re.sub(r'("startovaya": \{.*?"god_soglasovan": )(true|false)', lambda m: m.group(1) + ('true' if d else 'false'), s, count=1)
    open(p, 'w', encoding='utf-8').write(s)


sobrat = lambda: subprocess.run([sys.executable, 'tests/sobrat_tarify.py', '.'], cwd=K, capture_output=True, text=True)
try:
    if not STV.aktivna(D):
        zapis(False)
        r = sobrat()
        ok('репетиция: без «да» на годовую цену сборка останавливается и говорит, что делать',
           r.returncode != 0 and 'god_soglasovan' in (r.stderr + r.stdout) and '3 700' in (r.stderr + r.stdout))
        ok('репетиция: остановка ничего не испортила (tarify.json и оферта прежние)',
           '"mesyac": 490, "god": 4700' in rd(K, 'tarify/tarify.json') and 'id="start"' not in rd(K, 'oferta/index.html'))
        zapis(True)
        r = sobrat()
        ok('репетиция: с «да» сборка проходит', r.returncode == 0)
        D2 = json.loads(rd(K, 'tarify/tarify.json'))
        T2 = STV.start(D2)
        ok('репетиция: tarify.json — «Старт» 390 / 3 700 ₽, прежняя цена и дата включения записаны',
           (T2['mesyac'], T2['god']) == (390, 3700) and T2['startovaya']['obychnaya'] == {'mesyac': 490, 'god': 4700}
           and T2['startovaya']['primenena'] == datetime.date.today().isoformat())
        ok('репетиция: tarify.json изменился только в строке «Старта»',
           len([1 for a, b in zip(rd(R, 'tarify/tarify.json').split('\n'), rd(K, 'tarify/tarify.json').split('\n')) if a != b]) == 3)
        pg2, of2, gl2 = rd(K, 'tarify/index.html'), rd(K, 'oferta/index.html'), rd(K, 'index.html')
        kar = kartochka_starta(pg2).replace(STV.NB, '&nbsp;')
        ok('репетиция: /tarify/ — 390 ₽ крупно, год 3 700 ₽, экономия 980 ₽',
           '<b data-m="390&nbsp;₽"' in kar and 'или 3&nbsp;700&nbsp;₽ за год — экономия 980&nbsp;₽' in kar
           and '3&nbsp;700&nbsp;₽ одним платежом — экономия 980&nbsp;₽' in kar)
        ok('репетиция: /tarify/ — строка [Право] 1.1 дословно, со ссылкой на п. 3.9',
           'Стартовая цена&nbsp;— при первой оплате до&nbsp;31&nbsp;декабря 2026&nbsp;года. Сохраняется 12&nbsp;месяцев '
           '(<a href="/oferta/#start">п.&nbsp;3.9 оферты</a>).' in kar)
        ok('репетиция: у «Старта» нет «скидк», «490», «было», таймеров и «с 1 января» ([Право] 1.1, 38-ФЗ)',
           not re.search(r'скидк|490|было|осталось|с&nbsp;1&nbsp;января|с 1 января', kar, re.I))
        ok('репетиция: описание для поиска и главная — 390 ₽', 'Старт — 390' in pg2 and '<span data-cena="start.mesyac">390</span>' in gl2)
        ok('репетиция: оферта — п. 3.9 (#start) после п. 3.8, окно, 12 месяцев, непрерывность по п. 3.8 (г)',
           of2.index('<li id="osnovatel">') < of2.index('<li id="start">') < of2.index('<h2 id="o4">')
           and all(x in of2 for x in ('с&nbsp;14&nbsp;октября по&nbsp;31&nbsp;декабря 2026&nbsp;года включительно', '12&nbsp;месяцев', 'п.&nbsp;3.8 (г)',
                                      'Если мы станем плательщиком НДС, стартовая цена будет включать налог.')))
        ok('репетиция: оферта — счета-фактуры «пока действует освобождение» ([Право] 1.4)', 'Пока действует освобождение, счета-фактуры не&nbsp;выставляются.' in of2
           and 'п.&nbsp;1 ст.&nbsp;145 НК РФ. Счета-фактуры' not in of2)
        seg = datetime.date.today()
        ok('репетиция: оферта — новая дата редакции и dateModified',
           f'Редакция от {seg.day} {STV.MES[seg.month - 1]} {seg.year}' in of2 and f'"dateModified": "{seg.isoformat()}"' in of2)
        snimok = {p: rd(K, p) for p in ('tarify/tarify.json', 'tarify/index.html', 'oferta/index.html', 'index.html')}
        ok('репетиция: повторная сборка ничего не меняет', sobrat().returncode == 0 and all(rd(K, p) == s for p, s in snimok.items()))
        r = subprocess.run([sys.executable, 'tests/test_tarify.py'], cwd=K, capture_output=True, text=True, env=dict(os.environ, START390_BEZ_REPETICII='1'))
        ok('репетиция: tests/test_tarify.py на включённой цене — зелёный', r.returncode == 0)
        r = subprocess.run(['node', '--test', 'tests/tarify.test.js', 'tests/razovye_oferta.test.js', 'tests/limit.test.js', 'tests/beta.test.js'],
                           cwd=K, capture_output=True, text=True)
        ok('репетиция: node-тесты тарифов, оферты, экрана лимита и беты на включённой цене — зелёные', r.returncode == 0)
        js = ("const L=require('./js/limit.js');const T=require('./tarify/tarify.json');"
              "process.stdout.write(String(L.iz(T).start.mesyac))")
        r = subprocess.run(['node', '-e', js], cwd=K, capture_output=True, text=True)
        ok('репетиция: экран лимита (js/limit.js) читает 390 ₽ из того же файла', r.stdout.strip() == '390')
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f'\n{n} проверок стартовой цены пройдено')
