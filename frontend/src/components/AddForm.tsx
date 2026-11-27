import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { MAX_TITLE_LENGTH } from '../utils'

type Props = {
  /** 閉じているときに出すボタンの文字（例：「＋ カード追加」） */
  buttonLabel: string
  /** 入力欄の名前（読み上げ用。例：「カードのタイトル」） */
  inputLabel: string
  /** 入力欄に薄く出す説明（例：「タイトルを入力」） */
  placeholder: string
  /**
   * 入力した文字で追加する処理（呼び出し元から渡される）。
   * 保存に失敗したときは例外を投げる（Promise が reject される）。
   */
  onAdd: (title: string) => Promise<void>
}

/**
 * 「＋ ○○を追加」ボタンと、押すと出る入力欄の部品。見た目は mockup/index.html に合わせている。
 * 列の下のカード追加（F-11）と、詳細画面のサブタスク追加（F-21）で使う。
 *
 * - 閉じているとき：［＋ ○○追加］ボタンだけを表示する
 * - 開いているとき：入力欄と［追加］［キャンセル］を表示する
 *
 * 追加できたら入力欄を空にして、開いたままにする（続けて追加できるように）。
 */
export function AddForm({ buttonLabel, inputLabel, placeholder, onAdd }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  // 保存中かどうか。保存中はボタンを押せなくして、同じものが2つできるのを防ぐ
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

    // 空白だけの入力は空と同じ扱いにして、追加しない
    const trimmed = title.trim()
    if (trimmed === '' || isSaving) return

    setIsSaving(true)
    setHasError(false)
    try {
      // 入力した文字を渡して onAdd を実行（呼び出し元）
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
    if (event.key === 'Escape') {
      // 詳細画面（<dialog>）の中では、Esc でブラウザが詳細画面まで閉じてしまうので、それを止める。
      // 入力欄だけを閉じ、もう一度 Esc を押したときに詳細画面が閉じるようにする
      event.preventDefault()
      close()
    }
  }

  if (!isOpen) {
    return (
      <button type="button" className="add-button" onClick={() => setIsOpen(true)}>
        {buttonLabel}
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
        placeholder={placeholder}
        aria-label={inputLabel}
        // ボタンを押した直後にすぐ入力できるようにする。利用者が自分で開いたときだけ
        // フォーカスが移るので、画面を開いたときに勝手に移る（jsx-a11y が心配している）ことはない
        // oxlint-disable-next-line jsx-a11y/no-autofocus
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
