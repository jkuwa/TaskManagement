import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import { useState } from 'react'
import { useTasks } from '../hooks/useTasks'
import type { DropTarget } from '../hooks/useTasks'
import type { TaskStatus } from '../types'
import { COLUMNS, getDropIndex, groupByStatus } from '../utils'
import { CardContent } from './Card'
import { Column } from './Column'
import { TaskDetail } from './TaskDetail'

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
 *
 * カードの読み込み・追加・更新・移動・削除は useTasks（hooks/useTasks.ts）に任せ、
 * この部品は表示と、詳細画面の開け閉め、ドラッグ&ドロップの操作だけを受け持つ。
 */
export function Board() {
  const {
    state,
    hasSaveError,
    hasUnsavedChanges,
    isSubtaskUnsaved,
    addTask,
    saveTask,
    moveTask,
    deleteTask,
    addSubtask,
    updateSubtask,
    deleteSubtask,
  } = useTasks()
  // 詳細画面を開いているカードの id。閉じているときは null
  const [openId, setOpenId] = useState<number | null>(null)
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

  if (state.kind === 'loading') {
    return <p className="message">読み込み中…</p>
  }
  if (state.kind === 'error') {
    return <p className="message message-error">データを読み込めませんでした</p>
  }

  /** 詳細画面の［削除］：削除できたら詳細画面を閉じる。失敗したときは開いたままにする */
  async function handleDelete(id: number) {
    if (await deleteTask(id)) setOpenId(null)
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
    if (target !== null) moveTask(Number(event.active.id), target)
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
              hasUnsavedChanges={hasUnsavedChanges}
              // AddForm で［追加］したとき（onAdd(title) が呼ばれたとき）に addTask が実行される
              onAdd={(title) => addTask(column.status, title)}
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
            <div className={hasUnsavedChanges(activeTask) ? 'card card-overlay has-unsaved' : 'card card-overlay'}>
              <CardContent task={activeTask} hasUnsaved={hasUnsavedChanges(activeTask)} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {openTask && (
        <TaskDetail
          // key を変えると React は別の部品として作り直すので、別のカードを開くと入力欄が初期化される
          key={openTask.id}
          task={openTask}
          hasSaveError={hasSaveError}
          isSubtaskUnsaved={isSubtaskUnsaved}
          onSave={(fields) => saveTask(openTask.id, fields)}
          onDelete={() => handleDelete(openTask.id)}
          onAddSubtask={(title) => addSubtask(openTask.id, title)}
          onUpdateSubtask={(id, fields) => updateSubtask(openTask.id, id, fields)}
          onDeleteSubtask={(id) => deleteSubtask(openTask.id, id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  )
}
