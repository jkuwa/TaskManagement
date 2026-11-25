import type { Task, TaskStatus } from '../types'

/** テスト用のカードを作る。overrides に書いた項目だけ値を変えられる */
export function makeTask(id: number, status: TaskStatus = 'todo', overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `カード${id}`,
    description: null,
    priority: null,
    dueDate: null,
    status,
    position: 0,
    createdAt: '2026-11-20T01:00:00Z',
    updatedAt: '2026-11-20T01:00:00Z',
    ...overrides,
  }
}
