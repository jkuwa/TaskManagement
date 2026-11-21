package io.github.jkuwa.taskmanagement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
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

	// ---- POST /api/tasks（カードの追加）----

	/**
	 * POST /api/tasks に JSON を送る。
	 * contentType：送るデータが JSON であることを伝える
	 * content：リクエストの本文
	 */
	private ResultActions postTask(String json) throws Exception {
		return mockMvc.perform(post("/api/tasks")
				.contentType(MediaType.APPLICATION_JSON)
				.content(json));
	}

	/** tasks テーブルの件数を数える（作られていないことを確かめるときに使う） */
	private int countTasks() {
		return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM tasks", Integer.class);
	}

	/**
	 * カードのある列に追加すると、201 Created が返り、列の一番下（position が最大＋1）に入ることを確かめる。
	 * setUp で todo 列には position 0 と 1 のカードがあるので、新しいカードは 2 になる。
	 */
	@Test
	void createAddsTaskToBottomOfColumn() throws Exception {
		postTask("""
				{"title":"新しいカード","status":"todo"}
				""")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").value(4))
			.andExpect(jsonPath("$.title").value("新しいカード"))
			.andExpect(jsonPath("$.description").isEmpty())
			.andExpect(jsonPath("$.priority").isEmpty())
			.andExpect(jsonPath("$.dueDate").isEmpty())
			.andExpect(jsonPath("$.status").value("todo"))
			.andExpect(jsonPath("$.position").value(2))
			.andExpect(jsonPath("$.createdAt").isNotEmpty())
			.andExpect(jsonPath("$.updatedAt").isNotEmpty());

		// DB にも保存されていて、一覧の最後に出てくる
		mockMvc.perform(get("/api/tasks"))
			.andExpect(jsonPath("$.length()").value(4))
			.andExpect(jsonPath("$[3].title").value("新しいカード"));
	}

	/** カードのない列（done）に追加すると、position が 0 になることを確かめる */
	@Test
	void createAddsTaskToEmptyColumn() throws Exception {
		postTask("""
				{"title":"完了したカード","status":"done"}
				""")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.status").value("done"))
			.andExpect(jsonPath("$.position").value(0));
	}

	/** タイトルの前後の空白は取り除いて保存することを確かめる */
	@Test
	void createTrimsTitle() throws Exception {
		postTask("""
				{"title":"  前後に空白  ","status":"todo"}
				""")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.title").value("前後に空白"));
	}

	/** ちょうど100文字のタイトルは作れることを確かめる */
	@Test
	void createAccepts100CharacterTitle() throws Exception {
		String title = "あ".repeat(100);
		postTask("{\"title\":\"" + title + "\",\"status\":\"todo\"}")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.title").value(title));
	}

	/**
	 * 正しくない入力のときは 400 Bad Request が返り、カードが作られないことを確かめる。
	 *
	 * <p>@ParameterizedTest：同じテストを、@ValueSource に並べた値で1回ずつ実行する。
	 * 入力だけが違うテストをまとめて書ける。
	 */
	@ParameterizedTest
	@ValueSource(strings = {
		"{\"title\":\"\",\"status\":\"todo\"}",          // 空のタイトル
		"{\"title\":\"   \",\"status\":\"todo\"}",       // 空白だけのタイトル
		"{\"status\":\"todo\"}",                         // タイトルがない
		"{\"title\":\"カード\",\"status\":\"unknown\"}",  // ない列
		"{\"title\":\"カード\"}",                         // 列がない
	})
	void createReturns400WhenInvalid(String json) throws Exception {
		postTask(json).andExpect(status().isBadRequest());
		assertThat(countTasks()).isEqualTo(3);
	}

	/** 101文字のタイトルは 400 Bad Request になり、カードが作られないことを確かめる */
	@Test
	void createReturns400WhenTitleTooLong() throws Exception {
		postTask("{\"title\":\"" + "あ".repeat(101) + "\",\"status\":\"todo\"}")
			.andExpect(status().isBadRequest());
		assertThat(countTasks()).isEqualTo(3);
	}
}
