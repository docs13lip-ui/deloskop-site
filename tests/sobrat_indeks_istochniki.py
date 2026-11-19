#!/usr/bin/env python3
"""dostovernost-v1 (аудит 19.11, п. 22 (а)): строка над группой «Суды и долги» на /indeks/ — из реестра источников.

Было: «Источники этой группы мы пока не подключили — её факторы в балл не входят», написано руками, а реестр
(data/istochniki.json) отмечал картотеку арбитражных дел, ФССП и ЕФРСБ как подключённые, и отчёт их показывал.
Теперь строку собирает этот сборщик: что подключено и с какой датой, что заморожено, какие факторы группы уже идут в балл
(faktory_v_balle — сверяется с js/indeks-otvet.js в tests/test_indeks_istochniki.py).

    python3 tests/sobrat_indeks_istochniki.py          — пересобрать
    python3 tests/sobrat_indeks_istochniki.py --check  — только проверить (1 — если страница разошлась с реестром)
"""
import json
import pathlib
import re
import sys

KOREN = pathlib.Path(__file__).resolve().parent.parent
STRANICA = KOREN / 'indeks' / 'index.html'
REESTR = KOREN / 'data' / 'istochniki.json'
GRUPPA = 'dolgi'
NACH, KON = '<!--ist-gruppa-->', '<!--/ist-gruppa-->'
NB = '&nbsp;'


def metodika(html):
    m = re.search(r'<script type="application/json" id="metodika">(.*?)</script>', html, re.S)
    return json.loads(m.group(1))


def data_ru(iso):
    g, m, d = iso.split('-')
    return f'{d}.{m}.{g}'


def spisok(xs):
    xs = list(xs)
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' и ' + xs[-1]


def tipograf(t):
    t = t.replace(' — ', NB + '— ')
    # короткие слова (1–2 буквы) не оставляем в конце строки
    t = re.sub(r'(?<![\wа-яё])([а-яёА-ЯЁ]{1,2}) ', lambda m: m.group(1) + NB, t)
    return t


def stroka(html=None, reestr=None):
    html = html if html is not None else STRANICA.read_text(encoding='utf8')
    reestr = reestr if reestr is not None else json.loads(REESTR.read_text(encoding='utf8'))
    M = metodika(html)
    faktory = [f for f in M['faktory'] if f['gruppa'] == GRUPPA]
    nuzhny = []
    for f in faktory:
        if f['istochnik'] not in nuzhny:
            nuzhny.append(f['istochnik'])
    po_id = {s.get('metodika'): s for s in reestr['istochniki'] if s.get('metodika')}
    ist = [po_id[k] for k in nuzhny if k in po_id]
    if len(ist) != len(nuzhny):
        raise SystemExit('в реестре нет источника методики: ' + ', '.join(k for k in nuzhny if k not in po_id))
    podkl = [s for s in ist if s['sostoyanie'] == 'podklyuchen']
    zamor = [s for s in ist if s['sostoyanie'] == 'zamorozhen']
    nepod = [s for s in ist if s['sostoyanie'] == 'ne_podklyuchen']
    chasti = []
    if podkl:
        cherez = sorted({s['cherez'] for s in podkl if s.get('cherez')})
        imena = spisok(s['nazvanie'] for s in podkl)
        chasti.append(imena + ' подключены' + (' через ' + spisok(cherez) if cherez else '') +
                      ': в отчёте видны их сведения на день проверки, они идут в полноту данных.')
    v_balle = []
    for s in ist:
        for fid in s.get('faktory_v_balle') or []:
            f = next(f for f in faktory if f['id'] == fid)
            v_balle.append('«' + f['tekst'] + '»')
    if v_balle:
        chasti.append('В балл из этой группы пока входит только ' + spisok(v_balle) +
                      '; остальные факторы группы описаны, но ещё не считаются.')
    else:
        chasti.append('Факторы этой группы в балл пока не входят.')
    for s in zamor:
        chasti.append(s['nazvanie'] + ' — сведения на ' + data_ru(s['zamorozhen_s']) +
                      ', источник сейчас не обновляется; в балл не входит.')
    for s in nepod:
        chasti.append(s['nazvanie'] + ' пока не подключён.')
    chasti.append('Здесь описана полная методика, к которой идём.')
    return NACH + tipograf(' '.join(chasti)) + KON


def sobrat(check=False):
    html = STRANICA.read_text(encoding='utf8')
    s = stroka(html)
    m = re.search(r'(<tr class="gr-net"><td colspan="3">)(.*?)(</td></tr>)', html, re.S)
    if not m:
        raise SystemExit('на /indeks/ нет строки gr-net над группой «Суды и долги»')
    novyj = html[:m.start(2)] + s + html[m.end(2):]
    if novyj == html:
        print('/indeks/: строка группы «Суды и долги» совпадает с реестром источников')
        return 0
    if check:
        print('/indeks/: строка группы «Суды и долги» разошлась с data/istochniki.json — python3 tests/sobrat_indeks_istochniki.py')
        return 1
    STRANICA.write_text(novyj, encoding='utf8')
    print('/indeks/: строка группы «Суды и долги» пересобрана из реестра источников')
    return 0


if __name__ == '__main__':
    sys.exit(sobrat('--check' in sys.argv))
