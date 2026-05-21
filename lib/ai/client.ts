// lib/ai/client.ts
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

const token = process.env.GITHUB_TOKEN;
const endpoint = "https://models.github.ai/inference";

// 👇 ЛЕНИВАЯ инициализация: не выбрасываем ошибку при импорте
// Ошибка будет только если реально вызвать ИИ без токена

let _aiClient: ReturnType<typeof ModelClient> | null = null;
let _clientInitialized = false;

function getAiClient() {
  if (_clientInitialized) return _aiClient;
  
  if (!token) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ GITHUB_TOKEN не установлен. Функции ИИ отключены.');
    }
    return null;
  }
  
  _aiClient = ModelClient(endpoint, new AzureKeyCredential(token));
  _clientInitialized = true;
  return _aiClient;
}

// 👇 Экспортируем прокси, который проверяет токен только при вызове
export const aiClient = new Proxy({} as ReturnType<typeof ModelClient>, {
  get: (_, prop) => {
    const client = getAiClient();
    if (!client) {
      throw new Error('GITHUB_TOKEN не установлен. ИИ-функции недоступны.');
    }
    return (client as any)[prop];
  }
});

// Точное название модели
export const modelName = "meta/Llama-4-Scout-17B-16E-Instruct";

// 👇 Вспомогательная функция: можно ли использовать ИИ
export function isAiAvailable(): boolean {
  return !!process.env.GITHUB_TOKEN;
}