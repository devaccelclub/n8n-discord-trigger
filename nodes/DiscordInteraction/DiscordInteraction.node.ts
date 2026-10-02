import {
    type INodeType,
    type INodeExecutionData,
    type INodeTypeDescription,
    type INodePropertyOptions,
    type IExecuteFunctions,
    type INodeParameters,
    INodeOutputConfiguration,
    NodeOperationError,
} from 'n8n-workflow';
import { options } from './DiscordInteraction.node.options';
import ipc from 'node-ipc';
import {
    connection,
    ICredentials,
    getChannels as getChannelsHelper,
    getRoles as getRolesHelper,
    getGuilds as getGuildsHelper,
    toggleChannelStatus,
    checkChannelStatus,
    getMessages as getMessagesHelper,
} from '../helper';
import { debugLog } from '../logger';

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


export interface IDiscordInteractionMessageParameters {
    token: string;
    executionId: string;
    triggerPlaceholder: boolean;
    triggerChannel: boolean;
    channelType: 'guild' | 'dm';  // NEW: destination selector
    channelId: string;             // guild channel ID (used when channelType = 'guild')
    dmChannelId: string;           // DM channel ID (used when channelType = 'dm')
    effectiveChannelId: string;    // resolved channel ID sent to bot (set at runtime)
    embed: boolean;
    title: string;
    description: string;
    url: string;
    color: string;
    timestamp: string;
    footerText: string;
    footerIconUrl: string;
    imageUrl: string;
    thumbnailUrl: string;
    authorName: string;
    authorIconUrl: string;
    authorUrl: string;
    fields: {
        field?: {
            name: string;
            value: string;
            inline: boolean;
        }[];
    };
    mentionRoles: string[];
    content: string;
    files: {
        file?: {
            url: string;
        }[];
    };
    options?: {
        debugLogging?: boolean;
    };
}


export interface IDiscordNodeActionParameters {
    executionId: string;
    triggerPlaceholder: boolean;
    triggerChannel: boolean;
    channelId: string;
    guildId: string;
    apiKey: string;
    baseUrl: string;
    actionType: string;
    removeMessagesNumber: number;
    userId?: string;
    roleUpdateIds?: string[] | string;
    options?: {
        debugLogging?: boolean;
    };
}


const configuredOutputs = (parameters: INodeParameters) => {
    const mode = parameters.type as string;

    if (mode === 'confirm') {
        return [
            { displayName: 'confirm', type: 'main' },
            { displayName: 'cancel', type: 'main' },
            { displayName: 'no response', type: 'main' },
        ] as INodeOutputConfiguration[];
    } else {
        return [{ type: 'main' }] as INodeOutputConfiguration[];
    }
};


export class DiscordInteraction implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Discord Interaction',
        name: 'discordInteraction',
        group: ['input'],
        version: 1,
        description: 'Sends messages, embeds and prompts to Discord',
        defaults: {
            name: 'Discord Interaction',
        },
        icon: 'file:discord-logo.svg',
        inputs: ['main'],
        outputs: `={{(${configuredOutputs})($parameter)}}`,
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
            async getChannels(): Promise<INodePropertyOptions[]> {
                // @ts-ignore
                const selectedGuilds = this.getNodeParameter('guildIds', []);
                debugLog(false, "selectedGuilds", selectedGuilds);

                if (!selectedGuilds.length) {
                    // @ts-ignore
                    throw new NodeOperationError('Please select at least one server before choosing channels.');
                }

                return await getChannelsHelper(this, selectedGuilds).catch((e) => e);
            },
            async getRoles(): Promise<INodePropertyOptions[]> {
                // @ts-ignore
                const selectedGuilds = this.getNodeParameter('guildIds', []);
                debugLog(false, "selectedGuilds", selectedGuilds);

                if (!selectedGuilds.length) {
                    // @ts-ignore
                    throw new NodeOperationError('Please select at least one server before choosing channels.');
                }
                return await getRolesHelper(this, selectedGuilds).catch((e) => e);
            },
            async getGuilds(): Promise<INodePropertyOptions[]> {
                return await getGuildsHelper(this).catch((e) => e);
            },
        },
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {

        // @ts-ignore
        const executionId = this.getExecutionId();

        // fetch credentials
        const credentials = (await this.getCredentials('discordBotTriggerApi').catch((e) => e)) as any as ICredentials;

        // create connection to bot.
        await connection(credentials).catch((e) => {
            console.log(e);
            if (this.getNodeParameter('type', 0) === 'confirm') {
                const returnData: INodeExecutionData[][] = [[], [], []];
                returnData[2] = this.getInputData();
                return returnData;
            } else {
                return this.prepareOutputData(this.getInputData());
            }
        });

        if (this.getNodeParameter('type', 0) === 'confirm') {
            const returnData: INodeExecutionData[][] = [[], [], []];
            // create connection to bot.
            await connection(credentials).catch((e) => {
                console.log(e);
                returnData[2] = this.getInputData();
                return returnData;
            });

            // Prepare the node parameters to send to the bot
            const nodeParameters: Record<string, any> = {};
            Object.keys(this.getNode().parameters).forEach((key) => {
                nodeParameters[key] = this.getNodeParameter(key, 0, '');
            });

            // Resolve the effective channel ID before sending to bot
            nodeParameters.effectiveChannelId = resolveChannelId(nodeParameters);

            // Safe defaults for prepareMessage()
            nodeParameters.mentionRoles = nodeParameters.mentionRoles || [];
            nodeParameters.fields = nodeParameters.fields?.field
                ? nodeParameters.fields
                : { field: [] };
            nodeParameters.files = nodeParameters.files?.file
                ? nodeParameters.files
                : { file: [] };

            const response: any = await new Promise((resolve) => {
                ipc.config.retry = 1500;
                configureIpc();
                ipc.connectTo('bot', () => {
                    const type = `send:confirmation`;
                    ipc.of.bot.on(`callback:send:confirmation`, (data: any) => {
                        debugLog(nodeParameters.options?.debugLogging, "user decided", data);
                        resolve(data);
                    });

                    // send event to bot
                    ipc.of.bot.emit(type, {nodeParameters: nodeParameters, token: credentials.token});
                });
            });
            debugLog(nodeParameters.options?.debugLogging, 'Confirmation response:', response);

            if (response.confirmed === null)
                returnData[2] = this.getInputData();
            else if(response.confirmed === true)
                returnData[0] = this.getInputData();
            else
                returnData[1] = this.getInputData();

            return returnData;

        } else {
            const returnData: INodeExecutionData[] = [];
            // iterate over all nodes
            const items: INodeExecutionData[] = this.getInputData();
            for (let itemIndex: number = 0; itemIndex < items.length; itemIndex++) {
                const nodeParameters: any = {};
                Object.keys(this.getNode().parameters).forEach((key) => {
                    nodeParameters[key] = this.getNodeParameter(key, itemIndex, '') as any;
                });
                nodeParameters.executionId = executionId;

                // Resolve effective channel ID for action and message types
                if (nodeParameters.type === 'message') {
                    nodeParameters.effectiveChannelId = resolveChannelId(nodeParameters);
                }

                // Ensure array/collection fields always have safe defaults so
                // prepareMessage() in bot.ts never calls .forEach() on undefined.
                // mentionRoles is hidden in DM mode so arrives as undefined.
                nodeParameters.mentionRoles = nodeParameters.mentionRoles || [];
                nodeParameters.fields = nodeParameters.fields?.field
                    ? nodeParameters.fields
                    : { field: [] };
                nodeParameters.files = nodeParameters.files?.file
                    ? nodeParameters.files
                    : { file: [] };

                // Handle helper-based actions (toggleChannelStatus, checkChannelStatus, getMessages)
                // that bypass IPC and call the Discord API directly via helper functions.
                if (nodeParameters.type === 'action') {
                    if (nodeParameters.actionType === 'toggleChannelStatus') {
                        const result = await toggleChannelStatus(
                            nodeParameters.channelId,
                            nodeParameters.toggleAction,
                        ).catch((e: any) => e);
                        returnData.push({ json: result || {} });
                        continue;
                    }

                    if (nodeParameters.actionType === 'checkChannelStatus') {
                        const result = await checkChannelStatus(
                            nodeParameters.channelId,
                        ).catch((e: any) => e);
                        returnData.push({ json: result || {} });
                        continue;
                    }

                    if (nodeParameters.actionType === 'getMessages') {
                        const result = await getMessagesHelper(
                            credentials.token,
                            nodeParameters.channelId,
                            nodeParameters.getMessagesLimit,
                            nodeParameters.options?.debugLogging,
                        ).catch((e: any) => e);
                        if (result?.messages) {
                            result.messages.forEach((message: any) => {
                                returnData.push({ json: message });
                            });
                        } else {
                            returnData.push({ json: result || {} });
                        }
                        continue;
                    }
                }

                if (nodeParameters.channelId || nodeParameters.effectiveChannelId || nodeParameters.executionId) {
                    // return the interaction result if there is one
                    const res: any = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            console.log('IPC timeout after 30 seconds');
                            // NOTE: do NOT call ipc.disconnect('bot') here — the trigger nodes
                            // share this socket and disconnecting would kill their listeners
                            reject(new Error('IPC timeout after 30 seconds'));
                        }, 30000);

                        ipc.config.retry = 1500;
                        ipc.config.maxRetries = 3;
                        configureIpc();

                        const type = `send:${nodeParameters.type}`;
                        let callbackReceived = false;

                        ipc.connectTo('bot', () => {
                            // Setup callback listener first
                            ipc.of.bot.on(`callback:${type}`, (data: any) => {
                                if (!callbackReceived) {
                                    callbackReceived = true;
                                    clearTimeout(timeout);
                                    debugLog(nodeParameters.options?.debugLogging, 'Received callback:', type, data);
                                    // NOTE: do NOT disconnect — shared socket with trigger nodes
                                    resolve(data);
                                }
                            });

                            // Emit directly in connectTo callback (not inside 'connect' event)
                            // to avoid race condition where 'connect' never fires on reused sockets
                            debugLog(nodeParameters.options?.debugLogging, 'Connected to bot IPC, emitting event:', type, nodeParameters);
                            ipc.of.bot.emit(type, {token: credentials.token, nodeParameters: nodeParameters});

                            ipc.of.bot.on('disconnect', () => {
                                if (!callbackReceived) {
                                    clearTimeout(timeout);
                                    console.log('Disconnected from IPC before receiving callback');
                                    reject(new Error('Disconnected from IPC'));
                                }
                            });
                        });
                    }).catch((e) => {
                        console.log('IPC Error:', e);
                        // NOTE: do NOT disconnect — shared socket with trigger nodes
                        return null;
                    });

                    // Handle getMessages response with multiple messages
                    if (res?.action === 'getMessages' && res?.messages) {
                        // Return each message as a separate item
                        res.messages.forEach((message: any) => {
                            returnData.push({
                                json: message,
                            });
                        });
                    } else {
                        // Handle other actions normally
                        returnData.push({
                            json: {
                                value: res?.value,
                                channelId: res?.channelId,
                                userId: res?.userId,
                                userName: res?.userName,
                                userTag: res?.userTag,
                                messageId: res?.messageId,
                                action: res?.action,
                                ...res,
                            },
                        });
                    }
                }
            }

            return this.prepareOutputData(returnData);
        }
    }
}

/**
 * Resolves the effective channel ID to use for sending a message.
 * For guild channel mode: uses channelId (selected from dropdown).
 * For DM mode: uses dmChannelId (entered manually by the user).
 * Falls back to channelId if channelType is not set (backwards compatibility).
 */
function resolveChannelId(nodeParameters: any): string {
    if (nodeParameters.channelType === 'dm') {
        return nodeParameters.dmChannelId || '';
    }
    return nodeParameters.channelId || '';
}