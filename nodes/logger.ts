// Debug output (message contents, per-event traces, voice connection internals) is off by
// default: it is high-volume and can contain private data. It can be turned on per node with
// the "Debug Logging" option, or for the whole package with DISCORD_TRIGGER_DEBUG=true.
// Errors, warnings and one-off startup messages are always logged.
const debugFromEnv = /^(1|true|yes|on)$/i.test(process.env.DISCORD_TRIGGER_DEBUG ?? '');

export function isDebug(enabled?: boolean): boolean {
    return debugFromEnv || !!enabled;
}

// Logs only when `enabled` (usually a node's "Debug Logging" option) is true, or debugging is
// on globally. Pass `false` for messages that should only appear with DISCORD_TRIGGER_DEBUG.
export function debugLog(enabled: boolean | undefined, ...args: unknown[]): void {
    if (isDebug(enabled)) {
        console.log('[discord-debug]', ...args);
    }
}
