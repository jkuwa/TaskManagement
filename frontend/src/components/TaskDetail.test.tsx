import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeTask } from '../test/makeTask'
import type { TaskFields } from '../types'
import { TaskDetail } from './TaskDetail'

/**
 * カードの詳細画面のテスト（docs/spec.md の F-12〜F-18）。
 *
 * 自動保存は入力が 0.5 秒止まってから行うので、時間を自由に進められる「偽物のタイマー」（vi.useFakeTimers）を使う。
 * 本当に 0.5 秒待たなくても、vi.advanceTimersByTimeAsync(500) で時間を進められる。
 */
describe('TaskDetail', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /** 詳細画面を描画する。onSave などはテスト用の関数（vi.fn）にする */
  function renderDetail(task = makeTask(1, 'todo', { title: '資料を作る', priority: 'high', dueDate: '2026-11-20' })) {
    const props = {
      task,
      hasSaveError: false,
      onSave: vi.fn<(fields: TaskFields) => Promise<void>>().mockResolvedValue(undefined),
      onDelete: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      onAddSubtask: vi.fn<(title: string) => Promise<void>>().mockResolvedValue(undefined),
      onClose: vi.fn<() => void>(),
    }
    // advanceTimers：userEvent が操作の合間に待つときも、偽物のタイマーを進める
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    // unmount：描画した部品を画面から消す
    const { unmount } = render(<TaskDetail {...props} />)
    return { user, unmount, ...props }
  }

  test('入力が 0.5 秒止まってから保存する', async () => {
    const { user, onSave } = renderDetail()

    await user.type(screen.getByRole('textbox', { name: '説明文' }), '構成から考える')
    expect(onSave).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(500))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({
      title: '資料を作る',
      description: '構成から考える',
      dueDate: '2026-11-20',
      priority: 'high',
    })
  })

  test('［閉じる］を押すと、待たずにすぐ保存してから閉じる', async () => {
    const { user, onSave, onClose } = renderDetail()

    await user.type(screen.getByRole('textbox', { name: '説明文' }), 'メモ')
    await user.click(screen.getByRole('button', { name: '閉じる' }))

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ description: 'メモ' }))
    expect(onClose).toHaveBeenCalled()
  })

  test('タイトルを空にして閉じたら、変更前のタイトルで保存する', async () => {
    const { user, onSave } = renderDetail()

    await user.clear(screen.getByRole('textbox', { name: 'タイトル' }))
    await user.click(screen.getByRole('button', { name: '閉じる' }))

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: '資料を作る' }))
  })

  test('期限の［解除］と優先度の「なし」で、null を保存する', async () => {
    const { user, onSave } = renderDetail()

    await user.click(screen.getByRole('button', { name: '解除' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '優先度' }), 'なし')
    await act(() => vi.advanceTimersByTimeAsync(500))

    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ dueDate: null, priority: null }))
    // 期限がなくなったので、［解除］ボタンも消える
    expect(screen.queryByRole('button', { name: '解除' })).not.toBeInTheDocument()
  })

  test('［削除］で確認を出し、「キャンセル」なら削除しない', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { user, onDelete } = renderDetail()

    await user.click(screen.getByRole('button', { name: '削除' }))

    expect(confirm).toHaveBeenCalledWith('このカードを削除しますか？')
    expect(onDelete).not.toHaveBeenCalled()
  })

  test('［削除］で「OK」なら、保存待ちの入力を送ってから削除する', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user, onSave, onDelete } = renderDetail()

    await user.type(screen.getByRole('textbox', { name: '説明文' }), 'メモ')
    await user.click(screen.getByRole('button', { name: '削除' }))

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(onSave).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalled()
    // 保存が先、削除があと
    expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(onDelete.mock.invocationCallOrder[0])
  })

  test('画面が消えたら、保存待ちのタイマーを解除する（消えたあとに保存しない）', async () => {
    const { user, unmount, onSave } = renderDetail()

    await user.type(screen.getByRole('textbox', { name: '説明文' }), 'メモ')
    unmount()
    await act(() => vi.advanceTimersByTimeAsync(500))

    expect(onSave).not.toHaveBeenCalled()
  })

  test('サブタスクを追加した順に表示し、完了したものにはチェックを付ける', () => {
    renderDetail(
      makeTask(1, 'todo', {
        subtasks: [
          { id: 1, title: '構成を考える', done: true },
          { id: 2, title: '下書きを書く', done: false },
        ],
      }),
    )

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    // チェックボックスの名前は、横に表示しているサブタスクの内容（<label> で囲んでいるため）
    expect(screen.getByRole('checkbox', { name: '構成を考える' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '下書きを書く' })).not.toBeChecked()
  })

  test('サブタスクがないときは一覧を出さず、［＋ サブタスクを追加］だけを表示する', () => {
    renderDetail()

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '＋ サブタスクを追加' })).toBeInTheDocument()
  })

  test('［＋ サブタスクを追加］から内容を入力して Enter で追加する', async () => {
    const { user, onAddSubtask } = renderDetail()

    await user.click(screen.getByRole('button', { name: '＋ サブタスクを追加' }))
    await user.type(screen.getByRole('textbox', { name: 'サブタスクの内容' }), '  構成を考える  {Enter}')

    expect(onAddSubtask).toHaveBeenCalledWith('構成を考える')
    // 続けて追加できるよう、入力欄は空になって開いたまま
    expect(screen.getByRole('textbox', { name: 'サブタスクの内容' })).toHaveValue('')
  })

  test('サブタスクの追加に失敗したら「保存できませんでした」を出し、入力した文字は残す', async () => {
    const { user, onAddSubtask } = renderDetail()
    onAddSubtask.mockRejectedValue(new Error('失敗'))

    await user.click(screen.getByRole('button', { name: '＋ サブタスクを追加' }))
    await user.type(screen.getByRole('textbox', { name: 'サブタスクの内容' }), '構成を考える{Enter}')

    expect(await screen.findByText('保存できませんでした')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'サブタスクの内容' })).toHaveValue('構成を考える')
  })
})
