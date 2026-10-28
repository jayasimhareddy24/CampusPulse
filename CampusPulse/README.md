# CampusPulse — Campus Event Scheduling Platform

A full-stack campus event management website using **React, HTML, CSS, JavaScript, Node.js, Express.js and SQLite**.

## Features

### Student / visitor
- Responsive dashboard with event statistics and upcoming events
- Search events by title, venue or description
- Filter by category and upcoming/past status
- View event details, date, time, venue, organizer and capacity
- Register for an event and cancel your own registration
- Registration status and attendee counts
- Prevents duplicate registration and full-event registration

### Admin
- Admin sign-in
- Create, edit and delete events
- Set title, description, category, venue, date, start/end time, organizer and capacity
- View attendee counts and registrations
- Export event registrations as CSV
- Admin-only API endpoints protected by JWT authentication

### Technical stack
- Frontend: React + Vite, HTML, CSS, JavaScript
- Backend: Node.js + Express
- Database: SQLite (created automatically on first server start)
- Development: Visual Studio Code
- Version control: Git and GitHub

## Run locally in Visual Studio Code

**Requirements:** Node.js 20 or newer and npm.

1. Extract the `CampusPulse` folder.
2. Open the `CampusPulse` folder in Visual Studio Code.
3. Open **Terminal → New Terminal**.
4. Run these commands:

```bash
npm run install:all
npm run dev
```

5. Open the frontend URL shown by Vite, normally `http://localhost:5173`.

The API runs on `http://localhost:5000`.

## Admin login (demo)

- Email: `admin@campuspulse.local`
- Password: `CampusAdmin@123`

Change these credentials before deploying. The initial admin account is seeded automatically. You can override the seed credentials using environment variables `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first server start.

## Important deployment note

GitHub is excellent for storing this project’s source code, but **GitHub Pages only hosts static frontend files**. It cannot run the Express backend or SQLite database. Upload this folder to a GitHub repository for version control. To make the complete app available online, deploy the React frontend to a static host and the Express API to a Node.js host, and use a persistent disk/volume for SQLite. Configure `VITE_API_URL` in the frontend host to point to your API URL. Do not use SQLite on an ephemeral server filesystem because the database may be lost when the host restarts or redeploys.

## API overview

- `GET /api/health` — health check
- `GET /api/events` — list events (supports `q`, `category`, `status`)
- `GET /api/events/:id` — event details
- `POST /api/events/:id/register` — register (demo attendee identity is stored in browser local storage)
- `DELETE /api/events/:id/register` — cancel registration
- `POST /api/admin/login` — admin login
- `GET /api/admin/registrations` — all registrations (admin)
- `GET /api/admin/events/:id/registrations.csv` — export registrations (admin)
- `POST /api/events` — create event (admin)
- `PUT /api/events/:id` — update event (admin)
- `DELETE /api/events/:id` — delete event (admin)

## Notes

- This is a starter academic project, not a production-ready identity system. Student registration uses a browser-generated attendee ID so the flow can be demonstrated without a student account system.
- For a real college rollout, add student authentication, email verification, password reset, rate limiting, HTTPS, audit logs and a managed persistent database strategy.
