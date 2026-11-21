import type { Task, TaskStatus } from './types'

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
