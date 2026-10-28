# Stockroom — Local (Zero-Internet) Setup Guide

Since staff phones will **never** have internet, the site can't stay on InfinityFree —
it has to live on a computer inside the store, reachable only through local WiFi
(no internet needed at all, just a local network).

## What you need
- One Windows (or Mac/Linux) computer/laptop that stays at the store — this becomes
  the "server." It does NOT need internet either, once set up.
- WiFi that the phones can connect to. Two options:
  - **Easiest:** turn on the computer's built-in Mobile Hotspot (Windows: Settings →
    Network → Mobile hotspot). No router needed — phones connect directly to the PC.
  - Or connect the PC and phones to the same WiFi router (router doesn't need to be
    online, just powered on).

---

## Step 1 — Install XAMPP on the store computer
1. Download XAMPP: https://www.apachefriends.org/download.html (choose the version
   for your OS).
2. Install it with defaults. This gives you Apache (web server) + MySQL (database) +
   PHP, all running locally.
3. Open the **XAMPP Control Panel** and click **Start** next to both `Apache` and
   `MySQL`.

## Step 2 — Create the local database
1. In a browser on that same computer, go to `http://localhost/phpmyadmin`.
2. Click **New** (left sidebar) → name it `stockroom_db` → Create.
3. Click the `stockroom_db` database, then the **SQL** tab.
4. Paste in the full database script you already have (the `CREATE TABLE` /
   `INSERT` statements you shared earlier) and click **Go**. This builds all your
   tables and seeds the default owner login + staff code + starter foods.

## Step 3 — Put the site files in place
1. Go to the XAMPP install folder, then into `htdocs` (e.g.
   `C:\xampp\htdocs`).
2. Create a new folder there, e.g. `stockroom`.
3. Copy in `index.html`, `style.css`, `script.js`, `sw.js`, `manifest.json`,
   `icon-192.png`, `icon-512.png`, and the **`api.php` from this guide**
   (already configured for local use — see Step 4, nothing to edit).

## Step 4 — About the local `api.php`
The `api.php` included alongside this guide is already set to connect to:
```
host: localhost
db:   stockroom_db
user: root
pass: (empty — XAMPP's default MySQL user has no password)
```
This matches XAMPP's defaults, so you shouldn't need to change anything. If you
set a MySQL password or a different DB name in Step 2, open `api.php` and update
the four lines near the top (`$host`, `$db`, `$user`, `$pass`) to match.

## Step 5 — Find the computer's local IP address
1. On the store computer: Windows key → type `cmd` → open Command Prompt.
2. Type `ipconfig` and press Enter.
3. Look for **IPv4 Address**, something like `192.168.137.1` or `192.168.1.5`.
   This is the address staff phones will use.

## Step 6 — Connect phones and open the site
1. On each staff phone: connect to the WiFi/hotspot from the store computer
   (no internet needed, just the local network).
2. Open a browser and go to:
   ```
   http://<the-ip-from-step-5>/stockroom/
   ```
   Example: `http://192.168.137.1/stockroom/`
3. It's a good idea to have staff **bookmark this** or add a home-screen shortcut
   (browser menu → "Add to Home Screen") so they don't have to retype the address
   every day.

## Daily use
- Turn on the store computer and the WiFi/hotspot before staff arrive.
- Staff connect to the local WiFi and open the bookmarked address — works exactly
  like before, submissions, stock deduction, daily auto-save, and report history
  all work the same, just fully offline from the outside internet.
- If a phone briefly loses the local WiFi signal mid-submission, the built-in
  offline queue in `script.js` still saves it on the device and retries
  automatically once it reconnects to the local network.

## Notes / limitations
- **"Add to Home Screen" as a full installable app icon** (via `manifest.json`)
  and the **service worker page-caching** may not activate over a plain local IP
  address — most browsers require HTTPS (or `localhost`) for that specific
  feature. This doesn't affect the offline submission queue, which is plain
  JavaScript and works regardless. A normal browser bookmark works fine daily.
- The computer must stay powered on and Apache/MySQL running (XAMPP Control
  Panel) during store hours for staff to reach it.
- To back up your data, copy the `stockroom_db` folder from
  `C:\xampp\mysql\data\` or use phpMyAdmin's **Export** button occasionally.