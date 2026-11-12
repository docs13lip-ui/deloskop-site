#!/usr/bin/env python3
"""Сборщик разделов для строки поиска (poisk-v2-a, 13.11.2026): data/poisk-razdely.json.

Зачем: строка на главной понимает не только ИНН, но и вопрос словами («банк запросил документы» →
«Скорая 115-ФЗ»). Слова для поиска берутся из <title> и описания самой страницы плюс короткий список
разговорных слов ниже — поменяли заголовок страницы, пересобрали, и поиск знает новые слова.

Источник правды — RAZDELY ниже (адрес, короткое имя, подпись, разговорные слова) и сами страницы.
Запуск: python3 tests/sobrat_poisk.py          — собрать
        python3 tests/sobrat_poisk.py --check  — только проверить (код 1, если файл устарел или адреса нет)
"""
import html
import json
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAJL = os.path.join("data", "poisk-razdely.json")

# адрес, имя в строке, подпись, разговорные слова (как люди спрашивают)
RAZDELY = [
    ("/", "Проверить компанию по ИНН", "Отчёт: статус, долги, суды, Индекс 1–99",
     "проверить проверка контрагент компания инн поставщик"),
    ("/proverit-schet/", "Проверь счёт", "Номер счёта, БИК и поставщик — до оплаты",
     "счет реквизиты бик расчетный платеж оплата подмена платежка"),
    ("/kontragenty-iz-vypiski/", "Кому вы платите", "Все контрагенты из выписки одним списком",
     "выписка контрагенты список платежи банк 1с"),
    ("/nalichnye/", "Наличные глазами банка", "Сколько можно снять и что спросит банк",
     "наличные снять снятие обнал карта лимит касса"),
    ("/skoraya-115-fz/", "Скорая 115-ФЗ", "Банк запросил документы или ограничил счёт",
     "банк блокировка заблокировал заблокировали запрос запросил документы 115 ограничил счет отказ дбо требует"),
    ("/115-fz/", "115-ФЗ простыми словами", "Как банк оценивает операции",
     "115 закон зск светофор красная желтая группа риск отмывание"),
    ("/kak-vidit-bank/", "Как видит банк", "Ваша компания глазами банка",
     "банк видит комплаенс риск глазами"),
    ("/indeks/", "Индекс Делоскопа", "Как считаем балл 1–99",
     "индекс балл оценка методика считаем"),
    ("/pasport/", "Паспорт контрагента", "Одна страница о компании — переслать директору",
     "паспорт досье переслать страница"),
    ("/delopis/", "Делопись", "Договор с реквизитами контрагента",
     "договор письмо шаблон документ"),
    ("/nalogi/", "Налоги", "Вычеты, требования, доначисления",
     "налог налоги налоговая ндс усн вычет фнс доначисление требование 54.1"),
    ("/praktika/", "Разборы дел", "Судебная практика простым языком",
     "суд практика разбор дело верховный арбитраж"),
    ("/reyting/", "Рейтинг компаний", "По регионам и отраслям",
     "рейтинг регион отрасль оквэд выручка"),
    ("/sravnit/", "Сравнить компании", "Две компании рядом",
     "сравнить сравнение две"),
    ("/tochnost/", "Точность Индекса", "Как Индекс проверяет сам себя",
     "точность самопроверка ошибки"),
    ("/obnovleniya/", "Что нового", "Лента изменений сервиса",
     "новое обновления изменения"),
    ("/o-proekte/", "О проекте", "Источники, принципы и команда",
     "источники данные откуда проект кто"),
    ("/tarify/", "Тарифы", "Что бесплатно и что входит в тарифы",
     "тариф цена стоимость сколько стоит оплата подписка"),
]

STOP = {"и", "в", "во", "на", "по", "для", "как", "что", "из", "с", "со", "к", "от", "до", "не", "или", "а", "о", "об",
        "это", "вы", "вас", "ваш", "ваша", "ваши", "мы", "нас", "делоскоп", "делоскопа", "бесплатно", "онлайн"}


def stranica(adres, koren=KOREN):
    put = os.path.join(koren, adres.strip("/"), "index.html") if adres != "/" else os.path.join(koren, "index.html")
    if not os.path.isfile(put):
        raise SystemExit("sobrat_poisk: нет страницы %s (%s)" % (adres, put))
    with open(put, encoding="utf-8") as f:
        return f.read()


def slova_stranicy(t):
    """Слова из <title> и meta description: строчные, ё→е, без стоп-слов и коротких."""
    zag = re.search(r"<title>([^<]*)</title>", t)
    opis = re.search(r'<meta name="description" content="([^"]*)"', t)
    tekst = html.unescape(" ".join(x.group(1) for x in (zag, opis) if x)).lower().replace("ё", "е")
    out = []
    for w in re.findall(r"[a-zа-я0-9][a-zа-я0-9.\-]*", tekst):
        w = w.strip(".-")
        if len(w) >= 3 and w not in STOP and w not in out:
            out.append(w)
    return out


def sobrat(koren=KOREN):
    spisok = []
    for adres, imya, podpis, svoi in RAZDELY:
        slova = []
        for w in svoi.split() + slova_stranicy(stranica(adres, koren)):
            if w not in slova:
                slova.append(w)
        spisok.append({"u": adres, "t": imya, "s": podpis, "k": " ".join(slova)})
    return {"_kak": "Собрано tests/sobrat_poisk.py из <title> и описаний страниц — руками не править.", "razdely": spisok}


def tekst(d):
    return json.dumps(d, ensure_ascii=False, indent=1) + "\n"


def main():
    nado = tekst(sobrat())
    put = os.path.join(KOREN, FAJL)
    est = open(put, encoding="utf-8").read() if os.path.isfile(put) else ""
    if "--check" in sys.argv:
        if est != nado:
            print("sobrat_poisk: %s устарел — запустите python3 tests/sobrat_poisk.py" % FAJL)
            return 1
        print("sobrat_poisk: разделы поиска собраны")
        return 0
    if est != nado:
        with open(put, "w", encoding="utf-8") as f:
            f.write(nado)
        print("sobrat_poisk: записан %s (%d разделов)" % (FAJL, len(RAZDELY)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
