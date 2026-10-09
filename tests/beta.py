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


# ---------- beta-data-v1 (ТЗ [Продукт] 05.10, claude/Продукт_14.10_без_ворот_бета_не_врёт_05.10.md, разд. 1;
#            тексты B и C — [Право] 05.10 11:10, разд. 1): дата конца беты — одно место, tarify.json → "beta_do".
# Сборка от сегодняшнего дня НЕ зависит (иначе после 14.10 проверка «сборщики ничего не меняют» краснела бы сама):
# дата → вариант A, null → B. Переход A → B в полночь МСК делает браузер (инлайн-скрипт полосы и js/shapka.js).
MES = ("января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря")
NBSP = "&nbsp;"
DATA_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def beta_do(koren=KOREN):
    """→ "ГГГГ-ММ-ДД" (последний бесплатный день, МСК) или None (дата не назначена)."""
    with open(os.path.join(koren, "tarify", "tarify.json"), encoding="utf-8") as fh:
        v = json.load(fh).get("beta_do")
    if v is None:
        return None
    if not isinstance(v, str) or not DATA_RE.match(v):
        raise ValueError('tarify.json: "beta_do" — дата ГГГГ-ММ-ДД или null, а не %r' % (v,))
    return v


def data_ru(iso):
    """«2026-10-13» → «13&nbsp;октября»."""
    g, m, d = (int(x) for x in DATA_RE.match(iso).groups())
    return "%d%s%s" % (d, NBSP, MES[m - 1])


def sleduyushij(iso):
    import datetime
    return (datetime.date(*(int(x) for x in DATA_RE.match(iso).groups())) + datetime.timedelta(days=1)).isoformat()


def _chast(imya):
    with open(os.path.join(KOREN, "partials", imya), encoding="utf-8") as fh:
        return fh.read().strip("\n")


def rezhim_polosy(beta, bdo):
    """a — дата есть (браузер сам сменит на b после конца дня); b — даты нет; c — оплаты включены, дата была;
    None — полосы нет (оплаты включены, даты нет)."""
    if beta:
        return "a" if bdo else "b"
    return "c" if bdo else None


def polosa_sobrat(beta, bdo):
    """Полоса из partials/beta.html (каркас) и partials/beta-a|b|c.html (текст). Ключ «скрыть» — свой для каждой даты:
    сменилась дата — полосу снова видят все, и те, кто нажал «×» ([Право] 05.10, условие 2)."""
    r = rezhim_polosy(beta, bdo)
    if r is None:
        return ""
    D = data_ru(bdo) if bdo else ""
    D1 = data_ru(sleduyushij(bdo)) if bdo else ""
    tekst = _chast("beta-%s.html" % r).replace("{{D}}", D).replace("{{D1}}", D1)
    zapas = ('<template data-beta-b>' + _chast("beta-b.html") + '</template>') if r == "a" else ""
    krestik = "" if r == "c" else _chast("beta-x.html")
    return (_chast("beta.html").replace("{{REZHIM}}", r).replace("{{DO}}", bdo or "")
            .replace("{{KLASS}}", " beta-bar--c" if r == "c" else "")
            .replace("{{TEKST}}", tekst).replace("{{ZAPAS}}", zapas).replace("{{KRESTIK}}", krestik))


# Сроки беты в текстах страниц: <span data-beta-srok…> по 13 октября[ включительно]</span>. Сборщик вписывает дату из
# beta_do (или оставляет пусто, если даты нет); браузер убирает span, когда день прошёл (js/shapka.js) — фраза
# «всё бесплатно по 13 октября» сама становится «всё бесплатно». data-beta-vkl — с «включительно».
SROK = re.compile(r'<span data-beta-srok(?:="[^"]*")?( data-beta-vkl)?>[^<]*</span>')
# Старые карточки (собраны до beta-data-v1, напр. комплект kartochki-0710-v1): дата текстом в ссылке входа в Паспорт.
SROK_STARYJ = re.compile(r"(В&nbsp;бете бесплатно) по&nbsp;\d{1,2}&nbsp;(?:%s)(&nbsp;→)" % "|".join(MES))


def srok_span(bdo, vkl=False):
    if not bdo:
        return '<span data-beta-srok%s></span>' % (" data-beta-vkl" if vkl else "")
    return '<span data-beta-srok="%s"%s> по%s%s%s</span>' % (bdo, " data-beta-vkl" if vkl else "", NBSP, data_ru(bdo),
                                                         " включительно" if vkl else "")


def sroki(txt, bdo):
    txt = SROK_STARYJ.sub(lambda m: m.group(1) + srok_span(None) + m.group(2), txt)
    return SROK.sub(lambda m: srok_span(bdo, bool(m.group(1))), txt)


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


def polosa_html(beta=True, bdo=None):
    """Полоса для режима; bdo по умолчанию — из tarify.json."""
    return polosa_sobrat(beta, beta_do() if bdo is None else (bdo or None))


def primenit(txt, beta, polosa=None, bdo=False):
    """Привести страницу к режиму. Идемпотентно: primenit(primenit(x, b), b) == primenit(x, b).
    bdo: False — взять beta_do из tarify.json; None или "ГГГГ-ММ-ДД" — задать явно (тесты)."""
    if bdo is False:
        bdo = beta_do()
    txt = sroki(txt, bdo)
    txt = BLOK.sub(lambda m: blok(m.group(1), m.group(2), beta), txt)
    # метка режима в <head>
    txt = txt.replace(META + "\n", "").replace(META, "")
    if beta and "</head>" in txt:
        txt = txt.replace("</head>", META + "\n</head>", 1)
    # полоса под шапкой — только на страницах с единой шапкой
    txt = POLOSA.sub("", txt)
    p = polosa if polosa is not None else polosa_sobrat(beta, bdo)
    if p and "<!--/shapka-->" in txt:
        txt = txt.replace("<!--/shapka-->", "<!--/shapka-->\n<!--beta-polosa-->" + p + "<!--/beta-polosa-->", 1)
    return txt


def vidimoe(txt):
    """То, что видит посетитель и робот: без <template> (для тестов)."""
    return re.sub(r"<template\b.*?</template>", "", txt, flags=re.S)
