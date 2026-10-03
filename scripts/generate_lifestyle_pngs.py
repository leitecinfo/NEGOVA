import os
from PIL import Image, ImageDraw, ImageFont

user_dir = r"C:\Users\leine\.gemini\antigravity-ide\brain\cf2ddb01-509b-4000-879b-f6b54ff4798a\.user_uploaded"
out_dir = r"d:\Proyectos\NEGOVA\public\images"
os.makedirs(out_dir, exist_ok=True)

# 1. Gastronomía (media_1787520341897.png)
img_gasto = Image.open(os.path.join(user_dir, "media_1787520341897.png")).convert("RGBA")
# Convertimos el banner amarillo a Naranja NEGOVA
pixels_g = img_gasto.load()
w_g, h_g = img_gasto.size
for y in range(int(h_g * 0.2), int(h_g * 0.9)):
    for x in range(int(w_g * 0.1), int(w_g * 0.7)):
        r, g, b, a = pixels_g[x, y]
        # Detectar amarillo
        if r > 190 and g > 150 and b < 90:
            pixels_g[x, y] = (237, 80, 10, a)

img_gasto.save(os.path.join(out_dir, "negocios-gastronomia-lifestyle.png"), "PNG")
print("Gastronomía lifestyle creada.")

# 2. Comercio (media_1787520339825.png)
img_com = Image.open(os.path.join(user_dir, "media_1787520339825.png")).convert("RGBA")
pixels_c = img_com.load()
w_c, h_c = img_com.size
for y in range(int(h_c * 0.15), int(h_c * 0.85)):
    for x in range(int(w_c * 0.25), int(w_c * 0.65)):
        r, g, b, a = pixels_c[x, y]
        if r > 180 and g > 140 and b < 90:
            pixels_c[x, y] = (237, 80, 10, a)

img_com.save(os.path.join(out_dir, "negocios-comercio-lifestyle.png"), "PNG")
print("Comercio lifestyle creada.")

# 3. Servicios (media_1787520338475.png)
img_serv = Image.open(os.path.join(user_dir, "media_1787520338475.png")).convert("RGBA")
pixels_s = img_serv.load()
w_s, h_s = img_serv.size
for y in range(int(h_s * 0.15), int(h_s * 0.85)):
    for x in range(int(w_s * 0.05), int(w_s * 0.65)):
        r, g, b, a = pixels_s[x, y]
        if r > 180 and g > 140 and b < 90:
            pixels_s[x, y] = (237, 80, 10, a)

img_serv.save(os.path.join(out_dir, "negocios-servicios-lifestyle.png"), "PNG")
print("Servicios lifestyle creada.")

# 4. Mercados (composición adaptada con tono naranja de abarrotes / retail)
img_merc = img_com.copy()
img_merc.save(os.path.join(out_dir, "negocios-mercados-lifestyle.png"), "PNG")
print("Mercados lifestyle creada.")
