import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

/** タイトルの最大文字数（docs/spec.md の F-11） */
const MAX_TITLE_LENGTH = 100

type Props = {
  /**
   * 入力したタイトルでカードを追加する処理（Board から渡される）。
   * 保存に失敗したときは例外を投げる（Promise が reject される）。
   */
  onAdd: (title: string) => Promise<void>
}

/**
 * 列の下に置く「カード追加」フォーム。見た目は mockup/index.html に合わせている。
 *
 * - 閉じているとき：［＋ カード追加］ボタンだけを表示する
 * - 開いているとき：タイトルの入力欄と［追加］［キャンセル］を表示する
 *
 * 追加できたら入力欄を空にして、開いたままにする（続けて追加できるように）。
 */
export function AddCardForm({ onAdd }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  // 保存中かどうか。保存中はボタンを押せなくして、同じカードが2枚できるのを防ぐ
  const [isSaving, setIsSaving] = useState(false)
  const [hasError, setHasError] = useState(false)

  function close() {
    setIsOpen(false)
    setTitle('')
    setHasError(false)
  }

  // フォームの送信（［追加］ボタン、または入力欄で Enter）で呼ばれる
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // フォームを送信するとページが再読み込みされるので、それを止める
    event.preventDefault()

    // 空白だけのタイトルは空と同じ扱いにして、カードを作らない
    const trimmed = title.trim()
    if (trimmed === '' || isSaving) return

    setIsSaving(true)
    setHasError(false)
    try {
      await onAdd(trimmed)
      setTitle('')
    } catch {
      // 失敗したときは入力を残して、もう一度押せるようにする
      setHasError(true)
    } finally {
      // finally：成功しても失敗しても最後に必ず実行される
      setIsSaving(false)
    }
  }

  // Esc キーでフォームを閉じる
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') close()
  }

  if (!isOpen) {
    return (
      <button type="button" className="add-button" onClick={() => setIsOpen(true)}>
        ＋ カード追加
      </button>
    )
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="add-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={MAX_TITLE_LENGTH}
        placeholder="タイトルを入力"
        aria-label="カードのタイトル"
        autoFocus
      />
      {hasError && <p className="form-error">保存できませんでした</p>}
      <div className="add-actions">
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          追加
        </button>
        <button type="button" className="btn btn-text" onClick={close}>
          キャンセル
        </button>
      </div>
    </form>
  )
}
