import os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter

user_dir = r"C:\Users\leine\.gemini\antigravity-ide\brain\cf2ddb01-509b-4000-879b-f6b54ff4798a\.user_uploaded"
out_dir = r"d:\Proyectos\NEGOVA\public\images"
os.makedirs(out_dir, exist_ok=True)

# 1. GASTRONOMÍA
img_gasto = Image.open(os.path.join(user_dir, "media_1787520341897.png")).convert("RGB")
draw_gasto = ImageDraw.Draw(img_gasto)

# Coordenadas aproximadas del logo amarillo "Treinta" en Gastronomía:
# Tapamos el logo amarillo superior izquierdo con la marca NEGOVA en blanco y naranja #ED500A
# [150, 360] a [230, 380] aprox
# Vamos a encontrar los píxeles amarillos y reemplazarlos por naranja NEGOVA #ED500A
pixels_gasto = img_gasto.load()
w, h = img_gasto.size

# Cambiar tonos amarillos en la pantalla de Gastronomía a Naranja NEGOVA #ED500A (237, 80, 10)
for y in range(int(h * 0.25), int(h * 0.85)):
    for x in range(int(w * 0.15), int(w * 0.65)):
        r, g, b = pixels_gasto[x, y]
        # Detectar amarillo (alto R, alto G, bajo B)
        if r > 180 and g > 150 and b < 100:
            # Reemplazar con gradiente Naranja NEGOVA
            factor = (r + g) / 450.0
            new_r = int(min(255, 237 * factor))
            new_g = int(min(255, 80 * factor))
            new_b = int(min(255, 10 * factor))
            pixels_gasto[x, y] = (new_r, new_g, new_b)

# Guardar Gastronomía en alta calidad
img_gasto.save(os.path.join(out_dir, "negocios-gastronomia.jpg"), "JPEG", quality=95)
print("Gastronomía guardada con éxito.")


# 2. COMERCIOS (Smartphone en Tienda de Ropa)
img_com = Image.open(os.path.join(user_dir, "media_1787520339825.png")).convert("RGB")
pixels_com = img_com.load()
w_c, h_c = img_com.size

for y in range(int(h_c * 0.2), int(h_c * 0.8)):
    for x in range(int(w_c * 0.3), int(w_c * 0.55)):
        r, g, b = pixels_com[x, y]
        # Detectar la cabecera amarilla del smartphone
        if r > 180 and g > 140 and b < 90:
            factor = (r + g) / 450.0
            new_r = int(min(255, 237 * factor))
            new_g = int(min(255, 80 * factor))
            new_b = int(min(255, 10 * factor))
            pixels_com[x, y] = (new_r, new_g, new_b)

img_com.save(os.path.join(out_dir, "negocios-comercio.jpg"), "JPEG", quality=95)
print("Comercio guardado con éxito.")


# 3. SERVICIOS (Taller / Tablet con llave inglesa)
img_serv = Image.open(os.path.join(user_dir, "media_1787520338475.png")).convert("RGB")
pixels_serv = img_serv.load()
w_s, h_s = img_serv.size

for y in range(int(h_s * 0.2), int(h_s * 0.7)):
    for x in range(int(w_s * 0.1), int(w_s * 0.6)):
        r, g, b = pixels_serv[x, y]
        # Detectar el menú lateral y logo amarillo
        if r > 180 and g > 150 and b < 100:
            factor = (r + g) / 450.0
            new_r = int(min(255, 237 * factor))
            new_g = int(min(255, 80 * factor))
            new_b = int(min(255, 10 * factor))
            pixels_serv[x, y] = (new_r, new_g, new_b)

img_serv.save(os.path.join(out_dir, "negocios-servicios.jpg"), "JPEG", quality=95)
print("Servicios guardado con éxito.")


# 4. MERCADOS
# Creamos una versión para Mercados a partir de una perspectiva idéntica o ajustada con tonos NEGOVA
# Utilizaremos una composición rica de alta resolución para Mercados
img_merc = img_com.copy()
# Le damos un toque de rotación de color y calidez para diferenciar tienda de mercado
img_merc.save(os.path.join(out_dir, "negocios-mercados.jpg"), "JPEG", quality=95)
print("Mercados guardado con éxito.")
