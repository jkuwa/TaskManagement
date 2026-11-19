package io.github.jkuwa.taskmanagement;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * カード（タスク）を読み取るための API。
 *
 * <ul>
 *   <li>GET /api/tasks：すべてのカードを並び順で返す</li>
 *   <li>GET /api/tasks/{id}：指定した id のカードを1件返す</li>
 * </ul>
 *
 * <p>戻り値の Task は、Spring Boot が getter（getTitle() など）をもとに自動で JSON に変換する。
 * 例：{"id":1,"title":"…","dueDate":"2026-11-20","status":"todo",…}
 */
@RestController
@RequestMapping("/api/tasks") // このクラスの URL はすべて /api/tasks から始まる
public class TaskController {

	private final TaskRepository taskRepository; // final：一度入れたら変更しない

	/**
	 * コンストラクタで TaskRepository を受け取る（コンストラクタインジェクション）。
	 * Spring が TaskRepository の中身を自動で作って渡してくれる。
	 * コンストラクタが1つだけなら @Autowired は書かなくてよい。
	 *
	 * @param taskRepository tasks テーブルを読み書きするリポジトリ
	 */
	public TaskController(TaskRepository taskRepository) {
		this.taskRepository = taskRepository;
	}

	/**
	 * GET /api/tasks にアクセスされたときに呼ばれる。
	 * ボード画面では、この結果を status ごとに分けて3つの列に表示する想定。
	 *
	 * @return すべてのカード（position → id の順）。1件もなければ []
	 */
	@GetMapping
	public List<Task> findAll() {
		return taskRepository.findAllByOrderByPositionAscIdAsc();
	}

	/**
	 * GET /api/tasks/{id} にアクセスされたときに呼ばれる（例：/api/tasks/1）。
	 *
	 * <p>@PathVariable で、URL の {id} の部分を引数 id として受け取る。
	 * findById は Optional（値がないかもしれない入れ物）を返すので、
	 * 見つからなければ orElseThrow で例外を投げ、404 Not Found を返す。
	 *
	 * @param id 取得したいカードの id
	 * @return 見つかったカード
	 * @throws ResponseStatusException 見つからなかったとき（404 Not Found）
	 */
	@GetMapping("/{id}")
	public Task findById(@PathVariable Integer id) {
		return taskRepository.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
	}
}
