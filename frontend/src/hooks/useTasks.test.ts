import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as api from '../api'
import { makeTask } from '../test/makeTask'
import { useTasks } from './useTasks'

// vi.mock：api.ts の関数を、テスト用の偽物（vi.fn）に置き換える。バックエンドがなくてもテストできる
vi.mock('../api')

/**
 * useTasks（カードのデータを扱うカスタムフック）のテスト。
 * renderHook：部品を作らずに、フックだけを動かして結果（result.current）を確かめる
 */
describe('useTasks', () => {
  // 未着手 = [1, 2]、進行中 = [3]
  const tasks = [
    makeTask(1, 'todo', { position: 0 }),
    makeTask(2, 'todo', { position: 1 }),
    makeTask(3, 'in_progress', { position: 0 }),
  ]

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(api.fetchTasks).mockResolvedValue(tasks)
  })

  /** フックを動かし、カードを読み込み終わるまで待つ */
  async function renderLoaded() {
    const hook = renderHook(() => useTasks())
    await waitFor(() => expect(hook.result.current.state.kind).toBe('success'))
    return hook
  }

  /** 今の state のカードの id を並び順で返す */
  function ids(state: ReturnType<typeof useTasks>['state']) {
    return state.kind === 'success' ? state.tasks.map((t) => t.id) : []
  }

  test('読み込みに失敗したら error になる', async () => {
    vi.mocked(api.fetchTasks).mockRejectedValue(new Error('失敗'))
    const { result } = renderHook(() => useTasks())

    await waitFor(() => expect(result.current.state.kind).toBe('error'))
  })

  test('移動の保存に失敗したら、サーバーから読み直す', async () => {
    const { result } = await renderLoaded()
    vi.mocked(api.moveTask).mockRejectedValue(new Error('失敗'))
    // 読み直したときに、サーバーにあるカード（その間に別の操作で増えた id 4 を含む）
    const serverTasks = [...tasks, makeTask(4, 'done')]
    vi.mocked(api.fetchTasks).mockResolvedValue(serverTasks)

    await act(() => result.current.moveTask(1, { status: 'in_progress', index: 0 }))

    expect(result.current.hasSaveError).toBe(true)
    expect(api.fetchTasks).toHaveBeenCalledTimes(2) // 最初の読み込み ＋ 読み直し
    expect(ids(result.current.state)).toEqual([1, 2, 3, 4])
  })

  test('移動の保存を待っている間に追加したカードは、移動に失敗しても消えない', async () => {
    const { result } = await renderLoaded()
    // 移動の保存は、テストの中で reject するまで終わらないようにする
    let rejectMove: (reason: Error) => void = () => {}
    vi.mocked(api.moveTask).mockReturnValue(new Promise((_, reject) => (rejectMove = reject)))
    const created = makeTask(4, 'todo', { position: 2 })
    vi.mocked(api.createTask).mockResolvedValue(created)
    vi.mocked(api.fetchTasks).mockResolvedValue([...tasks, created])

    let moving: Promise<void> = Promise.resolve()
    act(() => {
      moving = result.current.moveTask(1, { status: 'in_progress', index: 0 })
    })
    await act(() => result.current.addTask('todo', 'カード4'))
    await act(async () => {
      rejectMove(new Error('失敗'))
      await moving
    })

    expect(ids(result.current.state)).toContain(4)
  })

  test('元の場所に落としたときは、保存しない', async () => {
    const { result } = await renderLoaded()

    await act(() => result.current.moveTask(2, { status: 'todo', index: 1 }))

    expect(api.moveTask).not.toHaveBeenCalled()
  })

  test('削除に成功したら一覧から取り除いて true、失敗したら false を返す', async () => {
    const { result } = await renderLoaded()
    vi.mocked(api.deleteTask).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('失敗'))

    let deleted = false
    await act(async () => {
      deleted = await result.current.deleteTask(1)
    })
    expect(deleted).toBe(true)
    expect(ids(result.current.state)).toEqual([2, 3])

    await act(async () => {
      deleted = await result.current.deleteTask(2)
    })
    expect(deleted).toBe(false)
    expect(result.current.hasSaveError).toBe(true)
  })
})
