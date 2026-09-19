# W38 — what chat data lives in the renderer's JS, and what stays native

Static source read only. No exploitation, no app run. Source = `scratch/w17/src/src/` (2,195
TS files recovered from Vite source maps, W17). **[M]** = read in source with `file:line`;
**[I]** = inferred. Paths below are relative to `scratch/w17/src/src/`.

---

## 1. Impact statement (paste-ready, scoped to what the source supports)

> On this build, decrypted message **plaintext is present in the renderer's JavaScript heap**:
> every rendered/received message is parsed into a `WickrMessage` object carrying a cleartext
> `textContent` string. Decryption itself is **native** — JavaScript contains no cryptographic
> code and never sees a key; the native side decrypts and serves already-decoded protobuf to
> the renderer over the `wickrweb://` URL scheme. What the JS retains is **bounded, not the full
> mailbox**: a per-conversation in-memory cache holds up to **300 messages per conversation for
> the 20 most-recently-viewed conversations** (LRU, ≈6,000 messages maximum), plus the
> Redux-rendered window of the currently-open conversation. Also resident: the contact roster
> (idHash, username, display name), conversation/room metadata (titles, descriptions, members),
> and — only when AI features are in use — live **AWS access-key/secret-key credentials** for
> Bedrock. **Message, room, and file decryption keys are explicitly stripped in JS before any
> message is stored and are never retained** (no key material, no private keys, no crypto state
> in JS). Attachment file bytes are referenced by native `wickrweb://` URL and are materialized
> in JS only transiently — while a document preview (docx/pptx/xlsx) is open or audio is
> playing. All of this JS state is cleared on logout and on leaving the chat surface; no
> JS-level zeroization on screen-lock was found. Net: an attacker who can read the app
> document's JS heap obtains the plaintext of recently-viewed conversations and the contact
> graph, but not long-dormant history and not key material.

---

## 2. Q1 — decrypted text exists as a JS value; decryption is native [M]

- The message model carries plaintext: `WickrMessage.textContent: string` — `lib/protobuf/messages.ts:156-165` (`textContent`, plus `imgSrc?`).
- It is filled from decoded protobuf, not decrypted in JS:
  `textContent: getMessageText(body)` — `lib/protobuf/messages.ts:405`, where
  `getMessageText = (msg) => msg?.text?.text ?? ''` — `lib/protobuf/messages.ts:482`.
- The bytes arrive already-decrypted over a native URL scheme. Prod base is
  `wickrweb://` — `apis/webFetch/endpoints.ts:6` (`WICKR_WEB_PROD_BASENAME='wickrweb://'`),
  `:9-10`. JS fetches, converts to bytes, and protobuf-decodes:
  `responseToUint8Array` → `MessageCollection` → `messageCollectionToWickrMessageCollection`
  → `messageItemToWickrMessage` — `apis/webFetch/fetchInternal.ts:132,140` and
  `lib/protobuf/messages.ts:414-427`.
- **No decryption in JS**: a sweep of `apis/` + `lib/` finds only error enums
  (`AES_DECRYPTION_ERROR`, `messages.ts:97`; `decryptionError`, `:141`), and no
  `crypto.subtle` / `nacl` / `libsodium` / `deriveKey` / `privateKey` / `sessionKey` anywhere
  in `src/`. ⇒ decryption is native; the renderer receives plaintext protobuf. **[M]**

Trace, bridge boundary → render:
`bridge.connect('messageAdded', handleMessageUpsert)` (`chat/components/ChatAppSubscriptions.tsx:155`)
→ `getPaginatedMessages({vGroupID,msgId,before:1,after:1})` over `wickrweb://`
(`ChatAppSubscriptions.tsx:95`) → `upsertMessage` thunk (`store/thunks/messages.ts:192`)
→ `cache.upsertMany` (`:238`) + `dispatch(upsertConvoMessages)` (`:501`)
→ `convosSlice.upsertConvoMessages` writes `WickrMessage` (with `textContent`) into
`state.convos.all[vGroupID].messages` (`store/slices/convos/convosSlice.ts:111-130`)
→ rendered by the Convo components.

---

## 3. Q2 — what the JS store retains, and for how long [M]

Two JS-resident message stores, both holding full `WickrMessage` bodies (`textContent`), both
keyed by `vGroupID`:

**(a) Redux — the rendered window of the *active* conversation.**
`state.convos.all[vGroupID].messages : EntityState<WickrMessage>`
(`store/slices/convos/convosModels.ts:4-9`, `messagesAdapter.ts:4-23`). Initial load is 25
before + 25 after the unread marker (`store/thunks/messages.ts:90-92,154-155`); scrolling adds
25 at a time (`:94-96`). **On switching conversations, the conversation you leave has its
messages fully removed** — `dispatch(removeAllConvoMessages({vGroupID: currentActiveConvoId}))`
(`store/thunks/messages.ts:148`). A count-based trim facility exists
(`removeConvoMessagesByCount`, `convosSlice.ts:151-169`; reasons `trimLeading/TrailingMessages`,
`messagesAdapter.ts:15-16`). ⇒ Redux holds ≈ the currently-open conversation's loaded range.

**(b) `MessageCaches` — the durable, larger store.** A singleton created once as the default of
`MessageCachesContext` (`lib/cache/context.tsx:4`, `new MessageCaches()`), also handed to every
thunk as `extra.messageCaches` (`store/AppStoreProvider.tsx:46,63,80`).
- `MessageCaches` = `Map<vGroupID, MessageCache>`, capacity **`MAX_MESSAGE_CACHE_COUNT = 20`**
  conversations, LRU-evicted (`lib/cache/MessageCaches.ts:7,10,29-38`).
- Each `MessageCache` = `OrderedLinkedList<msgId, WickrMessage>`, capacity
  **`DEFAULT_MAX_CACHE_SIZE = 300`** messages, trimmed to 75% on overflow
  (`lib/cache/MessageCache.ts:5,25-34,88-100`).
- For **non-active** conversations, incoming messages update *only* this cache, not Redux —
  "if target convo id is not the active one, we only need to update cache"
  (`store/thunks/messages.ts:287-293`).
⇒ Durable JS message store ≈ **20 conversations × up to 300 messages ≈ 6,000 decrypted
messages**, LRU. This is the honest bound: *recently-viewed* conversations, not all history.

**Full bodies vs IDs:** full bodies (`textContent`) are stored, not just IDs.

**Lifetime / eviction [M]:**
- Logout: `logoutUser` calls `extra.messageCaches.clear()` then `resetSlice('*')`
  (`store/thunks/identity.ts:37-50`).
- Leaving the chat surface: `ChatContainer` unmount dispatches `logoutUser()` (prod) and
  `messageCaches.clear()` (`chat/components/ChatContainer/index.tsx:64-73`).
- Conversation deleted: `extra.messageCaches.delete(vGroupID)` (`store/thunks/convos.ts:67`).
- **Screen-lock: no JS-level clear found** — no `onLock`/`isLocked`/`autoLock` handler in
  `apis/webChannel` or `store` touches the caches/slices. If lock protects this memory it is a
  native behavior, out of source scope. **[M-negative]**

**Reachability (prod):** none of these are on a `window`/`globalThis` global — every
`Object.assign(globalThis, …)` that would expose a store, the message cache (`_msgCache`,
`MessageCaches.ts:27`), or the fetch internals (`_internal` with `getMessages*`,
`fetchInternal.ts:446-455`) is `__DEV__`-gated. They live on the Redux store object and the
React context, reachable by heap traversal, not by name. **[M]**

---

## 4. Q3 — surfaces that return message content [M]

Two distinct native pull surfaces are driven from the app document's JS:

**(a) The QWebChannel bridge (`WebChannelMessageBridge`, 148 callable, W18) returns NO message
bodies.** Its content-adjacent getters are metadata or canned text, not history:
| method (`apis/webChannel/BridgeWebChannel.ts`) | returns |
|---|---|
| `getQuickResponses(): Promise<{quickResponses:string[]}>` `:24` | user's canned replies (PII text) |
| `getActiveConvoInfo(): Promise<GetActiveConvoInfoResult>` `:64` | active convo id/metadata |
| `getBoundaryIds(payload): Promise<ConvoBoundaryIds>` `:28` | oldest/newest msg **ids** only |
| `messageUnreadCount(): Promise<UnreadMessagesCountPayload>` `:133` | counts |
| `getImagePreviewDetails(vgroupId,msgId)` (W18 `openFile` note) | one attachment's preview meta |
| `getUsersToManage(): Promise<GetUsersToManageResult>` `:180` | admin user list |
The rest are actions (`sendTextMessage :13`, `forwardMessage :220`, `starMessage`, `emojiReact`,
`deleteMessage`, `markMessageRead`, …). None pulls message text.

**(b) The `wickrweb://` URL-scheme handler (webFetch) IS the content-pull surface** — a separate
native handler, not a bridge method. A caller in the app document can request arbitrary
conversations/ranges (no windowing on the fetch itself). Routes (`apis/webFetch/endpoints.ts`):
| endpoint (`fetchRoutes`) | path | returns |
|---|---|---|
| `messages` `:17` | `/message/:convoId` | all messages of a convo |
| `message` `:18` | `/message/:convoId/:msgId` | one message |
| `paginatedMessages` `:19` | `/message/:convoId/:msgId/:before/:after` | arbitrary window |
| `messageImage` `:27` / `messageAudio` `:28` | `/image|audio/message/:convoId/:msgId` | attachment bytes |
| `fileData` `:29` | `/file/message/:convoId/:msgId` | file bytes |
| `roomSearch` `:47` | `/search` | search hits (incl. message text) |
| `contacts` `:52` / `directory` `:53` | `/contacts/...` | roster |
JS wrappers: `getMessages`, `getMessage`, `getPaginatedMessages` — `apis/webFetch/index.ts`,
`fetchInternal.ts` (`FetchWorkerMethodNames`, `:38-73`). **This is the surface that would let a
caller pull history beyond what is loaded.** Whether an *attacker's* frame can reach either
surface is unproven — see §7.

---

## 5. Q4 — other JS-resident data, and the key-material negative [M]

| data class | symbol / `file:line` | lifetime | plaintext to a heap reader? |
|---|---|---|---|
| Message bodies | `WickrMessage.textContent`; `convos.all[vg].messages`; `MessageCache` (`lib/cache/MessageCache.ts:25`) | active window + 20×300 LRU | **yes** |
| Contacts / display names | `state.users.all[idHash]: WickrUser` (`store/slices/users/usersSlice.ts:7,18`; `WickrUser`, `lib/protobuf/users.ts:45`) — idHash, username, displayName | session, reset on logout | **yes** (names/handles) |
| Convo / room metadata | `state.convos.all[vg]` — title, description, membersInfo, settings (`convosSlice.ts:49-84`) | session | **yes** |
| Quick responses | `settings`/bridge `getQuickResponses` (`BridgeWebChannel.ts:24`) | session | yes (PII text) |
| **AWS credentials** | `AwsCredentialsAuthService.currentCredentials` (`lib/awsAuth/AwsCredentialsAuthService.ts:9,71`) — `accessKeyId`, `secretAccessKey`, `expiration`; via `wickrweb://awsCredentials` (`fetchInternal.ts:374-382`) | while authenticated; proactively refreshed (`:88-120`); cleared on logout (`:122-125`) | **yes** — live keys |
| Device list | `settings.activeDevices` (`ChatAppSubscriptions`/`EnvironmentManager`) | session | yes (device ids) |

AWS creds scope: consumed only by **Bedrock AI** (`lib/bedrock/clients/BaseBedrockClient.ts:33`)
and **MCP knowledge-base tools** (`lib/mcp/tools/knowledgeBaseTools.ts:29,54`) via the singleton
`CompositeAuthService.getInstance()` (`lib/awsAuth/CompositeAuthService.ts:16,23`). Present only
when AI features are enabled/used.

### NOT in JS — key material (clean negative) [M]
`messageItemToWickrMessage` **deletes all key bytes before a message becomes a `WickrMessage`**
— `lib/protobuf/messages.ts:325-342`, with the comment *"Keys come with Uint8Arrays. We don't
need them…"*:
`file.fileMetadata.key`, `file.previewData.key`, `text.linkImageMeta.key`,
`callmessage.startInfo.meetingKey`, `control.update.activeMembers[].pubkey`,
`control.update.fileVaultInfo.key` + per-action `fileKey`, `control.leave.roomKey`,
`control.recoveryResponse`, `keyVerify.verifiedKey`.
Combined with the absence of any crypto primitive in `src/`, **no message/room/file keys, no
private keys, and no decryption state are retained in JS.** (Nuance: those key bytes exist
momentarily inside the freshly-decoded protobuf object *during* `messageItemToWickrMessage`,
before the `delete` runs; they are never stored, so only a read at that exact parse instant
could observe them.)

---

## 6. Q5 — attachments and media [M]

Default is **native reference by `wickrweb://` URL**, not JS bytes:
- Images: `imgSrc = wickrWebEndpoints.messageImage(vGroupID,msgId)` handed straight to
  `<img src>` — `components/Convo/ConvoMessageImageContent.tsx:29,75` (also search/preview
  `MessagePreview/attachmentUtils.tsx:63`, `SearchListItems/MessageSearchListItem.tsx:46`).
  Pixels decode in Blink's native image path, not a JS `ArrayBuffer`.
- Downloads: `downloadFile → extra.bridge.saveGeneralFile(payload)` — `store/thunks/files.ts:632`.
  Native save; no JS bytes.

Materialized in JS only **transiently**, while actively viewing:
- Audio playback: `URL.createObjectURL(data: Blob)` — `components/Audio/useAudioPlayer.ts:33`
  (audio bytes as a JS `Blob` for the lifetime of playback).
- Document preview: `response.arrayBuffer()` for docx/pptx/xlsx —
  `file-preview/components/DocPreview/index.tsx:52`, `PowerPointPreview/index.tsx:76`,
  `SpreadsheetPreview/index.tsx:27`. The full decrypted file is a JS `ArrayBuffer` while its
  preview is open (this is the same JS-side parsing surface as W19's pptx path).

---

## 7. For the next exploitation wave [M / I]

**Most valuable single traversal target from an `addrof`:** the **Redux store object** — one
object whose tree reaches everything sensitive at once:
`store.getState().convos.all[vg].messages.entities[msgId].textContent` (active convo plaintext),
`.users.all` (roster), `.settings`, `.session`. It is a singleton (`store/index.ts:48`) held by
the React `<Provider store>` and `store/context.ts`; from an in-cage read it is reachable by
walking a chat DOM node's `__reactFiber$*` → Provider fiber `memoizedProps.store` **[I — the
fiber offsets are not traced here]**. For **message volume** specifically, prefer the
`MessageCaches` singleton (up to ~6,000 messages vs the active window); it hangs off the same
store as `extra.messageCaches` (`store/AppStoreProvider.tsx:80`) and off `MessageCachesContext`
(`lib/cache/context.tsx:4`). For AWS creds, the `CompositeAuthService` static singleton
(`lib/awsAuth/CompositeAuthService.ts:16`). Note W35's content-scan already recovers plaintext
without a root, so a traversal is an optimization, not a prerequisite.

**Do-not-conclude (unproven, [I]):** driving either native content surface from the *attacker's*
frame is **not** demonstrated. W18 measured that cross-origin frames receive no
`qt.webChannelTransport`, so the 148 bridge methods are JS-unreachable from such a frame; the
`wickrweb://` scheme is likewise registered for the app origin and a cross-origin/opaque frame
is not shown able to fetch it. W35's primitive sits *below* that JS gate at the memory level —
so the realistic near-term impact is **reading** the app document's JS-resident plaintext
(§3–§6), not **pulling** fresh history via §4. Whether the memory primitive can be leveraged to
forge a call into the app document's transport is the open question to flag, not assert.
