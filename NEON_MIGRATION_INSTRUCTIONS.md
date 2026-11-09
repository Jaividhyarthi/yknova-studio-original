# YKNOVA Studio — staged Neon migration

## Scope and warnings

This patch adds a PostgreSQL compatibility connection layer and a one-time
SQLite-to-Neon copier. It is **not a tested live production deployment**.
The source has 23 SQLite tables. Your verified backup of those tables is the
source of truth. Keep SQLite and the working Render branch unchanged until
an independent Neon staging test passes. Use `neon-migration` branch only.

**Never paste the Neon DATABASE_URL, Firebase Admin JSON, or R2 credentials in
chat, logs, Git, terminal command arguments, or screenshots.**

## Apply to local `neon-migration` branch

From the repository root, with a clean working tree:

```bash
unzip -o /path/to/yknova-neon-migration-stage1.zip -d .
python -m py_compile backend/server.py backend/pg_compat.py backend/migrate_sqlite_to_neon.py
python -m unittest discover -s backend/tests -v
```

This archive contains a server.py based on the previously shared production
hardening version. Review `git diff` before committing. Existing local changes
in server.py should be reconciled manually instead of overwritten.

## Safe preflight: no database writes

Your Neon DATABASE_URL must already be exported into your **current** shell.
Use the existing verified SQLite backup:

```bash
python backend/migrate_sqlite_to_neon.py \
  --sqlite "$HOME/yknova-backups/studio-pre-neon-20261109-071528.sqlite3"
```

It prints row counts and `DRY RUN ONLY`. It must report exactly 23 tables and
preserve 3 users, 1 product, 2 entitlements and 2 downloads in the specified
backup. If your working backup differs, choose the newer verified snapshot
and review its counts.

## Stage 2 (only after reviewing dry run and diff)

The `--apply` flag is the **first command that writes to Neon**. It refuses
non-empty target schemas, copies all 23 tables, recreates explicit indexes,
verifies per-table counts, verifies at least one linked super_admin, and
commits only if checks succeed. It must be tested in a disposable Neon branch
first; do not run it on the live Neon production branch as the first test.

```bash
python backend/migrate_sqlite_to_neon.py \
  --sqlite "$HOME/yknova-backups/studio-pre-neon-20261109-071528.sqlite3" --apply
```

Don't run that command until after the preflight review and a backup check.

## Runtime

`backend/server.py` switches to PostgreSQL when `DATABASE_URL` is present.
Without it, existing SQLite behavior remains. PostgreSQL startup requires
existing migrated `users` table; it does not silently create/reset schema.
The adapter translates SQLite `?` placeholders and audited `INSERT OR`
statements to psycopg conventions; the app still needs staging integration
tests for Firebase, admin routes, product image+ZIP upload, publishing,
customer entitlement/download, and Razorpay test-mode webhooks.

The payment-event duplicate branch was made `ON CONFLICT DO NOTHING` because
PostgreSQL transactions cannot continue after caught unique constraint errors.

## Production gating

Do **not** add DATABASE_URL to Render or switch Render branch before full
integration validation, including a second migration dry run from the final
backup and comparison of record identities, not merely counts. Render
currently uses temporary SQLite; it is not safe for real production customer
records. Keep live payments disabled.

Note: after migration, newly uploaded objects still live separately in R2;
ensure the keys in `uploads` and `product_files` correspond to actual R2
objects before production cutover.
