#!/usr/bin/env python3
"""kartochki-imya-v1 ([Ночные-2] 12.10): служебные советы и заголовок реестров на карточке /company/ называют компанию.
Тексты [Право] не меняются; повторный вызов ничего не меняет; опубликованные карточки уже пересобраны.
Запуск: python3 tests/test_kartochki_imya.py"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as K  # noqa: E402
import kartochka_render as R  # noqa: E402

KOREN = pathlib.Path(__file__).resolve().parent.parent
NB = " "


def stranica(imya='ООО «Ромашка»', inn="7700000000"):
    ld = ('<script type="application/ld+json">{"@graph": [{"@type": "Organization", "name": "%s", "taxID": "%s"}]}</script>'
          % (imya.replace('"', '\\"'), inn))
    return (ld + '<section class="co-sec co-pered"><h2 id="pered">Перед оплатой</h2><ul><li>%s <a href="/proverit-schet/">'
            'Проверить счёт</a></li><li>%s</li></ul></section><section class="co-sec" aria-labelledby="reestry">%s'
            '<p>Сохраните отчёт с датой — это часть досье осмотрительности.</p></section>'
            % (R._IM_SOVET_SCHET, R._IM_SOVET_DOGOVOR, R._IM_H2_REESTRY))


class Imya(unittest.TestCase):
    def test_nazyvaet_kompaniyu(self):
        t = R.pochinit_imya(stranica())
        self.assertIn("Сверьте реквизиты в счёте с ООО" + NB + "«Ромашка»: ИНН" + NB + "7700000000, название, банк.", t)
        self.assertIn("Перед договором с ООО" + NB + "«Ромашка» проверьте полномочия подписанта", t)
        self.assertIn('<h2 id="reestry">Проверка ООО' + NB + '«Ромашка» по реестрам</h2>', t)
        self.assertNotIn("этой компанией", t)

    def test_tekst_prava_ne_trogaem(self):
        self.assertIn("Сохраните отчёт с датой — это часть досье осмотрительности.", R.pochinit_imya(stranica()))

    def test_idempotentno(self):
        t = R.pochinit_imya(stranica())
        self.assertEqual(R.pochinit_imya(t), t)

    def test_tolko_abbreviatury(self):
        # полное наименование склоняется («с Обществом…») — не угадываем падеж, страница как была
        for imya in ('Общество с ограниченной ответственностью «Ромашка»', "ООО", ""):
            self.assertEqual(R.pochinit_imya(stranica(imya)), stranica(imya), imya)
        self.assertEqual(R.pochinit_imya(stranica(inn="77")), stranica(inn="77"))
        self.assertIn("с АО" + NB + "ЦВ ПРОТЕК: ИНН", R.pochinit_imya(stranica("АО ЦВ ПРОТЕК")))  # ЕГРЮЛ без кавычек

    def test_escape(self):
        t = R.pochinit_imya(stranica('АО «Б&Р»'))
        self.assertIn("АО" + NB + "«Б&amp;Р»", t)

    def test_opublikovannye(self):
        papka = KOREN / "company"
        stranicy = [p for p in sorted(papka.glob("*/index.html")) if p.parent.name[:10].isdigit()]
        self.assertTrue(stranicy)
        for p in stranicy:
            t = p.read_text(encoding="utf-8")
            self.assertEqual(R.pochinit_imya(t), t, "%s: устарела — python3 tests/kartochki.py perepechatat" % p.parent.name)
            self.assertNotIn(R._IM_SOVET_SCHET, t, p.parent.name)

    def test_vstroeno_v_sborku(self):
        self.assertIn("pochinit_imya(t2)", (KOREN / "tests" / "kartochki.py").read_text(encoding="utf-8"))
        self.assertIs(K.pochinit_imya, R.pochinit_imya)


if __name__ == "__main__":
    unittest.main()
