"""Build a deterministic, validated ZIP of dist/ for an itch.io HTML5 upload. Python 3.9+.

itch.io extracts the ZIP and loads index.html from its root inside an <iframe> on another origin, under a per-upload path,
so the bundle must be relative-only, self-contained (no fetches to other hosts) and inside itch's limits (fewer than 1000
files, well under 500 MB, case-sensitive names). The Apache .htaccess that Hostinger needs is left out, like every dotfile.
"""
import hashlib
import json
import re
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
MAX_FILES = 999  # itch.io refuses an HTML upload with 1000 files or more
MAX_BYTES = 64 * 1024 * 1024  # extracted size; itch allows 500 MB, our bundle is a few MB, so anything near this is a mistake
ASSET_TYPES = {'.js', '.css', '.woff', '.woff2', '.ttf', '.otf', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ogg', '.mp3', '.wav'}
SKIPPED = {'.htaccess'}  # Apache config for the Hostinger ZIP; itch serves its own headers
# Host names that appear in the bundle as inert strings, never fetched: XML namespaces and Phaser's banner/gameURL metadata.
INERT_HOSTS = {'www.w3.org', 'phaser.io'}
HOST = re.compile(r'(?:(?:https?|wss?):)?//((?:[a-z0-9-]+\.)+[a-z]{2,})(?![a-z0-9-])', re.I)
DATA_URI = re.compile(r'data:[^"\'`)\s]*', re.I)
HTML_REF = re.compile(r'\b(?:src|href)\s*=\s*["\']([^"\']*)["\']', re.I)
CSS_REF = re.compile(r'url\(\s*["\']?([^"\')]+?)["\']?\s*\)', re.I)
FORBIDDEN_JS = {'serviceWorker.register': 'a service worker', 'sourceMappingURL': 'a source map reference', 'importScripts("/': 'an absolute worker import'}
ABSOLUTE_JS = re.compile(r'(?:import\(|from|new URL\()\s*["\']/(?!/)')
version = json.loads((ROOT / 'package.json').read_text())['version']


def fail(message):
    raise SystemExit(f'itch package: {message}')


for required in ['index.html', 'favicon.svg']:
    if not (DIST / required).is_file():
        fail(f'missing dist/{required}; run npm run build first')
found = sorted(p for p in DIST.rglob('*') if p.is_file() or p.is_symlink())
files = []
for path in found:
    rel = path.relative_to(DIST)
    if str(rel) in SKIPPED:
        continue
    is_entry = str(rel) in ['index.html', 'favicon.svg']
    is_asset = len(rel.parts) == 2 and rel.parts[0] == 'assets' and path.suffix in ASSET_TYPES and not rel.name.startswith('.')
    if path.is_symlink() or not (is_entry or is_asset):
        fail(f'Unexpected payload: {rel}')
    files.append(path)
names = [path.relative_to(DIST).as_posix() for path in files]
if not any(n.startswith('assets/') and n.endswith('.js') for n in names):
    fail('production JavaScript is missing')
if len(files) > MAX_FILES:
    fail(f'{len(files)} files; itch.io accepts fewer than 1000')
extracted = sum(path.stat().st_size for path in files)
if extracted > MAX_BYTES:
    fail(f'{extracted} bytes extracted; expected under {MAX_BYTES}')
lower = {}
for name in names:
    if name.lower() in lower:
        fail(f'{name} and {lower[name.lower()]} differ only by case')
    lower[name.lower()] = name
present = set(names)


def local_ref(ref, base, source):
    """A reference must be relative (./x or x), stay inside the bundle and name a file that exists with that exact case."""
    if ref.startswith('data:') or ref.startswith('#'):
        return
    if re.match(r'^[a-z][a-z0-9+.-]*:', ref, re.I) or ref.startswith('/'):
        fail(f'{source} references {ref}; itch serves the game from a nested path on another origin, so only relative URLs work')
    target = (PurePosixPath(base) / ref.split('#')[0].split('?')[0]).as_posix()
    parts = []
    for part in target.split('/'):
        if part in ('', '.'):
            continue
        if part == '..':
            if not parts:
                fail(f'{source} references {ref} outside the bundle')
            parts.pop()
        else:
            parts.append(part)
    if '/'.join(parts) not in present:
        fail(f'{source} references {ref}, which is not in the bundle (names are case-sensitive on itch.io)')


def hosts(text):
    return {m.group(1).lower() for m in HOST.finditer(DATA_URI.sub('', text))}


external = set()
index = (DIST / 'index.html').read_text(encoding='utf-8')
refs = HTML_REF.findall(index)
for ref in refs:
    local_ref(ref, '', 'index.html')
if not any(r.startswith('./assets/') and r.endswith('.js') for r in refs):
    fail('index.html does not load ./assets/*.js')
if re.search(r'<base\b', index, re.I):
    fail('index.html sets <base>, which would break relative URLs')
external |= hosts(index)
for path, name in zip(files, names):
    if path.suffix == '.css':
        text = path.read_text(encoding='utf-8')
        for ref in CSS_REF.findall(text):
            local_ref(ref.strip(), str(PurePosixPath(name).parent), name)
        if 'sourceMappingURL' in text:
            fail(f'{name} contains a source map reference (sourceMappingURL)')
        external |= hosts(text)
    elif path.suffix == '.js':
        text = path.read_text(encoding='utf-8')
        for needle, what in FORBIDDEN_JS.items():
            if needle in text:
                fail(f'{name} contains {what} ({needle})')
        if ABSOLUTE_JS.search(text):
            fail(f'{name} imports an absolute path; itch serves the game from a nested path')
        external |= hosts(text)
unknown = sorted(external - INERT_HOSTS)
if unknown:
    fail(f'external hosts in the bundle: {", ".join(unknown)}; the game must stay offline and self-contained (add a host to INERT_HOSTS only when it is a string that is never fetched)')

output = ROOT / 'artifacts' / f'Gridbound-itch-{version}.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path, name in zip(files, names):
        entry = ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, path.read_bytes())
with ZipFile(output) as archive:
    assert archive.testzip() is None
    listed = archive.namelist()
    assert listed == names, 'ZIP entries differ from the validated file list'
    assert 'index.html' in listed and 'favicon.svg' in listed
    assert not any(PurePosixPath(n).name.startswith('.') for n in listed), 'dotfile in the ZIP'
    assert not any(n.startswith(('/', 'dist/', 'public_html/', 'node_modules/', 'src/')) or '..' in n.split('/') for n in listed)
    for path, name in zip(files, names):
        assert archive.read(name) == path.read_bytes()
checksum = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix('.sha256').write_text(f'{checksum}  {output.name}\n')
print(json.dumps({'zip': str(output), 'version': version, 'files': len(files), 'bytes': output.stat().st_size, 'extracted_bytes': extracted, 'sha256': checksum, 'root_entry': 'index.html', 'inert_hosts': sorted(external)}))
