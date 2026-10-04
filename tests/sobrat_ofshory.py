#!/usr/bin/env python3
"""Перечень офшорных зон Минфина (ofshory-v1, [Ночные-3] 04.10.2026).

Таблица страницы /nalogi/ofshornye-zony-perechen-minfina/ собирается из data/ofshory-minfin.json —
между метками <!--ofshory--> и <!--/ofshory-->. Руками в HTML не правим: правим JSON и запускаем сборщик.
Названия — дословно из приложения к приказу Минфина России от 05.06.2023 № 86н (ред. от 22.12.2025 № 187н).

Запуск: python3 tests/sobrat_ofshory.py         — собрать
        python3 tests/sobrat_ofshory.py --check — только проверить (код 1, если нужна сборка)
"""
import html
import json
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DANNYE = os.path.join(KOREN, "data", "ofshory-minfin.json")
STRANICA = os.path.join(KOREN, "nalogi", "ofshornye-zony-perechen-minfina", "index.html")
METKI = re.compile(r"<!--ofshory-->.*?<!--/ofshory-->", re.S)
NB = "&nbsp;"
KOROTKIE = r"(?:в|и|а|к|с|у|о|по|на|не|до|от|за|из|без|для|при|под|со|об)"
MES = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]


def e(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"(№|ст\.|п\.)\s*(?=\d)", lambda m: m.group(1) + NB, t)
    t = re.sub(r"(?<![\w-])(" + KOROTKIE + r") ", lambda m: m.group(1) + NB, t, flags=re.I)
    return t.replace(" — ", NB + "— ")


def data_rus(iso):
    g, m, d = iso.split("-")
    return "%d%s%s %s" % (int(d), NB, MES[int(m) - 1], g)


def blok(d):
    sp = d["spisok"]
    dejstv = [x for x in sp if x["status"] == "dejstvuet"]
    out = ["<!--ofshory-->"]
    out.append('<h2 id="perechen">Весь перечень</h2>')
    out.append("<p>%d стран и%sтерриторий%s— как в%sприказе, с%sномерами пунктов. Ссылка на%sпункт%s— адрес вида <code>#p49</code>.</p>"
               % (len(dejstv), NB, NB, NB, NB, NB, NB))
    out.append('<div class="tw"><table class="of-t"><thead><tr><th>№</th><th>Государство или территория</th><th>В%sперечне</th></tr></thead><tbody>' % NB)
    for x in sp:
        if x["status"] == "dejstvuet":
            out.append('<tr id="p%d"><td>%d</td><td>%s</td><td>да</td></tr>' % (x["n"], x["n"], e(x["nazvanie"])))
        else:
            out.append('<tr id="p%d" class="of-t__isk"><td>%d</td><td>%s</td><td>исключены с%s%s</td></tr>'
                       % (x["n"], x["n"], e(x["nazvanie"]), NB, data_rus(x["isklyuchen_s"])))
    out.append("</tbody></table></div>")
    i = d["istochnik"]
    out.append('<p class="podp">Перечень сверен %s. %s</p>' % (data_rus(i["data_sverki"]), e(i["pravilo"].split(":")[0] + ".")))
    out.append("<!--/ofshory-->")
    return "\n".join(out)


def main():
    d = json.load(open(DANNYE, encoding="utf-8"))
    s = open(STRANICA, encoding="utf-8").read()
    if not METKI.search(s):
        sys.exit("нет меток <!--ofshory--> в " + STRANICA)
    novoe = METKI.sub(lambda m: blok(d), s, count=1)
    if "--check" in sys.argv:
        if novoe != s:
            print("нужна сборка: python3 tests/sobrat_ofshory.py")
            sys.exit(1)
        print("ofshory: собрано")
        return
    open(STRANICA, "w", encoding="utf-8").write(novoe)
    print("ofshory: собрано, пунктов", len(d["spisok"]))


if __name__ == "__main__":
    main()
