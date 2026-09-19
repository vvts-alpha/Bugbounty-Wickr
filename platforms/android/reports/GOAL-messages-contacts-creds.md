# Goal: メッセージ / 連絡先 / awsCredentials 読取

**対象:** Wickr Desktop 6.72.20（Qt WebEngine 6.9.2 / Chromium 130）  
**ゴール:** 攻撃者サーバへ exfil、または少なくとも応答ボディを攻撃者JSから読めること  
**対象ルート（すべて GET・追加認可ヘッダなし）:**

| ゴール | URL | 応答 |
|---|---|---|
| 連絡先 | `wickrweb://contacts/contacts` | protobuf `UserCollection` |
| 認証情報 | `wickrweb://awsCredentials` | JSON `{ awscredentials: … }` |
| メッセージ | `wickrweb://message/:convoId` または `…/:convoId/:msgId` | protobuf |
| （補助）自己 | `wickrweb://users/self` | protobuf |

根拠: `src/apis/webFetch/fetchInternal.ts`（`getContactsInternal` / `getAwsCredentialsInternal` / `getMessagesInternal`）。ハンドラに initiator 検査なし（WAVE2）。

---

## 到達に必要なもの（1行）

**応答ボディを読める JS 実行コンテキスト**が必要。宣言的 `<img>` ではゴール不可。

---

## 攻撃ツリー（ゴール専用）

```
DOCX HTML injection (確認済)
│
├─[A] 同一オリジン(qrc)で攻撃者JS ──► fetch(wickrweb://…) 読取 ──► exfil
│     障壁: script-src 'self' qrc://* （現状 CLOSED）
│     潜在: altChunk→srcdoc + CSP回帰 = Critical
│
├─[B] amplify iframe + R2S JS ──► fetch(wickrweb://…) 読取？ ──► exfil
│     理論: OPEN候補（R2S + CorsEnabled推定）
│     実証: 本番Amplify非使用のため保留 → スキームflags静的解析で代替判定
│
├─[C] postMessage / WebChannel / MCP from amplify
│     CLOSED（originゲート / SOP / InMemoryTransport）
│
└─[D] 宣言的 GET / 画面表示のみ
      CLOSED for exfil（ボディ読めない）
```

---

## Chain B の静的見立て（Amplify無しでも言えること）

アプリ本体は **`qrc:` ページから `fetch('wickrweb://…')` で日常的にデータ取得**している（異スキーム＝異オリジン）。

Qt 6 ドキュメント:

- **`CorsEnabled`**: 異オリジン文書からそのスキームをロードするのに**必須**。有効時 CORS ヘッダを自動生成。
- **`FetchApiAllowed`** (Qt 6.6+): カスタムスキームへの Fetch に必要。Wickr は Qt 6.9.2。

⇒ flags 次第では amplify 経路も読取可能、だが **本番を触らずに実証しない**。次はネイティブの `setFlags` 復元。

---

## 閉じた経路（ゴールには使えない）

| 経路 | 理由 |
|---|---|
| `/preview-file/` ポリグロット | デスクトップに無し。`script-src` に `wickrweb` も無し |
| `frame-src` で `wickrweb://awsCredentials` | `frame-src` が wickrweb 除外 |
| img/CSS で credentials GET | ボディ不透明 |
| parent.postMessage | openLink のみ・データ返信なし |
| `qt` / QWebChannel from amplify | SOP |
| MCP `getContacts` / `getMessages` | メインアプリ・InMemory のみ。プレビューから不可 |
| `fetch.worker` ハイジャック | コントローラ参照に同一オリジンJSが先に必要 |

---

## 制約と疑似テスト

本番 Amplify を改変しなくてもよい。**hosts + ローカル HTTPS** で同名オリジンを疑似できる（Wickr が `acceptCertificate()` するため自己署名で可）。

手順・サーバ: [`../amplify-origin-probe/README.md`](../amplify-origin-probe/README.md)

R2Sで本番HTMLを差し替える手段もあるが、hosts 疑似の方が AWS 非接触。

`frame-src` はホスト名固定のため `https://localhost` では代替不可。**名前を奪う**必要がある。

---

## Amplify無しでゴールを詰める順序

### 1. 静的: `wickrweb` スキームフラグ復元（最優先・本番不要）

`QWebEngineUrlScheme::registerScheme` / `setFlags` をネイティブから読む。

| フラグの組み合わせ | Chain B 予測 |
|---|---|
| `CorsEnabled` + `FetchApiAllowed`（アプリ動作から有力）かつ CORS が Origin 反映 | amplify 経路は **理論上 OPEN** → 報告は「未実行・要ベンダー検証」まで |
| `LocalScheme` で https から遮断 | Chain B **CLOSED** → ゴールは同一オリジンJS（Chain A）のみ |
| `FetchApiAllowed` 無し | amplify から fetch 不可 → **CLOSED** |

これで「Amplifyを触らずに」Chain B を OPEN候補 / 死亡に振り分けられる。

### 2. ローカル再現ハーネス（任意・自分のマシンだけ）

最小 Qt WebEngine アプリで:

- `wickrweb` 相当スキームを **Wickrと同じ flags** で register  
- ダミーハンドラが contacts/creds JSON を返す  
- 親ページCSPを Wickr meta と同一にし、子を `https://127.0.0.1:PORT`（frame-src に一時追加した実験ビルド）または別プロファイルで fetch  

Stock Wickr の RCC/CSPを書き換えるのは改変クライアント扱いに注意。報告には「ベンダー再現手順」として書く。

### 3. Chain A 再フォーカス（Amplify不要）

ゴール達成の本線を **qrc 上の攻撃者JS** に戻す:

- altChunk → srcdoc（単一障壁 = CSP）  
- `'self'` / `qrc` リフレクタ・JSONP・chunk 汚染の再探索  
- DOMPurify無し DOCX 経路の別 exec ガジェット  

ここが割れれば `fetch(wickrweb://…)` は **既にアプリが証明済み**（追加の異オリジン問題なし）。

### 4. 報告フレーミング（Amplify未使用時）

| 言えること | 言えないこと |
|---|---|
| DOCX→HTML注入、同一オリジン非sandbox iframe | 本番で creds を読んだ |
| ゴール用 wickrweb GET がヘッダ無しで存在 | Chain B の実 exfil |
| qrc→wickrweb fetch は正規機能として成立 | amplify→wickrweb 読取の実証 |
| Chain B は frame-src+R2Sで理論接続、flags次第 | Critical 確定 |

---

## （参考）Amplify解禁後のプローブ ※今は実施しない

読取専用・自アカウント・外部送信なし、の条件が揃ってから。判定表は旧版と同じ（`bodyLen>0` → Critical）。

---

## 成功時の最小 PoC ストーリー（報告用・理論）

1. 悪意 DOCX プレビュー  
2. （A）qrcで攻撃者JS **または** （B）許可オリジン上の攻撃者JS  
3. `fetch('wickrweb://awsCredentials'|contacts|message/…)`  
4. 応答読取 → exfil  

影響: クライアント側平文メッセージ・連絡先・クラウド認証情報。

---

## 現状ステータス — **Chain B 実証済み (2026-07-27)**

hosts + ローカル HTTPS 疑似オリジン（本番 AWS 非接触）で DOCX プレビュー経由:

| プローブ | 結果 |
|---|---|
| `origin` | `https://main.d4zeeqgazhley.amplifyapp.com` |
| `wickrweb://users/self` | **200, bodyLen≈300, protobuf 読取可** |
| `wickrweb://contacts/contacts` | **200, bodyLen≈285, protobuf 読取可** |
| `wickrweb://awsCredentials` | 同スクショ続きで確認推奨（同条件なら通る想定） |
| `parent.location` オブジェクト | 異オリジンでも参照できることあり → **誤検知**. `parent.location.href` が真の SOP 判定 |

**結論:** DOCX HTML 注入 → 許可 frame-src オリジン上の攻撃者 JS → `fetch(wickrweb://…)` で **連絡先・自己ユーザ情報の読取が成立**。メッセージ / awsCredentials も同一データ面。exfil は攻撃者オリジンから任意外部へ送れる構造。

| 項目 | 状態 |
|---|---|
| ゴール（連絡先 / self） | **達成（読取実証）** |
| awsCredentials / message | 同チェーン・要1行確認 |
| Critical 報告 | **可**（hosts 疑似 = 実攻撃では R2S/正規XSSで同 origin） |
| parent SOP 突破 | **未証明**（プローブバグ修正済み） |
