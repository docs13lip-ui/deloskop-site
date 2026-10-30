#!/usr/bin/env python3
"""kartochki-balans-vyvody-v1 (30.10.2026, [Ночные-2]; решение владельца 30.10 «уникальность — приоритет 1»): под таблицами
«Баланс и расчёты» карточки /company/ — выводы из чисел этих таблиц (доля капитала, кредиты к выручке, кто кому должен)
вместо одной и той же фразы на всех карточках. Сторож: (1) на опубликованных карточках с балансом — блок выводов, в нём
название компании и только числа, которые стоят в таблицах страницы; без стоп-слов; (2) старой общей фразы нет;
(3) balans_vyvody идемпотентна; (4) склонение «раз/раза»; (5) пороги «почти поровну» и «больше половины»."""
import glob
import html
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _sek(im, kap="11 млрд ₽", dk=("4 %", "72 %", "24 %"), rec="15,2 млрд ₽", pay="1,9 млрд ₽", loan="238 млрд ₽", lp="1583 % выручки за 2025"):
    st = ('<tr><td>Собственный капитал</td><td class="num">%s</td><td class="num">%s</td></tr>'
          '<tr><td>Долгосрочные обязательства</td><td class="num">1 ₽</td><td class="num">%s</td></tr>'
          '<tr><td>Краткосрочные обязательства</td><td class="num">1 ₽</td><td class="num">%s</td></tr>') % (kap, dk[0], dk[1], dk[2])
    ra = ('<tr><td>Фирме должны покупатели</td><td class="num">%s</td><td class="num"></td></tr>'
          '<tr><td>Фирма должна поставщикам</td><td class="num">%s</td><td class="num"></td></tr>'
          '<tr><td>Кредиты и займы</td><td class="num">%s</td><td class="num">%s</td></tr>') % (rec, pay, loan, lp)
    return ('<section class="co-sec" aria-labelledby="bal"><h3 class="co-h3">На чём держится — баланс на 31.12.2025</h3>'
            '<table>%s</table><table>%s</table></section>') % (st, ra)


class TestBalansVyvody(unittest.TestCase):
    def test_opublikovannye(self):
        n, plohie = 0, []
        for f in sorted(glob.glob(os.path.join(KOREN, "company", "*", "index.html"))):
            with open(f, encoding="utf-8") as fh:
                t = fh.read()
            m = K._BV_SEK.search(K.bez_tipografa(t))
            if not m:
                continue
            sek = m.group(0)
            v = re.search(r'<p class="co-bal-vyv">(.*?)</p>', sek, re.S)
            if not v:
                continue
            self.assertNotIn("Суммы из", K._bv_t(sek), f)
            n += 1
            txt = K._bv_t(v.group(1))
            tab = K._bv_t(re.sub(r'<p class="co-bal-vyv">.*?</p>', "", sek, flags=re.S))
            imya = str(K._sh_org(t).get("name") or "")
            if imya.split(" ", 1)[1] not in txt and imya not in txt or K.STOP_SLOVA.search(txt):
                plohie.append(os.path.basename(os.path.dirname(f)))
            for s in re.findall(r"\d+(?:,\d+)? (?:трлн|млрд|млн|тыс\.) ₽", txt):
                if s not in tab:
                    plohie.append("%s: %s" % (os.path.basename(os.path.dirname(f)), s))
        self.assertGreater(n, 140)
        self.assertEqual(plohie[:5], [])

    def test_idempotentna(self):
        for f in sorted(glob.glob(os.path.join(KOREN, "company", "*", "index.html")))[:20]:
            with open(f, encoding="utf-8") as fh:
                t = fh.read()
            self.assertEqual(K.tipograf_kartochki(K.balans_vyvody(K.bez_tipografa(t)), chisla=True), t)

    def test_razy(self):
        self.assertEqual(K._bv_razy(2.0), "в 2 раза")
        self.assertEqual(K._bv_razy(5.0), "в 5 раз")
        self.assertEqual(K._bv_razy(2.34), "в 2,3 раза")
        self.assertEqual(K._bv_razy(15.83), "в 16 раз")
        self.assertEqual(K._bv_razy(22.1), "в 22 раза")
        self.assertEqual(K._bv_razy(12.2), "в 12 раз")

    def test_frazy(self):
        fr = K.bv_frazy(_sek("«Икс»"), "«Икс»")
        self.assertEqual(len(fr), 3)
        self.assertIn("4 % источников средств", fr[0])
        self.assertIn("в 16 раз больше выручки", fr[1])
        self.assertIn("в 8 раз больше", fr[2])
        fr = K.bv_frazy(_sek("«Икс»", dk=("50 %", "20 %", "30 %"), rec="10 млн ₽", pay="9 млн ₽", lp="12 % выручки за 2025"), "«Икс»")
        self.assertFalse(fr[0].startswith("Больше половины"))
        self.assertIn("это 12 % выручки", fr[1])
        self.assertIn("почти поровну", fr[2])
        fr = K.bv_frazy(_sek("«Икс»", dk=("62 %", "8 %", "30 %"), rec="1 млн ₽", pay="3 млн ₽"), "«Икс»")
        self.assertTrue(fr[0].startswith("Больше половины"))
        self.assertTrue(fr[2].startswith("Долг «Икс» поставщикам"))


if __name__ == "__main__":
    unittest.main()
