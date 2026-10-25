"""lenta-slit-v1: слияние obnovleniya.json по записям (tests/lenta_slit.py) — по-настоящему через git am -3."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOREN, "tests"))
import lenta_slit as L  # noqa: E402


def z(i, t="x", vremya=None):
    e = {"id": i, "zagolovok": t, "chto_novogo": [t]}
    if vremya:
        e.update(data="25 октября 2026", vremya=vremya)
    return e


def lenta(*zz):
    return {"_kak": "k", "obnovleniya": list(zz)}


class Slit(unittest.TestCase):
    def test_dve_novye_sverhu_poryadok_po_vykladke(self):
        baza = lenta(z("2026-10-24-1547", vremya="00:28"))
        nasha = lenta(z("2026-10-25-1685", "наша"), *baza["obnovleniya"])
        ih = lenta(z("2026-10-25-1643", "б"), z("2026-10-25-1631", "а"), *baza["obnovleniya"])
        r, zameny, k = L.slit(baza, nasha, ih)
        self.assertEqual(k, [])
        self.assertEqual([e["id"] for e in r["obnovleniya"]],
                         ["2026-10-25-1703", "2026-10-25-1691", "2026-10-25-1685", "2026-10-24-1547"])
        self.assertEqual([e["zagolovok"] for e in r["obnovleniya"][:2]], ["б", "а"])
        self.assertEqual(zameny, [("2026-10-25-1631", "2026-10-25-1691"), ("2026-10-25-1643", "2026-10-25-1703")])
        self.assertEqual(r["_kak"], "k")

    def test_nomer_vyshe_verha_ne_menyaetsya(self):
        baza = lenta(z("2026-10-24-1547", vremya="00:28"))
        nasha = lenta(z("2026-10-25-1679"), *baza["obnovleniya"])
        ih = lenta(z("2026-10-25-1685"), *baza["obnovleniya"])
        r, zameny, k = L.slit(baza, nasha, ih)
        self.assertEqual((k, zameny), ([], []))
        self.assertEqual(r["obnovleniya"][0]["id"], "2026-10-25-1685")

    def test_vylozhennuyu_ne_perenumerovyvaet(self):
        # слияние main в ветку: записи с живого (с «vremya») номер не меняют, даже если ниже верха
        baza = lenta(z("2026-10-24-1487", vremya="20:04"))
        nasha = lenta(z("2026-10-25-1685"), *baza["obnovleniya"])
        ih = lenta(z("2026-10-24-1547", vremya="00:28"), *baza["obnovleniya"])
        r, zameny, k = L.slit(baza, nasha, ih)
        self.assertEqual((k, zameny), ([], []))
        self.assertIn("2026-10-24-1547", [e["id"] for e in r["obnovleniya"]])

    def test_pravka_staroj_zapisi_perenositsya(self):
        # довесок razbor26-sverka правит запись, лежащую ниже новых
        star = z("2026-10-25-1679", "ст. 203")
        baza = lenta(star)
        nasha = lenta(z("2026-10-25-1685"), star)
        ih = lenta(z("2026-10-25-1679", "ст. 20.3"))
        r, zameny, k = L.slit(baza, nasha, ih)
        self.assertEqual(k, [])
        self.assertEqual(r["obnovleniya"][1]["zagolovok"], "ст. 20.3")

    def test_raznye_pravki_odnoj_zapisi_konflikt(self):
        star = z("2026-10-25-1679", "0")
        r, zameny, k = L.slit(lenta(star), lenta(z("2026-10-25-1679", "1")), lenta(z("2026-10-25-1679", "2")))
        self.assertEqual(k, ["2026-10-25-1679"])

    def test_udalenie_i_uzhe_lezhashchaya(self):
        a, b = z("2026-10-25-1679"), z("2026-10-25-1667")
        r, _, k = L.slit(lenta(a, b), lenta(a, b), lenta(a))
        self.assertEqual(([e["id"] for e in r["obnovleniya"]], k), (["2026-10-25-1679"], []))
        # та же запись уже есть у нас (патч применяют второй раз) — не дублируется
        r, zameny, k = L.slit(lenta(b), lenta(a, b), lenta(a, b))
        self.assertEqual(([e["id"] for e in r["obnovleniya"]], zameny, k), (["2026-10-25-1679", "2026-10-25-1667"], [], []))

    def test_setka(self):
        self.assertEqual(L.sleduyushchij({1679, 1685}), 1691)
        self.assertEqual(L.sleduyushchij({1691}), 1703)

    def test_gitattributes(self):
        with open(os.path.join(KOREN, ".gitattributes"), encoding="utf-8") as f:
            s = f.read()
        self.assertIn("obnovleniya.json merge=lenta", s)
        self.assertIn('git config merge.lenta.driver "python3 tests/lenta_slit.py %O %A %B"', s)
        with open(os.path.join(KOREN, ".dockerignore"), encoding="utf-8") as f:
            self.assertIn(".gitattributes", f.read().split())


@unittest.skipUnless(shutil.which("git"), "нет git")
class GitAm(unittest.TestCase):
    """Две ветки добавляют по записи сверху; git am -3 с драйвером проходит без конфликта."""

    def git(self, *a, **kw):
        return subprocess.run(["git", *a], cwd=self.d, capture_output=True, text=True, **kw)

    def zapisat(self, d):
        with open(os.path.join(self.d, "obnovleniya.json"), "w", encoding="utf-8") as f:
            f.write(L.tekst(d))

    def setUp(self):
        self.d = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.d, "tests"))
        shutil.copy(os.path.join(KOREN, "tests", "lenta_slit.py"), os.path.join(self.d, "tests"))
        shutil.copy(os.path.join(KOREN, ".gitattributes"), self.d)
        for a in (["init", "-q", "-b", "main"], ["config", "user.email", "t@t"], ["config", "user.name", "t"]):
            self.git(*a, check=True)
        self.baza = lenta(*[z("2026-10-24-%d" % n, "старая %d" % n, vremya="00:28") for n in (1547, 1535, 1511)])
        self.zapisat(self.baza)
        self.git("add", "-A", check=True)
        self.git("commit", "-qm", "база", check=True)

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def am(self, s_drajverom):
        if s_drajverom:
            self.git("config", "merge.lenta.driver", "python3 tests/lenta_slit.py %O %A %B", check=True)
        self.git("checkout", "-qb", "komplekt", check=True)
        self.zapisat(lenta(z("2026-10-25-1631", "комплект"), *self.baza["obnovleniya"]))
        self.git("commit", "-qam", "комплект", check=True)
        patch = self.git("format-patch", "-1", "--stdout", check=True).stdout
        self.git("checkout", "-q", "main", check=True)
        self.zapisat(lenta(z("2026-10-25-1685", "сборка"), z("2026-10-25-1679", "разбор"), *self.baza["obnovleniya"]))
        self.git("commit", "-qam", "сборка", check=True)
        return self.git("am", "-3", input=patch)

    def test_am_s_drajverom(self):
        r = self.am(True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        with open(os.path.join(self.d, "obnovleniya.json"), encoding="utf-8") as f:
            d = json.load(f)
        self.assertEqual([e["id"] for e in d["obnovleniya"]][:4],
                         ["2026-10-25-1691", "2026-10-25-1685", "2026-10-25-1679", "2026-10-24-1547"])
        self.assertEqual(d["obnovleniya"][0]["zagolovok"], "комплект")

    def test_iz_indeksa_posle_konflikta(self):
        r = self.am(False)                 # без драйвера — прежний конфликт строками
        self.assertNotEqual(r.returncode, 0)
        r = subprocess.run([sys.executable, "tests/lenta_slit.py", "--iz-indeksa"], cwd=self.d, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("-1631", r.stderr)    # замена номера напечатана
        r = self.git("-c", "core.editor=true", "am", "--continue")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        with open(os.path.join(self.d, "obnovleniya.json"), encoding="utf-8") as f:
            ids = [e["id"] for e in json.load(f)["obnovleniya"]]
        self.assertEqual(ids[:3], ["2026-10-25-1691", "2026-10-25-1685", "2026-10-25-1679"])
        self.assertEqual(len(ids), len(set(ids)))


if __name__ == "__main__":
    unittest.main()
