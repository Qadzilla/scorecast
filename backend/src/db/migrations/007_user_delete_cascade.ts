import type pg from "pg";

// MS5 — make a user deletable (MOBILE_PLAN.md §4.3).
//
// Every app-table FK to "user"(id) was created with no ON DELETE action
// (default NO ACTION), so deleting a user was blocked by their own
// predictions / memberships / cached scores. better-auth's own session +
// account tables already CASCADE (see db.ts); this migration brings the app
// tables in line so a single DELETE FROM "user" cleans everything up.
//
//   prediction.userId            -> CASCADE   (their picks go with them)
//   league_member.userId         -> CASCADE   (their memberships go)
//   user_gameweek_score.userId   -> CASCADE   (cached totals go)
//   user_league_standing.userId  -> CASCADE   (cached totals go)
//   league.createdBy             -> SET NULL  (leagues SURVIVE their creator;
//                                              admin-created, other members
//                                              keep playing)

// Find the FK constraint(s) on `table` that reference "user", drop them, and
// re-add a single deterministically-named FK with the desired ON DELETE.
// Idempotent: a re-run just drops and recreates the same-named constraint.
async function setUserFk(
  client: pg.PoolClient,
  table: string,
  column: string,
  action: "CASCADE" | "SET NULL"
): Promise<void> {
  const existing = await client.query<{ conname: string }>(
    `SELECT con.conname
       FROM pg_constraint con
       JOIN pg_class rel  ON rel.oid  = con.conrelid
       JOIN pg_class frel ON frel.oid = con.confrelid
      WHERE con.contype = 'f'
        AND rel.relname = $1
        AND frel.relname = 'user'`,
    [table]
  );

  for (const row of existing.rows) {
    await client.query(
      `ALTER TABLE "${table}" DROP CONSTRAINT "${row.conname}"`
    );
  }

  const name = `${table}_${column}_user_fkey`;
  await client.query(
    `ALTER TABLE "${table}"
       ADD CONSTRAINT "${name}"
       FOREIGN KEY ("${column}") REFERENCES "user"(id) ON DELETE ${action}`
  );
}

async function tableExists(client: pg.PoolClient, table: string): Promise<boolean> {
  const res = await client.query(`SELECT to_regclass($1) AS oid`, [table]);
  return res.rows[0]?.oid != null;
}

export async function up(client: pg.PoolClient): Promise<void> {
  // league.createdBy must be nullable before it can SET NULL on delete
  await client.query(`ALTER TABLE league ALTER COLUMN "createdBy" DROP NOT NULL`);
  await setUserFk(client, "league", "createdBy", "SET NULL");

  await setUserFk(client, "league_member", "userId", "CASCADE");
  await setUserFk(client, "prediction", "userId", "CASCADE");

  // better-auth's session/account tables should cascade too. db.ts creates
  // them with CASCADE, but a DB where they predate that (or the test fixture,
  // which omits it) would otherwise block user deletion. Enforce it here.
  await setUserFk(client, "session", "userId", "CASCADE");
  await setUserFk(client, "account", "userId", "CASCADE");

  // These cached-totals tables exist from migration 002 but guard anyway
  if (await tableExists(client, "user_gameweek_score")) {
    await setUserFk(client, "user_gameweek_score", "userId", "CASCADE");
  }
  if (await tableExists(client, "user_league_standing")) {
    await setUserFk(client, "user_league_standing", "userId", "CASCADE");
  }
}

export async function down(_client: pg.PoolClient): Promise<void> {
  // Intentionally irreversible: reverting to NO ACTION would reintroduce the
  // delete-blocking bug. No-op.
}
