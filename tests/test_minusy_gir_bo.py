"""minusy-gir-bo-v1 ([Ночные-2] 18.11): ответы [Право] 18.11 12:20, разд. 1 — на карточках /company/:
(4) убыток и отрицательный собственный капитал последнего открытого года ГИР БО — в «Минусах» (не «существенные»);
(5) «Производства у приставов: N, остаток долга — 0 ₽» — только при точном нуле, в итог первого экрана не поднимаем;
(2) итог «… — по K проверенным источникам, проверено ДД.ММ.ГГГГ» и строка о наборах ФНС старше 30 дней;
(3) «Так бывает у головных…» — не у компаний в ликвидации или банкротстве.
Запуск: python3 tests/test_minusy_gir_bo.py"""
import html
import os
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = Path(__file__).resolve().parent.parent
NB = K.NB
EKOPET = KOREN / "company" / "3904087321-ekopet" / "index.html"
_ITOG = re.compile(r'<section class="co-itog".*?<!--/co-itog-->', re.S)
_PM = re.compile(r'<section class="co-sec co-pm".*?</section>', re.S)
_ZAG = re.compile(r'<h2 id="itog" class="co-itog__s">(.*?)<span class="co-itog__d">(.*?)</span></h2>', re.S)
_FSSP_NET = re.compile(r'(<span>Исполнительные производства</span><span class="fact__v">)не нашли(</span>)')


def txt(s):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).replace(NB, " ").split())


def ekopet():
    return EKOPET.read_text(encoding="utf-8")


class TestEkopet(unittest.TestCase):
    """Отчёт и карточка «Экопэт» говорят одно: «Плюсов N, минусов 2» (замечания ГИР БО — минусы, не существенные)."""

    def test_minusy(self):
        t = ekopet()
        S = K.plyusy_minusy_stroki(t)
        kody = [x[0] for x in S["minusy"]]
        self.assertEqual(kody, ["ubytok", "kapital"])
        self.assertEqual(txt(S["minusy"][0][1]), "Убыток за 2025 — 903 млн ₽ (ГИР БО, сведения на 31.12.2025)")
        self.assertEqual(txt(S["minusy"][1][1]), "Собственный капитал на 31.12.2025 — отрицательный: −2,5 млрд ₽ (ГИР БО)")
        for x in S["minusy"]:
            self.assertFalse(K.cz_sushchestvennyj(x, S.get("baza")), x)

    def test_itog_i_pm(self):
        t = ekopet()
        it = _ITOG.search(t).group(0)
        z = _ZAG.search(it)
        self.assertRegex(txt(z.group(1)), r"^Плюсов \d+, минусов 2$")
        self.assertRegex(txt(z.group(2)), r"^— по \d+ проверенным источникам, проверено \d\d\.\d\d\.\d{4}$")
        self.assertIn('data-pm="ubytok"><a href="#fin"', it)
        self.assertIn('data-pm="kapital"><a href="#bal"', it)
        self.assertIn("Налоги и долги — по наборам ФНС на 01.10.2026.", txt(it))
        pm = _PM.search(t).group(0)
        self.assertIn('data-minusy="2"', pm)
        self.assertNotIn("Существенных минусов не", txt(it))

    def test_povtor(self):
        t = ekopet()

        def n(x):
            return html.unescape(x).replace(NB, " ")
        self.assertEqual(n(K.pervyj_ekran_kartochki(t)), n(t))
        self.assertEqual(n(K.plyusy_minusy_kartochki(t)), n(t))

    def test_staryj_god_ne_minus(self):
        # отчётность старше «год сбора − 2» — не минус ([Право] (4))
        t = ekopet().replace("<p>Убыток за&nbsp;2025", "<p>Убыток за&nbsp;2021").replace(
            "<p>Собственный капитал на&nbsp;31.12.2025", "<p>Собственный капитал на&nbsp;31.12.2021")
        self.assertEqual([x[0] for x in K.plyusy_minusy_stroki(t)["minusy"]], [])


class TestPristavyNol(unittest.TestCase):
    def kartochka(self):
        t = _FSSP_NET.sub(lambda m: m.group(1) + "2&nbsp;производства, остаток долга&#160;— 0&nbsp;₽" + m.group(2), ekopet(), count=1)
        self.assertNotEqual(t, ekopet())
        return t

    def test_stroka_i_itog(self):
        t = self.kartochka()
        S = K.plyusy_minusy_stroki(t)
        f = [x for x in S["minusy"] if x[0] == "fssp"]
        self.assertEqual(len(f), 1)
        self.assertEqual(txt(f[0][1]), "Производства у приставов: 2, остаток долга — 0 ₽")
        self.assertNotIn(f[0], S.get("melkoe") or [])
        t2 = K.pervyj_ekran_kartochki(K.plyusy_minusy_kartochki(t))
        it = _ITOG.search(t2).group(0)
        self.assertRegex(txt(_ZAG.search(it).group(1)), r"^Плюсов \d+, минусов 3$")
        self.assertNotIn('data-pm="fssp"', it)  # не в списке первого экрана
        self.assertNotIn("Небольшие суммы", it)  # ноль к выручке не соотносим
        self.assertNotIn("остаток долга — 0", txt(it))

    def test_iz_api(self):
        # точный ноль по всем производствам — «, остаток долга — 0 ₽»; без ostatok_tochno — только число производств
        def r(tochno, ohvat="vse"):
            return {"damia": {"fssp": {"sostoyanie": "found", "data_svedeniy": "2026-11-12", "istochnik": "ФССП: исполнительные производства",
                                       "dannye": {"otkryto": 2, "ostatok": 0, "ostatok_tochno": tochno, "ostatok_ohvat": ohvat}}}}
        for rr, est in ((r(True), True), (r(False), False), (r(True, "pervye_100_iz_300"), False)):
            k = K.iz_check(rr) if hasattr(K, "iz_check") else None
            if not k or "fssp" not in (k.get("fakty") or {}):
                self.skipTest("iz_check требует полный ответ /api/check")
            self.assertEqual(k["fakty"]["fssp"]["detal"].endswith("остаток долга — 0" + NB + "₽"), est, rr)


class TestChtoZa(unittest.TestCase):
    def test_bez_golovnyh_pri_bankrotstve(self):
        t = (KOREN / "company" / "2309085638-magnit" / "index.html").read_text(encoding="utf-8")
        self.assertIn("головных", K.chto_za_html(t))
        S = K.plyusy_minusy_stroki(t)
        orig = K.plyusy_minusy_stroki
        try:
            K.plyusy_minusy_stroki = lambda x: dict(S, minusy=S["minusy"] + [("bankrotstvo", "Сообщения о банкротстве", "ЕФРСБ", "")])
            s = K.chto_za_html(t)
        finally:
            K.plyusy_minusy_stroki = orig
        self.assertNotIn("головных", s)
        self.assertTrue(s.endswith("</p><!--/co-chto-->"))
        self.assertIn("Выручка за", s)


class TestVse(unittest.TestCase):
    def test_opublikovannye(self):
        n_ub = n_nab = 0
        for p in sorted((KOREN / "company").glob("*/index.html")):
            t = p.read_text(encoding="utf-8")
            m = _ITOG.search(t)
            if not m:
                continue
            it = m.group(0)
            self.assertNotRegex(txt(it), r"проверенным источникам на \d", p.parent.name)
            n_nab += "Налоги и долги — по наборам ФНС на" in txt(it)
            S = K.plyusy_minusy_stroki(t)
            if any(x[0] in ("ubytok", "kapital") for x in S["minusy"]):
                n_ub += 1
                self.assertNotIn("Существенных минусов не", txt(it), p.parent.name)
        self.assertGreater(n_ub, 20)
        self.assertGreater(n_nab, 100)


if __name__ == "__main__":
    unittest.main()
