const { OpenAI } = require('openai');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn('Warning: OPENAI_API_KEY is not defined in the environment variables.');
}

const openai = new OpenAI({
  apiKey: apiKey || 'dummy-key-to-prevent-crash-during-init',
});

module.exports = openai;
