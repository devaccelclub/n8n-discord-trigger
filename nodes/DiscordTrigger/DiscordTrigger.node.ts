import {
    type INodeType,
    type INodeTypeDescription,
    type ITriggerFunctions,
    type ITriggerResponse,
    type INodePropertyOptions,
    NodeOperationError,
} from 'n8n-workflow';
import { options } from './DiscordTrigger.node.options';
import bot from '../bot';
import ipc from 'node-ipc';
import {
    connection,
    ICredentials,
    getChannels as getChannelsHelper,
    getRoles as getRolesHelper,
    getGuilds as getGuildsHelper,
    getCategories as getCategoriesHelper,
} from '../helper';
import settings from '../settings';

// Configure IPC for cross-platform compatibility
function configureIpc() {
    if (process.platform === 'win32') {
        ipc.config.socketRoot = '\\\\.\\pipe\\';
        ipc.config.appspace = '';
    } else {
        // Unix-like systems (Linux, macOS)
        ipc.config.socketRoot = '/tmp/';
        ipc.config.appspace = 'app.';
    }
}

// we start the bot if we are in the main process or if we're running on a Unix system
// Use a global flag to ensure we only start the bot once
if (!(global as any).__discordBotStarted) {
    if (!process.send || process.platform !== 'win32') {
        console.log('Starting Discord bot IPC server...');
        bot().catch(err => console.error('Error starting Discord bot:', err));
        (global as any).__discordBotStarted = true;
    }
}

// Module-level registry of IPC listeners keyed by nodeId.
// Each activation stores its named handler functions here so closeFunction
// can remove exactly those handlers — and nothing belonging to other nodes.
const nodeListeners: Map<string, Record<string, (...args: any[]) => void>> = new Map();

export class DiscordTrigger implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Discord Trigger',
        name: 'discordTrigger',
        group: ['trigger'],
        version: 1,
        description: 'Discord Trigger on message',
        defaults: {
            name: 'Discord Trigger',
        },
        icon: 'file:discord-logo.svg',
        inputs: [],
        outputs: ['main'],
        credentials: [
            {
                name: 'discordBotTriggerApi',
                required: true,
            },
        ],
        properties: options,
    };

    methods = {
        loadOptions: {
            async getGuilds(): Promise<INodePropertyOptions[]> {
                return await getGuildsHelper(this).catch((e) => e) as { name: string; value: string }[];
            },
            async getChannels(): Promise<INodePropertyOptions[]> {
                // @ts-ignore
                const selectedGuilds = this.getNodeParameter('guildIds', []);
                if (!selectedGuilds.length) {
                    // @ts-ignore
                    throw new NodeOperationError('Please select at least one server before choosing channels.');
                }

                return await getChannelsHelper(this, selectedGuilds).catch((e) => e) as { name: string; value: string }[];
            },
            async getRoles(): Promise<INodePropertyOptions[]> {
                // @ts-ignore
                const selectedGuilds = this.getNodeParameter('guildIds', []);
                if (!selectedGuilds.length) {
                    // @ts-ignore
                    throw new NodeOperationError('Please select at least one server before choosing channels.');
                }

                return await getRolesHelper(this, selectedGuilds).catch((e) => e) as { name: string; value: string }[];
            },
            async getCategories(): Promise<INodePropertyOptions[]> {
                // @ts-ignore
                const selectedGuilds = this.getNodeParameter('guildIds', []);
                if (!selectedGuilds.length) {
                    // @ts-ignore
                    throw new NodeOperationError('Please select at least one server before choosing categories.');
                }

                return await getCategoriesHelper(this, selectedGuilds).catch((e) => e) as { name: string; value: string }[];
            },
        },
    };

    async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {

        const credentials = (await this.getCredentials('discordBotTriggerApi').catch((e) => e)) as any as ICredentials;

        if (!credentials?.token) {
            console.log("No token given.");
            return {};
        }

        await connection(credentials).catch((e) => e);

        const nodeId = this.getNode().id;

        // If this node was previously activated (e.g. workflow edited and re-saved),
        // remove its old listeners before registering new ones. This prevents
        // duplicate firings when the same nodeId is activated more than once.
        if (nodeListeners.has(nodeId)) {
            console.log(`Removing stale IPC listeners for node ${nodeId} before re-registering`);
            const stale = nodeListeners.get(nodeId)!;
            for (const [event, handler] of Object.entries(stale)) {
                ipc.of.bot.off(event, handler);
            }
            nodeListeners.delete(nodeId);
        }

        configureIpc();
        ipc.connectTo('bot', () => {
            console.log('Connected to IPC server');

            const parameters: any = {};
            Object.keys(this.getNode().parameters).forEach((key) => {
                parameters[key] = this.getNodeParameter(key, '') as any;
            });

            ipc.of.bot.emit('triggerNodeRegistered', {
                parameters,
                active: this.getWorkflow().active,
                credentials,
                token: credentials.token,
                nodeId,
            });

            // ── Named handler functions ───────────────────────────────────────────
            // Each handler is stored by name so it can be individually removed in
            // closeFunction. Using named functions (not inline arrows) also makes
            // stack traces readable.

            const onMessageCreate = ({ message, author, guild, nodeId: eventNodeId, messageReference, attachments, referenceAuthor, memberRoles }: any) => {
                if (nodeId !== eventNodeId) return;
                console.log("received messageCreate event", message.id);

                const messageCreateOptions: any = {
                    id: message.id,
                    content: message.content,
                    guildId: guild?.id,
                    channelId: message.channelId,
                    authorId: author.id,
                    authorName: author.username,
                    timestamp: message.createdTimestamp,
                    listenValue: this.getNodeParameter('value', ''),
                    authorIsBot: author.bot || author.system,
                    memberRoles: memberRoles || [],
                    referenceId: null,
                    referenceContent: null,
                    referenceAuthorId: null,
                    referenceAuthorName: null,
                    referenceTimestamp: null,
                };

                if (messageReference) {
                    messageCreateOptions.referenceId = messageReference.id;
                    messageCreateOptions.referenceContent = messageReference.content;
                    messageCreateOptions.referenceAuthorId = referenceAuthor.id;
                    messageCreateOptions.referenceAuthorName = referenceAuthor.username;
                    messageCreateOptions.referenceTimestamp = messageReference.createdTimestamp;
                }

                if (attachments) {
                    messageCreateOptions.attachments = attachments;
                }

                this.emit([this.helpers.returnJsonArray(messageCreateOptions)]);
            };

            const onGuildMemberAdd = ({ guildMember, guild, user, nodeId: eventNodeId }: any) => {
                if (nodeId !== eventNodeId) return;
                this.emit([this.helpers.returnJsonArray(guildMember)]);
            };

            const onGuildMemberRemove = ({ guildMember, guild, user, nodeId: eventNodeId }: any) => {
                if (nodeId !== eventNodeId) return;
                this.emit([this.helpers.returnJsonArray(guildMember)]);
            };

            const onGuildMemberUpdate = ({ oldMember, newMember, guild, nodeId: eventNodeId }: any) => {
                if (nodeId !== eventNodeId) return;
                const addPrefix = (obj: any, prefix: string) =>
                    Object.fromEntries(Object.entries(obj).map(([key, value]) => [`${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`, value]));
                const mergedGuildMemberUpdateOptions: any = {
                    ...addPrefix(oldMember, "old"),
                    ...addPrefix(newMember, "new"),
                    ...addPrefix(guild, "guild"),
                };
                this.emit([this.helpers.returnJsonArray(mergedGuildMemberUpdateOptions)]);
            };

            const onMessageReactionAdd = ({ messageReaction, message, user, guild, nodeId: eventNodeId }: any) => {
                if (nodeId !== eventNodeId) return;
                this.emit([this.helpers.returnJsonArray({ ...messageReaction, ...user, channelId: message.channelId, guildId: guild.id })]);
            };

            const onMessageReactionRemove = ({ messageReaction, message, user, guild, nodeId: eventNodeId }: any) => {
                if (nodeId !== eventNodeId) return;
                this.emit([this.helpers.returnJsonArray({ ...messageReaction, ...user, channelId: message.channelId, guildId: guild.id })]);
            };

            const onRoleCreate = ({ role, guild, nodeId: eventNodeId }: any) => {
                if (nodeId !== eventNodeId) return;
                this.emit([this.helpers.returnJsonArray(role)]);
            };

            const onRoleDelete = ({ role, guild, nodeId: eventNodeId }: any) => {
                if (nodeId !== eventNodeId) return;
                this.emit([this.helpers.returnJsonArray(role)]);
            };

            const onRoleUpdate = ({ oldRole, newRole, guild, nodeId: eventNodeId }: any) => {
                if (nodeId !== eventNodeId) return;
                const addPrefix = (obj: any, prefix: string) =>
                    Object.fromEntries(Object.entries(obj).map(([key, value]) => [`${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`, value]));
                const mergedRoleOptions: any = {
                    ...addPrefix(oldRole, "old"),
                    ...addPrefix(newRole, "new"),
                };
                this.emit([this.helpers.returnJsonArray(mergedRoleOptions)]);
            };

            const onDisconnect = () => {
                console.error('Disconnected from IPC server');
            };

            // Register all handlers
            ipc.of.bot.on('messageCreate', onMessageCreate);
            ipc.of.bot.on('guildMemberAdd', onGuildMemberAdd);
            ipc.of.bot.on('guildMemberRemove', onGuildMemberRemove);
            ipc.of.bot.on('guildMemberUpdate', onGuildMemberUpdate);
            ipc.of.bot.on('messageReactionAdd', onMessageReactionAdd);
            ipc.of.bot.on('messageReactionRemove', onMessageReactionRemove);
            ipc.of.bot.on('roleCreate', onRoleCreate);
            ipc.of.bot.on('roleDelete', onRoleDelete);
            ipc.of.bot.on('roleUpdate', onRoleUpdate);
            ipc.of.bot.on('disconnect', onDisconnect);

            // Store handlers in module-level registry so closeFunction can remove
            // exactly this node's handlers without touching any other node's handlers.
            nodeListeners.set(nodeId, {
                messageCreate: onMessageCreate,
                guildMemberAdd: onGuildMemberAdd,
                guildMemberRemove: onGuildMemberRemove,
                guildMemberUpdate: onGuildMemberUpdate,
                messageReactionAdd: onMessageReactionAdd,
                messageReactionRemove: onMessageReactionRemove,
                roleCreate: onRoleCreate,
                roleDelete: onRoleDelete,
                roleUpdate: onRoleUpdate,
                disconnect: onDisconnect,
            });

            console.log(`Registered ${nodeListeners.size} active Discord trigger node(s) total`);
        });

        // Return the cleanup function
        return {
            closeFunction: async () => {
                console.log(`Removing trigger node ${nodeId}`);

                // Remove only this node's IPC listeners — other nodes are unaffected
                const handlers = nodeListeners.get(nodeId);
                if (handlers) {
                    for (const [event, handler] of Object.entries(handlers)) {
                        ipc.of.bot.off(event, handler);
                    }
                    nodeListeners.delete(nodeId);
                    console.log(`Removed IPC listeners for node ${nodeId}. Remaining active nodes: ${nodeListeners.size}`);
                }

                delete settings.triggerNodes[nodeId];

                // Notify bot process to deregister this node's server-side routing
                configureIpc();
                ipc.connectTo('bot', () => {
                    ipc.of.bot.emit('triggerNodeRemoved', { nodeId });
                });

                // Note: We do NOT disconnect from IPC here because:
                // 1. Other trigger/action nodes might still need the bot IPC server
                // 2. The bot process should keep running for action nodes
                // 3. IPC disconnect would break any in-flight action requests
                console.log('Trigger node removed, keeping bot IPC server running for other nodes');
            },
        };
    }
}
