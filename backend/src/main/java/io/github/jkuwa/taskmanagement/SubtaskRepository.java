package io.github.jkuwa.taskmanagement;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * subtasks テーブルを読み書きするためのリポジトリ。
 *
 * <p>今はサブタスクを保存するだけなので、JpaRepository が用意しているメソッド（save など）で足りる。
 * カードと一緒にサブタスクを読み込むのは TaskRepository の役目（{@code @EntityGraph}）。
 */
public interface SubtaskRepository extends JpaRepository<Subtask, Integer> {
}
