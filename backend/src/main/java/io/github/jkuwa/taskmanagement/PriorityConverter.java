package io.github.jkuwa.taskmanagement;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Priority と、DB の priority 列の文字列（"high" など）を変換する。
 * しくみは {@link TaskStatusConverter} と同じ。未設定（null）は null のまま保存する。
 */
@Converter(autoApply = true)
public class PriorityConverter implements AttributeConverter<Priority, String> {

	/** Java → DB（Priority.HIGH → "high"） */
	@Override
	public String convertToDatabaseColumn(Priority priority) {
		return priority == null ? null : priority.getValue();
	}

	/** DB → Java（"high" → Priority.HIGH） */
	@Override
	public Priority convertToEntityAttribute(String value) {
		return value == null ? null : Priority.fromValue(value);
	}
}
