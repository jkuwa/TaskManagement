import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeTask } from '../test/makeTask'
import type { SubtaskFields, TaskFields } from '../types'
import { TaskDetail } from './TaskDetail'

/**
 * カードの詳細画面のテスト（docs/spec.md の F-12〜F-18、サブタスクの F-21・F-22・F-26）。
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

  /**
   * 詳細画面を描画する。onSave などはテスト用の関数（vi.fn）にする。
   * - unsavedSubtaskIds：保存に失敗したままにしておくサブタスクの id
   * - unsavedFields：保存できなかったカードの内容
   */
  function renderDetail(
    task = makeTask(1, 'todo', { title: '資料を作る', priority: 'high', dueDate: '2026-11-20' }),
    { unsavedSubtaskIds = [], unsavedFields }: { unsavedSubtaskIds?: number[]; unsavedFields?: TaskFields } = {},
  ) {
    const props = {
      task,
      hasSaveError: false,
      unsavedFields,
      isSubtaskUnsaved: (id: number) => unsavedSubtaskIds.includes(id),
      onSave: vi.fn<(fields: TaskFields) => Promise<void>>().mockResolvedValue(undefined),
      onDelete: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      onAddSubtask: vi.fn<(title: string) => Promise<void>>().mockResolvedValue(undefined),
      onUpdateSubtask: vi.fn<(id: number, fields: SubtaskFields) => Promise<void>>().mockResolvedValue(undefined),
      onDeleteSubtask: vi.fn<(id: number) => Promise<void>>().mockResolvedValue(undefined),
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
    // チェックボックスの名前は、横に表示しているサブタスクの内容（aria-label で付けている）
    expect(screen.getByRole('checkbox', { name: '構成を考える' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '下書きを書く' })).not.toBeChecked()
  })

  test('保存に失敗したままのサブタスクの行にだけ「⚠未保存」を付ける', () => {
    renderDetail(
      makeTask(1, 'todo', {
        subtasks: [
          { id: 1, title: '構成を考える', done: true },
          { id: 2, title: '下書きを書く', done: false },
        ],
      }),
      { unsavedSubtaskIds: [1] },
    )

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('⚠未保存')
    expect(items[1]).not.toHaveTextContent('⚠未保存')
  })

  test('保存できなかった値があれば入力欄に出し、保存できていない項目にだけ赤い枠（is-unsaved）を付ける', () => {
    renderDetail(undefined, {
      unsavedFields: { title: '資料を作る', description: '保存できなかった説明', dueDate: '2026-11-20', priority: 'low' },
    })

    expect(screen.getByRole('textbox', { name: '説明文' })).toHaveValue('保存できなかった説明')
    expect(screen.getByRole('textbox', { name: '説明文' })).toHaveClass('is-unsaved')
    expect(screen.getByRole('combobox', { name: '優先度' })).toHaveValue('low')
    expect(screen.getByRole('combobox', { name: '優先度' })).toHaveClass('is-unsaved')
    // 変えていない項目には付けない
    expect(screen.getByRole('textbox', { name: 'タイトル' })).not.toHaveClass('is-unsaved')
    expect(screen.getByLabelText('期限')).not.toHaveClass('is-unsaved')
  })

  test('保存できなかった値がなければ、どの入力欄にも赤い枠を付けない', () => {
    renderDetail()

    expect(document.querySelector('.is-unsaved')).toBeNull()
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

  /** サブタスクが2つ（完了・未完了）あるカードで詳細画面を描画する */
  function renderWithSubtasks() {
    return renderDetail(
      makeTask(1, 'todo', {
        subtasks: [
          { id: 1, title: '構成を考える', done: true },
          { id: 2, title: '下書きを書く', done: false },
        ],
      }),
    )
  }

  test('チェックを押すと、完了・未完了を切り替えて保存する', async () => {
    const { user, onUpdateSubtask } = renderWithSubtasks()

    await user.click(screen.getByRole('checkbox', { name: '下書きを書く' }))
    expect(onUpdateSubtask).toHaveBeenCalledWith(2, { title: '下書きを書く', done: true })

    await user.click(screen.getByRole('checkbox', { name: '構成を考える' }))
    expect(onUpdateSubtask).toHaveBeenCalledWith(1, { title: '構成を考える', done: false })
  })

  test('内容を押すと入力欄になり、Enter で前後の空白を取って保存する', async () => {
    const { user, onUpdateSubtask } = renderWithSubtasks()

    await user.click(screen.getByRole('button', { name: '下書きを書く' }))
    const input = screen.getByRole('textbox', { name: 'サブタスクの内容を編集' })
    expect(input).toHaveValue('下書きを書く')
    await user.clear(input)
    await user.type(input, '  清書する  {Enter}')

    expect(onUpdateSubtask).toHaveBeenCalledTimes(1)
    expect(onUpdateSubtask).toHaveBeenCalledWith(2, { title: '清書する', done: false })
    // 入力欄は閉じて、文字の表示に戻る
    expect(screen.queryByRole('textbox', { name: 'サブタスクの内容を編集' })).not.toBeInTheDocument()
  })

  test('入力欄の外をクリックしても、確定して保存する', async () => {
    const { user, onUpdateSubtask } = renderWithSubtasks()

    await user.click(screen.getByRole('button', { name: '下書きを書く' }))
    await user.type(screen.getByRole('textbox', { name: 'サブタスクの内容を編集' }), 'き直す')
    await user.click(screen.getByRole('textbox', { name: 'タイトル' }))

    expect(onUpdateSubtask).toHaveBeenCalledTimes(1)
    expect(onUpdateSubtask).toHaveBeenCalledWith(2, { title: '下書きを書くき直す', done: false })
  })

  test('Esc で変更を取り消し、詳細画面は閉じない', async () => {
    const { user, onUpdateSubtask, onClose } = renderWithSubtasks()

    await user.click(screen.getByRole('button', { name: '下書きを書く' }))
    await user.type(screen.getByRole('textbox', { name: 'サブタスクの内容を編集' }), '変更{Escape}')

    expect(onUpdateSubtask).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '下書きを書く' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  test('内容を空にしたり、変えずに確定したりしたときは保存しない', async () => {
    const { user, onUpdateSubtask } = renderWithSubtasks()

    await user.click(screen.getByRole('button', { name: '下書きを書く' }))
    await user.clear(screen.getByRole('textbox', { name: 'サブタスクの内容を編集' }))
    await user.type(screen.getByRole('textbox', { name: 'サブタスクの内容を編集' }), '   {Enter}')
    // 元の内容のまま表示される
    expect(screen.getByRole('button', { name: '下書きを書く' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '下書きを書く' }))
    await user.type(screen.getByRole('textbox', { name: 'サブタスクの内容を編集' }), '{Enter}')

    expect(onUpdateSubtask).not.toHaveBeenCalled()
  })

  test('［×］を押すと、確認せずにそのサブタスクを削除する', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { user, onDeleteSubtask } = renderWithSubtasks()

    await user.click(screen.getByRole('button', { name: '下書きを書くを削除' }))

    expect(onDeleteSubtask).toHaveBeenCalledTimes(1)
    expect(onDeleteSubtask).toHaveBeenCalledWith(2)
    expect(confirm).not.toHaveBeenCalled()
  })

  test('書き換え中に［×］を押すと、書き換えた内容を保存してから削除する', async () => {
    const { user, onUpdateSubtask, onDeleteSubtask } = renderWithSubtasks()

    await user.click(screen.getByRole('button', { name: '下書きを書く' }))
    await user.type(screen.getByRole('textbox', { name: 'サブタスクの内容を編集' }), 'き直す')
    await user.click(screen.getByRole('button', { name: '下書きを書くを削除' }))

    expect(onUpdateSubtask).toHaveBeenCalledWith(2, { title: '下書きを書くき直す', done: false })
    expect(onDeleteSubtask).toHaveBeenCalledWith(2)
    expect(onUpdateSubtask.mock.invocationCallOrder[0]).toBeLessThan(onDeleteSubtask.mock.invocationCallOrder[0])
  })
})
