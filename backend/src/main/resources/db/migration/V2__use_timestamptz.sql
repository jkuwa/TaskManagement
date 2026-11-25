-- 作成日時・更新日時を、タイムゾーン付きの日時（TIMESTAMPTZ）に変える。
--
-- タイムゾーンなしの TIMESTAMP だと、アプリ（日本時間）が入れた値と DB の DEFAULT（UTC）が入れた値が
-- 区別できずに混ざってしまう。TIMESTAMPTZ は「世界共通のどの時点か」で保存するので、どちらから入れてもずれない。
--
-- これまでの値は UTC として読み替える（アプリが日本時間で入れた値は9時間ずれるが、画面には表示していない）。

ALTER TABLE tasks
	ALTER COLUMN created_at TYPE TIMESTAMPTZ(6) USING created_at AT TIME ZONE 'UTC',
	ALTER COLUMN updated_at TYPE TIMESTAMPTZ(6) USING updated_at AT TIME ZONE 'UTC';
