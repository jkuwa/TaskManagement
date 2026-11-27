package io.github.jkuwa.taskmanagement;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * API で起きたエラーを、まとめてレスポンスに変換するクラス。
 *
 * <p>{@code @RestControllerAdvice} を付けると、すべての Controller で投げられた例外がここに集まる。
 * Controller や Service にエラーの返し方を書かずに済み、どの API でも同じ形でエラーを返せる。
 *
 * <p>エラーの本文は ProblemDetail（RFC 9457 で決められた、エラーを表す JSON の形）で返す。
 * Content-Type は application/problem+json になる。
 * 例：{"type":"about:blank","title":"Bad Request","status":400,"detail":"タイトルを入力してください",
 *      "instance":"/api/tasks","errors":{"title":"タイトルを入力してください"}}
 *
 * <p>ResponseEntityExceptionHandler（Spring が用意しているクラス）を継承すると、
 * Spring MVC の標準の例外（入力チェックの失敗、JSON が読めないなど）も ProblemDetail で返すようになる。
 * その中で、メッセージを分かりやすくしたいものだけを上書き（@Override）している。
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

	/**
	 * カードが見つからなかったとき（TaskNotFoundException）は 404 Not Found を返す。
	 *
	 * <p>{@code @ExceptionHandler(例外クラス)}：その例外が投げられたときに、このメソッドが呼ばれる。
	 * ProblemDetail を返すと、Spring が ProblemDetail の status をレスポンスのステータスにしてくれる。
	 *
	 * @param ex 投げられた例外
	 * @return エラーの内容
	 */
	@ExceptionHandler(TaskNotFoundException.class)
	public ProblemDetail handleTaskNotFound(TaskNotFoundException ex) {
		return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
	}

	/**
	 * 移動先の位置が正しくなかったとき（InvalidTaskPositionException）は 400 Bad Request を返す。
	 *
	 * @param ex 投げられた例外
	 * @return エラーの内容
	 */
	@ExceptionHandler(InvalidTaskPositionException.class)
	public ProblemDetail handleInvalidTaskPosition(InvalidTaskPositionException ex) {
		return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
	}

	/**
	 * 入力のチェック（Bean Validation）に引っかかったときに呼ばれる。400 Bad Request を返す。
	 *
	 * <p>Spring の標準では detail が "Invalid request content." だけで、どの項目が悪いのか分からない。
	 * そこで、チェックに引っかかった項目のメッセージを detail にまとめ、項目ごとのメッセージを errors に入れる。
	 *
	 * @return エラーの内容
	 */
	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(
			MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		// 項目名 → メッセージ。LinkedHashMap は入れた順番を保つ Map
		Map<String, String> errors = new LinkedHashMap<>();
		for (FieldError error : ex.getBindingResult().getFieldErrors()) {
			// 同じ項目に複数のエラーがあるときは、最初の1つだけにする
			errors.putIfAbsent(error.getField(), error.getDefaultMessage());
		}

		ProblemDetail body = ex.getBody();
		body.setDetail(String.join("／", errors.values()));
		body.setProperty("errors", errors); // ProblemDetail に独自の項目を足せる
		return handleExceptionInternal(ex, body, headers, status, request);
	}

	/**
	 * リクエストの JSON が読めなかったときに呼ばれる。400 Bad Request を返す。
	 * 例：JSON の書き方が間違っている、日付として読めない期限、決まった値以外の status / priority
	 *
	 * @return エラーの内容
	 */
	@Override
	protected ResponseEntity<Object> handleHttpMessageNotReadable(
			HttpMessageNotReadableException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		ProblemDetail body = ProblemDetail.forStatusAndDetail(status,
				"リクエストの内容を読み取れませんでした（日付の形式や、status・priority の値を確認してください）");
		return handleExceptionInternal(ex, body, headers, status, request);
	}
}
