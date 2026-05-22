// lib/ai/generate.ts
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

// 👇 Фолбэк-генерация пути (если ИИ недоступен)
function generateFallbackPath(goal: string) {
  console.warn('⚠️ Используем шаблон пути для:', goal)
  return {
    archetype: "Созидатель",
    archetype_meaning: "Ты создаёшь свой уникальный путь к цели",
    stages: [
      { 
        week: 1, 
        title: "Подготовка", 
        description: `Определи первые 3 шага к цели: "${goal}". Запиши их.`, 
        stat_bonus: { vision:1, craft:0, focus:1, voice:0, resilience:0, insight:0 } 
      },
      { 
        week: 2, 
        title: "Первые действия", 
        description: "Выполни первый шаг из списка. Потрать на это 15-30 минут.", 
        stat_bonus: { vision:0, craft:1, focus:1, voice:0, resilience:1, insight:0 } 
      },
      { 
        week: 3, 
        title: "Преодоление", 
        description: "Запиши, что мешало тебе двигаться. Найди решение для одного препятствия.", 
        stat_bonus: { vision:0, craft:0, focus:1, voice:0, resilience:2, insight:0 } 
      },
      { 
        week: 4, 
        title: "Завершение", 
        description: "Подведи итоги недели. Что получилось? Что улучшить?", 
        stat_bonus: { vision:1, craft:1, focus:0, voice:0, resilience:0, insight:1 } 
      }
    ],
    weekly_advice: "Начни с малого. Лучше сделать чуть-чуть, чем не сделать ничего."
  }
}


// Генерация Пути (квестов)
export async function generatePath(goal: string) {
  // 👇 ПРОВЕРКА: если ИИ недоступен — возвращаем фолбэк
  if (!process.env.GITHUB_TOKEN) {
    return generateFallbackPath(goal)
  }

  try {
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
      console.warn('⚠️ ИИ вернул ошибку, используем шаблон')
      return generateFallbackPath(goal)
    }

    return extractJSON(response.body.choices[0].message.content);
  } catch (e) {
    console.error('❌ Ошибка генерации пути:', e)
    return generateFallbackPath(goal)
  }
}

// 👇 Фолбэк-генерация вдохновения (РАСШИРЕННЫЙ ПУЛ)
function generateFallbackInspiration() {
  const archetypes = [
    { name: "Воин", hint: "Действует с решимостью", visual: "Меч, рассекающий утренний туман", question: "Что ты защищаешь, даже когда никто не видит?", action: "Прими одно трудное решение сегодня" },
    { name: "Мудрец", hint: "Ищет истину в тишине", visual: "Древняя книга, страницы которой светятся изнутри", question: "Какой урок из прошлого готов принять тебя сейчас?", action: "Запиши одну мысль, которая пришла сегодня" },
    { name: "Творец", hint: "Превращает идеи в реальность", visual: "Руки, лепящие форму из чистого света", question: "Что ты хочешь создать, но откладываешь из-за страха?", action: "Сделай прототип или набросок за 5 минут" },
    { name: "Путешественник", hint: "Открывает новые горизонты", visual: "Тропа, уходящая за горизонт в золотом свете", question: "Куда зовёт тебя интуиция, но разум сомневается?", action: "Изучи один новый маршрут, тему или навык" },
    { name: "Хранитель", hint: "Бережёт то, что важно", visual: "Древний ключ, сияющий мягким внутренним светом", question: "Что в твоей жизни требует бережного внимания?", action: "Удели 5 минут тому, что ты ценишь" },
    { name: "Бунтарь", hint: "Ломает шаблоны ради свободы", visual: "Огонь, пробивающийся сквозь трещины в камне", question: "Какому правилу ты следуешь, хотя оно тебя ограничивает?", action: "Сделай что-то маленькое 'не по правилам' сегодня" },
    { name: "Целитель", hint: "Восстанавливает гармонию", visual: "Руки, держащие кристалл, излучающий мягкое тепло", question: "Что в тебе или вокруг нуждается в исцелении?", action: "Сделай одно доброе дело для себя или другого" },
    { name: "Шут", hint: "Находит радость в неожиданном", visual: "Маска, из-под которой видна искренняя, лучистая улыбка", question: "Где ты слишком серьёзен, хотя можно посмеяться?", action: "Позволь себе одну маленькую, безобидную глупость" },
    { name: "Наблюдатель", hint: "Видит суть за формой", visual: "Глаз, отражающий звёздное небо в зрачке", question: "Что ты замечаешь, но предпочитаешь не видеть?", action: "Запиши три наблюдения о сегодняшнем дне" },
    { name: "Алхимик", hint: "Превращает опыт в мудрость", visual: "Колба, в которой смешиваются цвета, создавая новый оттенок", question: "Какой недавний опыт может стать твоим золотом?", action: "Извлеки один урок из вчерашнего дня" }
  ]
  
  const visuals = [
    "Мягкий свет пробивается сквозь туман, освещая путь вперёд",
    "Тени на стене танцуют, рассказывая древнюю историю",
    "Звёзды складываются в новый, невиданный узор",
    "Ветер шепчет слова, которые ты почти помнишь",
    "Вода в озере отражает небо, которое ещё не наступило",
    "Пламя свечи не колеблется, хотя вокруг буря",
    "Кристалл в руке пульсирует в ритме твоего сердца",
    "Дверь, которую ты не замечал, слегка приоткрыта"
  ]
  
  const questions = [
    "Что ты откладываешь, хотя знаешь, что это важно?",
    "Какой маленький шаг сегодня изменит всё?",
    "Что ты носишь в себе, что пора отпустить?",
    "Где ты ищешь ответы, хотя они внутри?",
    "Что бы ты сделал, если бы не боялся осуждения?",
    "Какая часть тебя хочет быть услышанной?",
    "Что ты ценишь, но принимаешь как должное?",
    "Какой страх на самом деле защищает тебя от роста?"
  ]
  
  const actions = [
    "Сделай один маленький шаг к этой задаче прямо сейчас — всего 5 минут",
    "Запиши одну мысль, которая не даёт покоя, и отпусти её",
    "Позвони или напиши тому, о ком давно думал",
    "Сделай три глубоких вдоха и спроси: 'Что мне нужно услышать?'",
    "Убери одну вещь, которая больше не служит тебе",
    "Поблагодари за то, что обычно принимаешь как должное",
    "Сделай что-то красивое просто так, без цели",
    "Остановись на минуту и просто почувствуй момент"
  ]
  
  // 👇 Случайный выбор из расширенных пулов
  const archetype = archetypes[Math.floor(Math.random() * archetypes.length)]
  const visual = visuals[Math.floor(Math.random() * visuals.length)]
  const question = questions[Math.floor(Math.random() * questions.length)]
  const action = actions[Math.floor(Math.random() * actions.length)]
  
  // 👇 Случайные бонусы (1-2 очка в 1-2 стата)
  const stats = ['vision', 'craft', 'focus', 'voice', 'resilience', 'insight']
  const stat_bonus: Record<string, number> = { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 }
  const count = Math.floor(Math.random() * 2) + 1  // 1 или 2 стата получат бонус
  for (let i = 0; i < count; i++) {
    const stat = stats[Math.floor(Math.random() * stats.length)]
    stat_bonus[stat] = Math.floor(Math.random() * 2) + 1  // 1 или 2 очка
  }
  
  return {
    archetype: archetype.name,
    archetype_hint: archetype.hint,
    visual,
    question,
    action,
    stat_bonus
  }
}

// Генерация Карты Вдохновения
export async function generateInspiration() {
  // 👇 ПРОВЕРКА: если ИИ недоступен — возвращаем фолбэк
  if (!process.env.GITHUB_TOKEN) {
    return generateFallbackInspiration()
  }

  try {
    // 👇 "Соль" для уникальности: время + случайная строка + случайный контекст
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const contextSeed = ["рассвет", "полночь", "дождь", "тишина", "ветер", "огонь", "звёзды", "путь"][Math.floor(Math.random() * 8)]
    
    const prompt = `Ты — генератор УНИКАЛЬНЫХ карт вдохновения. 
    СЕССИЯ: ${nonce} | КОНТЕКСТ: ${contextSeed}
    
    ПРАВИЛА:
    1. КАЖДЫЙ раз создавай АБСОЛЮТНО новую карту. Никогда не повторяй архетипы, цитаты и советы.
    2. Используй разные источники: стоицизм, дзен, мифология, психология, искусство, наука, поэзия, природа.
    3. Цитата должна быть глубокой, неожиданной, не банальной. Избегай клише и общих фраз.
    4. Микро-действие должно быть КОНКРЕТНЫМ, выполнимым за 5 минут, разным каждый раз.
    5. Визуальный образ должен быть поэтичным, сенсорным и уникальным.
    6. Вдохновляйся контекстом "${contextSeed}", но не копируй предыдущие ответы.
    
    Верни ТОЛЬКО валидный JSON:
    {
      "archetype": "Название архетипа",
      "archetype_hint": "Короткое описание роли (1 предложение)",
      "visual": "Поэтичное описание визуального образа (2-3 предложения)",
      "question": "Глубокий, неожиданный вопрос для рефлексии",
      "action": "Конкретное микро-действие на сегодня (5 минут)",
      "stat_bonus": {"vision": 0, "craft": 0, "focus": 0, "voice": 0, "resilience": 0, "insight": 0}
    }
    
    Распредели 1-3 очка в stat_bonus логично под архетип.
    НЕ повторяй предыдущие ответы. Сессия: ${nonce}`

    const response = await aiClient.path("/chat/completions").post({
      body: {
        model: modelName,
        messages: [
          { 
            role: "system", 
            content: "Ты генерируешь уникальные карты вдохновения. Каждый ответ должен быть абсолютно новым. Отвечай только валидным JSON." 
          },
          { role: "user", content: prompt }
        ],
        // 👇 Максимальная случайность + анти-повторения
        temperature: 1.0,
        top_p: 0.95,
        frequency_penalty: 0.6,  // 👇 Штраф за повторение слов/фраз
        presence_penalty: 0.6,   // 👇 Поощрение новых тем и идей
        max_tokens: 800
      }
    });

    if (isUnexpected(response)) {
      console.warn('⚠️ ИИ вернул ошибку, используем фолбэк')
      return generateFallbackInspiration()
    }
    
    const text = response.body.choices?.[0]?.message?.content;
    if (!text) throw new Error('Пустой ответ от ИИ');
    
    // Извлекаем JSON, даже если есть маркдаун
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Валидация обязательных полей
      if (parsed.archetype && parsed.question && parsed.action) {
        return parsed;
      }
    }
    
    throw new Error('Не удалось распарсить ответ ИИ');
  } catch (e) {
    console.error('❌ Ошибка генерации вдохновения:', e)
    return generateFallbackInspiration()
  }
}