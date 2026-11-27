package io.github.jkuwa.taskmanagement;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * TaskStatus と、DB の status 列の文字列（"todo" など）を変換する。
 *
 * <p>JPA の標準の {@code @Enumerated(EnumType.STRING)} だと、enum の名前（"IN_PROGRESS"）がそのまま保存される。
 * これまでの DB の値（"in_progress"）を変えないように、自分で変換する。
 *
 * <p>{@code autoApply = true}：TaskStatus 型のフィールドすべてに、自動でこの変換を使う
 */
@Converter(autoApply = true)
public class TaskStatusConverter implements AttributeConverter<TaskStatus, String> {

	/** Java → DB（TaskStatus.IN_PROGRESS → "in_progress"） */
	@Override
	public String convertToDatabaseColumn(TaskStatus status) {
		return status == null ? null : status.getValue();
	}

	/** DB → Java（"in_progress" → TaskStatus.IN_PROGRESS） */
	@Override
	public TaskStatus convertToEntityAttribute(String value) {
		return value == null ? null : TaskStatus.fromValue(value);
	}
}
