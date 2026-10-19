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
RAZDELY = ("115-fz", "nalogi")  # статьи, которые пишутся руками; /praktika/ собирает sobrat_praktika.py — он зовёт statya() сам
# tipograf-stranic-v1 (18.10.2026): длинные страницы, которые пишутся руками, — тот же типограф, свой тег-рамка.
# Не берём: страницы целиком из сборщиков (/tarify/, /reyting/, /zhurnal/, /obnovleniya/, /company/) и юридические
# документы (/oferta/, /politika/, /soglasie/, /cookies/, /vozvrat/, /partneram/usloviya/, /rassylki/) — их только с [Право].
STRANICY = {
    "indeks/index.html": "main",  # tipograf-obolochka-v1: оговорка и «Проверить» после методики — тоже текст страницы
    "o-proekte/index.html": "article",
    "tochnost/index.html": "article",
    "pasport/index.html": "main",
    "pasport/proverka/index.html": "article",
    "nalichnye/index.html": "main",
    "kontragenty-iz-vypiski/index.html": "main",
    "skoraya-115-fz/index.html": "main",
    "proverit-schet/index.html": "main",
    "osnovatel/index.html": "main",
    "index.html": "main",  # tipograf-tarify-v1 (18.10.2026): главная — пишется руками; строку цен и JSON-LD правит sobrat_tarify
    # tipograf-yur-v1 (19.10.2026): юридические документы — «да» [Право] 19.10 10:50 (п. 333 б): меняется только вид
    # пробела и дефиса; без U+00A0 и U+2011 текст побуквенно прежний (сторож tipograf_yur.test.js), дату редакции не трогаем.
    # Блоки сборщиков (<!--oplata-->, <!--v-bete-->, <!--r:…-->, реквизиты) — как везде, не трогаем.
    "oferta/index.html": "main",
    "politika/index.html": "main",
    "soglasie/index.html": "main",
    "cookies/index.html": "main",
    "vozvrat/index.html": "main",
    "rassylki/index.html": "main",
    "partneram/usloviya/index.html": "main",
}
NB = "&nbsp;"
KOROTKIE = r"(?:в|и|а|к|с|у|о|я|по|на|не|до|от|за|из|ни|но|же|ли|без|для|под|над|при|про|со|об|во|мы|вы|он|её|ее|их|ей|им)"  # detali-v1: + во и местоимения (аудит 18.10)

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
    r"|<!--r:[a-z0-9_-]+-->.*?<!--/r-->"  # реквизиты из rekvizity.json (sobrat_shapku)
    r"|<ul\b[^>]*\bdata-puls\b.*?</ul>"  # «Последние изменения» на /o-proekte/ — пишет sobrat_lentu
    r'|<p class="meta">Редакция от\b.*?</p>'  # tipograf-yur-v1: дату редакции читают счёт и акт (startovaya.RED_RE) — байт в байт
    r"|<!--.*?-->",
    re.S | re.I)
TEG = re.compile(r"(<[^>]*>)")
SKRIPT = re.compile(r"<script\b.*?</script>", re.S | re.I)


def tekst(t):
    for rx, na in PRAVILA:
        t = rx.sub(na, t)
    return t


def kusok(s):
    """Типографика для куска HTML без служебных блоков: только текст между тегами."""
    return "".join(c if c.startswith("<") else tekst(c) for c in TEG.split(s))


def statya(s, teg="article"):
    """Типографика внутри <article>…</article> (или другого тега: хабы /praktika/ — <main>); остальная страница — как была."""
    # Ищем рамку вне <script>: в скриптах страниц бывает разметка строкой ('<article class="pp">' на /pasport/).
    skripty = [(m.start(), m.end()) for m in SKRIPT.finditer(s)]
    vne = lambda i: not any(x <= i < y for x, y in skripty)
    a = next((m.start() for m in re.finditer("<" + teg + r"[\s>]", s) if vne(m.start())), None)
    b = next((m.start() for m in re.finditer("</" + teg + ">", s) if a is not None and m.start() > a and vne(m.start())), None)
    if a is None or b is None:
        return s
    return s[:a] + fragment(s[a:b]) + s[b:]


def fragment(s):
    """Типографика куска HTML целиком: служебные блоки сборщиков, скрипты, стили и комментарии не трогаем.
    Для оболочки (шапка, подвал — tests/sobrat_shapku.py), статей и страниц из STRANICY — одни правила."""
    out, i = [], 0
    for m in NE_TROGAT.finditer(s):
        out.append(kusok(s[i:m.start()]))
        out.append(m.group(0))
        i = m.end()
    out.append(kusok(s[i:]))
    return "".join(out)


def stranicy():
    """(путь, тег-рамка): статьи разделов — <article>; страницы из STRANICY — свой тег."""
    for r in RAZDELY:
        for p in sorted((ROOT / r).glob("*/index.html")):
            # tipograf-obolochka-v1: рамка — <main>: после <article> идут «Проверьте себя», «Источники», оговорка
            # и «Читайте также» — там висели «за несколько», «от 26.08.2025», «не заменяют» (замер 19.10, 390 px)
            # Страницы без <article> (калькулятор, справочник нагрузки — свои сборщики) — как раньше, не трогаем.
            yield p, ("main" if "<article" in p.read_text(encoding="utf-8") else "article")
    for put, teg in STRANICY.items():
        if (ROOT / put).exists():
            yield ROOT / put, teg
    # tipograf-obolochka-v1 (19.10.2026): шапка — на всех страницах (sobrat_shapku вставляет файл байт в байт);
    # типографим источник целиком, иначе «из вашей выписки», «для банка и партнёров» висели на каждой странице.
    yield ROOT / "partials" / "shapka.html", None


def main(argv):
    check = "--check" in argv
    izm = []
    for p, teg in stranicy():
        s = p.read_text(encoding="utf-8")
        nov = statya(s, teg) if teg else fragment(s)
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
