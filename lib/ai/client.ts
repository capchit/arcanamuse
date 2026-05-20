import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

const token = process.env.GITHUB_TOKEN;
const endpoint = "https://models.github.ai/inference";

if (!token) {
  throw new Error("GITHUB_TOKEN не найден в .env.local");
}

// Создаём клиент точно как в официальном примере
export const aiClient = ModelClient(
  endpoint,
  new AzureKeyCredential(token)
);

// Точное название модели с официального сайта
export const modelName = "meta/Llama-4-Scout-17B-16E-Instruct";