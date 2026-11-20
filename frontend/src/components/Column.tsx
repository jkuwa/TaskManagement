import type { Task } from '../types'
import { Card } from './Card'

type Props = {
  label: string
  tasks: Task[]
}

/** ボードの列1つ（未着手・進行中・完了のどれか） */
export function Column({ label, tasks }: Props) {
  return (
    <section className="column">
      <h2 className="column-title">{label}</h2>
      <div className="card-list">
        {tasks.map((task) => (
          // key：React が一覧のどの要素がどのカードかを見分けるための値。id を使う
          <Card key={task.id} task={task} />
        ))}
      </div>
    </section>
  )
}
