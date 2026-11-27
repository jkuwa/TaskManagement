import { describe, expect, test } from 'vitest'
import type { Task, TaskStatus } from './types'
import { formatDueDate, getDropIndex, groupByStatus, hasDescription, reorderTasks } from './utils'

/** テスト用のカードを作る */
function makeTask(id: number, status: TaskStatus, position = 0): Task {
  return {
    id,
    title: `カード${id}`,
    description: null,
    priority: null,
    dueDate: null,
    status,
    position,
    createdAt: '2026-11-20T10:00:00',
    updatedAt: '2026-11-20T10:00:00',
    subtasks: [],
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

describe('reorderTasks', () => {
  // 未着手 = [1, 2, 3]、進行中 = [4, 5]、完了 = []
  const tasks = [
    makeTask(1, 'todo', 0),
    makeTask(2, 'todo', 1),
    makeTask(3, 'todo', 2),
    makeTask(4, 'in_progress', 0),
    makeTask(5, 'in_progress', 1),
  ]

  /** 列ごとの「id:position」の並びにする（確かめやすくするため） */
  function summary(result: Task[]) {
    const groups = groupByStatus(result)
    return {
      todo: groups.todo.map((t) => `${t.id}:${t.position}`),
      in_progress: groups.in_progress.map((t) => `${t.id}:${t.position}`),
      done: groups.done.map((t) => `${t.id}:${t.position}`),
    }
  }

  test('同じ列の一番下を一番上へ動かす（F-20）', () => {
    expect(summary(reorderTasks(tasks, 3, 'todo', 0)).todo).toEqual(['3:0', '1:1', '2:2'])
  })

  test('別の列の2枚の間へ動かすと、移動元は詰められる（F-19）', () => {
    const result = reorderTasks(tasks, 1, 'in_progress', 1)
    expect(summary(result)).toEqual({
      todo: ['2:0', '3:1'],
      in_progress: ['4:0', '1:1', '5:2'],
      done: [],
    })
    expect(result.find((t) => t.id === 1)?.status).toBe('in_progress')
  })

  test('空の列へ動かす', () => {
    expect(summary(reorderTasks(tasks, 4, 'done', 0))).toEqual({
      todo: ['1:0', '2:1', '3:2'],
      in_progress: ['5:0'],
      done: ['4:0'],
    })
  })

  test('元の配列は書き換えない', () => {
    reorderTasks(tasks, 3, 'todo', 0)
    expect(tasks.map((t) => t.id)).toEqual([1, 2, 3, 4, 5])
    expect(tasks[2].position).toBe(2)
  })
})

describe('getDropIndex', () => {
  // カードの真ん中の高さが 100, 200, 300 の列
  const centers = [100, 200, 300]

  test('1枚目の真ん中より上なら 0（一番上）', () => {
    expect(getDropIndex(centers, 50)).toBe(0)
  })

  test('1枚目と2枚目の真ん中の間なら 1', () => {
    expect(getDropIndex(centers, 150)).toBe(1)
  })

  test('どのカードよりも下なら一番下', () => {
    expect(getDropIndex(centers, 350)).toBe(3)
  })

  test('カードがない列なら 0', () => {
    expect(getDropIndex([], 100)).toBe(0)
  })
})
