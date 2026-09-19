import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
} from "cursor/canvas";

type Plat = "all" | "win" | "linux" | "android" | "mac";
type Tone = "success" | "danger" | "warning" | "info" | "neutral";

type RowItem = {
  plat: Exclude<Plat, "all">;
  id: string;
  status: string;
  why: string;
  evidence: string;
  tone: Tone;
};

const PLATS: { id: Plat; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "win", label: "Windows" },
  { id: "linux", label: "Linux" },
  { id: "android", label: "Android" },
  { id: "mac", label: "macOS" },
];

const ITEMS: RowItem[] = [
  {
    plat: "android",
    id: "WickrAPI exported IPC",
    status: "静的確定・既定 fail-closed",
    why: "awsRelease は ServerConfig ハンドラ。enableAtak 既定 false、allowlist 既定空。UID 非束縛と extra≠protobuf は ATAK 有効ネットワークでの残差。",
    evidence: "WickrAppContext.Impl / WickrConfig.Field / WickrAPIManager",
    tone: "warning",
  },
  {
    plat: "win",
    id: "CVE-2025-9479",
    status: "ソース PASS・実行未確認",
    why: "pinned escape-analysis.cc の kStoreField に kTrustedHeapConstant ガード無し。pure-JS。出荷エンジンでは未走行。",
    evidence: "scratch/w46/pinned/escape-analysis.cc:620",
    tone: "danger",
  },
  {
    plat: "win",
    id: "CVE-2025-6555",
    status: "G2 PASS・ツリー未確認",
    why: "W36 は PASS。このワークスペースに PropertyRegistry / RemoveDeclaredProperties のコピーが無い。",
    evidence: "platforms/desktop/notes/W36-CVE-HUNT-RANKED.md",
    tone: "warning",
  },
  {
    plat: "win",
    id: "wickrweb:// 13 API + meetings",
    status: "列挙済み・到達性 TBD",
    why: "ディスパッチに認証なし。same-origin なら chimetoken / contacts / message / myaccount/password / verification。W44 は awscredentials のみ。",
    evidence: "scratch/w78/W78-STATUS.md §10",
    tone: "warning",
  },
  {
    plat: "linux",
    id: "getAwsCredentials / wickrweb",
    status: "文字列確認済み",
    why: "snap WickrPro 79.5MB。wickrweb:// 46、getAwsCredentials×6、awscredentials / chimetoken / myaccount/password。Windows より admin/controls 等が追加。",
    evidence: "platforms/linux/sq/usr/bin/WickrPro",
    tone: "warning",
  },
  {
    plat: "android",
    id: "送信者 MIME + URI grant",
    status: "静的確認・未提出",
    why: "enableFileDownload=true のとき外部 Viewer へ AttachmentMetaData.getMimeType() と FLAG_GRANT_READ_URI_PERMISSION。",
    evidence: "platforms/android/dumps/preview-route-disassembly.txt",
    tone: "warning",
  },
  {
    plat: "android",
    id: "preview-file ACAO *",
    status: "提出の隣接・未記載",
    why: "FilePreviewWebViewClient が Access-Control-Allow-Origin: *。同一 WebView の Amplify frame から添付バイトを CORS で読める可能性。",
    evidence: "platforms/android/dumps/handle-method-disassembly.txt",
    tone: "info",
  },
  {
    plat: "android",
    id: "登録 / SSO deeplink",
    status: "ATO にはならない",
    why: "ログイン中はほぼ無視。forgot-password は username 一致のみ。SSO は AppAuth へ URI 転送。redirect_uuid 塩あり。",
    evidence: "RegistrationLinkActivity / SSOAuthManagementActivity",
    tone: "success",
  },
  {
    plat: "win",
    id: "link-preview 経路",
    status: "Web 面の最後の未探索",
    why: "W16d は docx 以外の HTML injection を否定。残る非重複リードは linkFavIconAdded / linkImageAdded。",
    evidence: "NEXT-HUNT-BRIEF.md W16d",
    tone: "info",
  },
  {
    plat: "win",
    id: "Qt6Gui 画像コーデック",
    status: "未サーチ",
    why: "qtiff/qgif/qico/qtga/qwbmp/libpng/libwebp が通常 CRT ヒープ。メッセージピア位置で F1 ゲート不要。",
    evidence: "NEXT-HUNT-BRIEF.md W15 追記 (ii)",
    tone: "warning",
  },
  {
    plat: "win",
    id: "PDFium / FreeType / Qt6Pdf",
    status: "版ピン未完",
    why: "PDFium は Chromium-130 スナップショット。Qt 139 backport が届いたか未確定。本体プロセス・CFG 無し。",
    evidence: "W13-ENGAGEMENT-MAP.md §3.3",
    tone: "info",
  },
  {
    plat: "win",
    id: "Sock5 SQL 連結",
    status: "未 chase",
    why: "SELECT VALUE FROM VtcData WHERE KEY = の連結。SETUPAPI は DEAD。トンネルは stock で OFF。",
    evidence: "W7 / W78 / NEXT-HUNT-BRIEF #5",
    tone: "info",
  },
  {
    plat: "win",
    id: "destructTime / room TTL",
    status: "部分調査",
    why: "受信側が maxMessageTTL を再検証するか未解決。WickrSecureRoomMgr::changeTTL。",
    evidence: "W13-ENGAGEMENT-MAP.md §3.5",
    tone: "info",
  },
  {
    plat: "win",
    id: "ignoreSslErrors @ 0x140c2e893",
    status: "1 サイト残差",
    why: "他サイトは pin validator。ここだけ per-error フラグ。誰が立てるか未特定。",
    evidence: "W13-ENGAGEMENT-MAP.md §3.6",
    tone: "info",
  },
  {
    plat: "win",
    id: "metricsEventQueue drain",
    status: "保存は既報・送信先未接続",
    why: "平文アカウント識別子の保存は F5d。drain 先 URL が未接続。",
    evidence: "W13-ENGAGEMENT-MAP.md §3.5",
    tone: "neutral",
  },
  {
    plat: "linux",
    id: "snap 配布品質 / plugs",
    status: "設定確認",
    why: "本番に Qt tests ~344MB。home / password-manager-service / removable-media。CET/IBT 無し。MLS so は PARTIAL RELRO。",
    evidence: "platforms/linux/sq/meta/snap.yaml",
    tone: "warning",
  },
  {
    plat: "linux",
    id: "WickrUtil::ignoreSslErrors",
    status: "シンボルのみ",
    why: "mangled シンボルあり。呼び出し条件と本番有効化は未確認。",
    evidence: "platforms/linux/sq/usr/bin/WickrPro",
    tone: "neutral",
  },
  {
    plat: "mac",
    id: "App Sandbox false + renderer entitlements",
    status: "メモのみ",
    why: "Chromium seatbelt は ON（Linux と逆）。com.apple.security.app-sandbox=false。中身の NPL/V8 は未サーチ。",
    evidence: "scratch/mac/STATUS.md",
    tone: "info",
  },
  {
    plat: "win",
    id: "CVE-2026-8554 武器化",
    status: "oracle 済み・D3D11 では死",
    why: "型混乱は live。D3D11 OutputHLSL が float[] 固定のため host OOB は到達不能。",
    evidence: "scratch/w60/STATUS.md, scratch/w70/W70-STATUS.md",
    tone: "success",
  },
];

export default function WickrLeftoverVulnHunt() {
  const [plat, setPlat] = useCanvasState<Plat>("plat", "all");
  const rows = ITEMS.filter((x) => plat === "all" || x.plat === plat);

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <H1>残件脆弱性ハント</H1>
        <Text tone="secondary">
          正規 BBP（HackerOne #3895069）。Android 6.72.5 / Desktop 6.72.20 の手元抽出物の静的読み。
          PoC・攻撃手順は書いていない。調査日 2026-08-13。
        </Text>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value="fail-closed" label="WickrAPI 既定（awsRelease）" tone="success" />
        <Stat value="UID 非束縛" label="ATAK 有効時の残差" tone="warning" />
        <Stat value="確認" label="Linux wickrweb / AWS creds" tone="warning" />
        <Stat value="未走行" label="CVE-2025-9479 出荷エンジン" tone="danger" />
      </Grid>

      <Callout tone="warning" title="今回の静的調査で確定したこと">
        バニラ Wickr Pro では WickrAPI は閉じている。ハンドラは常時許可の
        BuildConfig ではなく ServerConfig。サーバが enableAtak と
        atakPackageValues を載せたネットワークだけが IPC 面になる。そのときも
        呼び出し元 UID は見ない。Linux 本体には wickrweb:// と
        getAwsCredentials が残っている。
      </Callout>

      <H2>Android WickrAPI（最優先面の結論）</H2>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader trailing={<Pill size="sm" tone="success" active>確定</Pill>}>
            バインドと既定値
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>
                WickrAppContext.Impl が WickrAPIServerConfigAuthHandler(WickrConfig.INSTANCE)
                を直接 new する。BuildConfig 側の isAllowed=true は本番では使われない。
              </Text>
              <Text>
                enableAtak 既定 false。atakPackageValues 既定は空配列。canUpdate は
                Messenger 以外で true なので、ネットワーク設定で上書きできる。
              </Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm" tone="warning" active>残差</Pill>}>
            識別子が Intent extra
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>
                pairing / request とも getCallingPackage も Binder UID も無い。
                isAllowed は extra EXTRA_PACKAGE_NAME だけ。Pending 接続と通知の
                名前・アイコン・説明・応答先は protobuf AppInfo。両者の一致検査は無い。
              </Text>
              <Text>
                handlePairingRequest は isEnabled を見ない。通知は
                sendPairingResponse の二度目の isAllowed より先に出る。承認と
                応答送信は protobuf 側のパッケージで再検査する。
              </Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Table
        headers={["段階", "ゲート", "結果"]}
        rows={[
          [
            "ストック Pro",
            "allowlist 空 → isAllowed 失敗",
            "共インストールアプリはペアリング開始不可",
          ],
          [
            "ATAK 有効ネットワーク",
            "extra が allowlist にあれば第一ゲート通過",
            "第三者アプリがペアリング通知を出せる。完了は protobuf パッケージも allowlist 必須",
          ],
          [
            "ユーザ承認後",
            "暗号化キー + FeatureModule",
            "会話/メッセージ/連絡先/通話/ファイル/設定/アバターが API 化",
          ],
        ]}
        rowTone={["success", "warning", "danger"]}
        striped
      />

      <Text size="small" tone="tertiary">
        影響モデルは悪意の共インストールアプリ。HackerOne の companion-app 条項を提出前に確認すること。
        ユーザが接続アプリ画面で承認する必要はある。送信者 UID と表示名の不一致は、その承認の信頼性を落とす。
      </Text>

      <H2>Linux wickrweb（文字列で覆した点）</H2>
      <Callout tone="info" title="toLinux/STATUS の「Linux に wickrweb 無し」は誤り">
        platforms/linux/sq/usr/bin/WickrPro（79,531,696 bytes）に wickrweb:// が 46、
        getAwsCredentials が 6、awscredentials / chimetoken / accessKeyId /
        secretAccessKey が残る。OS スキーム登録は wickrpro:// のまま。到達性の動確はしていない。
      </Callout>
      <Table
        headers={["ルート", "Windows W78", "Linux 文字列"]}
        rows={[
          ["awscredentials / chimetoken / myaccount/password", "あり", "あり"],
          ["contacts / convo / message / users / verification", "あり", "あり"],
          ["admin/controls / admin/inviteuser", "W78 表に無し", "あり"],
          ["devices/active / search / myaccount/leavenetwork", "W78 表に無し", "あり"],
        ]}
        striped
      />

      <H2>まだ切っていないもの</H2>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader trailing={<Pill size="sm" tone="warning" active>Windows renderer</Pill>}>
            Qt backport gap
          </CardHeader>
          <CardBody>
            <Text>
              CVE-2025-9479 はソースが PASS のまま一度も走っていない。CVE-2025-6555 は
              このツリーに該当ソースが無い。公開回帰の有無確認と、出荷エンジンでの有無測定だけが残る。
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm">same-origin API</Pill>}>
            wickrweb 到達性
          </CardHeader>
          <CardBody>
            <Text>
              認証なしディスパッチは Windows で測済み。Linux は文字列一致。次は Wickr UI
              オリジンからの fetch が通るか（動確）。XSS があれば秘密開示の増幅。
            </Text>
          </CardBody>
        </Card>
      </Grid>

      <H2>候補一覧</H2>
      <Row gap={8} wrap>
        {PLATS.map((p) => (
          <span key={p.id}>
            <Pill active={plat === p.id} onClick={() => setPlat(p.id)}>
              {p.label}
            </Pill>
          </span>
        ))}
      </Row>
      <Text size="small" tone="tertiary">
        {rows.length} / {ITEMS.length} · Android jadx-api dumps · Linux WickrPro strings · W36/W78 · 2026-08-13
      </Text>
      <Table
        headers={["面", "候補", "状態", "なぜ残るか", "証拠"]}
        rows={rows.map((r) => [r.plat, r.id, r.status, r.why, r.evidence])}
        rowTone={rows.map((r) => r.tone)}
        striped
        stickyHeader
      />

      <H2>追わなくてよい</H2>
      <Table
        headers={["項目", "理由"]}
        rows={[
          ["PacketHeader field 7", "W14 で 9/9 NEGATIVE。onEvent 定数比較のみ"],
          ["WinSparkle HTTPS 残差", "W13/W78 で HTTPS 固定。無署名は既報 DUPLICATE"],
          ["Sock5 SETUPAPI ドライバ", "W7 で .inf/.sys 不在 DEAD"],
          ["CVE-2026-8554 D3D11 OOB", "oracle は live。W70 が host OOB 到達不能と文書化"],
          ["F1 二人通話 RCE", "単一ピアではゲートが開かない（NEXT-HUNT W15）"],
          ["docx XSS / Amplify R2S", "提出済み。再導出しない（W16d）"],
          ["FDK-AAC デコーダ", "W78: NPL にデコーダ未コンパイル"],
          ["WebGPU / Dawn", "W36: requestAdapter() NULL"],
          ["登録 deeplink によるログイン中 ATO", "DB 既存なら無視。forgot-password は username 一致のみ"],
          ["WickrAPI BuildConfig 常時許可", "awsRelease では ServerConfig に置換済み"],
        ]}
        striped
      />

      <Divider />
      <H3>意図的に触っていないもの</H3>
      <Text tone="secondary">
        iOS、サーバ／ハブ実トラフィック、グループ通話の N パブリッシャ倍率、MLS 本体の
        membership 論理。macOS の中身。WickrAPI の動的確認（ATAK 相当の allowlist を
        ローカルで立てる試験）と wickrweb の renderer fetch。
      </Text>
    </Stack>
  );
}
