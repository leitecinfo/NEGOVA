import os
from PIL import Image

user_dir = r"C:\Users\leine\.gemini\antigravity-ide\brain\cf2ddb01-509b-4000-879b-f6b54ff4798a\.user_uploaded"
out_dir = r"d:\Proyectos\NEGOVA\public\images"
os.makedirs(out_dir, exist_ok=True)

target_ratio = 4.0 / 3.0

def process_img(filename, out_filename):
    path = os.path.join(user_dir, filename)
    if not os.path.exists(path):
        print(f"No existe: {path}")
        return
    img = Image.open(path).convert("RGB")
    w, h = img.size
    
    if w / float(h) > target_ratio:
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))
    else:
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        img = img.crop((0, top, w, top + new_h))
        
    img = img.resize((800, 600), Image.Resampling.LANCZOS)
    img.save(os.path.join(out_dir, out_filename), "PNG", quality=95)
    print(f"Guardado: {out_filename}")

# 1. Gastronomía Colombia (media_1787521200061.jpg - Terraza Riohacha con hamburguesas y salchipapas)
process_img("media_1787521200061.jpg", "negocios-gastronomia-lifestyle.png")

# 2. Comercio Latam (media_1787520339825.png - Tienda de ropa de barrio)
process_img("media_1787520339825.png", "negocios-comercio-lifestyle.png")

# 3. Servicios Latam (media_1787521272915.png - La Fermata bistro/local)
process_img("media_1787521272915.png", "negocios-servicios-lifestyle.png")

# 4. Mercados Latam (media_1787521280995.jpg - Local vibrante con sillas amarillas)
process_img("media_1787521280995.jpg", "negocios-mercados-lifestyle.png")
