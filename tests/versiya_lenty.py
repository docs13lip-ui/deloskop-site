"""id верхней записи ленты «Что нового» — метка версии сайта для автовыкладки.
    python3 tests/versiya_lenty.py                 # из obnovleniya.json в репозитории
    curl -s https://deloskop.ru/obnovleniya.json | python3 tests/versiya_lenty.py -   # с живого сайта
Печатает id или пустую строку (код 0 всегда — решение принимает workflow)."""
import json
import sys


def verhnij_id(d):
    if isinstance(d, dict):
        d = d.get("obnovleniya") or d.get("zapisi") or []
    return (d[0].get("id") or "") if d and isinstance(d[0], dict) else ""


def main(argv):
    try:
        if argv and argv[0] == "-":
            d = json.load(sys.stdin)
        else:
            with open(argv[0] if argv else "obnovleniya.json", encoding="utf-8") as f:
                d = json.load(f)
        print(verhnij_id(d))
    except Exception:
        print("")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
