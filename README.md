# TaskManagement

RaiseTech AIコースのカリキュラムの一環として作成する、Trello風のタスク管理アプリケーションです。
PCのブラウザで動作します。

## 目的

- RaiseTech AIコースのカリキュラムに沿って、AI（Claude Code）を活用した開発の進め方を学ぶ
- Gitによるバージョン管理を実践する
- タスク管理アプリの作成を通して、設計から実装までの流れを経験する

## 機能

要件定義書の「必須」の機能を実装しています（サブタスクなどの「任意」の機能は未実装）。詳しくは [要件定義書](docs/requirements.md) を参照してください。

- 「未着手」「進行中」「完了」の3列のボード
- カードの追加・編集・削除
- カードへの説明文・期限・優先度の設定（任意）
- ドラッグ&ドロップでのカードの列移動・列内の並べ替え
- DBへの自動保存（再読み込みや再起動をしてもデータが残る）

※ カリキュラムの進行に合わせて追加・変更します。

## 使用技術

- フロントエンド：React（TypeScript、Vite、dnd-kit）
- バックエンド：Java / Spring Boot（Gradle、Spring Data JPA）
- DB：PostgreSQL（Docker Compose で起動）
- Git / GitHub
- Claude Code

## ディレクトリ構成

```
TaskManagement/
├── README.md
├── .claude/
│   └── skills/
│       └── quality-check/  # 品質チェックのスキル（Claude Code で /quality-check）
├── compose.yaml          # 開発用 PostgreSQL の設定（Docker Compose）
├── backend/              # バックエンド（Spring Boot）
│   └── config/           # 静的解析（Checkstyle・SpotBugs）の設定
├── frontend/             # フロントエンド（React + TypeScript + Vite）
├── mockup/               # 画面イメージ確認用のモックアップ（index.html をブラウザで開く）
└── docs/
    ├── requirements.md   # 要件定義書（概要）
    ├── usecases.md       # ユースケース
    ├── screens.md        # 画面設計
    ├── database.md       # データベース設計
    ├── acceptance.md     # 受け入れ基準
    └── spec.md           # 詳細仕様メモ
```

## バックエンドの起動方法

次のものが必要です。

- Java 25（JDK）
- Docker Desktop（PostgreSQL をコンテナで動かすため）

Gradle は同梱の Gradle Wrapper（`./gradlew`）を使うため、別途インストールは不要です。

### 1. DB（PostgreSQL）を起動する

Docker Desktop を起動してから、リポジトリ直下で実行します。

```sh
docker compose up -d
```

`docker compose ps` で `healthy` と表示されれば準備完了です。

### 2. バックエンドを起動する

```sh
cd backend
./gradlew bootRun
```

起動後、`http://localhost:8080/actuator/health` にアクセスして `{"status":"UP",…}` が返れば動作しています（Spring Boot Actuator の機能。DB につながっていないと `DOWN` になります）。

`./gradlew bootRun` で起動すると、開発用の設定（`application-dev.properties`。実行した SQL をログに出すなど）も読み込まれます。

起動時に Flyway が `backend/src/main/resources/db/migration` の SQL を順に実行して、`tasks` テーブルを作ります。テーブルを変えるときは、既存のファイルは書き換えず、`V2__内容.sql` のように新しいファイルを足します。テーブルの中身は次のコマンドで確認できます。

```sh
docker compose exec db psql -U taskmanagement -c '\d tasks'
```

### 3. サンプルデータを入れて API を確認する

バックエンドを起動して `tasks` テーブルができたあと、リポジトリ直下で次を実行するとサンプルのカードが入ります。
`tasks` テーブルを空にしてから入れ直すので、手で追加したカードは消えます。

```sh
docker compose exec -T db psql -U taskmanagement -d taskmanagement < backend/src/main/resources/db/sample-data.sql
```

カードの API は次のとおりです。エラー（400・404）のときは、理由を ProblemDetail（RFC 9457）の形で返します（例：`{"status":400,"detail":"タイトルを入力してください",…}`）。

| メソッド・URL | 内容 |
| --- | --- |
| `GET /api/tasks` | すべてのカードを並び順（position → id）で返す |
| `GET /api/tasks/{id}` | 指定した id のカードを返す。存在しなければ 404 |
| `POST /api/tasks` | カードを指定した列の一番下に追加し、201 で作ったカードを返す。入力が正しくなければ 400 |
| `PUT /api/tasks/{id}` | カードのタイトル・説明文・期限・優先度を更新する。4項目をまとめて送り、null で解除する。入力が正しくなければ 400、存在しなければ 404 |
| `PUT /api/tasks/{id}/position` | カードを指定した列の指定した位置（0 始まり）へ移動し、すべてのカードを返す。入力が正しくなければ 400、存在しなければ 404 |
| `DELETE /api/tasks/{id}` | カードを削除し、204（本文なし）を返す。同じ列の残りのカードの並び順は詰める。存在しなければ 404 |

```sh
curl http://localhost:8080/api/tasks
curl http://localhost:8080/api/tasks/1
curl -X POST http://localhost:8080/api/tasks -H 'Content-Type: application/json' -d '{"title":"資料を作る","status":"todo"}'
curl -X PUT http://localhost:8080/api/tasks/1 -H 'Content-Type: application/json' -d '{"title":"資料を作る","description":null,"dueDate":"2026-11-20","priority":"high"}'
curl -X PUT http://localhost:8080/api/tasks/1/position -H 'Content-Type: application/json' -d '{"status":"in_progress","index":0}'
curl -X DELETE http://localhost:8080/api/tasks/1
```

### 4. DB を停止する

```sh
docker compose down      # 停止（データは残る）
docker compose down -v   # 停止してデータも削除する
```

### テスト・チェックの実行

テストでは Testcontainers がテスト用の PostgreSQL を自動で起動します。Docker Desktop を起動した状態で実行してください（`docker compose up` は不要です）。

```sh
cd backend
./gradlew test    # テストだけ
./gradlew check   # テスト＋静的解析（Checkstyle・SpotBugs）
```

静的解析は、フロントエンドの lint にあたるものです。指摘が1件でもあると失敗します。

- Checkstyle：コードの書き方（import・名前の付け方・`{ }` の付け忘れなど）をチェックする。ルールは `backend/config/checkstyle/checkstyle.xml`
- SpotBugs：バグになりやすい書き方（null の扱いなど）を見つける。誤検知として除外するものは `backend/config/spotbugs/exclude.xml`

結果は `backend/build/reports/checkstyle/` と `backend/build/reports/spotbugs/` に HTML で出ます。

## フロントエンドの起動方法

次のものが必要です。

- Node.js（v22.12 以上）

### 1. バックエンドを起動する

先に「バックエンドの起動方法」の手順で DB とバックエンドを起動しておきます。画面に表示するカードがほしいときは、サンプルデータも入れておきます。

### 2. フロントエンドを起動する

```sh
cd frontend
npm install   # 初回だけ
npm run dev
```

`http://localhost:5173` を開くと、カードが「未着手」「進行中」「完了」の3列に表示されます。
バックエンドが動いていないときは「データを読み込めませんでした」と表示されます。

開発サーバーは `/api` から始まるリクエストを `http://localhost:8080`（バックエンド）へ転送します（`frontend/vite.config.ts` の `server.proxy`）。そのため、バックエンドに CORS の設定はしていません。

### チェック・テスト・ビルド

```sh
cd frontend
npm run lint        # コードの書き方のチェック（oxlint。設定は .oxlintrc.json）
npm run typecheck   # 型チェック（TypeScript）
npm run test        # 単体テスト・コンポーネントのテスト（Vitest・React Testing Library）
npm run check       # lint・型チェック・テストをまとめて実行
npm run build       # 型チェックと本番用のビルド（dist/ に出力）
```
