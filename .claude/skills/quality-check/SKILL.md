---
name: quality-check
description: このリポジトリ（Trello風タスク管理アプリ）全体の品質チェックをする。lint・静的解析・テストを実行し、React / Spring Boot の標準から外れている箇所と、ドキュメント（docs/・README）と実装の食い違いを洗い出して報告する。「品質チェックして」「全体をレビューして」「標準から外れているところを見て」「ドキュメントと実装の差異を確認して」など、言い方が違っても全体の品質チェックを頼まれたときは必ずこのスキルを使う。チェックと報告だけを行い、ファイルは変更しない。個別のバグ修正や機能追加には使わない。
---

# 品質チェック

アプリ全体（frontend・backend・docs）の品質をチェックして、結果を一覧で報告するスキル。

- **ファイルは変更しない**。lint の自動修正（`--fix`）やドキュメントの書き換えもしない
- 直すかどうかは、報告を見てユーザーが決める。直すときは CLAUDE.md の手順どおり、Issue を立ててから別の作業として行う
- 推測で書かない。指摘には必ず根拠になる場所（`ファイル:行`）を付ける

---

## 1. 前提の確認

1. `git status` と `git branch --show-current` で、今のブランチと、コミットしていない変更があるかを確認する。報告の冒頭に書く（コミットしていない変更もチェックの対象になるため）
2. `docker info` で Docker が動いているかを確認する。動いていなければ、バックエンドのテスト（Testcontainers が PostgreSQL を起動する）が実行できないことを伝え、Docker Desktop の起動を頼んで待つ

## 2. 自動チェックを実行する

| 対象 | コマンド | 中身 |
|---|---|---|
| フロントエンド | `cd frontend && npm run check` | oxlint・型チェック（tsc）・単体テスト（Vitest） |
| フロントエンド | `cd frontend && npm run build` | 本番用のビルド |
| バックエンド | `cd backend && ./gradlew check` | テスト（JUnit）・Checkstyle・SpotBugs |

- 失敗したら、どのコマンドで何件、どんな指摘が出たかを報告に書く
- バックエンドの指摘の詳細は HTML のレポートから読む：`backend/build/reports/checkstyle/`・`backend/build/reports/spotbugs/`・`backend/build/reports/tests/`
- `./gradlew check` で出る「Gradle 10 で使えなくなる機能が使われている」という警告は、SpotBugs プラグインの中（`Configuration.setVisible`）が原因の既知のものなので報告しなくてよい
- lint を無効にしているコメント（`oxlint-disable`）と、`backend/config/spotbugs/exclude.xml` の除外を確認し、理由が書かれていて妥当かを見る

## 3. コードをレビューする

`frontend/src/` と `backend/src/main/`・`backend/src/test/` のファイルをすべて読み、標準的な書き方から外れているところを探す。

### React（フロントエンド）

- React 公式ドキュメントの推奨に沿っているか
  - hooks のルール、useEffect の依存配列とクリーンアップ（タイマー・購読の解除）
  - 前の state をもとにした更新は関数形式（`setState(prev => …)`）になっているか
  - DOM を直接読み書きしていないか（ref や、ライブラリの仕組みで済むか）
  - コンポーネントや関数が大きくなりすぎていないか（カスタムフックに分けられるか）
  - 一覧の `key`、フォームの扱い、アクセシビリティ（ラベル、キーボード操作）
- dnd-kit の標準的な使い方（並べ替えなら `@dnd-kit/sortable`）に沿っているか
- TypeScript の型が正しく付いているか（`as` による無理な型変換、`any`、API の戻り値の型）
- 同じ処理のくり返し（例：fetch の処理）

### Spring Boot（バックエンド）

- 層の分け方：Controller は受け渡しだけ、業務ルールは Service、DB は Repository
- 入力チェック：Bean Validation（`@Valid`・`@NotBlank`・`@Size` など）を使っているか
- 例外処理：Service が Web 層の例外を投げていないか。`@RestControllerAdvice`・ProblemDetail でまとめて扱っているか。エラーメッセージがクライアントに届くか
- Entity をそのまま API で返していないか（レスポンス用の DTO）
- 決まった値の集まり（status・priority など）を `enum` で表しているか
- トランザクションの付け方、`open-in-view` などの設定
- スキーマの管理（`ddl-auto` に頼っていないか、Flyway などのマイグレーション）、設定のプロファイル分け、ログの設定
- テストが仕様（docs/spec.md）の項目をカバーしているか

### フロントとバックの両方

- 同じ仕様の扱いがずれていないか（例：タイトルの文字数の数え方、空白だけの入力の扱い、入力チェックの内容）
- requirements.md の非機能要件（XSS 対策・SQL インジェクション対策・保存や読み込みに失敗したときの表示）を満たしているか

## 4. ドキュメントと実装の差異を探す

対象：`docs/requirements.md`・`docs/spec.md`・`docs/screens.md`・`docs/database.md`・`docs/acceptance.md`・`docs/usecases.md`・`README.md`

- requirements.md の機能要件のうち、優先度が「任意」の機能が未実装なのは差異として扱わない。「必須」の機能だけを見る。ただし任意の機能がすでに実装されていたら、その分は対象にする
- 実装にあるのにドキュメントに書かれていない動き（ボタン、選択肢、エラー表示、保存のタイミングなど）も差異として挙げる
- spec.md を変えたら acceptance.md の「2. 詳細仕様の確認」も直すルールがあるので、2つの内容が揃っているかを見る
- database.md のテーブル定義を、Entity（`Task.java` など）と照らし合わせる。テーブルは `ddl-auto=update` で Entity から作られることに注意する
- requirements.md「9. 技術・制約」のバージョンを、`frontend/package.json`・`backend/build.gradle`・`backend/gradle/wrapper/gradle-wrapper.properties`・`compose.yaml` と照らし合わせる
- README の起動手順・API の一覧・チェックの手順が、今のコードと合っているか

## 5. 報告する

次の形式で報告し、ファイルは変更せずに止まる。

```markdown
## 品質チェックの結果（YYYY-MM-DD）

ブランチ：<ブランチ名>（コミットしていない変更：なし／あり）

### 自動チェック
| コマンド | 結果 |
|---|---|
| npm run check | 通った／失敗（lint ○件・型 ○件・テスト ○件失敗） |
| npm run build | 通った／失敗 |
| ./gradlew check | 通った／失敗（Checkstyle ○件・SpotBugs ○件・テスト ○件失敗） |

（失敗したときは、指摘の内容を箇条書きで）

### 標準から外れている箇所

#### バックエンド
| 重要度 | 内容（場所） | 標準的なやり方 |
|---|---|---|

#### フロントエンド
| 重要度 | 内容（場所） | 標準的なやり方 |
|---|---|---|

### ドキュメントと実装の差異
| ドキュメント | 書いてあること | 実装 | 提案（どちらに合わせるか） |
|---|---|---|---|

直したいものを選んでもらえれば、Issue を立てて進めます。
```

- 重要度の目安
  - 高：バグ・データが消える・セキュリティの問題
  - 中：保守しにくい、将来の不具合につながる
  - 低：書き方の好みに近いもの、小さな改善
- 表は重要度の高い順に並べる。指摘がない欄は「なし」と書く
- 場所は `ファイル:行` の形で書く
- ドキュメントの差異の提案は、ドキュメントの書き漏れや古い記述なら「ドキュメントを直す」、実装が要件を満たしていないなら「実装を直す」とする
