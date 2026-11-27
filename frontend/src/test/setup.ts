/**
 * テスト（Vitest）を実行する前に読み込む準備のファイル。vite.config.ts の test.setupFiles で指定している。
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jest-dom：expect(要素).toBeInTheDocument() のような、画面の要素を確かめる書き方を使えるようにする（上の import）

// テストごとに、描画した部品を片付ける（前のテストの画面が残らないように）
afterEach(() => {
  cleanup()
})

// テストで使う jsdom（ブラウザのまね）には、<dialog> の showModal・close がないので、最低限の動きを用意する。
// - showModal：open 属性を付ける（開いた状態にする）
// - close：open 属性を外し、ブラウザと同じように close イベントを出す（React の onClose が呼ばれる）
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
