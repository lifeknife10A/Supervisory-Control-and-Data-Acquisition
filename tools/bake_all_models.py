import os
import trimesh
import numpy as np

MODELS_DIR = os.path.abspath('frontend/public/models')

def normalize_and_ground(mesh, target_scale=0.01):
    # Scale if huge (convert mm to scene units)
    ext = mesh.extents
    if max(ext) > 10.0:
        mesh.apply_scale(target_scale)
    
    # Ground at Y=0 and center X & Z
    b = mesh.bounds
    center_x = (b[0][0] + b[1][0]) / 2.0
    min_y = b[0][1]
    center_z = (b[0][2] + b[1][2]) / 2.0
    mesh.vertices -= [center_x, min_y, center_z]
    return mesh

def bake_breadboard():
    p = os.path.join(MODELS_DIR, 'breadboard.glb')
    scene = trimesh.load(p)
    mesh = list(scene.geometry.values())[0] if isinstance(scene, trimesh.Scene) else scene
    
    # Rotate 90 deg around X so 10mm thickness is along Y
    R = trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0])
    mesh.apply_transform(R)
    
    # Color vertices
    colors = np.full((len(mesh.vertices), 4), [245, 246, 250, 255], dtype=np.uint8)
    for i, (x, y, z) in enumerate(mesh.vertices):
        if y > 7.5: # top surface
            if x < -21.0: # red power rail
                colors[i] = [239, 68, 68, 255]
            elif x > 21.0: # blue ground rail
                colors[i] = [37, 99, 235, 255]
            elif abs(x) < 2.5: # center divider trough
                colors[i] = [226, 232, 240, 255]
    
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=colors)
    mesh = normalize_and_ground(mesh, 0.015)
    mesh.export(p)
    print(f"[OK] Baked breadboard.glb: extents={mesh.extents.round(3)}")

def bake_esp32():
    p = os.path.join(MODELS_DIR, 'esp32.glb')
    scene = trimesh.load(p)
    mesh = list(scene.geometry.values())[0] if isinstance(scene, trimesh.Scene) else scene
    
    # Rotate 90 deg around X so it lies flat
    R = trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0])
    mesh.apply_transform(R)
    
    # Split parts and color them
    try:
        parts = mesh.split()
        colored_scene = trimesh.Scene()
        for idx, part in enumerate(parts):
            b = part.bounds
            size = part.extents
            # PCB board is the largest flat body
            if len(part.vertices) > 2000 and size[1] < 3.0:
                # Matte dark obsidian PCB
                part.visual = trimesh.visual.ColorVisuals(mesh=part, vertex_colors=np.full((len(part.vertices), 4), [24, 24, 27, 255], dtype=np.uint8))
            elif max(size) < 16.0 and min(size) < 3.0: # pins
                part.visual = trimesh.visual.ColorVisuals(mesh=part, vertex_colors=np.full((len(part.vertices), 4), [234, 179, 8, 255], dtype=np.uint8))
            else: # Metal shield
                part.visual = trimesh.visual.ColorVisuals(mesh=part, vertex_colors=np.full((len(part.vertices), 4), [203, 213, 225, 255], dtype=np.uint8))
            colored_scene.add_geometry(part)
        
        merged = colored_scene.dump(concatenate=True)
    except Exception:
        # Fallback vertex coloring
        colors = np.full((len(mesh.vertices), 4), [24, 24, 27, 255], dtype=np.uint8)
        for i, (x, y, z) in enumerate(mesh.vertices):
            if y > 2.0: # Shield / pins
                colors[i] = [203, 213, 225, 255] if abs(z) < 12.0 else [234, 179, 8, 255]
        mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=colors)
        merged = mesh

    merged = normalize_and_ground(merged, 0.015)
    merged.export(p)
    print(f"[OK] Baked esp32.glb: extents={merged.extents.round(3)}")

def bake_hc_sr04():
    p = os.path.join(MODELS_DIR, 'hc_sr04.glb')
    scene = trimesh.load(p)
    mesh = list(scene.geometry.values())[0] if isinstance(scene, trimesh.Scene) else scene
    
    # Stand upright on pins with transducers facing +Z
    colors = np.full((len(mesh.vertices), 4), [2, 132, 199, 255], dtype=np.uint8) # Royal blue PCB
    for i, (x, y, z) in enumerate(mesh.vertices):
        # Transducer cylinders jut out in Z
        if z > 3.0:
            # Aluminum cylinder cans
            colors[i] = [226, 232, 240, 255]
            if z > 15.0 and (abs(x - 12.0) < 4.0 or abs(x + 12.0) < 4.0):
                colors[i] = [30, 41, 59, 255] # Black center mesh
        elif y < -5.0: # bottom pins
            colors[i] = [234, 179, 8, 255]
            
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=colors)
    mesh = normalize_and_ground(mesh, 0.015)
    mesh.export(p)
    print(f"[OK] Baked hc_sr04.glb: extents={mesh.extents.round(3)}")

def bake_acs712():
    p = os.path.join(MODELS_DIR, 'acs712.glb')
    scene = trimesh.load(p)
    mesh = list(scene.geometry.values())[0] if isinstance(scene, trimesh.Scene) else scene
    
    colors = np.full((len(mesh.vertices), 4), [3, 105, 161, 255], dtype=np.uint8) # Blue PCB
    for i, (x, y, z) in enumerate(mesh.vertices):
        if x < -8.0: # Green screw terminal block
            colors[i] = [22, 163, 74, 255]
            if y > 10.0: colors[i] = [226, 232, 240, 255] # Screws
        elif x > 8.0: # Header pins
            colors[i] = [234, 179, 8, 255]
        elif y > 2.0 and abs(z) < 6.0: # IC chip
            colors[i] = [24, 24, 27, 255]

    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=colors)
    mesh = normalize_and_ground(mesh, 0.015)
    mesh.export(p)
    print(f"[OK] Baked acs712.glb: extents={mesh.extents.round(3)}")

def bake_relay():
    p = os.path.join(MODELS_DIR, 'relay.glb')
    scene = trimesh.load(p)
    # Color parts of relay
    if isinstance(scene, trimesh.Scene):
        for name, geom in scene.geometry.items():
            if 'Cylinder' in name or 'Cube' in name:
                if geom.extents[1] > 1.5:
                    geom.visual = trimesh.visual.ColorVisuals(mesh=geom, vertex_colors=np.full((len(geom.vertices), 4), [29, 78, 216, 255], dtype=np.uint8)) # Songle Blue
                else:
                    geom.visual = trimesh.visual.ColorVisuals(mesh=geom, vertex_colors=np.full((len(geom.vertices), 4), [15, 23, 42, 255], dtype=np.uint8))
            else:
                geom.visual = trimesh.visual.ColorVisuals(mesh=geom, vertex_colors=np.full((len(geom.vertices), 4), [255, 255, 255, 255], dtype=np.uint8))
        mesh = scene.dump(concatenate=True)
    else:
        mesh = scene
    mesh = normalize_and_ground(mesh, 0.02)
    mesh.export(p)
    print(f"[OK] Baked relay.glb: extents={mesh.extents.round(3)}")

def bake_mq2():
    p = os.path.join(MODELS_DIR, 'mq2.glb')
    scene = trimesh.load(p)
    mesh = list(scene.geometry.values())[0] if isinstance(scene, trimesh.Scene) else scene
    
    # Rotate so dome is UP (+Y)
    R = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
    mesh.apply_transform(R)
    
    colors = np.full((len(mesh.vertices), 4), [30, 58, 138, 255], dtype=np.uint8) # Dark blue PCB
    for i, (x, y, z) in enumerate(mesh.vertices):
        if y > 10.0: # Sensor stainless dome
            colors[i] = [226, 232, 240, 255]
        elif y > 4.0: # Bakelite base
            colors[i] = [241, 245, 249, 255]
        elif y < -2.0: # Pins
            colors[i] = [234, 179, 8, 255]

    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=colors)
    mesh = normalize_and_ground(mesh, 0.015)
    mesh.export(p)
    print(f"[OK] Baked mq2.glb: extents={mesh.extents.round(3)}")

def bake_fan():
    p = os.path.join(MODELS_DIR, 'fan.glb')
    scene = trimesh.load(p)
    mesh = list(scene.geometry.values())[0] if isinstance(scene, trimesh.Scene) else scene
    
    # Dark charcoal frame & blades
    colors = np.full((len(mesh.vertices), 4), [30, 41, 59, 255], dtype=np.uint8)
    for i, (x, y, z) in enumerate(mesh.vertices):
        if abs(x) < 10.0 and abs(y) < 10.0: # Rotor hub
            colors[i] = [51, 65, 85, 255]
            
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=colors)
    mesh = normalize_and_ground(mesh, 0.015)
    mesh.export(p)
    print(f"[OK] Baked fan.glb: extents={mesh.extents.round(3)}")

def bake_pump():
    p = os.path.join(MODELS_DIR, 'pump.glb')
    scene = trimesh.load(p)
    mesh = list(scene.geometry.values())[0] if isinstance(scene, trimesh.Scene) else scene
    
    # Rotate 90 deg around X so it sits horizontally on table
    R = trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0])
    mesh.apply_transform(R)
    
    # Body is black, nozzle is white
    colors = np.full((len(mesh.vertices), 4), [15, 23, 42, 255], dtype=np.uint8)
    for i, (x, y, z) in enumerate(mesh.vertices):
        if y > 20.0: # Outlet nozzle
            colors[i] = [248, 250, 252, 255]
            
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=colors)
    mesh = normalize_and_ground(mesh, 0.015)
    mesh.export(p)
    print(f"[OK] Baked pump.glb: extents={mesh.extents.round(3)}")

def bake_ds18b20():
    p = os.path.join(MODELS_DIR, 'ds18b20.glb')
    scene = trimesh.load(p)
    mesh = list(scene.geometry.values())[0] if isinstance(scene, trimesh.Scene) else scene
    
    colors = np.full((len(mesh.vertices), 4), [203, 213, 225, 255], dtype=np.uint8) # Polished steel
    for i, (x, y, z) in enumerate(mesh.vertices):
        if y < 4.0: # Cable shrink
            colors[i] = [15, 23, 42, 255]
            
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=colors)
    mesh = normalize_and_ground(mesh, 0.018)
    mesh.export(p)
    print(f"[OK] Baked ds18b20.glb: extents={mesh.extents.round(3)}")

def bake_leds():
    # Red LED
    p_red = os.path.join(MODELS_DIR, 'led_red.glb')
    s_red = trimesh.load(p_red)
    m_red = list(s_red.geometry.values())[0] if isinstance(s_red, trimesh.Scene) else s_red
    c_red = np.full((len(m_red.vertices), 4), [220, 38, 38, 240], dtype=np.uint8)
    for i, (x, y, z) in enumerate(m_red.vertices):
        if y < -4.0: c_red[i] = [203, 213, 225, 255] # Silver leads
    m_red.visual = trimesh.visual.ColorVisuals(mesh=m_red, vertex_colors=c_red)
    m_red = normalize_and_ground(m_red, 0.015)
    m_red.export(p_red)

    # Green LED
    p_grn = os.path.join(MODELS_DIR, 'led_green.glb')
    s_grn = trimesh.load(p_grn)
    m_grn = list(s_grn.geometry.values())[0] if isinstance(s_grn, trimesh.Scene) else s_grn
    c_grn = np.full((len(m_grn.vertices), 4), [22, 163, 74, 240], dtype=np.uint8)
    for i, (x, y, z) in enumerate(m_grn.vertices):
        if y < -4.0: c_grn[i] = [203, 213, 225, 255] # Silver leads
    m_grn.visual = trimesh.visual.ColorVisuals(mesh=m_grn, vertex_colors=c_grn)
    m_grn = normalize_and_ground(m_grn, 0.015)
    m_grn.export(p_grn)
    print(f"[OK] Baked LEDs (Red & Green)")

def bake_resistor():
    p = os.path.join(MODELS_DIR, 'resistor.glb')
    scene = trimesh.load(p)
    mesh = list(scene.geometry.values())[0] if isinstance(scene, trimesh.Scene) else scene
    
    # Tan body [254, 215, 170] + red bands + silver leads
    colors = np.full((len(mesh.vertices), 4), [254, 215, 170, 255], dtype=np.uint8)
    for i, (x, y, z) in enumerate(mesh.vertices):
        if abs(x) > 3.5: # Leads
            colors[i] = [203, 213, 225, 255]
        elif abs(x) < 1.0: # Red center band
            colors[i] = [220, 38, 38, 255]
            
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=colors)
    mesh = normalize_and_ground(mesh, 0.018)
    mesh.export(p)
    print(f"[OK] Baked resistor.glb: extents={mesh.extents.round(3)}")

def bake_lcd():
    p = os.path.join(MODELS_DIR, 'lcd_1602.glb')
    scene = trimesh.load(p)
    if isinstance(scene, trimesh.Scene):
        for name, geom in scene.geometry.items():
            if 'Text' in name:
                # Text / frame / bezel
                geom.visual = trimesh.visual.ColorVisuals(mesh=geom, vertex_colors=np.full((len(geom.vertices), 4), [30, 41, 59, 255], dtype=np.uint8))
            else:
                geom.visual = trimesh.visual.ColorVisuals(mesh=geom, vertex_colors=np.full((len(geom.vertices), 4), [21, 128, 61, 255], dtype=np.uint8)) # Green PCB
        mesh = scene.dump(concatenate=True)
    else:
        mesh = scene
    mesh = normalize_and_ground(mesh, 0.015)
    mesh.export(p)
    print(f"[OK] Baked lcd_1602.glb: extents={mesh.extents.round(3)}")

if __name__ == '__main__':
    print("=== BAKING REALISTIC MATERIALS & ROTATIONS DIRECTLY INTO 3D GLB FILES ===")
    bake_breadboard()
    bake_esp32()
    bake_hc_sr04()
    bake_acs712()
    bake_relay()
    bake_mq2()
    bake_fan()
    bake_pump()
    bake_ds18b20()
    bake_leds()
    bake_resistor()
    bake_lcd()
    print("=== ALL 13 MODELS PERMANENTLY COLORED & ORIENTED AT 3D LEVEL! ===")
