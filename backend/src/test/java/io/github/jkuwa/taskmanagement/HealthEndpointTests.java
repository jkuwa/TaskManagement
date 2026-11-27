package io.github.jkuwa.taskmanagement;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * アプリが動いているかを確認する API（/actuator/health）のテスト。
 *
 * <p>/actuator/health は Spring Boot Actuator が用意している API。自分でコントローラーを書かなくても使える。
 * DB につながっているかも確かめてくれるので、DB が止まっていると status が "DOWN" になる。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class) // DB の状態も確かめるので、テスト用の PostgreSQL コンテナを使う
class HealthEndpointTests {

	@Autowired
	private MockMvc mockMvc;

	/** GET /actuator/health を送ると、200 OK と {"status":"UP"} が返ることを確かめる */
	@Test
	void healthReturnsUp() throws Exception {
		mockMvc.perform(get("/actuator/health"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("UP"));
	}
}
