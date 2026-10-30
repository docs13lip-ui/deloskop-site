#!/usr/bin/env python3
"""kartochki-dni-postavshchikov-v1 (30.10.2026, [Ночные-2]; идея [ВК] 30.10): в выводах под балансом карточки /company/ —
долг поставщикам в днях выручки того же года. Сторож: (1) число дней пересчитывается из строк ЭТОЙ страницы
(«Фирма должна поставщикам» и «Выручка за ГГГГ»), год баланса = год выручки; (2) рядом оговорка «оценка по балансу,
а не срок оплаты по договорам»; (3) другой год выручки, 0 дней и больше 3 лет — фразы нет; (4) падеж «дню/дням»."""
import glob
import html
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEK = ('<section class="co-sec" aria-labelledby="bal"><h3 class="co-h3">Кто кому должен — расчёты «Икс» на 31.12.2025</h3>'
       '<table><tr><td>Фирма должна поставщикам</td><td class="num">%s</td><td class="num"></td></tr></table></section>')


def dni(pay, vyr, god="2025"):
    return K._bv_t(K.bv_dni(SEK % pay, (pay, ""), (god, vyr), "«Икс»"))


class TestDniPostavshchikov(unittest.TestCase):
    def test_raschet(self):
        self.assertIn("примерно 35 дням выручки «Икс» за 2025 год", dni("300 млрд ₽", "3,1 трлн ₽"))
        self.assertIn("примерно 1 дню", dni("3 млн ₽", "1,1 млрд ₽"))
        self.assertIn("примерно 21 дню", dni("5,75 млн ₽", "100 млн ₽"))
        self.assertIn("оценка по балансу, а не срок оплаты по договорам", dni("300 млрд ₽", "3,1 трлн ₽"))

    def test_kraya(self):
        self.assertEqual(dni("300 млрд ₽", "3,1 трлн ₽", god="2024"), "")
        self.assertEqual(dni("1 млн ₽", "1 трлн ₽"), "")
        self.assertEqual(dni("40 млн ₽", "10 млн ₽"), "")
        self.assertEqual(K.bv_dni(SEK % "1 млн ₽", ("1 млн ₽", ""), None), "")

    def test_opublikovannye(self):
        n, plohie = 0, []
        for f in sorted(glob.glob(os.path.join(KOREN, "company", "*", "index.html"))):
            with open(f, encoding="utf-8") as fh:
                t = K.bez_tipografa(fh.read())
            m = re.search(r"Долг поставщикам на 31\.12\.(\d{4}) равен примерно (\d+) (?:дню|дням) выручки [^<]*? за (\d{4}) год",
                          K._bv_t(t))
            if not m:
                continue
            n += 1
            sek = K._BV_SEK.search(t).group(0)
            pay = re.search(r"<td>Фирма должна поставщикам</td><td class=\"num\">([^<]*)</td>", sek)
            mv = K._BV_VYR.search(t)
            ok = (pay and mv and m.group(1) == m.group(3) == mv.group(1)
                  and int(m.group(2)) == round(K.zn_summa(html.unescape(pay.group(1))) / K.zn_summa(html.unescape(mv.group(2))) * 365))
            if not ok or K.STOP_SLOVA.search(m.group(0)):
                plohie.append(os.path.basename(os.path.dirname(f)))
        self.assertGreater(n, 140)
        self.assertEqual(plohie[:5], [])


if __name__ == "__main__":
    unittest.main()
