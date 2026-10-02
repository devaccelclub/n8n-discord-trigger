# Changelog

## 0.19.2 — 2026-10-03

### Logging

- **Debug output is now off by default.** The content of every message the bots receive, per-message trigger traces, IPC request and response dumps, channel lists and voice connection internals are no longer written to the log. Startup, login, lock and shutdown messages, warnings and errors are still logged.
- **New "Debug Logging" option** to turn detailed output back on while troubleshooting:
  - Discord Trigger → Additional Fields. While the trigger is active, this also logs every message its bot receives (not only the ones that match), so you can see why a trigger did not fire.
  - Discord Voice Trigger → Additional Options.
  - Discord Interaction → Options.
- **`DISCORD_TRIGGER_DEBUG=true`** environment variable turns on all debug output, including shared bot messages that do not belong to a single node. It takes effect after restarting n8n.
- Debug lines start with `[discord-debug]`, so they are easy to filter.
- An error while deleting messages no longer dumps the whole Discord client object into the log.

## 0.19.1 — 2026-10-02

> **Code base:** this release is built from this fork (`devaccelclub/n8n-discord-trigger`), which branched from upstream **v0.11.6**. The version number continues from the latest upstream npm release (v0.19.0) so it replaces that install. The upstream changes from v0.11.7 to v0.19.0 are **not** included. See [Upstream v0.11.7–v0.19.0](#upstream-v0117v0190) below.

### Security

- **Fixed: Discord users could crash the whole n8n instance.**
  - Removed the process-wide `uncaughtException` handlers in `bot.ts` and `botSingleton.ts` that called `process.exit(1)`. n8n's own handler already reports uncaught errors and keeps running; these handlers turned any stray error into a full shutdown.
  - The Confirm prompt no longer throws when it ends. Before, an unanswered prompt crashed n8n at timeout instead of using the "no response" output.
  - The Voice Trigger no longer throws when it receives a voice error (for example, when someone joins a voice channel the bot cannot connect to). In test runs the error is shown in the editor; for active workflows it is logged.
- **Fixed: file attachments could read any file on the n8n server.** A file URL that was not `http(s)://` was treated as a local path and uploaded to Discord (for example `~/.n8n/config`, which holds the credentials encryption key). File URLs must now be `https://` or `data:` URIs; anything else makes the send fail with an error.
- **Fixed: the bot token was written to the logs** on every message sent, every confirmation, on client errors and on shutdown. Those log lines now show the bot's client or user ID instead.

### Breaking changes

- Files sent from plain `http://` URLs are now rejected. Use `https://` URLs or `data:` URIs.

### Dependencies

- Removed `@discordjs/opus`. Nothing in this package uses it, and it has to be compiled during install (Python and build tools), which fails in the official n8n Docker image on Node 26.
- When installing manually with npm, add `--ignore-scripts`. npm also installs the peer dependency `n8n-workflow`, which pulls in `isolated-vm`; that package tries to compile itself on Node versions it has no prebuilt binary for. This package never loads it, so skipping the compile step is safe.

### Changes in this fork since v0.11.6

- **Send to DMs:** Discord Interaction has a new destination selector (`channelType`: server channel or DM) with a `dmChannelId` field. DM channels are fetched from Discord instead of read from the cache.
- **IPC fixes:** trigger nodes keep their own listeners and remove only those when deactivated, instead of piling up listeners; fixed IPC socket misuse, missing null checks and undefined field defaults in Discord Interaction; fixed wrong arguments passed to helper functions.
- **Bot startup lock:** if another process holds the bot lock, the bot retries every 15 seconds (up to 20 times) and takes over when the holder is gone. On Linux/macOS the lock is treated as stale when the holder process is gone, or when its IPC socket is missing or refuses connections; this clears a stale lock left behind by a container restart. A holder that is only slow to respond keeps the lock, and a leftover socket file is removed only when the new holder starts its own IPC server.

### Known issues

- **Voice recording does not work.** The audio buffer loses its type when sent between processes, so the Voice Trigger's `audioData` field contains `[object Object]` instead of audio. Do not use the Voice Trigger's recording mode; its voice-state mode is not affected.

### Upstream v0.11.7–v0.19.0

Upstream published v0.11.7–v0.19.0 to npm only; its GitHub repository stops at v0.11.6. Comparing the published packages:

- The bot code in v0.19.0 is identical to v0.11.6.
- The Voice Trigger outputs recordings as n8n binary data (`binary.audio`), but the bot never sends audio in the format it expects, so voice recording does not work in upstream v0.19.0 either.
- A new ffmpeg-based voice recorder module and backup files are included but not used.
- Discord's DAVE voice encryption is listed as an upstream feature. This release supports it too: `@discordjs/voice` (0.19.2 at the time of writing) installs `@snazzah/davey` itself.

Node parameters are the same as upstream v0.19.0 apart from the DM fields above, so existing workflows load without changes.
