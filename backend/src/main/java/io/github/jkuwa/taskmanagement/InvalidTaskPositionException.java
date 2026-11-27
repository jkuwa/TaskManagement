package io.github.jkuwa.taskmanagement;

/**
 * カードを移動するとき、移動先の位置（index）が列の枚数より大きかったときに投げる例外。
 * ApiExceptionHandler が 400 Bad Request のレスポンスにする。
 *
 * <p>index が負・null かどうかは Bean Validation（MoveTaskRequest）でチェックできるが、
 * 「列の枚数より大きいか」は DB の列のカードを数えないと分からないので、TaskService でチェックしてこの例外を投げる。
 */
public class InvalidTaskPositionException extends RuntimeException {

	/**
	 * @param index 指定された位置
	 * @param max   指定できる位置の最大値（移動先の列の枚数）
	 */
	public InvalidTaskPositionException(int index, int max) {
		super("index は0〜" + max + "で指定してください（指定された値：" + index + "）");
	}
}
