package io.github.jkuwa.taskmanagement;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

/**
 * カード（タスク）を表すクラス。DB の tasks テーブルの1行に対応する。
 *
 * <p>@Entity を付けると、JPA（Hibernate）がこのクラスを「DB のテーブルに対応するクラス」として扱う。
 * テーブルは Flyway が db/migration の SQL で作る。Hibernate は起動時に、このクラスとテーブルの定義が
 * 合っているかを確かめる（application.properties の spring.jpa.hibernate.ddl-auto=validate）。
 * 列を足したり変えたりするときは、このクラスと一緒に、新しいマイグレーションの SQL を書く。
 *
 * <p>フィールド名は自動で「小文字＋アンダースコア」の列名に変換される（例：dueDate → due_date）。
 * 列の定義は docs/database.md の tasks テーブルに合わせている。
 */
@Entity
@Table(name = "tasks") // テーブル名を指定する（指定しないとクラス名の task になる）
public class Task {
	/**
	 * タイトルの最大文字数（docs/spec.md の F-11, F-13）。
	 * リクエストの入力チェック（{@code @Size}）でも使うので、ここにまとめて public にしている。
	 * フロントエンドの入力欄（maxLength）と同じく、String の length() で数える（絵文字などは1つで2文字になる）。
	 */
	public static final int MAX_TITLE_LENGTH = 100;

	// ---- フィールド（テーブルの列）の定義 ----
	/**
	 * 主キー。保存するときに DB が自動で番号を振る（IDENTITY）。
	 *
	 * {@code @Id}：主キーであることを示す
	 * {@code @GeneratedValue}：主キーの値を自動で生成することを示す
	 * {@code strategy}：誰がどうやって番号を決めるかを指定する
	 * {@code GenerationType.IDENTITY}：DB が自動で番号を振る
	 * {@code private Integer id;}：主キーの値
	 */
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;  // private：外からの書き換えなどを防ぐ

	/** タイトル（必須） */
	@Column(nullable = false, length = 255)
	private String title;

	/** 説明文。長い文章も入るように TEXT 型にする */
	@Column(columnDefinition = "text")
	private String description;

	/** 優先度（high / medium / low）。未設定なら null。DB との変換は PriorityConverter が行う */
	@Column(length = 10)
	private Priority priority;

	/** 期限。未設定なら null */
	private LocalDate dueDate;

	/**
	 * 状態（todo / in_progress / done）。どの列に入っているかを表す。DB との変換は TaskStatusConverter が行う。
	 *
	 * <p>DB にも DEFAULT 'todo' があるが、Hibernate は保存時に全部の列の値を送るので、Java 側でも初期値を入れておく。
	 */
	@Column(nullable = false, length = 20)
	private TaskStatus status = TaskStatus.TODO;  // Java側の初期値

	/** 列の中での並び順 */
	@Column(nullable = false)
	private Integer position = 0;

	/**
	 * 作成日時。あとから変更しない。
	 * （psql などで直接 INSERT したときのために、DB 側にも DEFAULT CURRENT_TIMESTAMP を付けている）
	 *
	 * <p>Instant は「世界共通のどの時点か」を表す型（タイムゾーンを持たない）。
	 * DB の TIMESTAMPTZ（タイムゾーン付きの日時）と組み合わせると、PC や DB のタイムゾーンが違っても時刻がずれない。
	 * JSON では "2026-11-20T01:00:00Z" のように UTC（末尾の Z）で返る。
	 */
	@CreationTimestamp // データを最初に保存するときに、Hibernateが現在時刻を入れるためのアノテーション
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	/** 更新日時。保存・更新するたびに Hibernate が現在時刻を入れる */
	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	/**
	 * このカードのサブタスク（追加した順）。subtasks テーブルの列ではなく、つながりを表すフィールド。
	 *
	 * <ul>
	 *   <li>{@code @OneToMany}：1対多のつながり。{@code mappedBy = "task"} で
	 *       「つながりの持ち主は Subtask の task フィールド（task_id 列）」と示す。tasks テーブルに列は増えない</li>
	 *   <li>{@code @OrderBy("id")}：読み込むときに id の小さい順（追加した順）に並べる</li>
	 * </ul>
	 * 初期値は LAZY（使うときに初めて読み込む）。カードと一緒に返すときは、
	 * TaskRepository の {@code @EntityGraph} でまとめて読み込む（カードの枚数だけ SQL が増えないようにするため）。
	 *
	 * <p>{@code cascade = CascadeType.REMOVE}：カードを削除するときに、Hibernate がサブタスクも削除する。
	 * DB にも ON DELETE CASCADE（V2__create_subtasks.sql）があるが、それだけだと、
	 * 読み込み済みのサブタスクが「削除したカードを指したまま」Hibernate に残り、保存のときにエラーになる。
	 * DB の ON DELETE CASCADE は、psql などで直接カードを消したときのために残しておく。
	 */
	@OneToMany(mappedBy = "task", cascade = CascadeType.REMOVE)
	@OrderBy("id")
	private List<Subtask> subtasks = new ArrayList<>();

	// ---- コンストラクタ ----
	/**
	 * 引数なしのコンストラクタ。JPA が DB から読み込んだデータでオブジェクトを作るときに使う。（JPAの仕様で必要）
	 * アプリのコードからは使わないので protected にしている。
	 * protected：同じパッケージのクラス、もしくはこのクラスを継承したクラスであれば、アクセスできる。
	 */
	// 空のタスクを作る。
	protected Task() {
	}

	/**
	 * タイトル・状態（列）・並び順を指定してカードを作る。カードを追加する API で使う。
	 * Javaのコンストラクタはクラス名と同じ名前にする決まり。
	 * 同じ名前のコンストラクタでも、引数の数や型が違えば複数作れる（オーバーロード）。
	 * ここでは引数なしのもの（JPA 用）と、この3つの引数を取るものの2つがある。
	 *
	 * <p>説明文・期限・優先度は未設定（null）で作る。あとから詳細画面で設定する。
	 *
	 * @param title    タイトル
	 * @param status   状態（todo / in_progress / done）
	 * @param position 列の中での並び順
	 */
	public Task(String title, TaskStatus status, Integer position) {
		this.title = title;
		this.status = status;
		this.position = position;
	}

	// ---- 更新 ----
	/**
	 * 詳細画面で編集できる項目（タイトル・説明文・期限・優先度）をまとめて書き換える。
	 * カードを更新する API で使う。
	 *
	 * <p>項目ごとに setter を作ると、どこからでも1項目ずつ書き換えられてしまうので、
	 * 「詳細画面の内容で更新する」という1つのメソッドにまとめている。
	 * 入力のチェックは、リクエストを受け取るとき（Bean Validation）と TaskService で済ませてから呼ぶ。
	 *
	 * <p>JPA は、トランザクションの中で読み込んだエンティティの値が変わると、
	 * トランザクションの終わりに自動で UPDATE 文を実行する（変更の検知）。
	 * 更新日時（updatedAt）も @UpdateTimestamp で自動で入る。
	 *
	 * @param title       タイトル
	 * @param description 説明文（未設定なら null）
	 * @param dueDate     期限（未設定なら null）
	 * @param priority    優先度（未設定なら null）
	 */
	public void update(String title, String description, LocalDate dueDate, Priority priority) {
		this.title = title;
		this.description = description;
		this.dueDate = dueDate;
		this.priority = priority;
	}

	/**
	 * カードが入っている列（status）と、列の中での並び順（position）を書き換える。
	 * カードを移動する API で使う。
	 *
	 * <p>動かしたカードだけでなく、同じ列のほかのカードの position を振り直すときにも使う。
	 * update と同じく、トランザクションの終わりに JPA が自動で UPDATE 文を実行する。
	 *
	 * @param status   状態（todo / in_progress / done）
	 * @param position 列の中での並び順
	 */
	public void move(TaskStatus status, int position) {
		this.status = status;
		this.position = position;
	}

	// ---- getter（値を取り出すメソッド）----
	// フィールドの値を取得するためのメソッド。フィールドがprivateなので、メソッドを通さないと外部からアクセスできない。
	public Integer getId() {
		return id;
	}

	public String getTitle() {
		return title;
	}

	public String getDescription() {
		return description;
	}

	public Priority getPriority() {
		return priority;
	}

	public LocalDate getDueDate() {
		return dueDate;
	}

	public TaskStatus getStatus() {
		return status;
	}

	public Integer getPosition() {
		return position;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	/**
	 * サブタスクの一覧を返す。外から追加・削除できないよう、読み取り専用の List にして返す。
	 *
	 * @return サブタスク（追加した順）
	 */
	public List<Subtask> getSubtasks() {
		return Collections.unmodifiableList(subtasks);
	}
}
