package io.github.jkuwa.taskmanagement;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * テスト用の PostgreSQL を Docker で起動する設定。
 *
 * <p>テストクラスの @Import(TestcontainersConfiguration.class) がついているクラスの
 * テスト開始時に Testcontainers が PostgreSQL のコンテナを自動で起動する。
 * docker compose で起動している開発用 DB とは別物なので、テストで開発用のデータが変わることはない。
 * （Docker Desktop が起動している必要がある）
 *
 * <p>@ServiceConnection を付けると、application.properties の接続先（localhost:5432）の代わりに、
 * このコンテナに接続するよう Spring Boot が自動で切り替えてくれる。
 * 
 * {@code proxyBeanMethods = false} ：デフォルトではSpringが設定クラスを継承した特別なクラス（プロキシ）を
 * 自動で作るため、作らないように設定。@Bean メソッドが１つの時はプロキシ不要。
 */
@TestConfiguration(proxyBeanMethods = false)  // テスト用の設定クラスであることを示す
class TestcontainersConfiguration {

	@Bean  // このメソッドが返すものをアプリの部品（Bean）とする
	@ServiceConnection
	PostgreSQLContainer postgresContainer() {
		// compose.yaml と同じバージョンのイメージを使う
		return new PostgreSQLContainer("postgres:18");
	}
}
