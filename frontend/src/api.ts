import type { Task } from './types'

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
