# Google login / signup — setup

## How it works
- Owners: **Continue with Google** logs in, or creates a new owner account if it's their first time.
- Each owner gets their **own staff code** (shown on the dashboard, with Copy / New code).
- Staff enter that code → everything they submit goes to **that owner's** foods, stock, submissions and reports. Other owners never see it.
- Email + password login for the old admin still works.

## 1. Update the database (once)
- Existing database: run `migration_multi_owner.sql` in phpMyAdmin (SQL tab).
- Brand-new install: run `database.sql` instead.

## 2. Get a Google Client ID
1. https://console.cloud.google.com → create a project.
2. **APIs & Services → OAuth consent screen** → External → fill app name + your email → Save.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
4. Under **Authorized JavaScript origins** add `http://localhost` (and `http://localhost:80` if asked). Google does NOT accept IP addresses like 192.168.x.x, so owners must open the site as `http://localhost/stockroom/` on the store computer.
5. Copy the Client ID (ends in `.apps.googleusercontent.com`).

## 3. Put it in api.php
```php
define('GOOGLE_CLIENT_ID', 'xxxxxxxx.apps.googleusercontent.com');
```
Only this one place. Until it's filled in, the Google button stays hidden.

## Notes
- The Google button needs internet on the device the owner logs in on. Staff don't need internet or Google at all.
- If you see "Could not reach Google to verify": the PC has no internet, or PHP's curl can't verify SSL (set `curl.cainfo` in php.ini).
- Replace the files on the store PC and refresh the phones once (sw.js cache is now v2).
- New owners start with an empty food list and add their own.
