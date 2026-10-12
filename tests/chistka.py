#!/usr/bin/env python3
"""Делоскоп — «чистый исходник» (chistka-v1, Очередь п. 286, Тестировщик 11.10 14:45).

Зачем: всё, что лежит в репозитории вне tests/, deploy/ и .github/, сайт отдаёт как есть —
и комментарии в HTML, JS, CSS, и служебные поля «_…» в JSON видит любой, кто откроет
исходный код страницы. Там не должно быть путей к внутренним документам команды,
внутренних пометок отделов и «решений владельца» (снаружи — только «Команда Делоскопа»).

Что делает (детерминированно, повторный запуск ничего не меняет):
  1) путь к внутреннему документу «claude/…» → «документ команды»;
  2) «решение/решения/приказ владельца», «да» владельца, «(владелец, дата)»,
     soglasovano: «владелец, …» → «команды» / «команда»;
  3) пометки отделов в квадратных скобках — [Право …], [Продукт …], [Ночные …],
     [Выкладка], [Штаб], [Планёрка], [Тестировщик], [Стратег], [Арт-директор] → [команда];
  4) «Штаб» в кавычках-ёлочках → команда;
  5) подпись запуска «Ночные 30.09 23:05» / «Ночные-2, 03.10» без скобок → «команда 30.09 23:05».
Слова «владелец счёта», «владельцы облигаций», «без согласия владельца» и т. п. —
обычный текст страниц, их правила не трогают (шаблоны только служебные).

Запуск:
  python3 tests/chistka.py          — почистить на месте и показать, что изменилось;
  python3 tests/chistka.py --check  — только проверить (код 1, если есть что чистить).
Ворота — tests/chistka.test.js (CI: node --test tests/*.test.*).
"""
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# что сайт не отдаёт (служебное хранится тут же, наружу не выходит)
NE_SAJT = {'.git', 'tests', 'deploy', '.github', 'node_modules', '__pycache__'}
NE_SAJT_FAJLY = {'Dockerfile', '.gitignore'}
TEKST = {'.html', '.htm', '.js', '.mjs', '.css', '.json', '.xml', '.txt', '.md', '.svg',
         '.webmanifest', '.csv', '.yml', '.yaml'}

PRAVILA = [
    # 1) пути к внутренним документам: claude/Имя_файла.md (имена — без пробелов)
    (re.compile(r'(?i)claude/[^\s,;:)\]»"\'`<>|]+'), 'документ команды'),
    (re.compile(r'(?i)\bclaude\b'), 'команда'),
    # 2) решения владельца — снаружи только команда
    (re.compile(r'([Рр])ешени([еяюй]|ем|ями|ях) владельца'), r'\1ешени\2 команды'),
    (re.compile(r'([Пп])риказ владельца'), r'\1ешение команды'),
    (re.compile(r'(«да»|"да"|\\"да\\") владельца'), r'\1 команды'),
    (re.compile(r'\(владелец, '), '(команда, '),
    (re.compile(r'("soglasovano"\s*:\s*")владелец'), r'\1команда'),
    (re.compile(r'"soglasovano"\s*:\s*"[Вв]ладельц'), '"soglasovano": "команд'),
    # 3) пометки отделов
    (re.compile(r'\[(?:✎\s*)?(?:Право|Продукт|Ночные|Ночных|Выкладк|Штаб|Планёрк|Тестировщик|Стратег|Арт-директор)[^\]\n]{0,60}\]'),
     '[команда]'),
    # 4) «Штаб»
    (re.compile(r'«Штаб[а-я]*»'), 'команда'),
    # 5) подпись запуска без скобок: «(Ночные 30.09 23:05)», «Ночные-2, 03.10», «Прорыв Ночных 30.09» (v1.1, 12.10)
    (re.compile(r'(?:Прорыв )?Ночн(?:ые|ых)(?:-\d)?(?=[\s,)])'), 'команда'),
]

ZAPRET = [  # то же, что ловит tests/chistka.test.js
    re.compile(r'(?i)claude'),
    re.compile(r'[Рр]ешени[а-я]* владельца|«да» владельца|[Пп]риказ владельца'),
    re.compile(r'\[(?:✎\s*)?(?:Право|Продукт|Ночные|Ночных|Выкладк|Штаб|Планёрк|Тестировщик|Стратег|Арт-директор)'),
    re.compile(r'«Штаб'),
    re.compile(r'Ночн(?:ые|ых)(?:-\d)?[\s,)]'),
]


def fajly_sajta():
    for papka, podpapki, fajly in os.walk(KOREN):
        otn = os.path.relpath(papka, KOREN)
        if otn == '.':
            podpapki[:] = sorted(p for p in podpapki if p not in NE_SAJT)
        else:
            podpapki[:] = sorted(p for p in podpapki if p not in ('node_modules', '__pycache__', '.git'))
        for f in sorted(fajly):
            if otn == '.' and f in NE_SAJT_FAJLY:
                continue
            if os.path.splitext(f)[1].lower() in TEKST:
                yield os.path.join(papka, f)


def pochistit(tekst):
    for shablon, zamena in PRAVILA:
        tekst = shablon.sub(zamena, tekst)
    return tekst


def main():
    proverka = '--check' in sys.argv
    izmeneno = []
    for put in fajly_sajta():
        try:
            with open(put, encoding='utf-8', newline='') as f:
                bylo = f.read()
        except UnicodeDecodeError:
            continue
        stalo = pochistit(bylo)
        if stalo != bylo:
            izmeneno.append(os.path.relpath(put, KOREN))
            if not proverka:
                with open(put, 'w', encoding='utf-8', newline='') as f:
                    f.write(stalo)
    if proverka:
        if izmeneno:
            print('В исходнике сайта есть служебное (пути claude/, пометки отделов, «решения владельца»):')
            for p in izmeneno:
                print('  ' + p)
            print('Почистить: python3 tests/chistka.py — и закоммитить.')
            return 1
        print('chistka: исходник сайта чистый')
        return 0
    for p in izmeneno:
        print('почищено: ' + p)
    print(f'chistka: файлов изменено — {len(izmeneno)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
