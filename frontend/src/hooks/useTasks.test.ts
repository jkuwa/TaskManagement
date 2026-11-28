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

  test('サブタスクを追加したら、そのカードのサブタスクの最後に足す', async () => {
    const { result } = await renderLoaded()
    vi.mocked(api.createSubtask)
      .mockResolvedValueOnce({ id: 10, title: '1つ目', done: false })
      .mockResolvedValueOnce({ id: 11, title: '2つ目', done: false })

    await act(() => result.current.addSubtask(2, '1つ目'))
    await act(() => result.current.addSubtask(2, '2つ目'))

    expect(api.createSubtask).toHaveBeenCalledWith(2, '1つ目')
    const state = result.current.state
    if (state.kind !== 'success') throw new Error('読み込めていない')
    expect(state.tasks.find((t) => t.id === 2)?.subtasks.map((s) => s.title)).toEqual(['1つ目', '2つ目'])
    // ほかのカードは変わらない
    expect(state.tasks.find((t) => t.id === 1)?.subtasks).toEqual([])
  })

  test('サブタスクの追加に失敗したら、例外を呼び出し元に伝える', async () => {
    const { result } = await renderLoaded()
    vi.mocked(api.createSubtask).mockRejectedValue(new Error('失敗'))

    await expect(result.current.addSubtask(2, '1つ目')).rejects.toThrow('失敗')
  })

  test('カードの保存の結果を待っている間に追加したサブタスクは、保存の結果で消えない', async () => {
    const { result } = await renderLoaded()
    // 保存の結果（サブタスクが入っていない）が、サブタスクの追加より後に届くようにする
    let resolveUpdate: (task: ReturnType<typeof makeTask>) => void = () => {}
    vi.mocked(api.updateTask).mockReturnValue(new Promise((resolve) => (resolveUpdate = resolve)))
    vi.mocked(api.createSubtask).mockResolvedValue({ id: 10, title: 'サブタスク', done: false })

    let saving: Promise<void> = Promise.resolve()
    act(() => {
      saving = result.current.saveTask(1, { title: '新しいタイトル', description: null, dueDate: null, priority: null })
    })
    await act(() => result.current.addSubtask(1, 'サブタスク'))
    await act(async () => {
      resolveUpdate(makeTask(1, 'todo', { title: '新しいタイトル' }))
      await saving
    })

    const state = result.current.state
    if (state.kind !== 'success') throw new Error('読み込めていない')
    const task = state.tasks.find((t) => t.id === 1)
    expect(task?.title).toBe('新しいタイトル')
    expect(task?.subtasks.map((s) => s.title)).toEqual(['サブタスク'])
  })

  /** 今の state から、指定したカードのサブタスクを取り出す */
  function subtasksOf(state: ReturnType<typeof useTasks>['state'], taskId: number) {
    if (state.kind !== 'success') throw new Error('読み込めていない')
    return state.tasks.find((t) => t.id === taskId)?.subtasks
  }

  test('サブタスクを更新すると、保存の結果を待たずに一覧を書き換える', async () => {
    vi.mocked(api.fetchTasks).mockResolvedValue([
      makeTask(1, 'todo', { subtasks: [{ id: 10, title: '下書きを書く', done: false }] }),
    ])
    const { result } = await renderLoaded()
    // 保存の結果がなかなか届かないようにする
    let resolveUpdate: () => void = () => {}
    vi.mocked(api.updateSubtask).mockReturnValue(
      new Promise((resolve) => (resolveUpdate = () => resolve({ id: 10, title: '清書する', done: true }))),
    )

    let saving: Promise<void> = Promise.resolve()
    act(() => {
      saving = result.current.updateSubtask(1, 10, { title: '清書する', done: true })
    })
    expect(subtasksOf(result.current.state, 1)).toEqual([{ id: 10, title: '清書する', done: true }])

    await act(async () => {
      resolveUpdate()
      await saving
    })
    expect(api.updateSubtask).toHaveBeenCalledWith(1, 10, { title: '清書する', done: true })
    expect(result.current.hasSaveError).toBe(false)
  })

  test('サブタスクの更新に失敗しても一覧はそのままにして、hasSaveError を true にする', async () => {
    vi.mocked(api.fetchTasks).mockResolvedValue([
      makeTask(1, 'todo', { subtasks: [{ id: 10, title: '下書きを書く', done: false }] }),
    ])
    const { result } = await renderLoaded()
    vi.mocked(api.updateSubtask).mockRejectedValue(new Error('失敗'))

    await act(() => result.current.updateSubtask(1, 10, { title: '下書きを書く', done: true }))

    expect(subtasksOf(result.current.state, 1)).toEqual([{ id: 10, title: '下書きを書く', done: true }])
    expect(result.current.hasSaveError).toBe(true)
  })

  test('サブタスクの保存は、前の保存が終わってから次を送る', async () => {
    vi.mocked(api.fetchTasks).mockResolvedValue([
      makeTask(1, 'todo', { subtasks: [{ id: 10, title: '下書きを書く', done: false }] }),
    ])
    const { result } = await renderLoaded()
    let resolveFirst: () => void = () => {}
    vi.mocked(api.updateSubtask)
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = () => resolve({ id: 10, title: '下書きを書く', done: true }))))
      .mockResolvedValueOnce({ id: 10, title: '下書きを書く', done: false })

    let second: Promise<void> = Promise.resolve()
    act(() => {
      void result.current.updateSubtask(1, 10, { title: '下書きを書く', done: true })
      second = result.current.updateSubtask(1, 10, { title: '下書きを書く', done: false })
    })
    // 1つ目の保存が終わるまで、2つ目は送らない
    await act(async () => {})
    expect(api.updateSubtask).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst()
      await second
    })
    expect(api.updateSubtask).toHaveBeenCalledTimes(2)
    expect(subtasksOf(result.current.state, 1)).toEqual([{ id: 10, title: '下書きを書く', done: false }])
  })

  test('サブタスクを削除できたら、一覧から取り除く', async () => {
    vi.mocked(api.fetchTasks).mockResolvedValue([
      makeTask(1, 'todo', {
        subtasks: [
          { id: 10, title: '下書きを書く', done: false },
          { id: 11, title: '清書する', done: false },
        ],
      }),
    ])
    const { result } = await renderLoaded()
    vi.mocked(api.deleteSubtask).mockResolvedValue(undefined)

    await act(() => result.current.deleteSubtask(1, 10))

    expect(api.deleteSubtask).toHaveBeenCalledWith(1, 10)
    expect(subtasksOf(result.current.state, 1)).toEqual([{ id: 11, title: '清書する', done: false }])
    expect(result.current.hasSaveError).toBe(false)
  })

  test('サブタスクの削除に失敗したら、一覧に残したまま hasSaveError を true にする', async () => {
    vi.mocked(api.fetchTasks).mockResolvedValue([
      makeTask(1, 'todo', { subtasks: [{ id: 10, title: '下書きを書く', done: false }] }),
    ])
    const { result } = await renderLoaded()
    vi.mocked(api.deleteSubtask).mockRejectedValue(new Error('失敗'))

    await act(() => result.current.deleteSubtask(1, 10))

    expect(subtasksOf(result.current.state, 1)).toEqual([{ id: 10, title: '下書きを書く', done: false }])
    expect(result.current.hasSaveError).toBe(true)
  })

  describe('保存に失敗したことの表示（hasSaveError）', () => {
    const titleOnly = { title: 'タイトル', description: null, dueDate: null, priority: null }

    beforeEach(() => {
      vi.mocked(api.fetchTasks).mockResolvedValue([
        makeTask(1, 'todo', { subtasks: [{ id: 10, title: '下書きを書く', done: false }] }),
        makeTask(2, 'todo', { position: 1, subtasks: [{ id: 20, title: '清書する', done: false }] }),
      ])
    })

    test('サブタスクの更新に失敗したら、ほかのカードやサブタスクの保存が成功しても消さない', async () => {
      const { result } = await renderLoaded()
      vi.mocked(api.updateSubtask).mockRejectedValueOnce(new Error('失敗')).mockResolvedValue({ id: 20, title: '清書する', done: true })
      vi.mocked(api.updateTask).mockResolvedValue(makeTask(2, 'todo', { position: 1 }))

      await act(() => result.current.updateSubtask(1, 10, { title: '下書きを書く', done: true }))
      expect(result.current.hasSaveError).toBe(true)

      await act(() => result.current.saveTask(2, titleOnly))
      await act(() => result.current.updateSubtask(2, 20, { title: '清書する', done: true }))
      expect(result.current.hasSaveError).toBe(true)
    })

    test('失敗したサブタスクを保存し直せたら消す', async () => {
      const { result } = await renderLoaded()
      vi.mocked(api.updateSubtask)
        .mockRejectedValueOnce(new Error('失敗'))
        .mockResolvedValue({ id: 10, title: '下書きを書く', done: false })

      await act(() => result.current.updateSubtask(1, 10, { title: '下書きを書く', done: true }))
      expect(result.current.hasSaveError).toBe(true)

      await act(() => result.current.updateSubtask(1, 10, { title: '下書きを書く', done: false }))
      expect(result.current.hasSaveError).toBe(false)
    })

    test('失敗したサブタスクを削除できたら消す', async () => {
      const { result } = await renderLoaded()
      vi.mocked(api.updateSubtask).mockRejectedValue(new Error('失敗'))
      vi.mocked(api.deleteSubtask).mockResolvedValue(undefined)

      await act(() => result.current.updateSubtask(1, 10, { title: '下書きを書く', done: true }))
      await act(() => result.current.deleteSubtask(1, 10))

      expect(result.current.hasSaveError).toBe(false)
    })

    test('カードの内容の保存に失敗したら、同じカードを保存し直せるまで消さない', async () => {
      const { result } = await renderLoaded()
      vi.mocked(api.updateTask)
        .mockRejectedValueOnce(new Error('失敗'))
        .mockResolvedValueOnce(makeTask(2, 'todo', { position: 1 }))
        .mockResolvedValueOnce(makeTask(1, 'todo'))

      await act(() => result.current.saveTask(1, titleOnly))
      await act(() => result.current.saveTask(2, titleOnly))
      expect(result.current.hasSaveError).toBe(true)

      await act(() => result.current.saveTask(1, titleOnly))
      expect(result.current.hasSaveError).toBe(false)
    })

    test('失敗したカードを削除できたら、そのカードとサブタスクの失敗は消す', async () => {
      const { result } = await renderLoaded()
      vi.mocked(api.updateTask).mockRejectedValue(new Error('失敗'))
      vi.mocked(api.updateSubtask).mockRejectedValue(new Error('失敗'))
      vi.mocked(api.deleteTask).mockResolvedValue(undefined)

      await act(() => result.current.saveTask(1, titleOnly))
      await act(() => result.current.updateSubtask(1, 10, { title: '下書きを書く', done: true }))
      await act(async () => {
        await result.current.deleteTask(1)
      })

      expect(result.current.hasSaveError).toBe(false)
    })

    test('削除の失敗は、次にほかの保存が成功したら消す（画面と DB はずれていないため）', async () => {
      const { result } = await renderLoaded()
      vi.mocked(api.deleteSubtask).mockRejectedValue(new Error('失敗'))
      vi.mocked(api.updateSubtask).mockResolvedValue({ id: 20, title: '清書する', done: true })

      await act(() => result.current.deleteSubtask(1, 10))
      expect(result.current.hasSaveError).toBe(true)

      await act(() => result.current.updateSubtask(2, 20, { title: '清書する', done: true }))
      expect(result.current.hasSaveError).toBe(false)
    })

    test('移動できたら、サーバーの一覧で置き換わって画面と DB が揃うので消す', async () => {
      const { result } = await renderLoaded()
      vi.mocked(api.updateSubtask).mockRejectedValue(new Error('失敗'))
      vi.mocked(api.moveTask).mockResolvedValue([
        makeTask(2, 'todo', { position: 0, subtasks: [{ id: 20, title: '清書する', done: false }] }),
        makeTask(1, 'todo', { position: 1, subtasks: [{ id: 10, title: '下書きを書く', done: false }] }),
      ])

      await act(() => result.current.updateSubtask(1, 10, { title: '下書きを書く', done: true }))
      expect(result.current.hasSaveError).toBe(true)

      await act(() => result.current.moveTask(1, { status: 'todo', index: 1 }))
      expect(result.current.hasSaveError).toBe(false)
    })

    /** 今の state から、指定した id のカードを取り出す */
    function taskOf(state: ReturnType<typeof useTasks>['state'], id: number) {
      if (state.kind !== 'success') throw new Error('読み込めていない')
      const task = state.tasks.find((t) => t.id === id)
      if (task === undefined) throw new Error('カードがない')
      return task
    }

    test('サブタスクの保存に失敗したら、そのサブタスクとカードに印を付け、保存し直せたら外す', async () => {
      const { result } = await renderLoaded()
      vi.mocked(api.updateSubtask)
        .mockRejectedValueOnce(new Error('失敗'))
        .mockResolvedValue({ id: 10, title: '下書きを書く', done: false })

      await act(() => result.current.updateSubtask(1, 10, { title: '下書きを書く', done: true }))
      expect(result.current.isSubtaskUnsaved(10)).toBe(true)
      expect(result.current.isSubtaskUnsaved(20)).toBe(false)
      expect(result.current.hasUnsavedChanges(taskOf(result.current.state, 1))).toBe(true)
      expect(result.current.hasUnsavedChanges(taskOf(result.current.state, 2))).toBe(false)

      await act(() => result.current.updateSubtask(1, 10, { title: '下書きを書く', done: false }))
      expect(result.current.isSubtaskUnsaved(10)).toBe(false)
      expect(result.current.hasUnsavedChanges(taskOf(result.current.state, 1))).toBe(false)
    })

    test('カードの内容の保存に失敗したら、そのカードにだけ印を付ける', async () => {
      const { result } = await renderLoaded()
      vi.mocked(api.updateTask).mockRejectedValue(new Error('失敗'))

      await act(() => result.current.saveTask(1, titleOnly))

      expect(result.current.hasUnsavedChanges(taskOf(result.current.state, 1))).toBe(true)
      expect(result.current.hasUnsavedChanges(taskOf(result.current.state, 2))).toBe(false)
      expect(result.current.isSubtaskUnsaved(10)).toBe(false)
    })

    test('移動に失敗して読み直しにも失敗したときは、どのカードにも印を付けない（メッセージだけ出す）', async () => {
      const { result } = await renderLoaded()
      vi.mocked(api.moveTask).mockRejectedValue(new Error('失敗'))
      vi.mocked(api.fetchTasks).mockRejectedValue(new Error('失敗'))

      await act(() => result.current.moveTask(1, { status: 'in_progress', index: 0 }))

      expect(result.current.hasSaveError).toBe(true)
      expect(result.current.hasUnsavedChanges(taskOf(result.current.state, 1))).toBe(false)
      expect(result.current.hasUnsavedChanges(taskOf(result.current.state, 2))).toBe(false)
    })

    test('移動に失敗して読み直しにも失敗したら、次に移動できるまで消さない', async () => {
      const { result } = await renderLoaded()
      vi.mocked(api.moveTask).mockRejectedValue(new Error('失敗'))
      vi.mocked(api.fetchTasks).mockRejectedValue(new Error('失敗'))
      vi.mocked(api.updateSubtask).mockResolvedValue({ id: 20, title: '清書する', done: true })

      await act(() => result.current.moveTask(1, { status: 'in_progress', index: 0 }))
      await act(() => result.current.updateSubtask(2, 20, { title: '清書する', done: true }))

      expect(result.current.hasSaveError).toBe(true)
    })
  })

  test('カードの移動は、サブタスクの保存が終わってから送る', async () => {
    vi.mocked(api.fetchTasks).mockResolvedValue([
      makeTask(1, 'todo', { subtasks: [{ id: 10, title: '下書きを書く', done: false }] }),
      makeTask(2, 'todo', { position: 1 }),
    ])
    const { result } = await renderLoaded()
    let resolveUpdate: () => void = () => {}
    vi.mocked(api.updateSubtask).mockReturnValue(
      new Promise((resolve) => (resolveUpdate = () => resolve({ id: 10, title: '下書きを書く', done: true }))),
    )
    // 移動の結果には、サブタスクの保存が反映された状態が入っている
    vi.mocked(api.moveTask).mockResolvedValue([
      makeTask(2, 'todo', { position: 0 }),
      makeTask(1, 'todo', { position: 1, subtasks: [{ id: 10, title: '下書きを書く', done: true }] }),
    ])

    let moving: Promise<void> = Promise.resolve()
    act(() => {
      void result.current.updateSubtask(1, 10, { title: '下書きを書く', done: true })
    })
    act(() => {
      moving = result.current.moveTask(1, { status: 'todo', index: 1 })
    })
    // サブタスクの保存が終わるまで、移動は送らない。並びは先に画面上で変わる
    await act(async () => {})
    expect(api.moveTask).not.toHaveBeenCalled()
    expect(ids(result.current.state)).toEqual([2, 1])

    await act(async () => {
      resolveUpdate()
      await moving
    })
    expect(api.moveTask).toHaveBeenCalledWith(1, 'todo', 1)
    expect(subtasksOf(result.current.state, 1)).toEqual([{ id: 10, title: '下書きを書く', done: true }])
  })

  test('サブタスクの削除は、前の更新の保存が終わってから送る', async () => {
    vi.mocked(api.fetchTasks).mockResolvedValue([
      makeTask(1, 'todo', { subtasks: [{ id: 10, title: '下書きを書く', done: false }] }),
    ])
    const { result } = await renderLoaded()
    let resolveUpdate: () => void = () => {}
    vi.mocked(api.updateSubtask).mockReturnValue(
      new Promise((resolve) => (resolveUpdate = () => resolve({ id: 10, title: '下書きを書く', done: true }))),
    )
    vi.mocked(api.deleteSubtask).mockResolvedValue(undefined)

    let deleting: Promise<void> = Promise.resolve()
    act(() => {
      void result.current.updateSubtask(1, 10, { title: '下書きを書く', done: true })
      deleting = result.current.deleteSubtask(1, 10)
    })
    // 更新の保存が終わるまで、削除は送らない
    await act(async () => {})
    expect(api.deleteSubtask).not.toHaveBeenCalled()

    await act(async () => {
      resolveUpdate()
      await deleting
    })
    expect(api.deleteSubtask).toHaveBeenCalledWith(1, 10)
    expect(subtasksOf(result.current.state, 1)).toEqual([])
    expect(result.current.hasSaveError).toBe(false)
  })
})
