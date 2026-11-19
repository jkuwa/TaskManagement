package io.github.jkuwa.taskmanagement;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * tasks テーブルを読み書きするためのインターフェース。
 * JPAリポジトリと呼ばれる。DBを読み書きするための窓口。
 *
 * エンティティごとにリポジトリを作成。
 * Publicなインターフェースは１ファイルに１つまで。ファイル名はその名前と同じにする。
 *
 * <p>JpaRepository を継承するだけで、Spring Data JPA が中身（SQL を実行する処理）を自動で作ってくれる。
 * 中身を書かなくても、次のようなメソッドが使える。
 * <ul>
 *   <li>save(task)：保存（id がなければ追加、あれば更新）</li>
 *   <li>findAll()：全件取得</li>
 *   <li>findById(id)：id で1件取得</li>
 *   <li>deleteById(id)：id で削除</li>
 * </ul>
 *
 * <p>JpaRepository&lt;Task, Integer&gt; は「Task を扱い、主キー（id）の型は Integer」という意味。
 */
public interface TaskRepository extends JpaRepository<Task, Integer> {

	/**
	 * すべてのカードを、列の中での並び順（position の小さい順）で取得する。
	 * position が同じときは id の小さい順（先に作ったもの順）にする。
	 *
	 * <p>メソッドの名前を決まった形で書くと、Spring Data JPA が名前から SQL を自動で作る（クエリメソッド）。
	 * <ul>
	 *   <li>findAll：全件を取得する</li>
	 *   <li>By：ここから後ろが条件（今回は条件なしなので、By のすぐ後ろが並び順）</li>
	 *   <li>OrderByPositionAsc：position の小さい順（Asc＝昇順）</li>
	 *   <li>IdAsc：次に id の小さい順</li>
	 * </ul>
	 * 実行される SQL のイメージ：SELECT * FROM tasks ORDER BY position ASC, id ASC
	 *
	 * @return カードのリスト。1件もなければ空のリスト
	 */
	List<Task> findAllByOrderByPositionAscIdAsc();
}
