import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { Priority, Task, TaskFields } from '../types'
import { MAX_TITLE_LENGTH } from '../utils'

/** 入力が止まってから保存するまでの時間（ミリ秒） */
const SAVE_DELAY_MS = 500

type Props = {
  /** 開いたカード。入力欄の最初の値に使う */
  task: Task
  /** 直前の保存に失敗したか（Board が持っている） */
  hasSaveError: boolean
  /** 入力した内容を保存する処理（Board から渡される）。失敗しても例外は投げない */
  onSave: (fields: TaskFields) => Promise<void>
  /** 詳細画面を閉じる処理（Board から渡される） */
  onClose: () => void
}

/** 入力欄の値。HTML の入力欄は「未設定」を空文字で表すので、null ではなく '' で持つ */
type FormValues = {
  title: string
  description: string
  dueDate: string
  priority: Priority | ''
}

/**
 * カードの詳細画面（ポップアップ）。見た目は mockup/index.html の <dialog> に合わせている。
 *
 * - タイトル・説明文・期限・優先度を編集できる
 * - 入力のたびに自動で保存する（［保存］ボタンはない）。通信が多くなりすぎないよう、
 *   入力が {@link SAVE_DELAY_MS} ミリ秒止まってから保存する。閉じるときは待たずにすぐ保存する
 * - タイトルが空のあいだは、タイトルだけ変更前の値で保存する。空のまま閉じたら変更前のタイトルに戻る
 * - ［閉じる］ボタン・Esc キー・外側のクリックで閉じる
 */
export function TaskDetail({ task, hasSaveError, onSave, onClose }: Props) {
  const [values, setValues] = useState<FormValues>({
    title: task.title,
    description: task.description ?? '', // ??：左が null か undefined なら右の値を使う
    dueDate: task.dueDate ?? '',
    priority: task.priority ?? '',
  })

  // useRef：再描画しても値が保たれ、変えても再描画されない入れ物。画面に出さない値を入れておく
  const dialogRef = useRef<HTMLDialogElement>(null)
  // 保存待ちのタイマー。入力のたびに前のタイマーを取り消して、新しく待ち直す
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 保存待ちの内容（まだ送っていない最新の入力）
  const pendingRef = useRef<FormValues | null>(null)
  // 最後に保存できたタイトル。タイトルを空にしたときは、これを代わりに送る
  const savedTitleRef = useRef(task.title)
  // 保存の順番待ち。前の保存が終わってから次を送り、古い内容があとから届いて上書きするのを防ぐ
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  // 外側でマウスを押したか（外側のクリックで閉じる判定に使う）
  const pressedOutsideRef = useRef(false)

  // 開いたときに、<dialog> をポップアップとして表示する。
  // 開発中は StrictMode で2回実行されるので、すでに開いていたら何もしない
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  /** 保存待ちの内容があれば、順番待ちの最後に保存を足す */
  function flush() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    if (pending === null) return
    pendingRef.current = null

    const title = pending.title.trim()
    const fields: TaskFields = {
      // タイトルが空なら保存しない（変更前のタイトルのまま送る）
      title: title === '' ? savedTitleRef.current : title,
      description: pending.description === '' ? null : pending.description,
      dueDate: pending.dueDate === '' ? null : pending.dueDate,
      priority: pending.priority === '' ? null : pending.priority,
    }
    savedTitleRef.current = fields.title
    queueRef.current = queueRef.current.then(() => onSave(fields))
  }

  /** 入力した項目を画面に反映し、少し待ってから保存する */
  function change(patch: Partial<FormValues>) {
    // Partial<型>：すべての項目を省略できるようにした型。変えた項目だけを渡せる
    const next = { ...values, ...patch }
    setValues(next)
    pendingRef.current = next
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, SAVE_DELAY_MS)
  }

  /**
   * <dialog> が閉じたときに呼ばれる（［閉じる］・Esc・外側のクリックのどれでも）。
   * 保存待ちの内容をすぐに保存してから、Board に閉じたことを伝える
   */
  function handleClose() {
    flush()
    onClose()
  }

  /** マウスの位置が詳細画面の外側（背景）か */
  function isOutside(event: MouseEvent<HTMLDialogElement>) {
    const dialog = event.currentTarget
    // ポップアップの外側（背景）をクリックしても、イベントの target は <dialog> 自身になる。
    // 中の入力欄などをクリックしたときは target がその要素になるので、ここで外側ではないと分かる
    if (event.target !== dialog) return false
    const rect = dialog.getBoundingClientRect()
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
  }

  // 入力欄で文字を選択しながら外までドラッグしたときに閉じないよう、押した位置も外側のときだけ閉じる
  function handleMouseDown(event: MouseEvent<HTMLDialogElement>) {
    pressedOutsideRef.current = isOutside(event)
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (pressedOutsideRef.current && isOutside(event)) {
      event.currentTarget.close()
    }
    pressedOutsideRef.current = false
  }

  return (
    <dialog
      ref={dialogRef}
      className="detail"
      aria-label="カードの詳細"
      onClose={handleClose}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <div className="detail-form">
        <label className="field">
          <span className="field-label">タイトル</span>
          <input
            type="text"
            value={values.title}
            onChange={(event) => change({ title: event.target.value })}
            maxLength={MAX_TITLE_LENGTH}
          />
        </label>
        <label className="field">
          <span className="field-label">説明文</span>
          <textarea
            rows={5}
            value={values.description}
            onChange={(event) => change({ description: event.target.value })}
            placeholder="説明を入力（任意）"
          />
        </label>
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="detail-due">
              期限
            </label>
            <div className="due-input">
              <input
                id="detail-due"
                type="date"
                value={values.dueDate}
                onChange={(event) => change({ dueDate: event.target.value })}
              />
              {values.dueDate !== '' && (
                <button type="button" className="btn btn-text" onClick={() => change({ dueDate: '' })}>
                  解除
                </button>
              )}
            </div>
          </div>
          <label className="field">
            <span className="field-label">優先度</span>
            <select
              value={values.priority}
              // select の値は文字列になるので、Priority | '' として扱う
              onChange={(event) => change({ priority: event.target.value as Priority | '' })}
            >
              <option value="">なし</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
        </div>
        {hasSaveError && <p className="form-error">保存できませんでした</p>}
        <div className="detail-actions">
          <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
            閉じる
          </button>
        </div>
      </div>
    </dialog>
  )
}
