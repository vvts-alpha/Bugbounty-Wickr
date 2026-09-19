# Wickr research workspace

報告提出済み。疲れたあとの地図。

ルートは入口と、いま使うものだけ。調査資産は `platforms/` / `labs/` / `artifacts/` / `archive/` に寄せた。ファイルは消していない（移動のみ）。

## Top-level

| Path | 中身 |
|------|------|
| `ENGAGEMENT-OBJECTIVE.md` | 現行エンゲージメントの北の星 |
| `reports/` | **提出・要約の入口**（H1 本文コピー + `evidence/`） |
| `poc/` | 現行 Linux PoC（W93 xcalc）。パス互換のためルートに残す |
| `scratch/` | 波作業（w3〜w93）。スクリプトがこのパスを直書きしているのでルートに残す |
| `platforms/desktop/` | Desktop 調査（notes / harness / amplify-probe / binaries） |
| `platforms/android/` | Android 調査（reports / pocs / scripts / dumps / apk …） |
| `platforms/linux/` | Linux snap 抽出 `sq/`、ばらダンプ `dumps/`、転送パック `toLinux/` |
| `platforms/mac/` | macOS インストーラ（dmg） |
| `labs/r2s-lab/` | React2Shell 学習ラボ（独自 git → GitHub `vvts-alpha/r2s-speedtest-lab`） |
| `artifacts/wickr/` | Desktop 抽出ソース・RCC 等（大きい・触らない） |
| `archive/r2s-lab-meta/` | 旧 `labs/r2s-lab` 残骸（`vulnerable/` なし） |
| `tools/` | 小物ユーティリティ |

## いちばん見る場所

- Desktop H1（提出済み）: `reports/H1-report-wickr-desktop-docx-wickrweb-exfil.md`
- Android H1: `reports/H1-report-wickr-docx-preview.md`
- Desktop 深掘りメモ: `platforms/desktop/notes/`（`WAVE2-A-CSP-BYPASS-FINAL.md` など）
- Amplify オリジン probe: `platforms/desktop/amplify-probe/`
- CSP harness: `platforms/desktop/harness/`
- R2S ラボ: `labs/r2s-lab/vulnerable/`
- 現行 PoC: `poc/`
- 全体サマリー（Wave 表）: `reports/wickr-engagement-summary.canvas.tsx`（チャット横の Canvas からも開ける）

## メモ

- `scratch/` の波フォルダは動かしていない。過去メモ内の古いパス（`desktop/notes/` など）も未改訂。生きた地図はこの README。
- ルートにあった同名 `.obj` / `.log` は、先住ファイルと中身が違うものだけ `-from-root` サフィックスで隣に置いた（`scratch/w67/w67-from-root.obj` など）。
- 波不明のオブジェクトは `scratch/_obj-dumps/`、ログは `scratch/_logs/`。
