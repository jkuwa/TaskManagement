import { useEffect, useState } from 'react'
import { fetchTasks } from '../api'
import type { Task } from '../types'
import { COLUMNS, groupByStatus } from '../utils'
import { Column } from './Column'

/**
 * 読み込みの状態。
 * loading：読み込み中 / success：読み込めた（tasks にカードが入る） / error：読み込めなかった
 */
type LoadState =
  | { kind: 'loading' }
  | { kind: 'success'; tasks: Task[] }
  | { kind: 'error' }

/** ボード画面。画面を開いたときにカードを読み込み、3つの列に分けて表示する */
export function Board() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

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

  // groupByStatus：カードをステータス別に分ける
  const groups = groupByStatus(state.tasks)
  return (
    <main className="board">
      {COLUMNS.map((column) => (
        <Column key={column.status} label={column.label} tasks={groups[column.status]} />
      ))}
    </main>
  )
}
