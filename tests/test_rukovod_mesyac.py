"""rukovod-mesyac-v1 ([Ночные-2] 10.11): смена руководителя меньше месяца назад — месяцем и годом, не «в этом месяце»."""
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


if __name__ == "__main__":
    test_pochinit_ruk_mesyac()
    test_mesyac_predl()
    test_net_v_etom_mesyace()
    print("ok")
