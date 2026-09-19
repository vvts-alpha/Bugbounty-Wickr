# React2Shell 学習ラボ（ローカル専用）

**目的:** CVE-2025-55182 / Next.js CVE-2025-66478 を **自分のマシン上だけ** で理解する。  
**禁止:** `main.d4zeeqgazhley.amplifyapp.com` や他人のサイトへの攻撃。Wickr 報告とは切り離す。

---

## 何が壊れているか（概念）

| 項目 | 内容 |
|---|---|
| 通称 | React2Shell |
| CVE | React `CVE-2025-55182` / Next.js `CVE-2025-66478` |
| 場所 | React Server Components の Flight / RSC プロトコル（不安全なデシリアライズ） |
| 典型条件 | Next.js **App Router** + 影響版 React 19 RSC（デフォルトの `create-next-app` でも該当しうる） |
| 結果 | 未認証に近い形で **サーバ上の RCE** |
| 修正例 | Next 15.0.x → **15.0.5+**（系によって異なる。公式表を見ること） |

読むとよい公式・解説:

- https://vercel.com/changelog/cve-2025-55182  
- https://nextjs.org/blog/CVE-2025-66478 （または security-update 系）  
- https://www.wiz.io/blog/critical-vulnerability-in-react-cve-2025-55182  

---

## ラボ構成

```
r2s-lab/
  vulnerable/   # next@15.0.2 + Speed Test UI（Amplify クローン風）
  README.md
```

`vulnerable` の見た目は Wickr が iframe する  
`https://main.d4zeeqgazhley.amplifyapp.com/`（Speed Test）に寄せてある。  
フッターに LOCAL LAB と明示。**本番ホストではない。**

---

## セットアップ

### 1. 脆弱アプリ

```powershell
cd e:\tmp\wickr\r2s-lab
npx --yes create-next-app@15.0.2 vulnerable --ts --eslint --app --src-dir --no-tailwind --import-alias "@/*" --use-npm --yes
cd vulnerable
npm install next@15.0.2 react@19.0.0 react-dom@19.0.0
npm run build
npm run start -- -H 127.0.0.1 -p 3000
```

（`create-next-app@15.0.2` が取れない場合は最新 create で作ってから `npm install next@15.0.2` にピン留め。）

### 2. 修正済みアプリ（対照）

```powershell
cd e:\tmp\wickr\r2s-lab
npx --yes create-next-app@15.0.5 patched --ts --eslint --app --src-dir --no-tailwind --import-alias "@/*" --use-npm --yes
cd patched
npm install next@15.0.5
npm run build
npm run start -- -H 127.0.0.1 -p 3001
```

### 3. スキャナ（既に持っている Assetnote 製）

```bash
cd ~/react2shell-scanner
source .venv/bin/activate   # or Windows venv
python3 scanner.py -u http://127.0.0.1:3000/ -v
python3 scanner.py -u http://127.0.0.1:3001/ -v
```

期待:

| ターゲット | 期待 |
|---|---|
| `:3000` vulnerable | `VULNERABLE` |
| `:3001` patched | `Not vulnerable` / エラー扱いで落ちる |

WAF 無しのローカルなので `--waf-bypass` は不要なことが多い。

---

## 学習チェックリスト

1. [ ] App Router のどのリクエストが RSC / Server Action 系か（DevTools Network の `text/x-component` 等）  
2. [ ] スキャナが「何を見て VULNERABLE と判断しているか」（ステータス・ヘッダ）  
3. [ ] パッチ版で同じプローブがどう変わるか  
4. [ ] （任意）公式 advisory の影響パッケージ名 `react-server-dom-*` を `npm ls` で確認  
5. [ ] Wickr 文脈との切り分け: **R2S = サーバRCE**。デスクトップ報告の本丸は **クライアントが許可オリジンJSから `wickrweb://` を読むこと**

---

## やっていいこと / だめなこと

| OK | NG |
|---|---|
| 127.0.0.1 の自分の lab | 本番 Amplify / 他人の Next |
| スキャナ・読取専用マーカー | 永続化・暗号通貨マイナー・横展開 |
| パッチ前後の差分理解 | 「Wickr用に脆弱サイトを Amplify にデプロイして frame する」← CSP が別ホストを拒否するので無意味かつ危険 |

---

## Wickr 報告との関係（再掲）

自分の Amplify に脆弱アプリを上げても、Wickr の `frame-src` は  
`https://main.d4zeeqgazhley.amplifyapp.com/` **だけ**なので iframe されない。  
チェイン検証は **hosts 疑似**が正解。このラボは **R2S 単体の勉強用**。

---

## Amplify で 404 になるとき

ログで `npm ci` / `npm run build` まで進んでいても、**プラットフォームが静的 Web** だと `.next` を静的配信しようとして **404** になる。

1. Amplify Console → ホスティング → **Next.js - SSR（Web Compute）** であること  
2. アプリのルートディレクトリ = **`vulnerable`**  
3. ビルドコマンド = `npm run build`、成果物 = `.next`  
4. リポジトリ直下の `amplify.yml`（`appRoot: vulnerable`）を使う  
5. Node 20 系（`engines` 指定済み）  

公開デプロイは **脆弱版のまま世界に晒す**ので非推奨。勉強はローカルで足りる。
