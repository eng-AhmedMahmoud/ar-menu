"""
Blender-side converter: takes any mesh Hunyuan/Meshy produced and emits the two
files the AR page needs — a decimated .glb (Android Scene Viewer / WebXR) and a
.usdz (iOS Quick Look).

Run via:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
      --python scripts/convert.py -- <input> <slug> [max_faces]

Kept as a separate Blender script because Quick Look needs real USD export and
Blender is the only converter installed on this machine.
"""
import bpy, sys, math, os

argv = sys.argv[sys.argv.index("--") + 1:]
src, slug = argv[0], argv[1]
MAX_FACES = int(argv[2]) if len(argv) > 2 else 150_000
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "models")

bpy.ops.wm.read_factory_settings(use_empty=True)

ext = os.path.splitext(src)[1].lower()
if ext == ".obj":
    bpy.ops.wm.obj_import(filepath=src)
elif ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=src)
else:
    raise SystemExit(f"unsupported input: {ext}")

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit("no mesh in input")

total = sum(len(o.data.polygons) for o in meshes)
print(f"[convert] imported {len(meshes)} mesh(es), {total} faces")

# Phones choke well before a million faces; decimate only when over budget so a
# already-light mesh is left untouched.
if total > MAX_FACES:
    ratio = MAX_FACES / total
    for o in meshes:
        mod = o.modifiers.new("decimate", "DECIMATE")
        mod.ratio = ratio
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    total = sum(len(o.data.polygons) for o in meshes)
    print(f"[convert] decimated to {total} faces (ratio {ratio:.4f})")

# Up-axis varies by provider: Meshy exports Z-up, Hunyuan's Space already
# returns Y-up. Rotating blindly tips an already-upright dish onto its side, so
# infer it — for a plated dish the shortest bounding-box axis is the vertical.
coords = [(o.matrix_world @ v.co) for o in meshes for v in o.data.vertices]
extent = [max(c[i] for c in coords) - min(c[i] for c in coords) for i in range(3)]
up_axis = extent.index(min(extent))
print(f"[convert] extents {[round(e, 3) for e in extent]} -> up axis {'XYZ'[up_axis]}")
if up_axis == 1:
    # Y is thinnest: mesh is Y-up (glTF convention), Blender wants Z-up.
    for o in meshes:
        o.rotation_euler[0] = math.radians(90)

bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

# Drop the model onto y=0 and scale so the dish reads at a believable ~30cm.
minz = min((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
maxx = max((o.matrix_world @ v.co).x for o in meshes for v in o.data.vertices)
minx = min((o.matrix_world @ v.co).x for o in meshes for v in o.data.vertices)
width = maxx - minx
scale = 0.30 / width if width else 1.0
for o in meshes:
    o.location.z -= minz
    o.scale = (scale, scale, scale)
bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
print(f"[convert] scaled x{scale:.4f} -> {width * scale:.3f}m wide")

# Quick Look renders a mesh with no bound material as magenta diagonal stripes —
# its "missing material" placeholder. An untextured mesh therefore needs a real
# UsdPreviewSurface attached or iOS shows the error pattern instead of the dish.
for o in meshes:
    if not o.data.materials:
        mat = bpy.data.materials.new(f"{slug}_fallback")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.82, 0.71, 0.52, 1.0)
            bsdf.inputs["Roughness"].default_value = 0.65
            if "Metallic" in bsdf.inputs:
                bsdf.inputs["Metallic"].default_value = 0.0
        o.data.materials.append(mat)
        print(f"[convert] {o.name}: no material, attached fallback surface")

glb = os.path.join(OUT, f"{slug}.glb")
usdz = os.path.join(OUT, f"{slug}.usdz")

bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", export_apply=True)
print(f"[convert] wrote {glb}")

# Blender 5 renamed the texture flag; "NEW" writes copies of the images, which
# the .usdz extension then packs into the archive Quick Look expects.
bpy.ops.wm.usd_export(
    filepath=usdz,
    export_materials=True,
    export_textures_mode="NEW",
    relative_paths=False,
    root_prim_path="/root",
)
print(f"[convert] wrote {usdz}")
