// ─── knowledgehub-document-engine: Vision OCR Service ─────────────────────────

import OpenAI from 'openai';
import { SYSTEM_OCR_PROMPT } from '../prompts/ocr.prompt';

export async function performVisionOCR(
  buffer: ArrayBuffer,
  mimeType: string,
  apiKey: string,
  detail: 'auto' | 'low' | 'high' = 'high'
): Promise<string> {
  try {
    const uint8 = new Uint8Array(buffer);
    // Convert bytes to base64 using chunking to prevent max call stack size errors
    let binary = '';
    const len = uint8.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(uint8.subarray(i, Math.min(i + chunkSize, len))));
    }
    const base64 = btoa(binary);

    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}`, detail },
            },
            {
              type: 'text',
              text: SYSTEM_OCR_PROMPT,
            },
          ],
        },
      ],
    });

    return response.choices[0]?.message?.content?.trim() ?? '';
  } catch (err) {
    console.warn('Vision OCR call failed:', (err as Error).message);
    return '';
  }
}
