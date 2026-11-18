package io.github.jkuwa.taskmanagement;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * tasks テーブルが Entity（Task クラス）から自動で作られているかを確かめるテスト。
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class) // テスト用の PostgreSQL コンテナを自動で起動
class TaskTableTests {

	// JdbcTemplate：SQL を直接実行できるクラス
	@Autowired
	private JdbcTemplate jdbcTemplate;

	/**
	 * tasks テーブルに docs/database.md どおりの9つの列があることを確かめる。
	 *
	 * {@code queryForList(SQL, 型)}は、「SQLを実行して、指定した型のリストで結果を返す」メソッド。
	 * <p>information_schema.columns は、DB にあるテーブルの列の情報が入っている PostgreSQL の表。
	 * 
	 * SELECT column_name                 -- 列名を取り出す
	 * FROM information_schema.columns    -- 「全テーブルの列の情報」が入った表から
	 * WHERE table_name = 'tasks'         -- tasks テーブルのものだけ
	 */
	@Test
	void tasksTableIsCreated() {
		List<String> columns = jdbcTemplate.queryForList(
				"SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks'",
				String.class);

		/**
		 * 順番は問わず、この9つの列がちょうどあることを確かめる
		 * 
		 * {@code assertThat}は、「〜であることを確認する」
		 * {@code containsExactlyAnyOrder(...)}でどうなっていれば良いかを指定
		 * - in any order：順番は問わず
		 * - exactly：ちょうど
		 * - contains：含む
		 */
		assertThat(columns).containsExactlyInAnyOrder(
				"id", "title", "description", "priority", "due_date",
				"status", "position", "created_at", "updated_at");
	}
}
