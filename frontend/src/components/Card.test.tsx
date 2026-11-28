import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { makeTask } from '../test/makeTask'
import { CardContent } from './Card'

/** ボード上のカードの中身のテスト（docs/spec.md の F-17・F-24） */
describe('CardContent', () => {
  test('期限・優先度・説明文がないときは、タイトルだけを表示する', () => {
    const { container } = render(<CardContent task={makeTask(1)} />)

    expect(screen.getByText('カード1')).toBeInTheDocument()
    // .card-meta（優先度・期限・アイコンを入れる行）が作られていない
    expect(container.querySelector('.card-meta')).toBeNull()
  })

  test('優先度・期限（月/日）・説明文のアイコンを表示する', () => {
    render(
      <CardContent
        task={makeTask(1, 'todo', { priority: 'high', dueDate: '2027-01-05', description: '説明' })}
      />,
    )

    expect(screen.getByText('高')).toBeInTheDocument()
    expect(screen.getByText('1/5')).toBeInTheDocument()
    expect(screen.getByLabelText('説明文あり')).toBeInTheDocument()
  })

  test('説明文が空白だけなら、アイコンを表示しない', () => {
    render(<CardContent task={makeTask(1, 'todo', { description: '  \n ' })} />)

    expect(screen.queryByLabelText('説明文あり')).not.toBeInTheDocument()
  })

  test('サブタスクの進み具合（完了の数/全部の数）を表示する（F-24）', () => {
    const subtasks = [
      { id: 1, title: 'a', done: true },
      { id: 2, title: 'b', done: false },
      { id: 3, title: 'c', done: false },
    ]
    render(<CardContent task={makeTask(1, 'todo', { subtasks })} />)

    const progress = screen.getByLabelText('サブタスク 3件中1件完了')
    expect(progress).toHaveTextContent('1/3')
    expect(progress).not.toHaveClass('is-complete')
  })

  test('サブタスクが全部完了したら、進み具合の色を変える（F-24）', () => {
    const subtasks = [
      { id: 1, title: 'a', done: true },
      { id: 2, title: 'b', done: true },
    ]
    render(<CardContent task={makeTask(1, 'todo', { subtasks })} />)

    const progress = screen.getByLabelText('サブタスク 2件中2件完了')
    expect(progress).toHaveTextContent('2/2')
    expect(progress).toHaveClass('is-complete')
  })

  test('サブタスクが0件なら、進み具合を表示しない（F-24）', () => {
    const { container } = render(<CardContent task={makeTask(1)} />)

    expect(container.querySelector('.subtask-progress')).toBeNull()
  })

  test('タイトルの HTML は解釈せず、文字のまま表示する（XSS 対策）', () => {
    const { container } = render(<CardContent task={makeTask(1, 'todo', { title: '<b>太字</b>' })} />)

    expect(screen.getByText('<b>太字</b>')).toBeInTheDocument()
    expect(container.querySelector('b')).toBeNull()
  })
})
