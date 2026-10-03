import os
import urllib.request
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

out_dir = r"d:\Proyectos\NEGOVA\public\images"
os.makedirs(out_dir, exist_ok=True)

# URLs de fotos de alta gama para cada rubro distinto
urls = {
    "gastronomia": "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=1000&q=85", # Barista cafe counter with espresso
    "comercio": "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1000&q=85",    # Minimalist lifestyle store
    "servicios": "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1000&q=85",   # Luxury barbershop studio
    "mercados": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1000&q=85",    # Fresh gourmet grocery
}

headers = {'User-Agent': 'Mozilla/5.0'}

for key, url in urls.items():
    req = urllib.request.Request(url, headers=headers)
    temp_path = os.path.join(out_dir, f"temp_{key}.jpg")
    final_path = os.path.join(out_dir, f"negocios-{key}-lifestyle.png")
    
    try:
        with urllib.request.urlopen(req) as response, open(temp_path, 'wb') as out_file:
            out_file.write(response.read())
        
        img = Image.open(temp_path).convert("RGBA")
        w, h = img.size
        
        # Recortar a proporción 4:3 centrada
        target_ratio = 4.0 / 3.0
        current_ratio = w / float(h)
        if current_ratio > target_ratio:
            new_w = int(h * target_ratio)
            left = (w - new_w) // 2
            img = img.crop((left, 0, left + new_w, h))
        else:
            new_h = int(w / target_ratio)
            top = (h - new_h) // 2
            img = img.crop((0, top, w, top + new_h))
            
        img = img.resize((800, 600), Image.Resampling.LANCZOS)
        
        # Crear overlay gráfico con telemetría elegante de NEGOVA
        draw = ImageDraw.Draw(img)
        
        # Guardar imagen final
        img.save(final_path, "PNG", quality=95)
        print(f"Generado con éxito: {final_path}")
        
        if os.path.exists(temp_path):
            os.remove(temp_path)
    except Exception as e:
        print(f"Error procesando {key}: {e}")
