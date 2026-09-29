#!/usr/bin/env python3
"""Реквизиты ИП из админки → rekvizity.json (rekv-v1, 28.09.2026).

Владелец вводит реквизиты только в админку «Реквизиты для счетов» (решение 28.09: номера ИП — не в чат и не в файлы
проекта). Этот скрипт при выкладке берёт их из публичного GET https://api.deloskop.ru/api/rekvizity и пишет в
rekvizity.json; затем `python3 tests/sobrat_shapku.py` ставит их в подвал всех страниц, в оферту, политику и на
/rekvizity/ обычным текстом.

  python3 tests/rekvizity_iz_api.py            — обновить rekvizity.json (печатает, что изменилось)
  python3 tests/rekvizity_iz_api.py --check    — ничего не пишет; код 1, если в json не то, что в админке
  REKV_API=http://127.0.0.1:8000 …             — другой адрес API (тесты)

Правила безопасности:
  * сервер не ответил / ответил ошибкой → файл НЕ трогаем (сбой сети не должен стирать реквизиты с сайта), код 0;
  * сервер говорит est:false, а в json реквизиты есть → НЕ стираем, только предупреждение (снять реквизиты с сайта —
    осознанное действие человека, а не пустой ответ);
  * банки, телефон, номер в реестре РКН — не трогаем (их сервер не отдаёт);
  * ИНН 12 цифр и ОГРНИП 15 цифр — с проверкой контрольных цифр, иначе ничего не пишем.

Сверка с ЕГРИП (site-v10, 28.09.2026; пп. 123, 126 «Очереди» — «продавец, который проверяет себя сам»):
  после реквизитов скрипт спрашивает наш же GET /api/check?q=<ИНН> (сведения ЕГРИП через DaData) и, если ИНН, ОГРНИП
  совпадают и статус «действующий», пишет в rekvizity.json блок sverka_egrip {data, gorod, sovpalo}. Из адреса
  берётся ТОЛЬКО населённый пункт (ч. 2 ст. 10 149-ФЗ — место нахождения); улица, дом, индекс, адрес регистрации —
  никогда. Не совпало → блок убираем (не пишем «сверено», если это неправда) и печатаем ⚠. Нет ответа → не трогаем.
  REKV_SEGODNYA=ДД.ММ.ГГГГ — дата сверки для тестов (по умолчанию — сегодня по Москве).
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAIL = os.path.join(KOREN, "rekvizity.json")
API = os.environ.get("REKV_API", "https://api.deloskop.ru").rstrip("/")
POLYA = ("fio", "inn", "ogrnip", "data_registracii", "organ_registracii", "adres_dlya_pisem")


def inn12_ok(s):
    if not re.fullmatch(r"\d{12}", s or ""):
        return False
    d = [int(c) for c in s]
    k = lambda w: sum(a * b for a, b in zip(w, d)) % 11 % 10  # noqa: E731
    return k([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) == d[10] and k([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) == d[11]


def ogrnip_ok(s):
    return bool(re.fullmatch(r"\d{15}", s or "")) and int(s[:14]) % 13 % 10 == int(s[14])


def godny(r):
    return (isinstance(r, dict) and r.get("est") is True and len(str(r.get("fio") or "").split()) >= 2
            and inn12_ok(str(r.get("inn") or "")) and ogrnip_ok(str(r.get("ogrnip") or "")))


def zaprosit():
    try:
        with urllib.request.urlopen(urllib.request.Request(API + "/api/rekvizity", headers={"Accept": "application/json"}),
                                    timeout=10) as o:
            return json.loads(o.read().decode("utf-8"))
    except Exception as e:  # сеть, 404 до выкладки API-части, не JSON
        print("Реквизиты: API не ответил (%s) — rekvizity.json не меняю" % type(e).__name__)
        return None


# ---------- сверка с ЕГРИП ----------
NP = re.compile(r"^(г|город|пгт|рп|кп|дп|п|пос|поселок|посёлок|с|село|д|дер|деревня|ст-ца|станица|х|хутор|аул|нп|сл|ст)\.?\s+(.+)$", re.I)
SOKR = {"город": "г", "поселок": "п", "посёлок": "п", "пос": "п", "село": "с", "дер": "д", "деревня": "д",
        "станица": "ст-ца", "хутор": "х"}
REGION = re.compile(r"(обл|область|край|респ|республика|АО|автономный округ)\.?$|^(респ|республика)\s", re.I)
IMYA = re.compile(r"^[А-ЯЁа-яё][А-ЯЁа-яё\- ]{1,39}$")


def gorod_iz_adresa(adres):
    """Только населённый пункт (и регион, если это не город): «г. Липецк», «с. Казинка, Липецкая обл».
    Улица, дом, квартира, индекс в результат не попадают никогда — берём одну часть адреса до первой улицы."""
    chasti = [x.strip() for x in str(adres or "").split(",") if x.strip()]
    region = ""
    for x in chasti:
        if re.fullmatch(r"\d{6}", x):
            continue
        m = NP.match(x)
        if m:
            vid = SOKR.get(m.group(1).lower(), m.group(1).lower())
            imya = re.sub(r"\s+", " ", m.group(2)).strip()
            if not IMYA.match(imya):
                return ""
            if vid == "г":
                return "г. " + imya
            return vid + ". " + imya + (", " + region if region else "")
        if REGION.search(x) and not region and IMYA.match(x.replace(".", "")):
            region = x
        elif re.search(r"(р-н|район|округ|сельсовет|поселение)$", x, re.I) or re.match(r"(г\.\s?о\.|м\.\s?о\.|м\.\s?р-н|муниципальн|городской округ|вн\.\s?тер)", x, re.I):
            continue
        else:
            break  # дошли до улицы/дома без населённого пункта — ничего не берём
    return ""


def segodnya():
    s = os.environ.get("REKV_SEGODNYA")
    if s:
        return s
    return (datetime.now(timezone.utc) + timedelta(hours=3)).strftime("%d.%m.%Y")


def zaprosit_egrip(inn):
    try:
        url = API + "/api/check?q=" + urllib.parse.quote(inn)
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=15) as o:
            return json.loads(o.read().decode("utf-8"))
    except Exception as e:
        print("Сверка с ЕГРИП: API не ответил (%s) — сверку не меняю" % type(e).__name__)
        return None


def sverit(r, otvet):
    """Чистая функция: (блок sverka_egrip | None, список расхождений). None + [] — сверить нечем (не трогаем)."""
    if not isinstance(otvet, dict):
        return None, []
    c = otvet.get("company") if isinstance(otvet.get("company"), dict) else otvet
    if not c.get("inn"):
        return None, []
    ras = []
    if str(c.get("inn")) != r.get("inn"):
        ras.append("ИНН")
    if str(c.get("ogrn") or c.get("ogrnip") or "") != r.get("ogrnip"):
        ras.append("ОГРНИП")
    if str(c.get("status") or "").upper() != "ACTIVE":
        ras.append("статус (%s)" % (c.get("status") or "нет"))
    if ras:
        return None, ras
    s = {"data": segodnya(), "gorod": gorod_iz_adresa(c.get("address") or ""),
         "sovpalo": "ИНН, ОГРНИП и статус «действующий»"}
    return s, []


def primenit_sverku(nov, otvet):
    """Возвращает словарь с обновлённой сверкой (или тот же, если менять нечего)."""
    s, ras = sverit(nov, otvet)
    if ras:
        print("⚠ Сверка с ЕГРИП: не совпало — %s. Отметку «сверено» с сайта убираю, проверьте реквизиты в админке."
              % ", ".join(ras))
        if "sverka_egrip" in nov:
            nov = dict(nov)
            nov.pop("sverka_egrip")
        return nov
    if s is None:
        return nov
    nov = dict(nov)
    nov["sverka_egrip"] = s
    return nov


def obnovit(tek, r):
    """Чистая функция: новый словарь или None, если менять нечего/нельзя."""
    if r is None:
        return None
    if not godny(r):
        if tek.get("fio") and tek.get("inn") and tek.get("ogrnip"):
            print("⚠ Реквизиты: в админке не отмечено «Показывать на сайте» (или ошибка в цифрах), а на сайте они есть — "
                  "НЕ стираю. Снять с сайта — очистить поля в rekvizity.json вручную.")
        else:
            print("Реквизиты: в админке их ещё нет — на сайте остаётся «появятся после регистрации»")
        return None
    nov = dict(tek)
    for k in POLYA:
        nov[k] = re.sub(r"\s+", " ", str(r.get(k) or "")).strip()
    return nov if nov != tek else None


def main():
    check = "--check" in sys.argv
    with open(FAIL, encoding="utf-8") as fh:
        tek = json.load(fh)
    nov = obnovit(tek, zaprosit())
    baza = nov if nov is not None else tek
    if baza.get("fio") and baza.get("inn") and baza.get("ogrnip"):
        s = primenit_sverku(baza, zaprosit_egrip(baza["inn"]))
        if s != tek:
            nov = s
    if nov is None or nov == tek:
        print("Реквизиты: rekvizity.json совпадает с админкой" if not check else "Реквизиты: менять нечего")
        return 0
    izm = [k for k in POLYA if nov.get(k) != tek.get(k)]
    # дата сверки меняется каждый день — для --check важны только город и наличие отметки
    sv_n, sv_t = nov.get("sverka_egrip") or {}, tek.get("sverka_egrip") or {}
    if bool(sv_n) != bool(sv_t) or sv_n.get("gorod") != sv_t.get("gorod"):
        izm.append("сверка с ЕГРИП")
    elif not izm and check:
        print("Реквизиты: менять нечего (обновится только дата сверки)")
        return 0
    izm = izm or ["дата сверки с ЕГРИП"]
    if check:
        print("Реквизиты: в админке новые данные (%s) — запустите без --check и sobrat_shapku.py" % ", ".join(izm))
        return 1
    with open(FAIL, "w", encoding="utf-8") as fh:
        json.dump(nov, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print("Реквизиты обновлены из админки: %s. Дальше: python3 tests/sobrat_shapku.py" % ", ".join(izm))
    return 0


if __name__ == "__main__":
    sys.exit(main())
