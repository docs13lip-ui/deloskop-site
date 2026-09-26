#!/usr/bin/env python3
"""Ставит дату и время выкладки (Москва) записям ленты obnovleniya.json, у которых ещё нет «vremya».

Запускать при выкладке, прямо перед коммитом в main:
    python3 tests/postavit_vremya.py          # проставить
    python3 tests/postavit_vremya.py --check  # проверить: у всех записей есть дата и время

Время берётся по часам машины и переводится в Москву (UTC+3, без перехода на летнее время),
поэтому результат одинаков на любом компьютере. Уже проставленное время не меняется.
"""
import datetime as dt
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LENTA = ROOT / "obnovleniya.json"
MSK = dt.timezone(dt.timedelta(hours=3))
MES = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля",
       "августа", "сентября", "октября", "ноября", "декабря"]
VREMYA = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def data_ru(d):
    return f"{d.day} {MES[d.month - 1]} {d.year}"


def main(argv):
    d = json.loads(LENTA.read_text(encoding="utf-8"))
    zapisi = d["obnovleniya"]
    bez = [e for e in zapisi if not e.get("vremya")]
    plohie = [e["id"] for e in zapisi if e.get("vremya") and not VREMYA.match(e["vremya"])]
    if plohie:
        print("Неверный формат времени (нужно ЧЧ:ММ):", ", ".join(plohie))
        return 1
    if "--check" in argv:
        if bez:
            print("Нет времени выкладки у записей:", ", ".join(e["id"] for e in bez))
            print("Запустите: python3 tests/postavit_vremya.py")
            return 1
        print("У всех записей ленты есть дата и время выкладки")
        return 0
    if not bez:
        print("Все записи уже с временем — ничего не меняю")
        return 0
    seychas = dt.datetime.now(MSK)
    for e in bez:
        e["data"] = data_ru(seychas)
        e["vremya"] = seychas.strftime("%H:%M")
    # vremya — сразу после data, как в остальных записях
    d["obnovleniya"] = [
        {k2: v2 for k, v in e.items() if k != "vremya"
         for k2, v2 in ([(k, v), ("vremya", e["vremya"])] if k == "data" and "vremya" in e else [(k, v)])}
        for e in zapisi
    ]
    LENTA.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Проставлено {data_ru(seychas)}, {seychas:%H:%M} МСК для:", ", ".join(e["id"] for e in bez))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
