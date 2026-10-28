
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

// Create the database directory
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

// Connect to SQLite database
const db = new Database(path.join(dataDir, "campuspulse.sqlite"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Other',
    venue TEXT NOT NULL,
    event_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    organizer TEXT NOT NULL DEFAULT 'CampusPulse Team',
    capacity INTEGER NOT NULL DEFAULT 100 CHECK(capacity > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    attendee_id TEXT NOT NULL,
    attendee_name TEXT NOT NULL,
    attendee_email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, attendee_id)
  );
`);

// Admin account configuration
const adminEmail = (
  process.env.ADMIN_EMAIL || "admin@campuspulse.local"
).trim().toLowerCase();

const adminPassword =
  process.env.ADMIN_PASSWORD || "CampusAdmin@123";

// Create the admin account if missing.
// If it already exists, update its password hash.
const existingAdmin = db
  .prepare("SELECT id FROM admins WHERE email = ?")
  .get(adminEmail);

if (!existingAdmin) {
  db.prepare(
    "INSERT INTO admins (email, password_hash) VALUES (?, ?)"
  ).run(
    adminEmail,
    bcrypt.hashSync(adminPassword, 10)
  );
} else {
  db.prepare(
    "UPDATE admins SET password_hash = ? WHERE email = ?"
  ).run(
    bcrypt.hashSync(adminPassword, 10),
    adminEmail
  );
}

// Add sample events if the events table is empty
const count = db
  .prepare("SELECT COUNT(*) AS n FROM events")
  .get().n;

if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO events (
      title,
      description,
      category,
      venue,
      event_date,
      start_time,
      end_time,
      organizer,
      capacity
    )
    VALUES (
      @title,
      @description,
      @category,
      @venue,
      @event_date,
      @start_time,
      @end_time,
      @organizer,
      @capacity
    )
  `);

  const today = new Date();

  const dateAfter = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const seed = [
    {
      title: "Campus Innovation Summit",
      description:
        "A day of ideas, student startups, product demos and inspiring talks from builders.",
      category: "Technology",
      venue: "Main Auditorium",
      event_date: dateAfter(5),
      start_time: "10:00",
      end_time: "16:00",
      organizer: "Innovation Cell",
      capacity: 180
    },
    {
      title: "CodeSprint Hackathon",
      description:
        "Team up, solve a campus challenge and turn your idea into a working prototype.",
      category: "Technology",
      venue: "Computer Lab Block",
      event_date: dateAfter(9),
      start_time: "09:00",
      end_time: "18:00",
      organizer: "Coding Club",
      capacity: 120
    },
    {
      title: "Rhythm & Roots",
      description:
        "A lively cultural evening featuring music, dance, poetry and student performances.",
      category: "Cultural",
      venue: "Open Air Stage",
      event_date: dateAfter(13),
      start_time: "17:00",
      end_time: "20:30",
      organizer: "Cultural Committee",
      capacity: 250
    },
    {
      title: "Career Launch Workshop",
      description:
        "Practical resume reviews, interview preparation and career planning for students.",
      category: "Career",
      venue: "Seminar Hall 2",
      event_date: dateAfter(17),
      start_time: "11:00",
      end_time: "14:00",
      organizer: "Placement Cell",
      capacity: 90
    },
    {
      title: "Inter-Department Sports Meet",
      description:
        "Bring your team spirit for a friendly day of campus sports and games.",
      category: "Sports",
      venue: "College Sports Ground",
      event_date: dateAfter(22),
      start_time: "08:00",
      end_time: "15:00",
      organizer: "Sports Committee",
      capacity: 300
    },
    {
      title: "Green Campus Drive",
      description:
        "Join volunteers for planting, campus clean-up and a sustainability discussion.",
      category: "Community",
      venue: "Central Garden",
      event_date: dateAfter(27),
      start_time: "08:30",
      end_time: "11:30",
      organizer: "Eco Club",
      capacity: 80
    }
  ];

  const tx = db.transaction((rows) => {
    rows.forEach((row) => insert.run(row));
  });

  tx(seed);
}

// Export the database connection
module.exports = db;
