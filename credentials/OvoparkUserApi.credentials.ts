import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class OvoparkUserApi implements ICredentialType {
	name = 'ovoparkUserApi';

	displayName = 'Ovopark User API';

	documentationUrl = 'https://github.com/waywake/ovopark-sdk-ts#readme';

	properties: INodeProperties[] = [
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'The Ovopark username used for SSO login.',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				password: true,
			},
			description: 'The Ovopark password. The node sends its MD5 hash to the gateway.',
		},
	];
}
