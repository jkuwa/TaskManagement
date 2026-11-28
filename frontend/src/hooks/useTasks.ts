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
 * 保存に失敗して、画面と DB がずれたままになっているものを見分けるための名前。
 * - task:<id>：カードの内容（タイトル・説明文・期限・優先度）
 * - subtask:<id>：サブタスクの内容・完了したか
 * - board：移動に失敗し、読み直しにも失敗した（ボードの並びが DB とずれている）
 */
const taskKey = (id: number) => `task:${id}`
const subtaskKey = (id: number) => `subtask:${id}`
const BOARD_KEY = 'board'

/** set に key を足した新しい Set を返す（もう入っていれば set をそのまま返す） */
function withKey(set: ReadonlySet<string>, key: string): ReadonlySet<string> {
  return set.has(key) ? set : new Set(set).add(key)
}

/** set から keys を取り除いた新しい Set を返す（どれも入っていなければ set をそのまま返す） */
function withoutKeys(set: ReadonlySet<string>, keys: string[]): ReadonlySet<string> {
  if (!keys.some((key) => set.has(key))) return set
  const next = new Set(set)
  for (const key of keys) next.delete(key)
  return next
}

/**
 * カードの一覧を読み込み、追加・更新・移動・削除する処理と、サブタスクを追加・更新・削除する処理をまとめたカスタムフック。
 *
 * カスタムフック：use で始まる名前の関数の中で useState などのフックを使い、状態とその操作をまとめたもの。
 * Board（画面）からカードのデータの扱いを切り離し、Board は表示とドラッグ&ドロップに集中できるようにする。
 *
 * - 保存に失敗したときは hasSaveError を true にする（画面に「保存できませんでした」を出すため）。
 *   失敗には2種類あり、消すタイミングが違う
 *   - 画面と DB がずれたままになる失敗（カードの内容の保存、サブタスクの更新）：どれが失敗したかを failedKeys に覚えておき、
 *     同じものを保存し直せたときだけ消す。ほかの保存が成功しても消さない（ずれていることに気づけなくなるため）
 *   - 画面と DB がずれない失敗（削除の失敗、読み直せた移動の失敗）：hasOtherError にして、次にどれかの保存が成功したら消す
 *   - 移動の成功や読み直しで、サーバーの一覧全体で画面を置き換えたときは、画面と DB が揃うので failedKeys も全部消す
 * - 前の state をもとに新しい state を作るときは、setState((prev) => …) の形で書く。
 *   保存の結果を待っている間に別の操作で state が変わっても、最新の state をもとに更新できる
 */
export function useTasks() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  // 保存に失敗して、画面と DB がずれたままになっているもの（taskKey・subtaskKey・BOARD_KEY）
  const [failedKeys, setFailedKeys] = useState<ReadonlySet<string>>(new Set())
  // 画面と DB がずれない失敗があったか。次にどれかの保存が成功したら false に戻す
  const [hasOtherError, setHasOtherError] = useState(false)
  const hasSaveError = hasOtherError || failedKeys.size > 0
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

  /** key の保存に失敗した（画面と DB がずれたままになっている）ことを覚える */
  function markFailed(key: string) {
    setFailedKeys((prev) => withKey(prev, key))
  }

  /** keys の保存ができた（画面と DB が揃った）。画面と DB がずれない失敗の表示も消す */
  function markSaved(...keys: string[]) {
    setFailedKeys((prev) => withoutKeys(prev, keys))
    setHasOtherError(false)
  }

  /** サーバーの一覧全体で画面を置き換えた。画面と DB が揃うので、覚えていた失敗を全部消す */
  function replaceTasks(tasks: Task[]) {
    setState({ kind: 'success', tasks })
    setFailedKeys(new Set())
  }

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
      // 4項目をまとめて送っているので、前に失敗した内容もこれで保存できている
      markSaved(taskKey(id))
    } catch {
      markFailed(taskKey(id))
    }
  }

  /**
   * カードを指定した列の指定した位置へ移動する（F-19, F-20）。
   * API の結果を待つと動きが遅れて見えるので、先に画面上で並べ替えてから保存する。
   *
   * - サブタスクの保存（subtaskQueueRef）が終わってから移動を送る。先に移動の結果が届くと、
   *   その中のサブタスクはまだ保存前の古い状態なので、画面のチェックや内容が元に戻って見えてしまうため
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
    // サブタスクの保存は失敗しても例外を投げない（updateSubtask・deleteSubtask の中で受け止める）ので、ここで止まることはない
    await subtaskQueueRef.current
    try {
      const tasks = await api.moveTask(id, target.status, target.index)
      replaceTasks(tasks)
      setHasOtherError(false)
    } catch {
      try {
        const tasks = await api.fetchTasks()
        // 読み直せたので画面と DB は揃っている。失敗したことだけを伝える
        replaceTasks(tasks)
        setHasOtherError(true)
      } catch {
        // 読み直しにも失敗したとき（バックエンドが止まっているなど）は、画面はそのままにする。
        // 画面の並びは DB とずれているので、次に移動か読み直しができるまで「保存できませんでした」を出しておく。
        // 利用者は再読み込みで確かめられる
        markFailed(BOARD_KEY)
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
    // 削除したカードとそのサブタスクは、保存に失敗したままでも、もう直しようがないので覚えておかない
    const subtaskIds = state.kind === 'success' ? (state.tasks.find((t) => t.id === id)?.subtasks ?? []).map((s) => s.id) : []
    try {
      await api.deleteTask(id)
      setState((prev) => updateTasks(prev, (tasks) => tasks.filter((task) => task.id !== id)))
      markSaved(taskKey(id), ...subtaskIds.map(subtaskKey))
      return true
    } catch {
      // カードは画面にも DB にも残っているので、ずれてはいない
      setHasOtherError(true)
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
   * - 失敗しても画面はそのままにして、「保存できませんでした」を出す（hasSaveError）。例外は投げない。
   *   画面と DB がずれたままになるので、このサブタスクを保存し直せるまでは消さない
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
        // 内容と完了したかをまとめて送っているので、前に失敗した内容もこれで保存できている
        markSaved(subtaskKey(id))
      } catch {
        markFailed(subtaskKey(id))
      }
    })
    subtaskQueueRef.current = saving
    return saving
  }

  /**
   * サブタスクを削除する（F-23）。確認はしない（［×］を押したらすぐ削除する）。
   *
   * - 削除できてから一覧から取り除く（カードの削除と同じ）。先に取り除くと、失敗したときに
   *   画面では消えたのに DB には残ってしまうため
   * - 失敗したときは一覧はそのまま（サブタスクは残る）にして、「保存できませんでした」を出す（hasSaveError）。例外は投げない
   * - 更新と同じ順番待ち（subtaskQueueRef）に入れる。チェックや書き換えの保存が終わる前に削除すると、
   *   削除したあとに更新が届いて「見つからない」エラーになるため
   */
  function deleteSubtask(taskId: number, id: number): Promise<void> {
    const deleting = subtaskQueueRef.current.then(async () => {
      try {
        await api.deleteSubtask(taskId, id)
        setState((prev) =>
          updateTasks(prev, (tasks) =>
            tasks.map((task) =>
              task.id === taskId ? { ...task, subtasks: task.subtasks.filter((subtask) => subtask.id !== id) } : task,
            ),
          ),
        )
        // 消えたので、このサブタスクの保存に失敗していても、もうずれはない
        markSaved(subtaskKey(id))
      } catch {
        // サブタスクは画面にも DB にも残っているので、削除の失敗でずれは増えない
        setHasOtherError(true)
      }
    })
    subtaskQueueRef.current = deleting
    return deleting
  }

  return { state, hasSaveError, addTask, saveTask, moveTask, deleteTask, addSubtask, updateSubtask, deleteSubtask }
}
