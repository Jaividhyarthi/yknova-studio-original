"""Development-only demo catalog. Usage: python seed_demo.py [--remove]
Creates clearly labelled DEMO products (is_demo=1). Never run against production."""
import sys, io, zipfile, uuid, json, hashlib
from pathlib import Path
import server
from storage import put_object

DEMO = [
    ('Solviq', 'solviq', 'Landing Pages', 'Product landing template', 129900, ['React', 'Tailwind CSS'], 'React'),
    ('Petrafolio', 'petrafolio', 'Portfolios', 'Creative portfolio template', 129900, ['HTML', 'CSS', 'JavaScript'], 'Vanilla'),
    ('Axis', 'axis', 'Dashboards', 'SaaS dashboard template', 149900, ['React', 'Recharts', 'Tailwind CSS'], 'React'),
    ('Atelier', 'atelier', 'Business', 'Creative agency template', 99900, ['HTML', 'CSS', 'JavaScript'], 'Vanilla'),
    ('Canvas', 'canvas', 'Business', 'Business website template', 89900, ['Next.js', 'Tailwind CSS'], 'Next.js'),
    ('Meridian', 'meridian', 'SaaS', 'Multi-purpose SaaS template', 0, ['HTML', 'CSS'], 'Vanilla'),
]


def run():
    server.init()
    with server.conn() as c:
        if '--remove' in sys.argv:
            for p in server.rows(c, 'SELECT id FROM products WHERE is_demo=1'):
                if not server.one(c, 'SELECT order_id FROM order_items WHERE product_id=?', (p['id'],)):
                    c.execute('DELETE FROM products WHERE id=?', (p['id'],))
                else:
                    c.execute("UPDATE products SET status='archived' WHERE id=?", (p['id'],))
            print('Demo products removed/archived'); return
        for title, img, cat, short, price, tech, fw in DEMO:
            slug = 'demo-' + img
            if server.one(c, 'SELECT id FROM products WHERE slug=?', (slug,)): continue
            data = (Path(__file__).parent / 'demo_assets' / f'{img}.webp').read_bytes()
            ikey = put_object(f'yknova/images/{uuid.uuid4().hex}.webp', data, 'image/webp')['path']
            c.execute('INSERT INTO uploads VALUES(?,?,?,?,?,?,?)', (ikey, 'image', f'{img}.webp', len(data), hashlib.sha256(data).hexdigest(), None, server.now()))
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, 'w') as z:
                z.writestr(f'{img}/index.html', f'<!doctype html><title>{title} (demo)</title><h1>{title} — demo package</h1>')
                z.writestr(f'{img}/README.md', f'# {title}\nDemo package for development testing only.')
            zdata = buf.getvalue()
            zkey = put_object(f'yknova/packages/{uuid.uuid4().hex}.zip', zdata, 'application/zip')['path']
            c.execute('INSERT INTO uploads VALUES(?,?,?,?,?,?,?)', (zkey, 'package', f'{img}-demo.zip', len(zdata), hashlib.sha256(zdata).hexdigest(), None, server.now()))
            pid = uuid.uuid4().hex
            lic = [{'id': 'personal', 'name': 'Personal License', 'price': price}, {'id': 'commercial', 'name': 'Commercial License', 'price': int(price * 1.6)}] if price else [{'id': 'standard', 'name': 'Free License', 'price': 0}]
            specs = {'framework': fw, 'responsive': True, 'included_files': 'HTML, CSS, JS, README', 'browser_compat': 'Latest Chrome, Firefox, Safari, Edge', 'documentation': 'README included', 'dependencies': 'None', 'installation': 'Unzip the package and open index.html, or run the included dev server.'}
            c.execute('''INSERT INTO products(id,title,slug,category,description,price,license,preview,package,status,tags,created_at,short_description,featured,new_release,tech_stack,licenses,gallery,version,specs,changelog,updated_at,published_at,is_demo)
                VALUES(?,?,?,?,?,?,?,?,?,'published',?,?,?,?,?,?,?,?,?,?,?,?,?,1)''',
                      (pid, title, slug, cat, f'**Demo listing.** {short} used to preview the storefront during development. This is not a real product.\n\n- Responsive layout\n- Editable source files\n- Clean, documented code', price, lic[0]['name'], ikey, zkey,
                       'demo,' + cat.lower(), server.now(), short, int(img in ('solviq', 'petrafolio', 'axis')), int(img in ('solviq', 'canvas')), ','.join(tech), json.dumps(lic), json.dumps([ikey]), '1.0.0', json.dumps(specs),
                       json.dumps([{'version': '1.0.0', 'date': server.now()[:10], 'notes': 'Initial release'}]), server.now(), server.now()))
            c.execute('INSERT INTO product_files VALUES(?,?,?,?,?,?,?,?)', (uuid.uuid4().hex, pid, '1.0.0', zkey, f'{img}-demo.zip', len(zdata), hashlib.sha256(zdata).hexdigest(), server.now()))
        print('Demo catalog ready')


if __name__ == '__main__':
    run()
