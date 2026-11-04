/* Throwaway spike: how should the recognition service call Claude? */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

const RecognitionSchema = z.object({
  brand: z.string().nullable(),
  part_number: z.string().nullable(),
  barcode: z.string().nullable(),
  name: z.string(),
  name_en: z.string().nullable(),
  name_hy: z.string().nullable(),
  category_key: z.string(),
  oem_numbers: z.array(z.string()),
  fitments: z.array(
    z.object({
      make: z.string(),
      model: z.string().nullable(),
      year_from: z.number().nullable(),
      year_to: z.number().nullable(),
      engine: z.string().nullable(),
    }),
  ),
  fitment_note: z.string().nullable(),
  condition: z.enum(['new', 'used']),
  confidence: z.object({
    brand: z.number(),
    part_number: z.number(),
    barcode: z.number(),
    name: z.number(),
    category_key: z.number(),
    fitments: z.number(),
  }),
  needs_review: z.array(z.string()),
  notes_for_seller: z.string().nullable(),
});

const SYSTEM =
  'You identify automotive spare parts from photos of the box/label; fill every field of the schema; use web search to look up the part number for vehicle fitment and OEM cross-references; never invent fitment — leave fitments empty and list "fitments" in needs_review instead; write name in Russian, name_en in English, name_hy in Armenian; confidence values are 0..1';
const USER_TEXT =
  'Identify this part. Category keys you may use: brakes.pads, brakes.discs, engine.timing, filters.oil, filters.air, electrical.sensors, suspension.shock_absorbers, other.other (use the closest; other.other if none fits).';
const TOOLS = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }] as any;
const MODEL = 'claude-opus-5-5';

const client = new Anthropic();
const files = process.argv.slice(2);
const images = files.map((f) => fs.readFileSync(f).toString('base64'));
const imgBlocks = images.map((data) => ({
  type: 'image' as const,
  source: { type: 'base64' as const, media_type: 'image/png' as const, data },
}));

function usageOf(r: any) {
  return {
    input_tokens: r.usage?.input_tokens,
    output_tokens: r.usage?.output_tokens,
    web_search_requests: r.usage?.server_tool_use?.web_search_requests ?? 0,
  };
}

async function main() {
  const variant = process.env.VARIANT || 'single-call';
  const start = Date.now();
  let out: any;
  try {
    if (variant === 'single-call') {
      const r = await client.messages.parse({
        model: MODEL, max_tokens: 8000, system: SYSTEM, tools: TOOLS,
        output_config: { effort: 'high', format: zodOutputFormat(RecognitionSchema) },
        messages: [{ role: 'user', content: [...imgBlocks, { type: 'text', text: USER_TEXT }] }],
      } as any);
      out = { parsed_output: r.parsed_output, usage: usageOf(r), stop_reason: r.stop_reason };
    } else if (variant === 'beta-fallbacks') {
      const r = await (client as any).beta.messages.parse({
        model: MODEL, max_tokens: 8000, system: SYSTEM, tools: TOOLS,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        output_config: { effort: 'high', format: zodOutputFormat(RecognitionSchema) },
        messages: [{ role: 'user', content: [...imgBlocks, { type: 'text', text: USER_TEXT }] }],
      });
      out = { parsed_output: r.parsed_output, usage: usageOf(r), stop_reason: r.stop_reason };
    } else {
      const r1: any = await client.messages.create({
        model: MODEL, max_tokens: 8000, tools: TOOLS,
        system: SYSTEM + ' Return free-text findings only.',
        output_config: { effort: 'high' },
        messages: [{ role: 'user', content: [...imgBlocks, { type: 'text', text: USER_TEXT }] }],
      } as any);
      const findings = r1.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
      const r2 = await client.messages.parse({
        model: MODEL, max_tokens: 8000, system: SYSTEM,
        output_config: { effort: 'high', format: zodOutputFormat(RecognitionSchema) },
        messages: [{ role: 'user', content: [...imgBlocks, { type: 'text', text: USER_TEXT + '\n\nResearch findings:\n' + findings }] }],
      } as any);
      const u1 = usageOf(r1), u2 = usageOf(r2);
      out = { parsed_output: r2.parsed_output, usage: { input_tokens: u1.input_tokens + u2.input_tokens, output_tokens: u1.output_tokens + u2.output_tokens, web_search_requests: u1.web_search_requests }, stop_reason: r2.stop_reason };
    }
  } catch (e: any) {
    out = { error: { status: e.status, message: e.message, body: e.error } };
  }
  const rec = { run: process.env.RUN || '1', photos: files.map((f) => path.basename(f)), variant, ...out, duration_ms: Date.now() - start };
  console.log(JSON.stringify(rec, null, 2));
  const rp = '/Users/Hayk_Simonyan/Desktop/myself/zapchast/.superpowers/sdd/2026-11-04-shop-inventory/spike-results.json';
  const arr = fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')) : [];
  arr.push(rec);
  fs.writeFileSync(rp, JSON.stringify(arr, null, 2));
}
main();
