"""Build a deterministic, static-only ZIP for hPanel extraction. Python 3.9+."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
version = json.loads((ROOT / 'package.json').read_text())['version']
for required in ['index.html', '.htaccess', 'favicon.svg']:
    if not (DIST / required).is_file():
        raise SystemExit(f'Missing dist/{required}; run npm run build first')
files = sorted(p for p in DIST.rglob('*') if p.is_file())
if not any(p.suffix == '.js' and p.parent.name == 'assets' for p in files):
    raise SystemExit('Production JavaScript is missing')
for path in files:
    rel = path.relative_to(DIST)
    is_entry = str(rel) in ['index.html', '.htaccess', 'favicon.svg']
    is_asset = rel.parts[0] == 'assets' and path.suffix in {'.js', '.css', '.woff', '.woff2', '.ttf', '.otf', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ogg', '.mp3', '.wav'} and not any(part.startswith('.') for part in rel.parts)
    if path.is_symlink() or not (is_entry or is_asset):
        raise SystemExit(f'Unexpected payload: {rel}')
output = ROOT / 'artifacts' / f'Gridbound-Hostinger-{version}.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        entry = ZipInfo(path.relative_to(DIST).as_posix(), (2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, path.read_bytes())
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert {'index.html', '.htaccess', 'favicon.svg'} <= set(archive.namelist())
    assert not any(n.startswith(('dist/', 'public_html/', 'node_modules/', 'src/')) for n in archive.namelist())
    for path in files:
        assert archive.read(path.relative_to(DIST).as_posix()) == path.read_bytes()
checksum = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix('.sha256').write_text(f'{checksum}  {output.name}\n')
print(json.dumps({'zip': str(output), 'files': len(files), 'bytes': output.stat().st_size, 'sha256': checksum, 'root_entry': 'index.html'}))
