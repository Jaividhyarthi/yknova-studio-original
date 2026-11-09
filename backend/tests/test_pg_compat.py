import os
import sys
import types
import unittest

# Unit-test SQL translations without requiring a live Neon connection.
try:
    import psycopg
except ImportError:
    sys.modules['psycopg'] = types.ModuleType('psycopg')
try:
    from pg_compat import translate, _row_factory
except ModuleNotFoundError:
    from backend.pg_compat import translate, _row_factory

class CompatTests(unittest.TestCase):
    def test_parameters(self):
        self.assertEqual(translate('SELECT * FROM users WHERE id=?'), 'SELECT * FROM users WHERE id=%s')
    def test_ignore(self):
        self.assertEqual(translate('INSERT OR IGNORE INTO wishlist VALUES(?,?)'),
                         'INSERT INTO wishlist VALUES(%s,%s) ON CONFLICT DO NOTHING')
    def test_replace_settings(self):
        self.assertIn('ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value',
                      translate('INSERT OR REPLACE INTO settings VALUES(?,?)'))
    def test_replace_reviews(self):
        self.assertIn('ON CONFLICT (user_id,product_id) DO UPDATE',
                      translate('INSERT OR REPLACE INTO reviews VALUES(?,?,?,?,?,?)'))
    def test_published(self):
        self.assertIn("='published'", translate('UPDATE products SET published_at=CASE WHEN ?="published" THEN ? END'))
    def test_row(self):
        row = _row_factory(types.SimpleNamespace(description=[types.SimpleNamespace(name='a'),types.SimpleNamespace(name='b')]))([3, 4])
        self.assertEqual(row[0],3)
        self.assertEqual(row['b'],4)
        self.assertEqual(dict(row),{'a':3,'b':4})

if __name__ == '__main__': unittest.main()
