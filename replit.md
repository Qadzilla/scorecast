# ScoreCast - Premier League & UCL Predictions

## Overview
ScoreCast is a football match prediction application for Premier League and Champions League matches. Users can create prediction leagues, make predictions, and compete with friends on leaderboards.

## Project Structure
```
├── frontend/           # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── lib/        # Auth client and API utilities
│   │   └── types/      # TypeScript type definitions
│   └── vite.config.ts  # Vite configuration (port 5000, proxy to backend)
├── backend/            # Express + TypeScript backend
│   ├── src/
│   │   ├── routes/     # API route handlers
│   │   ├── services/   # Business logic
│   │   ├── db/         # Database migrations
│   │   └── auth.ts     # Better-auth configuration
│   └── package.json
└── replit.md           # This file
```

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS 4, TypeScript
- **Backend**: Express 5, TypeScript, better-auth
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Authentication**: better-auth with email/password
- **Email**: Resend (requires RESEND_API_KEY)
- **Football Data**: football-data.org API (requires FOOTBALL_DATA_API_KEY)

## Development Workflows
- **frontend**: `cd frontend && npm run dev` - Runs on port 5000 (webview)
- **backend**: `cd backend && npm run dev` - Runs on port 3000 (console)

The frontend Vite dev server proxies `/api` requests to the backend.

## Deployment
Configured for autoscale deployment. In production:
- Frontend is built to `frontend/dist/`
- Backend serves static files from `frontend/dist/` on port 5000
- NODE_ENV is set to "production"

## Environment Variables
Required secrets (add in Secrets tab):
- `BETTER_AUTH_SECRET`: Auth session secret (auto-configured)
- `RESEND_API_KEY`: Resend email API key (for email verification)
- `FOOTBALL_DATA_API_KEY`: football-data.org API key (for match data)

Auto-configured:
- `DATABASE_URL`: PostgreSQL connection string
- `CORS_ORIGIN`: Allowed origins for CORS
- `VITE_API_URL`: Empty (uses relative URLs via proxy)
- `VITE_DEV_BYPASS`: Set to "true" to bypass login and use demo mode

## Recent Changes (Feb 2026)

### Typography Update
- **Plus Jakarta Sans font**: Modern, friendly font applied globally via Google Fonts

### Dashboard UI/UX Refresh
- **Dark gradient sidebar**: Matches header theme with purple-to-dark gradient
- **Glass-morphism cards**: Cards use backdrop blur, semi-transparent backgrounds, and enhanced shadows
- **Improved typography**: Larger, bolder headings with better visual hierarchy
- **Enhanced leaderboard**: Gradient rank badges (gold/silver/bronze) and user highlighting
- **Smooth transitions**: Navigation and hover states have 200ms transitions
- **Better buttons**: Gradient backgrounds with shadow and micro-interaction effects
- **Updated content background**: Subtle gradient from slate to gray tones
- **User standings on league cards**: Shows rank badge and points for each league

### Join League Page Redesign
- **Hero section**: Large icon with gradient background and compelling headline
- **Prominent invite input**: Large, centered input with monospace tracking for codes
- **Benefits cards**: Three-card grid explaining competing, leaderboard, and bragging rights
- **Loading spinner**: Animated spinner during join process
- **Help text**: Link to create own league if no invite code

### Account Page Redesign
- **Profile header card**: Purple gradient card with avatar, name, team badge, and quick stats
- **Stats summary**: Shows leagues joined, total points, and predictions made
- **Profile Settings card**: Username and favorite team editing with inline forms
- **Account Information card**: Read-only display of name, email, member since
- **Danger Zone**: Delete account option in a separate card
