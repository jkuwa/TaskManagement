import { useDraggable } from '@dnd-kit/core'
import type { KeyboardEvent } from 'react'
import type { Task } from '../types'
import { PRIORITY_LABELS, formatDueDate, hasDescription } from '../utils'

type Props = {
  task: Task
  /** 保存に失敗したままの変更（カードの内容かサブタスク）があるか。あれば ⚠ と赤い枠を付ける */
  hasUnsaved: boolean
  /** カードをクリックしたときの処理（詳細画面を開く） */
  onOpen: () => void
}

/**
 * ボード上のカード1枚。
 * タイトルと、設定されている項目（優先度・期限・説明文アイコン）だけを表示する。
 * クリック（またはキーボードで選んで Enter / スペース）で詳細画面を開く。
 * マウスでドラッグすると、別の列や同じ列の別の位置へ動かせる（F-19, F-20）。
 * 保存に失敗したままの変更があるときは、⚠ と赤い枠を付けて、どのカードを直せばよいか分かるようにする。
 */
export function Card({ task, hasUnsaved, onOpen }: Props) {
  // useDraggable：この要素をドラッグできるようにする（dnd-kit）
  // - setNodeRef：ドラッグできる要素を dnd-kit に教えるための ref
  // - attributes：読み上げソフト向けの属性（role・tabIndex・aria-* など）
  // - listeners：ドラッグを始めるためのイベント（onPointerDown）
  // - isDragging：このカードをドラッグしている最中か
  // useDraggableで返ってくるオブジェクトから、該当する値をそれぞれの変数に入れる
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: task.id })

  // <div> はもともと押せる要素ではないので、キーボードでも開けるようにする
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault() // スペースでページがスクロールするのを止める
      onOpen()
    }
  }

  return (
    // role="button"：読み上げソフトなどに「押せるもの」と伝える
    // tabIndex={0}：Tab キーで選べるようにする
    //   この2つは attributes にも同じ値が入っているが、lint は {...attributes} の中身を見られないので明示する。
    //   <button> にしないのは、中に <p> や <div> を入れられないため
    // data-task-id：ドラッグ中に、カードが入る位置を計算するときの目印（Board で使う）
    // ドラッグ中は元の場所のカードを薄く表示する（マウスについてくるのは Board の DragOverlay）
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // 保存に失敗したままの変更があれば has-unsaved を足して、赤い枠を付ける
      className={['card', isDragging && 'is-dragging', hasUnsaved && 'has-unsaved'].filter(Boolean).join(' ')}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="button"
      tabIndex={0}
      data-task-id={task.id}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <CardContent task={task} hasUnsaved={hasUnsaved} />
    </div>
  )
}

/**
 * カードの中身（タイトルと、設定されている項目）。
 * サブタスクがあるときは、進み具合（完了の数/全部の数）も表示する（F-24）。
 * ボード上のカードと、ドラッグ中にマウスについてくるカード（Board の DragOverlay）の両方で使う。
 */
export function CardContent({ task, hasUnsaved = false }: { task: Task; hasUnsaved?: boolean }) {
  const showDescIcon = hasDescription(task.description)
  const subtaskTotal = task.subtasks.length
  const subtaskDone = task.subtasks.filter((subtask) => subtask.done).length
  const hasMeta = task.priority !== null || task.dueDate !== null || subtaskTotal > 0 || showDescIcon

  return (
    <>
      <div className="card-heading">
        <p className="card-title">{task.title}</p>
        {hasUnsaved && (
          <span className="unsaved-icon" title="保存できていない変更があります" aria-label="保存できていない変更があります">
            ⚠
          </span>
        )}
      </div>
      {hasMeta && (
        <div className="card-meta">
          {task.priority && (
            <span className={`badge badge-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
          )}
          {task.dueDate && <span className="due">{formatDueDate(task.dueDate)}</span>}
          {/* サブタスクが0件のときは出さない。全部完了したら is-complete で色を変える */}
          {subtaskTotal > 0 && (
            <span
              className={subtaskDone === subtaskTotal ? 'subtask-progress is-complete' : 'subtask-progress'}
              title="サブタスクの進み具合"
              aria-label={`サブタスク ${subtaskTotal}件中${subtaskDone}件完了`}
            >
              ☑ {subtaskDone}/{subtaskTotal}
            </span>
          )}
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
