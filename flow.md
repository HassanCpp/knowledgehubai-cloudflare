# KnowledgeHubAI Architectural Flow Guide

This document details the production-quality, modular architecture of the **KnowledgeHubAI** Retrieval-Augmented Generation (RAG) platform. The system is designed around Clean Architecture principles, completely avoiding framework wrappers like LangChain or LlamaIndex to ensure maximum performance, predictability, and fine-grained algorithmic control.

---

## 1. High-Level System Architecture

The platform consists of a Vite-React frontend communicating with an Express.js backend. State storage is split between **MongoDB Atlas** (transactional metadata, user sessions, chat history, raw document chunks) and **Qdrant Cloud** (vector embeddings and payload indexing).

```mermaid
graph TD
    subgraph Client ["Vite-React Client"]
        UI["UI Dashboard & Chat Workspace"]
        AuthCtx["Auth Context & Router Guards"]
        SSE["SSE Token Reader"]
    end

    subgraph Backend ["Express.js Server"]
        API["Express Routing Controllers"]
        
        subgraph Ingestion ["1. Ingestion Pipeline"]
            Parser["Document Processor Registry"]
            Chunker["Adaptive Tree Chunker"]
        end

        subgraph Search ["2. Hybrid Retrieval Engine"]
            QP["Query Pre-processor (Intent Classifier)"]
            Dense["Dense Retriever (Qdrant Cosine Search)"]
            Sparse["Sparse Retriever (Custom MongoDB BM25)"]
            RRF["Reciprocal Rank Fusion (RRF) Compiler"]
        end

        subgraph PostProcess ["3. Re-Ranking & Self-Reflection"]
            Ranker["Two-Stage Re-Ranker"]
            Reflect["Factual Self-Reflection Validator"]
        end

        subgraph Crawl ["4. Web Crawler Service"]
            Scraper["Cheerio Scraper & Content Hasher"]
            Scheduler["Recrawl Daemon"]
        end
    end

    subgraph Datastores ["Storage Tier"]
        Mongo[("MongoDB Atlas Database")]
        Qdrant[("Qdrant Vector Database")]
    end

    UI -->|API Requests & SSE Streams| API
    Parser -->|Extract Text| Chunker
    Chunker -->|Write Chunks & Hashes| Mongo
    Chunker -->|Write Vectors| Qdrant
    
    QP -->|Dense Vector Query| Qdrant
    QP -->|Sparse Text Query| Mongo
    RRF -->|Score Fused List| Ranker
    Ranker -->|Evaluate Facts| Reflect
    Reflect -->|Stream SSE Tokens| SSE

    Scraper -->|Scrape Pages| Parser
    Scheduler -->|Trigger Recrawl| Scraper
```

---

## 2. Ingestion & Document Processing Pipeline

The ingestion pipeline handles 11 distinct file formats. Files are mapped to specific processors within `DocumentProcessorRegistry.js`.

### File-to-Processor Mapping Matrix
| Extension | Processor | Strategy | Output |
| :--- | :--- | :--- | :--- |
| `.pdf` | `PDFProcessor` | Structural text extraction (`pdf-parse`) | Plain-text raw block |
| `.pdf` (scanned) | `ScannedPDFProcessor` | Vision OCR restoration via GPT-4o-mini | Clean Markdown formatting |
| `.docx` | `WordProcessor` | XML paragraph extraction (`mammoth`) | Plain text |
| `.xlsx` / `.xls` | `ExcelProcessor` | Row-by-row table extraction (`xlsx`) | Sentence-translated representation |
| `.csv` | `CSVProcessor` | Row-by-row table translation | Sentence-translated representation |
| `.png` / `.jpg` | `ImageProcessor` | GPT-4o Vision analysis | Markdown table / Entity JSON |
| `.html` / `.htm` | `HTMLProcessor` | DOM text cleanup (`cheerio`) | Boilerplate-free plain text |
| `.md` | `MarkdownProcessor` | Header-aware text parsing | Plain text |
| `.txt` | `TextProcessor` | UTF-8 raw text parsing | Plain text |
| `.pptx` | `PresentationProcessor` | Slide-by-slide text extraction | Slide-aware plain text |

### Ingestion Flow Diagram
```mermaid
flowchart TD
    A["Uploaded Document / Web Crawled Content"] --> B{"Registry Match"}
    
    B -->|PDF| C1["PDFProcessor"]
    B -->|Scanned PDF / Image| C2["Vision OCR Processor"]
    B -->|CSV / Excel| C3["Table-to-Sentence Translator"]
    B -->|HTML / Webpage| C4["HTML Boilerplate Stripper"]
    B -->|DOCX / Text| C5["Generic Text Processors"]

    C1 & C2 & C3 & C4 & C5 --> D["Raw Content Normalized"]
    
    D --> E["Content Hasher (MD5)"]
    E -->|Check Duplicate| F{"Hash Exists?"}
    F -->|Yes| G["Skip Ingestion / Abort"]
    F -->|No| H["Save Document Metadata in MongoDB"]
    
    H --> I["Pass to Adaptive Chunker"]
```

---

## 3. Adaptive Tree Chunking

Instead of standard character-based splitting, `AdaptiveChunker.js` reads the document classification (FAQ, Spreadsheet rows, Legal Clauses, Sectioned PDFs) and constructs a **Parent-Child Tree Hierarchy**:

1. **Large Chunks (Parent - ~1000 tokens)**: Retains deep semantic context, structural headers, and topic flow. Used directly for final LLM generation context.
2. **Medium Chunks (Intermediate - ~400 tokens)**: Balance of granularity and context.
3. **Small Chunks (Child - ~150 tokens)**: Focuses strictly on atomic facts, individual sentences, or questions. These are embedded and uploaded to Qdrant for semantic search.

```mermaid
graph TD
    Doc["Raw Document Text"] --> Classify["LLM Classification (FAQ, Table, Clause, Standard)"]
    
    Classify -->|FAQ type| FAQ["Question-Answer Pair Splitting"]
    Classify -->|Table type| Tab["Row-translated Semantic Splitting"]
    Classify -->|Clause type| Cls["Legal Section Paragraph Splitting"]
    Classify -->|Standard type| Std["Sentence-Boundary Splitting"]

    FAQ & Tab & Cls & Std --> Tree["Tree Hierarchy Creation"]
    
    subgraph TreeStructure ["Tree Hierarchy"]
        Large["Large Parent Chunk (Context Holder)"]
        Medium1["Medium Child Chunk 1"]
        Medium2["Medium Child Chunk 2"]
        Small1["Small Sub-Child 1 (Point Entry)"]
        Small2["Small Sub-Child 2 (Point Entry)"]
        
        Large --> Medium1 & Medium2
        Medium1 --> Small1
        Medium1 --> Small2
    end

    Small1 & Small2 -->|Embed with text-embedding-3-small| Qdrant[("Qdrant (Vectors)")]
    Large -->|Stored in DB mapped to Child IDs| Mongo[("MongoDB Atlas")]
```

*Retrieval Strategy*: When a **Small Child Chunk** matches a vector query in Qdrant, the pipeline extracts its `parentChunkId` from MongoDB and retrieves the **Large Parent Chunk** text. This supplies the LLM with the surrounding context, avoiding fragmented answers.

---

## 4. Hybrid Retrieval & Fusion Engine

To guarantee both **conceptual semantic matches** (via vectors) and **exact keyword keyword matches** (via BM25), the system executes a parallel retrieval pipeline.

```mermaid
sequenceDiagram
    autonumber
    actor User as Chat User
    participant QP as Query Pre-processor
    participant Dense as Dense Retriever (Qdrant)
    participant Sparse as Sparse Retriever (MongoDB)
    participant RRF as Reciprocal Rank Fusion (RRF)

    User->>QP: "tell me about rdeens"
    Note over QP: Normalizes query, Classifies intent,<br/>and expands keywords (Synonyms).
    
    par Parallel Vector Search
        QP->>Dense: Embed query & Search Qdrant (filtered by keyword payload indexes)
        Dense-->>RRF: Return Top-50 Dense Matches (Scores: Cosine Sim)
    and Parallel Keyword Search
        QP->>Sparse: Build MongoDB Token Regex Filter
        Sparse-->>RRF: Compute BM25 scores on candidates & Return Top-50 matches
    end

    Note over RRF: Fuses rankings using RRF formula:<br/>RRF_Score = sum( 1 / (60 + Rank_in_System) )
    RRF-->>QP: Return Fused, Deduplicated Candidate List
```

---

## 5. Two-Stage Re-Ranking & Self-Reflection

To eliminate hallucinations and prioritize business metadata, retrieved chunks pass through a rigid evaluation pipeline:

```mermaid
flowchart TD
    A["Fused Retrieval Candidate List"] --> B["Stage-1: Cross-Encoder Re-Ranking"]
    B -->|LLM Scoring| C["Score chunks 0.0 to 1.0 based on direct answerability"]
    
    C --> D["Stage-2: Business Metadata Boosting"]
    D -->|Freshness| E["Boost newer files / Penalize archived versions"]
    
    E --> F["Formulate Context Text & Compile Sources"]
    F --> G["Self-Reflection Check (Normalized Query vs Context)"]
    
    G --> H{"Is Context Sufficient to Answer?"}
    
    H -->|YES| I["Generate SSE Stream & Cite Sources"]
    
    H -->|NO| J["Dynamic Retry: Expand Synonyms & Clear Filters"]
    J --> K["Retrieve Deeper Pool & Re-Check Reflection"]
    
    K --> L{"Is Context Now Sufficient?"}
    L -->|YES| I
    L -->|NO| M["Activate Fallback Pipeline & Log Gap for Admin"]
```

### Self-Reflection Details
The system checks the user's actual **`normalizedQuery`** against the retrieved text. If the text does not contain the facts to answer the question, the system refuses to answer and triggers a general helper response. A **Fallback Log** is written to MongoDB Atlas so administrators can inspect search gaps on their Observability Dashboard.

---

## 6. Web Crawler & Scheduling Daemon

The Web Crawler allows automatic web scraping with scheduled updates:

```mermaid
loop Scheduled Recrawl Interval (cron)
    Daemon ->> DB: Fetch registered crawler profiles
    DB -->> Daemon: Active URLs list
    
    loop For each URL
        Daemon ->> Cheerio: Fetch HTML DOM
        Note over Cheerio: Strips layout markup (header, footer, nav, cookie banners)
        Cheerio -->> Daemon: Returns clean text body
        
        Daemon ->> Hash: Generate MD5 Hash
        Daemon ->> DB: Compare with past crawl hash
        
        alt Hash matches (No Change)
            Daemon ->> DB: Log skipped crawl status
        else Hash differs (Content Updated)
            Daemon ->> Ingestion: Trigger ingestion & adaptive chunking
            Note over Ingestion: Rewrites chunks & vector embeddings in databases
            Daemon ->> DB: Update latest crawl hash and metric logs
        end
    end
end
```

---

## 7. Database Collection Directory

### MongoDB Atlas Collections
1. `users`: Credentials, password hashes, and Role-Based Access Controls (RBAC - User/Admin).
2. `sessions`: active user authentication states.
3. `chatHistories`: Conversation context, queries, answers, and source citations.
4. `uploadedDocuments`: Local files meta status, size, type, and processing logs.
5. `documentChunks`: Hierarchical parent-child text blocks mapping tree relationships.
6. `queryLogs`: Full audit trail of processed queries, execution latencies, and classifications.
7. `retrievalLogs`: Detailed tracking of chunks retrieved and their matching scores.
8. `fallbackLogs`: Logs search queries that triggered self-reflection failure (used to improve knowledge base).
9. `queryCaches`: Exact keyword query response caching.
10. `semanticCaches`: Stores vector embeddings of queries for high-similarity semantic cache matching.
11. `faqCaches`: Standard question-answer caching.
12. `documentsHashes`: MD5 hashes of all ingested files for deduplication.
13. `userMemories`: Extracts profile facts about the user during chats to personalize answers.
14. `webSources`: Registered seed URLs for web crawling.
15. `crawlHistories`: Logs crawl metrics, page count, and success status.
16. `systemMetrics`: Latency records and performance stats compiled for the dashboard.

### Qdrant Cloud Vector Collections
1. `document_chunks`: Houses vector records (1536 size, Cosine distance) with payload indexes for `type`, `classification`, `documentId`, and `filename`.
2. `semantic_cache`: Stores vector indices of past queries for semantic cache lookups.
