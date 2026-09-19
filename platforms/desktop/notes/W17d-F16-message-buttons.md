# W17d — F16: message buttons perform sensitive actions as the victim, with an attacker-chosen label and no confirmation

**Date:** 2026-08-04 **Target:** AWS Wickr Desktop 6.72.20.0 (Windows x64)
**Source:** recovered application TypeScript (`scratch/w17/src/`) + the bundled
`@amzn/wickr-messaging-protocol-proto`.

**Attacker position: anyone who can send the victim a DM.** No bot, no network setting, no file.

---

## 1. The gate does not check the sender

`src/components/Convo/ConvoMessage.tsx:49-51`:

```ts
const botButtonsEnabledInRoom = useSetting('enableBotButtonsInRooms');
const botButtonsEnabled = convoType === WickrConvoType.DM ? true : botButtonsEnabledInRoom;
const showMessageButtonSet = message.text?.buttons?.button && isLastMessage && botButtonsEnabled;
```

* `buttons` is a field of the ordinary **text** message body in the protocol — nothing in this condition
  tests whether the sender is a bot.
* **In a DM the flag is hard-coded `true`.** The `enableBotButtonsInRooms` network setting gates rooms
  only.
* `isLastMessage` is satisfied by sending the message last.

## 2. What a button does when clicked — `src/components/Convo/MessageButtonSet.tsx:18-58`

Every label is `button.<kind>.text`, i.e. **chosen by the sender**, and every handler is wired directly
to `onClick` with no interstitial:

| kind | action on one click | confirmation |
|---|---|---|
| `msgButton` | `sendTextMessage({ message: button.msgButton.message, vgroupId: convoId })` — **the victim sends text the attacker wrote** | **none** |
| `dmButton` | `createDM({ message: msgToDM, userId: userAlias, userHash: idhash })` — opens/creates a DM with an **attacker-named third party** and pre-fills a draft with attacker text — **and** `sendTextMessage({ message: msgToSend })`, which **sends attacker text into the current conversation from the victim** | **none** |
| `urlButton` | `openLink({ link: url, showConfirmation: buttonLabel !== url })` | **attacker-controlled — see §3** |
| `locationButton` | `shareLocation()` → `uiBridge.shareLocation()` | native flow, not audited |

All four payload fields are declared `string` in the shipped protobuf
(`msgToDM`, `msgToSend`, `userAlias`, `idhash` — verified in
`@amzn/wickr-messaging-protocol-proto/dist/js/index.esm.js`).

## 3. The anti-phishing warning is switched off by the attacker

```ts
dispatch(openLink({
  link: button.urlButton?.url,
  showConfirmation: buttonLabel !== button.urlButton?.url,
}));
```

The intent is "if the label already *is* the URL, the user can see where they are going, so skip the
warning." **The sender controls both operands.** Setting `text` equal to `url` makes the comparison
false and the "You are leaving Wickr" dialog never appears.

The label is then rendered as the button's text, so the URL is nominally visible — but it is rendered
inside a fixed-width button, so a long URL is truncated and only its benign prefix is shown. The control
that exists to stop exactly this is disabled by data the attacker supplies.

## 4. Why this is worth reporting

Individually these are UI-integrity defects rather than memory-safety bugs, but the combination is
concrete: **a DM peer can render a button reading anything — "Close", "Decline", "View" — which on one
click sends a message from the victim's account, opens a DM with a third party the attacker names, or
navigates the victim to a URL with the safety interstitial suppressed.** No confirmation exists on any
of those paths.

## 5. VERIFICATION STATUS — read this before reporting

**VERIFIED (application source read directly):** the render condition and its DM hard-coding; every
handler and its lack of confirmation; the label's origin; the `showConfirmation` expression; the
protobuf field types.

**NOT VERIFIED, and it is the load-bearing assumption:** **that a message carrying `text.buttons` from a
non-bot sender survives the server and the native client and reaches the React layer.** The React code
performs no sender check, but a check could exist in the server or in `NPL`/`WickrPro` before the
message body is handed to the web UI. **Nothing here establishes that an ordinary peer can actually get
buttons rendered.** This is the same class of gap that produced the F12 withdrawal — the difference is
that it is being stated up front.

**How to close it, cheapest first:**
1. Search the native client for a bot check on the `buttons` field before the message is forwarded to
   the web layer (local work).
2. Send a crafted `MessageBody.Text` with a `buttons` field from a normal account and see whether the
   receiving client renders it (requires composing the protobuf; not reachable from the stock UI).

Until (1) or (2) is done, this is **"the client-side code applies no sender check and no confirmation"**
— which is reportable as written — and **not** "any peer can do this".
