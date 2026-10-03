from PIL import Image
import os

def make_transparent(img_path, output_path, target_color=(255, 255, 255), tolerance=20):
    """
    Convierte un color específico (por defecto blanco) en transparente.
    """
    if not os.path.exists(img_path):
        print(f"[-] No se encontro el archivo: {img_path}")
        return

    print(f"[...] Procesando: {os.path.basename(img_path)}...")
    img = Image.open(img_path).convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    for item in datas:
        # item es una tupla (R, G, B, A)
        # Comprobar si el pixel está dentro de la tolerancia del color objetivo (ej: blanco)
        is_target = all(abs(item[i] - target_color[i]) <= tolerance for i in range(3))
        
        if is_target:
            # Reemplazar por pixel transparente
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"[+] Guardado en: {output_path}")

def main():
    # Obtener el directorio public
    current_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(current_dir, "../public")
    
    # Rutas de entrada
    imagotipo_in = os.path.join(public_dir, "imagotipo.png")
    isotipo_in = os.path.join(public_dir, "isotipo.png")
    
    # Rutas de salida transparentes
    imagotipo_out = os.path.join(public_dir, "imagotipo_transparente.png")
    isotipo_out = os.path.join(public_dir, "isotipo_transparente.png")
    
    # 1. Procesar el Imagotipo (Remover el fondo blanco para que se fusione en fondos grises/claros)
    make_transparent(imagotipo_in, imagotipo_out, target_color=(255, 255, 255), tolerance=25)
    
    # 2. Procesar el Isotipo (Remover el fondo blanco que rodea a la caja negra redondeada)
    make_transparent(isotipo_in, isotipo_out, target_color=(255, 255, 255), tolerance=25)

if __name__ == "__main__":
    main()
