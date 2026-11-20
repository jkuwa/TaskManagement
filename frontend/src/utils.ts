import type { Priority, Task, TaskStatus } from './types'

/** ボードの列。この順番で左から並べる */
export const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: '未着手' },
  { status: 'in_progress', label: '進行中' },
  { status: 'done', label: '完了' },
]

/** 優先度の表示名 */
export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

/**
 * カードを status ごとに分ける。
 * 受け取った順番（API の並び順）のまま入れるので、並べ替えはしない。
 */
export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] }
  for (const task of tasks) {
    groups[task.status].push(task)
  }
  return groups
}

/**
 * 期限をボード用の「月/日」の形にする（例："2026-11-20" → "11/20"、"2027-01-05" → "1/5"）。
 *
 * new Date() を使うとタイムゾーンによって日付がずれることがあるので、文字列を分けて数値にする。
 * Number() で "01" が 1 になるので、頭の 0 は付かない。
 */
export function formatDueDate(dueDate: string): string {
  const [, month, day] = dueDate.split('-')
  return `${Number(month)}/${Number(day)}`
}

/** 説明文が入っているか。空白だけのときは入っていない扱いにする */
export function hasDescription(description: string | null): boolean {
  return description !== null && description.trim() !== ''
}
