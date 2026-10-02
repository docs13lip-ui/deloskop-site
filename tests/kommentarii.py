"""«Комментарий команды Делоскопа» для Python-генераторов (карточки /company/) — то же правило, что js/kommentarii.js.

Библиотека — data/kommentarii.json. Показываем только тон со status «utverzhdeno», ролью проверившего,
датой ГГГГ-ММ-ДД, «что сделать» и общей длиной ≤ 300 знаков. Комментарий — пояснение практика,
а не вывод с числом: в ворота карточки («≥ 3 выводов, ≥ 2 с числом») он НЕ засчитывается.
"""
import json
import os
import re

TON = {"ok": "zel", "info": "zel", "warn": "zhel", "bad": "kras"}
MAKS = 300
PUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "kommentarii.json")


def zagruzit(put=PUT):
    with open(put, encoding="utf-8") as f:
        return json.load(f)


def dlina(t):
    return sum(len(str(t.get(k) or "")) for k in ("bank", "nalog", "sdelat"))


def gotov(t):
    return bool(t and t.get("status") == "utverzhdeno" and t.get("proveril")
                and re.match(r"^\d{4}-\d{2}-\d{2}", str(t.get("data_proverki") or ""))
                and t.get("sdelat") and (t.get("bank") or t.get("nalog")) and dlina(t) <= MAKS)


def zapis(sprav, signal):
    title = str((signal or {}).get("title") or "")
    if not title:
        return None
    for z in (sprav or {}).get("signaly") or []:
        try:
            if re.search(z["re"], title, re.I):
                return z
        except re.error:
            continue
    return None


def najti(sprav, signal):
    z = zapis(sprav, signal)
    ton = TON.get((signal or {}).get("status"))
    if not z or not ton:
        return None
    t = (z.get("tony") or {}).get(ton)
    if not gotov(t):
        return None
    g, m, d = str(t["data_proverki"])[:10].split("-")
    return {"id": z["id"], "ton": ton, "bank": t.get("bank") or "", "nalog": t.get("nalog") or "",
            "sdelat": t["sdelat"], "norma": z.get("norma") or "",
            "podpis": (sprav or {}).get("podpis") or "Команда Делоскопа", "data": f"{d}.{m}.{g}"}
