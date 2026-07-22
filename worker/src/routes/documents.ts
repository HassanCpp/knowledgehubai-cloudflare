import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnly } from '../middleware/roles.middleware';
import { ingestDocument, deleteDocumentFull } from '../services/ingestion.service';
import { listDocuments, findDocumentById } from '../db/queries';
import type { Env, HonoVars } from '../types';

const documents = new Hono<{ Bindings: Env; Variables: HonoVars }>();

// All document routes require authentication
documents.use('*', authMiddleware);

// GET /api/documents — list all documents
documents.get('/', async (c) => {
  const docs = await listDocuments(c.env.DB);
  return c.json(docs);
});

// POST /api/documents/upload — upload and ingest a file
documents.post('/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return c.json({ error: 'No file provided' }, 400);

  const MAX_SIZE = parseInt(c.env.MAX_FILE_SIZE_BYTES ?? '5242880');
  if (file.size > MAX_SIZE) {
    return c.json({ error: `File too large. Maximum size is ${MAX_SIZE / 1024 / 1024}MB` }, 413);
  }

  const buffer = await file.arrayBuffer();
  const result = await ingestDocument(c.env, {
    fileBuffer: buffer,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    originalName: file.name,
  });

  return c.json(result, 201);
});

// GET /api/documents/:id — get document details
documents.get('/:id', async (c) => {
  const doc = await findDocumentById(c.env.DB, c.req.param('id')!);
  if (!doc) return c.json({ error: 'Document not found' }, 404);
  return c.json(doc);
});

// DELETE /api/documents/:id — admin only
documents.delete('/:id', adminOnly, async (c) => {
  const id = c.req.param('id')!;
  const doc = await findDocumentById(c.env.DB, id);
  if (!doc) return c.json({ error: 'Document not found' }, 404);

  await deleteDocumentFull(c.env, id);
  return c.json({ message: 'Document deleted successfully' });
});

export default documents;
