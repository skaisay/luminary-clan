import OpenAI from "openai";

// OpenAI client - optional, only works when API keys are provided
const openai = (process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY)
  ? new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    })
  : null;

export async function getChatCompletion(userMessage: string, systemPrompt?: string): Promise<string> {
  if (!openai) {
    return "AI функционал недоступен — ключ OpenAI не настроен.";
  }

  const messages: any[] = [];
  
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  
  messages.push({ role: "user", content: userMessage });

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages,
    max_completion_tokens: 1024,
  });

  return response.choices[0]?.message?.content || "";
}

export { openai };
