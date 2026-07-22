// ─── Image Processor — GPT-4o Vision OCR ─────────────────────────────────────
// Sends base64-encoded image to OpenAI Vision API for structured text extraction.

import OpenAI from 'openai';

export async function parseImage(buffer: ArrayBuffer, mimeType: string, apiKey: string): Promise<string> {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
          },
          {
            type: 'text',
            text: `You are a precise document analysis assistant. Extract ALL text content from this image.
If this contains a table, output it as a markdown table.
If this is a scanned document, transcribe every word verbatim.
If this contains charts, describe the data in plain text.
Return ONLY the extracted content with no preamble.`,
          },
        ],
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? '';
}
