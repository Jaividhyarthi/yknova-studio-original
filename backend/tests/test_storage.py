"""Local storage smoke and object-path security tests (no R2 credentials needed)."""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / 'storage.py'


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ['OBJECT_STORAGE_DIR'] = self.tmp.name
        for name in ('R2_ENDPOINT_URL', 'R2_BUCKET', 'R2_ACCESS_KEY_ID',
                     'R2_SECRET_ACCESS_KEY', 'REQUIRE_R2'):
            os.environ.pop(name, None)
        spec = importlib.util.spec_from_file_location('test_local_storage', MODULE_PATH)
        self.mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.mod)

    def tearDown(self):
        self.tmp.cleanup()

    def test_put_get(self):
        self.mod.put_object('yknova/packages/a.zip', b'zip content', 'application/zip')
        self.assertEqual(self.mod.get_object('yknova/packages/a.zip')[0], b'zip content')

    def test_prevent_traversal(self):
        for key in ('../etc/passwd', '/tmp/escape', 'abc/../escape', 'abc\\escape'):
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.mod.put_object(key, b'a', 'application/octet-stream')

    def test_r2_required(self):
        os.environ['REQUIRE_R2'] = '1'
        with self.assertRaises(RuntimeError):
            self.mod.init_storage()

    def test_private_packages_only(self):
        with self.assertRaises(ValueError):
            self.mod.presign_download('yknova/images/a.png', 'a.png')


if __name__ == '__main__':
    unittest.main()
