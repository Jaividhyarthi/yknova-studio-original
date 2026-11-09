"""Minimal compatibility layer for the YKNOVA SQLite-shaped API.

IMPORTANT: use only after running migrate_sqlite_to_neon.py; startup does
not auto-create PostgreSQL tables or silently reset anything.
"""
import os
import re
from collections import OrderedDict

import psycopg


def _row_factory(cursor):
    if cursor.description is None:
        return lambda values: values
    columns = [c.name for c in cursor.description]
    class Row(dict):
        def __getitem__(self, key):
            if isinstance(key, int):
                key = columns[key]
            return super().__getitem__(key)
    return lambda values: Row(zip(columns, values))


_REPLACE_CONFLICT = {
    'reviews': ('user_id,product_id', 'id,rating,body,created_at'),
    'newsletter': ('email', 'consent_at,status,source'),
    'settings': ('key', 'value'),
}


def translate(sql):
    """Translate the small, audited SQLite dialect used in server.py."""
    sql = sql.strip()
    match = re.match(r'(?is)^INSERT\s+OR\s+IGNORE\s+INTO\s+(\w+)\b', sql)
    if match:
        sql = re.sub(r'(?is)^INSERT\s+OR\s+IGNORE\s+INTO\b', 'INSERT INTO', sql, count=1)
        # There is no other ON CONFLICT in these INSERT OR IGNORE statements.
        sql += ' ON CONFLICT DO NOTHING'
    match = re.match(r'(?is)^INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\b', sql)
    if match:
        table = match.group(1).lower()
        if table not in _REPLACE_CONFLICT:
            raise ValueError(f'Unsupported SQLite REPLACE table: {table}')
        keys, updates = _REPLACE_CONFLICT[table]
        sql = re.sub(r'(?is)^INSERT\s+OR\s+REPLACE\s+INTO\b', 'INSERT INTO', sql, count=1)
        sql += f" ON CONFLICT ({keys}) DO UPDATE SET " + ','.join(
            f'{col}=EXCLUDED.{col}' for col in updates.split(',')
        )
    # The application only uses question marks as parameter placeholders.
    sql = sql.replace('?', '%s')
    # SQLite accepts double quotes for string literals; PostgreSQL does not.
    sql = sql.replace('="published"', "='published'")
    return sql


class PostgresConnection:
    def __init__(self, uri):
        self._conn = psycopg.connect(uri, row_factory=_row_factory)
    def execute(self, sql, params=()):
        return self._conn.execute(translate(sql), params)
    def __enter__(self):
        self._conn.__enter__()
        return self
    def __exit__(self, *args):
        return self._conn.__exit__(*args)


def connect():
    url = os.getenv('DATABASE_URL')
    if not url:
        raise RuntimeError('DATABASE_URL is required for PostgreSQL')
    return PostgresConnection(url)


def assert_schema_ready(conn):
    row = conn.execute("SELECT to_regclass('public.users') IS NOT NULL AS ready").fetchone()
    if not row or not row['ready']:
        raise RuntimeError('Neon schema missing. Run the verified SQLite migration first.')
