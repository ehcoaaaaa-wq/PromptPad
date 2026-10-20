CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE expert_packages(id TEXT PRIMARY KEY, version TEXT NOT NULL, content_hash TEXT NOT NULL);
CREATE TABLE prompts(
  id TEXT PRIMARY KEY, origin TEXT NOT NULL CHECK(origin IN ('builtin','user')),
  package_id TEXT REFERENCES expert_packages(id), expert_key TEXT, locale TEXT,
  title TEXT NOT NULL, content TEXT NOT NULL, metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(package_id, expert_key, locale)
);
CREATE TABLE prompt_variables(
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, default_value TEXT, required INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL, PRIMARY KEY(prompt_id,name)
);
CREATE TABLE tags(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE prompt_tags(
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id), PRIMARY KEY(prompt_id,tag_id)
);
CREATE TABLE prompt_user_state(
  prompt_id TEXT PRIMARY KEY REFERENCES prompts(id) ON DELETE CASCADE,
  favorite INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE settings(key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
CREATE TABLE import_runs(id INTEGER PRIMARY KEY, source_hash TEXT NOT NULL UNIQUE, completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX prompts_origin ON prompts(origin,locale);
