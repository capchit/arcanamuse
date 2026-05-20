// test-ai.ts
import 'dotenv/config';
import { aiClient, modelName } from './lib/ai/client.js'; // 👈 .js в импорте — это нормально для ESM + TS
import { isUnexpected } from "@azure-rest/ai-inference";

async function test() {
  try {
    console.log('🔄 Запрос к ИИ...');
    
    const response = await aiClient.path("/chat/completions").post({
      body: {
        messages: [{ role: "user", content: "Скажи только: ОК" }],
        temperature: 0.7,
        max_tokens: 50,
        model: modelName
      }
    });

    if (isUnexpected(response)) {
      console.error('❌ Ошибка API:', response.body);
      return;
    }

    console.log('✅ Ответ ИИ:', response.body.choices[0].message.content);
  } catch (err: any) {
    console.error('❌ Исключение:', err.message || err);
  }
}

test();