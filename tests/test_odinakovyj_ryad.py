#!/usr/bin/env python3
"""odinakovyj-ryad-v1 ([Ночные-2] 21.11; Очередь п. 539): ворота «одна и та же отчётность у разных ИНН».
Отпечаток — последний год таблицы выручки, выручка и прибыль этого года и все суммы баланса и расчётов на 31.12
того же года; совпал у двух и больше ИНН — sobrat --dobavit снимает все такие карточки до сверки с ГИР БО.
Запуск: python3 tests/test_odinakovyj_ryad.py"""
import glob
import os
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as K  # noqa: E402

KOREN = str(pathlib.Path(__file__).resolve().parent.parent)
NB = "&nbsp;"


def r(s):
    return s.replace(" ", NB) + NB + "₽"


def stranica(stroki, bal_god=2025, bal=("159 млрд", "24,4 млрд", "14,9 млрд"), rasch=("69,3 млрд", "2,3 млрд")):
    tb = "".join('<tr><td>%d</td><td class="num">%s</td><td class="num">%s</td></tr>' % (g, r(v), r(p)) for g, v, p in stroki)
    fin = ('<div class="table-wrap"><table class="table"><thead><tr><th>Год</th><th>Выручка</th><th>Чистая прибыль</th>'
           '</tr></thead><tbody>%s</tbody></table></div>') % tb
    b = "".join('<tr><td>x</td><td class="num">%s</td><td class="num">1%%</td></tr>' % r(v) for v in bal)
    c = "".join('<tr><td>y</td><td class="num">%s</td><td class="num"></td></tr>' % r(v) for v in rasch)
    sek = ('<section class="co-sec" aria-labelledby="bal">'
           '<h3 class="co-h3">На чём держится компания — баланс на%s31.12.%d</h3><div class="table-wrap"><table class="table">'
           '<thead><tr><th>a</th></tr></thead><tbody>%s</tbody></table></div>'
           '<h3 class="co-h3">Кто кому должен — на%s31.12.%d</h3><div class="table-wrap"><table class="table">'
           '<thead><tr><th>b</th></tr></thead><tbody>%s</tbody></table></div></section>') % (NB, bal_god, b, NB, bal_god, c)
    return fin + sek


MEGA = stranica([(2025, "5,3 млрд", "8,4 млрд"), (2024, "3,9 млрд", "75,2 млн"), (2023, "2,8 млрд", "11,2 млн")])
MERS = stranica([(2025, "5,3 млрд", "8,4 млрд"), (2023, "17,4 млрд", "47,1 млн")])
DRUGAYA = stranica([(2025, "5,3 млрд", "8,4 млрд")], bal=("160 млрд", "24,4 млрд", "14,9 млрд"))


class TestOdinakovyjRyad(unittest.TestCase):
    def test_otpechatok(self):
        o = K.otpechatok_otchetnosti_html(MEGA)
        self.assertEqual(o[0], 2025)
        self.assertEqual(o[1], (5.3e9, 8.4e9))
        self.assertEqual(len(o[2]), 5)
        self.assertEqual(o, K.otpechatok_otchetnosti_html(MERS))  # прошлые годы в отпечаток не идут
        self.assertNotEqual(o, K.otpechatok_otchetnosti_html(DRUGAYA))

    def test_malo_chisel(self):
        self.assertIsNone(K.otpechatok_otchetnosti_html("<p>нет таблицы</p>"))
        self.assertIsNone(K.otpechatok_otchetnosti_html(stranica([(2025, "900 тыс.", "1 тыс.")])))
        self.assertIsNone(K.otpechatok_otchetnosti_html(stranica([(2025, "5,3 млрд", "8,4 млрд")], bal=(), rasch=("1 млн",))))
        # баланс другого года — не в счёт
        self.assertIsNone(K.otpechatok_otchetnosti_html(stranica([(2025, "5,3 млрд", "8,4 млрд")], bal_god=2024)))

    def test_odinakovye(self):
        d = K.odinakovaya_otchetnost({"7714451097": MEGA, "9701245358": MERS, "1111111111": DRUGAYA, "2222222222": "<p></p>"})
        self.assertEqual(d, {"7714451097": ["9701245358"], "9701245358": ["7714451097"]})
        self.assertEqual(K.odinakovaya_otchetnost({"1": MEGA}), {})

    def test_dobavit_snimaet(self):
        src = open(os.path.join(KOREN, "tests", "kartochki.py"), encoding="utf-8").read()
        self.assertIn("nesv |= set(odin_)", src)

    def test_na_sajte_net_odinakovyh(self):
        teksty = {}
        for p in sorted(glob.glob(os.path.join(KOREN, "company", "[0-9]*", "index.html"))):
            with open(p, encoding="utf-8") as fh:
                teksty[os.path.basename(os.path.dirname(p))[:10]] = fh.read()
        self.assertEqual(K.odinakovaya_otchetnost(teksty), {}, "одна отчётность у разных ИНН — sobrat --dobavit снимает их")
        for inn in ("7714451097", "9701245358", "9704072022"):
            self.assertEqual(glob.glob(os.path.join(KOREN, "company", inn + "-*")), [], inn)


if __name__ == "__main__":
    unittest.main()
