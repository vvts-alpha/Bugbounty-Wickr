# W44 — `wickrweb:///awsCredentials` hands live AWS credentials to renderer JS, and the WickrAI feature flag does not gate it

**Date:** 2026-08-05. Binary: `WickrPro.exe` 4.4.0.0181 / commit `c9c94459`, 55,890,344 bytes,
ImageBase `0x140000000`. Recovered app source at `scratch/w17/src/`.
Every claim below is marked **[M]** measured (disassembly / source read) or **[I]** inferred.

---

## 1. What the credentials are

**Not Cognito.** The production-path credentials returned by `wickrweb:///awsCredentials` are vended
by **Wickr's own backend** over the ordinary authenticated Wickr API (multipart POST carrying
`json_secure` / `json_id`; request builder RVA `0x9e2210`) and cached in a process global. [M]

Field set: `{accessKey, secretKey, sessionToken, fipsEnabled, region}` + optional `expiration`
(epoch ms) — RVA `0xb23a00`, `0x9e212c`. [M]
The presence of `sessionToken` + `expiration` makes them **STS-style temporary credentials** — the
backend has assumed some role on the user's behalf. [I, but strongly determined by the field set]

Cached in a single process-global `QJsonObject`: **RVA `0x9e2080` writes it, `0x9e21e0` reads it.**
Handed to the web layer verbatim apart from renaming `accessKey`/`secretKey` to their SDK field
names (RVA `0x17d00`–`0x18117`). [M]
Client-side logging names the producer **"Aws credservice"** (RVA `0xb22dac`, `0xb21388`). [M]

**No role ARN, account id, STS host, `AssumeRole` or `roleArn` string exists anywhere in
`WickrPro.exe`.** [M] The IAM identity behind the credentials is a **server-side fact and is
untraced** — this is the single most important limit on how the finding may be worded.

### Two other credential paths that must NOT be conflated with it
* **Cognito, dev/beta only.** `CognitoAuthService.getCredentials()` →
  `fromCognitoIdentityPool({identityPoolId, logins:{'cognito-idp.us-west-2.amazonaws.com/us-west-2_2AIKmAToY': id_token}})`
  — `lib/awsAuth/CognitoAuthService.ts:261-275`; config `lib/awsAuth/config.ts:4-13`:
  identity pool `us-west-2:221d6549-f7b3-4a08-88f7-863587c7be1f`, user pool `us-west-2_2AIKmAToY`,
  client id `5du05u6952kog165c0rhr608l6`, domain
  `https://us-west-22aikmatoy.auth.us-west-2.amazoncognito.com`, `identityProvider: 'Federate'`
  (Amazon's internal IdP), redirect `wickrprobeta://bedrock-auth/info`. The file's own comment
  (`config.ts:2-3`) says "AWS cognito auth endpoints for DEV and/or Beta users", and
  `CompositeAuthService` only switches to it after an explicit interactive login
  (`CompositeAuthService.ts:63-70`, `:151`). [M]
* **Native telemetry Cognito.** `AWSCognitoIdentityService.GetId` / `GetCredentialsForIdentity`
  (file offsets 52903312–52904511), owned by `WickrCore::WickrClientMetricsMgr` for Kinesis
  `PutRecords`. **No xref from the JS-visible globals** — it does not feed the object above. [M]

---

## 2. Demonstrated capability — and its ceiling

What the **client source** shows being called with these exact credentials:

**Native (production, ships enabled):**
* `translate:TranslateText` in the region carried in the credential payload. SigV4 service string
  `translate`, target `AWSShineFrontendService_20170701.TranslateText`, body
  `{Text, SourceLanguageCode ("auto"), TargetLanguageCode}` (RVA `0xb23f00`; signer strings at file
  offset 53155720). `fipsEnabled` selects the `-fips.` endpoint variant. [M]

**JavaScript — only if `WickrAI` is on (it is compiled shut in the shipped bundle, §3):**
* `bedrock:InvokeModelWithResponseStream` via `ConverseStreamCommand` —
  `lib/bedrock/clients/BedrockClient.ts:24-45`, default model
  `us.anthropic.claude-3-7-sonnet-20250219-v1:0`, default region `us-west-2`
  (`lib/bedrock/types.ts:130-134`); region/modelId caller-overridable
  (`lib/bedrock/ConversationManager.ts:82-86`). [M]
* `bedrock:ListKnowledgeBases` with a **caller-chosen `region`** —
  `lib/mcp/tools/knowledgeBaseTools.ts:30-35`, input schema `:22`. [M]
* `bedrock:Retrieve` against an **arbitrary `knowledgeBaseId` in an arbitrary region** —
  `knowledgeBaseTools.ts:55-63`. [M]

**Explicitly NOT supported by the evidence.** The native SigV4 signer also contains `s3` and
`kinesis` templates, but an **exhaustive xref of the three credential globals
(`0x1434f9dc0` / `…dd8` / `…df0`) shows only the Translate builder reads them** [M]. There is no
evidence these credentials sign S3 or Kinesis traffic. **Do not write "the AWS account is
compromised."** The defensible upper bound is: Translate is demonstrated; everything above it is
pending server-side confirmation of the vending role's policy.

---

## 3. ★ The reachability point — the feature flag is not a control

The `WickrAI` gate decides only whether **JS caches** the credentials
(`selectIsFeatureAvailable` short-circuits on `availability:"dev"` against `case"dev":return!1`, so
a stock client never constructs a Bedrock client). [M]

**The native route is registered unconditionally in the WebViewRouter host table**, and hitting it
enqueues a fresh credential fetch whenever the cache has under 60 s of life left
(RVA `0x1f157` → `0x1f1de` → `0x23ff0`). [M]

⇒ **Any JavaScript executing in the application document can obtain live, immediately usable
credentials with a single `fetch('wickrweb:///awsCredentials')`, in a stock production build,
independently of the feature flag, and without translation ever having been used.**

That is exactly the position this engagement's renderer chain already establishes — W35's in-cage
arbitrary R/W inside a **single shared `v8::Isolate`** (site isolation off, W17j).

SigV4 credentials are **pure bearer material**: no device binding, no proof-of-possession. A holder
can sign AWS API calls from any host on the internet, as the vending role, until `expiration`.

**Open:** whether an attacker-controlled **cross-origin** frame can `fetch` the `wickrweb://` scheme
is *not* settled (task #12). W18 established such frames get no `qt.webChannelTransport`, but that
is a JS-level boundary only. The claim above is scoped to script in the **application document**.

---

## 4. Adjacent surface — flagged, not claimed

`WebChannelMessageBridge::getAwsCredentials(QJsonObject)` (RVA `0x100110`; moc name table at file
offset 30668756) reads `accessKeyId` and `secretKey` **from the JS-supplied object** and writes them
into the native Translate signer's key globals via `0xb239a0`. [M]

That is **credential injection** — JS can substitute the AWS credentials the native SigV4 signer
will use — i.e. an attacker-controlled-signed-request surface, not a disclosure. Whether the slot
also *returns* credential material to its JS callback was **not traced**.

---

## 5. Report wording (defensible, use verbatim)

> The Wickr desktop client obtains short-lived AWS credentials from its own backend and exposes them
> to renderer JavaScript through the internal `wickrweb://awscredentials` route. The payload is a set
> of STS-style temporary credentials — `accessKeyId`, `secretAccessKey`, `sessionToken`, plus
> `region`, `fipsEnabled` and an `expiration` in epoch milliseconds — cached in a single
> process-global `QJsonObject` and handed to the web layer verbatim. The only use the shipped native
> code makes of them is signing Amazon Translate `TranslateText` requests; an exhaustive
> cross-reference of the credential globals shows no S3, Kinesis or other consumer, and the client
> contains no role ARN, account identifier or policy document, so the true IAM scope of the vending
> role cannot be determined from the client and must be confirmed server-side — this report does not
> claim access beyond Amazon Translate. The application's JavaScript consumer
> (`AwsCredentialsAuthService.currentCredentials`), which would additionally feed Bedrock Runtime,
> Bedrock Agent and Bedrock Agent Runtime clients with a caller-chosen region and knowledge-base id,
> is gated behind the `WickrAI` feature, and in the shipped production bundle that gate is compiled
> shut. **That gate is not, however, a control on the credentials themselves:** the native route is
> registered unconditionally and re-fetches whenever the cached credential has under sixty seconds of
> life remaining, so any JavaScript running in the application document can retrieve live credentials
> with a single `fetch`, independently of the feature flag. Because SigV4 credentials are pure bearer
> material with no device binding, an attacker who reaches renderer script execution — the position
> this engagement's renderer chain already establishes, in a build where all documents share one V8
> isolate — can exfiltrate them and use them against AWS from anywhere until they expire.
>
> Defensible severity: **a confirmed, feature-flag-independent path for in-renderer script to obtain
> live AWS credentials that leave the application trust boundary**, with a demonstrated capability of
> at least Amazon Translate on the vending account and an unquantified upper bound pending
> server-side confirmation of the role's policy.

---

## 6. Unresolved (carry into the report's limitations)

1. The **vending endpoint is untraced** — generic authenticated multipart POST (RVA `0x9e2210`); URL
   composed by `0x140903cf0`, not traced to a literal path or command name.
2. The **IAM identity is untraced** (no ARN / account id / STS host in the binary). Per-user vs
   per-network vs one shared role: unknown.
3. **Actual TTL unknown** — the client only reads the server's `expiration`. The 60 s (native) and
   10 min (JS) numbers are *refresh thresholds*, not lifetimes.
4. Cross-origin `wickrweb://` reachability — task #12.
5. Inside RVA `0x23ff0` the chain was traced to: a 0x1f8-byte request object allocated, a
   "cache valid >60 s" byte computed into it, a completion slot connected, and the object enqueued on
   the TaskService (`0x241d1` → `0x9db2d0` → `0x140b522b0`). "Therefore a backend request is issued
   when stale" is **[I]**, not [M] — the `QNetworkAccessManager::post` was not reached.
6. Whether `getAwsCredentials` (RVA `0x100110`) also *returns* credential material: not traced.
7. Whether an enterprise/server channel can enable `WickrAI` remotely: only the client half was
   checked; `selectIsFeatureAvailable` short-circuits on `availability:'dev'` **before** any override
   or server value is consulted, so the answer appears to be no.
8. `lib/awsAuth/types.ts` is type-only and erased at build — the field set comes from the native
   consumer (RVA `0xb23a00`) and the JS validation at `AwsCredentialsAuthService.ts:67`, not from a
   TypeScript declaration.

Corrects W38's shorthand "(AI-only) live AWS keys also in JS": **AI-only is true of the JS cache,
false of the native route.**
