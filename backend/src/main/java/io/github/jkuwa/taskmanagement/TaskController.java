package io.github.jkuwa.taskmanagement;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * カード（タスク）を読み書きするための API。
 *
 * <ul>
 *   <li>GET /api/tasks：すべてのカードを並び順で返す</li>
 *   <li>GET /api/tasks/{id}：指定した id のカードを1件返す</li>
 *   <li>POST /api/tasks：カードを列の一番下に追加する</li>
 *   <li>PUT /api/tasks/{id}：カードのタイトル・説明文・期限・優先度を更新する</li>
 *   <li>PUT /api/tasks/{id}/position：カードを指定した列の指定した位置へ移動する</li>
 *   <li>DELETE /api/tasks/{id}：カードを削除する</li>
 * </ul>
 *
 * <p>Controller はリクエストの受け渡しだけを行い、実際の処理は TaskService に任せる。
 *
 * <p>戻り値の Task は、Spring Boot が getter（getTitle() など）をもとに自動で JSON に変換する。
 * 例：{"id":1,"title":"…","dueDate":"2026-11-20","status":"todo",…}
 */
@RestController
@RequestMapping("/api/tasks") // このクラスの URL はすべて /api/tasks から始まる
public class TaskController {

	// フィールド
	private final TaskService taskService; // final：一度入れたら変更しない

	/**
	 * final：オブジェクトを作り終えるまでに値を入れる決まり。
	 * コンストラクタを省略してフィールドに直接 @Autowired をつける書き方だと、一旦値のないオブジェクトが作られてしまうため final をつけられない。
	 * 
	 * TaskService：型
	 * Javaでは、自分で作ったクラスもそのまま型として使える。
	 * ここでは「この変数には、TaskService クラスから作ったオブジェクトが入る」という意味。
	 * 
	 * コンストラクタで TaskService を受け取る（コンストラクタインジェクション）。
	 * Spring が TaskService を自動で作って渡してくれる。
	 * コンストラクタが1つだけなら @Autowired は書かなくてよい。
	 * （テストクラスはJUnitが実行するため、省略してしまうと Spring に作ってもらえない。）
	 *
	 * @param taskService カードに関する処理をまとめたクラス
	 */
	public TaskController(TaskService taskService) {
		this.taskService = taskService;
	}

	/**
	 * GET /api/tasks にアクセスされたときに呼ばれる。
	 * ボード画面では、この結果を status ごとに分けて3つの列に表示する想定。
	 *
	 * @return すべてのカード（position → id の順）。1件もなければ []
	 */
	@GetMapping
	public List<Task> findAll() {
		return taskService.findAll();
	}

	/**
	 * GET /api/tasks/{id} にアクセスされたときに呼ばれる（例：/api/tasks/1）。
	 * {@code @PathVariable} で、URL の {id} の部分を引数 id として受け取る。
	 * 見つからないときは TaskService が例外を投げ、404 Not Found が返る。
	 *
	 * @param id 取得したいカードの id
	 * @return 見つかったカード
	 */
	@GetMapping("/{id}")
	public Task findById(@PathVariable Integer id) {
		return taskService.findById(id);
	}

	/**
	 * POST /api/tasks にアクセスされたときに呼ばれる。カードを指定した列の一番下に追加する。
	 *
	 * <ul>
	 *   <li>{@code @PostMapping}：POST メソッドのリクエストを受け取る（データを新しく作るときに使う）</li>
	 *   <li>{@code @RequestBody}：リクエストの本文（JSON）を CreateTaskRequest に変換して受け取る</li>
	 *   <li>{@code @ResponseStatus(HttpStatus.CREATED)}：成功したら 200 OK ではなく 201 Created を返す
	 *       （「新しく作った」ことを表すステータス）</li>
	 * </ul>
	 * 入力が正しくないときは TaskService が例外を投げ、400 Bad Request が返る。
	 *
	 * @param request 追加するカードのタイトルと列。例：{"title":"資料を作る","status":"todo"}
	 * @return 作ったカード（id・position・作成日時などが入っている）
	 */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public Task create(@RequestBody CreateTaskRequest request) {
		return taskService.create(request);
	}

	/**
	 * PUT /api/tasks/{id} にアクセスされたときに呼ばれる。詳細画面で編集した内容でカードを更新する。
	 *
	 * <ul>
	 *   <li>{@code @PutMapping}：PUT メソッドのリクエストを受け取る（データを丸ごと置き換えるときに使う）</li>
	 *   <li>成功したら 200 OK と、更新したカードを返す</li>
	 * </ul>
	 * 入力が正しくないときは 400 Bad Request、カードが見つからないときは 404 Not Found が返る。
	 *
	 * @param id      更新するカードの id
	 * @param request 更新後の内容。例：{"title":"資料を作る","description":null,"dueDate":"2026-11-20","priority":"high"}
	 * @return 更新したカード
	 */
	@PutMapping("/{id}")
	public Task update(@PathVariable Integer id, @RequestBody UpdateTaskRequest request) {
		return taskService.update(id, request);
	}

	/**
	 * PUT /api/tasks/{id}/position にアクセスされたときに呼ばれる。
	 * ボードでドラッグ&ドロップしたカードを、指定した列の指定した位置へ移動する。
	 *
	 * <p>移動元と移動先の両方の列の並び順が変わるので、GET /api/tasks と同じ形ですべてのカードを返す。
	 * 入力が正しくないときは 400 Bad Request、カードが見つからないときは 404 Not Found が返る。
	 *
	 * @param id      移動するカードの id
	 * @param request 移動先の列と位置。例：{"status":"in_progress","index":1}
	 * @return すべてのカード（position → id の順）
	 */
	@PutMapping("/{id}/position")
	public List<Task> move(@PathVariable Integer id, @RequestBody MoveTaskRequest request) {
		return taskService.move(id, request);
	}

	/**
	 * DELETE /api/tasks/{id} にアクセスされたときに呼ばれる。詳細画面の［削除］でカードを削除する。
	 *
	 * <ul>
	 *   <li>{@code @DeleteMapping}：DELETE メソッドのリクエストを受け取る（データを削除するときに使う）</li>
	 *   <li>{@code @ResponseStatus(HttpStatus.NO_CONTENT)}：成功したら 204 No Content を返す
	 *       （「成功したが、返す本文はない」ことを表すステータス）</li>
	 * </ul>
	 * カードが見つからないときは 404 Not Found が返る。
	 *
	 * @param id 削除するカードの id
	 */
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable Integer id) {
		taskService.delete(id);
	}
}
