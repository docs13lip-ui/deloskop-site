#!/usr/bin/env python3
"""Открытая бета — один переключатель (решение владельца 29.09.2026, claude/Решения_владельца_29.09_бета_без_оплат.md).

Флаг — tarify/tarify.json → "beta": true | false. Читают сборщики (tests/sobrat_tarify.py, tests/sobrat_shapku.py);
переключили флаг → запустили оба сборщика → сайт в другом режиме. Работает в обе стороны, без потерь.

Разметка в исходнике страниц — две половины рядом:
    <!--oplata-->  то, что ведёт к оплате (кнопки, счёт, «Как оплатить»)  <!--/oplata-->
    <!--v-bete-->  что показать вместо этого в бете (может быть пусто)     <!--/v-bete-->
Половина, которая сейчас не нужна, лежит в <template> — браузер её не показывает и не выполняет, а у ссылок
внутри href переименован в data-oplata-href, чтобы ни человек, ни робот не нашли на странице путь к счёту.
Вернули флаг — половины меняются местами, текст байт в байт прежний (тест tests/test_beta.py).

Ещё в бете: <meta name="deloskop-rezhim" content="beta"> в <head> (js/schet.js не открывает форму счёта,
js/rekvizity.js не подставляет реквизиты, js/otzyv.js подписывает оценку «бета») и полоса под шапкой
(/partials/beta.html между <!--beta-polosa--> и <!--/beta-polosa-->).
"""
import json
import os
import re

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BLOK = re.compile(r"<!--oplata-->(.*?)<!--/oplata-->(?:<!--v-bete-->(.*?)<!--/v-bete-->)?", re.S)
T_OPL = ("<template data-oplata>", "</template>")
T_BET = ("<template data-v-bete>", "</template>")
META = '<meta name="deloskop-rezhim" content="beta">'
POLOSA = re.compile(r"<!--beta-polosa-->.*?<!--/beta-polosa-->\n?", re.S)


def vklyuchena(koren=KOREN):
    with open(os.path.join(koren, "tarify", "tarify.json"), encoding="utf-8") as fh:
        return json.load(fh).get("beta") is True


def _snyat(s, t, spryatano):
    """Каноническая форма половины: без обёртки <template> и с настоящими href."""
    if s.startswith(t[0]) and s.endswith(t[1]):
        s = s[len(t[0]):-len(t[1])]
        if spryatano:
            s = s.replace(" data-oplata-href=", " href=")
    return s


def _spryatat(s, t):
    if not s:
        return s
    return t[0] + s.replace(" href=", " data-oplata-href=") + t[1]


def blok(oplata, v_bete, beta):
    oplata = _snyat(oplata, T_OPL, True)
    v_bete = _snyat(v_bete or "", T_BET, True)
    if beta:
        return "<!--oplata-->" + _spryatat(oplata, T_OPL) + "<!--/oplata--><!--v-bete-->" + v_bete + "<!--/v-bete-->"
    return "<!--oplata-->" + oplata + "<!--/oplata--><!--v-bete-->" + _spryatat(v_bete, T_BET) + "<!--/v-bete-->"


def polosa_html():
    with open(os.path.join(KOREN, "partials", "beta.html"), encoding="utf-8") as fh:
        return fh.read().strip("\n")


def primenit(txt, beta, polosa=None):
    """Привести страницу к режиму. Идемпотентно: primenit(primenit(x, b), b) == primenit(x, b)."""
    txt = BLOK.sub(lambda m: blok(m.group(1), m.group(2), beta), txt)
    # метка режима в <head>
    txt = txt.replace(META + "\n", "").replace(META, "")
    if beta and "</head>" in txt:
        txt = txt.replace("</head>", META + "\n</head>", 1)
    # полоса под шапкой — только на страницах с единой шапкой
    txt = POLOSA.sub("", txt)
    if beta and "<!--/shapka-->" in txt:
        p = polosa if polosa is not None else polosa_html()
        txt = txt.replace("<!--/shapka-->", "<!--/shapka-->\n<!--beta-polosa-->" + p + "<!--/beta-polosa-->", 1)
    return txt


def vidimoe(txt):
    """То, что видит посетитель и робот: без <template> (для тестов)."""
    return re.sub(r"<template\b.*?</template>", "", txt, flags=re.S)
