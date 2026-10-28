# Setting up Gmail Backup

Your Stockroom system can now email a full backup (all foods, all submissions,
all saved daily reports) as a JSON attachment — automatically at the end of
each day, and on-demand via the "Email full backup" button.

This needs your STORE COMPUTER (not the staff phones) to have internet at
least once in a while — whenever it does, the backup will go out.

## Step 1 — Turn on 2-Step Verification
Gmail won't allow this without it.
1. Go to https://myaccount.google.com/security
2. Turn on **2-Step Verification** if it isn't already on.

## Step 2 — Create an App Password
1. Go to https://myaccount.google.com/apppasswords
2. Sign in again if asked.
3. Under "App name," type something like `Stockroom` and click **Create**.
4. Google shows you a **16-letter code** (like `abcd efgh ijkl mnop`). Copy it —
   you won't be able to see it again.

⚠️ This is NOT your normal Gmail password — never put your real password in
the code. The App Password only works for this one purpose and can be revoked
anytime from the same page.

## Step 3 — Put it into `api.php`
Near the top of `api.php`, find these lines:
```php
define('GMAIL_ADDRESS',      'youraccount@gmail.com');
define('GMAIL_APP_PASSWORD', 'xxxxxxxxxxxxxxxx');
define('BACKUP_TO_EMAIL',    'youraccount@gmail.com');
```
Replace:
- `GMAIL_ADDRESS` → the Gmail account you made the App Password with.
- `GMAIL_APP_PASSWORD` → the 16-letter code from Step 2 (remove the spaces).
- `BACKUP_TO_EMAIL` → where you want backups sent. Can be the same Gmail, or
  a different address entirely (e.g. the shop owner's personal email).

Save the file and re-upload/replace it on the store computer.

## Step 4 — Test it
1. Log in as owner.
2. Click **"✉ Email full backup"** at the top of the dashboard.
3. Check the inbox of whatever you set as `BACKUP_TO_EMAIL` — you should get an
   email with a `stockroom_backup_YYYY-MM-DD.json` attachment within a few
   seconds.

If it fails, the toast message will tell you why (no internet right now, wrong
App Password, etc.) — nothing else in the app is affected either way.

## What happens automatically
Every time a day finishes and gets auto-archived, the system also tries to
email that day's full backup in the background. If the store computer has no
internet at that moment, it just silently skips it — the auto-save to the
database still happens regardless, only the emailed copy is skipped. You can
always catch up with the manual "Email full backup" button once you do have
internet.