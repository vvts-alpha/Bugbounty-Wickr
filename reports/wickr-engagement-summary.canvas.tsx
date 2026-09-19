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

type EraId =
  | "all"
  | "early"
  | "native"
  | "web"
  | "v8"
  | "escape"
  | "angle"
  | "winrce"
  | "linux";

type Tone = "success" | "danger" | "warning" | "info" | "neutral";

type WaveRow = {
  wave: string;
  era: Exclude<EraId, "all">;
  what: string;
  result: string;
  tone: Tone;
};

const ERAS: { id: EraId; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "early", label: "初期・提出" },
  { id: "native", label: "Native / 通話" },
  { id: "web", label: "Web 配送" },
  { id: "v8", label: "V8 renderer" },
  { id: "escape", label: "V8 脱出" },
  { id: "angle", label: "ANGLE / GPU" },
  { id: "winrce", label: "Win 証明" },
  { id: "linux", label: "Linux RCE" },
];

const WAVES: WaveRow[] = [
  {
    wave: "提出 Android",
    era: "early",
    what: "Android docx プレビュー XSS / 経路",
    result: "H1 提出済み（reports/H1-report-wickr-docx-preview.md）",
    tone: "success",
  },
  {
    wave: "提出 Desktop",
    era: "early",
    what: "Desktop docx → wickrweb データ持ち出し",
    result: "H1 提出済み（reports/H1-report-wickr-desktop-docx-wickrweb-exfil.md）",
    tone: "success",
  },
  {
    wave: "提出 Amplify",
    era: "early",
    what: "Amplify オリジン上の React2Shell",
    result: "H1 提出済み（reports/H1-report-amplify-react2shell-rce.md）",
    tone: "success",
  },
  {
    wave: "WAVE2",
    era: "early",
    what: "docx/pptx プレビューから native bridge への CSP 迂回",
    result: "script-src は破れていない。altChunk→srcdoc と frame-src Amplify 許可を確認",
    tone: "warning",
  },
  {
    wave: "WAVE3",
    era: "early",
    what: "Native メモリ破壊。libvpx / NPL の版ピンと奇数高さヒープ溢れ",
    result: "ハーネス上で PC 制御まで。CVE-2023-5217 到達主張は後続で撤回",
    tone: "warning",
  },
  {
    wave: "W3",
    era: "native",
    what: "WAVE3 の地面再検証。libvpx 1.9.0、VP9 無し、error_concealment ON",
    result: "版ピン確定。以降はバイナリを一次ソースにする",
    tone: "info",
  },
  {
    wave: "W4",
    era: "native",
    what: "AEAD、Buffer.size 経路、VP9 候補、F4-1→RCE、網羅性批評",
    result: "AES-256-GCM は正しい。VP9 は否定。F4-1 の内容制御は未証明と記録",
    tone: "info",
  },
  {
    wave: "W5",
    era: "native",
    what: "実通話で VP8 UAF 書き込みと 2GiB DoS を再現",
    result: "F5-1 / F5-2 をライブ実証。RCE は未達（回収オブジェクトが届かない）",
    tone: "success",
  },
  {
    wave: "W6",
    era: "native",
    what: "Link (a) 回収オブジェクト探索",
    result: "到達可能なクリーン枠は全滅。系統的に閉じた",
    tone: "danger",
  },
  {
    wave: "W7",
    era: "native",
    what: "音声受信脚（Parser→Opus）と RCE 面の掃討",
    result: "音声脚の過大クレームは否定。マイク PCM 生ダンプなど別面を記録",
    tone: "info",
  },
  {
    wave: "W8",
    era: "native",
    what: "QtWebEngine コマンドライン、画像デコード、コンポーネント版",
    result: "Chromium 130 + 宣言パッチ 139。画像経路の地図を固定",
    tone: "info",
  },
  {
    wave: "W9",
    era: "native",
    what: "残件ラウンド（WinSparkle 無署名、CFG 不活性、ログ、ephemerality）",
    result: "F4a 無署名更新が実用上最重。残件を次波へ",
    tone: "warning",
  },
  {
    wave: "W10",
    era: "native",
    what: "Link (a) の 32 クリーン枠を個別判定",
    result: "デコーダスタック固定。回収候補は残らず",
    tone: "danger",
  },
  {
    wave: "W11",
    era: "native",
    what: "Qt Chromium backport、強制クラッシュダンプ、Qt6Pdf",
    result: "宣言パッチ水準と実バイナリのズレを疑い始める",
    tone: "info",
  },
  {
    wave: "W13",
    era: "native",
    what: "PacketHeader 消費マップと ephemerality。engagement 全体地図",
    result: "未クランプ欄の大半は閉じた。F2c は認証前ラチェット",
    tone: "info",
  },
  {
    wave: "W14",
    era: "native",
    what: "情報漏洩掃討（RCE に必要なリークを探す）",
    result: "使えるリークは出ず。ブラインド上書きの壁が残る",
    tone: "danger",
  },
  {
    wave: "W15",
    era: "native",
    what: "ピア自身の配置プリミティブとスタック溢れ",
    result: "スタック溢れは否定。配置プリミティブは限定的",
    tone: "danger",
  },
  {
    wave: "W16",
    era: "native",
    what: "F4f と Qt6Pdf ヒープ想定の再検証",
    result: "F4f は OOB ではない。Pdf はプロセスヒープを使わない",
    tone: "danger",
  },
  {
    wave: "W17",
    era: "web",
    what: "位置情報サニタイザ破綻 → メインフレームへピア HTML",
    result: "F11 確認。以降 Web 面が本線になる",
    tone: "success",
  },
  {
    wave: "W17b–f",
    era: "web",
    what: "URI→shell、WebEngineView 設定、メッセージボタン、同一オリジン preview、画像デコーダ",
    result: "複数の hardening / ロジック欠陥。実行までは未達",
    tone: "warning",
  },
  {
    wave: "W17g–i",
    era: "web",
    what: "任意 URL WebView、チャット経路、wickrpro:// 引数注入",
    result: "g は撤回。チャット直経路は当初否定。引数注入は後の W37 で閉じる",
    tone: "danger",
  },
  {
    wave: "W17j",
    era: "web",
    what: "サイト分離と ANGLE のプロセス配置",
    result: "site isolation OFF（Isolate 共有）。ANGLE は CFG 無し本体プロセス",
    tone: "success",
  },
  {
    wave: "W17k",
    era: "web",
    what: "チャット経由で任意 URL iframe（docx 不要）",
    result: "配送面として成立。CSP frame-src 許可オリジンが鍵",
    tone: "success",
  },
  {
    wave: "W18",
    era: "web",
    what: "第三者 frame-src オリジンと QWebChannel / openFile",
    result: "クロスオリジンでは qt ブリッジ無し。bridge 自体に exec は無い",
    tone: "warning",
  },
  {
    wave: "W19",
    era: "web",
    what: ".pptx → form ナビ → Amplify 許可オリジン",
    result: "実クライアントでプレビュー枠が攻撃者ページを表示。配送完了",
    tone: "success",
  },
  {
    wave: "W19b",
    era: "web",
    what: "F9 / CVE-2025-10729 Qt SVG UAF",
    result: "UAF は CFG 付き vcall まで。IP 制御は未達（CWE-416）",
    tone: "warning",
  },
  {
    wave: "W20",
    era: "v8",
    what: "CVE-2026-2441（Blink CSSFontFeatureValuesMap UAF）再現",
    result: "出荷ビルドで発火。以降 renderer n-day 本線",
    tone: "success",
  },
  {
    wave: "W21–W25",
    era: "v8",
    what: "2441 / 11645 ハーネス群（scratch/w21* など）",
    result: "再現器の整備。文書化された到達点は W27 / W33 側",
    tone: "neutral",
  },
  {
    wave: "W26",
    era: "v8",
    what: "宣言 backport 水準の信頼性。CVE-2025-4609",
    result: "宣言 139 は信用できない。個別 CVE を G1/G2 で測る規則が立つ",
    tone: "warning",
  },
  {
    wave: "W27",
    era: "v8",
    what: "2441 の武器化。プリミティブの形を測る",
    result: "書き込み候補は見えるが、まだ制御できず",
    tone: "info",
  },
  {
    wave: "W27c",
    era: "v8",
    what: "2441 スロット制御",
    result: "決定的スロット制御と選択アドレス書き込みまで。ASLR ブートストラップで停止",
    tone: "warning",
  },
  {
    wave: "W29–W32",
    era: "v8",
    what: "CVE-2026-11645（V8 TryFastAddDataProperty）武器化試行",
    result: "発火は確認。既定レイアウトでは OOB がオブジェクト内に閉じる",
    tone: "warning",
  },
  {
    wave: "W33",
    era: "v8",
    what: "11645 が crash か inert か",
    result: "出荷エンジンでは crash-or-inert。公開 ITW 手法は未公開",
    tone: "info",
  },
  {
    wave: "W34",
    era: "v8",
    what: "11645 から観測可能なリーク",
    result: "addrof（自己検証）達成",
    tone: "success",
  },
  {
    wave: "W35",
    era: "v8",
    what: "ケージ内任意 R/W と安定ヘルパ",
    result: "in-cage arb R/W + クロスオリジン読み。レンダラ内では完了",
    tone: "success",
  },
  {
    wave: "W36",
    era: "escape",
    what: "パッチゲート実測と次段 CVE ランキング",
    result: "到達点は増やしていない。A1–A13 / GPU 候補の地図",
    tone: "info",
  },
  {
    wave: "W37 / W37b",
    era: "escape",
    what: "wickrpro:// 引数注入と --datalocation プロファイル乗っ取り",
    result: "exec までは閉じた。datalocation は機構はあるが横取りは撤回",
    tone: "danger",
  },
  {
    wave: "W38",
    era: "escape",
    what: "レンダラ JS に残るチャットデータ",
    result: "平文メッセージ・連絡先が JS ヒープに居る。後の W69 の前提",
    tone: "success",
  },
  {
    wave: "W39",
    era: "escape",
    what: "argv の --disable-web-security",
    result: "レンダラには適用されていない。SOP は生きている",
    tone: "danger",
  },
  {
    wave: "W41",
    era: "angle",
    what: "CVE-2026-14382 ANGLE Transform Feedback 検証回避",
    result: "Stage 1 検証破りは出荷で成立",
    tone: "success",
  },
  {
    wave: "W42",
    era: "escape",
    what: "A2 SlicedString オフセット溢れ → ケージ外読み",
    result: "out-of-cage READ 達成（byte-exact）",
    tone: "success",
  },
  {
    wave: "W43",
    era: "escape",
    what: "A4 非境界 table_index → ケージ外書き",
    result: "out-of-cage WRITE 達成（紙面上の V8 SBX 脱出）",
    tone: "success",
  },
  {
    wave: "W44",
    era: "escape",
    what: "wickrweb:///awsCredentials",
    result: "WickrAI フラグで閉じていない。レンダラ RCE 後に AWS 資格情報",
    tone: "success",
  },
  {
    wave: "W46–W48",
    era: "escape",
    what: "A1 級 JIT、アドレス空間、コードレンジへ A4 が届くか",
    result: "JIT 経路は不採用。コードレンジ書きは届かない判定",
    tone: "danger",
  },
  {
    wave: "W49–W50",
    era: "escape",
    what: "V8 421403261 ゲートと WasmDispatchTable 操舵",
    result: "ゲートは後の W55 で発火。当時は AIM 未達。テーブルは操舵可",
    tone: "warning",
  },
  {
    wave: "W52 / W53",
    era: "escape",
    what: "ケージ自己開示アンカーと DLL base",
    result: "cage_base leak と DLL base 計算が可能に",
    tone: "success",
  },
  {
    wave: "W54 / W55",
    era: "escape",
    what: "ケージ外読みで DLL base、421403261 ゲート発火",
    result: "紙面上チェーン閉鎖。confused return がケージ外 RAX を運ぶ",
    tone: "success",
  },
  {
    wave: "W56",
    era: "angle",
    what: "ANGLE TransformFeedback11 の stale ID3D11Buffer* UAF",
    result: "実 GPU（Arc Pro / D3D11）で確認。Chrome 150 はクリーン",
    tone: "success",
  },
  {
    wave: "W57",
    era: "angle",
    what: "W56 の破壊を制御へ",
    result: "write-1 プリミティブ化の作業開始",
    tone: "info",
  },
  {
    wave: "W58",
    era: "angle",
    what: "CVE-2026-10897 CopyTexImage2D cube-face デシンク",
    result: "G1/G2 PASS。デシンクは起こる。RCE は未主張",
    tone: "warning",
  },
  {
    wave: "W59 / W60",
    era: "angle",
    what: "CVE-2026-10882、CVE-2026-9873 候補",
    result: "GPU 候補の継続トリアージ。本線は TF11",
    tone: "info",
  },
  {
    wave: "W61",
    era: "angle",
    what: "CVE-2026-16413",
    result: "WebGL からはデッド（desktop GL API が必要）",
    tone: "danger",
  },
  {
    wave: "W62",
    era: "angle",
    what: "14382 Stage 2 OOB 昇格",
    result: "構造的に否定。検証破り止まり",
    tone: "danger",
  },
  {
    wave: "W63 / W64",
    era: "angle",
    what: "TF11 UAF の malloc(0x2B0) 回収",
    result: "回収は成立。write-1 は Xe-UMD 依存",
    tone: "success",
  },
  {
    wave: "W67",
    era: "winrce",
    what: "Windows：V8 チェーンで renderer EXEC-OK。ANGLE はレガシ UMD で死",
    result: "EXEC-OK ×5。シェルコードが retaddr/frameptr を返す。本体プロセス RCE ではない",
    tone: "success",
  },
  {
    wave: "W68",
    era: "angle",
    what: "W67 成果を継承し、Xe-UMD ホストで TF11→OS RCE を継続",
    result: "レガシ UMD では write-1 無し。Arc ホスト前提",
    tone: "warning",
  },
  {
    wave: "W69",
    era: "winrce",
    what: "レンダラ侵害 → 復号メッセージ / 連絡先のメモリ回収",
    result: "クロスオリジンページが JS ヒープ上の Wickr データを byte-exact 回収",
    tone: "success",
  },
  {
    wave: "W70 / W71",
    era: "winrce",
    what: "本体プロセス / OS-RCE プリミティブと PA 回収",
    result: "本体到達の別ルート探索。決定打は出ず",
    tone: "info",
  },
  {
    wave: "W72 / W74 / W76",
    era: "winrce",
    what: "wickrweb:// 画像インデックスの符号付き比較 OOB",
    result: "OOB リーク機構は出荷バイナリで確認。ASLR 種になる",
    tone: "success",
  },
  {
    wave: "W73 / W75",
    era: "angle",
    what: "TF11→mSkipValidation、GPU コマンドバッファ偽造",
    result: "ブラウザ書き込み経由の本体 RCE は未完",
    tone: "warning",
  },
  {
    wave: "W77 / W78",
    era: "winrce",
    what: "Wickr ネイティブコード攻撃面",
    result: "レンダラ以外の native 面を再掃討",
    tone: "info",
  },
  {
    wave: "W79 / W80",
    era: "winrce",
    what: "ページ→ブラウザ書きプリミティブ、WebGPU/Dawn on M130",
    result: "代替 GPU 面。本線は Linux へ移る",
    tone: "info",
  },
  {
    wave: "W81",
    era: "linux",
    what: "Linux snap のサンドボックス",
    result: "QTWEBENGINE_DISABLE_SANDBOX=1。OS サンドボックス無効が一次事実",
    tone: "success",
  },
  {
    wave: "W82–W85",
    era: "linux",
    what: "自己完結 Linux RCE 引き継ぎ、ケージ内スタックポインタリーク",
    result: "/params 無しでアドレスを頁側導出する方針へ",
    tone: "info",
  },
  {
    wave: "W86",
    era: "linux",
    what: "IsolateData 位置とスタック上の webengine .text 戻り番地",
    result: "スタックウォークの足場",
    tone: "success",
  },
  {
    wave: "W87",
    era: "linux",
    what: "シェルコード配置 + ret 上書き",
    result: "配置までは通る。rwxp ページが PKU W^X で実行不可",
    tone: "warning",
  },
  {
    wave: "W88 / W89",
    era: "linux",
    what: "JDT、ROP チェーン",
    result: "ROP は書ける。発火トリガ未解決。コード空間スキャンは未コミット頁で落ちる",
    tone: "warning",
  },
  {
    wave: "W90 / W91",
    era: "linux",
    what: "TLT 読みと ROP。GC がスタックスロットを壊す",
    result: "スタック ROP は構造的に困難。JIT コード上書きへ戻る",
    tone: "danger",
  },
  {
    wave: "W92",
    era: "linux",
    what: "confused-call → trusted-space walk → JIT 上書き",
    result: "nonce EXEC-OK（0x13371339 + 生 retaddr/frameptr）",
    tone: "success",
  },
  {
    wave: "W93",
    era: "linux",
    what: "同じトリガで execve(xcalc)",
    result: "Linux レンダラで xcalc 達成。OS sandbox OFF が前提。現行 poc/ がこれ",
    tone: "success",
  },
];

export default function WickrEngagementSummary() {
  const [era, setEra] = useCanvasState<EraId>("era", "all");
  const rows = WAVES.filter((w) => era === "all" || w.era === era);

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <H1>AWS Wickr BBP — 全体サマリー</H1>
        <Text tone="secondary">
          対象は AWS Wickr Desktop / Pro 6.72.20（Qt WebEngine 6.9.2、Chromium
          130.0.6723.192、宣言パッチ 139.0.7258.67）。正規 BBP（HackerOne
          #3895069）。一次ソースは ENGAGEMENT-OBJECTIVE.md、desktop/notes の
          CRUX、scratch/wXX の STATUS。タグ [M] は実測。
        </Text>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value="6.72.20" label="対象バージョン" />
        <Stat value="W3–W93" label="作業波" />
        <Stat value="3" label="提出済み H1" tone="success" />
        <Stat value="W93 xcalc" label="現行到達（Linux renderer）" tone="success" />
      </Grid>

      <Callout tone="info" title="主張の境界">
        Windows W67 はレンダラ内 EXEC-OK（プロセス生存のままシェルコードが走った証明）。
        Linux W93 は OS サンドボックス OFF のレンダラで xcalc。ANGLE TF11 の
        write-1 は Intel Xe-UMD（Arc）依存で、レガシ UHD では死んでいる。本体
        WickrPro.exe 上のフル OS RCE は未達として扱う。
      </Callout>

      <H2>攻撃ライン</H2>
      <Grid columns={2} gap={12}>
        <Card>
          <CardHeader trailing={<Pill size="sm" active>現行 Linux</Pill>}>
            V8 renderer
          </CardHeader>
          <CardBody>
            <Text>
              CVE-2026-11645 からケージ内 R/W（W35）、ケージ外 R/W（W42/W43）、
              421403261（W55）、Windows EXEC-OK（W67）、Linux xcalc（W93）。
              サイト分離 OFF なので同一 Isolate の他オリジンも読める。
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm">Xe-UMD 依存</Pill>}>
            ANGLE / GPU
          </CardHeader>
          <CardBody>
            <Text>
              GPU は本体プロセス内。TF11 UAF（W56）→ malloc 回収（W64）→ write-1。
              サンドボックスを飛ばせる最短路だが、レガシ UMD では chase が無い。
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm">配送完了</Pill>}>
            Web 配送
          </CardHeader>
          <CardBody>
            <Text>
              WAVE2 で CSP script-src は破れていない。.pptx form ナビ（W19）と
              チャット iframe（W17k）で Amplify 許可オリジンのページを枠内表示。
            </Text>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Pill size="sm">ライブ実証</Pill>}>
            Native / 通話
          </CardHeader>
          <CardBody>
            <Text>
              実通話で VP8 UAF 書き込みと 2GiB DoS（W5）。回収オブジェクトが届かず
              RCE にはなっていない。WinSparkle 無署名、CFG OFF、マイク PCM 生ダンプ。
            </Text>
          </CardBody>
        </Card>
      </Grid>

      <H2>V8 チェーンの到達</H2>
      <Text size="small" tone="tertiary">
        Source: ENGAGEMENT-OBJECTIVE.md / W67-CHECKPOINT / W93-STATUS · 2026-07〜08
      </Text>
      <Table
        headers={["段", "Wave", "能力"]}
        rows={[
          ["1", "W34", "観測可能なリーク / addrof"],
          ["2", "W35", "ケージ内 任意 R/W"],
          ["3", "W42 / W43", "ケージ外 read / write"],
          ["4", "W52–W55", "cage_base / dll_base / 421403261 ゲート"],
          ["5", "W67", "Windows renderer EXEC-OK"],
          ["6", "W93", "Linux renderer xcalc（OS sandbox OFF）"],
        ]}
        rowTone={["success", "success", "success", "success", "success", "success"]}
        columnAlign={["right", "left", "left"]}
      />

      <H2>時代</H2>
      <Text tone="secondary">
        作業は番号順に一本ではなく、Native → Web 配送 → V8 → ANGLE と Linux が
        並行している。下のフィルタでその時代の Wave だけ出す。
      </Text>
      <Row gap={8} wrap>
        {ERAS.map((item) => (
          <span key={item.id}>
            <Pill
              active={era === item.id}
              onClick={() => setEra(item.id)}
            >
              {item.label}
            </Pill>
          </span>
        ))}
      </Row>
      <Text size="small" tone="tertiary">
        {rows.length} / {WAVES.length} 件
      </Text>
      <Table
        headers={["Wave", "調査内容", "結果"]}
        columnAlign={["left", "left", "left"]}
        rows={rows.map((w) => [w.wave, w.what, w.result])}
        rowTone={rows.map((w) => w.tone)}
        striped
        stickyHeader
      />

      <H2>いま見ている場所</H2>
      <Grid columns={3} gap={12}>
        <Stat value="poc/" label="現行 Linux PoC" />
        <Stat value="scratch/w93" label="xcalc 作業ディレクトリ" />
        <Stat value="reports/" label="提出コピー" />
      </Grid>
      <Text>
        地図はルートの README.md。Desktop メモは
        platforms/desktop/notes/、波作業は scratch/wXX/。抽出ソースは
        artifacts/wickr/。Linux snap は platforms/linux/sq/。
      </Text>

      <Divider />
      <H3>欠番・薄い波</H3>
      <Text tone="secondary">
        scratch にディレクトリはあるが、CRUX が薄い／ハーネス専用のもの:
        w12、w21 系、w22i2、w29–w32、w40、w45、w51、w65、w66。W20–W32 の結論は
        W20-W32-CONSOLIDATED-STATE.md に集約されている。
      </Text>
    </Stack>
  );
}
