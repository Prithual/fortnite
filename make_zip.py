import os
import zipfile

target_zip = os.path.join(os.path.dirname(__file__), 'FORTNITE_GAME.zip')
workspace = os.path.dirname(__file__)

include_files = ['index.html', 'package.json', 'server.js', 'vite.config.js', 'README.md']
include_dirs = ['src', 'dist']

with zipfile.ZipFile(target_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
    for fname in include_files:
        fpath = os.path.join(workspace, fname)
        if os.path.exists(fpath):
            zf.write(fpath, arcname=fname)
            print(f"Added {fname}")

    for dname in include_dirs:
        dpath = os.path.join(workspace, dname)
        if os.path.exists(dpath):
            for root, dirs, files in os.walk(dpath):
                for file in files:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, workspace)
                    zf.write(full_path, arcname=rel_path)
                    print(f"Added {rel_path}")

print(f"\nSUCCESS! ZIP Archive created at: {target_zip}")
print(f"Size: {os.path.getsize(target_zip):,} bytes")
