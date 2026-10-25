#!/usr/bin/env python3
"""Сборщик пакетов JS (vizual-v3.0a «Фундамент», claude/Визуал_v3_концепция_и_супер-промт_18.10.md §7 а).

Зачем: главная грузила 36 отдельных скриптов, из них ~450 КБ модулей отчёта — до того, как человек
ввёл ИНН. Пакет = склейка исходников в одном файле, в том же порядке, что и прежние теги
<script defer> (порядок исполнения не меняется). Отпечаток содержимого в имени файла
(js/b/<имя>.<10 знаков sha256>.js) — файл можно кэшировать навсегда (cache-control immutable, nginx — волна 3.0b).

Источник правды — исходники js/*.js и карта partials/sborka.json:
  "pakety":  {"имя": ["js/a.js", "js/b.js", …]}  — что и в каком порядке склеить;
  "stranicy": {"index.html": ["имя", …]}          — на каких страницах стоит адрес пакета.
На страницах сборщик меняет только адрес /js/b/<имя>.<отпечаток>.js на текущий
(в теге <script src> или в строке загрузчика). Пакеты собраны — старые файлы js/b/<имя>.* удаляются.
Исходники не трогаются и остаются на месте (их подключают другие страницы и тесты).

Запуск: python3 tests/sobrat_js.py          — собрать
        python3 tests/sobrat_js.py --check  — только проверить (код 1, если нужна сборка)
"""
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from szhat_js import szhat_css, szhat_js  # paket-legkij-v1: пакеты без комментариев и отступов

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KARTA = os.path.join("partials", "sborka.json")
PAPKI = (("js", "b"), ("css", "b"))  # vizual-v3.0a: пакеты стилей — css/b/<имя>.<отпечаток>.css
DLINA = 10  # знаков отпечатка

# Директива 'use strict' в самом начале файла сделала бы строгим весь пакет — исходник обязан
# держать её внутри своей функции-обёртки (как все модули сайта: (function (root, factory) { … 'use strict' … })).
VERH_STRICT = re.compile(r"""^\s*(?:(?://[^\n]*\n|/\*.*?\*/)\s*)*['"]use strict['"]""", re.S)


def chitat_kartu(koren=KOREN):
    with open(os.path.join(koren, KARTA), encoding="utf-8") as f:
        return json.load(f)


def vid(fajly):
    """js или css — по исходникам; смешивать нельзя."""
    v = {os.path.splitext(f)[1].lstrip(".") for f in fajly}
    if len(v) != 1 or not v <= {"js", "css"}:
        raise SystemExit("sobrat_js: в пакете должны быть только .js или только .css: %s" % fajly)
    return v.pop()


SLOI = {}  # файл стилей → каскадный слой (partials/sborka.json → «sloi»); заполняет plan()


def sobrat_paket(imya, fajly, koren=KOREN, zamena=None):
    """Текст пакета: заголовок + исходники в заданном порядке, каждый — со своей пометкой.
    zamena — {путь: текст} для исходников, которые ещё не записаны на диск (sobrat_shapku --check)."""
    css = vid(fajly) == "css"
    chasti = ["/* Делоскоп · пакет «%s» — собран tests/sobrat_js.py из %d файлов (partials/sborka.json). "
              "Правьте исходники, не этот файл. */\n" % (imya, len(fajly))]
    for put in fajly:
        if zamena and put in zamena:
            t = zamena[put]
        else:
            with open(os.path.join(koren, put), encoding="utf-8") as f:
                t = f.read()
        if css:
            # @charset/@import в середине склейки не работают — в исходниках их быть не должно
            if re.search(r"@(?:charset|import)\b", t):
                raise SystemExit("sobrat_js: %s — @charset/@import в пакете стилей не годятся" % put)
            t = szhat_css(t)
            sloj = SLOI.get(put)
            if sloj:
                # vizual-v3.0a (б): каскадный слой — порядок слоёв задан первой строкой пакета «ds» и в <head> страницы
                chasti.append("/* --- /%s --- */\n@layer %s{\n%s\n}\n" % (put, sloj, t.rstrip()))
            else:
                chasti.append("/* --- /%s --- */\n%s\n" % (put, t.rstrip()))
            continue
        if VERH_STRICT.match(t):
            raise SystemExit("sobrat_js: %s начинается с 'use strict' — строгим стал бы весь пакет" % put)
        try:
            t = szhat_js(t)
        except ValueError as e:
            raise SystemExit("sobrat_js: %s — %s" % (put, e))
        chasti.append("/* --- /%s --- */\n%s\n;\n" % (put, t.rstrip()))
    return "".join(chasti)


def otpechatok(tekst):
    return hashlib.sha256(tekst.encode("utf-8")).hexdigest()[:DLINA]


def adres(imya, tekst, v="js"):
    return "/%s/b/%s.%s.%s" % (v, imya, otpechatok(tekst), v)


def shablon(imya, v="js"):
    return re.compile(r"/%s/b/%s\.[0-9a-f]{%d}\.%s" % (v, re.escape(imya), DLINA, v))


def adres_paketa(imya, koren=KOREN, zamena=None):
    """yadro-v1: адрес пакета по текущим исходникам (sobrat_shapku ставит его на все страницы)."""
    karta = chitat_kartu(koren)
    SLOI.clear()
    SLOI.update(karta.get("sloi", {}))
    fajly = karta["pakety"][imya]
    return adres(imya, sobrat_paket(imya, fajly, koren, zamena), vid(fajly))


def vse_s_paketami(koren=KOREN):
    """yadro-v1: файлы, где может стоять адрес пакета, кроме страниц карты: все *.html репозитория
    (общие пакеты «ds» и «yadro» ставит sobrat_shapku на каждую страницу) и оболочка карточек API."""
    import subprocess
    try:
        vse = subprocess.check_output(["git", "ls-files", "*.html"], cwd=koren, text=True).split("\n")
    except Exception:
        vse = [os.path.relpath(os.path.join(d, f), koren) for d, _, fs in os.walk(koren) for f in fs if f.endswith(".html")]
    vse = [x.strip() for x in vse if x.strip() and not x.startswith('"')]
    return sorted(set(vse)) + [os.path.join("partials", "obolochka.json")]


def plan(koren=KOREN):
    """Что должно лежать на диске: {путь: текст} и список лишних файлов пакетов."""
    karta = chitat_kartu(koren)
    pakety = karta["pakety"]
    SLOI.clear()
    SLOI.update(karta.get("sloi", {}))
    nado, adresa = {}, {}
    for imya, fajly in pakety.items():
        t = sobrat_paket(imya, fajly, koren)
        a = adres(imya, t, vid(fajly))
        adresa[imya] = a
        nado[a.lstrip("/")] = t
    for stranica, imena in karta["stranicy"].items():
        p = os.path.join(koren, stranica)
        with open(p, encoding="utf-8") as f:
            html = f.read()
        novyj = html
        for imya in imena:
            if imya not in adresa:
                raise SystemExit("sobrat_js: %s ссылается на неизвестный пакет «%s»" % (stranica, imya))
            v = vid(pakety[imya])
            if not shablon(imya, v).search(novyj):
                raise SystemExit("sobrat_js: на %s нет адреса пакета «%s» (/%s/b/%s.<отпечаток>.%s)" % (stranica, imya, v, imya, v))
            novyj = shablon(imya, v).sub(adresa[imya], novyj)
        nado[stranica] = novyj
    # yadro-v1: на остальных страницах — только заменить адрес уже стоящего пакета на текущий
    for stranica in vse_s_paketami(koren):
        if stranica in nado or not os.path.exists(os.path.join(koren, stranica)):
            continue
        with open(os.path.join(koren, stranica), encoding="utf-8") as f:
            html = f.read()
        if "/b/" not in html:
            continue
        novyj = html
        for imya, fajly in pakety.items():
            novyj = shablon(imya, vid(fajly)).sub(adresa[imya], novyj)
        if novyj != html:
            nado[stranica] = novyj
    lishnie = []
    for chasti in PAPKI:
        papka = os.path.join(koren, *chasti)
        if os.path.isdir(papka):
            for fn in sorted(os.listdir(papka)):
                put = "/".join(chasti + (fn,))
                if put not in nado:
                    lishnie.append(put)
    return nado, lishnie, adresa


def main():
    check = "--check" in sys.argv
    nado, lishnie, adresa = plan()
    izmeneno = []
    for put, t in nado.items():
        p = os.path.join(KOREN, put)
        staroe = None
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                staroe = f.read()
        if staroe != t:
            izmeneno.append(put)
            if not check:
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with open(p, "w", encoding="utf-8") as f:
                    f.write(t)
    for put in lishnie:
        izmeneno.append(put + " (удалить)")
        if not check:
            os.remove(os.path.join(KOREN, put))
    if check:
        if izmeneno:
            print("sobrat_js: нужна сборка — python3 tests/sobrat_js.py:\n  " + "\n  ".join(izmeneno))
            sys.exit(1)
        print("sobrat_js: пакеты собраны (%s)" % ", ".join(sorted(adresa.values())))
        return
    print("sobrat_js: %d файлов обновлено" % len(izmeneno) + ("".join("\n  " + x for x in izmeneno)))


if __name__ == "__main__":
    main()
