import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class OvoparkApi implements ICredentialType {
	name = 'ovoparkApi';

	displayName = 'Ovopark API';

	documentationUrl = 'https://github.com/waywake/ovopark-sdk-ts#readme';

	properties: INodeProperties[] = [
		{
			displayName: 'Gateway URL',
			name: 'url',
			type: 'string',
			default: 'https://cloudapi.ovopark.com/cloud.api',
			required: true,
			description: 'The Ovopark open platform gateway URL.',
		},
		{
			displayName: 'App ID',
			name: 'appId',
			type: 'string',
			default: '',
			description: 'The AppID value sent as _aid. Leave empty to use the SDK default.',
		},
		{
			displayName: 'Access Key ID',
			name: 'accessKeyId',
			type: 'string',
			default: '',
			required: true,
			description: 'The AccessKey ID value sent as _akey.',
		},
		{
			displayName: 'Access Key Secret',
			name: 'accessKeySecret',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				password: true,
			},
			description: 'The AccessKey Secret used to generate _sig.',
		},
		{
			displayName: 'Version',
			name: 'version',
			type: 'string',
			default: 'v1',
			required: true,
			description: 'The gateway API version sent as _version.',
		},
		{
			displayName: 'Request Mode',
			name: 'requestMode',
			type: 'string',
			default: 'post',
			required: true,
			description: 'The request mode sent as _requestMode.',
		},
	];
}
