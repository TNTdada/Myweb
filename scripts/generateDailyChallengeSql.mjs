import { generateDailyChallenges } from "../assets/js/challenges/dailyGenerator.js";

const MODE_TITLES = {
  classic: "经典挑战",
  taps: "点开挑战",
  treasure_hunt: "寻宝挑战",
  detonation: "引爆挑战",
  flags: "插旗挑战"
};

const TIER_LABELS = {
  easy: "简单",
  medium: "中等",
  hard: "困难"
};

const DIFFICULTY_MAP = {
  easy: "beginner",
  medium: "intermediate",
  hard: "expert"
};

const args = parseArgs(process.argv.slice(2));
const today = args.today || localDateString(new Date());
const from = args.from || addDays(today, -29);
const days = Number(args.days || 31);

if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isInteger(days) || days < 1) {
  console.error("Usage: node scripts/generateDailyChallengeSql.mjs --from YYYY-MM-DD --days 31 --today YYYY-MM-DD");
  process.exit(1);
}

const rows = [];
for (let offset = 0; offset < days; offset += 1) {
  const date = addDays(from, offset);
  const isPublished = date <= today;
  rows.push(...generateDailyChallenges(date).map((challenge) => toSqlRow(challenge, isPublished)));
}

console.log(buildSql(rows));

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value.startsWith("--")) {
      parsed[value.slice(2)] = values[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function toSqlRow(challenge, isPublished) {
  const title = `${TIER_LABELS[challenge.difficultyTier]}${MODE_TITLES[challenge.mode]}`;
  return {
    challenge_date: challenge.challengeDate,
    slot_index: challenge.slotIndex,
    title,
    difficulty: DIFFICULTY_MAP[challenge.difficultyTier],
    difficulty_tier: challenge.difficultyTier,
    mode: challenge.mode,
    rows: null,
    cols: null,
    mines: null,
    mine_min: null,
    mine_max: null,
    shape_type: challenge.shapeType,
    target_count: null,
    move_limit: null,
    mine_mistake_limit: null,
    lives: null,
    xp_reward: challenge.xpReward,
    time_limit_enabled: challenge.timeLimitEnabled,
    time_limit_seconds: null,
    initial_reveal_count: null,
    initial_reveal_type: "dynamic",
    seed: challenge.seed,
    extra_rules: JSON.stringify({
      parameterMode: "session_random",
      shapeType: challenge.shapeType,
      timeLimitEnabled: challenge.timeLimitEnabled
    }),
    generation_version: "template-v2",
    config_version: 2,
    is_published: isPublished
  };
}

function buildSql(rows) {
  const columns = [
    "challenge_date",
    "slot_index",
    "title",
    "difficulty",
    "difficulty_tier",
    "mode",
    "rows",
    "cols",
    "mines",
    "mine_min",
    "mine_max",
    "shape_type",
    "target_count",
    "move_limit",
    "mine_mistake_limit",
    "lives",
    "xp_reward",
    "time_limit_enabled",
    "time_limit_seconds",
    "initial_reveal_count",
    "initial_reveal_type",
    "seed",
    "extra_rules",
    "generation_version",
    "config_version",
    "is_published",
    "publish_at",
    "expires_at"
  ];

  const values = rows.map((row) => {
    const publishAt = row.is_published ? `${row.challenge_date} 00:00:00+08` : null;
    const expiresAt = `${addDays(row.challenge_date, 31)} 00:00:00+08`;
    const rowWithDates = { ...row, publish_at: publishAt, expires_at: expiresAt };
    return `  (${columns.map((column) => sqlValue(rowWithDates[column])).join(", ")})`;
  });

  return [
    "-- Generated daily challenge upsert SQL.",
    "-- Safe to rerun: rows are matched by (challenge_date, slot_index).",
    "insert into public.daily_challenges (",
    `  ${columns.join(",\n  ")}`,
    ")",
    "values",
    `${values.join(",\n")}`,
    "on conflict (challenge_date, slot_index) do update set",
    "  title = excluded.title,",
    "  difficulty = excluded.difficulty,",
    "  difficulty_tier = excluded.difficulty_tier,",
    "  mode = excluded.mode,",
    "  rows = excluded.rows,",
    "  cols = excluded.cols,",
    "  mines = excluded.mines,",
    "  mine_min = excluded.mine_min,",
    "  mine_max = excluded.mine_max,",
    "  shape_type = excluded.shape_type,",
    "  target_count = excluded.target_count,",
    "  move_limit = excluded.move_limit,",
    "  mine_mistake_limit = excluded.mine_mistake_limit,",
    "  lives = excluded.lives,",
    "  xp_reward = excluded.xp_reward,",
    "  time_limit_enabled = excluded.time_limit_enabled,",
    "  time_limit_seconds = excluded.time_limit_seconds,",
    "  initial_reveal_count = excluded.initial_reveal_count,",
    "  initial_reveal_type = excluded.initial_reveal_type,",
    "  seed = excluded.seed,",
    "  extra_rules = excluded.extra_rules,",
    "  generation_version = excluded.generation_version,",
    "  config_version = excluded.config_version,",
    "  is_published = excluded.is_published,",
    "  publish_at = excluded.publish_at,",
    "  expires_at = excluded.expires_at,",
    "  updated_at = now();"
  ].join("\n");
}

function sqlValue(value) {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString, daysToAdd) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}
