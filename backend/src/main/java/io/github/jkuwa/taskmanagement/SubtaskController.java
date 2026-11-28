package io.github.jkuwa.taskmanagement;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

/**
 * サブタスクを読み書きするための API。
 *
 * <ul>
 *   <li>POST /api/tasks/{taskId}/subtasks：カードにサブタスクを追加する</li>
 *   <li>PUT /api/tasks/{taskId}/subtasks/{id}：サブタスクの内容と完了したかを更新する</li>
 * </ul>
 *
 * <p>サブタスクは必ずどれかのカードに属するので、URL もカードの下（/api/tasks/{taskId}/…）に置く。
 * サブタスクの一覧は、カードの API（GET /api/tasks など）の subtasks に入れて返すので、ここには作らない。
 *
 * <p>エラーのとき（カード・サブタスクが見つからない、入力が正しくない）は、カードの API と同じく
 * ApiExceptionHandler が ProblemDetail の形で返す。
 */
@RestController
@RequestMapping("/api/tasks/{taskId}/subtasks")
public class SubtaskController {

	private final SubtaskService subtaskService;

	/**
	 * コンストラクタで SubtaskService を受け取る（コンストラクタインジェクション）。
	 *
	 * @param subtaskService サブタスクに関する処理をまとめたクラス
	 */
	public SubtaskController(SubtaskService subtaskService) {
		this.subtaskService = subtaskService;
	}

	/**
	 * POST /api/tasks/{taskId}/subtasks にアクセスされたときに呼ばれる。詳細画面でサブタスクを追加する。
	 * 成功したら 201 Created と、作ったサブタスクを返す。
	 * 入力が正しくないときは 400 Bad Request、カードが見つからないときは 404 Not Found が返る。
	 *
	 * @param taskId  親のカードの id（URL の {taskId} の部分）
	 * @param request 追加するサブタスクの内容。例：{"title":"構成を考える"}
	 * @return 作ったサブタスク
	 */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public SubtaskResponse create(@PathVariable Integer taskId, @Valid @RequestBody CreateSubtaskRequest request) {
		return SubtaskResponse.from(subtaskService.create(taskId, request));
	}

	/**
	 * PUT /api/tasks/{taskId}/subtasks/{id} にアクセスされたときに呼ばれる。
	 * 詳細画面で完了・未完了を切り替えたとき（F-22）と、内容を書き換えたとき（F-26）に使う。
	 * 成功したら 200 OK と、更新したサブタスクを返す。
	 * 入力が正しくないときは 400 Bad Request、カードかサブタスクが見つからないときは 404 Not Found が返る。
	 *
	 * @param taskId  親のカードの id（URL の {taskId} の部分）
	 * @param id      サブタスクの id（URL の {id} の部分）
	 * @param request 更新する内容。例：{"title":"構成を考える","done":true}
	 * @return 更新したサブタスク
	 */
	@PutMapping("/{id}")
	public SubtaskResponse update(@PathVariable Integer taskId, @PathVariable Integer id,
			@Valid @RequestBody UpdateSubtaskRequest request) {
		return SubtaskResponse.from(subtaskService.update(taskId, id, request));
	}
}
