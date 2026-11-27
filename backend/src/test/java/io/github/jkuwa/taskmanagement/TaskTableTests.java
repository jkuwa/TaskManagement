package io.github.jkuwa.taskmanagement;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * tasks テーブルが Flyway のマイグレーション（src/main/resources/db/migration）で作られているかを確かめるテスト。
 *
 * <p>テスト用の PostgreSQL は毎回空の状態で起動するので、db/migration の SQL が順に実行されてテーブルができる。
 * テーブルと Entity（Task クラス）の定義が合っていなければ、Hibernate の確認（ddl-auto=validate）で起動に失敗する。
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class) // テスト用の PostgreSQL コンテナを自動で起動
class TaskTableTests {

	// JdbcTemplate：SQL を直接実行できるクラス
	@Autowired
	private JdbcTemplate jdbcTemplate;

	/**
	 * tasks テーブルに docs/database.md どおりの9つの列があることを確かめる。
	 * {@code List<String> columns}は、文字列のリストを入れる columns という変数
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

	/**
	 * 作成日時・更新日時が、タイムゾーン付きの日時（TIMESTAMPTZ）になっていることを確かめる。
	 * information_schema では TIMESTAMPTZ は "timestamp with time zone" と表示される。
	 */
	@Test
	void timestampColumnsHaveTimeZone() {
		List<String> types = jdbcTemplate.queryForList(
				"SELECT data_type FROM information_schema.columns"
						+ " WHERE table_name = 'tasks' AND column_name IN ('created_at', 'updated_at')",
				String.class);

		assertThat(types).containsOnly("timestamp with time zone").hasSize(2);
	}

	/**
	 * Flyway が実行したマイグレーションを記録していることを確かめる。
	 * flyway_schema_history は、Flyway が「どのファイルを実行したか」を記録するテーブル。
	 */
	@Test
	void migrationsAreRecorded() {
		List<String> versions = jdbcTemplate.queryForList(
				"SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank",
				String.class);

		assertThat(versions).containsExactly("1");
	}
}
