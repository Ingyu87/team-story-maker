import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

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

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: jsonMode ? { responseMimeType: 'application/json' } : undefined,
    });

    sendJson(response, 200, { text: result.response.text() });
  } catch (error) {
    console.error('Gemini API error:', error);
    sendJson(response, 500, { error: 'Gemini request failed.' });
  }
}
