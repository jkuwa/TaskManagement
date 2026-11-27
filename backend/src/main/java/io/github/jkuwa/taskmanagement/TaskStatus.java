package io.github.jkuwa.taskmanagement;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * カードの状態（どの列に入っているか）。
 *
 * <p>enum（列挙型）は、決まった値だけを持てる型。String で持つと "unknown" のような値も入ってしまうが、
 * enum なら TODO・IN_PROGRESS・DONE の3つ以外は入れられないので、チェックの書き忘れが起きない。
 *
 * <p>DB と JSON では、これまでどおり "todo" / "in_progress" / "done" の文字列で表す。
 * <ul>
 *   <li>JSON：{@code @JsonValue} の付いたメソッドの値で書き出し、{@code @JsonCreator} の付いたメソッドで読み込む。
 *       決まった値以外が送られてきたら、読み込みに失敗して 400 Bad Request になる</li>
 *   <li>DB：{@link TaskStatusConverter} が文字列と enum を変換する</li>
 * </ul>
 */
public enum TaskStatus {
	/** 未着手 */
	TODO("todo"),
	/** 進行中 */
	IN_PROGRESS("in_progress"),
	/** 完了 */
	DONE("done");

	/** DB と JSON で使う文字列 */
	private final String value;

	TaskStatus(String value) {
		this.value = value;
	}

	/** DB と JSON で使う文字列を返す（例：IN_PROGRESS → "in_progress"） */
	@JsonValue
	public String getValue() {
		return value;
	}

	/**
	 * 文字列から TaskStatus を探す（例："in_progress" → IN_PROGRESS）。
	 *
	 * @param value DB や JSON の文字列
	 * @return 見つかった TaskStatus
	 * @throws IllegalArgumentException 決まった値以外のとき
	 */
	@JsonCreator
	public static TaskStatus fromValue(String value) {
		for (TaskStatus status : values()) {
			if (status.value.equals(value)) {
				return status;
			}
		}
		throw new IllegalArgumentException("status が正しくありません：" + value);
	}
}
