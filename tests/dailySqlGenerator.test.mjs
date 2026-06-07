import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const sql = execFileSync(
  process.execPath,
  [
    "scripts/generateDailyChallengeSql.mjs",
    "--from",
    "2026-06-07",
    "--days",
    "2",
    "--today",
    "2026-06-07"
  ],
  { encoding: "utf8" }
);

assert.match(sql, /insert into public\.daily_challenges/);
assert.match(sql, /on conflict \(challenge_date, slot_index\) do update set/);
assert.match(sql, /'2026-06-07'/);
assert.match(sql, /'2026-06-08'/);
assert.match(sql, /true/);
assert.match(sql, /false/);
assert.equal((sql.match(/\n  \('/g) || []).length, 10);

console.log("daily SQL generator tests passed");
