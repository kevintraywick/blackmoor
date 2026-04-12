"""
Batch-render KayKit hex GLTF assets to isometric PNG sprites via Blender CLI.

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render-hex-sprites.py

Output: public/images/hex-tiles/<category>/<name>.png  (transparent background)

For directional tiles (roads, rivers, coasts), renders 6 rotations at 60° increments:
  road_A_r0.png, road_A_r1.png, ... road_A_r5.png
"""

import bpy
import os
import sys
import math
import glob

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSET_ROOT = os.path.join(PROJECT_ROOT, "maps", "assets", "KayKit_Medieval_Hexagon_Pack_1.0_FREE", "Assets", "gltf")
TEXTURE_PATH = os.path.join(PROJECT_ROOT, "maps", "assets", "KayKit_Medieval_Hexagon_Pack_1.0_FREE", "Textures", "hexagons_medieval.png")
OUTPUT_ROOT = os.path.join(PROJECT_ROOT, "public", "images", "hex-tiles")

TILE_SIZE = 160  # px height
TILE_WIDTH = 140  # px width

CAM_ANGLE_DEG = 35
CAM_DISTANCE = 4.0

# Categories and whether they need rotation variants
CATEGORIES = {
    "tiles/base": {"rotations": 1, "prefix": "base"},
    "tiles/coast": {"rotations": 6, "prefix": "coast"},
    "tiles/rivers": {"rotations": 6, "prefix": "river"},
    "tiles/roads": {"rotations": 6, "prefix": "road"},
    "decoration/nature": {"rotations": 1, "prefix": "nature"},
    "decoration/props": {"rotations": 1, "prefix": "props"},
    "buildings/neutral": {"rotations": 1, "prefix": "building"},
}


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for collection in bpy.data.collections:
        bpy.data.collections.remove(collection)
    for mesh in bpy.data.meshes:
        bpy.data.meshes.remove(mesh)
    for mat in bpy.data.materials:
        bpy.data.materials.remove(mat)
    for img in bpy.data.images:
        bpy.data.images.remove(img)


def setup_scene():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = TILE_WIDTH
    scene.render.resolution_y = TILE_SIZE
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'

    # Lighting — single sun for clean isometric look
    bpy.ops.object.light_add(type='SUN', location=(2, -2, 5))
    sun = bpy.context.active_object
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(30))

    # Ambient light
    world = bpy.data.worlds.new("HexWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.35, 0.33, 0.3, 1.0)
    bg.inputs[1].default_value = 0.8
    scene.world = world


def setup_camera():
    cam_data = bpy.data.cameras.new("HexCam")
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 2.8

    cam_obj = bpy.data.objects.new("HexCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    azimuth = math.radians(45)
    elevation = math.radians(CAM_ANGLE_DEG)

    x = CAM_DISTANCE * math.cos(elevation) * math.sin(azimuth)
    y = -CAM_DISTANCE * math.cos(elevation) * math.cos(azimuth)
    z = CAM_DISTANCE * math.sin(elevation)

    cam_obj.location = (x, y, z)

    direction = cam_obj.location.copy()
    direction.negate()
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

    return cam_obj


def rotate_meshes(rotation_index):
    if rotation_index == 0:
        return
    angle = math.radians(60 * rotation_index)
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.rotation_euler.z += angle


def import_gltf(filepath):
    bpy.ops.import_scene.gltf(filepath=filepath)


def fix_textures():
    """Ensure all materials reference the shared palette texture."""
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                # Reload from the known texture path if image is missing
                if not os.path.exists(bpy.path.abspath(node.image.filepath)):
                    node.image.filepath = TEXTURE_PATH
                    node.image.reload()


def render_asset(gltf_path, output_path, num_rotations=1):
    results = []
    basename = os.path.splitext(os.path.basename(gltf_path))[0]

    for r in range(num_rotations):
        clear_scene()
        setup_scene()

        import_gltf(gltf_path)
        fix_textures()
        rotate_meshes(r)

        setup_camera()

        if num_rotations > 1:
            fname = f"{basename}_r{r}.png"
        else:
            fname = f"{basename}.png"

        outfile = os.path.join(output_path, fname)
        bpy.context.scene.render.filepath = outfile
        bpy.ops.render.render(write_still=True)
        results.append(outfile)
        print(f"  Rendered: {fname}")

    return results


def main():
    os.makedirs(OUTPUT_ROOT, exist_ok=True)

    total = 0
    for category, config in CATEGORIES.items():
        cat_dir = os.path.join(ASSET_ROOT, category)
        if not os.path.isdir(cat_dir):
            print(f"Skipping {category} — not found")
            continue

        out_dir = os.path.join(OUTPUT_ROOT, config["prefix"])
        os.makedirs(out_dir, exist_ok=True)

        gltf_files = sorted(glob.glob(os.path.join(cat_dir, "*.gltf")))
        # Exclude waterless subdirs
        gltf_files = [f for f in gltf_files if "/waterless/" not in f]

        print(f"\n=== {category} ({len(gltf_files)} files, {config['rotations']} rotation(s) each) ===")

        for gltf_path in gltf_files:
            name = os.path.splitext(os.path.basename(gltf_path))[0]
            print(f"Processing: {name}")
            rendered = render_asset(gltf_path, out_dir, config["rotations"])
            total += len(rendered)

    print(f"\nDone! Rendered {total} sprites to {OUTPUT_ROOT}")


if __name__ == "__main__":
    main()
