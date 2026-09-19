# Amplify オリジン疑似プローブ（本番サーバ非接触）

`frame-src` はホスト名が  
`https://main.d4zeeqgazhley.amplifyapp.com/` と一致することだけ要求する。  
**IP 先が AWS である必要はない。**

Wickr 本体は証明書エラーを握りつぶす:

```
onCertificateError: function(error) { error.acceptCertificate(); }
```

⇒ hosts で名前を 127.0.0.1 に向け、ローカル自己署名 HTTPS を返せば、  
ブラウザ上の origin は本番と同じまま、**中身は自分のプローブページ**になる。AWS には届かない。

```
DOCX / CheckSpeedModal
  → iframe https://main.d4zeeqgazhley.amplifyapp.com/
  → hosts → 127.0.0.1
  → ローカル TLS（自己署名・acceptCertificate）
  → probe.html の JS
  → fetch('wickrweb://…')  ※ここが検証対象
```

R2Sで本番レスポンスを書き換える必要はない（使えるが、本手順の方が安全）。

---

## 手順（Windows）

### 1. hosts

管理者のメモ帳等で `C:\Windows\System32\drivers\etc\hosts` に:

```
127.0.0.1  main.d4zeeqgazhley.amplifyapp.com
```

終了後は必ず行を消すかコメントアウト。

### 2. 証明書（一度だけ）

```powershell
cd e:\tmp\wickr\amplify-origin-probe
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 3 -nodes -subj "/CN=main.d4zeeqgazhley.amplifyapp.com"
```

OpenSSL が無ければ Git 付属か、下記 Python スクリプトが自動生成する。

### 3. サーバ起動

```powershell
cd e:\tmp\wickr\amplify-origin-probe
python serve.py
```

`https://main.d4zeeqgazhley.amplifyapp.com/` で probe を返す（ポート 443 は管理者権限が必要なことが多い → その場合は `serve.py` の PORT=8443 と、iframe を `:8443` 付きにするか、ポート 443 で管理者実行）。

**注意:** ブラウザの URL にポートが付くと origin が変わる。  
`frame-src` は `https://main.d4zeeqgazhley.amplifyapp.com/`（デフォルト443）の完全一致寄り。  
**可能なら 443 で listen**（管理者 PowerShell）。8443 だと CSP で iframe が弾かれる可能性が高い。

### 4. Wickr 側の出し方（どれか）

**A. CheckSpeedModal（DOCX不要・簡単）**  
ベータメニュー等から Custom speed test → amplify URL を開く。

**B. DOCX 注入**  
`renderSymbol` / altChunk で  
`<iframe src="https://main.d4zeeqgazhley.amplifyapp.com/"></iframe>`

**C. リモートデバッグ**  
`QTWEBENGINE_REMOTE_DEBUGGING=9222` で iframe 内コンソールを確認。

### 5. 判定（probe が画面と console に出す）

| 結果 | 意味 |
|---|---|
| `fetchOk` + `bodyLen>0` + 読める prefix | **Chain B OPEN** → ゴール達成可能 |
| CORS / Failed to fetch / opaque | Chain B CLOSED（このオリジンからは読めない） |
| `typeof qt !== 'undefined'` | 異オリジンでも bridge 可視（別 Critical） |

**プローブは画面表示と console のみ。外部送信しない。**

### 6. 片付け

- `serve.py` 停止  
- hosts の行を削除  
- Wickr 再起動（DNSキャッシュ残る場合あり）

---

## R2S との比較

| 方法 | 本番AWS | origin 一致 | 推奨 |
|---|---|---|---|
| hosts + ローカル HTTPS | 触らない | する | **第一選択** |
| mitmproxy でレスポンス置換 | TLSは本番に張りうる | する | 可だが不要 |
| R2S で HTML 注入 | 触る | する | 最終手段・読取専用マーカーのみ |

---

## mitmproxy 案（参考）

hosts が使えない環境向け。上流を本物 amplify にしつつ、`/` のボディだけ probe に差し替え。  
証明書は Wickr が accept するので mitm CA も通りやすい。  
それでも **リクエストは一度 AWS に行く**ので、hosts 方式の方がきれい。
