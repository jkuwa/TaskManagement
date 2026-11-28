/** カードの状態（どの列に入っているか） */
export type TaskStatus = 'todo' | 'in_progress' | 'done'

/** 優先度 */
export type Priority = 'high' | 'medium' | 'low'

/**
 * サブタスク。カードの subtasks に入る1件分と、POST /api/tasks/{taskId}/subtasks が返す JSON。
 * 項目はバックエンドの SubtaskResponse.java と同じ。
 */
export type Subtask = {
  id: number
  title: string
  /** 完了したか */
  done: boolean
}

/**
 * カード（タスク）。GET /api/tasks が返す JSON の1件分。
 * 項目はバックエンドの TaskResponse.java（レスポンス用の DTO）と同じ。
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
  /** 作成日時。"2026-11-20T01:00:00Z" の形（UTC）の文字列 */
  createdAt: string
  /** 更新日時。形は createdAt と同じ */
  updatedAt: string
  /** サブタスク（追加した順）。1件もなければ [] */
  subtasks: Subtask[]
}

/**
 * 詳細画面で編集できる項目。PUT /api/tasks/{id} で送る内容。
 * Pick<型, 'キー' | …>：型の中から指定した項目だけを取り出した型を作る
 */
export type TaskFields = Pick<Task, 'title' | 'description' | 'dueDate' | 'priority'>
