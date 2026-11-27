import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { AddForm } from './AddForm'

/**
 * 追加フォームのテスト（docs/spec.md の F-11, F-21）。カードの追加と同じ文字で確かめる。
 *
 * - render：部品を描画する
 * - screen.getByRole など：画面から要素を探す（見つからなければテストが失敗する）
 * - userEvent：クリックや文字の入力を、利用者の操作と同じように行う
 * - vi.fn()：呼ばれたかどうか・何を渡されたかを記録する、テスト用の関数
 */
describe('AddForm', () => {
  /** フォームを描画して［＋ カード追加］を押し、入力欄を開く */
  async function openForm(onAdd = vi.fn<(title: string) => Promise<void>>().mockResolvedValue(undefined)) {
    const user = userEvent.setup()
    render(<AddForm buttonLabel="＋ カード追加" inputLabel="カードのタイトル" placeholder="タイトルを入力" onAdd={onAdd} />)
    await user.click(screen.getByRole('button', { name: '＋ カード追加' }))
    return { user, onAdd, input: screen.getByRole('textbox', { name: 'カードのタイトル' }) }
  }

  test('タイトルを入力して Enter で追加し、入力欄は空になって開いたままになる', async () => {
    const { user, onAdd, input } = await openForm()

    await user.type(input, '資料を作る{Enter}')

    expect(onAdd).toHaveBeenCalledWith('資料を作る')
    expect(input).toHaveValue('')
    expect(input).toBeInTheDocument()
  })

  test('前後の空白は取り除いて追加する', async () => {
    const { user, onAdd, input } = await openForm()

    await user.type(input, '  資料を作る  ')
    await user.click(screen.getByRole('button', { name: '追加' }))

    expect(onAdd).toHaveBeenCalledWith('資料を作る')
  })

  test('空白だけのタイトルでは追加しない', async () => {
    const { user, onAdd, input } = await openForm()

    await user.type(input, '   {Enter}')

    expect(onAdd).not.toHaveBeenCalled()
  })

  test('追加に失敗したら「保存できませんでした」を出し、入力した文字は残す', async () => {
    const { user, input } = await openForm(vi.fn<(title: string) => Promise<void>>().mockRejectedValue(new Error('失敗')))

    await user.type(input, '資料を作る{Enter}')

    expect(await screen.findByText('保存できませんでした')).toBeInTheDocument()
    expect(input).toHaveValue('資料を作る')
  })

  test('Esc キーで入力欄を閉じ、［＋ カード追加］に戻る', async () => {
    const { user, input } = await openForm()

    await user.type(input, '書きかけ{Escape}')

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '＋ カード追加' })).toBeInTheDocument()
  })

  test('Esc キーのブラウザの動き（詳細画面を閉じる）は止める', async () => {
    const { input } = await openForm()

    // fireEvent はイベントを出し、preventDefault で止められたら false を返す
    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false)
  })

  test('タイトルは100文字までしか入力できない', async () => {
    const { input } = await openForm()

    expect(input).toHaveAttribute('maxLength', '100')
  })
})
