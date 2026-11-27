package io.github.jkuwa.taskmanagement;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * サブタスクを表すクラス。DB の subtasks テーブルの1行に対応する。
 *
 * <p>1つのカード（Task）は、複数のサブタスクを持つ（1対多）。
 * サブタスクの側から見ると「たくさんのサブタスクが、1つのカードにつながる」ので多対1（{@code @ManyToOne}）になる。
 * 列の定義は docs/database.md の subtasks テーブルに合わせている。
 */
@Entity
@Table(name = "subtasks")
public class Subtask {

	/** 主キー。保存するときに DB が自動で番号を振る（IDENTITY） */
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;

	/**
	 * 親のカード。DB では task_id 列（tasks.id を指す外部キー）に入る。
	 *
	 * <ul>
	 *   <li>{@code @ManyToOne}：多対1のつながり。{@code optional = false} で「親のカードは必ずある」ことを示す</li>
	 *   <li>{@code fetch = FetchType.LAZY}：サブタスクを読み込んだときに、親のカードまでは読み込まない
	 *       （使うときに初めて読み込む）。初期値の EAGER だと、毎回カードも一緒に読み込んでしまう</li>
	 *   <li>{@code @JoinColumn}：つなぐための列の名前を指定する</li>
	 * </ul>
	 */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "task_id", nullable = false)
	private Task task;

	/** 内容（必須） */
	@Column(nullable = false, length = 255)
	private String title;

	/** 完了したか。DB の DEFAULT FALSE と同じく、Java 側でも初期値を入れておく */
	@Column(nullable = false)
	private boolean done = false;

	/** 作成日時。最初に保存するときに Hibernate が現在時刻を入れる */
	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	/** 更新日時。保存・更新するたびに Hibernate が現在時刻を入れる */
	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	/** JPA が DB から読み込んだデータでオブジェクトを作るときに使う（JPA の仕様で必要） */
	protected Subtask() {
	}

	/**
	 * 親のカードと内容を指定してサブタスクを作る。サブタスクを追加する API で使う。
	 * 最初は未完了（done = false）で作る。
	 *
	 * @param task  親のカード
	 * @param title 内容
	 */
	public Subtask(Task task, String title) {
		this.task = task;
		this.title = title;
	}

	public Integer getId() {
		return id;
	}

	public String getTitle() {
		return title;
	}

	public boolean isDone() {
		return done;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
