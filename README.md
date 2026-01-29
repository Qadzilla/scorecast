# ScoreCast

A real-time football predictions platform for Premier League and UEFA Champions League matches. Compete with friends in private leagues, make match predictions, and climb the leaderboard throughout the season.

**Live at [scorecast.club](https://scorecast.club)**

## The Game

### How It Works

ScoreCast brings the excitement of match predictions to life:

1. **Join or Create Leagues** - The admin creates prediction leagues (Premier League or Champions League). Players join using an 8-character invite code to compete against friends, family, or colleagues.

2. **Make Predictions** - Before each gameweek deadline, predict the exact score for every match. Once the deadline passes, predictions are locked in.

3. **Scoring System**
   - **3 points** - Exact score prediction (e.g., predicted 2-1, result was 2-1)
   - **1 point** - Correct result prediction (e.g., predicted 3-1 home win, result was 2-0 home win)
   - **0 points** - Wrong result

4. **Climb the Leaderboard** - Points accumulate across gameweeks. Track your rank, see how you compare to others, and watch the standings shift throughout the season.

5. **Season Champion** - When all 38 Premier League gameweeks (or all UCL matchdays) are complete, the player with the most points is crowned champion.

### Key Features

- **Live Fixture Data** - Real match schedules pulled from football-data.org API
- **Gameweek Deadlines** - Predictions lock before the first match kicks off
- **Multi-Competition Support** - Separate leagues for Premier League and Champions League
- **Favorite Team Badge** - Display your team's logo on the leaderboard
- **Season Completion Detection** - Automatic champion crowning when the season ends
- **Demo Mode** - Try the app without signing up via the "Try Demo" button

---

## Technical Architecture

### System Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │────▶│  Express API    │────▶│  PostgreSQL     │
│  (Vite + TS)    │     │  (TypeScript)   │     │  (Neon)         │
│  Vercel         │     │  Railway        │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │ Football-Data   │
                        │ API (External)  │
                        └─────────────────┘
```

### Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | [scorecast.club](https://scorecast.club) |
| Backend API | Railway | api.scorecast.club |
| Database | Neon PostgreSQL | - |
| Email | Resend | noreply@scorecast.club |

### Backend Architecture

**Tech Stack:**
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon serverless)
- **Authentication**: Better Auth (session-based with secure cookies)
- **Email**: Resend API for transactional emails
- **Scheduler**: node-cron for automatic fixture sync

**Directory Structure:**
```
backend/
├── src/
│   ├── routes/           # API endpoints
│   │   ├── fixtures.ts   # Gameweeks, matches, seasons
│   │   ├── predictions.ts # Submit/retrieve predictions
│   │   ├── leagues.ts    # League CRUD, join/leave
│   │   ├── leaderboard.ts # Rankings and standings
│   │   ├── admin.ts      # Admin-only operations
│   │   └── user.ts       # Profile, favorite team
│   ├── middleware/
│   │   ├── auth.ts       # Session validation
│   │   └── sanitize.ts   # Input sanitization
│   ├── services/
│   │   └── footballData.ts # External API integration
│   ├── db/
│   │   └── migrations/   # Schema migrations
│   ├── __tests__/        # Vitest test suites (127 tests)
│   ├── auth.ts           # Better Auth configuration
│   ├── db.ts             # PostgreSQL connection pool
│   └── app.ts            # Express app setup
├── Dockerfile            # Production container
└── railway.json          # Railway deployment config
```

**Database Schema:**

The database uses a normalized relational design:

```
user ─────────────┬──────────────── session
                  │
                  ├──────────────── account (auth providers)
                  │
                  ├──────────────── league_member ──── league
                  │                      │
                  └──── prediction ──────┴──── match ──── matchday ──── gameweek ──── season
                                               │
                                         team ─┴─ team
```

**Key Tables:**
- `user` - User accounts with Better Auth fields + custom (username, firstName, lastName, favoriteTeamId)
- `season` - Premier League or Champions League seasons
- `gameweek` - Collection of matches with deadline and status (upcoming/active/completed)
- `matchday` - Groups matches by date within a gameweek
- `match` - Individual fixtures with teams, kickoff time, and final scores
- `team` - Club information with logos
- `league` - Private prediction leagues with invite codes
- `league_member` - User membership with role (admin/member)
- `prediction` - User predictions linked to match and league
- `user_league_standing` - Cached leaderboard data for performance

**API Design:**

RESTful endpoints with consistent patterns:

| Endpoint | Description |
|----------|-------------|
| `GET /api/fixtures/gameweek/current/:competition` | Current active gameweek |
| `GET /api/fixtures/gameweek/:id` | Gameweek details with matches |
| `POST /api/predictions/:leagueId/gameweek/:gameweekId` | Submit predictions |
| `GET /api/leaderboard/:leagueId` | League standings |
| `POST /api/leagues` | Create league (admin only) |
| `POST /api/leagues/join` | Join via invite code |

**Security Measures:**
- Session-based authentication with HTTP-only cookies
- CSRF protection via SameSite cookie attribute
- Input sanitization preventing XSS attacks
- SQL injection prevention through parameterized queries
- Email verification required before login
- Admin-only routes protected by email whitelist

### Frontend Architecture

**Tech Stack:**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (fast HMR, optimized builds)
- **Styling**: Tailwind CSS with custom glassmorphism design
- **Auth Client**: Better Auth React hooks

**Component Structure:**
```
frontend/src/
├── components/
│   ├── Dashboard.tsx     # Main app shell, navigation, all views
│   ├── Predictions.tsx   # Match prediction form
│   ├── LoginForm.tsx     # Authentication UI with demo button
│   ├── SignUpForm.tsx    # Registration with validation
│   ├── TeamSelector.tsx  # Favorite team picker
│   └── VerifyEmail.tsx   # Email verification handler
├── lib/
│   ├── api.ts            # Typed API client functions
│   ├── auth.ts           # Better Auth client setup
│   └── validation.ts     # Form validation utilities
└── types/
    ├── fixtures.ts       # Match, gameweek, team types
    └── predictions.ts    # Prediction-related types
```

**State Management:**
- React hooks for local component state
- Better Auth's `useSession()` for authentication state
- Prop drilling for shared state (leagues, predictions)
- No external state library needed due to focused scope

**UI/UX Design:**
- Dark theme with gradient backgrounds
- Glassmorphism cards (backdrop-blur, transparency)
- Responsive layout for mobile and desktop
- Real-time countdown timers for deadlines
- Team logos and visual hierarchy for leaderboards

### Data Flow

**Prediction Submission:**
```
User Input → Validation → API Call → DB Transaction → Response
    │                         │
    │                         ├── Verify user is league member
    │                         ├── Check deadline hasn't passed
    │                         ├── Validate score ranges (0-20)
    │                         └── Upsert prediction record
    │
    └── Optimistic UI update on success
```

**Leaderboard Calculation:**
```
Request → Aggregate Query → Rank Assignment → Response
              │
              ├── Sum points from all predictions
              ├── Count exact scores and correct results
              ├── Join with user profile data
              └── Order by total points DESC
```

### Testing

**Backend Tests (Vitest):**
- `auth.test.ts` - Registration, login, session management
- `security.test.ts` - SQL injection, XSS, input validation
- `leagues.test.ts` - CRUD operations, membership, admin restrictions
- `predictions.test.ts` - Submission, scoring logic, deadline enforcement
- `leaderboard.test.ts` - Rankings, season completion
- `fixtures.test.ts` - Gameweek retrieval, competition filtering
- `user.test.ts` - Profile updates, favorite team

Run tests:
```bash
cd backend && npm test
```

All 127 tests passing.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (or Neon account for serverless)
- Football-Data.org API key (free tier available)
- Resend API key (for emails)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Qadzilla/scorecast.git
   cd scorecast
   ```

2. **Install dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Configure environment variables**

   Backend (`backend/.env`):
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/scorecast
   PORT=3000
   CORS_ORIGIN=http://localhost:5173
   BETTER_AUTH_SECRET=your-secret-key-here
   BETTER_AUTH_URL=http://localhost:3000
   RESEND_API_KEY=re_your_api_key
   FOOTBALL_DATA_API_KEY=your-football-data-key
   ADMIN_EMAIL=your-email@example.com
   ```

   Frontend (`frontend/.env`):
   ```env
   VITE_API_URL=http://localhost:3000
   VITE_ADMIN_EMAIL=your-email@example.com
   ```

4. **Start PostgreSQL** (or use Neon connection string)
   ```bash
   # Using Docker
   docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password -e POSTGRES_DB=scorecast postgres:16
   ```

5. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

6. **Sync fixture data**
   ```bash
   cd backend && npx tsx src/scripts/seed.ts
   ```

7. **Open the app**

   Navigate to `http://localhost:5173`

### Production Deployment

**Backend (Railway):**
1. Create a Railway project and connect your GitHub repo
2. Set root directory to `backend`
3. Add environment variables:
   - `DATABASE_URL` - Neon PostgreSQL connection string
   - `BETTER_AUTH_SECRET` - Secure random string
   - `BETTER_AUTH_URL` - https://your-backend.railway.app
   - `CORS_ORIGIN` - https://your-frontend.vercel.app
   - `RESEND_API_KEY`
   - `FOOTBALL_DATA_API_KEY`
   - `ADMIN_EMAIL`

**Frontend (Vercel):**
1. Import your GitHub repo to Vercel
2. Set root directory to `frontend`
3. Add environment variables:
   - `VITE_API_URL` - https://your-backend.railway.app
   - `VITE_ADMIN_EMAIL`

**Custom Domain:**
1. Add A record pointing to Vercel IP for frontend
2. Add CNAME record for `api` subdomain pointing to Railway

---

## License

MIT

---

Built with caffeine and football passion.
