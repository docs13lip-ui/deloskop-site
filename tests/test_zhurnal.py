#!/usr/bin/env python3
"""zhurnal-v1: PDF выпуска собирается Chromium'ом (Playwright) и весит ≤ 2 МБ; письмо ≤ 3 500 знаков.
Запуск: python3 tests/test_zhurnal.py — нужен Playwright с Chromium (облако: /opt/pw-browsers). Без него — пропуск PDF.
В CI не входит (там нет браузера); схему, типографику и письмо проверяет tests/zhurnal.test.js."""
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sobrat_zhurnal as Z  # noqa: E402


def main():
    try:
        import playwright  # noqa: F401
        est_pw = True
    except ImportError:
        est_pw = False
    nomera = sorted(f[:-5] for f in os.listdir(Z.put("data", "zhurnal")) if re.match(r"^\d{4}-\d{2}\.json$", f))
    assert nomera, "нет выпусков"
    for n in nomera:
        with tempfile.TemporaryDirectory() as d:
            m = Z.sobrat_vypusk(n, d, est_pw)
            assert m["znakov_v_pisme"] <= Z.PISMO_MAKS, m
            if est_pw:
                p = os.path.join(d, m["pdf"])
                with open(p, "rb") as fh:
                    b = fh.read()
                assert b.startswith(b"%PDF"), "не PDF"
                assert 0 < len(b) <= Z.PDF_MAKS, len(b)
                assert len(re.findall(rb"/Type\s*/Page[^s]", b)) >= 2, "в PDF меньше двух страниц"
                print("✓ %s: письмо %d знаков, PDF %d байт" % (n, m["znakov_v_pisme"], len(b)))
            else:
                print("✓ %s: письмо %d знаков; PDF пропущен — нет Playwright" % (n, m["znakov_v_pisme"]))


if __name__ == "__main__":
    main()
