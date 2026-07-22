-- ============================================================
-- KnowledgeHubAI — Cloudflare D1 Schema
-- Run: wrangler d1 execute knowledgehubai --file=./schema.sql --remote
-- ============================================================

-- ─── 1. users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 2. sessions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ─── 3. uploaded_documents ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uploaded_documents (
  id            TEXT PRIMARY KEY,
  filename      TEXT NOT NULL,
  original_name TEXT,
  mime_type     TEXT,
  size_bytes    INTEGER DEFAULT 0,
  r2_key        TEXT,
  status        TEXT NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing', 'ready', 'failed')),
  chunk_count   INTEGER DEFAULT 0,
  error_message TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 4. document_hashes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_hashes (
  id          TEXT PRIMARY KEY,
  hash        TEXT UNIQUE NOT NULL,
  document_id TEXT REFERENCES uploaded_documents(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 5. document_chunks (parent–child tree) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS document_chunks (
  id              TEXT PRIMARY KEY,
  document_id     TEXT NOT NULL REFERENCES uploaded_documents(id) ON DELETE CASCADE,
  parent_chunk_id TEXT REFERENCES document_chunks(id) ON DELETE SET NULL,
  chunk_type      TEXT NOT NULL CHECK (chunk_type IN ('large', 'medium', 'small')),
  classification  TEXT,
  content         TEXT NOT NULL,
  token_count     INTEGER DEFAULT 0,
  vectorize_id    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chunks_document   ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_parent     ON document_chunks(parent_chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunks_type       ON document_chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_chunks_vectorize  ON document_chunks(vectorize_id);

-- ─── 5b. FTS5 virtual table for BM25 sparse retrieval ────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  chunk_id   UNINDEXED,
  content,
  tokenize = 'porter ascii'
);

-- ─── 6. chat_histories ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_histories (
  id               TEXT PRIMARY KEY,
  user_id          TEXT REFERENCES users(id) ON DELETE CASCADE,
  session_id       TEXT NOT NULL,
  original_query   TEXT NOT NULL,
  rewritten_query  TEXT,
  response_text    TEXT,
  sources          TEXT DEFAULT '[]',
  intent           TEXT,
  total_time_ms    INTEGER DEFAULT 0,
  embedding_time_ms    INTEGER DEFAULT 0,
  retrieval_time_ms    INTEGER DEFAULT 0,
  reranking_time_ms    INTEGER DEFAULT 0,
  llm_time_ms          INTEGER DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_user_session ON chat_histories(user_id, session_id);

-- ─── 7. query_logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS query_logs (
  id               TEXT PRIMARY KEY,
  query_text       TEXT NOT NULL,
  processed_query  TEXT,
  intent           TEXT,
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  response_time_ms INTEGER DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_query_logs_user ON query_logs(user_id);

-- ─── 8. retrieval_logs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retrieval_logs (
  id               TEXT PRIMARY KEY,
  query_id         TEXT REFERENCES query_logs(id) ON DELETE CASCADE,
  raw_query        TEXT,
  retrieved_chunks TEXT DEFAULT '[]',
  latency_ms       INTEGER DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 9. fallback_logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fallback_logs (
  id               TEXT PRIMARY KEY,
  query_text       TEXT NOT NULL,
  reason           TEXT,
  fallback_prompt  TEXT,
  llm_response     TEXT,
  similarity_score REAL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 10. user_memories ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_memories (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, key)
);

-- ─── 11. web_sources ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS web_sources (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  url                   TEXT NOT NULL UNIQUE,
  active                INTEGER NOT NULL DEFAULT 1,
  crawl_mode            TEXT NOT NULL DEFAULT 'single'
                          CHECK (crawl_mode IN ('single', 'domain', 'sitemap')),
  depth                 INTEGER DEFAULT 1,
  max_pages             INTEGER DEFAULT 25,
  scrape_interval_hours INTEGER DEFAULT 24,
  selector_text         TEXT,
  last_crawled          TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── 12. crawl_histories ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crawl_histories (
  id              TEXT PRIMARY KEY,
  source_id       TEXT NOT NULL REFERENCES web_sources(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('Success', 'Failed', 'Skipped')),
  page_hash       TEXT,
  chunks_added    INTEGER DEFAULT 0,
  pages_visited   INTEGER DEFAULT 0,
  pages_indexed   INTEGER DEFAULT 0,
  discovered_urls TEXT DEFAULT '[]',
  error_message   TEXT,
  crawled_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crawl_source ON crawl_histories(source_id);

-- ─── 13. system_metrics ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_metrics (
  id          TEXT PRIMARY KEY,
  metric_type TEXT NOT NULL,
  value       REAL DEFAULT 0,
  metadata    TEXT DEFAULT '{}',
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON system_metrics(metric_type);

-- ─── 14. session_summaries ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_summaries (
  session_id            TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL,
  summary_text          TEXT NOT NULL,
  last_summarized_count INTEGER DEFAULT 0,
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
