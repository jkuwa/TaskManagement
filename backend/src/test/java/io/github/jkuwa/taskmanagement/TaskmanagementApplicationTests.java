package io.github.jkuwa.taskmanagement;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * アプリ全体が正しく起動できるかを確かめるテスト。
 *
 * <p>@SpringBootTest を付けると、テストの前に本番と同じようにアプリを組み立てる。
 * 設定ミスなどで起動できない場合は、このテストが失敗して気づける。
 *
 * <p>アプリの起動には DB が必要なので、@Import でテスト用の PostgreSQL コンテナを使う。
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TaskmanagementApplicationTests {

	/**
	 * 中身は空だが、アプリの組み立て（起動）が成功すればテストも成功になる。
	 */
	@Test
	void contextLoads() {
	}

}
