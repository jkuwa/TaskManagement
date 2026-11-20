import { describe, expect, test } from 'vitest'
import type { Task, TaskStatus } from './types'
import { formatDueDate, groupByStatus, hasDescription } from './utils'

/** テスト用のカードを作る */
function makeTask(id: number, status: TaskStatus): Task {
  return {
    id,
    title: `カード${id}`,
    description: null,
    priority: null,
    dueDate: null,
    status,
    position: 0,
    createdAt: '2026-11-20T10:00:00',
    updatedAt: '2026-11-20T10:00:00',
  }
}

describe('formatDueDate', () => {
  test('月/日 の形にする', () => {
    expect(formatDueDate('2026-11-20')).toBe('11/20')
  })

  test('月・日の頭に 0 を付けない', () => {
    expect(formatDueDate('2027-01-05')).toBe('1/5')
  })
})

describe('hasDescription', () => {
  test('文字が入っていれば true', () => {
    expect(hasDescription('説明')).toBe(true)
  })

  test('null・空文字・空白だけなら false', () => {
    expect(hasDescription(null)).toBe(false)
    expect(hasDescription('')).toBe(false)
    expect(hasDescription(' 　\n')).toBe(false)
  })
})

describe('groupByStatus', () => {
  test('status ごとに分け、元の順番を保つ', () => {
    const tasks = [
      makeTask(1, 'todo'),
      makeTask(2, 'done'),
      makeTask(3, 'todo'),
      makeTask(4, 'in_progress'),
    ]
    const groups = groupByStatus(tasks)
    expect(groups.todo.map((t) => t.id)).toEqual([1, 3])
    expect(groups.in_progress.map((t) => t.id)).toEqual([4])
    expect(groups.done.map((t) => t.id)).toEqual([2])
  })

  test('カードがなくても3つの列の空配列を返す', () => {
    expect(groupByStatus([])).toEqual({ todo: [], in_progress: [], done: [] })
  })
})
