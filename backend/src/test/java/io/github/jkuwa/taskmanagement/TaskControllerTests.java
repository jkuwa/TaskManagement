package io.github.jkuwa.taskmanagement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.persistence.EntityManager;

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

	// EntityManager：JPA でエンティティを読み書きする本体。リポジトリも内部でこれを使っている
	@Autowired
	private EntityManager entityManager;

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

	/**
	 * tasks テーブルの件数を数える（作られていないことを確かめるときに使う）
	 *
	 * <p>queryForObject は結果がないと null を返すことがあるので、int ではなく Integer のまま返す。
	 * int にすると null のときに NullPointerException になり、テストの失敗理由が分かりにくくなる。
	 */
	private Integer countTasks() {
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

	// ---- PUT /api/tasks/{id}（カードの更新）----

	/**
	 * まだ DB に送っていない変更を送り（flush）、JPA が覚えているエンティティを捨てる（clear）。
	 *
	 * <p>このテストクラスは @Transactional なので、PUT と GET が1つのトランザクションの中で動く。
	 * JPA はトランザクションの中で読み込んだエンティティを覚えていて（キャッシュ）、
	 * 同じ id を findById すると DB を見ずにそれを返す。
	 * そのままだと、UPDATE 文が実行されていなくても GET で書き換えた値が返ってしまうので、
	 * GET の前にこれを呼んで、DB から読み直させる。
	 */
	private void flushAndClear() {
		entityManager.flush();
		entityManager.clear();
	}

	/** PUT /api/tasks/{id} に JSON を送る */
	private ResultActions putTask(int id, String json) throws Exception {
		return mockMvc.perform(put("/api/tasks/" + id)
				.contentType(MediaType.APPLICATION_JSON)
				.content(json));
	}

	/**
	 * 何も設定していないカード（id 1）に、説明文・期限・優先度を設定できることを確かめる。
	 * 列（status）と並び順（position）は変わらない。
	 */
	@Test
	void updateSetsFields() throws Exception {
		putTask(1, """
				{"title":"  変更後のタイトル  ","description":"説明を追加","dueDate":"2027-01-05","priority":"medium"}
				""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(1))
			.andExpect(jsonPath("$.title").value("変更後のタイトル"))
			.andExpect(jsonPath("$.description").value("説明を追加"))
			.andExpect(jsonPath("$.dueDate").value("2027-01-05"))
			.andExpect(jsonPath("$.priority").value("medium"))
			.andExpect(jsonPath("$.status").value("todo"))
			.andExpect(jsonPath("$.position").value(1));

		// DB にも保存されている（DB から読み直して GET で確かめる）
		flushAndClear();
		mockMvc.perform(get("/api/tasks/1"))
			.andExpect(jsonPath("$.title").value("変更後のタイトル"))
			.andExpect(jsonPath("$.description").value("説明を追加"))
			.andExpect(jsonPath("$.dueDate").value("2027-01-05"))
			.andExpect(jsonPath("$.priority").value("medium"));
	}

	/** 設定済みのカード（id 2）に null を送ると、説明文・期限・優先度を解除できることを確かめる */
	@Test
	void updateClearsFields() throws Exception {
		putTask(2, """
				{"title":"1番目のカード","description":null,"dueDate":null,"priority":null}
				""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.description").isEmpty())
			.andExpect(jsonPath("$.dueDate").isEmpty())
			.andExpect(jsonPath("$.priority").isEmpty());

		// DB にも保存されている（DB から読み直して GET で確かめる）
		flushAndClear();
		mockMvc.perform(get("/api/tasks/2"))
			.andExpect(jsonPath("$.description").isEmpty())
			.andExpect(jsonPath("$.dueDate").isEmpty())
			.andExpect(jsonPath("$.priority").isEmpty());
	}

	/** 空白だけの説明文は、未設定（null）として保存されることを確かめる */
	@Test
	void updateSavesBlankDescriptionAsNull() throws Exception {
		putTask(2, """
				{"title":"1番目のカード","description":"   ","dueDate":null,"priority":null}
				""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.description").isEmpty());
	}

	/** 正しくない入力のときは 400 Bad Request が返り、カードが変わらないことを確かめる */
	@ParameterizedTest
	@ValueSource(strings = {
		"{\"title\":\"\"}",                                // 空のタイトル
		"{\"title\":\"   \"}",                             // 空白だけのタイトル
		"{\"description\":\"説明\"}",                       // タイトルがない
		"{\"title\":\"カード\",\"priority\":\"urgent\"}",  // ない優先度
		"{\"title\":\"カード\",\"dueDate\":\"11/20\"}",    // 日付として読めない期限
	})
	void updateReturns400WhenInvalid(String json) throws Exception {
		putTask(2, json).andExpect(status().isBadRequest());

		mockMvc.perform(get("/api/tasks/2"))
			.andExpect(jsonPath("$.title").value("1番目のカード"))
			.andExpect(jsonPath("$.priority").value("high"))
			.andExpect(jsonPath("$.dueDate").value("2026-11-20"));
	}

	/** 101文字のタイトルは 400 Bad Request になることを確かめる */
	@Test
	void updateReturns400WhenTitleTooLong() throws Exception {
		putTask(2, "{\"title\":\"" + "あ".repeat(101) + "\"}")
			.andExpect(status().isBadRequest());
	}

	/** 存在しない id を指定すると、404 Not Found が返ることを確かめる */
	@Test
	void updateReturns404WhenNotFound() throws Exception {
		putTask(9999, """
				{"title":"カード"}
				""")
			.andExpect(status().isNotFound());
	}

	// ---- PUT /api/tasks/{id}/position（カードの移動）----
	// setUp のデータ：未着手 = [id 2（position 0）, id 1（position 1）]、進行中 = [id 3（position 0）]

	/** PUT /api/tasks/{id}/position に JSON を送る */
	private ResultActions moveTask(int id, String json) throws Exception {
		return mockMvc.perform(put("/api/tasks/" + id + "/position")
				.contentType(MediaType.APPLICATION_JSON)
				.content(json));
	}

	/**
	 * 未着手の一番下のカード（id 1）を、同じ列の一番上へ移動できることを確かめる（F-20）。
	 * すべてのカードが新しい並び順で返り、position が 0 から振り直される。
	 *
	 * <p>一覧は列をまたいで position → id の順に並ぶので、移動後は
	 * id 1（未着手 0）→ id 3（進行中 0）→ id 2（未着手 1）の順になる。
	 */
	@Test
	void moveReordersWithinColumn() throws Exception {
		moveTask(1, """
				{"status":"todo","index":0}
				""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(3))
			.andExpect(jsonPath("$[0].id").value(1))
			.andExpect(jsonPath("$[0].position").value(0))
			.andExpect(jsonPath("$[1].id").value(3))
			.andExpect(jsonPath("$[2].id").value(2))
			.andExpect(jsonPath("$[2].position").value(1));

		// DB にも保存されている（DB から読み直して GET で確かめる）
		flushAndClear();
		mockMvc.perform(get("/api/tasks/1"))
			.andExpect(jsonPath("$.status").value("todo"))
			.andExpect(jsonPath("$.position").value(0));
		mockMvc.perform(get("/api/tasks/2"))
			.andExpect(jsonPath("$.position").value(1));
	}

	/**
	 * 未着手のカード（id 2）を、進行中の2枚の間へ移動できることを確かめる（F-19）。
	 * 移動先では落とした位置に入り、移動元の列は穴が詰められる。
	 */
	@Test
	void moveToAnotherColumn() throws Exception {
		// 進行中を2枚にする（id 4）
		jdbcTemplate.update("INSERT INTO tasks (title, status, position) VALUES ('進行中の2枚目', 'in_progress', 1)");

		moveTask(2, """
				{"status":"in_progress","index":1}
				""")
			.andExpect(status().isOk());

		flushAndClear();
		// 移動先：id 3 → id 2 → id 4 の順
		mockMvc.perform(get("/api/tasks/3")).andExpect(jsonPath("$.position").value(0));
		mockMvc.perform(get("/api/tasks/2"))
			.andExpect(jsonPath("$.status").value("in_progress"))
			.andExpect(jsonPath("$.position").value(1));
		mockMvc.perform(get("/api/tasks/4")).andExpect(jsonPath("$.position").value(2));
		// 移動元：残った id 1 が一番上に詰められる
		mockMvc.perform(get("/api/tasks/1"))
			.andExpect(jsonPath("$.status").value("todo"))
			.andExpect(jsonPath("$.position").value(0));
	}

	/** カードのない列（done）へ移動できることを確かめる */
	@Test
	void moveToEmptyColumn() throws Exception {
		moveTask(3, """
				{"status":"done","index":0}
				""")
			.andExpect(status().isOk());

		flushAndClear();
		mockMvc.perform(get("/api/tasks/3"))
			.andExpect(jsonPath("$.status").value("done"))
			.andExpect(jsonPath("$.position").value(0));
	}

	/**
	 * 正しくない入力のときは 400 Bad Request が返り、カードが動かないことを確かめる。
	 * 未着手は id 1 を除くと1枚なので、index に使えるのは 0〜1。
	 */
	@ParameterizedTest
	@ValueSource(strings = {
		"{\"status\":\"todo\",\"index\":-1}",     // 負の index
		"{\"status\":\"todo\",\"index\":2}",      // 列の枚数より大きい index
		"{\"status\":\"todo\"}",                  // index がない
		"{\"status\":\"unknown\",\"index\":0}",   // ない列
		"{\"index\":0}",                          // 列がない
	})
	void moveReturns400WhenInvalid(String json) throws Exception {
		moveTask(1, json).andExpect(status().isBadRequest());

		flushAndClear();
		mockMvc.perform(get("/api/tasks/1"))
			.andExpect(jsonPath("$.status").value("todo"))
			.andExpect(jsonPath("$.position").value(1));
	}

	/** 存在しない id を指定すると、404 Not Found が返ることを確かめる */
	@Test
	void moveReturns404WhenNotFound() throws Exception {
		moveTask(9999, """
				{"status":"todo","index":0}
				""")
			.andExpect(status().isNotFound());
	}

	// ---- DELETE /api/tasks/{id}（カードの削除）----
	// setUp のデータ：未着手 = [id 2（position 0）, id 1（position 1）]、進行中 = [id 3（position 0）]

	/**
	 * 未着手の一番上のカード（id 2）を削除すると、204 No Content が返り、DB から消えることを確かめる（F-18）。
	 * 同じ列の残りのカード（id 1）は一番上に詰められ、ほかの列のカードは変わらない。
	 */
	@Test
	void deleteRemovesTaskAndRenumbersColumn() throws Exception {
		mockMvc.perform(delete("/api/tasks/2"))
			.andExpect(status().isNoContent());

		flushAndClear();
		assertThat(countTasks()).isEqualTo(2);
		mockMvc.perform(get("/api/tasks/2"))
			.andExpect(status().isNotFound());
		mockMvc.perform(get("/api/tasks/1"))
			.andExpect(jsonPath("$.status").value("todo"))
			.andExpect(jsonPath("$.position").value(0));
		mockMvc.perform(get("/api/tasks/3"))
			.andExpect(jsonPath("$.status").value("in_progress"))
			.andExpect(jsonPath("$.position").value(0));
	}

	/** 存在しない id を指定すると、404 Not Found が返り、カードが消えないことを確かめる */
	@Test
	void deleteReturns404WhenNotFound() throws Exception {
		mockMvc.perform(delete("/api/tasks/9999"))
			.andExpect(status().isNotFound());
		assertThat(countTasks()).isEqualTo(3);
	}
}
