# StudySync

> **"Learn together. Teach each other. Achieve more."**

StudySync is a production-oriented, student-focused collaborative learning platform where engineering students, medical students, and learners can teach one another, study together, share educational resources, collaborate live, prepare for examinations, and improve their productivity in one unified workspace.

---

## 1. Visual Design System

The application strictly implements the required 3-color palette throughout the UI (backgrounds, text, borders, buttons, icons, charts, badges, and empty states):

- **White**: `#FFFFFF` — Primary page background, cards, input backgrounds, and content surfaces.
- **Alice Blue**: `#F0F8FF` — Secondary sections, sidebars, navigation backgrounds, subtle panels.
- **Lavender**: `#E6E6FA` — Primary action buttons, active navigation items, highlighted cards, interactive states, and high-contrast typography.

Zero unauthorized colors (no black, grey, red, green, yellow, orange, or other color codes) are used anywhere in the UI.

---

## 2. Core Architecture & Tech Stack

- **Backend**: Node.js v22 + Express 5 + Socket.io for real-time signaling & events.
- **Database**: SQLite (via `node:sqlite` in Node 22) with WAL mode, strict foreign key constraints, and atomic transactions.
- **Security**: Argon2/Bcrypt password hashing (12 rounds), HttpOnly cookie JWT sessions, parameterized SQL queries, rate limiting (`express-rate-limit`), security headers (`helmet`), file traversal protection, safe HTML escaping for email templates.
- **Email / SMTP**: Nodemailer over TLS/STARTTLS (`smtp.gmail.com:587`), secure environment variable configuration, verified against Gmail SMTP.
- **Real-Time & Media**: Socket.io + WebRTC for browser peer-to-peer audio/video calling and screen sharing (`getDisplayMedia`).
- **Frontend**: React 18 / 19 + TypeScript + Vite + React Router.
- **Testing**: Vitest + Supertest suite with 33 unit and integration tests passing 100%.

---

## 3. Implemented Features

### Foundation & Authentication
- **Student Registration**: Full name, email address, Student ID / username, degree/course, college/institution, academic year, password strength validation, terms acceptance.
- **Secure Login**: Email or username login, show/hide password, session token in HttpOnly cookie and header fallback.
- **Single-Use Expiring Password Reset**: 30-minute crypto token generated, hashed token storage in SQLite, generic anti-enumeration response, atomic password update and token revocation, email notification.
- **Email Verification**: Cryptographic token links, verification state indicators, resend verification capability.
- **Student Profile**: Editable identity details, study availability status (`available`, `studying`, `busy`), privacy settings (hide email).

### Social & Collaborative Workspace
- **Friends & Student Discovery**: Search students by Student ID, name, course, or college; connection requests, accept/decline/cancel, friend removal.
- **Public & Private Study Groups**: Create groups, custom invite codes, roles (`owner`, `moderator`, `member`), group announcements, member directory, email invitations.
- **Private & Group Messaging**: 1-to-1 direct messaging, group discussions, message history, timestamps, unread counts.

### Live Study Rooms & Collaboration
- **Unified Study Session**: Creates a study room uniting video meeting, collaborative whiteboard, doubt queue, and teaching tools.
- **WebRTC Audio & Video Meeting**: Mesh audio/video communication, microphone mute/unmute, camera toggle, screen sharing.
- **Collaborative Whiteboard**: Multi-tool canvas (Pen, Eraser, Rectangle, Circle, Line, Text annotation), brush sizes, undo/clear, server-side canvas persistence, export to PNG.
- **Teach Mode**: Presenter agenda, raised hand queue, topic tags, teaching notes, and session outcome logging.

### Specialized Peer Collaboration Systems
1. **Feature 1 — Doubt Queue**:
   - Students submit questions during sessions without interrupting the presenter.
   - Upvoting system (strictly 1 vote per student per doubt, toggle on/off).
   - Priority sorting: `votes_count DESC, created_at ASC`.
   - Status transitions: `waiting` ➔ `answering` ➔ `solved`.
2. **Feature 2 — Teach Me / I'll Teach You**:
   - Manages "I Can Teach" and "I Need Help" topic preferences with subjects and tags.
   - Relational matching engine connecting peers who can explain topics with peers who need help.
   - Send study requests, accept/decline invitations, one-click room launch.
3. **Feature 3 — Syllabus Conquer Board**:
   - Multiple exam syllabus boards per group or individual.
   - Units, chapters, and topics with assignee allocation.
   - States: `not_started`, `in_progress`, `completed`.
   - Authoritative completion percentage: `(completed / total) * 100` (safe for 0 topics).
   - Filter by subject, unit, and status.
4. **Feature 4 — Group Focus Pact**:
   - Synchronized Pomodoro focus sessions.
   - Authoritative server timer: start, pause, resume, break, complete.
   - Reconstructs accurate time remaining upon page refresh and reconnect (no client drift).
   - Personal study goals per student.
   - Goal reporting (`completed`, `partially_completed`, `not_completed`) with session history.
5. **Smart Study Dashboard & Exam Planner**:
   - Real statistics: upcoming examinations, countdowns, daily planned study tasks, active groups, live study sessions.
   - Notes & Resource Library: PDF, image, document, and link sharing with server-side validation and path traversal protection.

---

## 4. Setup and Run Instructions

### Prerequisites
- Node.js `v22.x` or higher
- npm `10.x` or higher

### Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
PORT=5000
NODE_ENV=development
APP_BASE_URL=http://localhost:5000
JWT_SECRET=studysync_super_secret_jwt_key_2026_secured_and_salted_991823719
DATABASE_PATH=./studysync.db

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=jsctsmail@gmail.com
SMTP_PASS=<configured_app_password>
EMAIL_FROM="StudySync <jsctsmail@gmail.com>"
```

### Installation
Install backend dependencies:
```bash
npm install
```

Install frontend client dependencies:
```bash
cd client && npm install && cd ..
```

### Running Automated Tests
Run the complete 33-test suite:
```bash
npm test
```

### Building for Production
Build both the React client and the TypeScript server:
```bash
npm run build
```

### Running the Application
Start the full-stack server (serves API and built React client on port 5000):
```bash
npm start
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

For local development with hot reload:
```bash
npm run dev
```
In a separate terminal, to run Vite dev server:
```bash
cd client && npm run dev
```
