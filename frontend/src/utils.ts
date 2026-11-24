import type { Priority, Task, TaskStatus } from './types'

/** ボードの列。この順番で左から並べる */
export const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: '未着手' },
  { status: 'in_progress', label: '進行中' },
  { status: 'done', label: '完了' },
]

/** タイトルの最大文字数（docs/spec.md の F-11, F-13） */
export const MAX_TITLE_LENGTH = 100

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

/**
 * カードを指定した列の指定した位置へ動かした、新しいカードの配列を返す（F-19, F-20）。
 * ドラッグ&ドロップしたときに、API の結果を待たずに画面を先に並べ替えるために使う。
 *
 * バックエンド（TaskService の move）と同じルールで、動かしたあとの列の position を 0, 1, 2… と振り直す。
 * 元の配列やカードは書き換えない（React の state は新しいものを作って入れ替えるため）。
 *
 * @param index 移動先の列の中での位置（0 始まり。動かすカード自身を除いた並びで数える）
 */
export function reorderTasks(
  tasks: Task[],
  id: number,
  status: TaskStatus,
  index: number,
): Task[] {
  const moving = tasks.find((task) => task.id === id)
  if (moving === undefined) return tasks

  // 動かすカードを一度抜いてから列ごとに分け、移動先の列の index の位置に入れる
  const groups = groupByStatus(tasks.filter((task) => task.id !== id))
  // status を追加すると、同じ項目は後に書いた方が勝つため更新される
  groups[status].splice(index, 0, { ...moving, status })  // status（項目名）: status（変数）が省略されている

  // 列ごとに position を振り直し、左の列から順に1つの配列に戻す
  // flatMap：列ごとの配列を作り、それをつなげて1つの配列にする
  return COLUMNS.flatMap((column) =>
    groups[column.status].map((task, i) =>
      task.position === i ? task : { ...task, position: i },
    ),
  )
}

/**
 * ドラッグしているマウスの高さ（pointerY）から、列の中でカードが入る位置（index）を求める。
 * カードの真ん中より上なら、そのカードの前に入る。どのカードよりも下なら、一番下に入る。
 *
 * @param cardCenters 列のカード（ドラッグしているカードを除く）の、上から順の真ん中の高さ
 * @param pointerY    マウスの高さ
 */
export function getDropIndex(cardCenters: number[], pointerY: number): number {
  const index = cardCenters.findIndex((center) => pointerY < center)
  // findIndex は見つからないと -1 を返す。そのときは一番下
  return index === -1 ? cardCenters.length : index
}
