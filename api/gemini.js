const apiKey = process.env.GEMINI_API_KEY;
const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const fallbackModels = [preferredModel, 'gemini-2.5-flash-lite', 'gemini-2.0-flash'].filter(
  (model, index, models) => models.indexOf(model) === index
);

function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

async function readRequestBody(request) {
  if (!request.body) return {};
  if (Buffer.isBuffer(request.body)) {
    const rawBufferBody = request.body.toString('utf8').replace(/^\uFEFF/, '');
    return rawBufferBody ? JSON.parse(rawBufferBody) : {};
  }
  if (typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') return JSON.parse(request.body.replace(/^\uFEFF/, ''));

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '');
  return rawBody ? JSON.parse(rawBody) : {};
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(part => part.text || '').join('').trim();
}

async function generateWithModel(modelName, prompt, jsonMode) {
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: jsonMode ? { responseMimeType: 'application/json' } : undefined,
      }),
    }
  );

  const data = await geminiResponse.json().catch(() => ({}));
  if (!geminiResponse.ok) {
    const message = data?.error?.message || geminiResponse.statusText || 'Gemini REST request failed.';
    throw new Error(`${geminiResponse.status} ${message}`);
  }

  const text = extractText(data);
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return text;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  if (!apiKey) {
    sendJson(response, 503, { error: 'Gemini API key is not configured.' });
    return;
  }

  let body;
  try {
    body = await readRequestBody(request);
  } catch (error) {
    sendJson(response, 400, {
      error: 'Invalid JSON body.',
      detail: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const { task, prompt, jsonMode } = body;
  if ((task !== 'filter' && task !== 'analysis') || typeof prompt !== 'string' || prompt.length > 20000) {
    sendJson(response, 400, {
      error: 'Invalid Gemini request.',
      received: {
        task,
        promptType: typeof prompt,
        promptLength: typeof prompt === 'string' ? prompt.length : null,
      },
    });
    return;
  }

  const modelErrors = [];

  for (const modelName of fallbackModels) {
    try {
      const text = await generateWithModel(modelName, prompt, Boolean(jsonMode));
      sendJson(response, 200, { model: modelName, text });
      return;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      modelErrors.push({ model: modelName, detail });
      console.error(`Gemini API error with ${modelName}:`, error);
    }
  }

  sendJson(response, 502, {
    error: 'Gemini request failed.',
    detail: modelErrors.map(({ model, detail }) => `${model}: ${detail}`).join(' | '),
    models: fallbackModels,
    modelErrors,
  });
}
