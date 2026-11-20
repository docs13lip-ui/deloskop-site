#!/usr/bin/env python3
"""sushchestvennost-v1 (18.11.2026): суммы минусов на карточке /company/ — с долей выручки последнего года ГИР БО, порядок —
по весу, мелкое (меньше 0,1 % выручки) — не в главном итога, а строкой «Мелкое к выручке» (решение владельца 18.11, разд. 3
п. 2 и п. 20). Сторож: (1) доли считаются как в «Главном» отчёта (js/glavnoe.js); (2) «не меньше …», банк, выручка старше
двух лет, нет выручки — доли нет; (3) у «головной» (чистая прибыль больше выручки) сумме от 10 % выручки вес «первым» не даём;
(4) «Магнит» 2309085638 — ни одного «больше выручки» и ни одного «… % выручки» от 10 %, его единственный минус — в «Мелком»;
(5) на каждой опубликованной карточке: у суммы минуса при выручке — доля, мелкое в итоге не среди главных, «Коротко» —
мелкое в конце; (6) повторная починка не меняет байты."""
import os
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = Path(__file__).resolve().parent.parent
NB = K.NB
MAGNIT = KOREN / "company" / "2309085638-magnit" / "index.html"
_DOLYA = re.compile(r"\((?:меньше 0,1|[\d,]+|больше)[^)]*?выручки за" + NB + r"(\d{4})" + NB + r"год\)")


def txt(s):
    return K._zn_txt(s)


class TestFunkcii(unittest.TestCase):
    def test_dolya_tekst(self):
        self.assertEqual(K.ss_dolya_tekst(0.00087, 2025), "меньше 0,1" + NB + "% выручки за" + NB + "2025" + NB + "год")
        self.assertEqual(K.ss_dolya_tekst(0.006, 2024), "0,6" + NB + "% выручки за" + NB + "2024" + NB + "год")
        self.assertEqual(K.ss_dolya_tekst(0.44, 2024), "44" + NB + "% выручки за" + NB + "2024" + NB + "год")
        self.assertEqual(K.ss_dolya_tekst(5.1, 2025), "больше выручки за" + NB + "2025" + NB + "год")

    def test_summa(self):
        self.assertEqual(K.ss_summa("требования к" + NB + "компании — 35,9" + NB + "тыс." + NB + "₽"), 35900.0)
        self.assertEqual(K.ss_summa("остаток долга — 1&nbsp;234&nbsp;567&nbsp;₽ (на"), 1234567.0)
        self.assertEqual(K.ss_summa("Долг по налогам 2" + NB + "₽"), 2.0)
        self.assertIsNone(K.ss_summa("остаток долга — не" + NB + "меньше 5" + NB + "млн" + NB + "₽ (по" + NB + "20 из" + NB + "40)"),
                          "часть производств — доля была бы нижней границей")
        self.assertIsNone(K.ss_summa("3 незавершённых дела, где компания — ответчик"))

    def test_ves(self):
        B = {"summa": 1e9, "god": 2025, "golovnaya": False}
        self.assertEqual(K.ss_ves("status", "Статус: ликвидация", B)[0], 3)
        self.assertEqual(K.ss_ves("sudy", "требования к компании — 50 тыс. ₽", B)[0], 0)
        self.assertEqual(K.ss_ves("sudy", "требования к компании — 5 млн ₽", B)[0], 2)
        self.assertEqual(K.ss_ves("sudy", "требования к компании — 500 млн ₽", B)[0], 3)
        self.assertEqual(K.ss_ves("sudy", "требования к компании — 500 млн ₽", dict(B, golovnaya=True))[0], 2,
                         "п. 20: у головной доля к выручке завышена — не первым")
        self.assertEqual(K.ss_ves("sudy", "требования к компании — 50 тыс. ₽", None), (2, ""), "нет выручки — доли нет")

    def test_baza(self):
        t = MAGNIT.read_text(encoding="utf-8") if MAGNIT.exists() else ""
        if not t:
            self.skipTest("нет карточки «Магнита»")
        B = K.ss_baza(t)
        self.assertEqual((B["god"], B["golovnaya"]), (2024, True))  # ne-svereno-kartochki-v1: 2025 не сверен
        bank = t.replace('<span class="num">68.20.21</span>', '<span class="num">64.19</span>', 1)
        self.assertIsNone(K.ss_baza(bank), "банк — доли нет (правило юриста 12.11 п. 3)")
        staraya = re.sub(r"(ЕГРЮЛ · сведения на(?:&#160;|&nbsp;| | )\d{2}\.\d{2}\.)2026(</p>)", r"\g<1>2028\2", t, count=1)
        self.assertIsNone(K.ss_baza(staraya), "отчётность старше двух лет — доли нет")


def proverit(tc, t, imya):
    S = K.plyusy_minusy_stroki(t)
    if not S:
        return 0
    B = K.ss_baza(t)
    pm = t[t.index('class="co-sec co-pm"'):]
    pm = pm[:pm.index("</section>")]
    vesa = []
    for k, tx, _, _ in S["minusy"]:
        tc.assertIn(txt(tx), txt(pm), imya + ": строка минуса с долей — в «Плюсах и минусах»")
        sm = K.ss_summa(tx)
        if B and sm and sm > 0:
            m = _DOLYA.search(tx)
            tc.assertTrue(m, imya + ": у суммы минуса нет доли выручки — " + tx)
            tc.assertEqual(int(m.group(1)), B["god"], imya)
        elif "выручки за" in tx:
            tc.fail(imya + ": доля без выручки или у «не меньше» — " + tx)
        vesa.append(K.ss_ves(k, tx, B)[0])
    tc.assertEqual(vesa, sorted(vesa, reverse=True), imya + ": минусы — по весу")
    itog = re.search(r'<section class="co-itog".*?</section><!--/co-itog-->', t, re.S)
    if itog:
        glavnye = itog.group(0).split('co-itog__m"')[0]
        for x in S["melkoe"]:
            tc.assertNotIn(txt(x[1]), txt(glavnye.split('class="co-itog__f"')[-1]), imya + ": мелкое — не среди главных")
        if S["melkoe"]:
            tc.assertIn("Небольшие суммы (меньше 0,1 % выручки за", txt(itog.group(0)), imya)  # chto-za-kompaniya-v1: слова [Право] 18.11
    kor = K._SS_KOR.search(t)
    if kor and B:
        tony = []
        for li in K._SS_LI.findall(kor.group(2)):
            p = re.search(r"<p>(.*?)</p>", li, re.S).group(1)
            v = K.ss_ves("", p, B) if "co-v--warn" in li else (2, "")
            tony.append(-1 if v[0] == 3 else 1 if v[0] == 0 else 0)
            if v[1]:
                tc.assertIn(v[1].replace(NB, " "), txt(p).replace(NB, " "), imya + ": «Коротко» — доля у суммы")
        tc.assertEqual(tony, sorted(tony), imya + ": «Коротко» — от 10 % первыми, мелкое в конце")
    tc.assertEqual(K.korotko_po_vesu(t), t, imya + ": повторная починка не меняет байты")
    return 1


class TestOpublikovannye(unittest.TestCase):
    def test_magnit(self):
        if not MAGNIT.exists():
            self.skipTest("нет карточки «Магнита»")
        t = MAGNIT.read_text(encoding="utf-8")
        if 'class="co-itog"' not in t:
            self.skipTest("карточки ещё не перепечатаны")
        tt = txt(t).replace(NB, " ")
        self.assertNotIn("(больше выручки за", tt, "п. 20: у «Магнита» нет вывода из-за доли от выручки")
        for m in re.finditer(r"\(([\d,]+) % выручки за", tt):
            self.assertLess(float(m.group(1).replace(",", ".")), 10, "п. 20: ни одной доли от 10 %")
        itog = re.search(r'<section class="co-itog".*?</section>', t, re.S).group(0)
        self.assertIn("Небольшие суммы (меньше 0,1 % выручки за 2024 год):", txt(itog))  # ne-svereno-kartochki-v1
        self.assertNotIn('co-itog__l--minus', itog, "единственный минус «Магнита» — мелкий, не в главном")
        proverit(self, t, "magnit")

    def test_vse(self):
        n = 0
        for p in sorted((KOREN / "company").glob("*/index.html")):
            t = p.read_text(encoding="utf-8")
            if 'class="co-sec co-pm"' not in t:
                continue
            n += proverit(self, t, p.parent.name)
        if (KOREN / "company").is_dir():
            self.assertGreater(n, 100)


if __name__ == "__main__":
    unittest.main()
