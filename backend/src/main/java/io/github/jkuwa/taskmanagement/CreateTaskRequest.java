package io.github.jkuwa.taskmanagement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * カードを追加するとき（POST /api/tasks）に受け取るリクエストの中身。
 * 例：{"title":"資料を作る","status":"todo"}
 *
 * <p>record（レコード）は、値を入れておくだけのクラスを短く書くための書き方。
 * 次のものを自動で作ってくれる。
 * <ul>
 *   <li>private final のフィールド（title, status）</li>
 *   <li>全部の値を受け取るコンストラクタ</li>
 *   <li>値を取り出すメソッド（title()、status()。get は付かない）</li>
 * </ul>
 * Spring Boot は、リクエストの JSON の項目名とレコードの項目名を合わせて、自動で値を入れてくれる。
 * JSON に項目がないときは null が入る。
 *
 * <p>項目に付けたアノテーションは、入力のチェックのルール（Bean Validation）。
 * TaskController の引数に {@code @Valid} を付けると、Service を呼ぶ前に Spring がチェックし、
 * ルールに合わなければ 400 Bad Request を返す（返す内容は ApiExceptionHandler を参照）。
 * <ul>
 *   <li>{@code @NotBlank}：null・空文字・空白だけを許さない</li>
 *   <li>{@code @Size(max = …)}：文字数の上限（{max} はメッセージの中で上限の数に置き換わる）</li>
 *   <li>{@code @NotNull}：null（項目がない）を許さない</li>
 * </ul>
 * status に決まった値（todo / in_progress / done）以外が来たときは、TaskStatus に変換できずに 400 になる。
 *
 * @param title  タイトル
 * @param status 追加する列（todo / in_progress / done）
 */
public record CreateTaskRequest(
		@NotBlank(message = "タイトルを入力してください")
		@Size(max = Task.MAX_TITLE_LENGTH, message = "タイトルは{max}文字までです")
		String title,

		@NotNull(message = "status を指定してください")
		TaskStatus status) {
}
