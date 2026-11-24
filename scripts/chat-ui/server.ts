/**
 * Локальный стенд для отладки чат-агента. Только для разработки.
 *
 *   cd api
 *   npx ts-node -r dotenv/config scripts/chat-ui/server.ts
 *   открыть http://localhost:3999
 *
 * Поведение агента задаётся в agent.ts; этот файл — только цикл и HTTP.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';

const PORT = Number(process.env.CHAT_UI_PORT) || 3999;
const MAX_STEPS = 6;
const MAX_TOKENS = 3000;

const client = new Anthropic();

interface AgentConfig {
  MODEL: string;
  SYSTEM: string;
  tools: Anthropic.Tool[];
  handlers: Record<string, (input: any) => unknown | Promise<unknown>>;
}

/** Перечитывает agent.ts, чтобы правки применялись без перезапуска сервера. */
function loadAgent(): AgentConfig {
  const path = require.resolve('./agent');
  delete require.cache[path];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./agent') as AgentConfig;
}

type TraceEvent =
  | {
      type: 'model';
      step: number;
      stop_reason: string | null;
      ms: number;
      input_tokens: number;
      output_tokens: number;
      cache_read_tokens: number;
      text: string;
      tool_calls: { id: string; name: string; input: unknown }[];
    }
  | {
      type: 'tool';
      step: number;
      id: string;
      name: string;
      input: unknown;
      output: unknown;
      is_error: boolean;
      ms: number;
    }
  | { type: 'limit'; step: number };

const sessions = new Map<string, Anthropic.MessageParam[]>();

async function runTurn(sessionId: string, userText: string) {
  const agent = loadAgent();
  const messages = sessions.get(sessionId) ?? [];
  sessions.set(sessionId, messages);
  const rollbackTo = messages.length;
  const events: TraceEvent[] = [];
  let reply = '';

  messages.push({ role: 'user', content: userText });

  try {
    for (let step = 1; step <= MAX_STEPS; step++) {
      const t0 = Date.now();
      const res = await client.messages.create({
        model: agent.MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: agent.SYSTEM,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: agent.tools,
        messages,
      });
      messages.push({ role: 'assistant', content: res.content });

      const text = res.content
        .flatMap((b) => (b.type === 'text' ? [b.text] : []))
        .join('\n');
      const toolUses = res.content.flatMap((b) =>
        b.type === 'tool_use' ? [b] : [],
      );
      events.push({
        type: 'model',
        step,
        stop_reason: res.stop_reason,
        ms: Date.now() - t0,
        input_tokens: res.usage.input_tokens,
        output_tokens: res.usage.output_tokens,
        cache_read_tokens: res.usage.cache_read_input_tokens ?? 0,
        text,
        tool_calls: toolUses.map((b) => ({
          id: b.id,
          name: b.name,
          input: b.input,
        })),
      });

      if (res.stop_reason !== 'tool_use') {
        reply = text;
        break;
      }

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUses) {
        const t1 = Date.now();
        let output: unknown;
        let isError = false;
        const handler = agent.handlers[block.name];
        if (!handler) {
          output = `Unknown tool: ${block.name}`;
          isError = true;
        } else {
          try {
            output = await handler(block.input);
          } catch (err) {
            output = err instanceof Error ? err.message : String(err);
            isError = true;
          }
        }
        events.push({
          type: 'tool',
          step,
          id: block.id,
          name: block.name,
          input: block.input,
          output,
          is_error: isError,
          ms: Date.now() - t1,
        });
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: typeof output === 'string' ? output : JSON.stringify(output),
          is_error: isError,
        });
      }
      messages.push({ role: 'user', content: results });

      if (step === MAX_STEPS) {
        events.push({ type: 'limit', step });
        reply = `(остановлено: превышен лимит в ${MAX_STEPS} шагов)`;
        // История должна заканчиваться ответом ассистента, иначе следующий
        // запрос уйдёт с «висящими» результатами инструментов.
        messages.push({ role: 'assistant', content: reply });
      }
    }
  } catch (err) {
    // Откат: не оставляем в истории незавершённый ход.
    messages.length = rollbackTo;
    throw err;
  }

  return { reply, events };
}

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 100_000) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(readFileSync(join(__dirname, 'index.html')));
      return;
    }
    if (req.method === 'GET' && req.url === '/api/config') {
      const agent = loadAgent();
      send(res, 200, {
        model: agent.MODEL,
        system: agent.SYSTEM,
        tools: agent.tools,
      });
      return;
    }
    if (req.method === 'POST' && req.url === '/api/chat') {
      const body = await readJson(req);
      const sessionId = String(body.sessionId ?? '');
      const text = String(body.text ?? '').trim();
      if (!sessionId || !text) {
        send(res, 400, { error: 'sessionId and text are required' });
        return;
      }
      send(res, 200, await runTurn(sessionId, text));
      return;
    }
    if (req.method === 'POST' && req.url === '/api/reset') {
      const body = await readJson(req);
      sessions.delete(String(body.sessionId ?? ''));
      send(res, 200, { ok: true });
      return;
    }
    send(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    const status =
      err instanceof Anthropic.APIError && err.status ? err.status : 500;
    send(res, status >= 400 ? status : 500, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Chat UI: http://localhost:${PORT}`);
});
