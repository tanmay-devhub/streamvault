const OpenAI = require('openai');
const fs     = require('fs');

// Groq hosts Whisper for free with an OpenAI-compatible API.
// Sign up at console.groq.com → API Keys.
const openai = new OpenAI({
  apiKey:  process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

async function transcribeVideo(audioPath) {
  const response = await openai.audio.transcriptions.create({
    file:                     fs.createReadStream(audioPath),
    model:                    'whisper-large-v3-turbo',
    response_format:          'verbose_json',
    timestamp_granularities:  ['segment'],
  });

  return {
    text:     response.text || '',
    segments: (response.segments || []).map((s) => ({
      start: parseFloat(s.start.toFixed(1)),
      end:   parseFloat(s.end.toFixed(1)),
      text:  s.text.trim(),
    })),
    language: response.language || 'en',
  };
}

module.exports = { transcribeVideo };
