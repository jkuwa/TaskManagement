package io.github.jkuwa.taskmanagement;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;

/**
 * TaskRepository で tasks テーブルにデータを保存・取得できるかを確かめるテスト。
 *
 * <p>@Transactional を付けると、テストが終わったときに DB への変更が取り消される（ロールバック）。
 * そのため、テストで入れたデータがほかのテストに影響しない。
 * 複数の処理を同じトランザクションにまとめて実行される。
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class) // テスト用の PostgreSQL コンテナを使う
@Transactional
class TaskRepositoryTests {

	@Autowired
	private TaskRepository taskRepository;

	// EntityManager：JPA で Entity を管理しているクラス。ここではキャッシュ（永続性コンテキスト）を操作するために使う
	@Autowired
	private EntityManager entityManager;

	/**
	 * タイトルだけ指定したカードを保存し、id で取り出せることと、初期値が入っていることを確かめる。
	 */
	@Test
	void saveAndFindById() {
		// タイトルを保存したカード情報（Task）をsavedという変数に入れる
		// ① new Task：新たなカードを作る
		// ② taskRepository.save：①をDBに保存してidなどをTaskに入れる
		// ③ Task saved：保存後のカードを受け取る
		Task saved = taskRepository.save(new Task("テスト用のカード"));

		// 同じトランザクションの中では、JPA が保存した Entity をキャッシュに覚えている。
		// そのままだと findById は DB を見に行かずキャッシュから返すので、DB から読み直すためにキャッシュを空にする
		entityManager.flush();  // まだ DB に送っていない SQL を送る
		entityManager.clear();  // キャッシュを空にする

		// 上で作成した saved に getId() メソッドを実行して id を取得している（Java側）
		// 取得した id を findById に渡して、DB から SELECT で読み直す
		// findById は Optional（値がないかもしれない入れ物）を返すので orElseThrow で取り出す
		Task found = taskRepository.findById(saved.getId()).orElseThrow();

		assertThat(found).isNotSameAs(saved);                  // キャッシュの saved ではなく、DB から読み直した別のオブジェクト
		assertThat(found.getId()).isEqualTo(saved.getId());    // 保存したときと同じ id で取り出せる
		assertThat(found.getTitle()).isEqualTo("テスト用のカード");
		assertThat(found.getStatus()).isEqualTo("todo");       // 初期値は「未着手」
		assertThat(found.getPosition()).isEqualTo(0);
		assertThat(found.getCreatedAt()).isNotNull();          // 作成日時が入っている
		assertThat(found.getUpdatedAt()).isNotNull();          // 更新日時が入っている
	}
}
