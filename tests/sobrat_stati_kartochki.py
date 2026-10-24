#!/usr/bin/env python3
"""stati-kartochki-v1 (24.10.2026, [Ночные-2]): статьи /nalogi/ и /115-fz/ → карточки /company/ по теме.

Зачем: на каждую статью вела 1 ссылка на /company/ (хаб), а карточки ссылались только на 1–2 статьи. Поисковик не видел
связи «тема → живой пример», читатель — как это выглядит у настоящей компании. Теперь в статье — абзац «Как это
выглядит на карточке компании»: раздел карточки, который показывает тему статьи, и до 6 карточек со ссылкой прямо на
этот раздел (#reestry, #daty, #pered, #fin, #korotko, #zel).

Правила:
— только карточки в индексе (без noindex) и только юрлица (папка /company/<10 цифр>-…/); ИП не публикуем;
— раздел должен быть на карточке (якорь id), а если у темы есть строка-фильтр — и она тоже;
— выбор — «у кого меньше ссылок из статей», при равенстве — устойчивый хеш (статья, ИНН): одни и те же данные → те же
  байты; карточки распределяются по статьям, а не попадают все в одну;
— показ — по алфавиту, «это не рейтинг» (формулировка normy-kompanii-v1); статей о признаках «технических» компаний,
  ст. 54.1, блокировках и зонах риска ЗСК здесь нет — имя компании рядом с такой темой читалось бы как оценка.

Блок — между <!--stati-kartochki--> и <!--/stati-kartochki-->, перед «Как это решают суды» (<!--praktika-ssylki-->),
иначе в конце <article>. Пересборка — вместе с карточками (tests/kartochki.py sobrat/perepechatat).

kartochki-stati-v1 (24.10.2026, [Ночные-2]) — обратное направление: у каждой карточки юрлица в индексе в одном разделе
(#reestry, #daty, #pered, #fin, #korotko, #zel) строка «По теме раздела: «Заголовок статьи»». Карточка, которую назвала
статья, ссылается на эту же статью (взаимная ссылка); остальные — на статью своего раздела, у которой меньше ссылок с
карточек (при равенстве — устойчивый хеш), и только если раздел (и строка-фильтр темы) на карточке есть, а статьи на ней
ещё нет. Строку ставит tests/kartochki.py последним шагом сборки (через запись карточки — с датой изменения текста
WebPage), а снимает перед правками опубликованных; здесь --check сверяет и её.

stati-imena-v1 (24.10.2026, [Ночные-2]) — ответ [Право] 24.10, разд. 1.1 (ст. 152 ГК, деловая репутация): имя компании
рядом с темой «проверка по ЗСК», «запрос банка», «недостоверный адрес» читается как сведения о самой компании, а зон ЗСК
и запросов банков чужих компаний мы не знаем («не проверяли ≠ не нашли»). Поэтому статьи о сигналах (BEZ_IMEN) карточки
не называют — в них строка «раздел с проверкой по реестрам есть на каждой карточке → /company/». В нейтральных темах
(статусы, даты, отчётность ГИР БО, «Перед оплатой», «зелёные строки») имена остаются с подписью «Компании — для примера
раздела: по алфавиту, не по признакам. Это не рейтинг и не оценка.» Сторож — tests/test_stati_kartochki.py.

stati-kartochki-v3 (24.10.2026, [Ночные-2], задача Штаба 13:15): и обратного хода к статьям BEZ_IMEN нет — строка
«По теме раздела» на карточке конкретной компании ведёт только на 10 нейтральных статей (имя компании рядом с темой
«ЗСК», «запрос банка», «недостоверный адрес», «нет бухотчётности», «новые реквизиты» читалось бы как сведение о ней —
логика [Право] 1.1). Ровность распределения — по 10 статьям. Сторож — tests/test_stati_kartochki.py.

Запуск: python3 tests/sobrat_stati_kartochki.py          — собрать
        python3 tests/sobrat_stati_kartochki.py --check  — только проверить (код 1, если нужна сборка)
"""
import hashlib
import html
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NA_STATYU = 6
METKI = re.compile(r"<!--stati-kartochki-->.*?<!--/stati-kartochki-->\n?", re.S)
PUSTO = "<!--stati-kartochki--><!--/stati-kartochki-->"

# статья → (якорь раздела карточки, как назвать раздел, строка-фильтр в карточке или None)
TEMY = [
    ("nalogi/nedostovernyj-adres-egryul", "reestry", "раздел «Проверка по&nbsp;реестрам», строка «Отметки о&nbsp;недостоверности»", "Отметки о недостоверности"),
    ("nalogi/izmeneniya-egryul-kontragenta", "daty", "раздел «Даты из&nbsp;реестра», строка «Последнее изменение записи в&nbsp;ЕГРЮЛ»", "Последнее изменение записи"),
    ("nalogi/kody-statusa-egryul", "daty", "раздел «Даты из&nbsp;реестра»: когда компания зарегистрирована и&nbsp;с&nbsp;какой даты сведения", None),
    ("nalogi/svezhest-dannyh-proverki-kontragenta", "reestry", "раздел «Проверка по&nbsp;реестрам»: у&nbsp;каждой строки&nbsp;— источник и&nbsp;«сведения на&nbsp;…»", None),
    ("nalogi/proverka-kontragenta-pered-dogovorom", "korotko", "раздел «Коротко о&nbsp;компании»: главные факты с&nbsp;источником и&nbsp;датой", None),
    ("nalogi/dokumenty-kontragenta-po-summe-sdelki", "daty", "под «Датами из&nbsp;реестра»&nbsp;— Паспорт контрагента с&nbsp;документами, которые стоит запросить", "документы, которые стоит запросить"),
    ("nalogi/skolko-platit-vpered-neznakomoj-kompanii", "pered", "раздел «Перед оплатой»", None),
    ("nalogi/kak-proverit-schet-pered-oplatoj", "pered", "раздел «Перед оплатой», строка «Счёт от&nbsp;…: сверьте ИНН, название и&nbsp;банк»", "сверьте ИНН"),
    ("nalogi/pismo-o-smene-rekvizitov-kak-proverit", "pered", "раздел «Перед оплатой»: с&nbsp;какими ИНН, названием и&nbsp;банком сверять счёт", "сверьте ИНН"),
    ("nalogi/chto-oznachayut-cifry-inn-i-kpp", "pered", "раздел «Перед оплатой»: ИНН компании, с&nbsp;которым сверяют счёт", "сверьте ИНН"),
    ("nalogi/net-otchetnosti-v-otkrytyh-dannyh", "fin", "раздел с&nbsp;выручкой и&nbsp;прибылью по&nbsp;годам из&nbsp;ГИР&nbsp;БО", None),
    ("nalogi/nds-postavshchika-na-usn-po-inn", "fin", "раздел с&nbsp;выручкой по&nbsp;годам из&nbsp;ГИР&nbsp;БО", None),
    ("nalogi/nagruzka", "fin", "под выручкой&nbsp;— средняя налоговая нагрузка отрасли компании по&nbsp;данным ФНС", "Средняя налоговая нагрузка"),
    ("115-fz/proverit-kontragenta-zsk-po-inn", "zel", "раздел о&nbsp;том, что значат зелёные строки компании для&nbsp;банка и&nbsp;налоговой", None),
    ("115-fz/zapros-banka-po-115-fz-kak-otvetit", "zel", "раздел о&nbsp;том, что значат зелёные строки компании для&nbsp;банка и&nbsp;налоговой", None),
]

# статьи о сигналах — без имён компаний (ответ [Право] 24.10, разд. 1.1); карточки по-прежнему могут ссылаться на них
BEZ_IMEN = {
    "nalogi/nedostovernyj-adres-egryul",
    "nalogi/net-otchetnosti-v-otkrytyh-dannyh",
    "nalogi/pismo-o-smene-rekvizitov-kak-proverit",
    "115-fz/proverit-kontragenta-zsk-po-inn",
    "115-fz/zapros-banka-po-115-fz-kak-otvetit",
}
PODPIS = "Компании&nbsp;— для&nbsp;примера раздела: по&nbsp;алфавиту, не&nbsp;по&nbsp;признакам. Это не&nbsp;рейтинг и&nbsp;не&nbsp;оценка."
BEZ_IMEN_TEKST = ("<!--stati-kartochki--><p class=\"stati-komp\"><strong>Как это выглядит на&nbsp;карточке компании:</strong> "
                  "раздел с&nbsp;проверкой по&nbsp;реестрам есть на&nbsp;каждой карточке&nbsp;→ <a href=\"/company/\">карточки компаний</a>.</p>"
                  "<!--/stati-kartochki-->")

_H1 = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
K_METKI = re.compile(r"<!--karta-statya-->.*?<!--/karta-statya-->", re.S)


def ubrat_iz_kartochki(t):
    """Карточка без строки «По теме раздела» — до правок опубликованной страницы и для подбора по тексту."""
    return K_METKI.sub("", t)
_NOINDEX = re.compile(r'<meta name="robots" content="[^"]*noindex')
_TEG = re.compile(r"<[^>]+>")


def kartochki(koren=KOREN):
    """→ [(папка, ИНН, имя html, ключ сортировки, текст без тегов, множество якорей, html без строки статьи)] — карточки
    юрлиц в индексе."""
    papka = os.path.join(koren, "company")
    out = []
    for d in sorted(os.listdir(papka)) if os.path.isdir(papka) else []:
        m = re.match(r"^(\d{10})-", d)
        put = os.path.join(papka, d, "index.html")
        if not m or not os.path.isfile(put):
            continue
        t = ubrat_iz_kartochki(open(put, encoding="utf-8").read().replace("&#160;", " "))  # kartochki-chisla-v1: NB_T карточки — обычным пробелом
        h = _H1.search(t)
        if _NOINDEX.search(t) or not h:
            continue
        imya = re.sub(r"<span[^>]*>.*?</span>", "", h.group(1), flags=re.S).strip().rstrip(",")
        tekst = " ".join(html.unescape(_TEG.sub(" ", t)).replace(" ", " ").split())
        klyuch = re.sub(r"^(ООО|АО|ПАО|НАО|ЗАО|ОАО)\s*", "", html.unescape(_TEG.sub("", imya)).replace(" ", " ")).strip("«»\" ").lower()
        yakorya = set(re.findall(r'<section[^>]*aria-labelledby="([a-z0-9-]+)"', t))
        out.append((d, m.group(1), imya, klyuch, tekst, yakorya, t))
    return out


def _hesh(statya, inn):
    return hashlib.sha256(("%s|%s" % (statya, inn)).encode()).hexdigest()


def raspredelit(kart, temy=TEMY, na_statyu=NA_STATYU):
    """→ {статья: [карточки]}: подходящие по разделу и строке; сначала те, на кого меньше ссылок из статей."""
    schet = {k[0]: 0 for k in kart}
    out = {}
    for statya, yakor, _, filtr in temy:
        if statya in BEZ_IMEN:
            out[statya] = []
            continue
        podhodyat = [k for k in kart if yakor in k[5] and (not filtr or filtr in k[4])]
        podhodyat.sort(key=lambda k: (schet[k[0]], _hesh(statya, k[1])))
        vybor = podhodyat[:na_statyu]
        for k in vybor:
            schet[k[0]] += 1
        out[statya] = sorted(vybor, key=lambda k: k[3])
    return out


def blok(yakor, opisanie, vybor, statya=None):
    if statya in BEZ_IMEN:
        return BEZ_IMEN_TEKST
    if not vybor:
        return PUSTO
    ssylki = ", ".join('<a href="/company/%s/#%s">%s</a>' % (k[0], yakor, k[2]) for k in vybor)
    return ("<!--stati-kartochki--><p class=\"stati-komp\"><strong>Как это выглядит на&nbsp;карточке компании:</strong> %s&nbsp;— %s. "
            "%s</p><!--/stati-kartochki-->") % (opisanie, ssylki, PODPIS)


def zagolovok_stati(statya, koren=KOREN):
    put = os.path.join(koren, statya, "index.html")
    if not os.path.isfile(put):
        return None
    h = _H1.search(open(put, encoding="utf-8").read().replace("&#160;", " "))  # kartochki-chisla-v1: NB_T карточки — обычным пробелом
    return " ".join(_TEG.sub("", h.group(1)).split()) if h else None


def obratno(kart, po, koren=KOREN):
    """→ {папка карточки: (статья, якорь)}: взаимная ссылка, иначе — статья раздела с наименьшим числом карточек."""
    out = {}
    nagruzka = {statya: 0 for statya, *_ in TEMY if statya not in BEZ_IMEN}
    for statya, yakor, _, _ in TEMY:
        if statya in BEZ_IMEN:  # stati-kartochki-v3: со статьями-«сигналами» карточки не связываем ни в одну сторону
            continue
        for k in po.get(statya, []):
            if k[0] not in out and ("/%s/" % statya) not in k[6]:  # уже ссылается — взаимность есть, берём другую
                out[k[0]] = (statya, yakor)
                nagruzka[statya] += 1
    est = {statya for statya, *_ in TEMY if statya not in BEZ_IMEN and zagolovok_stati(statya, koren)}
    for k in sorted(kart, key=lambda x: x[0]):
        if k[0] in out:
            continue
        podhodyat = [(statya, yakor) for statya, yakor, _, filtr in TEMY
                     if statya in est and yakor in k[5] and (not filtr or filtr in k[4]) and ("/%s/" % statya) not in k[6]]
        if not podhodyat:
            continue
        statya, yakor = min(podhodyat, key=lambda x: (nagruzka[x[0]], _hesh(x[0], k[1])))
        out[k[0]] = (statya, yakor)
        nagruzka[statya] += 1
    return out


def stroka_kartochki(statya, zag):
    return ('<!--karta-statya--><p class="co-statya">По&nbsp;теме раздела: <a href="/%s/">%s</a></p><!--/karta-statya-->'
            % (statya, zag))


def vstavit_v_kartochku(t, statya, yakor, zag):
    t = ubrat_iz_kartochki(t)
    rx = re.compile(r'(<section[^>]*aria-labelledby="%s"[^>]*>.*?)(</section>)' % re.escape(yakor), re.S)
    return rx.sub(lambda m: m.group(1) + stroka_kartochki(statya, zag) + m.group(2), t, count=1)


def kartochki_so_statyami(koren=KOREN):
    """→ {путь карточки: новый текст} для всех карточек юрлиц на диске (у карточек вне подбора строка снимается)."""
    kart = kartochki(koren)
    po = raspredelit(kart)
    karta = obratno(kart, po, koren)
    zag = {statya: zagolovok_stati(statya, koren) for statya, *_ in TEMY}
    papka = os.path.join(koren, "company")
    out = {}
    for d in sorted(os.listdir(papka)) if os.path.isdir(papka) else []:
        put = os.path.join(papka, d, "index.html")
        if not re.match(r"^\d{10}-", d) or not os.path.isfile(put):
            continue
        t = open(put, encoding="utf-8").read().replace("&#160;", " ")  # kartochki-chisla-v1: NB_T карточки — обычным пробелом
        if d in karta:
            statya, yakor = karta[d]
            out[put] = vstavit_v_kartochku(t, statya, yakor, zag[statya])
        else:
            out[put] = ubrat_iz_kartochki(t)
    return out


def sobrat(proverit=False, koren=KOREN):
    kart = kartochki(koren)
    po = raspredelit(kart)
    nado = []
    for statya, yakor, opisanie, _ in TEMY:
        put = os.path.join(koren, statya, "index.html")
        if not os.path.isfile(put):
            print("stati-kartochki: нет статьи " + statya)
            return 1
        s = open(put, encoding="utf-8").read()
        novyj = blok(yakor, opisanie, po[statya], statya) + "\n"
        if METKI.search(s):
            novoe = METKI.sub(lambda m: novyj, s, count=1)
        else:
            mesto = "<!--praktika-ssylki-->" if "<!--praktika-ssylki-->" in s else "</article>"
            if mesto not in s:
                print("stati-kartochki: нет места для блока в " + statya)
                return 1
            novoe = s.replace(mesto, novyj + mesto, 1)
        if novoe != s:
            nado.append(statya)
            if not proverit:
                open(put, "w", encoding="utf-8").write(novoe)
    if proverit:
        for put, t in kartochki_so_statyami(koren).items():
            if open(put, encoding="utf-8").read().replace("&#160;", " ") != t:  # kartochki-chisla-v1: сверка без NB_T
                nado.append(put)
    if nado and proverit:
        print("stati-kartochki: устарели %d страниц — запустите python3 tests/sobrat_stati_kartochki.py "
              "(строки «По теме раздела» на карточках — python3 tests/kartochki.py perepechatat)" % len(nado))
        return 1
    print("stati-kartochki: %s (%d статей, %d карточек в индексе)" % ("обновлено " + str(len(nado)) if nado else "собрано", len(TEMY), len(kart)))
    return 0


if __name__ == "__main__":
    sys.exit(sobrat("--check" in sys.argv[1:]))
