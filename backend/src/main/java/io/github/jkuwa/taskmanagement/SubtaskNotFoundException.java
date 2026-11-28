package io.github.jkuwa.taskmanagement;

/**
 * 指定したサブタスクが見つからなかったときに投げる例外。
 * 404 Not Found のレスポンスにするのは ApiExceptionHandler の役目（TaskNotFoundException と同じ）。
 *
 * <p>サブタスクはあっても、URL で指定したカードのものでないときも、見つからない扱いにする。
 */
public class SubtaskNotFoundException extends RuntimeException {

	/**
	 * @param id 見つからなかったサブタスクの id
	 */
	public SubtaskNotFoundException(Integer id) {
		super("サブタスクが見つかりません（id：" + id + "）");
	}
}
