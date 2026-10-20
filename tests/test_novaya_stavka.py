#!/usr/bin/env python3
"""stavka-cb-v1: tests/novaya_stavka.py меняет ставку ЦБ согласованно во всех местах (на копии файлов)."""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KALK = 'nalogi/kalkulyator-tehnicheskij-postavshchik/index.html'
FAJLY = ['tarify/tarify.json', 'sroki.json', KALK]
ok = 0


def prognat(*argi):
    tmp = tempfile.mkdtemp()
    for f in FAJLY:
        os.makedirs(os.path.join(tmp, os.path.dirname(f)), exist_ok=True)
        shutil.copy(os.path.join(KOREN, f), os.path.join(tmp, f))
    r = subprocess.run([sys.executable, os.path.join(KOREN, 'tests', 'novaya_stavka.py'), '--bez-sborki', *argi],
                       env={**os.environ, 'NOVAYA_STAVKA_KOREN': tmp}, capture_output=True, text=True)
    return tmp, r


def chit(tmp, f):
    with open(os.path.join(tmp, f), encoding='utf-8') as h:
        return h.read()


def stavka_cb(tmp):
    d = json.loads(chit(tmp, 'sroki.json'))
    spisok = d['sroki'] if 'sroki' in d else [v for v in d.values() if isinstance(v, list)][0]
    return [x for x in spisok if x['id'] == 'stavka_cb'][0]


def proverit(nazv, uslovie):
    global ok
    assert uslovie, nazv
    ok += 1


for st, s, dolya, pct in (('13', '2026-10-27', 0.13, '13'), ('13.5', '2026-10-26', 0.135, '13,5')):
    tmp, r = prognat('--stavka', st, '--s', s, '--reshenie', '2026-10-23', '--sled', '2026-12-18')
    proverit('скрипт отработал: ' + r.stderr, r.returncode == 0)
    R = json.loads(chit(tmp, 'tarify/tarify.json'))['raschet']
    proverit('ставка в tarify.json', R['klyuchevaya_stavka'] == dolya)
    proverit('следующее решение', R['klyuchevaya_stavka_sleduyushchee_reshenie'] == '2026-12-18')
    proverit('подпись «действует с» (inn.test)', re.search(r'действует с \d\d\.\d\d\.\d{4}', R['klyuchevaya_stavka_istochnik']))
    S = stavka_cb(tmp)
    proverit('sroki: proverit_do = следующее решение (sroki.test)', S['proverit_do'] == '2026-12-18')
    proverit('sroki: ищем то, что печатает sobrat_tarify', S['gde'][0]['ishchem'] == f"ключевая ставка {round(dolya * 100, 2):g}%")
    proverit('sroki: новая сверка сверху', '23.10.2026' in S['sverka'][:60])
    K = chit(tmp, KALK)
    proverit('калькулятор: KEY', float(re.search(r'var KEY=([\d.]+)', K).group(1)) == dolya)
    proverit('калькулятор: подпись', f'по нынешней ключевой ставке {pct}% (' + R['klyuchevaya_stavka_istochnik'] + ')' in K)
    shutil.rmtree(tmp)

tmp, r = prognat('--stavka', '14', '--reshenie', '2026-10-23', '--sled', '2026-12-18')
R = json.loads(chit(tmp, 'tarify/tarify.json'))['raschet']
proverit('сохранили: дата действия прежняя', r.returncode == 0 and 'сохранил её 23.10.2026' in R['klyuchevaya_stavka_istochnik'])
shutil.rmtree(tmp)

tmp, r = prognat('--stavka', '13', '--reshenie', '2026-10-23', '--sled', '2026-12-18')
with open(os.path.join(KOREN, 'tarify', 'tarify.json'), encoding='utf-8') as h:
    proverit('изменили без --s — отказ, файлы целы', r.returncode != 0 and chit(tmp, 'tarify/tarify.json') == h.read())
shutil.rmtree(tmp)

tmp, r = prognat('--stavka', '0.13', '--s', '2026-10-27', '--reshenie', '2026-10-23', '--sled', '2026-12-18')
proverit('доля вместо процентов — отказ', r.returncode != 0)
shutil.rmtree(tmp)

print(f'{ok} проверок пройдено')
