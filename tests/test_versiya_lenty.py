"""Метка версии для автовыкладки: верхний id ленты в репозитории уникален и читается так же, как с живого сайта."""
import io
import json
import os
import sys
import unittest
from contextlib import redirect_stdout

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOREN, "tests"))
import versiya_lenty  # noqa: E402


class Test(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(KOREN, "obnovleniya.json"), encoding="utf-8") as f:
            self.d = json.load(f)

    def test_verhnij_id_est_i_unikalen(self):
        ids = [z["id"] for z in self.d["obnovleniya"]]
        self.assertTrue(versiya_lenty.verhnij_id(self.d))
        self.assertEqual(versiya_lenty.verhnij_id(self.d), ids[0])
        self.assertEqual(len(ids), len(set(ids)), "в ленте повторяется id — автовыкладка не отличит версии")

    def test_formy_i_musor(self):
        self.assertEqual(versiya_lenty.verhnij_id([{"id": "a"}]), "a")
        self.assertEqual(versiya_lenty.verhnij_id({"obnovleniya": []}), "")
        sys.stdin = io.StringIO("<html>не json</html>")
        buf = io.StringIO()
        with redirect_stdout(buf):
            self.assertEqual(versiya_lenty.main(["-"]), 0)
        self.assertEqual(buf.getvalue().strip(), "")
        sys.stdin = sys.__stdin__


if __name__ == "__main__":
    unittest.main()
