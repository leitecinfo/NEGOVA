import os
from PIL import Image, ImageDraw, ImageFont

user_dir = r"C:\Users\leine\.gemini\antigravity-ide\brain\cf2ddb01-509b-4000-879b-f6b54ff4798a\.user_uploaded"
out_dir = r"d:\Proyectos\NEGOVA\public\images"
os.makedirs(out_dir, exist_ok=True)

img_gasto = Image.open(os.path.join(user_dir, "media_1787520341897.png")).convert("RGB")
draw = ImageDraw.Draw(img_gasto)

# Coordenadas aproximadas de la pantalla de la tablet en media_1787520341897.png
# Dibujamos la interfaz de NEGOVA sobre el área de la pantalla
# Marca Treinta en la esquina superior izquierda de la pantalla
# Creamos parche con el logo NEGOVA Naranja #ED500A
w, h = img_gasto.size

# Reemplazamos la marca Treinta superior por la barra NEGOVA
# Tonalidad naranja #ED500A
draw.rectangle([int(w * 0.16), int(h * 0.36), int(w * 0.28), int(h * 0.40)], fill=(237, 80, 10))
draw.text((int(w * 0.17), int(h * 0.37)), "NEGOVA", fill=(255, 255, 255))

img_gasto.save(os.path.join(out_dir, "negocios-gastronomia-lifestyle.png"), "PNG")
print("Imagen de Gastronomía procesada con marca NEGOVA.")
