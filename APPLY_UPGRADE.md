# Applying the YKNOVA Studio launch-hardening patch

**This is a tested code patch, not a live deployment or complete PostgreSQL migration.** Back up your current repo and local data before applying. Work on `production-upgrade` branch.

## Before patch

In Ubuntu:

```bash
cd "/mnt/c/Users/JAIVIDHYARTHI V/yknova-studio-original"
git status --short
# Ensure no uncommitted changes; back them up rather than discarding them.
mkdir -p ~/yknova-backups
cp backend/server.py ~/yknova-backups/server-before-launch-hardening.py
cp backend/storage.py ~/yknova-backups/storage-before-r2.py
```

Download the patch ZIP through ChatGPT and extract it to your repository root, e.g. from Windows Downloads:

```bash
unzip -o "/mnt/c/Users/JAIVIDHYARTHI V/Downloads/yknova-launch-hardening-patch.zip" -d "/mnt/c/Users/JAIVIDHYARTHI V/yknova-studio-original"
```

**Tracked database warning**: your Git archive contained `backend/data/studio.sqlite3` (one user and six catalog products). The patch does *not* include a database file and will not delete your local copy. Stop tracking it: `git rm --cached backend/data/studio.sqlite3` (not `git rm`, which removes your local working copy too). `.gitignore` now excludes it from new commits. If this database ever reached a public remote, review/rotate exposed information and arrange appropriate Git-history cleanup. Commit the removals and patch in one commit after testing.

## Validation

```bash
source ~/yknova-venv/bin/activate
python -m py_compile backend/server.py backend/storage.py
python -m unittest discover -s backend/tests -v
cd frontend
npm install --legacy-peer-deps
npm run build
cd ..
git diff --stat
git status --short
```

This patch changes the frontend to send Firebase ID tokens on authorized API requests. For development, run the backend with the existing Firebase Admin credentials environment variables; test administrator login, customer login, account refresh after page reload, logout and re-login, product uploads, downloads, and customer/admin role boundaries. Do not flip `ALLOW_LEGACY_AUTH=0` until those tests pass. Do not deploy without run-time smoke testing; Python compile and unit tests alone do not validate Firebase/Razorpay/R2 live services.

## Deploy / service configuration

Read `PRODUCTION_LAUNCH.md`. For staging use `ALLOW_LEGACY_AUTH=0`, `REQUIRE_R2=1`, Razorpay test keys and webhook secret. Set all four `R2_*` vars, and make sure R2 bucket is **private**. Current backend still depends on SQLite; use a persistently mounted disk plus backups if deploying an interim staging instance. Do not enable real payments until database durability, auth, receipts, refund policy and full gateway tests are proven.

## Feature status

- Firebase native ID token bearer support: implemented, needs integration testing.
- Authenticated admin upload and entitlement-checked R2 ZIP download: implemented, needs private R2 bucket and integration testing.
- Razorpay verified payment handling: strengthened, requires test account and webhook simulations.
- PostgreSQL: NOT implemented. A separate audited schema/query migration is necessary; do not configure PostgreSQL URL expecting it to work.
- Cloudflare Pages: SPA redirects and environment template added, hosting still needs setup in your Cloudflare account.
- Instagram: link your published storefront URL in Instagram's bio after validating live pages, branding, policies and checkout.
