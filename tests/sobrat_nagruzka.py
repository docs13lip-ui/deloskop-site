#!/usr/bin/env python3
"""Справочник «Налоговая нагрузка и рентабельность по отраслям» (nagruzka-v1, 02.10.2026).

Таблицы страницы /nalogi/nagruzka-po-otraslyam-2025/ собираются из data/fns-normy-2025.json —
между метками <!--normy--> и <!--/normy-->. Цифры руками в HTML не правим: правим JSON и запускаем сборщик.
Источник — Информация ФНС от 05.05.2026 (приложения 3–4 к приказу № ММ-3-06/333@);
рентабельность за 2024 год — Информация ФНС от 07.05.2025 (ключ rentabelnost_2024).

Запуск: python3 tests/sobrat_nagruzka.py         — собрать
        python3 tests/sobrat_nagruzka.py --check — только проверить (код 1, если нужна сборка; tests/nagruzka.test.js)
"""
import html
import json
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DANNYE = os.path.join(KOREN, "data", "fns-normy-2025.json")
STRANICA = os.path.join(KOREN, "nalogi", "nagruzka-po-otraslyam-2025", "index.html")
METKI = re.compile(r"<!--normy-->.*?<!--/normy-->", re.S)


def chislo(x):
    if isinstance(x, str):
        return "убыток" if x == "отр" else html.escape(x)
    return ("%.1f" % x).replace(".", ",") + "%"


def kod(s):
    if s["kod"] == "ВСЕГО":
        return "все"
    return ("раздел " + s["kod"]) if re.fullmatch(r"[A-Z]", s["kod"]) else s["kod"]


def nazv(s):
    n = re.sub(r"\s+-\s+всего$", "", s["nazvanie"], flags=re.I)
    if s["kod"] == "ВСЕГО":
        n = "Всего по России"
    return html.escape(n[:1].upper() + n[1:])


def klass(s):
    if s["kod"] == "ВСЕГО":
        return ' class="vsego"'
    return ' class="razdel"' if re.fullmatch(r"[A-Z]", s["kod"]) else ""


def izmenenie(a, b):
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        return "—"
    d = round(a - b, 1)
    if d == 0:
        return "0"
    return ("+" if d > 0 else "−") + ("%.1f" % abs(d)).replace(".", ",") + " п. п."


def tablicy(d):
    out = ['<!--normy-->',
           '<h2 id="nagruzka">Налоговая нагрузка по видам деятельности</h2>',
           '<p>Налоги и сборы организаций к их обороту, с учётом НДФЛ; страховые взносы — справочно, в нагрузку не входят. '
           'Строки ФНС даны по разделам и части групп ОКВЭД-2: если вашей группы нет, смотрите раздел.</p>',
           '<div class="tw"><table class="normy" data-normy>',
           '<thead><tr><th>Вид деятельности</th><th>ОКВЭД</th><th>2025</th><th>2024</th><th>Изменение</th><th>Взносы 2025, справочно</th></tr></thead><tbody>']
    for s in d["nagruzka"]:
        n = s["nagruzka"]
        out.append('<tr%s><td>%s</td><td>%s</td><td><b>%s</b></td><td>%s</td><td>%s</td><td>%s</td></tr>' % (
            klass(s), nazv(s), kod(s), chislo(n["2025"]), chislo(n["2024"]), izmenenie(n["2025"], n["2024"]), chislo(s["sv"]["2025"])))
    out.append('</tbody></table></div>')
    r = d["rentabelnost"]
    z2 = (d.get("rentabelnost_2024") or {}).get("znacheniya") or {}
    g2 = "2024" if z2 and all(s["kod"] in z2 for s in r["stroki"]) else None
    zag = ("за %d и %s годы" % (r["god"], g2)) if g2 else ("за %d год" % r["god"])
    out += ['<h2 id="rentabelnost">Рентабельность по видам деятельности %s</h2>' % zag,
            '<p>Рентабельность продаж — прибыль от продаж к себестоимости с коммерческими и управленческими расходами; '
            'рентабельность активов — сальдированный финансовый результат к стоимости активов. «Убыток» — у отрасли в целом отрицательный результат.</p>',
            '<div class="tw"><table class="normy" data-normy>',
            ('<thead><tr><th>Вид деятельности</th><th>ОКВЭД</th><th>Продаж, %d</th><th>Продаж, %s</th><th>Активов, %d</th><th>Активов, %s</th></tr></thead><tbody>'
             % (r["god"], g2, r["god"], g2)) if g2 else
            '<thead><tr><th>Вид деятельности</th><th>ОКВЭД</th><th>Рентабельность продаж</th><th>Рентабельность активов</th></tr></thead><tbody>']
    for s in r["stroki"]:
        if g2:
            out.append('<tr%s><td>%s</td><td>%s</td><td><b>%s</b></td><td>%s</td><td><b>%s</b></td><td>%s</td></tr>' % (
                klass(s), nazv(s), kod(s), chislo(s["prodazhi"]), chislo(z2[s["kod"]][0]), chislo(s["aktivy"]), chislo(z2[s["kod"]][1])))
        else:
            out.append('<tr%s><td>%s</td><td>%s</td><td><b>%s</b></td><td>%s</td></tr>' % (
                klass(s), nazv(s), kod(s), chislo(s["prodazhi"]), chislo(s["aktivy"])))
    out.append('</tbody></table></div>')
    out.append('<!--/normy-->')
    return "\n".join(out)


def sobrat(proverit=False):
    d = json.load(open(DANNYE, encoding="utf-8"))
    s = open(STRANICA, encoding="utf-8").read()
    if not METKI.search(s):
        print("нет меток <!--normy--> в " + STRANICA)
        return 1
    novoe = METKI.sub(lambda m: tablicy(d), s, count=1)
    if novoe == s:
        print("nagruzka: таблицы собраны")
        return 0
    if proverit:
        print("nagruzka: таблицы не совпадают с data/fns-normy-2025.json — запустите python3 tests/sobrat_nagruzka.py")
        return 1
    open(STRANICA, "w", encoding="utf-8").write(novoe)
    print("nagruzka: таблицы обновлены")
    return 0


if __name__ == "__main__":
    sys.exit(sobrat("--check" in sys.argv[1:]))
