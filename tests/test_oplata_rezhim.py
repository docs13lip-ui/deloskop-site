"""oplata-rezhim-v1 — переключатель режима оплаты на копии tarify.json (настоящий файл не трогаем).
Запуск из корня: python3 tests/test_oplata_rezhim.py

  • pauza → schet → pauza: файл байт в байт прежний (ничего не теряется, правятся только флаги);
  • schet: beta/karta/oplata_kartoj = false, расхождений нет;
  • vse без "kassa": true — отказ (без онлайн-кассы деньги граждан не принимаем);
  • неизвестный режим — отказ; настоящий tarify.json сейчас без расхождений.
"""
import json
import os
import shutil
import sys
import tempfile

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(R, "tests"))
import oplata_rezhim as O  # noqa: E402

n = 0


def ok(name, cond, extra=""):
    global n
    if not cond:
        print("✗", name, extra)
        sys.exit(1)
    n += 1
    print("✓", name)


D0 = O.prochitat()
ok("настоящий tarify.json: режим известен, флаги сходятся", O.rezhim(D0) in O.REZHIMY and not O.rassoglasiya(D0),
   "; ".join(O.rassoglasiya(D0)))

t = tempfile.mkdtemp()
try:
    os.makedirs(os.path.join(t, "tarify"))
    src = os.path.join(R, "tarify", "tarify.json")
    shutil.copy(src, os.path.join(t, "tarify", "tarify.json"))
    orig = open(src, encoding="utf-8").read()
    start = O.rezhim(D0)

    O.ustanovit("schet", t)
    D = O.prochitat(t)
    ok("schet: оплата по счёту, бета и карта выключены",
       D["oplata_rezhim"] == "schet" and D["beta"] is False and D["karta"] is False and D["oplata_kartoj"] is False)
    ok("schet: расхождений нет", not O.rassoglasiya(D))
    novyj = open(os.path.join(t, "tarify", "tarify.json"), encoding="utf-8").read()
    ok("schet: остальной файл не тронут (меняются только строки флагов)",
       sum(1 for a, b in zip(orig.split("\n"), novyj.split("\n")) if a != b) <= 4 and len(orig) - len(novyj) in (0, 1, -1))

    O.ustanovit("pauza", t)
    if start == "pauza":
        ok("schet → pauza: файл байт в байт прежний", open(os.path.join(t, "tarify", "tarify.json"), encoding="utf-8").read() == orig)
    ok("pauza: ничего не меняется при повторе", O.ustanovit("pauza", t) is False)

    try:
        O.ustanovit("vse", t)
        ok("vse без кассы — отказ", False)
    except ValueError as e:
        ok("vse без кассы — отказ", "касс" in str(e))
    try:
        O.ustanovit("karta", t)
        ok("неизвестный режим — отказ", False)
    except ValueError:
        ok("неизвестный режим — отказ", True)

    # kassa: true при паузе — расхождение (QR вернулся бы без режима vse)
    D = O.prochitat(t)
    D["kassa"] = True
    ok("kassa: true при паузе — расхождение", any("kassa" in x for x in O.rassoglasiya(D)))
    D["oplata_rezhim"], D["beta"] = "vse", False
    ok("vse с кассой — без расхождений", not O.rassoglasiya(D))
    json.dumps(D)
finally:
    shutil.rmtree(t)

print("Все проверки пройдены:", n)
