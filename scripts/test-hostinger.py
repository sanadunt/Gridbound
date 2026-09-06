"""Exercise the shipped ZIP and .htaccess using an isolated local Apache instance."""
import gzip
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
HTTPD = os.environ.get('HTTPD_PATH', '/usr/sbin/httpd')
MODULES = Path(os.environ.get('APACHE_MODULE_DIR', '/usr/libexec/apache2'))
version = json.loads((ROOT / 'package.json').read_text())['version']
archive_path = ROOT / 'artifacts' / f'Gridbound-Hostinger-{version}.zip'
if not archive_path.exists():
    raise SystemExit('Run npm run package:hostinger first')

with tempfile.TemporaryDirectory(prefix='gridbound-apache-') as directory:
    tmp = Path(directory)
    www = tmp / 'www'
    www.mkdir()
    with ZipFile(archive_path) as archive:
        assert archive.testzip() is None
        assert '.htaccess' in archive.namelist()
        archive.extractall(www)
        archive.extractall(www / 'gridbound')
    modules = ['mpm_prefork', 'unixd', 'authz_core', 'authz_host', 'dir', 'autoindex', 'mime', 'headers', 'filter', 'deflate']
    for name in modules:
        if not (MODULES / f'mod_{name}.so').exists():
            raise SystemExit(f'Missing local Apache module {name}; set APACHE_MODULE_DIR')
    with socket.socket() as available:
        available.bind(('127.0.0.1', 0))
        port = available.getsockname()[1]
    loads = '\n'.join(f'LoadModule {name}_module "{MODULES / ("mod_" + name + ".so")}"' for name in modules)
    config = tmp / 'httpd.conf'
    config.write_text(f'''ServerRoot "{tmp}"
Listen 127.0.0.1:{port}
ServerName 127.0.0.1
PidFile "{tmp / 'httpd.pid'}"
ErrorLog "{tmp / 'error.log'}"
LogLevel warn
KeepAlive Off
{loads}
User #{os.getuid()}
Group #{os.getgid()}
TypesConfig "{os.environ.get('APACHE_MIME_TYPES', '/private/etc/apache2/mime.types')}"
DocumentRoot "{www}"
<Directory "{www}">
    AllowOverride All
    Require all granted
</Directory>
''')
    subprocess.run([HTTPD, '-t', '-f', str(config)], check=True)
    process = None
    try:
        process = subprocess.Popen([HTTPD, '-X', '-f', str(config)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, start_new_session=True)
        origin = f'http://127.0.0.1:{port}'
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError(process.stderr.read().decode())
            try:
                with urllib.request.urlopen(origin + '/', timeout=1) as response:
                    assert response.status == 200
                break
            except urllib.error.URLError:
                time.sleep(.1)
        else:
            raise RuntimeError('Apache not ready: ' + (tmp / 'error.log').read_text())
        js = next((www / 'assets').glob('index-*.js')).relative_to(www).as_posix()
        for prefix in ['/', '/gridbound/']:
            with urllib.request.urlopen(origin + prefix) as response:
                html = response.read()
                assert b'Ashes of the Bell' in html
                assert 'no-cache' in response.headers.get('Cache-Control', '')
                assert response.headers.get('X-Content-Type-Options') == 'nosniff'
            request = urllib.request.Request(origin + prefix + js, headers={'Accept-Encoding': 'gzip'})
            with urllib.request.urlopen(request) as response:
                assert 'immutable' in response.headers.get('Cache-Control', '')
                assert 'max-age=31536000' in response.headers['Cache-Control']
                assert 'application/javascript' in response.headers.get('Content-Type', '')
                assert response.headers.get('Content-Encoding') == 'gzip'
                assert gzip.decompress(response.read()) == (www / js).read_bytes()
            for path, status in [('.htaccess', 403), ('assets/does-not-exist.js', 404), ('assets/', 403)]:
                try:
                    urllib.request.urlopen(origin + prefix + path)
                    raise AssertionError(f'{path} must return {status}')
                except urllib.error.HTTPError as error:
                    assert error.code == status, (path, error.code)
            subprocess.run(['node', 'scripts/production-smoke.mjs'], cwd=ROOT, env={**os.environ, 'GRIDBOUND_STATIC_URL': origin + prefix}, check=True, timeout=60)
            print(f'PASS Apache {prefix}: ZIP extraction, index, gameplay, MIME, HTML revalidation, hashed cache, gzip, hidden files and directory listing', flush=True)
    except Exception:
        if (tmp / 'error.log').exists():
            print((tmp / 'error.log').read_text())
        raise
    finally:
        if process is not None and process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
        if process is not None and process.stderr is not None:
            process.stderr.close()
