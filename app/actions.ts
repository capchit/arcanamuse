'use server'
import { aiClient, modelName } from '@/lib/ai/client'
import { isUnexpected } from '@azure-rest/ai-inference'
import { db } from '@/lib/db'
import { generatePath, generateInspiration } from '@/lib/ai/generate'
import { revalidatePath } from 'next/cache'

function recalculateUserStats(userId: number) {
  // 1. Удаляем текущие статы
  db.prepare('DELETE FROM user_stats WHERE user_id = ?').run(userId);

  // 2. Собираем все выполненные квесты пользователя
  const quests = db.prepare(`
    SELECT q.stat_bonus FROM quests q
    JOIN paths p ON q.path_id = p.id
    WHERE p.user_id = ? AND q.status = 'completed'
  `).all(userId) as Array<{ stat_bonus: string }>;

  // 3. Суммируем заново
  const totals: Record<string, number> = {};
  for (const q of quests) {
    try {
      const bonuses = JSON.parse(q.stat_bonus);
      for (const [stat, val] of Object.entries(bonuses)) {
        if (typeof val === 'number' && val > 0) {
          totals[stat] = (totals[stat] || 0) + val;
        }
      }
    } catch (e) { console.warn('⚠️ Ошибка парсинга статов квеста:', e); }
  }

  // 4. Сохраняем
  const insert = db.prepare('INSERT INTO user_stats (user_id, stat_name, value) VALUES (?, ?, ?)');
  for (const [stat, val] of Object.entries(totals)) {
    insert.run(userId, stat, val);
  }
}
// Вспомогательная функция для отката статов
function subtractStats(userId: number, bonuses: Record<string, number>) {
  const stmt = db.prepare(`
    INSERT INTO user_stats (user_id, stat_name, value) VALUES (?, ?, ?)
    ON CONFLICT (user_id, stat_name) DO UPDATE SET value = MAX(0, value + ?)
  `);
  for (const [stat, val] of Object.entries(bonuses)) {
    if (val > 0) {
      stmt.run(userId, stat, -val, -val); // Вычитаем очки
    }
  }
}

// === АВТОРИЗАЦИЯ ===

export async function handleRegister(email: string, password: string) {
  try {
    db.prepare('INSERT INTO users (email, password) VALUES (?, ?)').run(email, password)
    return { success: true }
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) return { success: false, error: 'Этот email уже занят' }
    return { success: false, error: 'Ошибка регистрации' }
  }
}

export async function handleLogin(email: string, password: string) {
  const user = db.prepare('SELECT id, email FROM users WHERE email = ? AND password = ?').get(email, password)
  return user ? { success: true, user } : { success: false, error: 'Неверный email или пароль' }
}

// === ПУТИ И КВЕСТЫ ===

export async function createNewPath(userId: number, goal: string) {
  try {
    const aiData = await generatePath(goal)
    
    const pathStmt = db.prepare('INSERT INTO paths (user_id, title, archetype, archetype_meaning) VALUES (?, ?, ?, ?)')
    const pathInfo = pathStmt.run(userId, goal, aiData.archetype, aiData.archetype_meaning)
    const pathId = pathInfo.lastInsertRowid

    const questStmt = db.prepare('INSERT INTO quests (path_id, title, description, order_idx, stat_bonus) VALUES (?, ?, ?, ?, ?)')
    const tx = db.transaction((stages: any[]) => {
      for (const s of stages) {
        questStmt.run(pathId, s.title, s.description, s.week - 1, JSON.stringify(s.stat_bonus))
      }
    })
    tx(aiData.stages)

    revalidatePath('/my-path')
    return { success: true, pathId }
  } catch (error: any) {
    console.error('❌ Ошибка создания пути:', error)
    return { success: false, error: error.message || 'Не удалось создать путь' }
  }
}

export async function createManualPath(userId: number, title: string, archetype: string, archetype_meaning: string, stages: any[]) {
  try {
    const pathStmt = db.prepare('INSERT INTO paths (user_id, title, archetype, archetype_meaning) VALUES (?, ?, ?, ?)')
    const pathInfo = pathStmt.run(userId, title, archetype, archetype_meaning)
    const pathId = pathInfo.lastInsertRowid

    const questStmt = db.prepare('INSERT INTO quests (path_id, title, description, order_idx, stat_bonus) VALUES (?, ?, ?, ?, ?)')
    const tx = db.transaction((stages: any[]) => {
      for (const s of stages) {
        questStmt.run(pathId, s.title, s.description, s.week - 1, JSON.stringify(s.stat_bonus))
      }
    })
    tx(stages)

    revalidatePath('/my-path')
    return { success: true, pathId }
  } catch (error: any) {
    return { success: false, error: error.message || 'Не удалось создать путь' }
  }
}

export async function finishQuest(questId: number) {
  try {
    const quest = db.prepare(`
      SELECT quests.*, paths.user_id FROM quests
      JOIN paths ON quests.path_id = paths.id
      WHERE quests.id = ?
    `).get(questId) as any

    if (!quest) throw new Error('Квест не найден')

    db.prepare('UPDATE quests SET status = ?, completed_at = ? WHERE id = ?')
      .run('completed', new Date().toISOString(), questId)

    const bonuses = JSON.parse(quest.stat_bonus) as Record<string, number>
    const upsert = db.prepare(`
      INSERT INTO user_stats (user_id, stat_name, value) VALUES (?, ?, ?)
      ON CONFLICT (user_id, stat_name) DO UPDATE SET value = value + ?
    `)

    for (const [stat, val] of Object.entries(bonuses)) {
      if (val > 0) upsert.run(quest.user_id, stat, val, val)
    }

    revalidatePath('/my-path')
    revalidatePath('/profile')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Не удалось завершить квест' }
  }
}

export async function uncompleteQuest(questId: number) {
  try {
    const quest = db.prepare(`
      SELECT quests.*, paths.user_id FROM quests
      JOIN paths ON quests.path_id = paths.id
      WHERE quests.id = ?
    `).get(questId) as any

    if (!quest) throw new Error('Квест не найден')
    if (quest.status !== 'completed') return { success: true }

    const bonuses = JSON.parse(quest.stat_bonus) as Record<string, number>
    
    db.prepare('UPDATE quests SET status = ?, completed_at = ? WHERE id = ?')
      .run('pending', null, questId)

    const upsert = db.prepare(`
      INSERT INTO user_stats (user_id, stat_name, value) VALUES (?, ?, ?)
      ON CONFLICT (user_id, stat_name) DO UPDATE SET value = MAX(0, value + ?)
    `)

    for (const [stat, val] of Object.entries(bonuses)) {
      if (val > 0) upsert.run(quest.user_id, stat, -val, -val)
    }

    revalidatePath('/my-path')
    revalidatePath('/profile')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Не удалось отменить квест' }
  }
}

// ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ УДАЛЕНИЯ
export async function deleteQuest(questId: number) {
  try {
    const quest = db.prepare('SELECT * FROM quests WHERE id = ?').get(questId) as any;
    if (!quest) return { success: false, error: 'Квест не найден' };

    // Если квест был выполнен, возвращаем статы
    if (quest.status === 'completed') {
      // ✅ Явно указываем типы, чтобы val не был unknown
      const bonuses = JSON.parse(quest.stat_bonus) as Record<string, number>;
      const path = db.prepare('SELECT user_id FROM paths WHERE id = ?').get(quest.path_id) as any;
      
      const upsert = db.prepare(`
        INSERT INTO user_stats (user_id, stat_name, value) VALUES (?, ?, ?)
        ON CONFLICT (user_id, stat_name) DO UPDATE SET value = MAX(0, value + ?)
      `);
      
      for (const [stat, val] of Object.entries(bonuses)) {
        if (val > 0) upsert.run(path.user_id, stat, -val, -val);
      }
    }

    // Удаляем запись
    db.prepare('DELETE FROM quests WHERE id = ?').run(questId);
    revalidatePath('/profile');
    revalidatePath('/my-path');
    return { success: true };
  } catch (error) {
    console.error('Ошибка удаления квеста:', error);
    return { success: false, error: 'Не удалось удалить' };
  }
}

export async function getUserActivePath(userId: number, pathId?: number) {
  let query = 'SELECT * FROM paths WHERE user_id = ?'
  const params = [userId]
  if (pathId) {
    query += ' AND id = ?'
    params.push(pathId)
  } else {
    query += ' ORDER BY created_at DESC LIMIT 1'
  }
  const path = db.prepare(query).get(...params) as any
  if (!path) return null
  const quests = db.prepare('SELECT * FROM quests WHERE path_id = ? ORDER BY order_idx ASC').all(path.id) as any[]
  return { ...path, quests }
}

// === ПРОФИЛЬ ===

export async function getUserStats(userId: number) {
  const stats = db.prepare(`
    SELECT stat_name, value FROM user_stats 
    WHERE user_id = ? AND value > 0
  `).all(userId) as Array<{ stat_name: string; value: number }>

  const statsObj = Object.fromEntries(stats.map(s => [s.stat_name, s.value]))
  
  const totalPoints = Object.values(statsObj).reduce((a, b) => a + b, 0)
  const level = Math.floor(totalPoints / 10) + 1
  const progress = totalPoints % 10
  const nextLevelAt = 10
  
  const titles = ['Новичок', 'Ученик', 'Мастер', 'Эксперт', 'Легенда', 'Архимаг']
  const title = titles[Math.min(level - 1, titles.length - 1)]
  
  return { stats: statsObj, level, progress, nextLevelAt, title, totalPoints }
}

export async function getUserQuestHistory(userId: number) {
  return db.prepare(`
    SELECT q.title, q.description, q.completed_at, q.stat_bonus, p.title as path_title
    FROM quests q
    JOIN paths p ON q.path_id = p.id
    WHERE q.status = 'completed' AND p.user_id = ?
    ORDER BY q.completed_at DESC
    LIMIT 20
  `).all(userId) as Array<{
    title: string
    description: string
    completed_at: string
    stat_bonus: string
    path_title: string
  }>
}

// === ВДОХНОВЕНИЕ ===

export async function generateInspirationAction(userId: number) {
  try {
    // Вызываем основную функцию генерации
    const card = await generateInspiration()
    
    if (!card) {
      return { success: false, error: 'Карта не сгенерировалась' }
    }
    
    return { 
      success: true, 
      card: card 
    }
  } catch (e: any) {
    console.error('❌ Ошибка генерации:', e)
    return { 
      success: false, 
      error: e.message || 'Неизвестная ошибка' 
    }
  }
}
// Сохранение карты вдохновения в БД
// Сохраняем полную карту в JSON
export async function saveInspirationToHistory(userId: number, card: any) {
  try {
    db.prepare(`INSERT INTO inspiration_history (user_id, archetype, quote, action, data) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, card.archetype, card.quote, card.action, JSON.stringify(card));
    return { success: true };
  } catch (e) { return { success: false, error: 'Ошибка сохранения' }; }
}

// Получение истории вдохновения
// Получаем список (теперь с полем data)
export async function getInspirationHistory(userId: number) {
  return db.prepare('SELECT id, archetype, quote, action, data, created_at FROM inspiration_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(userId) as Array<{ 
      id: number; 
      archetype: string; 
      quote: string; 
      action: string; 
      data: string; 
      created_at: string 
    }>;
}
// Получаем одну карту по ID
export async function getInspirationById(id: number) {
  const row = db.prepare('SELECT * FROM inspiration_history WHERE id = ?').get(id) as { 
    id: number; 
    archetype: string; 
    quote: string; 
    action: string; 
    data: string; 
    created_at: string;
  } | undefined;
  
  if (!row) return null;
  try { 
    return JSON.parse(row.data); 
  } catch { 
    return { archetype: row.archetype, quote: row.quote, action: row.action }; 
  }
}

// Получение всех путей пользователя
export async function getUserPaths(userId: number) {
  return db.prepare(`
    SELECT p.id, p.title, p.archetype, p.status, p.created_at,
           COUNT(CASE WHEN q.status = 'completed' THEN 1 END) as completed_count,
           COUNT(q.id) as total_count
    FROM paths p
    LEFT JOIN quests q ON p.id = q.path_id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all(userId);
}

// Изменение статуса пути (Start/Pause)
export async function togglePathStatus(pathId: number, newStatus: 'active' | 'paused') {
  try {
    db.prepare('UPDATE paths SET status = ? WHERE id = ?').run(newStatus, pathId);
    revalidatePath('/my-path');
    revalidatePath('/profile');
    return { success: true };
  } catch (e) { return { success: false, error: 'Ошибка обновления' }; }
}
// === УПРАВЛЕНИЕ ПУТЯМИ ===

// Завершение пути (перенос в историю)
export async function completePath(pathId: number) {
  try {
    db.prepare('UPDATE paths SET status = ? WHERE id = ?').run('completed', pathId)
    revalidatePath('/profile')
    revalidatePath('/my-path')
    return { success: true }
  } catch (e) {
    return { success: false, error: 'Не удалось завершить путь' }
  }
}

// Удаление пути
export async function deletePath(pathId: number) {
  try {
    console.log('🗑️ Удаление пути:', pathId);
    const path = db.prepare('SELECT user_id FROM paths WHERE id = ?').get(pathId) as any;
    if (!path) return { success: false, error: 'Путь не найден' };

    // Сначала удаляем квесты (чтобы не было FOREIGN KEY ошибки)
    db.prepare('DELETE FROM quests WHERE path_id = ?').run(pathId);
    // Потом удаляем путь
    db.prepare('DELETE FROM paths WHERE id = ?').run(pathId);

    // Пересчитываем статы с нуля
    recalculateUserStats(path.user_id);
    
    revalidatePath('/profile');
    revalidatePath('/my-path');
    return { success: true };
  } catch (e: any) {
    console.error('❌ Ошибка удаления пути:', e);
    return { success: false, error: e.message || 'Не удалось удалить' };
  }
}

// Редактирование пути
export async function updatePath(pathId: number, updates: { title?: string; archetype?: string; archetype_meaning?: string }) {
  try {
    const setParts = []
    const params = []
    if (updates.title) { setParts.push('title = ?'); params.push(updates.title) }
    if (updates.archetype) { setParts.push('archetype = ?'); params.push(updates.archetype) }
    if (updates.archetype_meaning) { setParts.push('archetype_meaning = ?'); params.push(updates.archetype_meaning) }
    
    if (setParts.length > 0) {
      params.push(pathId)
      db.prepare(`UPDATE paths SET ${setParts.join(', ')} WHERE id = ?`).run(...params)
      revalidatePath('/profile')
      revalidatePath('/my-path')
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: 'Не удалось обновить путь' }
  }
}

// Редактирование квеста
export async function updateQuest(questId: number, updates: { title?: string; description?: string; stat_bonus?: object }) {
  try {
    const setParts = []
    const params = []
    if (updates.title) { setParts.push('title = ?'); params.push(updates.title) }
    if (updates.description) { setParts.push('description = ?'); params.push(updates.description) }
    if (updates.stat_bonus) { setParts.push('stat_bonus = ?'); params.push(JSON.stringify(updates.stat_bonus)) }
    
    if (setParts.length > 0) {
      params.push(questId)
      db.prepare(`UPDATE quests SET ${setParts.join(', ')} WHERE id = ?`).run(...params)
      revalidatePath('/profile')
      revalidatePath('/my-path')
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: 'Не удалось обновить квест' }
  }
}

// Получение завершённых путей для истории
export async function getCompletedPaths(userId: number) {
  return db.prepare(`
    SELECT p.*, 
           COUNT(CASE WHEN q.status = 'completed' THEN 1 END) as completed_count,
           COUNT(q.id) as total_count
    FROM paths p
    LEFT JOIN quests q ON p.id = q.path_id
    WHERE p.user_id = ? AND p.status = 'completed'
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all(userId)
}
// === ИИ-ДЕТАЛИЗАЦИЯ КВЕСТА ===
export async function enhanceQuestWithAI(title: string) {
  try {
    const prompt = `Для квеста "${title}" придумай:
1. Короткое описание (1-2 предложения, что конкретно сделать)
2. Бонусы к статам (распредели 1-2 очка между: vision, craft, focus, voice, resilience, insight)
Верни ТОЛЬКО JSON:
{"description": "...", "stat_bonus": {"vision": 0, "craft": 0, "focus": 0, "voice": 0, "resilience": 0, "insight": 0}}`;

    const response = await aiClient.path("/chat/completions").post({
      body: { messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 300, model: modelName }
    });
    if (isUnexpected(response)) throw response.body.error;
    const text = response.body.choices?.[0]?.message?.content;
    const match = text?.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { description: "Выполните задание для развития.", stat_bonus: { vision:1, craft:0, focus:1, voice:0, resilience:0, insight:0 } };
  } catch (e) {
    console.error(e);
    return { description: "Выполните это задание.", stat_bonus: { vision:1, craft:0, focus:0, voice:0, resilience:0, insight:1 } };
  }
}

// === РЕДАКТИРОВАНИЕ ПУТИ ПОЛНОСТЬЮ ===
export async function updatePathFull(pathId: number, title: string, quests: any[]) {
  try {
    db.prepare('UPDATE paths SET title = ? WHERE id = ?').run(title, pathId);
    db.prepare('DELETE FROM quests WHERE path_id = ?').run(pathId);
    const stmt = db.prepare('INSERT INTO quests (path_id, title, description, order_idx, stat_bonus) VALUES (?, ?, ?, ?, ?)');
    const tx = db.transaction((qs: any[]) => {
      qs.forEach((q, i) => stmt.run(pathId, q.title, q.description || "", i, JSON.stringify(q.stat_bonus)));
    });
    tx(quests);
    revalidatePath('/profile'); revalidatePath('/my-path');
    return { success: true };
  } catch (e) { return { success: false, error: 'Ошибка сохранения' }; }
}

// === ПОЛУЧИТЬ ПУТЬ ПО ID (для редактирования) ===
export async function getPathById(pathId: number) {
  const path = db.prepare('SELECT * FROM paths WHERE id = ?').get(pathId) as any;
  if (!path) return null;
  const quests = db.prepare('SELECT * FROM quests WHERE path_id = ? ORDER BY order_idx').all(pathId) as any[];
  return { ...path, quests };
}
// Сброс прогресса пользователя (уровень, статы, квесты, пути)
export async function resetUserProgress(userId: number) {
  try {
    console.log('🔄 Сброс прогресса для пользователя:', userId);
    db.prepare('DELETE FROM quests WHERE path_id IN (SELECT id FROM paths WHERE user_id = ?)').run(userId);
    db.prepare('DELETE FROM paths WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM inspiration_history WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_stats WHERE user_id = ?').run(userId);
    
    revalidatePath('/profile');
    revalidatePath('/my-path');
    return { success: true };
  } catch (e: any) {
    console.error('❌ Ошибка сброса:', e);
    return { success: false, error: e.message };
  }
}
// Проверка, существует ли пользователь в БД
export async function validateUser(userId: number) {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  return !!user
}
// Удаление карты вдохновения
export async function deleteInspiration(id: number) {
  try {
    console.log('🗑️ Удаление вдохновения:', id);
    const row = db.prepare('SELECT user_id FROM inspiration_history WHERE id = ?').get(id) as any;
    if (!row) return { success: false, error: 'Карта не найдена' };

    db.prepare('DELETE FROM inspiration_history WHERE id = ?').run(id);
    
    // Если вдохновение давало статы, пересчитываем их (или удаляем, если не давало)
    // Для надёжности пересчитываем всё
    recalculateUserStats(row.user_id);

    revalidatePath('/profile');
    return { success: true };
  } catch (e: any) {
    console.error('❌ Ошибка удаления вдохновения:', e);
    return { success: false, error: e.message || 'Не удалось удалить' };
  }
}
// Завершение пути (перевод в статус completed)
export async function finishPath(pathId: number) {
  try {
    const path = db.prepare('SELECT user_id FROM paths WHERE id = ?').get(pathId) as any;
    if (!path) return { success: false, error: 'Путь не найден' };

    // 1. Помечаем все квесты пути как выполненные
    db.prepare('UPDATE quests SET status = ?, completed_at = ? WHERE path_id = ? AND status != ?')
      .run('completed', new Date().toISOString(), pathId, 'completed');

    // 2. Меняем статус пути
    db.prepare('UPDATE paths SET status = ? WHERE id = ?').run('completed', pathId);

    // 3. Пересчитываем статы с нуля (безопасно, без дублей)
    recalculateUserStats(path.user_id);

    revalidatePath('/paths');
    revalidatePath('/my-path');
    revalidatePath('/profile');
    return { success: true };
  } catch (e: any) {
    console.error('❌ Ошибка завершения пути:', e);
    return { success: false, error: e.message || 'Не удалось завершить' };
  }
}

//  ДОБАВЬ ЭТУ ФУНКЦИЮ ВНИЗУ
export async function restorePath(pathId: number) {
  try {
    db.prepare('UPDATE paths SET status = ? WHERE id = ?').run('active', pathId);
    revalidatePath('/paths');
    revalidatePath('/my-path');
    return { success: true };
  } catch (e: any) {
    console.error('❌ Ошибка восстановления пути:', e);
    return { success: false, error: e.message || 'Не удалось восстановить' };
  }
}
// === УМНОЕ СОЗДАНИЕ ВРУЧНУЮ (Авто-заполнение ИИ) ===
export async function createSmartManualPath(userId: number, title: string, quests: any[]) {
  try {
    // 1. Генерируем архетип и значение через ИИ
    const prompt = `Путь: "${title}". Квесты: ${quests.map(q => q.title).join(', ')}. 
    Придумай подходящий архетип (1-2 слова) и краткое значение пути (1 предложение).
    Верни ТОЛЬКО JSON: {"archetype": "...", "meaning": "..."}`;

    let archetype = "Созидатель";
    let meaning = "Твой уникальный путь к цели.";
    
    try {
      const archRes = await aiClient.path("/chat/completions").post({
        body: { messages: [{ role: "user", content: prompt }], temperature: 0.8, max_tokens: 150, model: modelName }
      });
      if (!isUnexpected(archRes)) {
        const text = archRes.body.choices?.[0]?.message?.content;
        const match = text?.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          archetype = parsed.archetype || archetype;
          meaning = parsed.meaning || meaning;
        }
      }
    } catch (e) { console.warn('️ ИИ для архетипа не ответил, используем значения по умолчанию'); }

    // 2. Подготовка квестов
    const stages = quests.map((q, i) => ({
      title: q.title,
      description: q.description || `Шаг ${i+1}: ${q.title}`,
      week: i + 1,
      stat_bonus: q.stat_bonus || { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 }
    }));

    // 3. Сохранение в БД
    const pathStmt = db.prepare('INSERT INTO paths (user_id, title, archetype, archetype_meaning) VALUES (?, ?, ?, ?)')
    const pathInfo = pathStmt.run(userId, title, archetype, meaning)
    const pathId = pathInfo.lastInsertRowid

    const questStmt = db.prepare('INSERT INTO quests (path_id, title, description, order_idx, stat_bonus) VALUES (?, ?, ?, ?, ?)')
    const tx = db.transaction((stages: any[]) => {
      for (const s of stages) questStmt.run(pathId, s.title, s.description, s.week - 1, JSON.stringify(s.stat_bonus))
    })
    tx(stages)

    revalidatePath('/my-path')
    return { success: true, pathId }
  } catch (e: any) {
    console.error('❌ Ошибка умного создания:', e)
    return { success: false, error: e.message || 'Не удалось создать путь' }
  }
}