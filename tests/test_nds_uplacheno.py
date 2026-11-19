"""nds-uplacheno-v1 ([Ночные-2] 19.11, решение владельца 19.11 п. 2 «НДС поставщика»): на карточке в строке
«Уплатила налогов и взносов» — «в том числе НДС — X» из строки досье «Уплачено: Налог на добавленную стоимость»
(набор ФНС «уплаченные налоги»). Только факт суммы; нет строки — молчим; ввозной НДС не берём."""
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

NB = " "


def otvet(stroki_nalogov, itogo=3776138506):
    return {
        "company": {"inn": "3904087321", "name_short": "ООО \"ПРИМЕР\"", "kind": "LEGAL", "status": "ACTIVE",
                    "reg_date": "2001-01-01", "address": "г Калининград", "okved": "20.16"},
        "checked_at": "2026-11-19T04:00:00+03:00",
        "dossier": {
            "data_dates": "ЕГРЮЛ/ЕГРИП — на 19.11.2026; уплаченные налоги — на 31.12.2025",
            "kpi": [{"label": "Налоги и взносы за год", "value": itogo}],
            "sections": [{"id": "taxes", "title": "Налоги, долги и штрафы", "rows": stroki_nalogov}],
        },
    }


def v23(r):
    k = K.iz_check(r)
    return next(v["tekst"] for v in K.vyvody(k) if v["kod"] == "V23")


class NdsUplacheno(unittest.TestCase):
    def test_nds_v_stroke(self):
        t = v23(otvet([["Уплачено: Налог на добавленную стоимость", "3 577 435 198 ₽"],
                       ["Уплачено: Водный налог", "409 048 ₽"]]))
        self.assertEqual(t, "Уплатила налогов и взносов — 3,8" + NB + "млрд" + NB + "₽ за" + NB + "2025, в том числе НДС — 3,6" + NB + "млрд" + NB + "₽")

    def test_net_stroki_molchim(self):
        t = v23(otvet([["Уплачено: Налог на имущество организаций", "38 534 200 ₽"]]))
        self.assertNotIn("НДС", t)

    def test_vvoznoj_ne_berem(self):
        t = v23(otvet([["Уплачено: Налог на добавленную стоимость на товары, ввозимые на территорию Российской Федерации", "5 000 000 ₽"]]))
        self.assertNotIn("НДС", t)

    def test_bolshe_itoga_ne_pishem(self):
        t = v23(otvet([["Уплачено: Налог на добавленную стоимость", "9 000 000 000 ₽"]]))
        self.assertNotIn("НДС", t)

    def test_nol_i_musor(self):
        for zn in ("0 ₽", "Нет", "", None):
            self.assertIsNone(K.nds_uplacheno({"sections": [{"rows": [["Уплачено: Налог на добавленную стоимость", zn]]}]}))

    def test_frazy_chitayut_god_i_summu(self):
        # «Значит» и «Отличие» берут сумму и год из V23 — хвост с НДС не должен их ломать
        up = "Уплатила налогов и взносов — 3,8 млрд ₽ за 2025, в том числе НДС — 3,6 млрд ₽"
        m = re.search(r"— (.*?)(?: за (\d{4}))?(?:, в том числе НДС — .*)?$", up)
        self.assertEqual((m.group(1), m.group(2)), ("3,8 млрд ₽", "2025"))
        src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "kartochka_render.py"), encoding="utf-8").read()
        self.assertEqual(src.count('(?:, в том числе НДС — .*)?$", up or "")'), 2)


if __name__ == "__main__":
    unittest.main()
