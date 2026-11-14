"""og-v1: сжатие обложки палитрой (64 цвета без растра — плоские цвета и сглаживание текста). python3 tests/oblozhka/szhat.py
oblozhka-znak-v1: тем же способом — значок ярлыков ikonki/yarlyk-96.png (96×96).
oblozhka-3d-v1: на обложке объёмный знак и мягкое свечение фона — срезом медианы они ложатся кольцами (полосы в свечении,
ступени на латуни). Обложку сжимает libimagequant (pip install imagequant): 64 цвета с рассеиванием — 54 КБ и без полос."""
import os
from PIL import Image
P = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "oblozhka.png")
try:
    import imagequant
except ImportError:
    raise SystemExit("нужен libimagequant: pip install imagequant (без него в свечении за знаком — полосы)")
im = Image.open(P).convert("RGBA")
assert im.size == (1200, 630), im.size
q = imagequant.quantize_pil_image(im, dithering_level=1.0, max_colors=64, min_quality=0, max_quality=100)
bez = Image.frombytes("P", q.size, q.tobytes())  # без tRNS: обложка непрозрачная, палитра — чистый RGB
bez.putpalette(q.getpalette("RGB")[:3 * 64])
bez.save(P, optimize=True)
print(P, os.path.getsize(P), "байт")
Y = os.path.join(os.path.dirname(P), "ikonki", "yarlyk-96.png")
im = Image.open(Y).convert("RGB")
assert im.size == (96, 96), im.size
im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(Y, optimize=True)
print(Y, os.path.getsize(Y), "байт")
