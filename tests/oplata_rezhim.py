#!/usr/bin/env python3
"""oplata-rezhim-v1 — одно состояние оплаты на всём сайте (п. 428 Очереди; claude/Экосистема_одно_состояние_оплаты_31.10.md).

Один выключатель — tarify/tarify.json → "oplata_rezhim":
    pauza — всё бесплатно, ничего не продаём: бета-половины на виду, оплата и счёт — в <template>, QR СБП нет (решение 16.10);
    schet — ступень 1: ЮЛ и ИП платят по счёту; карты, СБП и QR нет (касса не нужна только для безналичного расчёта по счёту);
    vse   — счёт, карта и СБП: только когда подключена онлайн-касса ("kassa": true) — без неё каждый расчёт гражданина
            без чека = штраф от 10 000 ₽ (ч. 2 ст. 14.5 КоАП).

Режим задаёт остальные флаги (их по-прежнему читают сборщики и тесты — так переход не ломает ни одной страницы):
    pauza → beta: true,  karta: false, oplata_kartoj: false, kassa ≠ true
    schet → beta: false, karta: false, oplata_kartoj: false, kassa ≠ true
    vse   → beta: false, kassa: true (karta и oplata_kartoj — по готовности шлюза, их не трогаем)

Сменить режим — одной командой (меняет флаги и собирает сайт в правильном порядке):
    python3 tests/oplata_rezhim.py schet
Посмотреть, совпадают ли флаги с режимом:   python3 tests/oplata_rezhim.py
Сторож «живое = режим» — tests/oplata_rezhim.test.js; переключатель — tests/test_oplata_rezhim.py.
"""
import json
import os
import re
import subprocess
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REZHIMY = ("pauza", "schet", "vse")
# флаг → значение, которого требует режим (None — режим флаг не задаёт)
FLAGI = {
    "pauza": {"beta": True, "karta": False, "oplata_kartoj": False},
    "schet": {"beta": False, "karta": False, "oplata_kartoj": False},
    "vse": {"beta": False},
}
SBORKA = (  # порядок — как в CI и КАК_ВЫЛОЖИТЬ: шапка переписывает css/podval.css, пакеты — после неё
    ["python3", "tests/sobrat_tarify.py", "."],
    ["python3", "tests/sobrat_shapku.py"],
    ["python3", "tests/sobrat_js.py"],
    ["python3", "tests/sobrat_shapku.py"],
)


def put(koren=KOREN):
    return os.path.join(koren, "tarify", "tarify.json")


def prochitat(koren=KOREN):
    with open(put(koren), encoding="utf-8") as fh:
        return json.load(fh)


def rezhim(D):
    r = D.get("oplata_rezhim")
    if r not in REZHIMY:
        raise ValueError('tarify.json: "oplata_rezhim" — одно из %s, а не %r' % (", ".join(REZHIMY), r))
    return r


def rassoglasiya(D):
    """Список расхождений флагов с режимом (пусто — всё сходится)."""
    r = rezhim(D)
    out = []
    for k, v in FLAGI[r].items():
        if D.get(k) is not v:
            out.append('"%s": %s, а режим %s требует %s' % (k, json.dumps(D.get(k)), r, json.dumps(v)))
    kassa = D.get("kassa") is True
    if r == "vse" and not kassa:
        out.append('режим vse без "kassa": true — сначала онлайн-касса (чек 54-ФЗ)')
    if r != "vse" and kassa:
        out.append('"kassa": true при режиме %s — QR СБП вернётся на сайт; для приёма денег от граждан — режим vse' % r)
    return out


def _postavit(s, k, v):
    """Меняет значение верхнеуровневого флага в тексте tarify.json, не трогая остальное (порядок, отступы, тексты)."""
    zn = json.dumps(v, ensure_ascii=False)
    s2, n = re.subn(r'(\n  "%s": )(true|false|null|"[a-z]*")' % re.escape(k), lambda m: m.group(1) + zn, s, count=1)
    if n:
        return s2
    if v is False:  # флага нет — значит и так «нет» (kassa); не дописываем лишнего
        return s
    raise ValueError('tarify.json: нет поля "%s"' % k)


def ustanovit(novyj, koren=KOREN):
    """Ставит режим и флаги в tarify.json. Возвращает True, если файл изменился."""
    if novyj not in REZHIMY:
        raise ValueError("режим — одно из %s, а не %r" % (", ".join(REZHIMY), novyj))
    D = prochitat(koren)
    if novyj == "vse" and D.get("kassa") is not True:
        raise ValueError('режим vse — только с онлайн-кассой: сначала "kassa": true и ссылка банка в js/sbp-qr.js')
    with open(put(koren), encoding="utf-8") as fh:
        s = fh.read()
    s2 = _postavit(s, "oplata_rezhim", novyj)
    for k, v in FLAGI[novyj].items():
        s2 = _postavit(s2, k, v)
    json.loads(s2)  # файл остался правильным JSON
    if s2 != s:
        with open(put(koren), "w", encoding="utf-8") as fh:
            fh.write(s2)
    if rassoglasiya(json.loads(s2)):
        raise ValueError("; ".join(rassoglasiya(json.loads(s2))))
    return s2 != s


def main(argv):
    if len(argv) > 1 and argv[1] not in ("--check",):
        ustanovit(argv[1])
        for cmd in SBORKA:
            subprocess.run(cmd, cwd=KOREN, check=True)
        print("Режим оплаты:", argv[1], "— флаги и сайт собраны. Проверка: node --test tests/oplata_rezhim.test.js")
        return 0
    D = prochitat()
    r = rezhim(D)
    bad = rassoglasiya(D)
    print("Режим оплаты:", r)
    for b in bad:
        print("✗", b)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
