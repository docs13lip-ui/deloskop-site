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

_H1 = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
_NOINDEX = re.compile(r'<meta name="robots" content="[^"]*noindex')
_TEG = re.compile(r"<[^>]+>")


def kartochki(koren=KOREN):
    """→ [(папка, ИНН, имя html, ключ сортировки, текст без тегов, множество якорей)] — карточки юрлиц в индексе."""
    papka = os.path.join(koren, "company")
    out = []
    for d in sorted(os.listdir(papka)) if os.path.isdir(papka) else []:
        m = re.match(r"^(\d{10})-", d)
        put = os.path.join(papka, d, "index.html")
        if not m or not os.path.isfile(put):
            continue
        t = open(put, encoding="utf-8").read()
        h = _H1.search(t)
        if _NOINDEX.search(t) or not h:
            continue
        imya = re.sub(r"<span[^>]*>.*?</span>", "", h.group(1), flags=re.S).strip().rstrip(",")
        tekst = " ".join(html.unescape(_TEG.sub(" ", t)).replace(" ", " ").split())
        klyuch = re.sub(r"^(ООО|АО|ПАО|НАО|ЗАО|ОАО)\s*", "", html.unescape(_TEG.sub("", imya)).replace(" ", " ")).strip("«»\" ").lower()
        yakorya = set(re.findall(r'<section[^>]*aria-labelledby="([a-z0-9-]+)"', t))
        out.append((d, m.group(1), imya, klyuch, tekst, yakorya))
    return out


def _hesh(statya, inn):
    return hashlib.sha256(("%s|%s" % (statya, inn)).encode()).hexdigest()


def raspredelit(kart, temy=TEMY, na_statyu=NA_STATYU):
    """→ {статья: [карточки]}: подходящие по разделу и строке; сначала те, на кого меньше ссылок из статей."""
    schet = {k[0]: 0 for k in kart}
    out = {}
    for statya, yakor, _, filtr in temy:
        podhodyat = [k for k in kart if yakor in k[5] and (not filtr or filtr in k[4])]
        podhodyat.sort(key=lambda k: (schet[k[0]], _hesh(statya, k[1])))
        vybor = podhodyat[:na_statyu]
        for k in vybor:
            schet[k[0]] += 1
        out[statya] = sorted(vybor, key=lambda k: k[3])
    return out


def blok(yakor, opisanie, vybor):
    if not vybor:
        return PUSTO
    ssylki = ", ".join('<a href="/company/%s/#%s">%s</a>' % (k[0], yakor, k[2]) for k in vybor)
    return ("<!--stati-kartochki--><p class=\"stati-komp\"><strong>Как это выглядит на&nbsp;карточке компании:</strong> %s&nbsp;— %s. "
            "Порядок&nbsp;— по&nbsp;алфавиту, это не&nbsp;рейтинг.</p><!--/stati-kartochki-->") % (opisanie, ssylki)


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
        novyj = blok(yakor, opisanie, po[statya]) + "\n"
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
    if nado and proverit:
        print("stati-kartochki: устарели %d статей — запустите python3 tests/sobrat_stati_kartochki.py" % len(nado))
        return 1
    print("stati-kartochki: %s (%d статей, %d карточек в индексе)" % ("обновлено " + str(len(nado)) if nado else "собрано", len(TEMY), len(kart)))
    return 0


if __name__ == "__main__":
    sys.exit(sobrat("--check" in sys.argv[1:]))
