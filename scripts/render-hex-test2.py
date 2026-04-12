"""Test: render grass, water, road_A (2 rotations), and mountain_A to check variety."""

import bpy
import os
import math

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLTF_ROOT = os.path.join(PROJECT_ROOT, "maps", "assets", "KayKit_Medieval_Hexagon_Pack_1.0_FREE", "Assets", "gltf")
TEXTURE_PATH = os.path.join(PROJECT_ROOT, "maps", "assets", "KayKit_Medieval_Hexagon_Pack_1.0_FREE", "Textures", "hexagons_medieval.png")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "public", "images", "hex-tiles")

TESTS = [
    ("tiles/base/hex_water.gltf", "test_water.png", 0),
    ("tiles/roads/hex_road_A.gltf", "test_road_A_r0.png", 0),
    ("tiles/roads/hex_road_A.gltf", "test_road_A_r1.png", 1),
    ("tiles/coast/hex_coast_A.gltf", "test_coast_A.png", 0),
    ("decoration/nature/mountain_A_grass_trees.gltf", "test_mountain.png", 0),
    ("decoration/nature/trees_A_large.gltf", "test_trees.png", 0),
    ("buildings/neutral/building_bridge_A.gltf", "test_bridge.png", 0),
]

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for m in bpy.data.meshes: bpy.data.meshes.remove(m)
    for m in bpy.data.materials: bpy.data.materials.remove(m)
    for i in bpy.data.images: bpy.data.images.remove(i)
    for c in bpy.data.collections: bpy.data.collections.remove(c)

def render_one(gltf_rel, outname, rot_idx):
    clear()
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 140
    scene.render.resolution_y = 160
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'

    # Sun
    bpy.ops.object.light_add(type='SUN', location=(2, -2, 5))
    sun = bpy.context.active_object
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(30))

    # Ambient
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.35, 0.33, 0.3, 1.0)
    bg.inputs[1].default_value = 0.8
    scene.world = world

    # Import
    gltf_path = os.path.join(GLTF_ROOT, gltf_rel)
    bpy.ops.import_scene.gltf(filepath=gltf_path)

    # Fix textures
    for mat in bpy.data.materials:
        if not mat.use_nodes: continue
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                if not os.path.exists(bpy.path.abspath(node.image.filepath)):
                    node.image.filepath = TEXTURE_PATH
                    node.image.reload()

    # Rotate the imported objects around Z for directional variants
    if rot_idx > 0:
        angle = math.radians(60 * rot_idx)
        for obj in bpy.context.scene.objects:
            if obj.type == 'MESH':
                obj.rotation_euler.z += angle

    # Camera
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.8  # slightly wider to fit decorations
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    dist = 4.0
    elev = math.radians(35)
    azim = math.radians(45)
    cam.location = (
        dist * math.cos(elev) * math.sin(azim),
        -dist * math.cos(elev) * math.cos(azim),
        dist * math.sin(elev),
    )
    direction = cam.location.copy()
    direction.negate()
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    outfile = os.path.join(OUTPUT_DIR, outname)
    scene.render.filepath = outfile
    bpy.ops.render.render(write_still=True)
    print(f"Rendered: {outname}")

for gltf_rel, outname, rot_idx in TESTS:
    render_one(gltf_rel, outname, rot_idx)

print("All test renders complete!")
