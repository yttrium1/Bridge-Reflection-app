# Bridge Post-Mortem — プロジェクトサマリー

## 概要
コントラクトブリッジのトーナメント結果を振り返り、分析するためのWebアプリ。
大会結果サイト（fitsys.jp）からハンドデータを自動取得し、ダブルダミー分析やプレイ解析を提供する。

- **本番URL**: https://bridge-reflection--bridge-reflection.asia-east1.hosted.app
- **GitHub**: https://github.com/yttrium1/Bridge-Reflection-app

---

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フレームワーク | Next.js 16.2.1 (App Router) |
| 言語 | TypeScript 5 |
| UI | React 19, Tailwind CSS 4 |
| バックエンド/DB | Firebase (Firestore, Auth, Storage) |
| DDS解析 | @bridge-tools/dd (C++ DDS → WASM、クライアントサイドWeb Worker) |
| スクレイピング | Cheerio (HTMLパーサー) |
| ホスティング | Firebase App Hosting (Cloud Run) |

---

## 主な機能

### 実装済み
1. **ユーザー認証** — メール/パスワード + Googleログイン（Firebase Auth）、許可リスト制による新規登録制限
2. **大会データ自動取得** — fitsys.jpからスクレイピング（MP, IMP, DAT形式対応）
3. **ハンドダイアグラム表示** — 4方向のカード表示、ディーラー/バル表示
4. **ダブルダミー分析（DDS）** — 4方向×5デノミ=20セルのトリック数を計算、クライアントサイドWeb Workerで実行、Firestoreにキャッシュ
5. **ベストリード解析** — ディフェンス側の最適リードを表示
6. **プレイ解析** — カードを1枚ずつプレイし、各カードの最適度を色分け表示
7. **自動プレイ機能** — DDS最善手＋カーディング法則による自動プレイ
   - **自動ディフェンス**: ディクレアラーとしてプレイを振り返る際、ディフェンス側がDDS最善手を自動プレイ
   - **自動ディクレアラー**: ディフェンダーとしてプレイを振り返る際、ディクレアラー側がDDS最善手を自動プレイ
   - **自動モード切替**: ユーザーのペア方向（myDirections）に基づき、適切なモードを自動選択
   - **カーディング法則**: オープニングリード（4th best/3rd best）、連続カード（上から/下から）、偶数奇数ルール、3rd hand high
8. **ビッディングボックス** — ビッドの記録（P=Pass入力対応）
9. **コメント機能** — 各ボードにコメント追加（!S, !H, !D, !Cでスートマーク入力）
10. **共有リンク** — 未ログインユーザーへの閲覧共有（ゲスト編集可能、編集履歴あり）
11. **複数セッション管理** — 1大会に複数セッションを統合、セッション間ボード移動対応
12. **PDF結果アップロード** — Firebase Storageに保存
13. **大会タグ・メモ** — 大会にタグ（公式/練習等）やメモを付与
14. **弱点分析** — DDとの差が大きいボード自動抽出、Play/Defense別平均（Play未達=反省、Defense超え=反省）
15. **パフォーマンスダッシュボード** — 大会横断のMP%推移グラフ
16. **スコアリング対応** — MP%（マッチポイント）、IMP、DAT（データム）
17. **MP%自動計算** — fitsys.jpがMP%=0の場合、スコアから自動計算
18. **アクセス制御** — Firestoreの許可リスト（config/access.allowedEmails）による新規登録制限、管理者がFirebase Consoleから管理

### 解決済みの課題
- **Cloud Run上でのWASM安定性** — DDS計算をサーバーサイド(Cloud Run)からクライアントサイドWeb Workerに移行することで根本解決。ブラウザ上でWASMが安定動作し、サーバー負荷も軽減。
- **共有リンクからのログインページ露出** — 共有ページのエラー画面からログインリンクを削除。

### 現在の課題
- **モバイルUI** — モバイルレスポンシブ改善を試みたが不安定でリバート済み。再実装が必要。

---

## アーキテクチャ

### DDS計算の仕組み（クライアントサイド）
```
ブラウザ → useDDS.ts (Reactフック)
               ↓
          dds-client.ts (Web Worker管理)
               ↓
          Web Worker内で @bridge-tools/dd (WASM) を実行
               ↓
          トリック数を返却 → Firestoreにキャッシュ
```

- クライアントのブラウザ上でWASMを実行（サーバー負荷なし）
- Web Workerで分離実行（メインスレッドをブロックしない）
- 初回計算後はFirestoreにキャッシュ → 2回目以降は即時表示
- サーバーサイドAPIルート（/api/dds等）はフォールバックとして残存

### 自動プレイの仕組み
```
PlayAnalyzer コンポーネント
  ↓ (nextPlayerが自動プレイ対象側のターン)
  ↓ DDS解析完了
  ↓
defense-carding.ts → selectDefenseCard()
  ↓ 最善手が複数 → カーディング法則で1枚を選択
  ↓ (オープニングリード/リード/3rd hand high/フォロー)
  ↓
自動的にplayCard()を呼び出し（500msディレイ）
```

### スクレイピングの仕組み
```
ユーザーがURL入力 → /api/scrape
                       ↓
                 fitsys.ts (ASP.NETポストバック処理)
                       ↓
                 parser.ts (ハンド・トラベラーテーブルパース)
                       ↓
                 Firestoreに保存
```

- ASP.NETの`__VIEWSTATE`/`__EVENTVALIDATION`を再現
- リクエスト間隔500msで負荷制御
- MP/IMP/DAT形式を自動検出

### データ構造（Firestore）
```
config/
  access/
    - allowedEmails[] (登録許可メールアドレスリスト)

users/{uid}/
  tournaments/{tournamentId}/
    - name, date, pairNumber, scoringType, tags, memo, avgScore, shareToken
    - sessions[] (複数セッション)
    - pdfUrls[]
    boards/{boardNumber}/
      - hands (N/E/S/W × S/H/D/C)
      - travellers[] (トラベラーデータ)
      - ddsTable (DDSキャッシュ)
      - bidding[] (ビッド記録)
      - comment (コメント)
      - editHistory[] (編集履歴)
```

### Firestoreセキュリティルール
- `config/{doc}`: 読み取りのみ可（書き込みはFirebase Consoleから）
- `users/{userId}/tournaments`: 本人のみ読み書き可、shareTokenがあれば誰でも読み取り可
- `boards` サブコレクション: 親トーナメントのルールに準拠

---

## ファイル構成

```
bridge_reflection/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── dds/route.ts          # DDS API（フォールバック用）
│   │   │   ├── best-lead/route.ts    # ベストリードAPI
│   │   │   ├── play-analysis/route.ts # プレイ解析API
│   │   │   ├── scrape/route.ts       # スクレイピングAPI
│   │   │   └── share/route.ts        # 共有API
│   │   ├── tournaments/              # 大会関連ページ
│   │   ├── shared/                   # 共有リンクページ
│   │   ├── login/                    # ログイン
│   │   ├── register/                 # 登録
│   │   └── demo/                     # デモページ
│   ├── components/
│   │   ├── HandDiagram.tsx           # ハンド表示
│   │   ├── DDSTable.tsx              # DDS結果表示
│   │   ├── BestLead.tsx              # ベストリード表示
│   │   ├── PlayAnalyzer.tsx          # プレイ解析UI（自動プレイ機能含む）
│   │   ├── TravellerTable.tsx        # トラベラー表示
│   │   ├── BiddingBox.tsx            # ビッディングボックス
│   │   ├── WeaknessAnalysis.tsx      # 弱点分析
│   │   ├── PerformanceDashboard.tsx  # パフォーマンス
│   │   └── CommentEditor.tsx         # コメント編集
│   ├── hooks/
│   │   └── useDDS.ts                 # DDSフック（クライアントWASM + Firestoreキャッシュ）
│   ├── lib/
│   │   ├── bridge/
│   │   │   ├── types.ts              # 型定義
│   │   │   ├── pbn.ts                # PBN関連
│   │   │   ├── play-utils.ts         # プレイ解析ユーティリティ
│   │   │   ├── scoring.ts            # スコアリング計算
│   │   │   ├── defense-carding.ts    # カーディング法則ロジック
│   │   │   └── defense-carding.md    # カーディング法則ドキュメント
│   │   ├── scraper/
│   │   │   ├── fitsys.ts             # fitsys.jpスクレイパー
│   │   │   └── parser.ts             # HTMLパーサー
│   │   ├── dds-client.ts             # DDSクライアント（Web Worker管理）
│   │   ├── dds-inline.ts             # DDS計算ロジック（サーバーサイド）
│   │   ├── dds-single.js             # DDS単独計算
│   │   └── firebase.ts               # Firebase設定
│   └── contexts/
│       └── AuthContext.tsx            # 認証コンテキスト（許可リストチェック含む）
├── scripts/
│   └── setup-allowed-users.mjs       # 許可リスト初期設定スクリプト
├── dds-single-calc.js                # DDS単独計算（child process、フォールバック）
├── dds-worker-cli.js                 # DDS CLIワーカー（フォールバック）
├── next.config.ts                    # Next.js設定
├── package.json                      # 依存関係
└── .env.local                        # Firebase設定（非公開）
```

---

## 開発経緯メモ

### DDS計算のサーバー→クライアント移行
Cloud Run上で`@bridge-tools/dd`のWASMが不安定だった問題（メモリ汚染、プロセス間干渉）に対し、
複数のサーバーサイド対策（Worker Threads → child_process → リトライ → WASMバイナリコピー）を試みたが根本解決せず、
最終的にクライアントサイドWeb Workerに移行して解決。サーバーAPIはフォールバックとして残存。

### モバイルUI改善の試み
モバイルレスポンシブ改善とスワイプナビゲーションを実装したが、Reactフック順序の問題でアプリがクラッシュ。
リバートして安定版に戻した（commit f70be25）。再実装が必要。

### 推奨ビッド機能の試み
Gemini 2.5 Flash APIを使ったLLMベースの推奨ビッド機能を試みたが、精度が不十分＋レート制限の問題があり断念。
2/1 Game Forceシステムサマリー（bridge_system_all.md）は将来の再挑戦用に保存。

---

## 今後の検討事項
- モバイルレスポンシブ強化（プレイ解析のモバイル最適化）
- ボード間スワイプ（モバイル対応）
- PBNエクスポート
- サーバーサイドDDS APIの廃止検討（クライアントサイドで安定動作のため）
- 推奨ビッド機能の再挑戦（精度の高いモデル or ルールベースエンジン）
