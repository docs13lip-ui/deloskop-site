"""rukovod-mesyac-v1/v2 ([Ночные-2] 10–11.11): смена руководителя меньше месяца назад — месяцем и годом, не «в этом месяце»."""
import datetime as dt
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as R  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_mesyac_predl():
    assert R.mesyac_predl(dt.date(2026, 10, 12)) == "в октябре 2026 года".replace(" ", R.NB)
    assert R.mesyac_predl(dt.date(2027, 5, 1)).startswith("в" + R.NB + "мае")
    assert len(R.MESYACY_PREDL) == 12


def test_net_v_etom_mesyace():
    plohie = [f for f in glob.glob(os.path.join(KOREN, "company", "*", "index.html"))
              if "сменился в&#160;этом месяце" in open(f, encoding="utf-8").read()
              or "сменился в этом месяце" in open(f, encoding="utf-8").read()]
    assert not plohie, plohie
    src = open(os.path.join(KOREN, "tests", "kartochka_render.py"), encoding="utf-8").read()
    assert '"в этом месяце"' not in src


def test_pochinit_ruk_mesyac():
    t = ('<p>Руководитель сменился в&#160;этом месяце</p><span class="co-src">ЕГРЮЛ · сведения на&#160;26.10.2026</span>'
         '<meta content="Руководитель сменился в этом месяце.">')
    t2 = R.pochinit_ruk_mesyac(t)
    assert "этом месяце" not in t2
    assert "сменился менее чем за&#160;месяц до&#160;26.10.2026" in t2
    assert R.pochinit_ruk_mesyac(t2) == t2
    assert R.pochinit_ruk_mesyac("сменился в этом месяце") == "сменился в этом месяце"  # без дня сведений не трогаем


def test_mesyac_okno():
    """rukovod-mesyac-v2: N полных месяцев до дня сведений → окно месяцев (vozrast_mes — обратная функция)."""
    d = dt.date(2026, 11, 11)
    assert R.mesyac_okno(d, 5, " ") == "в мае или июне 2026 года"
    assert R.mesyac_okno(dt.date(2026, 10, 31), 3, " ") == "в июле 2026 года"  # 01.07–31.07 — один месяц
    assert R.mesyac_okno(dt.date(2026, 1, 15), 1, " ") == "в ноябре или декабре 2025 года"
    assert R.mesyac_okno(dt.date(2026, 2, 10), 1, " ") == "в декабре 2025 года или январе 2026 года"
    # окно честное: каждая дата смены с N полными месяцами попадает в названные месяцы
    for den in (dt.date(2026, 11, 11), dt.date(2026, 3, 31), dt.date(2026, 10, 1), dt.date(2027, 2, 28)):
        for dni in range(1, 230):
            s = den - dt.timedelta(days=dni)
            n = R.vozrast_mes({"reg_date": s}, den)
            assert R.MESYACY_PREDL[s.month - 1] in R.mesyac_okno(den, n, " "), (den, s, n)


def test_pochinit_ruk_nazad():
    t = ('<p>Руководитель сменился 5&#160;месяцев назад</p><span class="co-src">ЕГРЮЛ · сведения на&#160;11.11.2026</span>'
         '<meta content="Руководитель сменился 5 месяцев назад."><li>сменился 5&nbsp;месяцев назад&#160;— попросите</li>')
    t2 = R.pochinit_ruk_mesyac(t)
    assert "назад" not in t2
    assert "сменился в&#160;мае&#160;или&#160;июне&#160;2026&#160;года</p>" in t2
    assert "сменился в мае или июне 2026 года." in t2
    assert R.pochinit_ruk_mesyac(t2) == t2


def test_net_n_mesyacev_nazad():
    """На опубликованных карточках нет «сменился N месяцев назад» — стареет на статичной странице."""
    import re
    plohie = [f for f in glob.glob(os.path.join(KOREN, "company", "*", "index.html"))
              if re.search(r"сменился \d+(&#160;|&nbsp;|\u00a0| )месяц", open(f, encoding="utf-8").read())]
    assert not plohie, plohie


if __name__ == "__main__":
    test_mesyac_okno()
    test_pochinit_ruk_nazad()
    test_net_n_mesyacev_nazad()
    test_pochinit_ruk_mesyac()
    test_mesyac_predl()
    test_net_v_etom_mesyace()
    print("ok")
