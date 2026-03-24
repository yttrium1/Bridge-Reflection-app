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
| DDS解析 | @bridge-tools/dd (C++ DDS → WASM) |
| スクレイピング | Cheerio (HTMLパーサー) |
| ホスティング | Firebase App Hosting (Cloud Run) |

---

## 主な機能

### 実装済み
1. **ユーザー認証** — メール/パスワード + Googleログイン（Firebase Auth）
2. **大会データ自動取得** — fitsys.jpからスクレイピング（MP, IMP, DAT形式対応）
3. **ハンドダイアグラム表示** — 4方向のカード表示、ディーラー/バル表示
4. **ダブルダミー分析（DDS）** — 4方向×5デノミ=20セルのトリック数を計算、Firestoreにキャッシュ
5. **ベストリード解析** — ディフェンス側の最適リードを表示
6. **プレイ解析** — カードを1枚ずつプレイし、各カードの最適度を色分け表示
7. **ビッディングボックス** — ビッドの記録（P=Pass入力対応）
8. **コメント機能** — 各ボードにコメント追加（!S, !H, !D, !Cでスートマーク入力）
9. **共有リンク** — 未ログインユーザーへの閲覧共有（ゲスト編集可能、編集履歴あり）
10. **複数セッション管理** — 1大会に複数セッションを統合
11. **PDF結果アップロード** — Firebase Storageに保存
12. **大会タグ・メモ** — 大会にタグ（公式/練習等）やメモを付与
13. **弱点分析** — DDとの差が大きいボード自動抽出、Play/Defense別平均
14. **パフォーマンスダッシュボード** — 大会横断のMP%推移グラフ
15. **スコアリング対応** — MP%（マッチポイント）、IMP、DAT（データム）
16. **MP%自動計算** — fitsys.jpがMP%=0の場合、スコアから自動計算

### 現在の課題
- **Cloud Run上でのWASM安定性** — `@bridge-tools/dd`のWASMモジュールがCloud Run環境で不安定。リトライロジック（最大3回）で対応中だが、一部ボードで失敗することがある。ローカルでは問題なし。

---

## アーキテクチャ

### DDS計算の仕組み
```
フロントエンド → /api/dds (APIルート)
                    ↓
              dds-inline.ts (ハンド文字列変換・バリデーション)
                    ↓
              child_process.spawn("node", ["dds-single-calc.js"])
                    ↓
              @bridge-tools/dd (C++ DDS → WASM)
                    ↓
              トリック数を返却 → Firestoreにキャッシュ
```

- 1プロセス = 1セル（WASM状態汚染防止のため）
- DDSテーブルは20プロセスを順次実行
- 初回計算後はFirestoreにキャッシュ → 2回目以降は即時表示

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

---

## Cloud Run 環境の問題点

### WASM安定性の問題
`@bridge-tools/dd`はBo HaglundのDDSライブラリをEmscriptenでWASMにコンパイルしたもの。

**問題:**
- 同一プロセス内で連続呼び出しするとWASMのグローバルメモリが汚染される
- `require.cache`クリアで回避できるがCloud Runでは不安定
- 別プロセスでも連続起動すると失敗するケースがある

**現在の対策:**
- 1プロセス = 1計算（完全な状態隔離）
- 失敗時リトライ（最大3回、500ms→1000ms間隔）
- WASMバイナリの自動コピー（`wasm/compiled.wasm` → `dist/compiled.wasm`）

**検討中の代替案:**
1. 外部DDS APIサービスを利用（例: Bridge Solver API）
2. Cloud Functionsに分離（WASMの安定性が高い可能性）
3. ローカルで計算してFirestoreにキャッシュ（サーバー計算を廃止）

---

## ファイル構成

```
bridge_reflection/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── dds/route.ts          # DDS API
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
│   │   ├── PlayAnalyzer.tsx          # プレイ解析UI
│   │   ├── TravellerTable.tsx        # トラベラー表示
│   │   ├── BiddingBox.tsx            # ビッディングボックス
│   │   ├── WeaknessAnalysis.tsx      # 弱点分析
│   │   ├── PerformanceDashboard.tsx  # パフォーマンス
│   │   └── CommentEditor.tsx         # コメント編集
│   ├── hooks/
│   │   └── useDDS.ts                 # DDSフック（キャッシュ対応）
│   ├── lib/
│   │   ├── bridge/types.ts           # 型定義
│   │   ├── scraper/fitsys.ts         # fitsys.jpスクレイパー
│   │   ├── scraper/parser.ts         # HTMLパーサー
│   │   ├── dds-inline.ts             # DDS計算ロジック
│   │   └── firebase.ts               # Firebase設定
│   └── contexts/
│       └── AuthContext.tsx            # 認証コンテキスト
├── dds-single-calc.js                # DDS単独計算（child process）
├── dds-worker-cli.js                 # DDS CLIワーカー
├── next.config.ts                    # Next.js設定
├── package.json                      # 依存関係
└── .env.local                        # Firebase設定（非公開）
```

---

## 今後の検討事項
- モバイルレスポンシブ強化（プレイ解析のモバイル最適化）
- ボード間スワイプ（モバイル対応）
- 推奨ビッド機能（2/1 Game Force対応、LLMベース）
- PBNエクスポート
- Cloud RunでのWASM安定性の根本解決
