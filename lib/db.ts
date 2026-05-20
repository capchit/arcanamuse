import Database from 'better-sqlite3';
import path from 'path';

// Путь к файлу базы данных в корне проекта
const dbPath = path.join(process.cwd(), 'arcanamuse.db');
const db = new Database(dbPath);

// Оптимизация для SQLite
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Создание таблиц при инициализации
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stat_name TEXT CHECK (stat_name IN ('vision', 'craft', 'focus', 'voice', 'resilience', 'insight')),
    value INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, stat_name)
  );
  CREATE TABLE IF NOT EXISTS paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  archetype TEXT,
  archetype_meaning TEXT,  -- 
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
  CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path_id INTEGER REFERENCES paths(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_idx INTEGER,
    status TEXT DEFAULT 'pending',
    stat_bonus TEXT DEFAULT '{"vision":0,"craft":0,"focus":0,"voice":0,"resilience":0,"insight":0}',
    completed_at DATETIME
  );
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    query TEXT,
    archetype TEXT,
    visual TEXT,
    question TEXT,
    action TEXT,
    atmosphere TEXT,
    stat_bonus TEXT DEFAULT '{"vision":0,"craft":0,"focus":0,"voice":0,"resilience":0,"insight":0}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
   CREATE TABLE IF NOT EXISTS inspiration_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  archetype TEXT,
  quote TEXT,
  action TEXT,
  data TEXT, -- 👈 Хранит полный JSON карты
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export { db };

// 🔐 Авторизация
export async function registerUser(email: string, password: string) {
  try {
    db.prepare('INSERT INTO users (email, password) VALUES (?, ?)').run(email, password);
    return { success: true };
  } catch (e: any) {
    if (e.message.includes('UNIQUE constraint')) return { success: false, error: 'Этот email уже занят' };
    return { success: false, error: 'Ошибка регистрации' };
  }
}

export async function loginUser(email: string, password: string) {
  const user = db.prepare('SELECT id, email FROM users WHERE email = ? AND password = ?').get(email, password);
  if (user) return { success: true, user };
  return { success: false, error: 'Неверный email или пароль' };
}

// ️ Пути и квесты
export async function createPath(userId: number, goal: string, aiData: any) {
  const pathStmt = db.prepare('INSERT INTO paths (user_id, title, archetype) VALUES (?, ?, ?)');
  const pathInfo = pathStmt.run(userId, goal, aiData.archetype);
  const pathId = pathInfo.lastInsertRowid;

  const questStmt = db.prepare('INSERT INTO quests (path_id, title, description, order_idx, stat_bonus) VALUES (?, ?, ?, ?, ?)');
  const tx = db.transaction((stages: any[]) => {
    for (const s of stages) {
      questStmt.run(pathId, s.title, s.description, s.week - 1, JSON.stringify(s.stat_bonus));
    }
  });
  tx(aiData.stages);

  return { success: true, path: { id: pathId, title: goal, archetype: aiData.archetype } };
}

// ✅ Завершение квеста + прокачка статов
export async function completeQuest(questId: number) {
  const quest = db.prepare(`
    SELECT quests.*, paths.user_id FROM quests
    JOIN paths ON quests.path_id = paths.id
    WHERE quests.id = ?
  `).get(questId) as any;

  if (!quest) throw new Error('Квест не найден');

  // Обновляем статус квеста
  db.prepare('UPDATE quests SET status = ?, completed_at = ? WHERE id = ?')
    .run('completed', new Date().toISOString(), questId);

  // Парсим бонусы и готовим запрос для обновления статов
  const bonuses = JSON.parse(quest.stat_bonus) as Record<string, number>;
  
  // 👇 ОБЪЯВЛЯЕМ upsert (этого не хватало!)
  const upsert = db.prepare(`
    INSERT INTO user_stats (user_id, stat_name, value) 
    VALUES (?, ?, ?)
    ON CONFLICT (user_id, stat_name) 
    DO UPDATE SET value = value + ?
  `);

  // Применяем бонусы
  for (const [stat, val] of Object.entries(bonuses) as [string, number][]) {
    if (val > 0) {
      upsert.run(quest.user_id, stat, val, val);
    }
  }

  return { success: true };
}