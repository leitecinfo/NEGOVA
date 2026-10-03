import os
from PIL import Image

user_dir = r"C:\Users\leine\.gemini\antigravity-ide\brain\cf2ddb01-509b-4000-879b-f6b54ff4798a\.user_uploaded"
out_dir = r"d:\Proyectos\NEGOVA\public\images"

files_map = {
    "negocios-gastronomia-v3.jpg": "media_1787521923332.jpg",
    "negocios-comercio-v3.jpg": "media_1787522042023.jpg",
    "negocios-servicios-v3.jpg": "media_1787522125685.jpg",
    "negocios-mercados-v3.jpg": "media_1787522196773.jpg",
}

for dest_name, src_name in files_map.items():
    src_path = os.path.join(user_dir, src_name)
    dest_path = os.path.join(out_dir, dest_name)
    if os.path.exists(src_path):
        img = Image.open(src_path)
        img.save(dest_path, "JPEG", quality=98)
        print(f"Copiada con éxito: {dest_name}")
    else:
        print(f"No existe: {src_name}")
