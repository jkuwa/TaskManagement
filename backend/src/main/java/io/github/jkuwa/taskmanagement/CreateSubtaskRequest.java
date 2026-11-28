package io.github.jkuwa.taskmanagement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * サブタスクを追加するとき（POST /api/tasks/{taskId}/subtasks）に受け取るリクエストの中身。
 * 例：{"title":"構成を考える"}
 *
 * <p>入力のルールはカードのタイトルと同じにする（docs/spec.md の F-21）。
 * <ul>
 *   <li>{@code @NotBlank}：null・空文字・空白だけを許さない</li>
 *   <li>{@code @Size}：100文字まで（Task.MAX_TITLE_LENGTH。絵文字などは1つで2文字と数える）</li>
 * </ul>
 *
 * @param title サブタスクの内容
 */
public record CreateSubtaskRequest(
		@NotBlank(message = "サブタスクの内容を入力してください")
		@Size(max = Task.MAX_TITLE_LENGTH, message = "サブタスクの内容は{max}文字までです")
		String title) {
}
