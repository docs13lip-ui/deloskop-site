#!/usr/bin/env python3
"""Типографика статей: неразрывные пробелы после коротких слов, у чисел, перед тире; «115‑ФЗ» без переноса.

    python3 tests/tipograf_statej.py          # поправить статьи (повторный запуск ничего не меняет)
    python3 tests/tipograf_statej.py --check  # проверить: правок не нужно (код 1 — есть что поправить)

Зачем: в части статей /115-fz/ и /nalogi/ предлоги «в», «на», «по»… висели в конце строки, а «6 месяцев»
и «30 000 ₽» рвались переносом — на телефоне (390 px) это видно в каждом абзаце. Правила — те же, что
у сборщика «Частых вопросов» (tests/sobrat_faq.py → tipo): одна типографика на весь сайт.

Что трогаем: только видимый текст внутри <article>…</article> (между тегами). Не трогаем: атрибуты,
<script>, <style>, <code>, <pre>, <textarea> и всё, что лежит между служебными метками <!--x-->…<!--/x-->
(эти куски собирают свои сборщики: FAQ, «Как это решают суды», нормы нагрузки, полоса беты и т. п.).
Слова и цифры не меняются — только пробелы и дефис в «NNN-ФЗ»; поэтому сверка FAQ «дословно из статьи»
(sobrat_faq.norm) и смысл текста остаются прежними.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAZDELY = ("115-fz", "nalogi")  # статьи, которые пишутся руками; /praktika/ собирает sobrat_praktika.py
NB = "&nbsp;"
KOROTKIE = r"(?:в|и|а|к|с|у|о|я|по|на|не|до|от|за|из|ни|но|же|ли|без|для|под|над|при|про|со|об)"

PRAVILA = [
    (re.compile(r"(?<=\d) (?=\d{3}\b)"), NB),                                         # 30 000
    (re.compile(r"(?<=\d) (?=(?:₽|%|млн|млрд|тыс|рабоч|дн|месяц|год|лет|час|минут))"), NB),  # 6 месяцев, 10 %
    (re.compile(r" (?=—)"), NB),                                                        # слово — тире
    (re.compile(r"(?<![\w-])(пп?\.|ст\.|ч\.|№) "), lambda m: m.group(1) + NB),          # ст. 7, № 115
    (re.compile(r"(?i)(?<![\w&#-])(" + KOROTKIE + r") "), lambda m: m.group(1) + NB),   # в банк, не ждите
    (re.compile(r"(?<=\d)-(?=ФЗ\b)"), "&#8209;"),                                       # 115-ФЗ
]

# Куски, внутри которых текст не трогаем: служебные блоки сборщиков, код, скрипты, стили, комментарии.
NE_TROGAT = re.compile(
    r"<!--([a-z0-9-]+)-->.*?<!--/\1-->"
    r"|<(script|style|code|pre|textarea)\b.*?</\2>"
    r"|<!--.*?-->",
    re.S | re.I)
TEG = re.compile(r"(<[^>]*>)")


def tekst(t):
    for rx, na in PRAVILA:
        t = rx.sub(na, t)
    return t


def kusok(s):
    """Типографика для куска HTML без служебных блоков: только текст между тегами."""
    return "".join(c if c.startswith("<") else tekst(c) for c in TEG.split(s))


def statya(s):
    """Типографика внутри <article>…</article>; остальная страница — как была."""
    if "<article" not in s or "</article>" not in s:
        return s
    a = s.index("<article")
    b = s.index("</article>")
    vnutri, out, i = s[a:b], [], 0
    for m in NE_TROGAT.finditer(vnutri):
        out.append(kusok(vnutri[i:m.start()]))
        out.append(m.group(0))
        i = m.end()
    out.append(kusok(vnutri[i:]))
    return s[:a] + "".join(out) + s[b:]


def stranicy():
    for r in RAZDELY:
        yield from sorted((ROOT / r).glob("*/index.html"))


def main(argv):
    check = "--check" in argv
    izm = []
    for p in stranicy():
        s = p.read_text(encoding="utf-8")
        nov = statya(s)
        if nov != s:
            izm.append(str(p.relative_to(ROOT)))
            if not check:
                p.write_text(nov, encoding="utf-8")
    if check:
        if izm:
            print("типографика статей не доведена (" + str(len(izm)) + "): python3 tests/tipograf_statej.py")
            print("\n".join(izm))
            return 1
        print("типографика статей ✓")
        return 0
    print("поправлено страниц: " + str(len(izm)))
    print("\n".join(izm))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
