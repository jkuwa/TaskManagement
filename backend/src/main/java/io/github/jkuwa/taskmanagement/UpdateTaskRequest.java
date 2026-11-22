package io.github.jkuwa.taskmanagement;

import java.time.LocalDate;

/**
 * 詳細画面で編集した内容を、フロントエンドから受け取るための入れ物。
 *
 * <p>フロントエンドは、カードの更新 API（PUT /api/tasks/{id}）に、編集した内容を JSON で送ってくる。
 * 例：{"title":"資料を作る","description":"構成から考える","dueDate":"2026-11-20","priority":"high"}
 *
 * <p>Java はこの JSON の文字列をそのままでは扱えないので、Spring Boot がこのクラスに詰め替えてくれる。
 * TaskController の update が引数としてこれを受け取り、TaskService の update に渡す。
 * Service では request.title() のように取り出して、入力のチェックとカードの更新に使う。
 *
 * <p>JSON の項目名とこのクラスの項目名（title など）が同じものに値が入る。
 * 項目のしくみ（record）は CreateTaskRequest のコメントを参照。
 *
 * <p>PUT は「送った内容で丸ごと置き換える」という意味のメソッド。
 * 詳細画面で編集できる4項目を毎回まとめて送ってもらう。
 * 説明文・期限・優先度を解除したいときは null を送る（JSON に項目がないときも null になる）。
 *
 * <p>一部の項目だけを送る PATCH にしなかったのは、Java では
 * 「項目を送らなかった（変えない）」と「null を送った（解除する）」を見分けるのが難しいため。
 *
 * <p>dueDate は LocalDate 型にしておくと、Spring Boot が "2026-11-20" の形の文字列を日付に変換してくれる。
 * 日付として読めない文字列が来たときは、自動で 400 Bad Request になる。
 *
 * @param title       タイトル（必須）
 * @param description 説明文（未設定なら null）
 * @param dueDate     期限（未設定なら null）
 * @param priority    優先度（high / medium / low。未設定なら null）
 */
public record UpdateTaskRequest(String title, String description, LocalDate dueDate, String priority) {
}
