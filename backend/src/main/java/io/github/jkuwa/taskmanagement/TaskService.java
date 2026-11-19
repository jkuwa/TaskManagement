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
 * 今は読み取りだけなので Repository を呼ぶだけだが、カードの追加・移動などを作るときに、
 * 「空のタイトルは作らない」「移動したら同じ列のほかのカードの position も直す」といった処理をここに書く。
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
}
