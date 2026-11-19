package io.github.jkuwa.taskmanagement;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * TaskController（/api/tasks）のテスト。
 *
 * <p>HealthControllerTests と違い、@SpringBootTest でアプリ全体を組み立て、
 * テスト用の PostgreSQL（Testcontainers）に入れたデータが API から返ってくるところまで確かめる。
 * <ul>
 *   <li>@SpringBootTest：アプリ全体を組み立てる（ただし MockMvc は用意しない）</li>
 *   <li>@AutoConfigureMockMvc：@SpringBootTest と一緒に使い、MockMvc を使えるようにする
 *       （HealthControllerTests の @WebMvcTest には最初から含まれているので不要）</li>
 *   <li>@Transactional：テストが終わったら DB への変更を取り消す（ほかのテストに影響しない）</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class) // テスト用の PostgreSQL コンテナを使う
@Transactional
class TaskControllerTests {

	@Autowired
	private MockMvc mockMvc;

	// Task には status や position を変える setter がないので、テストデータは SQL で直接入れる
	// JdbcTemplate：Java から SQL を直接書いて実行するためのクラス
	@Autowired
	private JdbcTemplate jdbcTemplate;

	/**
	 * コンストラクタを省略すると、コンパイラが引数なしのコンストラクタを自動で付け足してくれる。
	 * 
	 * 各テストの前に、tasks テーブルを空にしてからテストデータを入れる。
	 * わざと position の順番をバラバラに入れて、並び順が正しいかを確かめられるようにしている。
	 * （TRUNCATE も @Transactional でテスト後に取り消される）
	 * 
	 * TRUNCATE TABLE tasks：tasksテーブルを空にする
	 * RESTART IDENTITY：id の番号を1から振り直す
	 * これがないと、一度使った id は使えないため、テーブルを空にしてもテスト毎に id が次の番号からになってしまう
	 */
	@BeforeEach  // @Test メソッド毎に毎回呼ばれる
	void setUp() {
		jdbcTemplate.update("TRUNCATE TABLE tasks RESTART IDENTITY");
		jdbcTemplate.update("""
				INSERT INTO tasks (title, description, priority, due_date, status, position) VALUES
					('2番目のカード', NULL, NULL, NULL, 'todo', 1),
					('1番目のカード', '説明文', 'high', '2026-11-20', 'todo', 0),
					('進行中のカード', NULL, 'low', NULL, 'in_progress', 0)
				""");
	}
	// """ """：テキストブロック。改行も含めてそのまま１つの文字列になる。

	/**
	 * GET /api/tasks で、入れたカードがすべて position → id の順で返ることを確かめる。
	 * jsonPath：返ってきたレスポンスの本文の中身を確かめる
	 * $ は JSON 全体、$[0] は配列の1つ目を表す。
	 */
	@Test
	void findAllReturnsTasksInOrder() throws Exception {
		mockMvc.perform(get("/api/tasks"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(3))
			// position 0 のカードが先（同じ 0 どうしは id の小さい順）
			.andExpect(jsonPath("$[0].title").value("1番目のカード"))
			.andExpect(jsonPath("$[1].title").value("進行中のカード"))
			.andExpect(jsonPath("$[2].title").value("2番目のカード"));
	}

	/**
	 * GET /api/tasks/{id} で、そのカードの各項目が返ることを確かめる。
	 * setUp で2番目に入れた「1番目のカード」は id が 2 になる。
	 */
	@Test
	void findByIdReturnsTask() throws Exception {
		mockMvc.perform(get("/api/tasks/2"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(2))
			.andExpect(jsonPath("$.title").value("1番目のカード"))
			.andExpect(jsonPath("$.description").value("説明文"))
			.andExpect(jsonPath("$.priority").value("high"))
			.andExpect(jsonPath("$.dueDate").value("2026-11-20"))
			.andExpect(jsonPath("$.status").value("todo"))
			.andExpect(jsonPath("$.position").value(0))
			.andExpect(jsonPath("$.createdAt").isNotEmpty())
			.andExpect(jsonPath("$.updatedAt").isNotEmpty());
	}

	/**
	 * 存在しない id を指定すると、404 Not Found が返ることを確かめる。
	 */
	@Test
	void findByIdReturns404WhenNotFound() throws Exception {
		mockMvc.perform(get("/api/tasks/9999"))
			.andExpect(status().isNotFound());
	}
}
