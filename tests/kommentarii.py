"""«Комментарий команды Делоскопа» для Python-генераторов (карточки /company/) — то же правило, что js/kommentarii.js.

Библиотека — data/kommentarii.json. Показываем только тон со status «utverzhdeno», ролью проверившего,
датой ГГГГ-ММ-ДД, «что сделать» и общей длиной ≤ 300 знаков. Комментарий — пояснение практика,
а не вывод с числом: в ворота карточки («≥ 3 выводов, ≥ 2 с числом») он НЕ засчитывается.

kommentarii-kartochki-v1: само правило живёт в tests/kartochka_render.py (kom_*) — модуль отрисовки чистый и его же
подключает API; здесь — только чтение файла библиотеки и прежние имена для генераторов и тестов.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kartochka_render import (KOM_MAKS as MAKS, KOM_NE_OTVETIL as NE_OTVETIL, KOM_OGOVORKA as OGOVORKA,  # noqa: E402
                              KOM_TON as TON, kom_dlina as dlina, kom_gotov as gotov, kom_html as html,
                              kom_istochnik_otvetil as istochnik_otvetil, kom_najti as najti, kom_zapis as zapis)

PUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "kommentarii.json")
__all__ = ["MAKS", "NE_OTVETIL", "OGOVORKA", "TON", "PUT", "zagruzit", "dlina", "gotov", "html", "istochnik_otvetil", "najti", "zapis"]


def zagruzit(put=PUT):
    with open(put, encoding="utf-8") as f:
        return json.load(f)
