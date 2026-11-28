package io.github.jkuwa.taskmanagement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
 * SubtaskController（/api/tasks/{taskId}/subtasks）のテスト。
 * 書き方は TaskControllerTests と同じ（テスト用の PostgreSQL に入れたデータを API で読み書きする）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class SubtaskControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private EntityManager entityManager;

	/**
	 * 各テストの前に、カード2枚（id 1・2）とサブタスク1つ（カード 1 の id 1）を入れる。
	 * カード 2 にはサブタスクがない。
	 */
	@BeforeEach
	void setUp() {
		jdbcTemplate.update("TRUNCATE TABLE subtasks, tasks RESTART IDENTITY");
		jdbcTemplate.update("""
				INSERT INTO tasks (title, status, position) VALUES
					('サブタスクのあるカード', 'todo', 0),
					('サブタスクのないカード', 'todo', 1)
				""");
		jdbcTemplate.update("INSERT INTO subtasks (task_id, title, done) VALUES (1, '最初のサブタスク', TRUE)");
	}

	/** POST /api/tasks/{taskId}/subtasks に JSON を送る */
	private ResultActions postSubtask(int taskId, String json) throws Exception {
		return mockMvc.perform(post("/api/tasks/" + taskId + "/subtasks")
				.contentType(MediaType.APPLICATION_JSON)
				.content(json));
	}

	/** PUT /api/tasks/{taskId}/subtasks/{id} に JSON を送る */
	private ResultActions putSubtask(int taskId, int id, String json) throws Exception {
		return mockMvc.perform(put("/api/tasks/" + taskId + "/subtasks/" + id)
				.contentType(MediaType.APPLICATION_JSON)
				.content(json));
	}

	/** サブタスク（id 1）の内容を DB から読む（更新されていないことを確かめるときに使う） */
	private String subtaskTitle() {
		return jdbcTemplate.queryForObject("SELECT title FROM subtasks WHERE id = 1", String.class);
	}

	/** subtasks テーブルの件数を数える（作られていないことを確かめるときに使う） */
	private Integer countSubtasks() {
		return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM subtasks", Integer.class);
	}

	/**
	 * サブタスクを追加すると 201 Created が返り、未完了のサブタスクが作られることを確かめる（F-21）。
	 * カードを読み直すと、サブタスクが一覧の一番下（追加した順）に入っている。
	 */
	@Test
	void createAddsSubtaskToBottom() throws Exception {
		postSubtask(1, """
				{"title":"2つ目のサブタスク"}
				""")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").value(2))
			.andExpect(jsonPath("$.title").value("2つ目のサブタスク"))
			.andExpect(jsonPath("$.done").value(false));

		// DB にも保存されている（DB から読み直して GET で確かめる）
		entityManager.flush();
		entityManager.clear();
		mockMvc.perform(get("/api/tasks/1"))
			.andExpect(jsonPath("$.subtasks.length()").value(2))
			.andExpect(jsonPath("$.subtasks[0].title").value("最初のサブタスク"))
			.andExpect(jsonPath("$.subtasks[1].title").value("2つ目のサブタスク"))
			.andExpect(jsonPath("$.subtasks[1].done").value(false));
	}

	/** サブタスクのないカードにも追加できることを確かめる */
	@Test
	void createAddsSubtaskToTaskWithoutSubtasks() throws Exception {
		postSubtask(2, """
				{"title":"はじめてのサブタスク"}
				""")
			.andExpect(status().isCreated());

		entityManager.flush();
		entityManager.clear();
		mockMvc.perform(get("/api/tasks/2"))
			.andExpect(jsonPath("$.subtasks.length()").value(1))
			.andExpect(jsonPath("$.subtasks[0].title").value("はじめてのサブタスク"));
	}

	/** 内容の前後の空白は取り除いて保存することを確かめる */
	@Test
	void createTrimsTitle() throws Exception {
		postSubtask(1, """
				{"title":"  前後に空白  "}
				""")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.title").value("前後に空白"));
	}

	/** ちょうど100文字の内容は追加できることを確かめる */
	@Test
	void createAccepts100CharacterTitle() throws Exception {
		String title = "あ".repeat(100);
		postSubtask(1, "{\"title\":\"" + title + "\"}")
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.title").value(title));
	}

	/**
	 * 絵文字は1つで2文字と数える（カードのタイトルと同じ。フロントエンドの maxLength と同じ数え方）。
	 * 50個（100文字）は追加できて、51個（102文字）は 400 Bad Request になることを確かめる。
	 */
	@Test
	void createCountsEmojiAsTwoCharacters() throws Exception {
		postSubtask(1, "{\"title\":\"" + "😀".repeat(50) + "\"}")
			.andExpect(status().isCreated());
		postSubtask(1, "{\"title\":\"" + "😀".repeat(51) + "\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("サブタスクの内容は100文字までです"));
		assertThat(countSubtasks()).isEqualTo(2);
	}

	/** 正しくない入力のときは 400 Bad Request が返り、サブタスクが作られないことを確かめる */
	@ParameterizedTest
	@ValueSource(strings = {
		"{\"title\":\"\"}",     // 空の内容
		"{\"title\":\"   \"}",  // 空白だけの内容
		"{\"title\":\"　\"}",   // 全角の空白だけの内容
		"{}",                   // 内容がない
	})
	void createReturns400WhenInvalid(String json) throws Exception {
		postSubtask(1, json)
			.andExpect(status().isBadRequest())
			.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.errors.title").value("サブタスクの内容を入力してください"));
		assertThat(countSubtasks()).isEqualTo(1);
	}

	/** 101文字の内容は 400 Bad Request になり、サブタスクが作られないことを確かめる */
	@Test
	void createReturns400WhenTitleTooLong() throws Exception {
		postSubtask(1, "{\"title\":\"" + "あ".repeat(101) + "\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("サブタスクの内容は100文字までです"));
		assertThat(countSubtasks()).isEqualTo(1);
	}

	/** 存在しないカードを指定すると 404 Not Found が返り、サブタスクが作られないことを確かめる */
	@Test
	void createReturns404WhenTaskNotFound() throws Exception {
		postSubtask(9999, """
				{"title":"サブタスク"}
				""")
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("カードが見つかりません（id：9999）"));
		assertThat(countSubtasks()).isEqualTo(1);
	}

	/**
	 * サブタスクの内容と完了したかを更新すると 200 OK が返り、DB にも保存されることを確かめる（F-22, F-26）。
	 * 内容の前後の空白は取り除く。
	 */
	@Test
	void updateChangesTitleAndDone() throws Exception {
		putSubtask(1, 1, """
				{"title":"  書き換えた内容  ","done":false}
				""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(1))
			.andExpect(jsonPath("$.title").value("書き換えた内容"))
			.andExpect(jsonPath("$.done").value(false));

		entityManager.flush();
		entityManager.clear();
		mockMvc.perform(get("/api/tasks/1"))
			.andExpect(jsonPath("$.subtasks.length()").value(1))
			.andExpect(jsonPath("$.subtasks[0].title").value("書き換えた内容"))
			.andExpect(jsonPath("$.subtasks[0].done").value(false));
	}

	/** 未完了のサブタスクを完了にできることを確かめる（F-22） */
	@Test
	void updateMarksSubtaskDone() throws Exception {
		jdbcTemplate.update("UPDATE subtasks SET done = FALSE WHERE id = 1");

		putSubtask(1, 1, """
				{"title":"最初のサブタスク","done":true}
				""")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.done").value(true));
	}

	/** 正しくない入力のときは 400 Bad Request が返り、サブタスクが変わらないことを確かめる */
	@ParameterizedTest
	@ValueSource(strings = {
		"{\"title\":\"\",\"done\":false}",     // 空の内容
		"{\"title\":\"   \",\"done\":false}",  // 空白だけの内容
		"{\"done\":false}",                   // 内容がない
	})
	void updateReturns400WhenTitleInvalid(String json) throws Exception {
		putSubtask(1, 1, json)
			.andExpect(status().isBadRequest())
			.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.errors.title").value("サブタスクの内容を入力してください"));
		assertThat(subtaskTitle()).isEqualTo("最初のサブタスク");
	}

	/** done がないときは 400 Bad Request になることを確かめる */
	@Test
	void updateReturns400WhenDoneMissing() throws Exception {
		putSubtask(1, 1, """
				{"title":"書き換えた内容"}
				""")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.done").value("完了したかを指定してください"));
		assertThat(subtaskTitle()).isEqualTo("最初のサブタスク");
	}

	/** 書き換えでも、絵文字は1つで2文字と数えることを確かめる（50個は更新でき、51個は 400 Bad Request） */
	@Test
	void updateCountsEmojiAsTwoCharacters() throws Exception {
		putSubtask(1, 1, "{\"title\":\"" + "😀".repeat(51) + "\",\"done\":true}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("サブタスクの内容は100文字までです"));
		assertThat(subtaskTitle()).isEqualTo("最初のサブタスク");

		String title = "😀".repeat(50);
		putSubtask(1, 1, "{\"title\":\"" + title + "\",\"done\":true}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.title").value(title));
	}

	/** 101文字の内容は 400 Bad Request になることを確かめる */
	@Test
	void updateReturns400WhenTitleTooLong() throws Exception {
		putSubtask(1, 1, "{\"title\":\"" + "あ".repeat(101) + "\",\"done\":true}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.detail").value("サブタスクの内容は100文字までです"));
		assertThat(subtaskTitle()).isEqualTo("最初のサブタスク");
	}

	/** 存在しないカードを指定すると 404 Not Found が返ることを確かめる */
	@Test
	void updateReturns404WhenTaskNotFound() throws Exception {
		putSubtask(9999, 1, """
				{"title":"書き換えた内容","done":true}
				""")
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("カードが見つかりません（id：9999）"));
	}

	/** 存在しないサブタスクを指定すると 404 Not Found が返ることを確かめる */
	@Test
	void updateReturns404WhenSubtaskNotFound() throws Exception {
		putSubtask(1, 9999, """
				{"title":"書き換えた内容","done":true}
				""")
			.andExpect(status().isNotFound())
			.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("サブタスクが見つかりません（id：9999）"));
	}

	/** 別のカードのサブタスクを指定すると 404 Not Found が返り、サブタスクが変わらないことを確かめる */
	@Test
	void updateReturns404WhenSubtaskBelongsToAnotherTask() throws Exception {
		putSubtask(2, 1, """
				{"title":"書き換えた内容","done":false}
				""")
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("サブタスクが見つかりません（id：1）"));
		assertThat(subtaskTitle()).isEqualTo("最初のサブタスク");
	}

	/** DELETE /api/tasks/{taskId}/subtasks/{id} を送る */
	private ResultActions deleteSubtask(int taskId, int id) throws Exception {
		return mockMvc.perform(delete("/api/tasks/" + taskId + "/subtasks/" + id));
	}

	/**
	 * サブタスクを削除すると 204 No Content が返り、DB から消えることを確かめる（F-23）。
	 * 同じカードのほかのサブタスクは残る。
	 */
	@Test
	void deleteRemovesSubtask() throws Exception {
		jdbcTemplate.update("INSERT INTO subtasks (task_id, title) VALUES (1, '残るサブタスク')");

		deleteSubtask(1, 1)
			.andExpect(status().isNoContent())
			.andExpect(content().string(""));

		entityManager.flush();
		entityManager.clear();
		mockMvc.perform(get("/api/tasks/1"))
			.andExpect(jsonPath("$.subtasks.length()").value(1))
			.andExpect(jsonPath("$.subtasks[0].title").value("残るサブタスク"));
	}

	/** 存在しないカードを指定すると 404 Not Found が返り、サブタスクが消えないことを確かめる */
	@Test
	void deleteReturns404WhenTaskNotFound() throws Exception {
		deleteSubtask(9999, 1)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("カードが見つかりません（id：9999）"));
		assertThat(countSubtasks()).isEqualTo(1);
	}

	/** 存在しないサブタスクを指定すると 404 Not Found が返ることを確かめる */
	@Test
	void deleteReturns404WhenSubtaskNotFound() throws Exception {
		deleteSubtask(1, 9999)
			.andExpect(status().isNotFound())
			.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.detail").value("サブタスクが見つかりません（id：9999）"));
		assertThat(countSubtasks()).isEqualTo(1);
	}

	/** 別のカードのサブタスクを指定すると 404 Not Found が返り、サブタスクが消えないことを確かめる */
	@Test
	void deleteReturns404WhenSubtaskBelongsToAnotherTask() throws Exception {
		deleteSubtask(2, 1)
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.detail").value("サブタスクが見つかりません（id：1）"));
		assertThat(countSubtasks()).isEqualTo(1);
	}
}
