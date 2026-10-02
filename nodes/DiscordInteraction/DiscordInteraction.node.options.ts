import { INodeProperties } from 'n8n-workflow';

export const options: INodeProperties[] = [
    {
        displayName: 'Type',
        name: 'type',

        type: 'options',
        options: [
            {
                name: 'Action',
                value: 'action',
                description: 'Instead of sending a message, it will perform an action defined in the next field',
            },
            {
                name: 'Message',
                value: 'message',
                description: 'This is the default type, it allows you to send a message without requiering any form of response',
            },
            {
                name: 'Confirmation',
                value: 'confirm',
                description: 'Let \'s the user decide whether to continue the interaction',
            },
        ],
        default: 'message',
        description: 'Let you choose the type of interaction you want to perform',
    },
    {
        displayName: 'Action',
        name: 'actionType',

        displayOptions: {
            show: {
                type: [ 'action' ],
            },
        },
        type: 'options',
        options: [
            {
                name: 'Get Messages',
                value: 'getMessages',
                description: 'Get messages from a channel',
            },
            {
                name: 'Check Channel Status',
                value: 'checkChannelStatus',
                description: 'Check if a channel is disabled for triggers (support ticket system)',
            },
            {
                name: 'Toggle Channel Status',
                value: 'toggleChannelStatus',
                description: 'Enable or disable triggers for a channel (support ticket system)',
            },
            {
                name: 'Remove Messages',
                value: 'removeMessages',
                description: 'Remove last messages from the "send to" channel',
            },
            {
                name: 'Add Role to User',
                value: 'addRole',
                description: 'Add a role to a user',
            },
            {
                name: 'Remove Role From User',
                value: 'removeRole',
                description: 'Remove a role from a user',
            },
        ],
        default: 'removeMessages',
        description: 'Let you choose the type of action you want to perform',
    },

    // ── Channel destination ────────────────────────────────────────────────────
    {
        displayName: 'Send To',
        name: 'channelType',
        type: 'options',
        displayOptions: {
            show: {
                type: [ 'message', 'confirm' ],
            },
        },
        options: [
            {
                name: 'Guild Channel',
                value: 'guild',
                description: 'Send the message to a server text channel',
            },
            {
                name: 'Direct Message (DM)',
                value: 'dm',
                description: 'Send the message directly to a user via DM. Provide the DM channel ID.',
            },
        ],
        default: 'guild',
        description: 'Whether to send the message to a guild channel or directly to a user\'s DM',
    },

    // Guild channel fields (shown only when channelType = guild or not set, i.e. all actions)
    {
        displayName: 'Server Name or ID',
        name: 'guildIds',

        type: 'options',
        displayOptions: {
            show: {
                type: [ 'action' ],
            },
        },
        typeOptions: {
            loadOptionsMethod: 'getGuilds',
        },
        default: '',
        description: 'Let you specify the guild where you want the action to happen. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
    },
    {
        displayName: 'Server Name or ID',
        name: 'guildIds',

        type: 'options',
        displayOptions: {
            show: {
                type: [ 'message', 'confirm' ],
                channelType: [ 'guild' ],
            },
        },
        typeOptions: {
            loadOptionsMethod: 'getGuilds',
        },
        default: '',
        description: 'Let you specify the guild where you want to send the message. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
    },
    {
        displayName: 'Channel Name or ID',
        name: 'channelId',

        type: 'options',
        displayOptions: {
            show: {
                type: [ 'action' ],
            },
        },
        typeOptions: {
            loadOptionsDependsOn: [ 'guildIds' ],
            loadOptionsMethod: 'getChannels',
        },
        default: '',
        description: 'Let you specify the text channels where you want to send the message. Your credentials must be set and the bot running, you also need at least one text channel available. If you do not meet these requirements, make the changes then close and reopen the modal (the channels list is loaded when the modal opens). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
    },
    {
        displayName: 'Channel Name or ID',
        name: 'channelId',

        type: 'options',
        displayOptions: {
            show: {
                type: [ 'message', 'confirm' ],
                channelType: [ 'guild' ],
            },
        },
        typeOptions: {
            loadOptionsDependsOn: [ 'guildIds' ],
            loadOptionsMethod: 'getChannels',
        },
        default: '',
        description: 'Let you specify the text channel where you want to send the message. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
    },

    // DM channel ID field — shown only when channelType = dm
    {
        displayName: 'DM Channel ID',
        name: 'dmChannelId',
        type: 'string',
        displayOptions: {
            show: {
                type: [ 'message', 'confirm' ],
                channelType: [ 'dm' ],
            },
        },
        default: '',
        placeholder: 'e.g. 123456789012345678',
        description: 'The ID of the DM channel to send the message to. You can get this from the trigger node output (field <code>channelId</code> on a direct-message trigger) or from any Discord message object. This is the channel ID of the DM conversation, not the user ID.',
    },

    // ── Rest of options unchanged ──────────────────────────────────────────────

    {
        displayName: 'Message Limit',
        name: 'getMessagesLimit',
        type: 'number',
        required: true,
        displayOptions: {
            show: {
                type: [ 'action' ],
                actionType: [ 'getMessages' ],
            },
        },
        typeOptions: {
            maxValue: 100,
            minValue: 1,
        },
        default: 10,
        description: 'Number of messages to fetch (max 100)',
    },
    {
        displayName: 'Toggle Action',
        name: 'toggleAction',
        type: 'options',
        required: true,
        displayOptions: {
            show: {
                type: [ 'action' ],
                actionType: [ 'toggleChannelStatus' ],
            },
        },
        options: [
            {
                name: 'Close (Disable Triggers)',
                value: 'close',
                description: 'Disable all triggers for this channel',
            },
            {
                name: 'Open (Enable Triggers)',
                value: 'open',
                description: 'Enable all triggers for this channel',
            },
        ],
        default: 'close',
        description: 'Choose whether to enable or disable triggers for the channel',
    },
    {
        displayName: 'How Many?',
        name: 'removeMessagesNumber',
        type: 'number',
        required: true,
        displayOptions: {
            show: {
                type: [ 'action' ],
                actionType: [ 'removeMessages' ],
            },
        },
        typeOptions: {
            maxValue: 100,
            minValue: 1,
        },
        default: 1,
    },
    {
        displayName: 'User ID',
        name: 'userId',
        type: 'string',
        displayOptions: {
            show: {
                type: [ 'action' ],
                actionType: [ 'addRole', 'removeRole' ],
            },
        },
        default: '',
        description: 'The ID of the user to add/remove a role from',
    },
    {
        displayName: 'Role Names or IDs',
        name: 'roleUpdateIds',
        type: 'multiOptions',
        displayOptions: {
            show: {
                type: [ 'action' ],
                actionType: [ 'addRole', 'removeRole' ],
            },
        },
        typeOptions: {
            loadOptionsDependsOn: [ 'guildIds' ],
            loadOptionsMethod: 'getRoles',
        },
        default: [],
        description: 'Roles to add or remove. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
    },
    {
        displayName: 'Content',
        name: 'content',
        type: 'string',
        displayOptions: {
            show: {
                type: [ 'message', 'confirm' ],
            },
        },
        typeOptions: {
            rows: 4,
        },
        default: '',
        description: 'Displayed text message. Cannot be empty when using button/select prompt.',
    },
    {
        displayName: 'Embed',
        name: 'embed',
        type: 'boolean',
        displayOptions: {
            show: {
                type: [ 'message', 'confirm' ],
            },
        },
        default: false,
        description: 'Whether you want to create an embed message rather than a regular content message',
    },
    {
        displayName: 'Color',
        name: 'color',
        type: 'color',
        default: '',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
    },
    {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
        default: '',
    },
    {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
        default: '',
    },
    {
        displayName: 'Author Name',
        name: 'authorName',
        type: 'string',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
        default: '',
    },
    {
        displayName: 'Author Icon URL or Base64',
        name: 'authorIconUrl',
        type: 'string',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
        default: '',
    },
    {
        displayName: 'Author URL',
        name: 'authorUrl',
        type: 'string',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
        default: '',
    },
    {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
        typeOptions: {
            rows: 4,
        },
        default: '',
    },
    {
        displayName: 'Fields',
        name: 'fields',
        type: 'fixedCollection',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
        typeOptions: {
            multipleValues: true,
        },
        default: {},
        options: [
            {
                displayName: 'Field',
                name: 'field',
                values: [
                    {
                        displayName: 'Name',
                        name: 'name',
                        type: 'string',
                        default: '',
                    },
                    {
                        displayName: 'Value',
                        name: 'value',
                        type: 'string',
                        default: '',
                    },
                    {
                        displayName: 'Inline',
                        name: 'inline',
                        type: 'boolean',
                        default: false,
                    },
                ],
            },
        ],
    },
    {
        displayName: 'Image URL or Base64',
        name: 'imageUrl',
        type: 'string',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
        default: '',
    },
    {
        displayName: 'Thumbnail URL or Base64',
        name: 'thumbnailUrl',
        type: 'string',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
        default: '',
    },
    {
        displayName: 'Footer Text',
        name: 'footerText',
        type: 'string',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
        default: '',
    },
    {
        displayName: 'Footer Icon URL or Base64',
        name: 'footerIconUrl',
        type: 'string',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
        default: '',
    },
    {
        displayName: 'Timestamp',
        name: 'timestamp',
        type: 'string',
        displayOptions: {
            show: {
                embed: [ true ],
                type: [ 'message', 'confirm' ],
            },
        },
        default: '',
    },
    {
        displayName: 'Mention Roles',
        name: 'mentionRoles',
        type: 'multiOptions',
        displayOptions: {
            show: {
                type: [ 'message', 'confirm' ],
                channelType: [ 'guild' ],
            },
        },
        typeOptions: {
            loadOptionsDependsOn: [ 'guildIds' ],
            loadOptionsMethod: 'getRoles',
        },
        default: [],
        description: 'Roles to mention in the message. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
    },
    {
        displayName: 'Files',
        name: 'files',
        type: 'fixedCollection',
        displayOptions: {
            show: {
                type: [ 'message', 'confirm' ],
            },
        },
        typeOptions: {
            multipleValues: true,
        },
        default: {},
        options: [
            {
                displayName: 'File',
                name: 'file',
                values: [
                    {
                        displayName: 'URL',
                        name: 'url',
                        type: 'string',
                        default: '',
                        description: 'URL of the file to attach',
                    },
                ],
            },
        ],
    },
    {
        displayName: 'Additional Confirmation Fields',
        name: 'additionalConfirmationFields',
        type: 'collection',
        displayOptions: {
            show: {
                type: [ 'confirm' ],
            },
        },
        default: {},
        placeholder: 'Add Field',
        options: [
            {
                displayName: 'Timeout (seconds)',
                name: 'timeout',
                type: 'number',
                default: 60,
                description: 'Time in seconds to wait for a response before timing out',
            },
            {
                displayName: 'Yes Button Label',
                name: 'yesLabel',
                type: 'string',
                default: 'Yes',
            },
            {
                displayName: 'No Button Label',
                name: 'noLabel',
                type: 'string',
                default: 'No',
            },
        ],
    },
    {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        default: {},
        placeholder: 'Add Option',
        options: [
            {
                displayName: 'Debug Logging',
                name: 'debugLogging',
                type: 'boolean',
                default: false,
                description: 'Whether to write detailed logs for this node to the n8n server log, including message contents. Turn on only while troubleshooting.',
            },
        ],
    },
];
