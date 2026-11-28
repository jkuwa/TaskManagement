package io.github.jkuwa.taskmanagement;

/**
 * API がフロントエンドに返すサブタスクの中身（レスポンス用の DTO）。
 * 例：{"id":1,"title":"構成を考える","done":false}
 *
 * <p>カードの中（TaskResponse の subtasks）と、サブタスクを追加・更新する API の結果で使う。
 *
 * @param id    id
 * @param title 内容
 * @param done  完了したか
 */
public record SubtaskResponse(Integer id, String title, boolean done) {

	/**
	 * Entity（Subtask）から SubtaskResponse を作る。
	 *
	 * @param subtask サブタスク
	 * @return API で返す形にしたサブタスク
	 */
	public static SubtaskResponse from(Subtask subtask) {
		return new SubtaskResponse(subtask.getId(), subtask.getTitle(), subtask.isDone());
	}
}
