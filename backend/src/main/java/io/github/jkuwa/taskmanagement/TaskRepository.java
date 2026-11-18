package io.github.jkuwa.taskmanagement;

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
}
