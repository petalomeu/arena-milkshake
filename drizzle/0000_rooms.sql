CREATE TABLE arena_rooms (
  code TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  guest TEXT,
  expires INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE arena_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  player INTEGER NOT NULL,
  payload TEXT NOT NULL,
  FOREIGN KEY (code) REFERENCES arena_rooms(code) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX arena_messages_room ON arena_messages(code, player, id);
