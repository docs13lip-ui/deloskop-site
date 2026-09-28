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
"""
import json
import os
import re
import sys
import urllib.request

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
    if nov is None:
        print("Реквизиты: rekvizity.json совпадает с админкой" if not check else "Реквизиты: менять нечего")
        return 0
    izm = [k for k in POLYA if nov.get(k) != tek.get(k)]
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
