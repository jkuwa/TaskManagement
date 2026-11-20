/** カードの状態（どの列に入っているか） */
export type TaskStatus = 'todo' | 'in_progress' | 'done'

/** 優先度 */
export type Priority = 'high' | 'medium' | 'low'

/**
 * カード（タスク）。GET /api/tasks が返す JSON の1件分。
 * 項目はバックエンドの Task.java の getter と同じ。
 * 未設定のときに null になる項目は「| null」を付けている。
 */
export type Task = {
  id: number
  title: string
  description: string | null
  priority: Priority | null
  /** 期限。"2026-11-20" の形の文字列 */
  dueDate: string | null
  status: TaskStatus
  position: number
  createdAt: string
  updatedAt: string
}
