#!/usr/bin/env python3
"""Справочник «Коды статуса компании в ЕГРЮЛ» (statusy-egryul-v1, [Ночные-3] 03.10.2026).

Таблица и блоки «Что сделать» страницы /nalogi/kody-statusa-egryul/ собираются из data/statusy-egryul.json —
между метками <!--statusy--> и <!--/statusy-->. Руками в HTML не правим: правим JSON и запускаем сборщик.
Расшифровки — справочник ФНС СЮЛСТ (по копии github.com/hflabs/party-state, CC BY-SA 4.0); тексты «Что сделать» —
только утверждённые [Право] (data/kommentarii.json, js/dinamika.js), у групп без текста — только расшифровка.

Запуск: python3 tests/sobrat_statusy.py         — собрать
        python3 tests/sobrat_statusy.py --check — только проверить (код 1, если нужна сборка)
"""
import html
import json
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DANNYE = os.path.join(KOREN, "data", "statusy-egryul.json")
STRANICA = os.path.join(KOREN, "nalogi", "kody-statusa-egryul", "index.html")
METKI = re.compile(r"<!--statusy-->.*?<!--/statusy-->", re.S)
NB = "&nbsp;"
KOROTKIE = r"(?:в|и|а|к|с|у|о|по|на|не|до|от|за|из|без|для|при|под|со|об)"
MES = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]


def tipograf(t):
    """Расшифровку ФНС не переписываем — только знаки: «No» → «№», неразрывные пробелы после коротких слов и в нормах."""
    t = re.sub(r"\bNo\s*(?=\d)", "№ ", t)
    t = re.sub(r"(№|ст\.|п\.)\s*(?=\d)", lambda m: m.group(1) + NB, t)
    t = re.sub(r"(?<![\w-])(" + KOROTKIE + r") ", lambda m: m.group(1) + NB, t, flags=re.I)
    t = t.replace(" — ", NB + "— ")
    return t


def e(t):
    return tipograf(html.escape(t, quote=False))


def diapazon(kody):
    """['105','106','107','108','110'] → «105–108, 110»."""
    n = sorted(int(k) for k in kody)
    out, i = [], 0
    while i < len(n):
        j = i
        while j + 1 < len(n) and n[j + 1] == n[j] + 1:
            j += 1
        out.append(str(n[i]) if i == j else (str(n[i]) + ("–" if j - i >= 2 else ", ") + str(n[j])))
        i = j + 1
    return ", ".join(out)


def data_rus(iso):
    g, m, d = iso.split("-")
    return "%d%s%s %s" % (int(d), NB, MES[int(m) - 1], g)


def blok(d):
    po = {}
    for k in d["kody"]:
        po.setdefault(k["gruppa"], []).append(k)
    out = ["<!--statusy-->"]
    # 1. Что сделать — только группы с утверждённым текстом
    out.append('<h2 id="chto-delat">Что делать перед оплатой</h2>')
    out.append('<div class="gr">')
    for g in d["gruppy"]:
        if not g.get("sdelat"):
            continue
        kody = [k["kod"] for k in po.get(g["id"], [])]
        out.append('<section class="gr__k gr__k--%s" id="g-%s"><p class="gr__h"><b>%s</b><span>коды %s</span></p><p>%s</p><p class="gr__n">%s</p></section>' % (
            g["ton"], g["id"], e(g["nazv"]), diapazon(kody), e(g["sdelat"]), e(g["norma"])))
    out.append("</div>")
    out.append('<p class="podp">Комментарий команды Делоскопа · 115-ФЗ и налоги. Для остальных кодов ниже — только расшифровка ФНС.</p>')
    # 2. Таблица всех кодов
    out.append('<h2 id="vse-kody">Все коды статуса юрлица</h2>')
    out.append('<p>Все %d кода из справочника ФНС, по группам. Ссылка на код — адрес вида <code>#k105</code>.</p>' % len(d["kody"]))
    out.append('<div class="tw"><table class="kody"><thead><tr><th>Код</th><th>Что записано в ЕГРЮЛ</th></tr></thead><tbody>')
    for g in d["gruppy"]:
        ks = po.get(g["id"], [])
        if not ks:
            continue
        out.append('<tr class="kody__gr"><th colspan="2" scope="rowgroup"><i class="t t--%s"></i>%s</th></tr>' % (g["ton"], e(g["nazv"])))
        for k in sorted(ks, key=lambda x: int(x["kod"])):
            out.append('<tr id="k%s"><td><b>%s</b></td><td>%s</td></tr>' % (k["kod"], k["kod"], e(k["nazvanie"])))
    out.append("</tbody></table></div>")
    i = d["istochnik"]
    out.append('<p class="podp">Справочник сверен %s. %s</p>' % (data_rus(i["data_sverki"]), e(i["pravilo"].split(":")[0] + ".")))
    out.append("<!--/statusy-->")
    return "\n".join(out)


def main():
    d = json.load(open(DANNYE, encoding="utf-8"))
    s = open(STRANICA, encoding="utf-8").read()
    if not METKI.search(s):
        sys.exit("нет меток <!--statusy--> в " + STRANICA)
    novoe = METKI.sub(lambda m: blok(d), s, count=1)
    if "--check" in sys.argv:
        if novoe != s:
            print("нужна сборка: python3 tests/sobrat_statusy.py")
            sys.exit(1)
        print("statusy: собрано")
        return
    open(STRANICA, "w", encoding="utf-8").write(novoe)
    print("statusy: собрано, кодов", len(d["kody"]))


if __name__ == "__main__":
    main()
