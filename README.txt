STOCKROOM — XAMPP + MySQL (Local, works with zero internet on staff phones)

Folder:
  C:\xampp\htdocs\stockroom\

Files to put in that folder (all of them, same level, no subfolders):
  index.html              - Stockroom UI
  style.css               - Styling
  script.js               - Front-end logic + offline queue
  api.php                 - PHP/MySQL API (auto-archive, stock math, Gmail backup)
  database.sql            - Full database schema + starter data
  db_connect.php          - Not used by api.php; safe to delete, kept for reference only
  sw.js                   - Service worker (offline page caching)
  manifest.json           - Lets the site be "installed" to a phone home screen
  icon-192.png / icon-512.png - App icons for the above

Guides:
  GMAIL_BACKUP_SETUP.md   - How to enable the "Email full backup" feature

SETUP:
1. Start Apache and MySQL in the XAMPP Control Panel.
2. In http://localhost/phpmyadmin, run database.sql (SQL tab → paste → Go).
   This creates stockroom_db with all tables and the starter owner/staff/foods.
3. Put all the files above into C:\xampp\htdocs\stockroom\
4. (Optional but recommended) Follow GMAIL_BACKUP_SETUP.md to enable automatic
   email backups.
5. Open http://localhost/stockroom/ on the store computer to confirm it works.
6. For staff phones with no internet at all: turn on the store computer's
   Mobile Hotspot (or connect it + phones to the same local WiFi router), find
   the computer's local IP with `ipconfig`, and have staff open
   http://<that-ip>/stockroom/ — see LOCAL_HOSTING_GUIDE.md if you still have
   that file from before.

WHAT'S NEW IN THIS VERSION:
- Daily reports save themselves automatically — no "Save today" button needed.
- Printing (today or any past day) always pulls the correct live/saved numbers.
- Calendar arrows (← / →) + date picker to browse past days in the dashboard.
- Stock math is hardened (GREATEST(0, stock-sold)) so it always lands on a
  correctly computed number — a full sellout correctly shows "SOLD OUT" (0),
  not a blank/reset value.
- Staff submissions work offline (no signal) and sync automatically once a
  connection is back — saved locally on the device in the meantime.
- "✉ Email full backup" button on the owner dashboard sends a full JSON backup
  (foods, submissions, daily reports) to Gmail — also runs automatically once
  a day in the background if the store computer has internet at that moment.

Owner login:
  Email: admin@stockroom.com
  Password: admin123

Staff code:
  STAFF2026