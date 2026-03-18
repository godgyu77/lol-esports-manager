CREATE TABLE IF NOT EXISTS offseason_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    save_id INTEGER NOT NULL,
    phase TEXT NOT NULL DEFAULT 'transfer_window', -- transfer_window/roster_lock/preseason
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days_remaining INTEGER NOT NULL DEFAULT 14,
    is_active INTEGER NOT NULL DEFAULT 1
);
