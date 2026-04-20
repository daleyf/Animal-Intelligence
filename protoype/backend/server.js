import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
const app = express();
const PORT = 3001;
const OLLAMA = 'http://localhost:11434';

app.use(cors());
app.use(express.json());

// In-memory conversation store
const conversations = new Map();

// --- Web Search (DuckDuckGo Lite — no API key, no rate-limit issues) ---
async function searchWeb(query) {
  const body = new URLSearchParams({ q: query, kl: 'us-en' });

  const res = await fetch('https://lite.duckduckgo.com/lite/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://lite.duckduckgo.com/',
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`DDG Lite returned HTTP ${res.status}`);

  const html = await res.text();

  const links = [];
  const snippets = [];

  // DDG Lite uses single-quoted attributes: class='result-link', href="..."
  const linkRe = /<a\s[^>]*class='result-link'[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>|<a\s[^>]*href="([^"]+)"[^>]*class='result-link'[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<td\s+class='result-snippet'[^>]*>([\s\S]*?)<\/td>/gi;

  let m;
  while ((m = linkRe.exec(html)) !== null && links.length < 5) {
    // Handle both attribute orderings
    const url = m[1] ?? m[3];
    const title = (m[2] ?? m[4] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (url && title) links.push({ url, title });
  }
  while ((m = snippetRe.exec(html)) !== null && snippets.length < 5) {
    const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) snippets.push(text);
  }

  return links
    .slice(0, 5)
    .map((link, i) => ({ ...link, snippet: snippets[i] ?? '' }));
}

function buildSearchContext(query, results) {
  if (!results.length) return `No web search results found for: "${query}"`;
  const formatted = results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
    .join('\n\n');
  return `Web search results for "${query}":\n\n${formatted}\n\nUse these results to answer the user's question. Cite sources with [1], [2], etc. when referencing specific information.`;
}

// --- Models ---
app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA}/api/tags`);
    if (!response.ok) throw new Error('Ollama not reachable');
    const data = await response.json();
    res.json(data.models || []);
  } catch {
    res.status(503).json({ error: 'Ollama is not running. Start it with: ollama serve' });
  }
});

// --- Conversations ---
app.get('/api/conversations', (req, res) => {
  const list = Array.from(conversations.values()).map(({ id, title, model, createdAt, messages }) => ({
    id, title, model, createdAt, messageCount: messages.length,
  }));
  res.json(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/conversations', (req, res) => {
  const { model } = req.body;
  const conv = {
    id: uuidv4(),
    title: 'New Chat',
    model: model || '',
    messages: [],
    createdAt: new Date().toISOString(),
  };
  conversations.set(conv.id, conv);
  res.json(conv);
});

app.get('/api/conversations/:id', (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  res.json(conv);
});

app.patch('/api/conversations/:id', (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  if (req.body.title) conv.title = req.body.title;
  if (req.body.model) conv.model = req.body.model;
  res.json(conv);
});

app.delete('/api/conversations/:id', (req, res) => {
  conversations.delete(req.params.id);
  res.json({ success: true });
});

// --- Chat (SSE streaming) ---
app.post('/api/chat', async (req, res) => {
  const { conversationId, message, model, webSearch = false } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
  if (!model) return res.status(400).json({ error: 'Model required' });

  let conv = conversations.get(conversationId);
  if (!conv) {
    conv = {
      id: conversationId || uuidv4(),
      title: message.length > 40 ? message.slice(0, 40) + '…' : message,
      model,
      messages: [],
      createdAt: new Date().toISOString(),
    };
    conversations.set(conv.id, conv);
  }

  conv.messages.push({ role: 'user', content: message });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Build messages to send to Ollama (don't mutate conv.messages)
  let ollamaMessages = [...conv.messages];

  // Web search: inject results as a system message before the conversation
  if (webSearch) {
    sendEvent({ status: 'Searching the web…' });
    try {
      const results = await searchWeb(message);
      const context = buildSearchContext(message, results);
      // Inject as a system turn before the user message
      ollamaMessages = [
        { role: 'system', content: context },
        ...conv.messages,
      ];
      sendEvent({ searchResults: results });
    } catch (err) {
      sendEvent({ status: `Web search failed: ${err.message}. Answering from training data.` });
    }
  }

  try {
    const ollamaRes = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: ollamaMessages, stream: true }),
    });

    if (!ollamaRes.ok) {
      const err = await ollamaRes.text();
      sendEvent({ error: err || 'Ollama error' });
      return res.end();
    }

    let fullContent = '';
    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n').filter(Boolean)) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            fullContent += parsed.message.content;
            sendEvent({ token: parsed.message.content, done: false, convId: conv.id });
          }
          if (parsed.done) {
            conv.messages.push({ role: 'assistant', content: fullContent });
            sendEvent({ done: true, convId: conv.id });
          }
        } catch { /* skip malformed lines */ }
      }
    }
  } catch (err) {
    sendEvent({ error: 'Failed to reach Ollama: ' + err.message });
  }

  res.end();
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  console.log(`Make sure Ollama is running: ollama serve`);
});
