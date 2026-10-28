-- RUN THIS ONCE on your EXISTING stockroom_db (phpMyAdmin -> SQL tab). Keeps all your current data.
-- Fresh installs don't need it: database.sql already includes these changes.

ALTER TABLE users MODIFY password_hash CHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(64) NULL UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(190) NULL;

ALTER TABLE staff_codes  ADD COLUMN IF NOT EXISTS owner_id INT NULL;
ALTER TABLE foods        ADD COLUMN IF NOT EXISTS owner_id INT NULL;
ALTER TABLE submissions  ADD COLUMN IF NOT EXISTS owner_id INT NULL;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS owner_id INT NULL;

ALTER TABLE foods ADD INDEX idx_foods_owner (owner_id);
ALTER TABLE submissions ADD INDEX idx_sub_owner (owner_id);
ALTER TABLE daily_reports DROP INDEX report_date;
ALTER TABLE daily_reports ADD UNIQUE KEY uq_owner_date (owner_id, report_date);

-- Everything that exists today now belongs to your first owner account.
SET @o := (SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1);
UPDATE staff_codes   SET owner_id=@o WHERE owner_id IS NULL;
UPDATE foods         SET owner_id=@o WHERE owner_id IS NULL;
UPDATE submissions   SET owner_id=@o WHERE owner_id IS NULL;
UPDATE daily_reports SET owner_id=@o WHERE owner_id IS NULL;
UPDATE settings      SET k=CONCAT('last_archived_',@o) WHERE k='last_archived_date';

-- OPTIONAL: to keep your old data under your Google account, put YOUR Gmail here and remove the "--".
-- The first time you click "Continue with Google" with that Gmail, it links to this old account.
-- UPDATE users SET email='yourname@gmail.com' WHERE id=@o;
