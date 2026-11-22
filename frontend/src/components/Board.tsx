import { useEffect, useState } from 'react'
import { createTask, fetchTasks, updateTask } from '../api'
import type { Task, TaskFields, TaskStatus } from '../types'
import { COLUMNS, groupByStatus } from '../utils'
import { Column } from './Column'
import { TaskDetail } from './TaskDetail'

/**
 * 読み込みの状態。
 * loading：読み込み中 / success：読み込めた（tasks にカードが入る） / error：読み込めなかった
 */
type LoadState =
  | { kind: 'loading' }
  | { kind: 'success'; tasks: Task[] }
  | { kind: 'error' }

/**
 * ボード画面。画面を開いたときにカードを読み込み、3つの列に分けて表示する。
 * 各列からカードを追加でき、カードをクリックすると詳細画面を開いて編集できる。
 */
export function Board() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  // 詳細画面を開いているカードの id。閉じているときは null
  const [openId, setOpenId] = useState<number | null>(null)
  // 直前の保存に失敗したか。次に保存できたら false に戻す
  const [hasSaveError, setHasSaveError] = useState(false)

  // 画面を開いたとき（最初の表示のとき）に1回だけカードを読み込む。
  // 依存配列 [] が空なので、再表示のたびには実行されない
  useEffect(() => {
    // 読み込み中に画面が閉じられたら、結果を反映しないための目印
    let ignore = false

    fetchTasks()
      .then((tasks) => {
        if (!ignore) setState({ kind: 'success', tasks })
      })
      .catch(() => {
        if (!ignore) setState({ kind: 'error' })
      })

    return () => {
      ignore = true
    }
  }, [])

  if (state.kind === 'loading') {
    return <p className="message">読み込み中…</p>
  }
  if (state.kind === 'error') {
    return <p className="message message-error">データを読み込めませんでした</p>
  }

  /**
   * カードを指定した列の一番下に追加する。
   * API が返したカード（DB が振った id・position が入っている）を、一覧の最後に足して表示する。
   * 一覧は position の順に並んでいて、新しいカードはその列で一番大きい position になるので、最後に足せばよい。
   * 保存に失敗したときは createTask が投げた例外がそのまま呼び出し元（AddCardForm）に伝わる。
   */
  async function handleAdd(status: TaskStatus, title: string) {
    const created = await createTask(title, status)
    // 前の state をもとに新しい state を作る（prev を使うと、続けて追加しても取りこぼさない）
    // prev には最新の state が入っている（形はファイル上部の LoadState を参照）
    // success（{ kind: 'success', tasks: [全列のカード] }）のときだけ、tasks の最後に作ったカードを足す
    setState((prev) =>
      prev.kind === 'success' ? { kind: 'success', tasks: [...prev.tasks, created] } : prev,
    )
  }

  /**
   * 詳細画面で編集した内容を保存し、API が返したカードで一覧の同じ id のカードを置き換える。
   * ボード上のカードにもすぐ反映される（F-17）。
   * 失敗したときは「保存できませんでした」を表示するだけで、編集はそのまま続けられる。
   * 詳細画面を閉じたあとに失敗することもあるので、例外は投げずに state で伝える。
   */
  async function handleSave(id: number, fields: TaskFields) {
    try {
      const updated = await updateTask(id, fields)
      setState((prev) =>
        prev.kind === 'success'
          ? { kind: 'success', tasks: prev.tasks.map((task) => (task.id === id ? updated : task)) }
          : prev,
      )
      setHasSaveError(false)
    } catch {
      setHasSaveError(true)
    }
  }

  // groupByStatus：カードをステータス別に分ける
  const groups = groupByStatus(state.tasks)
  // 詳細画面を開いているカード。見つからなければ undefined
  const openTask = state.tasks.find((task) => task.id === openId)
  return (
    <>
      {/* 詳細画面を閉じたあとに保存に失敗したときも分かるように、ボードの上にも表示する */}
      {hasSaveError && openTask === undefined && (
        <p className="message message-error">保存できませんでした</p>
      )}
      <main className="board">
        {COLUMNS.map((column) => (
          <Column
            key={column.status}
            label={column.label}
            tasks={groups[column.status]}
            onAdd={(title) => handleAdd(column.status, title)}
            onOpen={setOpenId}
          />
        ))}
      </main>
      {openTask && (
        <TaskDetail
          // key を変えると React は別の部品として作り直すので、別のカードを開くと入力欄が初期化される
          key={openTask.id}
          task={openTask}
          hasSaveError={hasSaveError}
          onSave={(fields) => handleSave(openTask.id, fields)}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}
