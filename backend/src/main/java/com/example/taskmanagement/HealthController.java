package com.example.taskmanagement;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * アプリが動いているかを確認するための API。
 *
 * <p>ブラウザで http://localhost:8080/api/health を開くと {"status":"ok"} が返る。
 * 返ってくれば、アプリが起動してリクエストを受け付けられる状態だと分かる。
 *
 * <p>@RestController を付けると、このクラスが「リクエストを受け取って、データ（JSON）を返すクラス」になる。
 */
@RestController
@RequestMapping("/api") // このクラスの URL はすべて /api から始まる
public class HealthController {

	/**
	 * GET /api/health にアクセスされたときに呼ばれる。
	 *
	 * @return {"status":"ok"}。戻り値の Map は Spring Boot が自動で JSON に変換する
	 */
	@GetMapping("/health")
	public Map<String, String> health() {
		return Map.of("status", "ok");
	}
}
