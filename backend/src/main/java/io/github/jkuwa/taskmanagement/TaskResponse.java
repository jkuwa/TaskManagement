package io.github.jkuwa.taskmanagement;

import java.time.Instant;
import java.time.LocalDate;

/**
 * API がフロントエンドに返すカードの中身（レスポンス用の DTO）。
 * 例：{"id":1,"title":"資料を作る","description":null,"priority":"high","dueDate":"2026-11-20",
 *      "status":"todo","position":0,"createdAt":"2026-11-20T01:00:00Z","updatedAt":"2026-11-20T01:00:00Z"}
 *
 * <p>DTO（Data Transfer Object）は、データを受け渡すためだけの入れ物。
 * Entity（Task）をそのまま返すと、DB のテーブルに列を足しただけで API の形まで変わってしまう。
 * 返す項目をこのクラスで決めておけば、DB と API を別々に変えられる。
 *
 * @param id          id
 * @param title       タイトル
 * @param description 説明文（未設定なら null）
 * @param priority    優先度（未設定なら null）
 * @param dueDate     期限（未設定なら null）
 * @param status      状態（どの列に入っているか）
 * @param position    列の中での並び順
 * @param createdAt   作成日時
 * @param updatedAt   更新日時
 */
public record TaskResponse(
		Integer id,
		String title,
		String description,
		Priority priority,
		LocalDate dueDate,
		TaskStatus status,
		Integer position,
		Instant createdAt,
		Instant updatedAt) {

	/**
	 * Entity（Task）から TaskResponse を作る。
	 *
	 * <p>static のメソッドなので、TaskResponse.from(task) のように、オブジェクトを作らずに呼べる。
	 *
	 * @param task カード
	 * @return API で返す形にしたカード
	 */
	public static TaskResponse from(Task task) {
		return new TaskResponse(
				task.getId(),
				task.getTitle(),
				task.getDescription(),
				task.getPriority(),
				task.getDueDate(),
				task.getStatus(),
				task.getPosition(),
				task.getCreatedAt(),
				task.getUpdatedAt());
	}
}
