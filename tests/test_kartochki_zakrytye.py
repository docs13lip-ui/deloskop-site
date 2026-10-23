#!/usr/bin/env python3
"""kartochki-zakrytye-v1 (ТЗ [Продукт] 23.10 п. 3Д, текст [Право] 23.10): карточки, где последняя открытая отчётность
старше двух лет, — абзац с годами без отчётности, запросом документов и общей строкой о ст. 18 402-ФЗ без причины для
компании. Запуск: python3 tests/test_kartochki_zakrytye.py"""
import pathlib
import re
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochka_render as R  # noqa: E402
from test_kartochki_znachit import KOREN, chitat, frazy_bloka, stranica  # noqa: E402

NB = "\u00a0"
STROKA = "в ряде случаев доступ к отчётности в ГИР БО ограничен (ст. 18 Федерального закона № 402-ФЗ)"
ZAPRET = re.compile(r"санкци|скрыва|засекреч|ОПК|оборон|ч\.\s*\d+ ст\. 18", re.I)


V = [("ok", "Работает 16 лет — с 2010 года")]  # дата сведений карточки — из строк «Коротко»


def frazy(ryad, na="10.10.2026"):
    return [x.replace(NB, " ") for x in frazy_bloka(R.vstavit_znachit(stranica(na=na, V=V, ryad=ryad)))]


class TestZakrytye(unittest.TestCase):
    def test_tri_goda_i_bolshe(self):
        f = " ".join(frazy([(2020, "10 млрд ₽", None), (2021, "11 млрд ₽", None)]))
        self.assertIn("Последняя открытая отчётность «Ромашка» — за 2021 год. За 2022–2025 годы в открытой части ГИР БО "
                      "её нет — до сделки попросите у компании бухгалтерскую отчётность и справку КНД 1120101.", f)
        self.assertIn("Так бывает по разным причинам, в том числе законным: " + STROKA + ".", f)
        self.assertNotIn("ничего не говорит", f)

    def test_dva_goda_prezhnij_abzac(self):
        # 2024 при сведениях 2026: за 2025 отчётность могли ещё не открыть — без утверждения «её нет»
        f = " ".join(frazy([(2023, "10 млрд ₽", None), (2024, "11 млрд ₽", None)]))
        self.assertIn("последняя открытая отчётность — за 2024 год, о 2025 годе она ничего не говорит", f)
        self.assertNotIn("в открытой части ГИР БО", f)

    def test_svezhaya_bez_abzaca(self):
        f = " ".join(frazy([(2024, "10 млрд ₽", None), (2025, "11 млрд ₽", None)]))
        self.assertNotIn("открытой части ГИР БО", f)
        self.assertNotIn("ничего не говорит", f)

    def test_neraznyvnye_i_bez_ocenok(self):
        raw = R.vstavit_znachit(stranica(V=V, ryad=[(2021, "11 млрд ₽", None)])).replace("&nbsp;", NB)
        raw = re.search(r'<section class="co-sec co-znachit".*?</section>', raw, re.S).group(0)
        self.assertIn("КНД" + NB + "1120101", raw)
        self.assertIn("ст." + NB + "18", raw)
        self.assertIn("№" + NB + "402-ФЗ", raw)
        self.assertIsNone(R.STOP_SLOVA.search(raw))
        self.assertIsNone(ZAPRET.search(raw), "причину для компании не называем; часть статьи — после сверки [Право]")

    def test_opublikovannye(self):
        # на карточках в репозитории: абзац только при отчётности старше двух лет, строка о ст. 18 — один раз на карточку
        for p in sorted((KOREN / "company").glob("[0-9]*/index.html")):
            t = chitat(p).replace("&nbsp;", NB)
            n = t.count("в открытой части ГИР БО")
            self.assertLessEqual(n, 1, p.parent.name)
            if n:
                g = R.god_otchetnosti_html(t)
                self.assertIsNotNone(g, p.parent.name)
                self.assertLessEqual(g, 2023, p.parent.name)
                self.assertEqual(t.count("Федерального закона №" + NB + "402-ФЗ"), 1, p.parent.name)


if __name__ == "__main__":
    unittest.main()
