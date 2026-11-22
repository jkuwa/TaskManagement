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
 */
export function Card({ task, onOpen }: Props) {
  const showDescIcon = hasDescription(task.description)
  const hasMeta = task.priority !== null || task.dueDate !== null || showDescIcon

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
    <article className="card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={handleKeyDown}>
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
