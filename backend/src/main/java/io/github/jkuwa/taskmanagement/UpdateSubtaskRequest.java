package io.github.jkuwa.taskmanagement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * サブタスクを更新するとき（PUT /api/tasks/{taskId}/subtasks/{id}）に受け取るリクエストの中身。
 * 例：{"title":"構成を考える","done":true}
 *
 * <p>PUT は「送った内容で丸ごと置き換える」ので、内容と完了したかの2つを毎回まとめて送ってもらう
 * （カードの UpdateTaskRequest と同じ考え方）。
 * <ul>
 *   <li>title：入力のルールは CreateSubtaskRequest と同じ（空・空白だけは不可、100文字まで）</li>
 *   <li>done：{@code @NotNull}。boolean ではなく Boolean にしているのは、JSON に done がないときに
 *       null になって入力のチェックで気づけるようにするため（boolean だと黙って false になる）</li>
 * </ul>
 *
 * @param title サブタスクの内容
 * @param done  完了したか
 */
public record UpdateSubtaskRequest(
		@NotBlank(message = "サブタスクの内容を入力してください")
		@Size(max = Task.MAX_TITLE_LENGTH, message = "サブタスクの内容は{max}文字までです")
		String title,

		@NotNull(message = "完了したかを指定してください")
		Boolean done) {
}
