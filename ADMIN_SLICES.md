# ScoreCast — Admin Dashboard + One-Time League-Creation Grants (AD1–AD6)

**Status:** Written 2026-07-17.
**Parents:** `lib/admin.ts` (global `isAdmin`), `routes/leagues.ts` (league gates), `routes/user.ts` (`/me`), `routes/admin.ts` (`/api/admin`), `(tabs)/account.tsx`.

## Context

"Admin" is currently one global thing — any email in `ADMIN_EMAILS` (`isAdmin(email)`) gates **everything**: creating leagues *and* managing any league. We want:
1. Only the global admin creates leagues by default (extends to grantees).
2. The admin can grant a **specific user a one-time** league-creation ability, **directly from a dashboard**.
3. A **granted creator manages their own league** (per-league admin), with the global admin as a super-admin override.
4. A **dedicated admin dashboard** reached from Account.

Result: two-tier permissions (global super-admin + per-league admin) + a one-time grant system with audit/revoke + an admin-only dashboard.

## Decisions (locked)
- Grant = **direct grant** from the dashboard (search user → grant), stored in a **grants table** for history/revoke.
- **Per-league admin refactor: yes** — creators manage their own league; global admin overrides.
- Dashboard = an **"Admin" screen from Account** (not a tab), gated on `me.data.isAdmin`.

## Permission model
- **Global super-admin** = `isAdmin(user.email)` (`ADMIN_EMAILS`).
- **Per-league admin** = `league_member.role='admin'` for that league (the creator).
- League-scoped gates become **`isAdmin(email) OR isLeagueAdmin(user.id, leagueId)`**.

## Data model — `013_league_creation_grant`
```sql
CREATE TABLE IF NOT EXISTS league_creation_grant (
  id             TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "grantedBy"    TEXT NOT NULL REFERENCES "user"(id),
  used           BOOLEAN NOT NULL DEFAULT false,
  "usedLeagueId" TEXT REFERENCES league(id) ON DELETE SET NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "usedAt"       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_grant_user ON league_creation_grant("userId");
```
One-time = one unused grant → one league. At most one unused grant per user (re-grant while pending = 409/no-op).

## Slices

| ID | Slice | Scope | Acceptance |
|----|-------|-------|------------|
| **AD1** | Per-league admin refactor (backend) | `isLeagueAdmin(userId, leagueId)` in `lib/admin.ts`; switch the 5 league gates (rename PATCH, members GET, kick DELETE, prize-pool PUT/DELETE) to `isAdmin OR isLeagueAdmin`. Create POST stays global-only. | League admin manages their league; plain member 403s; global admin unaffected. |
| **AD2** | Grant model + creation gating (backend) | `013` migration; `hasUnusedGrant`; `POST /leagues` allows `isAdmin OR grant` and consumes it; `/me.canCreateLeague`; admin endpoints `GET /admin/users`, `GET/POST/DELETE /admin/grants`. | Grant → create once → grant consumed → 2nd create 403. |
| **AD3** | Client create-gating | `Me.canCreateLeague`; gate home "Create" + `create.tsx` on it. | Normal user: no Create; grantee: once. |
| **AD4** | Dashboard shell + entry | Account "Admin" row (isAdmin) → `/admin`; `admin/_layout.tsx` + `admin/index.tsx` hub; `lib/queries/admin.ts`. | Admin-only entry → dashboard hub. |
| **AD5** | Grants screen | `admin/grants.tsx`: user search + grant + grant list + revoke. | Search → grant → listed → revoke. |
| **AD6** | Leagues overview | `GET /admin/leagues`, `DELETE /admin/leagues/:id`; `admin/leagues.tsx`. | See all leagues; delete one. |

Order: AD1 → AD2 → AD3 → AD4 → AD5 → AD6.
Future (`AD7+`): remove-user, app stats, reassign ownership.

## Shipped
- **AD1** (2026-07-17) — `isLeagueAdmin(userId, leagueId)` in `lib/admin.ts`; the 5 league-scoped gates (rename, members list, kick, prize-pool PUT/DELETE) now allow `isAdmin(email) OR isLeagueAdmin` so a league's own creator manages it, with the global admin as override. Create POST unchanged. `admin-league-perms.test.ts` (2 tests); full suite 175 green.
