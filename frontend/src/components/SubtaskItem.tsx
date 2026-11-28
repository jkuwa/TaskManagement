import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type { Subtask, SubtaskFields } from '../types'
import { MAX_TITLE_LENGTH } from '../utils'

type Props = {
  /** 表示するサブタスク */
  subtask: Subtask
  /**
   * 内容と完了したかを保存する処理（TaskDetail から渡される）。失敗しても例外は投げない。
   * 画面の一覧はすぐに書き換わり、新しい subtask が渡されてくる
   */
  onUpdate: (fields: SubtaskFields) => Promise<void>
}

/**
 * 詳細画面のサブタスク1行の部品。
 *
 * - チェックボックスを押すと、完了・未完了を切り替えて保存する（F-22）
 * - 内容の文字を押すと入力欄に変わり、内容を書き換えられる（F-26）
 *   - Enter か、入力欄の外をクリックしたら確定して保存する
 *   - Esc で変更を取り消す。詳細画面は閉じない（もう一度 Esc を押すと詳細画面が閉じる）
 *   - 空白だけ・空のときや、変えていないときは保存しない（元の内容のまま）
 */
export function SubtaskItem({ subtask, onUpdate }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  // 編集中の入力欄の値
  const [draft, setDraft] = useState('')
  // 編集を終えたか。Enter や Esc で入力欄を消したとき、そのあとの blur（フォーカスが外れたこと）で
  // もう一度保存しないようにするための目印
  const finishedRef = useRef(false)

  function startEditing() {
    setDraft(subtask.title)
    finishedRef.current = false
    setIsEditing(true)
  }

  /** 編集を終えて文字の表示に戻す。save が true なら、内容が変わっていれば保存する */
  function finishEditing(save: boolean) {
    if (finishedRef.current) return
    finishedRef.current = true
    setIsEditing(false)

    const title = draft.trim()
    if (!save || title === '' || title === subtask.title) return
    void onUpdate({ title, done: subtask.done })
  }

  // フォームの送信（入力欄で Enter）で呼ばれる。AddForm と同じく form にすると、
  // 日本語入力の変換を確定する Enter では送信されない
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // フォームを送信するとページが再読み込みされるので、それを止める
    event.preventDefault()
    finishEditing(true)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      // 詳細画面（<dialog>）まで閉じないように止める（AddForm と同じ）
      event.preventDefault()
      finishEditing(false)
    }
  }

  return (
    <div className="subtask">
      <input
        type="checkbox"
        checked={subtask.done}
        onChange={() => void onUpdate({ title: subtask.title, done: !subtask.done })}
        aria-label={subtask.title}
      />
      {isEditing ? (
        <form className="subtask-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="subtask-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => finishEditing(true)}
            maxLength={MAX_TITLE_LENGTH}
            aria-label="サブタスクの内容を編集"
            // 文字を押した直後にすぐ書き換えられるようにする（利用者が自分で押したときだけ）
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </form>
      ) : (
        // 押すと編集を始めるので button にする（キーボードでも Tab で選んで Enter で編集を始められる）
        <button
          type="button"
          className={subtask.done ? 'subtask-title is-done' : 'subtask-title'}
          onClick={startEditing}
        >
          {subtask.title}
        </button>
      )}
    </div>
  )
}
