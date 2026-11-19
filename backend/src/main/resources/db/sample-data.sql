-- 開発用のサンプルデータ
-- 開発用 DB（docker compose）に、動作確認のためのカードを入れる。
--
-- 使い方（リポジトリ直下で実行。先に ./gradlew bootRun を1回起動して tasks テーブルを作っておく）：
--   docker compose exec -T db psql -U taskmanagement -d taskmanagement < backend/src/main/resources/db/sample-data.sql
--
-- ※ 最初に tasks テーブルを空にしてから入れ直すので、何度流しても同じ状態になる。
--    手で追加したカードも消えるので注意。
-- ※ Spring Boot はこのファイルを自動では実行しない（手で流したときだけ使われる）。

-- テーブルを空にする。RESTART IDENTITY で id の番号も 1 から振り直す
TRUNCATE TABLE tasks RESTART IDENTITY;

-- created_at / updated_at は DEFAULT（現在時刻）が入るので書かない
INSERT INTO tasks (title, description, priority, due_date, status, position) VALUES
	-- 未着手（todo）
	('要件定義書を見直す', '受け入れ基準と食い違いがないか確認する', 'high', '2026-11-25', 'todo', 0),
	('画面のモックアップを修正する', NULL, 'medium', NULL, 'todo', 1),
	('README に起動手順を書く', NULL, NULL, NULL, 'todo', 2),
	-- 進行中（in_progress）
	('タスクの読み取り API を作る', 'GET /api/tasks と GET /api/tasks/{id}', 'high', '2026-11-20', 'in_progress', 0),
	('テストを書く', NULL, 'low', '2026-12-01', 'in_progress', 1),
	-- 完了（done）
	('PostgreSQL の環境を作る', 'Docker Compose で起動できるようにした', 'medium', '2026-11-10', 'done', 0);
