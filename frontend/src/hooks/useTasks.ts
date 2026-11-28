import { useEffect, useRef, useState } from 'react'
import * as api from '../api'
import type { SubtaskFields, Task, TaskFields, TaskStatus } from '../types'
import { groupByStatus, reorderTasks } from '../utils'

/**
 * 読み込みの状態。
 * loading：読み込み中 / success：読み込めた（tasks にカードが入る） / error：読み込めなかった
 */
export type LoadState =
  | { kind: 'loading' }
  | { kind: 'success'; tasks: Task[] }
  | { kind: 'error' }

/** カードを入れる場所（どの列の、何番目か） */
export type DropTarget = { status: TaskStatus; index: number }

/**
 * prev が読み込めた状態なら、tasks を update で書き換えた新しい state を返す。それ以外はそのまま返す。
 * setState((prev) => …) の中で使う。
 */
function updateTasks(prev: LoadState, update: (tasks: Task[]) => Task[]): LoadState {
  return prev.kind === 'success' ? { kind: 'success', tasks: update(prev.tasks) } : prev
}

/**
 * カードの一覧を読み込み、追加・更新・移動・削除する処理と、サブタスクを追加・更新する処理をまとめたカスタムフック。
 *
 * カスタムフック：use で始まる名前の関数の中で useState などのフックを使い、状態とその操作をまとめたもの。
 * Board（画面）からカードのデータの扱いを切り離し、Board は表示とドラッグ&ドロップに集中できるようにする。
 *
 * - 保存に失敗したときは hasSaveError を true にする（画面に「保存できませんでした」を出すため）。次に保存できたら false に戻す
 * - 前の state をもとに新しい state を作るときは、setState((prev) => …) の形で書く。
 *   保存の結果を待っている間に別の操作で state が変わっても、最新の state をもとに更新できる
 */
export function useTasks() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  // 直前の保存に失敗したか。次に保存できたら false に戻す
  const [hasSaveError, setHasSaveError] = useState(false)
  // サブタスクの保存の順番待ち。前の保存が終わってから次を送り、古い内容があとから届いて DB を上書きするのを防ぐ
  const subtaskQueueRef = useRef<Promise<void>>(Promise.resolve())

  // 画面を開いたとき（最初の表示のとき）に1回だけカードを読み込む。
  // 依存配列 [] が空なので、再表示のたびには実行されない
  useEffect(() => {
    // 読み込み中に画面が閉じられたら、結果を反映しないための目印
    let ignore = false

    api
      .fetchTasks()
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

  /**
   * カードを指定した列の一番下に追加する。
   * API が返したカード（DB が振った id・position が入っている）を、一覧の最後に足して表示する。
   * 一覧は position の順に並んでいて、新しいカードはその列で一番大きい position になるので、最後に足せばよい。
   * 保存に失敗したときは createTask が投げた例外がそのまま呼び出し元（AddForm）に伝わる。
   */
  async function addTask(status: TaskStatus, title: string) {
    const created = await api.createTask(title, status)
    setState((prev) => updateTasks(prev, (tasks) => [...tasks, created]))
  }

  /**
   * 詳細画面で編集した内容を保存し、API が返したカードで一覧の同じ id のカードを置き換える。
   * ボード上のカードにもすぐ反映される（F-17）。
   * 失敗したときは「保存できませんでした」を表示するだけで、編集はそのまま続けられる。
   * 詳細画面を閉じたあとに失敗することもあるので、例外は投げずに hasSaveError で伝える。
   */
  async function saveTask(id: number, fields: TaskFields) {
    try {
      const updated = await api.updateTask(id, fields)
      // サブタスクは画面に出ているもの（task.subtasks）を残す。
      // 保存の結果を待っている間にサブタスクを追加すると、結果のほうには入っていないことがあるため。
      // サブタスクは addSubtask などで一覧に反映しているので、画面のものが最新になっている
      setState((prev) =>
        updateTasks(prev, (tasks) =>
          tasks.map((task) => (task.id === id ? { ...updated, subtasks: task.subtasks } : task)),
        ),
      )
      setHasSaveError(false)
    } catch {
      setHasSaveError(true)
    }
  }

  /**
   * カードを指定した列の指定した位置へ移動する（F-19, F-20）。
   * API の結果を待つと動きが遅れて見えるので、先に画面上で並べ替えてから保存する。
   *
   * - 保存できたら、API が返したすべてのカードで置き換える
   * - 失敗したら「保存できませんでした」を出し、サーバーから一覧を読み直して、保存されている並びに戻す。
   *   移動する前の一覧に戻すと、保存を待っている間に追加・編集したカードまで元に戻ってしまうため
   */
  async function moveTask(id: number, target: DropTarget) {
    if (state.kind !== 'success') return
    const task = state.tasks.find((t) => t.id === id)
    if (task === undefined) return

    // 元の場所に落としたときは何もしない
    const currentIndex = groupByStatus(state.tasks)[task.status].findIndex((t) => t.id === id)
    if (task.status === target.status && currentIndex === target.index) return

    setState((prev) => updateTasks(prev, (tasks) => reorderTasks(tasks, id, target.status, target.index)))
    try {
      const tasks = await api.moveTask(id, target.status, target.index)
      setState({ kind: 'success', tasks })
      setHasSaveError(false)
    } catch {
      setHasSaveError(true)
      try {
        const tasks = await api.fetchTasks()
        setState({ kind: 'success', tasks })
      } catch {
        // 読み直しにも失敗したとき（バックエンドが止まっているなど）は、画面はそのままにする。
        // 「保存できませんでした」は出ているので、利用者は再読み込みで確かめられる
      }
    }
  }

  /**
   * カードを削除する（F-18）。確認は詳細画面（TaskDetail）で済ませてから呼ばれる。
   * 削除できたら一覧から取り除き、true を返す（Board が詳細画面を閉じる）。
   * 同じ列のカードの position はバックエンドで詰め直すが、画面上は並び順が変わらないので、
   * 一覧を読み直さずに取り除くだけでよい。
   * 失敗したときは「保存できませんでした」を出して false を返す（詳細画面を開いたままにする）。
   */
  async function deleteTask(id: number): Promise<boolean> {
    try {
      await api.deleteTask(id)
      setState((prev) => updateTasks(prev, (tasks) => tasks.filter((task) => task.id !== id)))
      setHasSaveError(false)
      return true
    } catch {
      setHasSaveError(true)
      return false
    }
  }

  /**
   * カードにサブタスクを追加する（F-21）。
   * API が返したサブタスクを、そのカードのサブタスクの最後に足して表示する（サブタスクは追加した順に並ぶ）。
   * 保存に失敗したときは、addTask と同じく例外がそのまま呼び出し元（AddForm）に伝わる。
   */
  async function addSubtask(taskId: number, title: string) {
    const created = await api.createSubtask(taskId, title)
    setState((prev) =>
      updateTasks(prev, (tasks) =>
        tasks.map((task) => (task.id === taskId ? { ...task, subtasks: [...task.subtasks, created] } : task)),
      ),
    )
  }

  /**
   * サブタスクの内容と完了したかを更新する（F-22, F-26）。
   *
   * - チェックを押してすぐに画面に出るよう、先に一覧を書き換えてから保存する
   * - 失敗しても画面はそのままにして、「保存できませんでした」を出す（hasSaveError）。例外は投げない
   * - API の結果では置き換えない。続けて操作したとき、前の操作の結果があとから届いて、
   *   画面の新しい状態を古い状態に戻してしまうため（画面のほうが最新になっている）
   * - 保存は順番待ち（subtaskQueueRef）で1つずつ送る
   */
  function updateSubtask(taskId: number, id: number, fields: SubtaskFields): Promise<void> {
    setState((prev) =>
      updateTasks(prev, (tasks) =>
        tasks.map((task) =>
          task.id === taskId
            ? { ...task, subtasks: task.subtasks.map((subtask) => (subtask.id === id ? { ...subtask, ...fields } : subtask)) }
            : task,
        ),
      ),
    )
    const saving = subtaskQueueRef.current.then(async () => {
      try {
        await api.updateSubtask(taskId, id, fields)
        setHasSaveError(false)
      } catch {
        setHasSaveError(true)
      }
    })
    subtaskQueueRef.current = saving
    return saving
  }

  return { state, hasSaveError, addTask, saveTask, moveTask, deleteTask, addSubtask, updateSubtask }
}
