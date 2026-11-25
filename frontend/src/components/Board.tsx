import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import { useEffect, useState } from 'react'
import { createTask, deleteTask, fetchTasks, moveTask, updateTask } from '../api'
import type { Task, TaskFields, TaskStatus } from '../types'
import { COLUMNS, getDropIndex, groupByStatus, reorderTasks } from '../utils'
import { CardContent } from './Card'
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

/** ドラッグ中に、カードが入る場所（どの列の、何番目か） */
type DropTarget = { status: TaskStatus; index: number }

/**
 * ドラッグ中のイベントから、カードが入る場所を求める。列の上にないときは null。
 *
 * - event.over：マウスの下にある列（Column の useDroppable の id = status）
 * - マウスの高さ：ドラッグを始めたときの位置（activatorEvent）＋ そこから動いた量（delta）
 * - 列のカードの位置：画面上の要素（data-status・data-task-id を付けている）から測る。
 *   ドラッグしているカード自身は除く
 */
function getDropTarget(event: DragMoveEvent | DragEndEvent): DropTarget | null {
  if (event.over === null) return null
  const status = event.over.id as TaskStatus
  const pointerY = (event.activatorEvent as PointerEvent).clientY + event.delta.y

  const cards = document.querySelectorAll<HTMLElement>(`.card-list[data-status="${status}"] > .card`)
  const centers = [...cards]
    // data-task-id が active.id と一致しないカードの配列を作り直す。
    // active.id は useDraggable({ id: task.id }) で登録したもの
    .filter((card) => card.dataset.taskId !== String(event.active.id))
    .map((card) => {
      const rect = card.getBoundingClientRect()
      return rect.top + rect.height / 2
    })
  return { status, index: getDropIndex(centers, pointerY) }
}

/**
 * ボード画面。画面を開いたときにカードを読み込み、3つの列に分けて表示する。
 * 各列からカードを追加でき、カードをクリックすると詳細画面を開いて編集できる。
 * カードをドラッグ&ドロップすると、別の列や同じ列の別の位置へ移動できる（F-19, F-20）。
 * 詳細画面の［削除］でカードを削除できる（F-18）。
 */
export function Board() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  // 詳細画面を開いているカードの id。閉じているときは null
  const [openId, setOpenId] = useState<number | null>(null)
  // 直前の保存に失敗したか。次に保存できたら false に戻す
  const [hasSaveError, setHasSaveError] = useState(false)
  // ドラッグしているカードの id。ドラッグしていないときは null
  const [activeId, setActiveId] = useState<number | null>(null)
  // ドラッグ中に、カードが入る場所（線を出す場所）。列の上にないときは null
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  // ドラッグの始め方（dnd-kit のセンサー）。マウスで 5px 以上動かしたらドラッグを始める。
  // 5px 未満ならクリックとして扱われ、今まで通り詳細画面が開く。
  // フックなので、下の「読み込み中」などの return より前に書く（フックは毎回同じ順番で呼ぶ決まり）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

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

  /**
   * カードを指定した列の指定した位置へ移動する（F-19, F-20）。
   * API の結果を待つと動きが遅れて見えるので、先に画面上で並べ替えてから保存する。
   * 保存できたら API が返したすべてのカードで置き換え、失敗したら元の並びに戻して「保存できませんでした」を出す。
   */
  async function handleMove(id: number, target: DropTarget) {
    if (state.kind !== 'success') return
    const before = state.tasks
    const task = before.find((t) => t.id === id)
    if (task === undefined) return

    // 元の場所に落としたときは何もしない
    const currentIndex = groupByStatus(before)[task.status].findIndex((t) => t.id === id)
    if (task.status === target.status && currentIndex === target.index) return

    setState({ kind: 'success', tasks: reorderTasks(before, id, target.status, target.index) })
    try {
      const tasks = await moveTask(id, target.status, target.index)
      setState({ kind: 'success', tasks })
      setHasSaveError(false)
    } catch {
      setState({ kind: 'success', tasks: before })
      setHasSaveError(true)
    }
  }

  /**
   * カードを削除する（F-18）。確認は詳細画面（TaskDetail）で済ませてから呼ばれる。
   * 削除できたら一覧から取り除き、詳細画面を閉じる。同じ列のカードの position はバックエンドで詰め直すが、
   * 画面上は並び順が変わらないので、一覧を読み直さずに取り除くだけでよい。
   * 失敗したときは詳細画面を開いたまま「保存できませんでした」を出し、操作を続けられるようにする。
   */
  async function handleDelete(id: number) {
    try {
      await deleteTask(id)
      setState((prev) =>
        prev.kind === 'success'
          ? { kind: 'success', tasks: prev.tasks.filter((task) => task.id !== id) }
          : prev,
      )
      setOpenId(null)
      setHasSaveError(false)
    } catch {
      setHasSaveError(true)
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(Number(event.active.id))
  }

  // マウスが動くたびに呼ばれる。線を出す場所が変わったときだけ state を変える（同じなら再描画しない）
  function handleDragMove(event: DragMoveEvent) {
    const target = getDropTarget(event)
    setDropTarget((prev) =>
      prev?.status === target?.status && prev?.index === target?.index ? prev : target,
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    const target = getDropTarget(event)
    setActiveId(null)
    setDropTarget(null)
    if (target !== null) handleMove(Number(event.active.id), target)
  }

  // Esc キーなどでドラッグを取りやめたとき
  function handleDragCancel() {
    setActiveId(null)
    setDropTarget(null)
  }

  // groupByStatus：カードをステータス別に分ける
  const groups = groupByStatus(state.tasks)
  // 詳細画面を開いているカード。見つからなければ undefined
  const openTask = state.tasks.find((task) => task.id === openId)
  // ドラッグしているカード。ドラッグしていなければ undefined
  const activeTask = state.tasks.find((task) => task.id === activeId)
  return (
    <>
      {/* 詳細画面を閉じたあとに保存に失敗したときも分かるように、ボードの上にも表示する */}
      {hasSaveError && openTask === undefined && (
        <p className="message message-error">保存できませんでした</p>
      )}
      {/*
        DndContext：この中の要素でドラッグ&ドロップができるようになる（dnd-kit）
        - collisionDetection：どの列の上にいるかの判定。pointerWithin はマウスが入っている列にする
        - onDragStart / onDragMove / onDragEnd / onDragCancel：ドラッグの始め・途中・終わり・取りやめで呼ばれる
      */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <main className="board">
          {COLUMNS.map((column) => (
            <Column
              key={column.status}
              status={column.status}
              label={column.label}
              tasks={groups[column.status]}
              activeId={activeId}
              dropIndex={dropTarget?.status === column.status ? dropTarget.index : null}
              // AddCardForm で［追加］したとき（onAdd(title) が呼ばれたとき）に handleAdd が実行される
              onAdd={(title) => handleAdd(column.status, title)}
              // {(id) => setOpenId(id)} の略。setOpenId(id) とすると描画のたびにすぐ実行されてしまう。
              onOpen={setOpenId}
            />
          ))}
        </main>
        {/*
          DragOverlay：ドラッグ中にマウスについてくるカード。元の場所のカードは動かさず、薄く表示しておく。
          dropAnimation={null}：落としたときに元の場所へ戻るアニメーションを付けない（すぐ新しい場所に並ぶため）
        */}
        <DragOverlay dropAnimation={null}>
          {activeTask && (
            <article className="card card-overlay">
              <CardContent task={activeTask} />
            </article>
          )}
        </DragOverlay>
      </DndContext>
      {openTask && (
        <TaskDetail
          // key を変えると React は別の部品として作り直すので、別のカードを開くと入力欄が初期化される
          key={openTask.id}
          task={openTask}
          hasSaveError={hasSaveError}
          onSave={(fields) => handleSave(openTask.id, fields)}
          onDelete={() => handleDelete(openTask.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}
