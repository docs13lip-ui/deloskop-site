#!/usr/bin/env python3
"""Лента «Что нового» в HTML страницы /obnovleniya/ — для поискового робота ([Ночные запуски] seo-pered-volnoj-v1, 03.10.2026).

Зачем: страница в sitemap, а лента рисовалась только скриптом — роботу в <main> было видно 12 слов
(аудит [Продукт · Маркетинг] 03.10, разд. 2.3). Теперь последние 20 записей obnovleniya.json стоят в HTML
между метками <!--lenta-->…<!--/lenta--> той же разметкой, что рисует скрипт страницы; скрипт после загрузки
заменяет блок полной лентой — посетитель видит то же, что и раньше.

Запуск: python3 tests/sobrat_lentu.py [--check]
Вызывается сам из tests/postavit_vremya.py — то есть при каждой выкладке, вместе с проставлением времени.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LENTA = ROOT / "obnovleniya.json"
STRANICA = ROOT / "obnovleniya" / "index.html"
SKOLKO = 20
METKA = re.compile(r"<!--lenta-->.*?<!--/lenta-->", re.S)


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&#39;"))


def kogda(u):
    t = esc(u.get("data") or "") + (", " + esc(u["vremya"]) + " МСК" if u.get("vremya") else "")
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", u.get("id") or "")
    if m and u.get("vremya"):
        return '<time datetime="%sT%s+03:00">%s</time>' % (m.group(1), esc(u["vremya"]), t)
    return t


def zapis(u):
    h = '<section class="u" id="%s"><span class="tag">%s</span><h2>%s</h2>' % (esc(u["id"]), kogda(u), esc(u.get("zagolovok", "")))
    if u.get("chto_novogo"):
        h += '<h3>Что нового</h3><ul class="n">' + "".join("<li>%s</li>" % esc(t) for t in u["chto_novogo"]) + "</ul>"
    if u.get("chto_proverit"):
        li = []
        for p in u["chto_proverit"]:
            if p.get("ssylka"):
                li.append('<li><a href="%s">%s →</a></li>' % (esc(p["ssylka"]), esc(p.get("tekst", ""))))
            else:
                li.append("<li>%s</li>" % esc(p.get("tekst", "")))
        h += '<h3>Что проверить</h3><ul class="p">' + "".join(li) + "</ul>"
    if u.get("kuda_pisat"):
        h += '<p class="note">%s</p>' % esc(u["kuda_pisat"])
    return h + "</section>"


def blok():
    zapisi = json.loads(LENTA.read_text(encoding="utf-8"))["obnovleniya"][:SKOLKO]
    if not zapisi:
        return '<!--lenta--><p class="empty">Пока обновлений нет.</p><!--/lenta-->'
    return "<!--lenta-->" + "\n".join(zapis(u) for u in zapisi) + "<!--/lenta-->"


def sobrat(txt):
    b = blok()
    if METKA.search(txt):
        return METKA.sub(lambda m: b, txt, count=1)
    stary = '<div id="list"><p class="empty">Загружаю…</p></div>'
    if stary not in txt:
        raise SystemExit("sobrat_lentu: на /obnovleniya/ нет ни меток <!--lenta-->, ни блока #list — разметку правили руками")
    return txt.replace(stary, '<div id="list">' + b + "</div>", 1)


def main(argv):
    stary = STRANICA.read_text(encoding="utf-8")
    novyj = sobrat(stary)
    if "--check" in argv:
        if novyj != stary:
            print("Лента в HTML /obnovleniya/ отстала от obnovleniya.json — запустите: python3 tests/sobrat_lentu.py")
            return 1
        print("Лента в HTML /obnovleniya/ совпадает с obnovleniya.json")
        return 0
    if novyj != stary:
        STRANICA.write_text(novyj, encoding="utf-8")
        print("Лента в HTML /obnovleniya/ обновлена (последние %d записей)" % SKOLKO)
    else:
        print("Лента в HTML /obnovleniya/ уже свежая")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
