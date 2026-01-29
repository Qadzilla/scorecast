# ScoreCast

A real-time football predictions platform for Premier League and UEFA Champions League matches. Compete with friends in private leagues, make match predictions, and climb the leaderboard throughout the season.

**Live at [scorecast.club](https://scorecast.club)**

---

## How It Works

### The Game

1. **Join or Create Leagues** - Admins create prediction leagues for Premier League or Champions League. Players join using an 8-character invite code to compete against friends, family, or colleagues.

2. **Make Predictions** - Before each gameweek deadline, predict the exact score for every match. Once the deadline passes, predictions are locked.

3. **Climb the Leaderboard** - Points accumulate across gameweeks. Track your rank and watch the standings shift throughout the season.

4. **Season Champion** - When all 38 Premier League gameweeks (or all UCL matchdays) are complete, the player with the most points wins.

### Scoring System

| Prediction Type | Points | Example |
|-----------------|--------|---------|
| **Exact Score** | 3 | Predicted 2-1, result was 2-1 |
| **Correct Result** | 1 | Predicted 3-1 (home win), result was 2-0 (home win) |
| **Wrong Result** | 0 | Predicted 2-1 (home win), result was 1-1 (draw) |

Points are calculated automatically when match results come in. The leaderboard updates in real-time as gameweeks complete.

### Features

- **Live Fixture Data** - Real match schedules from football-data.org API
- **Gameweek Deadlines** - Predictions lock before the first match kicks off
- **Multi-Competition Support** - Separate leagues for Premier League and Champions League
- **Favorite Team Badge** - Display your team's logo on the leaderboard
- **Season Completion** - Automatic champion crowning when the season ends
- **Demo Mode** - Try the app without signing up via the "Try Demo" button

---

## Architecture

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

### Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Neon serverless) |
| Auth | Better Auth (session-based, HTTP-only cookies) |
| Email | Resend |
| Hosting | Vercel (frontend), Railway (backend) |
| External API | football-data.org |

---

## Backend

### API Routes

| Endpoint | Description |
|----------|-------------|
| `GET /api/fixtures/gameweek/current/:competition` | Current active gameweek |
| `GET /api/fixtures/gameweek/:id` | Gameweek with all matches |
| `POST /api/predictions/:leagueId/gameweek/:gameweekId` | Submit predictions |
| `GET /api/leaderboard/:leagueId` | League standings |
| `POST /api/leagues` | Create league (admin only) |
| `POST /api/leagues/join` | Join via invite code |

### Database Schema

```
user ─────────────┬──────────────── session
                  │
                  ├──────────────── account
                  │
                  ├──────────────── league_member ──── league
                  │                      │
                  └──── prediction ──────┴──── match ──── matchday ──── gameweek ──── season
                                               │
                                         team ─┴─ team
```

**Key Tables:**
- `user` - Accounts with username, name, and favorite team
- `season` - Premier League or Champions League seasons
- `gameweek` - Matches grouped with deadline and status (upcoming/active/completed)
- `match` - Fixtures with teams, kickoff time, and final scores
- `league` - Private prediction leagues with invite codes
- `prediction` - User predictions linked to match and league

### Security

- Session-based auth with HTTP-only cookies
- CSRF protection via SameSite attribute
- Input sanitization preventing XSS
- Parameterized queries preventing SQL injection
- Email verification required before login
- Admin routes protected by email whitelist

---

## Frontend

### Components

| Component | Purpose |
|-----------|---------|
| `Dashboard.tsx` | Main app shell, navigation, all views |
| `Predictions.tsx` | Match prediction form with score inputs |
| `LoginForm.tsx` | Authentication with demo mode button |
| `SignUpForm.tsx` | Registration with real-time validation |
| `TeamSelector.tsx` | Favorite team picker with logos |

### UI/UX

- Dark theme with gradient backgrounds
- Glassmorphism cards (backdrop-blur, transparency)
- Responsive layout for mobile and desktop
- Real-time countdown timers for deadlines
- Team logos on leaderboard entries

---

## Data Flow

### Prediction Submission

```
User Input → Validation → API Call → DB Transaction → Response
                              │
                              ├── Verify user is league member
                              ├── Check deadline hasn't passed
                              ├── Validate score ranges (0-20)
                              └── Upsert prediction record
```

### Leaderboard Calculation

```
Request → Aggregate Query → Rank Assignment → Response
               │
               ├── Sum points from all predictions
               ├── Count exact scores and correct results
               ├── Join with user profile and favorite team
               └── Order by total points DESC
```

### Fixture Sync

Matches and scores sync automatically from football-data.org via scheduled cron job. When a match completes, prediction scores are recalculated and leaderboards update.

---

## Testing

127 backend tests covering:

- Authentication (registration, login, sessions)
- Security (SQL injection, XSS, input validation)
- Leagues (CRUD, membership, admin restrictions)
- Predictions (submission, scoring, deadline enforcement)
- Leaderboard (rankings, season completion)
- Fixtures (gameweek retrieval, competition filtering)

---

## License

MIT
