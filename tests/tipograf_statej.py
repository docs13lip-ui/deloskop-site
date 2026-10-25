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
    "sravnit/index.html": "main",  # sravnit-v1 (23.10.2026): «Сравнить двух поставщиков»
    "kak-rabotaet/index.html": "main",  # demo-vitrina-v1 (25.10.2026): показы продуктов
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
    # tipograf-mln-v1 (24.10.2026): «2,43 млн ₽» рвалось между «млн» и «₽» (лид Разбора № 27, 1280 px) — 311 мест на 42 страницах
    (re.compile(r"(млн|млрд|трлн|тыс\.) (?=₽)"), lambda m: m.group(1) + NB),             # 30 млн ₽, 412 тыс. ₽
    # tipograf-daty-v1 (24.10.2026): «17 апреля 2026» рвалось между числом и месяцем, месяцем и годом (замер 390/1280 — 92 места)
    (re.compile(r"(?<!\d)(\d{1,2}) (?=(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?![а-яё]))"), lambda m: m.group(1) + NB),  # 17 апреля
    (re.compile(r"(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) (?=\d{4}(?!\d))"), lambda m: m.group(1) + NB),  # апреля 2026
    (re.compile(r"(?<=\d{4}) (?=гг?\.)"), NB),
    (re.compile(r"(?<![\w-])(ООО|ОАО|ПАО|ЗАО|АО|НКО|ФГУП|МУП|ИП) (?=«)"), lambda m: m.group(1) + NB),                    # ООО «Пример»                                            # 2026 г.
    (re.compile(r" (?=—)"), NB),                                                        # слово — тире
    (re.compile(r"(?<![\w-])(пп?\.|ст\.|ч\.|№) "), lambda m: m.group(1) + NB),          # ст. 7, № 115
    (re.compile(r"(?i)(?<![\w&#-])(" + KOROTKIE + r") "), lambda m: m.group(1) + NB),   # в банк, не ждите
    (re.compile(r"(?<=\d)-(?=ФЗ\b)"), "&#8209;"),                                       # 115-ФЗ
]
# tipograf-chisla-v1 (24.10.2026): «2 | проверки», «35 | факторов», «12 | общедоступных критериев» рвались между числом
# и словом, которое оно считает (замер Chromium 390/1280, 87 страниц без /company/: 321 разрыв). Число держим со словом,
# если это счёт, а не номер: перед числом нет «п.», «ст.», «ч.», «№», «статья», «пункт», «критерий», «приложение», «код»…
# (иначе «п. 5 ст. 7.7 закона № 115‑ФЗ» стал бы одной неразрывной строкой шире телефона); после — слово из 3+ строчных
# букв, не сокращение. Номера с точкой («7.7», «54.1»), дробью («1/300»), дефисом и годы (4 цифры) — не трогаем.
CHISLO = re.compile(r"(?<![\w.,/\u2011&#-])(\d{1,3}(?:,\d+)?) (?=(?!(?:абз|подп|разд|прил|стр|руб|коп)\.)[а-яё]{3})")
METKA = re.compile(r"(?:(?<![\w-])(?:пп?|ч|ст|подп|абз|гл|ред|разд|прил)\.|№|(?<![\w-])(?:n|стать[а-яё]*|пункт[а-яё]*|подпункт[а-яё]*"
                   r"|критери[а-яё]*|приложени[а-яё]*|раздел[а-яё]*|глав[а-яё]*|код[а-яё]*|част[а-яё]*|абзац[а-яё]*|позици[а-яё]*"
                   r"|шаг[а-яё]*|вопрос[а-яё]*|строк[а-яё]*))(?:\s|&nbsp;)+$")


def chislo_slovo(t, nb=None):
    """«35 факторов» → неразрывно; «п. 5 ст.», «№ 12 от» — нет (номер, а не счёт). Одно правило — Python и tipo() скриптов."""
    nb = NB if nb is None else nb
    return CHISLO.sub(lambda m: m.group(0) if METKA.search(m.string[max(0, m.start() - 40):m.start()].lower()) else m.group(1) + nb, t)


# tipograf-chisla-v1: «ул. | Неглинная», «д. | 12», «г. | Сергиеву Посаду», «т. | е.» — сокращение не отрывается от того, к чему относится.
SOKR = re.compile(r"(?<![\w-])(г|ул|д|им|обл|корп|стр)\. (?=[А-ЯЁ0-9])|(?<![\w-])(т)\. (?=[ед]\.)")


def sokr(t, nb=None):
    nb = NB if nb is None else nb
    return SOKR.sub(lambda m: (m.group(1) or m.group(2)) + "." + nb, t)


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


# nomer-dela-v1 (25.10.2026): номер дела «309-ЭС24-21782», «А40-183390/2024», «№ 12-П» рвался по дефису (лента на 390 px —
# 10 мест, на 320 — 16). Неразрывный дефис (U+2011) не ставим: скопированный номер перестал бы находиться в kad.arbitr и на vsrf.
# Номер целиком — в <span class="nw"> (white-space: nowrap, partials/shapka.css): знаки те же, только перенос внутри запрещён.
# Не в tekst(): tekst() зовут и для текстовых узлов (DlkTipo.uzly), и для строк в JS — разметка там стала бы буквами.
# Ставят только сборщики, которые пишут HTML: лента (sobrat_lentu.t и nd() в скрипте /obnovleniya/), разборы (sobrat_praktika.nerazryv).
# Без lookbehind — то же выражение в JS (старые iOS); сторож tests/nomer_dela.test.js сверяет Python и JS.
NOMER_DELA = re.compile(r"(^|[^0-9A-Za-zЀ-ӿ_/\u2011-])((?:[0-9]{2,3}-(?:ЭС|КГ|КАД|АД|ЭК|АПГ|УД|КП)[0-9]{2}-[0-9]+(?:-К[0-9]+)?(?:\([0-9]+\))?"
                        r"|[АA][0-9]{2}-[0-9]+/[0-9]{4})(?![0-9]))")
NOMER_KS = re.compile(r"(№(?:&nbsp;|\u00a0| ))([0-9]{1,4}-[ПО])(?![0-9A-Za-zЀ-ӿ_])")
NW = '<span class="nw">'


def nomer_dela(t):
    """«№ 309-ЭС24-21782» → «№ <span class="nw">309-ЭС24-21782</span>»: только в тексте, где нет разметки (ленте — текст записи)."""
    t = NOMER_DELA.sub(lambda m: m.group(1) + NW + m.group(2) + "</span>", t)
    return NOMER_KS.sub(lambda m: m.group(1) + NW + m.group(2) + "</span>", t)


def tekst(t):
    t = sokr(chislo_slovo(t))  # tipograf-chisla-v1 — до PRAVILA: «п. 5» ещё с обычным пробелом, METKA видит оба вида
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
