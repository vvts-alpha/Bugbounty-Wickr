# Amplify 404 直し（現行アプリ: d27ei37ojkg8zt / us-east-1）

実測: `https://main.d27ei37ojkg8zt.amplifyapp.com/` → **404**  
ヘッダ: `Server: AmazonS3` + CloudFront

→ **静的 Web (S3)** として配信されている。Next SSR は動かない。  
必要: **WEB_COMPUTE** + framework **Next.js - SSR**

リージョンはコンソール表示どおり **米国 (バージニア北部) = us-east-1**。

## 1. AWS CLI（必須）

CloudShell でも可（コンソール右下）。

```bash
aws amplify update-app \
  --app-id d27ei37ojkg8zt \
  --platform WEB_COMPUTE \
  --region us-east-1

aws amplify update-branch \
  --app-id d27ei37ojkg8zt \
  --branch-name main \
  --framework "Next.js - SSR" \
  --region us-east-1
```

確認:

```bash
aws amplify get-app --app-id d27ei37ojkg8zt --region us-east-1 --query 'app.platform'
# → "WEB_COMPUTE" であること

aws amplify get-branch --app-id d27ei37ojkg8zt --branch-name main --region us-east-1 --query 'branch.framework'
# → "Next.js - SSR" であること
```

## 2. 環境変数（モノレポ）

Hosting → Environment variables:

| Key | Value |
|---|---|
| `AMPLIFY_MONOREPO_APP_ROOT` | `vulnerable` |

## 3. Redeploy

Hosting → main → **Redeploy this version**

成功時の目安:
- デプロイが **数秒ではなく** Compute 寄りの処理になることが多い
- `curl -sI https://main.d27ei37ojkg8zt.amplifyapp.com/` の `Server:` が **AmazonS3 ではない**
- ページ本体が 200 で返る

## 補足

ビルドログの `✓ Compiled successfully` は「コンパイル成功」だけで、**SSR ランタイムが有効かは別問題**。  
デプロイが **2 秒** で終わるのも、静的 zip を S3 に置いただけの典型パターン。
