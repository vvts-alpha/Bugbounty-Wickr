import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
} from "cursor/canvas";

type Tab = "all" | "surface" | "new" | "submitted" | "closed" | "atak";
type Tone = "success" | "danger" | "warning" | "info" | "neutral";

type Finding = {
  tabs: Tab[];
  id: string;
  status: string;
  attacker: string;
  gate: string;
  why: string;
  evidence: string;
  tone: Tone;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "new", label: "未提出" },
  { id: "submitted", label: "提出済" },
  { id: "atak", label: "ATAK 条件" },
  { id: "closed", label: "閉じた" },
  { id: "surface", label: "攻撃面" },
];

const FINDINGS: Finding[] = [
  {
    tabs: ["new", "surface"],
    id: "外部 Viewer URI grant の過大配布",
    status: "静的確定・未提出",
    attacker: "遠隔の添付送信者 + 共インストール Viewer",
    gate: "enableFileDownload=true（内蔵プレビューの逆）",
    why: "復号キャッシュを FileProvider で渡し、送信者メタデータの MIME で ACTION_VIEW。queryIntentActivities の全一致パッケージへ GRANT_READ してから startActivity。ユーザが選ばないアプリにも grant が残る。",
    evidence: "FileExtensionsKt.openFileExternally / getFileShareUri / cache-path dec/",
    tone: "warning",
  },
  {
    tabs: ["new", "atak", "surface"],
    id: "WickrAPI 呼び出し元 UID 非束縛",
    status: "静的確定・既定 fail-closed",
    attacker: "悪意の共インストールアプリ",
    gate: "サーバが enableAtak=true かつ allowlist 非空。完了にはユーザ承認",
    why: "getCallingPackage / Binder UID 無し。第一ゲートは extra EXTRA_PACKAGE_NAME。通知名・アイコン・応答先は protobuf AppInfo。extra と protobuf の一致検査は無い。pairing 開始は isEnabled を見ない。",
    evidence: "WickrAPIManager.handlePairingRequest / WickrAPIServerConfigAuthHandler",
    tone: "warning",
  },
  {
    tabs: ["new", "atak"],
    id: "importFile の scheme 非検査",
    status: "静的確定・ATAK または共有取り込み",
    attacker: "ペア済みアプリ、または SEND で URI を渡すアプリ",
    gate: "WickrAPI はペア後。共有は ValidSession + 部屋選択",
    why: "ContentResolver.openInputStream(request.getUri()) のみ。file:// や他アプリ content:// を Wickr 権限で読む。validateFile は既存ファイルとのハッシュ衝突検出だけで、パス閉じ込めではない。",
    evidence: "FileManager.importFile / SendMessageModule.processSendFileMessageRequest",
    tone: "warning",
  },
  {
    tabs: ["new", "atak"],
    id: "FileDownload の grant 先が AppInfo パッケージ",
    status: "ペア後は意図的・識別子欠陥と合成",
    attacker: "ペア済み（または AppInfo 偽装が通った）アプリ",
    gate: "承認済み接続 + FILEDOWNLOADREQUEST",
    why: "メッセージ ID から復号し、toWickrAPIMessage の URI を AppInfo.getPackageName() へ grantUriPermission(READ)。会話 ACL の追加検査は無く、ローカルに存在するファイルメッセージなら通る。",
    evidence: "FileManagerModule.sendFileUpdate",
    tone: "info",
  },
  {
    tabs: ["submitted"],
    id: "内蔵プレビュー DOCX XSS",
    status: "H1 提出済。再提出しない",
    attacker: "遠隔の添付送信者",
    gate: "enableFileDownload=false",
    why: "FilePreviewWebViewClient は JS と DOM storage を有効化。仮想オリジン appassets.net。/preview-file/ はパスを無視して現在の fileUri のみ返す。ACAO * は同一 WebView 内。addJavascriptInterface はアプリ DEX に無し。",
    evidence: "wickr-android-preview-analysis.md / handle-method-disassembly.txt",
    tone: "success",
  },
  {
    tabs: ["closed", "surface"],
    id: "登録 / SSO deeplink ATO",
    status: "ログイン中はほぼ無視",
    attacker: "遠隔リンク / 共インストール",
    gate: "DB 既存なら登録リンクを破棄。forgot-password は username 一致のみ",
    why: "RegistrationLinkActivity はログイン済みで invite/SSO を落とす。SSOResponseRedirectActivity は AppAuth へ転送。WebViewActivity は exported=false。",
    evidence: "RegistrationLinkActivity.processDeepLink / SSOAuthManagementActivity",
    tone: "success",
  },
  {
    tabs: ["closed", "surface"],
    id: "Share-in の自動送信",
    status: "自動 exfil にはならない",
    attacker: "任意アプリの ACTION_SEND",
    gate: "ValidSessionActivity + ユーザが部屋を選ぶ + files 無効ならダイアログで終了",
    why: "EXTRA_TEXT / EXTRA_STREAM を読み、ConversationActivity へ URI をそのまま転送。コピー前検査は Share 側に無いが、送信は部屋選択後。ConversationActivity 自体は exported=false。",
    evidence: "ShareExternalContentActivity.openClickedConvo",
    tone: "success",
  },
  {
    tabs: ["closed", "surface"],
    id: "WebViewActivity の外部 URL ロード",
    status: "exported=false。configure が setPackage",
    attacker: "内部 Intent を握れた場合のみ",
    gate: "redirectUrls extra 必須。restrictNavigation 既定 true",
    why: "JS オン、file/content access オフ、Safe Browsing オン。非許可ナビは暗黙 ACTION_VIEW。許可リスト内の敵対ページがあれば intent: 残差。openInternalUri は SSOResponseRedirectActivity へ。",
    evidence: "WebViewActivity / WickrWebViewClient.isUriAuthorized",
    tone: "info",
  },
  {
    tabs: ["closed"],
    id: "ストック WickrAPI 開放",
    status: "awsRelease は fail-closed",
    attacker: "共インストール",
    gate: "enableAtak 既定 false、atakPackageValues 既定空",
    why: "WickrAppContext.Impl は ServerConfig ハンドラ。BuildConfig の isAllowed=true は未使用。空 allowlist では isAllowed 失敗。",
    evidence: "WickrConfig.Field / WickrAppContext.Impl",
    tone: "success",
  },
  {
    tabs: ["surface"],
    id: "Maps キー / test.runner 残留",
    status: "低。報告優先度なし",
    attacker: "APK 抽出者",
    gate: "なし（ハードコード）",
    why: "manifest に Maps v2 API キー。uses-library android.test.runner と AdapterTestActivity（exported なし）。品質残留。",
    evidence: "AndroidManifest.xml",
    tone: "neutral",
  },
];

const EXPORTED: {
  name: string;
  filter: string;
  perm: string;
  note: string;
  tone: Tone;
}[] = [
  {
    name: "RegistrationLinkActivity",
    filter: "VIEW BROWSABLE · wickrpro/awswickr/https register*",
    perm: "なし",
    note: "ログイン中は破棄。ATO にならない",
    tone: "success",
  },
  {
    name: "SSOResponseRedirectActivity",
    filter: "oidc + https register.wickr.com/oauth (autoVerify)",
    perm: "なし",
    note: "AppAuth ラッパ",
    tone: "success",
  },
  {
    name: "WickrAPIBroadcastReceiver",
    filter: "com.wickr.android.api.pairing / request",
    perm: "なし",
    note: "UID 非束縛。ストックは fail-closed",
    tone: "warning",
  },
  {
    name: "WickrAPICallingActivity",
    filter: "com.wickr.android.api.request.call",
    perm: "なし",
    note: "action を request に書き換えて handleAPIRequest",
    tone: "warning",
  },
  {
    name: "WickrAPIActivity",
    filter: "com.wickr.android.api.manage",
    perm: "なし",
    note: "ValidSession。接続アプリ管理 UI",
    tone: "info",
  },
  {
    name: "ShareExternalContentActivity",
    filter: "SEND */* および text/plain",
    perm: "なし",
    note: "ValidSession。部屋選択必須",
    tone: "info",
  },
  {
    name: "DashboardActivity",
    filter: "MAIN / LAUNCHER",
    perm: "なし",
    note: "ランチャのみ",
    tone: "neutral",
  },
];

const MODULES: [string, string, string][] = [
  ["GetConvos / GetMessages", "会話と本文。delete / unlock あり", "ローカル convoID / messageID。追加 ACL なし"],
  ["SendMessage", "text / file / location", "importFile(Uri.parse) で scheme 非検査"],
  ["GetContacts", "連絡先検索・ディレクトリ", "セッションの連絡先面"],
  ["Call", "START / JOIN / LEAVE", "CallActivity を startActivity"],
  ["CreateConvo / EditConvos", "部屋作成・編集", "ペア後はセッション権限"],
  ["FileManager", "FILEDOWNLOADREQUEST", "復号後に AppInfo パッケージへ URI grant"],
  ["Notification / GetUserSettings / UserAvatar", "通知・設定・アバター", "ペア後は意図的 API"],
];

export default function WickrAndroidDeepDive() {
  const [tab, setTab] = useCanvasState<Tab>("tab", "all");
  const rows = FINDINGS.filter((f) => tab === "all" || f.tabs.includes(tab));

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <H1>Android 深掘り監査</H1>
        <Text tone="secondary">
          com.wickr.pro 6.72.5（versionCode 60720511）。minSdk 33 / targetSdk 35。
          手元 APK の静的読みのみ。PoC・am start 手順は書いていない。HackerOne #3895069。
          調査日 2026-08-13。
        </Text>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value="7" label="Wickr 所有の exported（独自 permission なし）" />
        <Stat value="fail-closed" label="ストック WickrAPI" tone="success" />
        <Stat value="3" label="未提出の静的欠陥" tone="warning" />
        <Stat value="1" label="提出済プレビュー XSS（再提出しない）" tone="success" />
      </Grid>

      <Callout tone="warning" title="影響モデルを分けて読む">
        ストック Pro では WickrAPI は閉じている。報告価値があるのは (1)
        enableFileDownload=true の外部 Viewer grant、(2) ATAK 有効ネットワークでの
        UID 非束縛と importFile、(3) 提出済 XSS の隣接メモだけ。companion-app
        条項とユーザ承認は提出前に H1 ポリシーで確認する。
      </Callout>

      <Row gap={8} wrap>
        {TABS.map((t) => (
          <Pill active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </Pill>
        ))}
      </Row>

      <Table
        headers={["項目", "状態", "攻撃者", "ゲート", "根拠"]}
        rows={rows.map((f) => [f.id, f.status, f.attacker, f.gate, f.why])}
        rowTone={rows.map((f) => f.tone)}
        striped
      />
      <Text size="small" tone="tertiary">
        根拠ファイルは platforms/android/dumps/jadx-api と preview-route-disassembly.txt。
        表示中 {rows.length} / {FINDINGS.length} 件。
      </Text>

      <H2>Exported 攻撃面（Wickr 所有）</H2>
      <Table
        headers={["コンポーネント", "Intent filter", "permission", "読み"]}
        rows={EXPORTED.map((e) => [e.name, e.filter, e.perm, e.note])}
        rowTone={EXPORTED.map((e) => e.tone)}
        striped
      />
      <Text size="small" tone="tertiary">
        興味対象外: FirebaseInstanceIdReceiver（c2dm）、SystemJobService（BIND_JOB_SERVICE）、
        WorkManager Diagnostics / ProfileInstall（DUMP）、GMS RevocationBoundService。
        OpenUDID_service は exported=false。
      </Text>

      <H2>ファイル経路の分岐</H2>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader trailing={<Pill size="sm" active>未提出</Pill>}>
            enableFileDownload=true
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>
                添付タップ → 復号 → getFileShareUri（cache/dec/ ならロック追加）→
                FileProvider.getUriForFile(com.wickr.pro.files.provider)。
              </Text>
              <Text>
                Intent の type は AttachmentMetaData.getMimeType()。FLAG_GRANT_READ。
                解決可能な全 Viewer に grantUriPermission してから startActivity。
              </Text>
              <Text tone="secondary">
                SecureFileProvider は素の FileProvider。paths は cache tmp、cache
                dec/、external Downloads/。exported=false、grantUriPermissions=true。
              </Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm" active>提出済</Pill>}>
            enableFileDownload=false
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>
                FilePreviewActivity。JS + DOM storage。file access API の明示オフは
                無し（minSdk 33 の既定はオフ）。JS bridge 無し。
              </Text>
              <Text>
                /preview-file/ の ACAO * は同一 WebView の現在ファイルだけ。パス
                トラバーサルにはならない。DOCX XSS は提出済。
              </Text>
              <Text tone="secondary">
                ExportFileActivity は exported=false。SAF CREATE_DOCUMENT に送信者
                MIME を渡し、復号してコピー。ValidSession。
              </Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <H2>WickrAPI（ATAK）</H2>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader>ストック vs ネットワーク上書き</CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>
                JSON キー enableAtak 既定 false。atakPackageValues 既定空配列。
                canUpdate は Messenger 以外で true。
              </Text>
              <Text>
                第一ゲートは extra のパッケージ。Pending 接続と通知 UI は protobuf
                AppInfo。承認後の応答 setPackage も AppInfo。
              </Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>ペア後に載るモジュール</CardHeader>
          <CardBody>
            <Text>
              WickrAPIFeatureModuleManager が 11 モジュールを register。いずれも
              ログイン済みセッションのリポジトリを直接触る。共インストール攻撃者にとっての
              追加壁は「allowlist + ユーザ承認」だけ。
            </Text>
          </CardBody>
        </Card>
      </Grid>
      <Table
        headers={["モジュール", "できること", "今回の読み"]}
        rows={MODULES}
        striped
      />

      <H2>WebView と共有</H2>
      <Grid columns="1fr 1fr" gap={12}>
        <Card collapsible defaultOpen={false}>
          <CardHeader>WebViewActivity（exported=false）</CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>
                configure が intent.setPackage(自パッケージ) と setClass。data URI を
                loadUrl。redirectUrls が空なら即 finish。
              </Text>
              <Text>
                isUriAuthorized: URL（クエリ除去）allowlist、または host 一致。
                restrictNavigation=false かつ両リスト空なら全許可（Companion の既定は
                restrict=true）。
              </Text>
              <Text>
                非許可は暗黙 ACTION_VIEW。内部リダイレクトは scheme 一致を
                SSOResponseRedirectActivity へ。呼び出し元の全列挙は未完（SSO 経路が主）。
              </Text>
            </Stack>
          </CardBody>
        </Card>
        <Card collapsible defaultOpen={false}>
          <CardHeader>Share → ConversationActivity</CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Text>
                shareUri はコピーせず extras で渡す。タブレットは
                DashboardListActivity。flags に NEW_TASK 相当を加算。
              </Text>
              <Text>
                取り込み本体は ConversationActivity（exported=false）。同一
                importFile に乗れば scheme 非検査が共有経路にも効く。ユーザが部屋を
                選ぶ必要がある。
              </Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <H2>閉じた面・低優先</H2>
      <Table
        headers={["項目", "結論"]}
        rows={[
          [
            "Network",
            "usesCleartextTraffic=false。NSC は system CA のみ。allowBackup=false",
          ],
          [
            "getFileShareUri",
            "親が decrypted ディレクトリならロック。実体は FileProvider の paths 制約",
          ],
          [
            "validateFile",
            "同一サイズの既存ファイルとハッシュ比較。パス検査ではない",
          ],
          [
            "CallModule",
            "convoID がローカルにあれば CallActivity 起動。ペア後は意図的",
          ],
          [
            "WickrAPICallingActivity",
            "ValidSession ではないが、中身は handleAPIRequest へ丸投げ",
          ],
          [
            "secretAccessKey 文字列",
            "AWS SDK と Chime モデル toString。IPC 露出は未確認",
          ],
        ]}
        striped
      />

      <Callout tone="info" title="提出判断">
        外部 Viewer の全パッケージ grant はストック経路で、companion 条項に依存しない。
        WickrAPI 系は ATAK ネットワーク + ユーザ承認が前提なので、プログラムの
        共インストール条項を先に読む。DOCX / Amplify は再提出しない。
      </Callout>
    </Stack>
  );
}
