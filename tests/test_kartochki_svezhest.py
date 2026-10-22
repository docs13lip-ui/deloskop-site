#!/usr/bin/env python3
"""kartochki-svezhest-v1 ([Ночные-2] 23.10): освежение опубликованных карточек — старейшие сведения первыми
(`kartochki.py svezhest`, `iz-api --osvezhit N`), и ответ без финансов при доборе карточку больше не снимает.
Запуск: python3 tests/test_kartochki_svezhest.py"""
import datetime as dt
import json
import os
import pathlib
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as K  # noqa: E402

KOREN = str(pathlib.Path(__file__).resolve().parent.parent)


class TestSvezhest(unittest.TestCase):
    def test_poryadok_starye_pervymi(self):
        sp = K.svezhest(KOREN, dt.date(2026, 10, 23))
        self.assertEqual(len(sp), len(K.kartochki_na_diske(KOREN)))
        daty = [d for _, d, _ in sp if d]
        self.assertEqual(daty, sorted(daty))
        for inn, d, n in sp:
            self.assertEqual(len(inn), 10)
            if d:
                self.assertEqual(n, (dt.date(2026, 10, 23) - d).days)

    def test_k_osvezheniyu_propuskaet_sproshennye(self):
        sp = K.svezhest(KOREN)
        pervyj = sp[0][0]
        with tempfile.TemporaryDirectory() as tmp:
            put = os.path.join(tmp, "x.jsonl")
            with open(put, "w", encoding="utf-8") as fh:
                fh.write(json.dumps({"company": {"inn": pervyj}}) + "\n")
            n = K.k_osvezheniyu(3, put, KOREN)
        self.assertEqual(len(n), 3)
        self.assertNotIn(pervyj, n)
        self.assertEqual(n, [i for i, _, _ in sp if i != pervyj][:3])
        self.assertEqual(K.k_osvezheniyu(0, None, KOREN), [])

    def test_iz_api_osvezhit_bez_spiska(self):
        """--osvezhit без --inn: спрашивает именно старейшие опубликованные (опубликованные не отсеиваются)."""
        sprosheno = []

        class Otv:
            def __init__(self, inn):
                self.inn = inn

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return json.dumps({"company": {"inn": self.inn, "director_name": "X", "phones": ["1"]}}).encode()

        def urlopen(req, timeout=60):
            inn = req.full_url.rsplit("=", 1)[1]
            sprosheno.append(inn)
            return Otv(inn)

        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(K.urllib.request, "urlopen", urlopen), \
                mock.patch.object(K.time, "sleep", lambda s: None), mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DELOSKOP_COOKIE", None)
            os.environ.pop("DELOSKOP_SERVICE_TOKEN", None)
            put = os.path.join(tmp, "o.jsonl")
            self.assertEqual(K.iz_api(None, put, osvezhit=2), 0)
            zapisi = K.chitat_jsonl(put)
        self.assertEqual(sprosheno, [i for i, _, _ in K.svezhest(KOREN)][:2])
        for r in zapisi:  # люди и контакты в файл не попадают
            self.assertNotIn("phones", r["company"])
            if not K.persons_public():
                self.assertNotIn("director_name", r["company"])


class TestNepolnyjOtvet(unittest.TestCase):
    def test_tolko_net_finansov_i_tolko_opublikovannye(self):
        otchet = {"po_inn": [("1111111111", K.NET_FIN, ""), ("2222222222", "статус не «действующая»", ""),
                             ("3333333333", K.NET_FIN, ""), ("4444444444", "ок", "")]}
        opub = {"1111111111": {}, "2222222222": {}, "4444444444": {}}
        self.assertEqual(K.nepolnye_otvety(otchet, opub), {"1111111111"})

    def test_net_fin_sovpadaet_s_vorotami(self):
        """Строка причины — та же, что отдают ворота (иначе охрана молча перестанет работать)."""
        src = pathlib.Path(KOREN, "tests", "kartochka_render.py").read_text(encoding="utf-8")
        self.assertIn('return False, "%s"' % K.NET_FIN, src)

    def test_dobor_ne_snimaet_kartochku(self):
        """Ответ по опубликованной карточке без финансов попадает в «неполные» → sobrat --dobavit её не снимает (сквозной прогон — в КАК_ВЫЛОЖИТЬ)."""
        na_d = K.kartochki_na_diske(KOREN)
        inn = sorted(na_d)[0]
        papka = na_d[inn]["_papka"]
        r = {"company": {"inn": inn, "kind": "LEGAL", "status": "ACTIVE", "name_short": "ООО «Проба»",
                         "reg_date": "2000-01-01"}, "signals": [], "checked_at": "2026-10-23"}
        _, o = K.otobrat([r], 10)
        self.assertEqual([p for _, p, _ in o["po_inn"]], [K.NET_FIN])
        self.assertEqual(K.nepolnye_otvety(o, na_d), {inn})
        self.assertTrue(os.path.isfile(os.path.join(KOREN, "company", papka, "index.html")))


if __name__ == "__main__":
    unittest.main()
