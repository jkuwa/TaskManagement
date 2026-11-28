package io.github.jkuwa.taskmanagement;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * subtasks テーブルを読み書きするためのリポジトリ。
 *
 * <p>保存は JpaRepository が用意しているメソッド（save など）を使う。
 * カードと一緒にサブタスクを読み込むのは TaskRepository の役目（{@code @EntityGraph}）。
 */
public interface SubtaskRepository extends JpaRepository<Subtask, Integer> {

	/**
	 * id と親のカードの id を指定して、サブタスクを1つ取り出す。
	 *
	 * <p>メソッドの名前から Spring Data JPA が SQL を作ってくれる（WHERE id = ? AND task_id = ?）。
	 * TaskId は「task の id」という意味で、Subtask の task（親のカード）の id で絞り込む。
	 * 別のカードのサブタスクを URL で指定されても、見つからない扱いにするために使う。
	 *
	 * @param id     サブタスクの id
	 * @param taskId 親のカードの id
	 * @return 見つかったサブタスク。なければ空の Optional
	 */
	Optional<Subtask> findByIdAndTaskId(Integer id, Integer taskId);
}
