import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { makeTask } from '../test/makeTask'
import { CardContent } from './Card'

/** ボード上のカードの中身のテスト（docs/spec.md の F-17） */
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

  test('タイトルの HTML は解釈せず、文字のまま表示する（XSS 対策）', () => {
    const { container } = render(<CardContent task={makeTask(1, 'todo', { title: '<b>太字</b>' })} />)

    expect(screen.getByText('<b>太字</b>')).toBeInTheDocument()
    expect(container.querySelector('b')).toBeNull()
  })
})
