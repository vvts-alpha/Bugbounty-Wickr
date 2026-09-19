# RUNBOOK — 被害者機（4032MB, 空きコミット 1524 MiB）

渡すファイルは **`victim_probe.exe` 1 本だけ**。Python もハーネスも不要。`/MT` ビルドなので
VC ランタイムの導入も不要。管理者権限も不要（同一ユーザーのプロセスにアタッチするだけ）。

## 0. 事前確認（1 回だけ）

WickrPro を起動してログインし、**通話はまだ始めない**状態で:

```
victim_probe.exe --verify
```

期待される出力:

```
[+] auto-detected WickrPro.exe PID nnnn
===== victim_probe: PID nnnn  NPL.dll=0x......  =====
    S1 vp8_alloc_frame_buffers ENTRY   @0x...... : 48 89 5c 24 08   (ORIGINAL)
    S2 ALLOCATION FAILURE TAIL         @0x...... : b8 01 00 00 00   (ORIGINAL)
[+] --verify: sites match, exiting without patching
```

* `(ORIGINAL)` が 2 つ出れば OK。
* `*** MISMATCH ***` が出たら**そこで止める**（NPL のビルドが想定と違う）。パッチは当たりません。
* `WickrPro.exe not running` なら起動してから。PID を明示したい場合は `victim_probe.exe 1234`。

## 1. 本番

```
victim_probe.exe
```

`[+] ARMED.` が出たら**通話を受ける**。あとは攻撃者機から送信するだけ。
終了は **Ctrl+C**（フックを自動復元します。復元 OK のメッセージを確認してください）。

ログは実行ディレクトリの **`victim-probe.log`** に追記されます。これを回収してください。

## 2. 何が出れば成功か

### 第1段 — ゲートが開いたか

```
alloc: request 16383x16383   PRE-FREE mip=0x...... mi=0x......  old geom 4x4

*** ALLOCATION FAILED -- F4-2 GATE OPEN ***
    pc=0x......  pc->mip=0x0 (NULLed by de_alloc)  pc->mi=0x...... (DANGLING)
```

`pc->mip=0x0` かつ `pc->mi` が非ゼロ、これが F4-2 の dangling 状態です。

**注意 — `invocations=0` と `FAILURES=0` は意味が違います。**

| 出力 | 意味 |
|---|---|
| `invocations=N (N>0)` かつ `FAILURES=0` | 関数は動いたが確保は成功した = **ゲートが開かなかった**（有意な否定） |
| `invocations=0` かつ `FAILURES=0` | 関数がそもそも動いていない = **データなし**（否定ではない） |

`invocations=0` のままなら、被害者がまだ映像を購読していない可能性が高いです。通話で
**映像を有効**にしてください（音声だけでは VP8 デコーダが作られません）。

### 第2段 — 何がブロックを再取得したか

失敗の直後に同じブロックが 4 回ダンプされます（`t+0ms` / `t+200ms` / `t+1s` / `t+3s`）。

```
    freed block base = 0x......, size 1923 B (old geom 4x4)
    mi sits 456 bytes into it
    [dump t+0ms] 0x......  1939 bytes (16 before the block included)
         -16 ....
         +16 ....
```

オフセットは**ブロック先頭からの相対**で、`-16` はヒープヘッダ側です。
4 つのダンプを差分すれば、解放後に何が入ってきたかが見えます。解析はこちらでやるので、
**ログをそのまま送ってもらえれば十分**です（ダンプ中の vtable ポインタは
`class_vtable.py` でクラス名に解決します）。

## 3. 事故対応

* **Ctrl+C を押す前に落ちた場合** — フックは復元されませんが、書き換えたのは NPL.dll の
  **メモリ上のコピーだけ**です。ディスク上のファイルは一切変更していません。WickrPro を
  再起動すれば元に戻ります。
* **WickrPro が固まる/重くなる** — 想定内です。巨大キーフレームが空きコミット 1524 MiB の
  機械に約 2 GiB を要求し、Windows がそれを捌いて拒否するまでの間ハングします。
  これは F4-2 の前段（F4-3）が単体で DoS であることの現れです。
* **第3段では WickrPro が落ちます** — 想定通りです。第1段・第2段では落ちません。

## 4. やらないこと

* 通話中に `victim_probe.exe` を起動/停止しない（フック設置時に全スレッドを一瞬止めるため、
  リアルタイム経路に触れます）。**通話前にアーム、通話後に Ctrl+C。**
* ログを消さない（追記式なので複数回の試行が 1 ファイルに残ります）。
