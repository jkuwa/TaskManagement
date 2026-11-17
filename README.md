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
- ドラッグ&ドロップでのカードの列移動
- DBへの自動保存（再読み込みや再起動をしてもデータが残る）

※ カリキュラムの進行に合わせて追加・変更します。

## 使用技術

- フロントエンド：React
- バックエンド：Java / Spring Boot
- DB：未定
- Git / GitHub
- Claude Code

## ディレクトリ構成

```
TaskManagement/
├── README.md
└── docs/
    ├── requirements.md   # 要件定義書（概要）
    ├── usecases.md       # ユースケース
    ├── screens.md        # 画面設計
    ├── database.md       # データベース設計
    ├── acceptance.md     # 受け入れ基準
    └── spec.md           # 詳細仕様メモ
```
