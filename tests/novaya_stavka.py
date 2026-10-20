#!/usr/bin/env python3
"""Ключевая ставка Банка России — одной командой в день решения (stavka-cb-v1, 20.10.2026).

Зачем: после даты решения Банка России сторож tests/stavka_cb.test.js (и sroki.test.js)
краснеет со следующего дня и останавливает ВСЕ выкладки. Ставка живёт в пяти местах —
этот скрипт меняет их согласованно и пересобирает страницы:

  1. tarify/tarify.json → raschet.klyuchevaya_stavka, _istochnik, _sleduyushchee_reshenie;
  2. sroki.json → строка stavka_cb: cifra, «ishchem», sverka (новая сверка сверху), proverit_do;
  3. /nalogi/kalkulyator-tehnicheskij-postavshchik/ → var KEY= и подпись «по нынешней ключевой ставке N% (…)»;
  4. /tarify/ — пересборкой: sobrat_tarify.py . && sobrat_shapku.py.

Ставку и даты берём ТОЛЬКО с первоисточника: пресс-релиз cbr.ru/press/keypr/ (13:30 МСК
в день решения), cbr.ru/hd_base/KeyRate/, календарь cbr.ru/dkp/cal_mp/.

Пример — ставку снизили до 13 % с 27.10:
  python3 tests/novaya_stavka.py --stavka 13 --s 2026-10-27 --reshenie 2026-10-23 --sled 2026-12-18
Пример — ставку сохранили:
  python3 tests/novaya_stavka.py --stavka 14 --reshenie 2026-10-23 --sled 2026-12-18
Только показать, что изменится (файлы не трогает):  … --proba
Затем: node --test tests/*.test.* && коммит «ставка ЦБ: …» + запись в obnovleniya.json по правилам.
"""
import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys

KOREN = os.environ.get('NOVAYA_STAVKA_KOREN') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # подмена — для теста
TARIFY = os.path.join(KOREN, 'tarify', 'tarify.json')
SROKI = os.path.join(KOREN, 'sroki.json')
KALK = os.path.join(KOREN, 'nalogi', 'kalkulyator-tehnicheskij-postavshchik', 'index.html')


def ru(d):
    """2026-10-27 → 27.10.2026"""
    return dt.date.fromisoformat(d).strftime('%d.%m.%Y')


def pct_g(dolya):
    """0.135 → '13.5' (как печатает sobrat_tarify: {…:g})"""
    return f"{round(dolya * 100, 2):g}"


def pct_ru(dolya):
    """0.135 → '13,5' (как сверяют сторожа страниц)"""
    return pct_g(dolya).replace('.', ',')


def zamenit_odin(tekst, shablon, na, gde):
    novyj, n = re.subn(shablon, na, tekst, count=1)
    if n != 1:
        sys.exit(f'✗ {gde}: не нашёл «{shablon}» — правьте руками и обновите этот скрипт')
    return novyj


def raschet(argv=None, segodnya=None):
    a = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    a.add_argument('--stavka', type=float, required=True, help='ставка в процентах, напр. 13 или 13.5')
    a.add_argument('--reshenie', required=True, help='дата решения совета директоров, ГГГГ-ММ-ДД')
    a.add_argument('--sled', required=True, help='дата следующего решения (cbr.ru/dkp/cal_mp/), ГГГГ-ММ-ДД')
    a.add_argument('--s', help='с какой даты действует новая ставка (при изменении — обязательно)')
    a.add_argument('--istochnik', help='подпись «действует с …» целиком, если нужна своя')
    a.add_argument('--proba', action='store_true', help='показать изменения, файлы не писать')
    a.add_argument('--bez-sborki', action='store_true', help='не пересобирать страницы (для теста)')
    o = a.parse_args(argv)

    for d in (o.reshenie, o.sled) + ((o.s,) if o.s else ()):
        dt.date.fromisoformat(d)
    if o.sled <= o.reshenie:
        sys.exit('✗ --sled должна быть позже --reshenie')
    if not 1 <= o.stavka <= 50:
        sys.exit('✗ --stavka — в процентах (например 13), не доля; разумные пределы 1–50')

    t_txt = open(TARIFY, encoding='utf-8').read()
    R = json.loads(t_txt)['raschet']
    staraya = R['klyuchevaya_stavka']
    novaya = round(o.stavka / 100, 4)
    ist_star = R['klyuchevaya_stavka_istochnik']
    s_star = re.search(r'действует с (\d\d\.\d\d\.\d{4})', ist_star)

    if o.istochnik:
        ist = o.istochnik
    elif novaya == staraya:
        if not s_star:
            sys.exit('✗ в старой подписи нет «действует с ДД.ММ.ГГГГ» — передайте --istochnik')
        ist = f'действует с {s_star.group(1)}, Банк России сохранил её {ru(o.reshenie)}'
    else:
        if not o.s:
            sys.exit('✗ ставка меняется — укажите --s (с какой даты действует, из пресс-релиза)')
        ist = f'действует с {ru(o.s)}, решение Банка России {ru(o.reshenie)}'
    if not re.search(r'действует с \d\d\.\d\d\.\d{4}', ist):
        sys.exit('✗ подпись должна содержать «действует с ДД.ММ.ГГГГ» (сторож inn.test.js)')
    if '(' in ist or ')' in ist:
        sys.exit('✗ без скобок в подписи — она встаёт в скобки на странице калькулятора')

    segodnya = segodnya or dt.date.today().isoformat()
    izm = 'сохранил' if novaya == staraya else f'{pct_ru(staraya)}% → {pct_ru(novaya)}%'
    sverka = (f'{segodnya}: решение Банка России {ru(o.reshenie)} — {izm}; на сайте «{pct_ru(novaya)}%, {ist}» '
              f'(cbr.ru/press/keypr/, cbr.ru/hd_base/KeyRate/); следующее заседание {ru(o.sled)} '
              f'(cbr.ru/dkp/cal_mp/). ')

    # 1. tarify.json — точечно, чтобы не менять оформление файла
    t_new = zamenit_odin(t_txt, r'("klyuchevaya_stavka": )[\d.]+', lambda m: m.group(1) + repr(novaya), 'tarify.json ставка')
    t_new = zamenit_odin(t_new, r'("klyuchevaya_stavka_istochnik": )"[^"]*"',
                         lambda m: m.group(1) + json.dumps(ist, ensure_ascii=False), 'tarify.json источник')
    t_new = zamenit_odin(t_new, r'("klyuchevaya_stavka_sleduyushchee_reshenie": )"[^"]*"',
                         lambda m: m.group(1) + f'"{o.sled}"', 'tarify.json следующее решение')
    json.loads(t_new)

    # 2. sroki.json — только внутри строки stavka_cb
    s_txt = open(SROKI, encoding='utf-8').read()
    m = re.search(r'"id": "stavka_cb".*?"otvetstvennyj": "[^"]*"', s_txt, re.S)
    if not m:
        sys.exit('✗ sroki.json: нет строки stavka_cb')
    blok = m.group(0)
    b = zamenit_odin(blok, r'("cifra": "Ключевая ставка Банка России )[\d,.]+%"',
                     lambda x: x.group(1) + pct_ru(novaya) + '%"', 'sroki cifra')
    b = zamenit_odin(b, r'("ishchem": "ключевая ставка )[\d,.]+%"',
                     lambda x: x.group(1) + pct_g(novaya) + '%"', 'sroki ishchem')
    b = zamenit_odin(b, r'("sverka": ")', lambda x: x.group(1) + json.dumps(sverka, ensure_ascii=False)[1:-1], 'sroki sverka')
    b = zamenit_odin(b, r'("proverit_do": )"[^"]*"', lambda x: x.group(1) + f'"{o.sled}"', 'sroki proverit_do')
    s_new = s_txt[:m.start()] + b + s_txt[m.end():]
    json.loads(s_new)

    # 3. калькулятор
    k_txt = open(KALK, encoding='utf-8').read()
    k_new = zamenit_odin(k_txt, r'var KEY=[\d.]+', 'var KEY=' + repr(novaya), 'калькулятор KEY')
    k_new = zamenit_odin(k_new, r'по нынешней ключевой ставке [\d,]+% \([^)]*\)',
                         f'по нынешней ключевой ставке {pct_ru(novaya)}% ({ist})', 'калькулятор подпись')

    print(f'Ставка: {pct_ru(staraya)}% → {pct_ru(novaya)}%; подпись: «{ist}»; следующее решение {o.sled}')
    if o.proba:
        print('--proba: файлы не тронуты')
        return 0
    for put, txt in ((TARIFY, t_new), (SROKI, s_new), (KALK, k_new)):
        with open(put, 'w', encoding='utf-8') as f:
            f.write(txt)
    for cmd in ([] if o.bez_sborki else (['python3', 'tests/sobrat_tarify.py', '.'], ['python3', 'tests/sobrat_shapku.py'])):
        subprocess.run(cmd, cwd=KOREN, check=True, stdout=subprocess.DEVNULL)
    print('Записал tarify.json, sroki.json, калькулятор; пересобрал /tarify/ и шапку.')
    print('Дальше: node --test tests/stavka_cb.test.js tests/glavnaya.test.js tests/inn.test.js tests/sroki.test.js')
    return 0


if __name__ == '__main__':
    sys.exit(raschet())
