import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const fallbackModels = [preferredModel, 'gemini-2.0-flash', 'gemini-1.5-flash'].filter(
  (model, index, models) => models.indexOf(model) === index
);

function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
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

  const { task, prompt, jsonMode } = request.body || {};
  if ((task !== 'filter' && task !== 'analysis') || typeof prompt !== 'string' || prompt.length > 20000) {
    sendJson(response, 400, { error: 'Invalid Gemini request.' });
    return;
  }

  const ai = new GoogleGenerativeAI(apiKey);
  let lastError;

  for (const modelName of fallbackModels) {
    try {
      const model = ai.getGenerativeModel({ model: modelName });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: jsonMode ? { responseMimeType: 'application/json' } : undefined,
      });

      sendJson(response, 200, { model: modelName, text: result.response.text() });
      return;
    } catch (error) {
      lastError = error;
      console.error(`Gemini API error with ${modelName}:`, error);
    }
  }

  sendJson(response, 502, {
    error: 'Gemini request failed.',
    detail: lastError instanceof Error ? lastError.message : String(lastError),
    models: fallbackModels,
  });
}
