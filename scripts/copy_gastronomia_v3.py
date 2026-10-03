import os
from PIL import Image

user_dir = r"C:\Users\leine\.gemini\antigravity-ide\brain\cf2ddb01-509b-4000-879b-f6b54ff4798a\.user_uploaded"
out_dir = r"d:\Proyectos\NEGOVA\public\images"

src_path = os.path.join(user_dir, "media_1787521923332.jpg")
dest_path = os.path.join(out_dir, "negocios-gastronomia-v3.jpg")

img = Image.open(src_path)
img.save(dest_path, "JPEG", quality=98)
print("Fotografía de Gastronomía v3 copiada e integrada con éxito.")
