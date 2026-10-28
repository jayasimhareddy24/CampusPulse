require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");
const { requireAdmin } = require("./middleware");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(cors({ origin: allowedOrigin.split(",").map((s) => s.trim()), credentials: false }));
app.use(express.json({ limit: "1mb" }));

const eventSelect = `
 SELECT e.*,
   (SELECT COUNT(*) FROM registrations r WHERE r.event_id=e.id) AS attendee_count
 FROM events e
`;

function validateEvent(body) {
  const fields = ["title", "venue", "event_date", "start_time", "end_time"];
  for (const field of fields) {
    if (!String(body[field] || "").trim()) return `${field.replaceAll("_", " ")} is required.`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.event_date)) return "Use a valid event date.";
  if (!/^\d{2}:\d{2}$/.test(body.start_time) || !/^\d{2}:\d{2}$/.test(body.end_time)) return "Use valid start and end times.";
  if (body.end_time <= body.start_time) return "End time must be after start time.";
  const capacity = Number(body.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) return "Capacity must be a whole number from 1 to 100000.";
  return null;
}

function cleanEvent(body) {
  return {
    title: String(body.title).trim(),
    description: String(body.description || "").trim(),
    category: String(body.category || "Other").trim(),
    venue: String(body.venue).trim(),
    event_date: body.event_date,
    start_time: body.start_time,
    end_time: body.end_time,
    organizer: String(body.organizer || "CampusPulse Team").trim(),
    capacity: Number(body.capacity)
  };
}

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "CampusPulse API" }));

app.get("/api/events", (req, res) => {
  const { q = "", category = "All", status = "all" } = req.query;
  let sql = eventSelect + " WHERE 1=1";
  const args = {};
  if (String(q).trim()) {
    sql += " AND (e.title LIKE @q OR e.venue LIKE @q OR e.description LIKE @q OR e.organizer LIKE @q)";
    args.q = `%${String(q).trim()}%`;
  }
  if (category !== "All") {
    sql += " AND e.category = @category";
    args.category = category;
  }
  if (status === "upcoming") sql += " AND e.event_date >= date('now','localtime')";
  if (status === "past") sql += " AND e.event_date < date('now','localtime')";
  sql += " ORDER BY e.event_date ASC, e.start_time ASC";
  res.json(db.prepare(sql).all(args));
});

app.get("/api/events/:id", (req, res) => {
  const event = db.prepare(eventSelect + " WHERE e.id = ?").get(Number(req.params.id));
  if (!event) return res.status(404).json({ error: "Event not found." });
  res.json(event);
});

app.post("/api/events/:id/register", (req, res) => {
  const eventId = Number(req.params.id);
  const { attendee_id, attendee_name, attendee_email } = req.body || {};
  if (!attendee_id || !String(attendee_name || "").trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(attendee_email || ""))) {
    return res.status(400).json({ error: "Enter your name and a valid email address." });
  }
  const event = db.prepare(eventSelect + " WHERE e.id = ?").get(eventId);
  if (!event) return res.status(404).json({ error: "Event not found." });
  if (event.event_date < new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: "Registration is closed for past events." });
  const exists = db.prepare("SELECT id FROM registrations WHERE event_id=? AND attendee_id=?").get(eventId, String(attendee_id));
  if (exists) return res.status(409).json({ error: "You are already registered for this event." });
  if (event.attendee_count >= event.capacity) return res.status(409).json({ error: "This event is full." });
  try {
    db.prepare("INSERT INTO registrations (event_id, attendee_id, attendee_name, attendee_email) VALUES (?, ?, ?, ?)")
      .run(eventId, String(attendee_id), String(attendee_name).trim(), String(attendee_email).trim().toLowerCase());
  } catch (error) {
    return res.status(409).json({ error: "Could not complete registration. Please try again." });
  }
  res.status(201).json({ message: "Registration successful." });
});

app.delete("/api/events/:id/register", (req, res) => {
  const { attendee_id } = req.body || {};
  if (!attendee_id) return res.status(400).json({ error: "Attendee identity is missing." });
  const result = db.prepare("DELETE FROM registrations WHERE event_id=? AND attendee_id=?").run(Number(req.params.id), String(attendee_id));
  if (!result.changes) return res.status(404).json({ error: "Registration not found." });
  res.json({ message: "Registration cancelled." });
});

app.post("/api/admin/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const admin = db.prepare("SELECT * FROM admins WHERE email=?").get(email);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  const token = jwt.sign({ id: admin.id, email: admin.email, role: "admin" }, process.env.JWT_SECRET || "development-only-change-me", { expiresIn: "8h" });
  res.json({ token, email: admin.email });
});

app.get("/api/admin/registrations", requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT r.id, r.attendee_name, r.attendee_email, r.created_at, e.id AS event_id, e.title AS event_title, e.event_date
    FROM registrations r JOIN events e ON e.id=r.event_id
    ORDER BY e.event_date ASC, r.created_at DESC
  `).all();
  res.json(rows);
});

app.get("/api/admin/events/:id/registrations.csv", requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT attendee_name, attendee_email, created_at
    FROM registrations WHERE event_id=? ORDER BY created_at DESC
  `).all(Number(req.params.id));
  const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = ["Name,Email,Registered at", ...rows.map(r => [r.attendee_name, r.attendee_email, r.created_at].map(escape).join(","))].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="event-${req.params.id}-registrations.csv"`);
  res.send(csv);
});

app.post("/api/events", requireAdmin, (req, res) => {
  const error = validateEvent(req.body || {});
  if (error) return res.status(400).json({ error });
  const event = cleanEvent(req.body);
  const result = db.prepare(`
    INSERT INTO events (title, description, category, venue, event_date, start_time, end_time, organizer, capacity)
    VALUES (@title, @description, @category, @venue, @event_date, @start_time, @end_time, @organizer, @capacity)
  `).run(event);
  res.status(201).json(db.prepare(eventSelect + " WHERE e.id=?").get(result.lastInsertRowid));
});

app.put("/api/events/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT id FROM events WHERE id=?").get(id)) return res.status(404).json({ error: "Event not found." });
  const error = validateEvent(req.body || {});
  if (error) return res.status(400).json({ error });
  const event = cleanEvent(req.body);
  const attendees = db.prepare("SELECT COUNT(*) AS n FROM registrations WHERE event_id=?").get(id).n;
  if (event.capacity < attendees) return res.status(400).json({ error: `Capacity cannot be lower than the ${attendees} existing registrations.` });
  db.prepare(`
    UPDATE events SET title=@title, description=@description, category=@category, venue=@venue,
      event_date=@event_date, start_time=@start_time, end_time=@end_time, organizer=@organizer, capacity=@capacity
    WHERE id=@id
  `).run({ ...event, id });
  res.json(db.prepare(eventSelect + " WHERE e.id=?").get(id));
});

app.delete("/api/events/:id", requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM events WHERE id=?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Event not found." });
  res.json({ message: "Event deleted." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => console.log(`CampusPulse API running at http://localhost:${PORT}`));
