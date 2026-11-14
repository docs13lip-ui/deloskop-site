"""og-v1: сжатие обложки палитрой (64 цвета без растра — плоские цвета и сглаживание текста). python3 tests/oblozhka/szhat.py
oblozhka-znak-v1: тем же способом — значок ярлыков ikonki/yarlyk-96.png (96×96)."""
import os
from PIL import Image
P = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "oblozhka.png")
im = Image.open(P).convert("RGB")
assert im.size == (1200, 630), im.size
im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(P, optimize=True)
print(P, os.path.getsize(P), "байт")
Y = os.path.join(os.path.dirname(P), "ikonki", "yarlyk-96.png")
im = Image.open(Y).convert("RGB")
assert im.size == (96, 96), im.size
im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(Y, optimize=True)
print(Y, os.path.getsize(Y), "байт")
