# TaskManagement

RaiseTech AIコースのカリキュラムの一環として作成する、Trello風のタスク管理アプリケーションです。
PCのブラウザで動作します。

## 目的

- RaiseTech AIコースのカリキュラムに沿って、AI（Claude Code）を活用した開発の進め方を学ぶ
- Gitによるバージョン管理を実践する
- タスク管理アプリの作成を通して、設計から実装までの流れを経験する

## 機能（予定）

詳しくは [要件定義書](docs/requirements.md) を参照してください。

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
├── compose.yaml          # 開発用 PostgreSQL の設定（Docker Compose）
├── backend/              # バックエンド（Spring Boot）
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

起動後、`http://localhost:8080/api/health` にアクセスして `{"status":"ok"}` が返れば動作しています。

起動時に `Task` クラス（`@Entity`）をもとに `tasks` テーブルが自動で作られます（`spring.jpa.hibernate.ddl-auto=update`）。テーブルの中身は次のコマンドで確認できます。

```sh
docker compose exec db psql -U taskmanagement -c '\d tasks'
```

### 3. DB を停止する

```sh
docker compose down      # 停止（データは残る）
docker compose down -v   # 停止してデータも削除する
```

### テストの実行

テストでは Testcontainers がテスト用の PostgreSQL を自動で起動します。Docker Desktop を起動した状態で実行してください（`docker compose up` は不要です）。

```sh
cd backend
./gradlew test
```
