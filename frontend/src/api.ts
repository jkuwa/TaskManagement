import type { Task, TaskFields, TaskStatus } from './types'

/**
 * すべてのカードを取得する（GET /api/tasks）。
 * 並び順はバックエンドで position → id の順になっている。
 *
 * fetch は 404 や 500 が返っても例外を投げないので、
 * res.ok（ステータスが 200 番台かどうか）を見て、失敗なら自分で例外を投げる。
 */
export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch('/api/tasks')
  if (!res.ok) {
    throw new Error(`カードの取得に失敗しました（${res.status}）`)
  }
  return res.json()
}

/**
 * カードを指定した列の一番下に追加する（POST /api/tasks）。
 * 作ったカード（DB が振った id や position が入っている）を返す。
 *
 * fetch で JSON を送るときは、次の3つを指定する。
 * - method：'POST'（何も書かないと GET になる）
 * - headers：Content-Type に「本文は JSON」と書く。書かないとバックエンドが JSON として読めない
 * - body：送るデータ。JSON.stringify でオブジェクトを JSON の文字列にする
 */
export async function createTask(title: string, status: TaskStatus): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, status }),
  })
  if (!res.ok) {
    throw new Error(`カードの追加に失敗しました（${res.status}）`)
  }
  return res.json()
}

/**
 * カードのタイトル・説明文・期限・優先度を更新する（PUT /api/tasks/{id}）。
 * 更新したカードを返す。
 *
 * PUT は「送った内容で丸ごと置き換える」ので、4つの項目を毎回まとめて送る。
 * 説明文・期限・優先度を解除するときは null を送る。
 */
export async function updateTask(id: number, fields: TaskFields): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!res.ok) {
    throw new Error(`カードの更新に失敗しました（${res.status}）`)
  }
  return res.json()
}

/**
 * カードを指定した列の指定した位置へ移動する（PUT /api/tasks/{id}/position）。
 * ドラッグ&ドロップしたときに使う（F-19, F-20）。
 *
 * 移動元と移動先の両方の列の並び順が変わるので、すべてのカードが返ってくる（GET /api/tasks と同じ形）。
 *
 * @param index 移動先の列の中での位置（0 始まり。動かすカード自身を除いた並びで数える）
 */
export async function moveTask(id: number, status: TaskStatus, index: number): Promise<Task[]> {
  const res = await fetch(`/api/tasks/${id}/position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, index }),
  })
  if (!res.ok) {
    throw new Error(`カードの移動に失敗しました（${res.status}）`)
  }
  return res.json()
}

/**
 * カードを削除する（DELETE /api/tasks/{id}）。詳細画面の［削除］で使う（F-18）。
 *
 * 成功すると 204 No Content（本文なし）が返るので、res.json() は呼ばない
 * （本文がないのに res.json() を呼ぶと例外になる）。
 */
export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw new Error(`カードの削除に失敗しました（${res.status}）`)
  }
}
