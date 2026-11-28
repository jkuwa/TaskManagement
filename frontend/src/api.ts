import type { Subtask, SubtaskFields, Task, TaskFields, TaskStatus } from './types'

/**
 * API がエラーを返したときに投げる例外。
 * status：HTTP のステータス（404 など）、message：エラーの理由
 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * API にリクエストを送り、成功したら本文（JSON）を返す。すべての API 呼び出しはこの関数を通す。
 *
 * - fetch は 404 や 500 が返っても例外を投げないので、res.ok（ステータスが 200 番台かどうか）を見て、
 *   失敗なら ApiError を投げる
 * - バックエンドはエラーの理由を ProblemDetail（{"status":400,"detail":"タイトルを入力してください",…}）で返すので、
 *   detail があればそれを、なければ fallbackMessage をエラーの理由にする
 * - 本文のない成功（204 No Content）のときは undefined を返す（本文がないのに res.json() を呼ぶと例外になるため）
 *
 * <T> は「この関数が返す値の型」を呼ぶ側で決められるようにするための書き方（ジェネリクス）。
 * 例：request<Task[]>(…) なら Task[] を返す
 *
 * @param url             リクエストを送る URL
 * @param init            fetch の設定（method・body など）。省略すると GET
 * @param fallbackMessage エラーの理由が読み取れなかったときのメッセージ
 */
async function request<T>(url: string, init: RequestInit | undefined, fallbackMessage: string): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    // 本文が JSON でないこともあるので、読めなければ null にする
    const problem: unknown = await res.json().catch(() => null)
    const detail =
      typeof problem === 'object' && problem !== null && 'detail' in problem && typeof problem.detail === 'string'
        ? problem.detail
        : `${fallbackMessage}（${res.status}）`
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json() as Promise<T>
}

/**
 * JSON を送るときの fetch の設定を作る。次の3つを指定する。
 * - method：'POST' や 'PUT'（何も書かないと GET になる）
 * - headers：Content-Type に「本文は JSON」と書く。書かないとバックエンドが JSON として読めない
 * - body：送るデータ。JSON.stringify でオブジェクトを JSON の文字列にする
 */
function jsonBody(method: 'POST' | 'PUT', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

/**
 * すべてのカードを取得する（GET /api/tasks）。
 * 並び順はバックエンドで position → id の順になっている。
 */
export function fetchTasks(): Promise<Task[]> {
  return request<Task[]>('/api/tasks', undefined, 'カードの取得に失敗しました')
}

/**
 * カードを指定した列の一番下に追加する（POST /api/tasks）。
 * 作ったカード（DB が振った id や position が入っている）を返す。
 */
export function createTask(title: string, status: TaskStatus): Promise<Task> {
  return request<Task>('/api/tasks', jsonBody('POST', { title, status }), 'カードの追加に失敗しました')
}

/**
 * カードのタイトル・説明文・期限・優先度を更新する（PUT /api/tasks/{id}）。
 * 更新したカードを返す。
 *
 * PUT は「送った内容で丸ごと置き換える」ので、4つの項目を毎回まとめて送る。
 * 説明文・期限・優先度を解除するときは null を送る。
 */
export function updateTask(id: number, fields: TaskFields): Promise<Task> {
  return request<Task>(`/api/tasks/${id}`, jsonBody('PUT', fields), 'カードの更新に失敗しました')
}

/**
 * カードを指定した列の指定した位置へ移動する（PUT /api/tasks/{id}/position）。
 * ドラッグ&ドロップしたときに使う（F-19, F-20）。
 *
 * 移動元と移動先の両方の列の並び順が変わるので、すべてのカードが返ってくる（GET /api/tasks と同じ形）。
 *
 * @param index 移動先の列の中での位置（0 始まり。動かすカード自身を除いた並びで数える）
 */
export function moveTask(id: number, status: TaskStatus, index: number): Promise<Task[]> {
  return request<Task[]>(
    `/api/tasks/${id}/position`,
    jsonBody('PUT', { status, index }),
    'カードの移動に失敗しました',
  )
}

/**
 * カードを削除する（DELETE /api/tasks/{id}）。詳細画面の［削除］で使う（F-18）。
 * 成功すると 204 No Content（本文なし）が返る。
 */
export function deleteTask(id: number): Promise<void> {
  return request<void>(`/api/tasks/${id}`, { method: 'DELETE' }, 'カードの削除に失敗しました')
}

/**
 * カードにサブタスクを追加する（POST /api/tasks/{taskId}/subtasks）。詳細画面で使う（F-21）。
 * 作ったサブタスク（DB が振った id が入っている。最初は未完了）を返す。
 */
export function createSubtask(taskId: number, title: string): Promise<Subtask> {
  return request<Subtask>(
    `/api/tasks/${taskId}/subtasks`,
    jsonBody('POST', { title }),
    'サブタスクの追加に失敗しました',
  )
}

/**
 * サブタスクの内容と完了したかを更新する（PUT /api/tasks/{taskId}/subtasks/{id}）。
 * 詳細画面で完了・未完了を切り替えたとき（F-22）と、内容を書き換えたとき（F-26）に使う。
 * 更新したサブタスクを返す。PUT なので、内容と完了したかを毎回まとめて送る。
 */
export function updateSubtask(taskId: number, id: number, fields: SubtaskFields): Promise<Subtask> {
  return request<Subtask>(
    `/api/tasks/${taskId}/subtasks/${id}`,
    jsonBody('PUT', fields),
    'サブタスクの更新に失敗しました',
  )
}

/**
 * サブタスクを削除する（DELETE /api/tasks/{taskId}/subtasks/{id}）。詳細画面の［×］で使う（F-23）。
 * 成功すると 204 No Content（本文なし）が返る。
 */
export function deleteSubtask(taskId: number, id: number): Promise<void> {
  return request<void>(`/api/tasks/${taskId}/subtasks/${id}`, { method: 'DELETE' }, 'サブタスクの削除に失敗しました')
}
