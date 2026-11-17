package io.github.jkuwa.taskmanagement;

// static import：静的メソッドを直接呼び出せるようにする
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// import：クラスを使うために必要な宣言
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * HealthController（/api/health）のテスト。
 *
 * <p>@WebMvcTest を付けると、Web の部分（指定したコントローラー）だけを組み立ててテストする。
 * アプリ全体を起動しないので、速く動く。
 */
@WebMvcTest(HealthController.class)
class HealthControllerTests {

	// MockMvc：実際にサーバーを起動せずに、リクエストを送ったことにして結果を確かめられるテスト用のクラス
	@Autowired // 依存性注入（DI）：クラスのインスタンスを自動で作ってくれる
	private MockMvc mockMvc;  // private MockMvc mockMvc = new MockMvc(...);

	/**
	 * GET /api/health を送ると、成功（200 OK）が返り、JSON の status が "ok" であることを確かめる。
	 */
	@Test  // テストメソッドであることを示すアノテーション
	void healthReturnsOk() throws Exception {  // throws Exception：例外を無視するため
		mockMvc.perform(get("/api/health"))  // リクエストを送る
			.andExpect(status().isOk())  // ステータスコードが 200 OK であることを確かめる
			.andExpect(jsonPath("$.status").value("ok"));  // JSON の status が "ok" であることを確かめる
	}
}
