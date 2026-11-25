package io.github.jkuwa.taskmanagement;

/**
 * 指定した id のカードが見つからなかったときに投げる例外。
 *
 * <p>Service は「カードが見つからない」という事実だけを伝え、
 * それを 404 Not Found のレスポンスにするのは ApiExceptionHandler の役目にする
 * （Service が HTTP のことを知らなくて済むように、役割を分けている）。
 *
 * <p>RuntimeException を継承すると、メソッドに throws を書かなくても投げられる（非検査例外）。
 */
public class TaskNotFoundException extends RuntimeException {

	/**
	 * @param id 見つからなかったカードの id
	 */
	public TaskNotFoundException(Integer id) {
		super("カードが見つかりません（id：" + id + "）");
	}
}
