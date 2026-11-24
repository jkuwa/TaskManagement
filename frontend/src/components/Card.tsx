import { useDraggable } from '@dnd-kit/core'
import type { KeyboardEvent } from 'react'
import type { Task } from '../types'
import { PRIORITY_LABELS, formatDueDate, hasDescription } from '../utils'

type Props = {
  task: Task
  /** カードをクリックしたときの処理（詳細画面を開く） */
  onOpen: () => void
}

/**
 * ボード上のカード1枚。
 * タイトルと、設定されている項目（優先度・期限・説明文アイコン）だけを表示する。
 * クリック（またはキーボードで選んで Enter / スペース）で詳細画面を開く。
 * マウスでドラッグすると、別の列や同じ列の別の位置へ動かせる（F-19, F-20）。
 */
export function Card({ task, onOpen }: Props) {
  // useDraggable：この要素をドラッグできるようにする（dnd-kit）
  // - setNodeRef：ドラッグできる要素を dnd-kit に教えるための ref
  // - attributes：読み上げソフト向けの属性（aria-* など）
  // - listeners：ドラッグを始めるためのイベント（onPointerDown）
  // - isDragging：このカードをドラッグしている最中か
  // useDraggableで返ってくるオブジェクトから、該当する値をそれぞれの変数に入れる
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: task.id })

  // <article> はもともと押せる要素ではないので、キーボードでも開けるようにする
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault() // スペースでページがスクロールするのを止める
      onOpen()
    }
  }

  return (
    // role="button"：読み上げソフトなどに「押せるもの」と伝える
    // tabIndex={0}：Tab キーで選べるようにする
    // data-task-id：ドラッグ中に、カードが入る位置を計算するときの目印（Board で使う）
    // ドラッグ中は元の場所のカードを薄く表示する（マウスについてくるのは Board の DragOverlay）
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={isDragging ? 'card is-dragging' : 'card'}
      role="button"
      tabIndex={0}
      data-task-id={task.id}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <CardContent task={task} />
    </article>
  )
}

/**
 * カードの中身（タイトルと、設定されている項目）。
 * ボード上のカードと、ドラッグ中にマウスについてくるカード（Board の DragOverlay）の両方で使う。
 */
export function CardContent({ task }: { task: Task }) {
  const showDescIcon = hasDescription(task.description)
  const hasMeta = task.priority !== null || task.dueDate !== null || showDescIcon

  return (
    <>
      <p className="card-title">{task.title}</p>
      {hasMeta && (
        <div className="card-meta">
          {task.priority && (
            <span className={`badge badge-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
          )}
          {task.dueDate && <span className="due">{formatDueDate(task.dueDate)}</span>}
          {showDescIcon && (
            <span className="desc-icon" title="説明文あり" aria-label="説明文あり">
              ≡
            </span>
          )}
        </div>
      )}
    </>
  )
}
