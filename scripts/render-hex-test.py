"""Quick test: render one hex_grass tile to verify camera angle and output."""

import bpy
import os
import sys
import math

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLTF_PATH = os.path.join(PROJECT_ROOT, "maps", "assets", "KayKit_Medieval_Hexagon_Pack_1.0_FREE", "Assets", "gltf", "tiles", "base", "hex_grass.gltf")
TEXTURE_PATH = os.path.join(PROJECT_ROOT, "maps", "assets", "KayKit_Medieval_Hexagon_Pack_1.0_FREE", "Textures", "hexagons_medieval.png")
OUTPUT = os.path.join(PROJECT_ROOT, "public", "images", "hex-tiles", "test_grass.png")

# Clear
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for m in bpy.data.meshes: bpy.data.meshes.remove(m)
for m in bpy.data.materials: bpy.data.materials.remove(m)
for i in bpy.data.images: bpy.data.images.remove(i)

# Scene
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 120
scene.render.resolution_y = 140
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

# Sun
bpy.ops.object.light_add(type='SUN', location=(2, -2, 5))
sun = bpy.context.active_object
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(30))

# Ambient
world = bpy.data.worlds.new("HexWorld")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.35, 0.33, 0.3, 1.0)
bg.inputs[1].default_value = 0.8
scene.world = world

# Import
bpy.ops.import_scene.gltf(filepath=GLTF_PATH)

# Fix textures
for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image:
            if not os.path.exists(bpy.path.abspath(node.image.filepath)):
                node.image.filepath = TEXTURE_PATH
                node.image.reload()

# Camera
cam_data = bpy.data.cameras.new("HexCam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 2.4
cam_obj = bpy.data.objects.new("HexCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
scene.camera = cam_obj

dist = 3.5
elev = math.radians(30)
azim = math.radians(45)
cam_obj.location = (
    dist * math.cos(elev) * math.sin(azim),
    -dist * math.cos(elev) * math.cos(azim),
    dist * math.sin(elev),
)
direction = cam_obj.location.copy()
direction.negate()
rot_quat = direction.to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()

# Render
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
scene.render.filepath = OUTPUT
bpy.ops.render.render(write_still=True)
print(f"Test rendered to: {OUTPUT}")
