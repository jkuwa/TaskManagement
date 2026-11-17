package io.github.jkuwa.taskmanagement;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * アプリ全体が正しく起動できるかを確かめるテスト。
 *
 * <p>@SpringBootTest を付けると、テストの前に本番と同じようにアプリを組み立てる。
 * 設定ミスなどで起動できない場合は、このテストが失敗して気づける。
 */
@SpringBootTest
class TaskmanagementApplicationTests {

	/**
	 * 中身は空だが、アプリの組み立て（起動）が成功すればテストも成功になる。
	 */
	@Test
	void contextLoads() {
	}

}
