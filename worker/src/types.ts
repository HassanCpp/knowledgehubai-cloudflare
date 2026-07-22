// ─── Cloudflare Worker Environment Bindings ───────────────────────────────────
export interface Env {
  // D1 Database
  DB: D1Database;

  // Vectorize Indexes
  VECTORIZE_DOCS: VectorizeIndex;    // document_chunks (1536-dim cosine)
  VECTORIZE_CACHE: VectorizeIndex;   // semantic_cache  (1536-dim cosine)

  // R2 Bucket (optional until R2 is enabled in Cloudflare Dashboard)
  R2?: R2Bucket;

  // Workers KV
  KV: KVNamespace;

  // Secrets (set via `wrangler secret put`)
  OPENAI_API_KEY: string;
  JWT_SECRET: string;

  // Variables (from wrangler.toml [vars])
  NODE_ENV: string;
  MAX_FILE_SIZE_BYTES: string;
  VECTOR_DIMENSION: string;
  JWT_EXPIRES_IN: string;
}

// ─── Hono Context Variables ───────────────────────────────────────────────────
export interface HonoVars {
  userId: string;
  userRole: string;
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface UploadedDocument {
  id: string;
  filename: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number;
  r2_key: string | null;
  status: 'processing' | 'ready' | 'failed';
  chunk_count: number;
  error_message: string | null;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  parent_chunk_id: string | null;
  chunk_type: 'large' | 'medium' | 'small';
  classification: string | null;
  content: string;
  token_count: number;
  vectorize_id: string | null;
  created_at: string;
}

export interface WebSource {
  id: string;
  name: string;
  url: string;
  active: number;
  crawl_mode: 'single' | 'domain' | 'sitemap';
  depth: number;
  max_pages: number;
  scrape_interval_hours: number;
  selector_text: string | null;
  last_crawled: string | null;
  created_at: string;
}

export interface ChatHistory {
  id: string;
  user_id: string | null;
  session_id: string;
  original_query: string;
  rewritten_query: string | null;
  response_text: string | null;
  sources: string; // JSON array string
  intent: string | null;
  total_time_ms: number;
  created_at: string;
}

// ─── Retrieval types ──────────────────────────────────────────────────────────

export interface RetrievalCandidate {
  chunkId: string;          // Vectorize vector ID or FTS chunk_id
  mongodbChunkId: string;   // D1 document_chunks.id
  score: number;            // raw similarity / BM25 score
  source: 'dense' | 'sparse';
  content?: string;
  parentChunkId?: string | null;
}

export interface RankedCandidate extends RetrievalCandidate {
  finalScore: number;
  parentContent?: string;
  filename?: string;
  documentId?: string;
}

export interface SourceCitation {
  chunkId: string;
  filename: string;
  documentId: string;
  score: number;
}

// ─── Pipeline types ───────────────────────────────────────────────────────────

export interface PreprocessResult {
  normalizedQuery: string;
  intent: string;
  rewrittenQuery: string;
  constraints: Record<string, string>;
  expandedKeywords: string[];
}

export interface ContextResult {
  contextText: string;
  sources: SourceCitation[];
}
