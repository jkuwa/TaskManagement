package io.github.jkuwa.taskmanagement;

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
 * @param title  タイトル
 * @param status 追加する列（todo / in_progress / done）
 */
public record CreateTaskRequest(String title, String status) {
}
