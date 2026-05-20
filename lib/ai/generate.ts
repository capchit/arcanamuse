import { aiClient, modelName } from './client';
import { isUnexpected } from "@azure-rest/ai-inference";

// Вспомогательная функция для извлечения чистого JSON из ответа
function extractJSON(text: string | null): any {
  if (!text) throw new Error('AI не вернул ответ');
  
  // Убираем маркдаун-блоки ```json ... ``` если модель их добавит
  const clean = text.replace(/```json\s*|\s*```/g, '').trim();
  
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('❌ Ошибка парсинга JSON:', clean);
    throw new Error('AI вернул некорректный JSON');
  }
}

// Генерация Пути (квестов)
export async function generatePath(goal: string) {
  const prompt = `Ты — проводник по пути развития в стиле RPG.
Цель пользователя: "${goal}".
1. Определи сложность (1-5) и на основе неё выбери количество квестов:
   - Сложность 1-2: 2-3 квеста
   - Сложность 3: 4-5 квестов  
   - Сложность 4-5: 6-7 квестов
   (ВСЕГДА минимум 2 квеста!)

2. Для каждого квеста укажи:
   - title: короткое название действия
   - description: что конкретно сделать (1-2 предложения)
   - stat_bonus: распредели 1-3 очка между: vision, craft, focus, voice, resilience, insight

3. Верни ТОЛЬКО валидный JSON:
{ "archetype": "Название архетипа",
  "archetype_meaning": "Краткое описание связи архетипа с целью",
  "stages": [
    {
      "week": 1,
      "title": "Название этапа",
      "description": "Конкретное задание на 15-30 минут",
      "stat_bonus": {
        "vision": 0, "craft": 0, "focus": 0, "voice": 0, "resilience": 0, "insight": 0
      }
    }
  ],
  "weekly_advice": "Один конкретный совет на первую неделю"
}
Правила:
- Распредели 3-7 очков по stat_bonus логично под задачу
- Верни ТОЛЬКО валидный JSON`;

  const response = await aiClient.path("/chat/completions").post({
    body: {
      messages: [
        { role: "system", content: "Ты помогаешь создавать игровые пути развития. Отвечай только валидным JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
      top_p: 0.9,
      max_tokens: 2048,
      model: modelName
    }
  });

  if (isUnexpected(response)) {
    console.error('❌ Ошибка API:', response.body);
    throw response.body.error || new Error('Неожиданный ответ от API');
  }

  return extractJSON(response.body.choices[0].message.content);
}

// Генерация Карты Вдохновения
export async function generateInspiration() {
  const prompt = `Ты — генератор УНИКАЛЬНЫХ карт вдохновения. 
    ПРАВИЛА:
    1. КАЖДЫЙ раз создавай АБСОЛЮТНО новую карту. Никогда не повторяй архетипы, цитаты и советы из прошлых генераций.
    2. Используй разные источники: философия стоиков, дзен-буддизм, мифология, современная психология, искусство, наука.
    3. Цитата должна быть глубокой, неожиданной и не банальной.
    4. Микро-действие должно быть КОНКРЕТНЫМ, выполнимым за 5 минут и разным каждый раз.

    Верни ТОЛЬКО валидный JSON:
    {
      "archetype": "Название архетипа",
      "archetype_hint": "Короткое описание роли (1 предложение)",
      "visual": "Описание визуального образа (2-3 предложения)",
      "question": "Глубокий вопрос для рефлексии",
      "action": "Конкретное микро-действие на сегодня",
      "stat_bonus": {"vision": 0, "craft": 0, "focus": 0, "voice": 0, "resilience": 0, "insight": 0}
    }`

  const response = await aiClient.path("/chat/completions").post({
    body: {
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.95, //  Максимальная креативность и случайность
      top_p: 0.9,
      max_tokens: 600
}
  });

  if (isUnexpected(response)) throw response.body.error;
  
  const text = response.body.choices?.[0]?.message?.content;
  if (!text) throw new Error('Пустой ответ от ИИ');
  
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return JSON.parse(jsonMatch[0]);
  
  throw new Error('Не удалось распарсить ответ ИИ');
}