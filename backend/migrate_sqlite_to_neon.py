"""Migrate a backed-up SQLite YKNOVA database to an EMPTY Neon PostgreSQL DB.

Dry-run (no Neon writes):
  python migrate_sqlite_to_neon.py --sqlite /path/to/backup.sqlite3
Apply (creates tables and copies records atomically):
  python migrate_sqlite_to_neon.py --sqlite /path/to/backup.sqlite3 --apply

Requires DATABASE_URL in the environment; never paste that URL into Git.
"""
import argparse
import os
import re
import sqlite3
from pathlib import Path

import psycopg
from psycopg import sql


def quote_identifier(value):
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', value):
        raise ValueError('Unexpected table/column name')
    return sql.Identifier(value)


def prepare(source):
    source.row_factory = sqlite3.Row
    if source.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
        raise RuntimeError('SQLite integrity check failed')
    tables = [(r['name'], r['sql']) for r in source.execute(
        "SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    allnames = {n for n, _ in tables}
    # Order tables by foreign-key dependencies, so PostgreSQL validates inserts.
    remaining = dict(tables)
    ordered = []
    while remaining:
        ready = [name for name in remaining if all(
            dep[2] not in remaining for dep in source.execute(f'PRAGMA foreign_key_list("{name}")'))]
        if not ready:
            raise RuntimeError('Circular SQLite foreign-key dependency; migration must be reviewed')
        for name in ready:
            ordered.append((name, remaining.pop(name)))
    return ordered


def migrate(source_path, url, apply=False):
    if not source_path.is_file():
        raise FileNotFoundError(source_path)
    with sqlite3.connect(f'file:{source_path}?mode=ro', uri=True) as source:
        tables = prepare(source)
        counts = {name: source.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0] for name, _ in tables}
        print('SQLite integrity: ok')
        print('Tables:', len(tables), '| Total records:', sum(counts.values()))
        for name in ('users','products','product_files','entitlements','downloads','orders'):
            if name in counts:
                print(f'{name}: {counts[name]}')
        if not apply:
            print('DRY RUN ONLY: Neon has not been modified. Use --apply after review.')
            return
        if len(tables) != 23:
            raise RuntimeError('Expected 23 tables; review unexpected schema before applying')
        with psycopg.connect(url) as target:
            with target.cursor() as cur:
                cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
                if cur.fetchone()[0] != 0:
                    raise RuntimeError('Target Neon public schema is not empty; refusing to overwrite')
                for name, ddl in tables:
                    # Uses actual, fully migrated SQLite CREATE TABLE declarations.
                    # Supported schema consists of TEXT and INTEGER columns,
                    # standard defaults and constraints (no AUTOINCREMENT).
                    if not ddl or re.search(r'\bAUTOINCREMENT\b|\bWITHOUT\s+ROWID\b', ddl, re.I):
                        raise RuntimeError(f'Unsupported SQLite table syntax: {name}')
                    cur.execute(ddl)
                for name, _ in tables:
                    columns = [r[1] for r in source.execute(f'PRAGMA table_info("{name}")')]
                    if not columns:
                        raise RuntimeError(f'Empty table schema: {name}')
                    q = sql.SQL('INSERT INTO {} ({}) VALUES ({})').format(
                        quote_identifier(name),
                        sql.SQL(',').join(quote_identifier(c) for c in columns),
                        sql.SQL(',').join(sql.Placeholder() for _ in columns))
                    rows = source.execute(f'SELECT * FROM "{name}"').fetchall()
                    if rows:
                        cur.executemany(q, [[r[c] for c in columns] for r in rows])
                # Restore explicitly declared unique and performance indexes.
                for r in source.execute("SELECT name,sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name"):
                    cur.execute(r[1])
                for name, expected in counts.items():
                    cur.execute(sql.SQL('SELECT COUNT(*) FROM {}').format(quote_identifier(name)))
                    actual = cur.fetchone()[0]
                    if actual != expected:
                        raise RuntimeError(f'Count mismatch: {name}: {actual} != {expected}')
                cur.execute("SELECT COUNT(*) FROM users WHERE role='super_admin' AND firebase_uid IS NOT NULL")
                if cur.fetchone()[0] < 1:
                    raise RuntimeError('Missing linked super_admin account; rolling back')
            # Transaction commits only if all tables, counts, and admin check succeed.
        print('SUCCESS: all 23 tables and records migrated to Neon, checks passed')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--sqlite', required=True, type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    migrate(args.sqlite, os.environ.get('DATABASE_URL', ''), args.apply)
