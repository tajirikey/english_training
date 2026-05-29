# 英語動詞クイズ

日本語の状況を見て、英文の中に入る **動詞（句）** を答える瞬発力トレーニング用の Web アプリです。
ログイン不要・完全静的（ビルド不要）で、成績はブラウザの localStorage に保存されます。

## 特長

- **動詞（句）を答える形式**：主語と続きの文は表示。間に入る動詞・動詞句だけを答えます（例: `arrived` / `will check` / `picked up`）。
- **2つの解答方法**
  - **入力する**：キーボードで動詞句を入力。表記ゆれ・短縮形（`canceled`/`cancelled` など）を許容。
  - **選択肢から選ぶ**：まず頭の中で答えを思い浮かべ、ボタンを押してから4択を表示（**ワンクッション**）。`1`〜`4` キーでも選択可。
- **練習範囲**：ミックス / 日常 / ビジネス / **苦手だけ**
- **苦手だけモード**：最後に間違えた問題だけを集中復習。
- **成績の自動保存**：セッション成績に加え、通算回答数・正答率・苦手数・最高連続正解を保存。
- 約 300 問。日常会話〜簡単なビジネスをカバー（難しすぎる表現は排除）。

## 操作

| キー | 動作 |
| --- | --- |
| `Enter` | 判定 / 次へ（選択モードでは選択肢の表示も） |
| `Esc` | 入力クリア |
| `?` | ヒント（入力モード） |
| `1`〜`4` | 選択肢を選ぶ（選択モード） |

## ローカルで開く

ビルド不要です。ファイルをそのままブラウザで開くか、簡易サーバーで配信してください。

```bash
# どちらでもOK
python3 -m http.server 8000
# → http://localhost:8000
```

## Vercel での自動デプロイ手順

このリポジトリは Vercel の静的サイトとしてそのままデプロイできます（ビルド設定不要）。

1. [vercel.com](https://vercel.com/) にログイン → **Add New… → Project**
2. **Import Git Repository** で `tajirikey/english_training` を選択
3. 設定はデフォルトのまま：
   - **Framework Preset**: `Other`
   - **Build Command**: 空欄（なし）
   - **Output Directory**: 空欄（ルートをそのまま配信）
4. **Deploy** を押す

以降は、連携したブランチへ `git push` するたびに **自動でデプロイ** されます
（Production を `main` にする場合は、本ブランチを `main` にマージすると本番反映されます）。

## ファイル構成

```
.
├── index.html     # 画面とスタイル
├── app.js         # クイズのロジック・成績保存
├── questions.js   # 問題データ（約300問）
├── vercel.json    # 静的サイト設定
└── README.md
```

## 問題の追加方法

`questions.js` の配列に以下の形式で追加します。

```js
{ id: "x001", cat: "daily", sub: "買い物",
  jp: "薬局で薬を買った",
  subject: "I", answer: "bought",
  alts: ["purchased"],                 // 許容する別表記（任意）
  tail: "some medicine at the pharmacy.",
  full: "I bought some medicine at the pharmacy.",
  note: "買った = bought。" }
```

- `cat` は `"daily"` または `"business"`。
- `id` は一意にしてください（重複すると成績記録が混ざります）。
