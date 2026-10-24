#!/usr/bin/env python3
"""nedoimka-mesyac-v1 (24.10.2026, [Ночные-2]; ТЗ [Продукт] 23.10 п. 3Г): с 01.04.2026 ФНС публикует набор о недоимке
ежемесячно (приказ ФНС от 25.11.2025 № ЕД-7-14/1006@). Сторож: под проверенной строкой «Задолженность по налогам» —
ровно одна строка «ФНС обновляет набор раз в месяц.», сразу за фактом; без даты следующего выхода (день не сверен);
повторная вставка ничего не меняет; новые карточки (html_kartochki) получают строку так же."""
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAPKA = os.path.join(KOREN, "company")


def kartochki():
    for d in sorted(os.listdir(PAPKA)):
        put = os.path.join(PAPKA, d, "index.html")
        if re.match(r"^\d{10}-", d) and os.path.isfile(put):
            yield d, open(put, encoding="utf-8").read()


class TestNedoimkaMesyac(unittest.TestCase):
    def test_na_kartochkah(self):
        n = 0
        for d, t in kartochki():
            fakt = K._NABOR_FAKT.search(t)
            if fakt:
                n += 1
                self.assertEqual(t.count(K.NABOR_METKA), 1, d)
                self.assertTrue(t.startswith(K.NABOR_TEKST, fakt.end()), d + ": строка — сразу под фактом недоимки")
            else:
                self.assertNotIn(K.NABOR_METKA, t, d + ": строки без проверенного факта недоимки быть не должно")
        self.assertGreater(n, 0)

    def test_bez_daty_vyhoda(self):
        self.assertIsNone(re.search(r"\d", K.NABOR_TEKST.replace("&nbsp;", " ")), "дату следующего выхода не пишем, пока день не сверен")

    def test_povtor(self):
        for d, t in list(kartochki())[:20]:
            self.assertEqual(K.nabor_nedoimki(t), t, d)
            self.assertEqual(K.nabor_nedoimki(K.ubrat_nabor(t)), t, d)

    def test_obertka(self):
        import inspect
        # kartochki-tipograf-v1: последняя обёртка — типограф, под ней — nabor_nedoimki
        self.assertIn("nabor_nedoimki", inspect.getsource(K.html_kartochki) + inspect.getsource(K._html_kartochki_do_tipografa),
                      "новые карточки и API — через ту же функцию")

    def test_ne_proverennyj_fakt(self):
        t = ('<div class="fact"><span>Задолженность по налогам</span><span class="fact__v">не проверяли</span>'
             '<span class="fact__src co-src">ФНС, открытые данные · дата сведений не указана · ○ не проверяли</span></div>')
        self.assertEqual(K.nabor_nedoimki(t), t)

    def test_otchet_naborov(self):
        import kartochki as KK
        nab = KK.nabory_nedoimki(KOREN)
        n = sum(1 for _, t in kartochki() if K._NABOR_FAKT.search(t))
        self.assertEqual(sum(c for _, c in nab), n, "svezhest считает те же строки недоимки")


if __name__ == "__main__":
    unittest.main()
