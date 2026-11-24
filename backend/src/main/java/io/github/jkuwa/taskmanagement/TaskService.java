package io.github.jkuwa.taskmanagement;

import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * カード（タスク）に関する処理をまとめるクラス（Service 層）。
 *
 * <p>役割の分担：
 * <ul>
 *   <li>Controller：リクエストを受け取り、結果を返す（受け渡しだけ）</li>
 *   <li>Service（このクラス）：業務の処理（ルールのチェック、複数の処理をまとめて実行するなど）</li>
 *   <li>Repository：DB の読み書き</li>
 * </ul>
 * 「空のタイトルは作らない」「新しいカードは列の一番下に入れる」といった処理をここに書く。
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

	/** タイトルの最大文字数（static final：クラスで1つだけの、変わらない値＝定数） */
	static final int MAX_TITLE_LENGTH = 100;

	/** status として使える値（列） */
	private static final List<String> STATUSES = List.of("todo", "in_progress", "done");

	/** priority として使える値（未設定の null はこれとは別に許可する） */
	private static final List<String> PRIORITIES = List.of("high", "medium", "low");

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
	 * 見つからなければ orElseThrow で例外を投げる。
	 * ResponseStatusException を投げると、Spring が 404 Not Found のレスポンスに変換してくれる。
	 *
	 * @param id 取得したいカードの id
	 * @return 見つかったカード
	 * @throws ResponseStatusException 見つからなかったとき（404 Not Found）
	 */
	public Task findById(Integer id) {
		return taskRepository.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
	}

	/**
	 * カードを指定した列の一番下に追加する。
	 *
	 * <p>入力のチェック（docs/spec.md の F-11）：
	 * <ul>
	 *   <li>タイトルの前後の空白は取り除いて保存する（trim）</li>
	 *   <li>タイトルが空・空白だけなら作らない</li>
	 *   <li>タイトルが {@value #MAX_TITLE_LENGTH} 文字を超えるなら作らない</li>
	 *   <li>status が todo / in_progress / done 以外なら作らない</li>
	 * </ul>
	 * 作らないときは 400 Bad Request（リクエストの内容が正しくない）を返す。
	 *
	 * <p>クラスに付けた @Transactional(readOnly = true) は読み取り専用なので、
	 * 書き込みをするこのメソッドには @Transactional を付け直す（メソッドに付けたほうが優先される）。
	 *
	 * @param request 追加するカードのタイトルと列
	 * @return 保存したカード（DB が振った id や作成日時が入っている）
	 * @throws ResponseStatusException 入力が正しくないとき（400 Bad Request）
	 */
	@Transactional
	public Task create(CreateTaskRequest request) {
		String title = validateTitle(request.title());
		String status = request.status();
		// List.of で作ったリストは contains(null) で例外になるので、先に null を確かめる
		if (status == null || !STATUSES.contains(status)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status が正しくありません");
		}

		// 列の一番下のカードの position + 1 にする。列が空なら 0
		int position = taskRepository.findTopByStatusOrderByPositionDesc(status)
				.map(last -> last.getPosition() + 1)
				.orElse(0);

		// new Task を DB にINSERT し、id なども入った状態の Task を Controller に返す
		return taskRepository.save(new Task(title, status, position));
	}

	/**
	 * 指定した id のカードの、タイトル・説明文・期限・優先度を更新する（詳細画面での編集）。
	 *
	 * <p>入力のチェック（docs/spec.md の F-13〜F-16）：
	 * <ul>
	 *   <li>タイトルは追加のときと同じ（前後の空白を取り除く・空なら更新しない・{@value #MAX_TITLE_LENGTH} 文字まで）</li>
	 *   <li>説明文は空白だけなら null（未設定）にする</li>
	 *   <li>優先度は high / medium / low / null（未設定）以外なら更新しない</li>
	 * </ul>
	 * 更新しないときは 400 Bad Request を返す。カードが見つからないときは 404 Not Found を返す。
	 *
	 * <p>findById で読み込んだ Task の値（リポジトリを使用して取得した情報）を書き換えると、
	 * メソッドが終わるとき（トランザクションの終わり）に
	 * JPA が自動で UPDATE 文を実行する。そのため save を呼ばなくてよい。
	 *
	 * @param id      更新するカードの id
	 * @param request 更新後のタイトル・説明文・期限・優先度
	 * @return 更新したカード
	 * @throws ResponseStatusException 入力が正しくないとき（400）、カードが見つからないとき（404）
	 */
	@Transactional
	public Task update(Integer id, UpdateTaskRequest request) {
		String title = validateTitle(request.title());

		String priority = request.priority();
		if (priority != null && !PRIORITIES.contains(priority)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "priority が正しくありません");
		}

		// 空白だけの説明文は「入っていない」扱いにする（docs/spec.md の F-17）
		String description = request.description();
		if (description != null && description.isBlank()) {
			description = null;
		}

		Task task = findById(id);
		// Task.java の update メソッド
		task.update(title, description, request.dueDate(), priority);
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
	 * <p>入力のチェック：
	 * <ul>
	 *   <li>status が todo / in_progress / done 以外なら移動しない</li>
	 *   <li>index がない・負・移動先の列の枚数（動かすカードを除く）より大きいなら移動しない</li>
	 * </ul>
	 * 移動しないときは 400 Bad Request を返す。カードが見つからないときは 404 Not Found を返す。
	 *
	 * <p>移動元と移動先の両方の列の position が変わるので、すべてのカードを返す。
	 * findAll の SELECT の前に、Hibernate が書き換えた内容を自動で DB に送る（flush）ので、
	 * 移動したあとの並びで返る。
	 *
	 * @param id      移動するカードの id
	 * @param request 移動先の列と位置
	 * @return すべてのカード（position → id の順）
	 * @throws ResponseStatusException 入力が正しくないとき（400）、カードが見つからないとき（404）
	 */
	@Transactional
	public List<Task> move(Integer id, MoveTaskRequest request) {
		String status = request.status();
		if (status == null || !STATUSES.contains(status)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status が正しくありません");
		}

		Task task = findById(id);
		String fromStatus = task.getStatus();

		// 移動先の列のカード（動かすカード自身は除く）
		// removeIf：条件に合う要素をリストから取り除く。同じ列の中で動かすときに、自分を一度抜くため
		List<Task> targetTasks = new ArrayList<>(taskRepository.findByStatusOrderByPositionAscIdAsc(status));
		targetTasks.removeIf(t -> t.getId().equals(id));

		Integer index = request.index();
		// index は 0（一番上）〜 targetTasks.size()（一番下）まで
		if (index == null || index < 0 || index > targetTasks.size()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "index が正しくありません");
		}

		targetTasks.add(index, task);
		renumber(targetTasks, status);

		// 別の列から来たときは、移動元の列の穴を詰める
		if (!fromStatus.equals(status)) {
			renumber(taskRepository.findByStatusOrderByPositionAscIdAsc(fromStatus), fromStatus);
		}

		return findAll();
	}

	/**
	 * リストの順番どおりに、position を 0, 1, 2… と振り直す。
	 *
	 * <p>移動元の列を読み込むとき、SELECT の前に Hibernate が書き換えた内容を DB に送る（flush）。
	 * 動かしたカードはすでに移動先の status になっているので、移動元の列のリストには入らない。
	 *
	 * @param tasks  並べたい順のカード
	 * @param status 列（todo / in_progress / done）
	 */
	private void renumber(List<Task> tasks, String status) {
		for (int i = 0; i < tasks.size(); i++) {
			tasks.get(i).move(status, i);
		}
	}

	/**
	 * タイトルをチェックし、前後の空白を取り除いたものを返す。カードの追加と更新で共通に使う。
	 *
	 * @param rawTitle 受け取ったタイトル（null のこともある）
	 * @return 前後の空白を取り除いたタイトル
	 * @throws ResponseStatusException 空・空白だけ・{@value #MAX_TITLE_LENGTH} 文字を超えるとき（400 Bad Request）
	 */
	private String validateTitle(String rawTitle) {
		String title = rawTitle == null ? "" : rawTitle.trim();
		if (title.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "タイトルを入力してください");
		}
		// codePointCount：文字数を数える。length() だと絵文字などが2文字と数えられるため
		if (title.codePointCount(0, title.length()) > MAX_TITLE_LENGTH) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
					"タイトルは" + MAX_TITLE_LENGTH + "文字までです");
		}
		return title;
	}
}
