package io.github.jkuwa.taskmanagement;

/**
 * カードを移動するとき（PUT /api/tasks/{id}/position）に受け取るリクエストの中身。
 * ボードでカードをドラッグ&ドロップしたときに、フロントエンドが送ってくる。
 * 例：{"status":"in_progress","index":1}
 *
 * <p>項目のしくみ（record）は CreateTaskRequest のコメントを参照。
 *
 * <p>index は「移動先の列の中で、上から何番目に入れるか」（0 始まり）。
 * 動かすカード自身を除いた並びで数える。
 * 例：進行中の列に A・B の2枚があり、その間に入れるときは 1。一番上なら 0、一番下なら 2。
 *
 * <p>index を int ではなく Integer にしているのは、JSON に項目がないときに null になって、
 * 「送られてこなかった」ことが分かるようにするため（int だと 0 が入ってしまい、一番上と見分けられない）。
 *
 * @param status 移動先の列（todo / in_progress / done）
 * @param index  移動先の列の中での位置（0 始まり）
 */
public record MoveTaskRequest(String status, Integer index) {
}
