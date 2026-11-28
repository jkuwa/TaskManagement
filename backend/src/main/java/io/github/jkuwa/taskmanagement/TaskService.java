package io.github.jkuwa.taskmanagement;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * カード（タスク）に関する処理をまとめるクラス（Service 層）。
 *
 * <p>役割の分担：
 * <ul>
 *   <li>Controller：リクエストを受け取り、結果を返す（受け渡しだけ）</li>
 *   <li>Service（このクラス）：業務の処理（ルールのチェック、複数の処理をまとめて実行するなど）</li>
 *   <li>Repository：DB の読み書き</li>
 * </ul>
 * 「新しいカードは列の一番下に入れる」「移動したら並び順を振り直す」といった処理をここに書く。
 *
 * <p>入力のチェックの分担：
 * <ul>
 *   <li>項目だけで分かるもの（タイトルが空、100文字を超える、status がない など）：
 *       リクエストのクラスに付けたアノテーション（Bean Validation）で、Service を呼ぶ前にチェックする</li>
 *   <li>DB を見ないと分からないもの（カードがあるか、index が列の枚数を超えていないか）：このクラスでチェックする</li>
 * </ul>
 * チェックに引っかかったら例外を投げる。HTTP のレスポンス（404 や 400）にするのは ApiExceptionHandler の役目。
 *
 * <p>@Service を付けると、Spring がこのクラスを部品（Bean）として自動で作り、Controller に渡してくれる。
 *
 * <p>@Transactional(readOnly = true) は、このクラスのメソッドを読み取り専用のトランザクションで実行するという意味。
 * 読み取りだけだと分かっているので、Hibernate が変更の検知を省くなど、少し効率よく動く。
 * 書き込みをするメソッドを作るときは、そのメソッドに @Transactional を付け直す。
 */
@Service
@Transactional(readOnly = true)
public class TaskService {

	private final TaskRepository taskRepository;

	/**
	 * コンストラクタで TaskRepository を受け取る（コンストラクタインジェクション）。
	 *
	 * @param taskRepository tasks テーブルを読み書きするリポジトリ
	 */
	public TaskService(TaskRepository taskRepository) {
		this.taskRepository = taskRepository;
	}

	/**
	 * すべてのカードを、列の中での並び順（position → id の順）で取得する。
	 *
	 * @return カードのリスト。1件もなければ空のリスト
	 */
	public List<Task> findAll() {
		return taskRepository.findAllByOrderByPositionAscIdAsc();
	}

	/**
	 * 指定した id のカードを取得する。
	 *
	 * <p>findById は Optional（値がないかもしれない入れ物）を返すので、
	 * 見つからなければ orElseThrow で TaskNotFoundException を投げる（ApiExceptionHandler が 404 Not Found にする）。
	 *
	 * @param id 取得したいカードの id
	 * @return 見つかったカード
	 * @throws TaskNotFoundException 見つからなかったとき
	 */
	public Task findById(Integer id) {
		return taskRepository.findById(id)
				.orElseThrow(() -> new TaskNotFoundException(id));
	}

	/**
	 * 指定した id のカードがあるかを確かめる。なければ TaskNotFoundException を投げる。
	 *
	 * <p>カードの中身は使わず、あるかどうかだけを知りたいときに使う（サブタスクの更新・削除など）。
	 * findById はサブタスクもまとめて読み込むが、existsById は「あるかどうか」を調べる SQL だけを実行する。
	 *
	 * @param id 確かめたいカードの id
	 * @throws TaskNotFoundException 見つからなかったとき
	 */
	public void checkExists(Integer id) {
		if (!taskRepository.existsById(id)) {
			throw new TaskNotFoundException(id);
		}
	}

	/**
	 * カードを指定した列の一番下に追加する。
	 *
	 * <p>入力のチェック（空のタイトル、100文字を超えるタイトル、status がない）は
	 * CreateTaskRequest のアノテーションで済んでいる。ここではタイトルの前後の空白を取り除いて保存する。
	 *
	 * <p>クラスに付けた @Transactional(readOnly = true) は読み取り専用なので、
	 * 書き込みをするこのメソッドには @Transactional を付け直す（メソッドに付けたほうが優先される）。
	 *
	 * @param request 追加するカードのタイトルと列
	 * @return 保存したカード（DB が振った id や作成日時が入っている）
	 */
	@Transactional
	public Task create(CreateTaskRequest request) {
		TaskStatus status = request.status();

		// 列の一番下のカードの position + 1 にする。列が空なら 0
		int position = taskRepository.findTopByStatusOrderByPositionDesc(status)
				.map(last -> last.getPosition() + 1)
				.orElse(0);

		// new Task を DB にINSERT し、id なども入った状態の Task を Controller に返す
		return taskRepository.save(new Task(request.title().strip(), status, position));
	}

	/**
	 * 指定した id のカードの、タイトル・説明文・期限・優先度を更新する（詳細画面での編集）。
	 *
	 * <p>入力のチェック（タイトル、日付の形式、優先度の値）は UpdateTaskRequest で済んでいる。ここでは次のことをする。
	 * <ul>
	 *   <li>タイトルの前後の空白を取り除く</li>
	 *   <li>説明文が空白だけなら null（未設定）にする（docs/spec.md の F-17）</li>
	 * </ul>
	 * カードが見つからないときは TaskNotFoundException を投げる。
	 *
	 * <p>findById で読み込んだ Task の値（リポジトリを使用して取得した情報）を書き換えると、
	 * メソッドが終わるとき（トランザクションの終わり）に
	 * JPA が自動で UPDATE 文を実行する。そのため save を呼ばなくてよい。
	 *
	 * @param id      更新するカードの id
	 * @param request 更新後のタイトル・説明文・期限・優先度
	 * @return 更新したカード
	 * @throws TaskNotFoundException カードが見つからないとき
	 */
	@Transactional
	public Task update(Integer id, UpdateTaskRequest request) {
		String description = request.description();
		if (description != null && description.isBlank()) {
			description = null;
		}

		Task task = findById(id);
		// Task.java の update メソッド
		task.update(request.title().strip(), description, request.dueDate(), request.priority());
		return task;
	}
	// JPA が自動で UPDATE 実行

	/**
	 * カードを、指定した列の指定した位置へ移動する（ボードでのドラッグ&ドロップ。docs/spec.md の F-19, F-20）。
	 *
	 * <p>処理の流れ：
	 * <ol>
	 *   <li>移動先の列のカードを並び順で取り出し、動かすカードがあれば取り除く</li>
	 *   <li>index の位置に動かすカードを入れ、上から 0, 1, 2… と position を振り直す</li>
	 *   <li>別の列から来たときは、移動元の列も 0 から振り直す（抜けた穴を詰める）</li>
	 * </ol>
	 * 毎回 0 から振り直すので、position は列ごとに 0, 1, 2… と連番になる。
	 *
	 * <p>入力のチェック：status・index がない、index が負のときは MoveTaskRequest で済んでいる。
	 * index が移動先の列の枚数（動かすカードを除く）より大きいときは、ここで InvalidTaskPositionException を投げる。
	 *
	 * <p>移動元と移動先の両方の列の position が変わるので、すべてのカードを返す。
	 * findAll の SELECT の前に、Hibernate が書き換えた内容を自動で DB に送る（flush）ので、
	 * 移動したあとの並びで返る。
	 *
	 * @param id      移動するカードの id
	 * @param request 移動先の列と位置
	 * @return すべてのカード（position → id の順）
	 * @throws TaskNotFoundException        カードが見つからないとき
	 * @throws InvalidTaskPositionException index が列の枚数より大きいとき
	 */
	@Transactional
	public List<Task> move(Integer id, MoveTaskRequest request) {
		TaskStatus status = request.status();
		Task task = findById(id);
		TaskStatus fromStatus = task.getStatus();

		// 移動先の列のカード（動かすカード自身は除く）
		// removeIf：条件に合う要素をリストから取り除く。同じ列の中で動かすときに、自分を一度抜くため
		List<Task> targetTasks = new ArrayList<>(taskRepository.findByStatusOrderByPositionAscIdAsc(status));
		targetTasks.removeIf(t -> t.getId().equals(id));

		int index = request.index();
		// index は 0（一番上）〜 targetTasks.size()（一番下）まで。0 以上かは MoveTaskRequest でチェック済み
		if (index > targetTasks.size()) {
			throw new InvalidTaskPositionException(index, targetTasks.size());
		}

		targetTasks.add(index, task);
		renumber(targetTasks, status);

		// 別の列から来たときは、移動元の列の穴を詰める
		// （enum は値ごとにオブジェクトが1つだけなので、!= で比べてよい）
		if (fromStatus != status) {
			// SELECT の直前に、Hibernate が読み込んだとき（findById(id)）の値と今の値を比べ、変わったカードを先に UPDATE する（flush）。
			// そのため、動かしたカードは DB でも移動先の status になっていて、ここでは取得されない
			renumber(taskRepository.findByStatusOrderByPositionAscIdAsc(fromStatus), fromStatus);
		}

		return findAll();
	}
	// JPA が自動で UPDATE 実行

	/**
	 * 指定した id のカードを削除する（詳細画面の［削除］。docs/spec.md の F-18）。
	 *
	 * <p>DB の行を消す物理削除にする（削除済みの印を付けて残す論理削除にはしない）。
	 * カードのサブタスクも一緒に削除する（Task の subtasks に付けた cascade で Hibernate が消す。docs/database.md）。
	 *
	 * <p>削除したあと、同じ列の残りのカードの position を 0 から振り直す（抜けた穴を詰める）。
	 * findByStatus… の SELECT の前に、Hibernate が DELETE を DB に送る（flush）ので、
	 * 削除したカードは取得されない。
	 *
	 * @param id 削除するカードの id
	 * @throws TaskNotFoundException カードが見つからないとき
	 */
	@Transactional
	public void delete(Integer id) {
		Task task = findById(id);
		taskRepository.delete(task);
		renumber(taskRepository.findByStatusOrderByPositionAscIdAsc(task.getStatus()), task.getStatus());
	}
	// JPA が自動で DELETE・UPDATE 実行

	/**
	 * リストの順番どおりに、position を 0, 1, 2… と振り直す。
	 *
	 * @param tasks  並べたい順のカード
	 * @param status 列（todo / in_progress / done）
	 */
	private void renumber(List<Task> tasks, TaskStatus status) {
		for (int i = 0; i < tasks.size(); i++) {
			tasks.get(i).move(status, i);
		}
	}
}
