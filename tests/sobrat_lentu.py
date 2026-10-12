#!/usr/bin/env python3
"""Лента «Что нового» в HTML страницы /obnovleniya/ — для поискового робота ([Ночные запуски] seo-pered-volnoj-v1, 03.10.2026).

Зачем: страница в sitemap, а лента рисовалась только скриптом — роботу в <main> было видно 12 слов
(аудит [Продукт · Маркетинг] 03.10, разд. 2.3). Теперь последние 20 записей obnovleniya.json стоят в HTML
между метками <!--lenta-->…<!--/lenta--> той же разметкой, что рисует скрипт страницы; скрипт после загрузки
заменяет блок полной лентой — посетитель видит то же, что и раньше.

«Пульс проекта» на /o-proekte/ (12.10.2026, ошибка поймана [Выкладкой] на kartochki-1210-n6): снимок «Последние
изменения» — 5 ссылок /obnovleniya/#id — собирается здесь же из тех же записей (верхние 5, та же разметка, что
рисует скрипт страницы). Раньше снимок стоял руками на 11.10: новая запись ленты вытесняла его якорь из 20 записей
/obnovleniya/ и tests/ssylki.test.js краснел у любого комплекта с лентой. Теперь якоря пульса всегда среди 20.

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
PULS_STRANICA = ROOT / "o-proekte" / "index.html"
PULS_SKOLKO = 5  # столько же показывает скрипт страницы (a.slice(0,5))
PULS = re.compile(r'(<ul class="puls__l" data-puls>)(.*?)(</ul>)', re.S)
MESYACY = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября",
           "октября", "ноября", "декабря"]


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


def esc_js(s):
    """Как e() в скрипте /o-proekte/: & < > " — кавычки-ёлочки и апостроф остаются как есть."""
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def puls_stroka(u):
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", u.get("id") or "")
    if m:
        kogda_ = "%d&nbsp;%s" % (int(m.group(3)), MESYACY[int(m.group(2)) - 1])
        dt = m.group(0)
    else:
        kogda_, dt = esc_js(u.get("data") or ""), ""
    return '<li><time datetime="%s">%s</time><a href="/obnovleniya/#%s">%s</a></li>' % (
        dt, kogda_, esc_js(u.get("id", "")), esc_js(u.get("zagolovok", "")))


def sobrat_puls(txt, zapisi):
    """Снимок «Последние изменения» на /o-proekte/ — верхние PULS_SKOLKO записей ленты."""
    if not PULS.search(txt):
        raise SystemExit("sobrat_lentu: на /o-proekte/ нет <ul class=\"puls__l\" data-puls> — разметку правили руками")
    li = "\n".join(puls_stroka(u) for u in zapisi[:PULS_SKOLKO])
    return PULS.sub(lambda m: m.group(1) + "\n" + li + "\n" + m.group(3), txt, count=1)


def main(argv):
    zapisi = json.loads(LENTA.read_text(encoding="utf-8"))["obnovleniya"]
    pary = [(STRANICA, sobrat, "Лента в HTML /obnovleniya/"),
            (PULS_STRANICA, lambda t: sobrat_puls(t, zapisi), "«Последние изменения» на /o-proekte/")]
    kod = 0
    for put, f, imya in pary:
        if not put.exists():
            continue
        stary = put.read_text(encoding="utf-8")
        novyj = f(stary)
        if "--check" in argv:
            if novyj != stary:
                print(imya + " отстала от obnovleniya.json — запустите: python3 tests/sobrat_lentu.py")
                kod = 1
            else:
                print(imya + " совпадает с obnovleniya.json")
        elif novyj != stary:
            put.write_text(novyj, encoding="utf-8")
            print(imya + " — обновлено")
        else:
            print(imya + " — уже свежее")
    return kod


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
