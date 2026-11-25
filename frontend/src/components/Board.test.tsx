import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as api from '../api'
import { makeTask } from '../test/makeTask'
import { Board } from './Board'

// api.ts の関数を、テスト用の偽物に置き換える（useTasks.test.ts を参照）
vi.mock('../api')

/** ボード画面のテスト（F-01、データを読み込めないときの表示） */
describe('Board', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('3つの列を左から「未着手」「進行中」「完了」の順に並べ、カードを列に分けて表示する', async () => {
    vi.mocked(api.fetchTasks).mockResolvedValue([makeTask(1, 'todo'), makeTask(2, 'done')])
    render(<Board />)

    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['未着手', '進行中', '完了'])

    // 各列（<section>）の中に、その列のカードだけがある
    const [todo, inProgress, done] = headings.map((h) => within(h.closest('section')!))
    expect(todo.getByText('カード1')).toBeInTheDocument()
    expect(inProgress.queryByText(/^カード\d+$/)).not.toBeInTheDocument()
    expect(done.getByText('カード2')).toBeInTheDocument()
  })

  test('読み込めなかったら「データを読み込めませんでした」を表示する', async () => {
    vi.mocked(api.fetchTasks).mockRejectedValue(new Error('失敗'))
    render(<Board />)

    expect(await screen.findByText('データを読み込めませんでした')).toBeInTheDocument()
  })
})
