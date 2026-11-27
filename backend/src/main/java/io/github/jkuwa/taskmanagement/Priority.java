package io.github.jkuwa.taskmanagement;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * カードの優先度。未設定のときは enum ではなく null で表す。
 *
 * <p>しくみは {@link TaskStatus} と同じ。DB と JSON では "high" / "medium" / "low" の文字列で表し、
 * DB との変換は {@link PriorityConverter} が行う。
 */
public enum Priority {
	/** 高 */
	HIGH("high"),
	/** 中 */
	MEDIUM("medium"),
	/** 低 */
	LOW("low");

	/** DB と JSON で使う文字列 */
	private final String value;

	Priority(String value) {
		this.value = value;
	}

	/** DB と JSON で使う文字列を返す（例：HIGH → "high"） */
	@JsonValue
	public String getValue() {
		return value;
	}

	/**
	 * 文字列から Priority を探す（例："high" → HIGH）。
	 *
	 * @param value DB や JSON の文字列
	 * @return 見つかった Priority
	 * @throws IllegalArgumentException 決まった値以外のとき
	 */
	@JsonCreator
	public static Priority fromValue(String value) {
		for (Priority priority : values()) {
			if (priority.value.equals(value)) {
				return priority;
			}
		}
		throw new IllegalArgumentException("priority が正しくありません：" + value);
	}
}
