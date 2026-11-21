package io.github.jkuwa.taskmanagement;

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
		String title = request.title() == null ? "" : request.title().trim();
		if (title.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "タイトルを入力してください");
		}
		// codePointCount：文字数を数える。length() だと絵文字などが2文字と数えられるため
		if (title.codePointCount(0, title.length()) > MAX_TITLE_LENGTH) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
					"タイトルは" + MAX_TITLE_LENGTH + "文字までです");
		}
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
}
