import type { Task } from '../types'
import { PRIORITY_LABELS, formatDueDate, hasDescription } from '../utils'

/**
 * ボード上のカード1枚。
 * タイトルと、設定されている項目（優先度・期限・説明文アイコン）だけを表示する。
 */
export function Card({ task }: { task: Task }) {
  const showDescIcon = hasDescription(task.description)
  const hasMeta = task.priority !== null || task.dueDate !== null || showDescIcon

  return (
    <article className="card">
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
    </article>
  )
}
