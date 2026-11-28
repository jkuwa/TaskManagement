package io.github.jkuwa.taskmanagement;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * サブタスクに関する処理をまとめるクラス（Service 層）。
 *
 * <p>サブタスクは必ずどれかのカードに属するので、親のカードがあるかを確かめてから処理する。
 * カードを探す処理（見つからなければ TaskNotFoundException）は TaskService のものを使う。
 */
@Service
@Transactional(readOnly = true)
public class SubtaskService {

	private final TaskService taskService;
	private final SubtaskRepository subtaskRepository;

	/**
	 * コンストラクタで使う部品を受け取る（コンストラクタインジェクション）。
	 *
	 * @param taskService       カードに関する処理（親のカードを探すのに使う）
	 * @param subtaskRepository subtasks テーブルを読み書きするリポジトリ
	 */
	public SubtaskService(TaskService taskService, SubtaskRepository subtaskRepository) {
		this.taskService = taskService;
		this.subtaskRepository = subtaskRepository;
	}

	/**
	 * 指定したカードにサブタスクを追加する（docs/spec.md の F-21）。未完了の状態で、一覧の一番下に入る。
	 *
	 * <p>入力のチェック（空の内容、100文字を超える内容）は CreateSubtaskRequest で済んでいる。
	 * ここでは内容の前後の空白を取り除いて保存する（カードのタイトルと同じ）。
	 *
	 * @param taskId  親のカードの id
	 * @param request 追加するサブタスクの内容
	 * @return 保存したサブタスク（DB が振った id が入っている）
	 * @throws TaskNotFoundException カードが見つからないとき
	 */
	@Transactional
	public Subtask create(Integer taskId, CreateSubtaskRequest request) {
		Task task = taskService.findById(taskId);
		return subtaskRepository.save(new Subtask(task, request.title().strip()));
	}
}
