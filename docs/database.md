# データベース設計：Trello風タスク管理アプリ

DB で管理するエンティティは「カード（タスク）」と「サブタスク」の2つ。

- 列は「未着手」「進行中」「完了」の3つで固定する。どの列に入っているかは、カードの `status` で表す
- 1つのカードは、複数のサブタスクを持つ（サブタスクがないカードもある）

## ER図

```mermaid
erDiagram
    TASKS ||--o{ SUBTASKS : "持つ"

    TASKS {
        integer id PK "主キー"
        varchar title "タイトル"
        text description "説明文"
        varchar priority "優先度"
        date due_date "期限"
        varchar status "状態"
        integer position "列の中での並び順"
        timestamp created_at "作成日時"
        timestamp updated_at "更新日時"
    }
    SUBTASKS {
        integer id PK "主キー"
        integer task_id FK "親のカードのID"
        varchar title "内容"
        boolean done "完了したか"
        timestamp created_at "作成日時"
        timestamp updated_at "更新日時"
    }
```

記号の意味：

- `||--o{`：左側の1件に対して、右側が0件以上つながる（1対多）
- `PK`（主キー）：そのデータを見分けるための項目
- `FK`（外部キー）：ほかのテーブルのデータを指す項目

## テーブル定義

型は PostgreSQL の書き方で書いている。

`updated_at` は、PostgreSQL では行を更新しても自動では変わらない。更新するときに、SQL で現在時刻を入れる。

### tasks（カード）

| カラム名 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| id | INTEGER GENERATED ALWAYS AS IDENTITY | YES | - | 主キー（自動で番号を振る） |
| title | VARCHAR(255) | YES | - | タイトル |
| description | TEXT | NO | NULL | 説明文 |
| priority | VARCHAR(10) | NO | NULL | 優先度（high / medium / low） |
| due_date | DATE | NO | NULL | 期限 |
| status | VARCHAR(20) | YES | 'todo' | 状態（todo / in_progress / done） |
| position | INTEGER | YES | 0 | 列の中での並び順 |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | 更新日時 |

`status` の値と列の対応：

| status | 列 |
|---|---|
| todo | 未着手 |
| in_progress | 進行中 |
| done | 完了 |

### subtasks（サブタスク）

| カラム名 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| id | INTEGER GENERATED ALWAYS AS IDENTITY | YES | - | 主キー（自動で番号を振る） |
| task_id | INTEGER | YES | - | 外部キー（tasks.id） |
| title | VARCHAR(255) | YES | - | 内容 |
| done | BOOLEAN | YES | FALSE | 完了したか |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | 更新日時 |

カードを削除したときは、そのカードのサブタスクもあわせて削除する（外部キーに `ON DELETE CASCADE` を付ける）。
