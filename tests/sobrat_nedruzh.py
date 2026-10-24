#!/usr/bin/env python3
"""Перечень недружественных государств — распоряжение Правительства РФ № 430-р (nedruzh-430r-v1, [Ночные-3] 10.10.2026).

Таблица страницы /nalogi/nedruzhestvennye-gosudarstva-perechen/ собирается из data/nedruzhestvennye-430r.json —
между метками <!--nedruzh--> и <!--/nedruzh-->. Руками в HTML не правим: правим JSON и запускаем сборщик.
Названия — дословно из приложения к распоряжению (ред. от 29.10.2022 № 3216-р).

Запуск: python3 tests/sobrat_nedruzh.py         — собрать
        python3 tests/sobrat_nedruzh.py --check — только проверить (код 1, если нужна сборка)
"""
import html
import json
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DANNYE = os.path.join(KOREN, "data", "nedruzhestvennye-430r.json")
STRANICA = os.path.join(KOREN, "nalogi", "nedruzhestvennye-gosudarstva-perechen", "index.html")
METKI = re.compile(r"<!--nedruzh-->.*?<!--/nedruzh-->", re.S)
NB = "&nbsp;"
KOROTKIE = r"(?:в|и|а|к|с|у|о|по|на|не|до|от|за|из|без|для|при|под|со|об)"
MES = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]


def e(t):
    t = html.escape(t.replace(" - ", " — "), quote=False)
    t = re.sub(r"(№)\s*(?=\d)", lambda m: m.group(1) + NB, t)
    t = re.sub(r"(?<![\w-])(" + KOROTKIE + r") ", lambda m: m.group(1) + NB, t, flags=re.I)
    return t.replace(" — ", NB + "— ")


def data_rus(iso):
    g, m, d = iso.split("-")
    return "%d%s%s%s%s" % (int(d), NB, MES[int(m) - 1], NB, g)  # tipograf-daty-v1: «5 марта 2022» целиком


def pometka(x):
    if x.get("vveden"):
        return "добавлена с%s%s" % (NB, data_rus(x["vveden"]["data"]))
    if x.get("redakciya"):
        return "уточнена 29%sоктября%s2022" % (NB, NB)
    if x.get("chleny_es"):
        return "все %d стран ЕС" % len(x["chleny_es"])
    return "с%s5%sмарта%s2022" % (NB, NB, NB)  # tipograf-daty-v1


def blok(d):
    sp = d["spisok"]
    out = ["<!--nedruzh-->"]
    out.append('<h2 id="perechen">Весь перечень</h2>')
    out.append("<p>%d строки%s— как в%sприложении к%sраспоряжению. Номеров в%sприложении нет: номер в%sтаблице%s— порядок строки, ссылка на%sстроку%s— адрес вида <code>#p6</code>.</p>"
               % (len(sp), NB, NB, NB, NB, NB, NB, NB, NB))
    out.append('<div class="tw"><table class="of-t"><thead><tr><th>№</th><th>Государство или территория</th><th>В%sперечне</th></tr></thead><tbody>' % NB)
    for x in sp:
        dop = ""
        if x.get("chleny_es"):
            dop = '<span class="nd-es">%s</span>' % e(", ".join(x["chleny_es"]))
        out.append('<tr id="p%d"><td>%d</td><td>%s%s</td><td>%s</td></tr>' % (x["n"], x["n"], e(x["nazvanie"]), dop, pometka(x)))
    out.append("</tbody></table></div>")
    es = next(x for x in sp if x.get("chleny_es"))
    i = d["istochnik"]
    out.append('<p class="podp">Перечень сверен %s по%sтексту распоряжения в%sредакции от%s29.10.2022. %s %s</p>'
               % (data_rus(i["data_sverki"]), NB, NB, NB, e(es["chleny_es_pometka"]), e(i["pravilo"].split(":")[0] + ".")))
    out.append("<!--/nedruzh-->")
    return "\n".join(out)


def main():
    d = json.load(open(DANNYE, encoding="utf-8"))
    s = open(STRANICA, encoding="utf-8").read()
    if not METKI.search(s):
        sys.exit("нет меток <!--nedruzh--> в " + STRANICA)
    novoe = METKI.sub(lambda m: blok(d), s, count=1)
    if "--check" in sys.argv:
        if novoe != s:
            print("нужна сборка: python3 tests/sobrat_nedruzh.py")
            sys.exit(1)
        print("nedruzh: собрано")
        return
    open(STRANICA, "w", encoding="utf-8").write(novoe)
    print("nedruzh: собрано, строк", len(d["spisok"]))


if __name__ == "__main__":
    main()
