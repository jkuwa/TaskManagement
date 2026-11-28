import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import type { Task, TaskStatus } from '../types'
import { AddForm } from './AddForm'
import { Card } from './Card'

type Props = {
  status: TaskStatus
  label: string
  tasks: Task[]
  /** ドラッグしているカードの id。ドラッグしていないときは null */
  activeId: number | null
  /** ドラッグ中に、この列でカードが入る位置（線を出す位置）。この列の上にないときは null */
  dropIndex: number | null
  /** カードに保存に失敗したままの変更があるか（Card に ⚠ の印を付けるため） */
  hasUnsavedChanges: (task: Task) => boolean
  /** この列にカードを追加する処理。失敗したときは例外を投げる */
  onAdd: (title: string) => Promise<void>
  /** カードの詳細画面を開く処理 */
  onOpen: (id: number) => void
}

/** ボードの列1つ（未着手・進行中・完了のどれか） */
export function Column({ status, label, tasks, activeId, dropIndex, hasUnsavedChanges, onAdd, onOpen }: Props) {
  // useDroppable：この要素の上にカードを落とせるようにする（dnd-kit）
  // id に status を使うので、Board ではどの列の上にいるかが over.id で分かる
  const { setNodeRef } = useDroppable({ id: status })

  // カードを並べ、dropIndex の位置に「カードが入る位置の線」を入れる。
  // dropIndex はドラッグしているカードを除いた並びで数えるので、除いたカードの枚数（count）と比べる
  const items: ReactNode[] = []
  let count = 0
  for (const task of tasks) {
    if (task.id !== activeId) {
      if (count === dropIndex) items.push(<DropIndicator key="indicator" />)
      count++
    }
    // key：React が一覧のどの要素がどのカードかを見分けるための値。id を使う
    items.push(<Card key={task.id} task={task} hasUnsaved={hasUnsavedChanges(task)} onOpen={() => onOpen(task.id)} />)
  }
  // 一番下に入るとき
  if (count === dropIndex) items.push(<DropIndicator key="indicator" />)

  return (
    <section ref={setNodeRef} className={dropIndex === null ? 'column' : 'column is-drop-target'}>
      <h2 className="column-title">{label}</h2>
      {/* data-status：ドラッグ中に、この列のカードの位置を探すときの目印（Board で使う） */}
      <div className="card-list" data-status={status}>
        {items}
      </div>
      <AddForm buttonLabel="＋ カード追加" inputLabel="カードのタイトル" placeholder="タイトルを入力" onAdd={onAdd} />
    </section>
  )
}

/** ドラッグ中に、カードが入る位置に出す線 */
function DropIndicator() {
  return <div className="drop-indicator" />
}
