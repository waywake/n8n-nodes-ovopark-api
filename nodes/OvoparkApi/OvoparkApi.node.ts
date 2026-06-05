import type {
	IExecuteFunctions,
	IDataObject,
	INode,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	GenericValue,
} from 'n8n-workflow';
import type { SignableParams, SignableValue } from '@waywake/ovopark-sdk';
import { OpenPlatform } from '@waywake/ovopark-sdk';
import { createHash } from 'node:crypto';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const SSO_LOGIN_METHOD = 'open.shopweb.security.ssoLogin';

export class OvoparkApi implements INodeType {
	description: INodeTypeDescription = {
		displayName: '万店掌 API',
		name: 'ovoparkApi',
		icon: 'file:ovopark.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] }}',
		description: '万店掌开放平台 API',
		defaults: {
			name: '万店掌 API',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'ovoparkApi',
				required: true,
			},
			{
				name: 'ovoparkUserApi',
				required: true,
				displayOptions: {
					show: {
						operation: ['getUserToken'],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Call API',
						value: 'callApi',
						description: 'Call an Ovopark API method',
						action: 'Call API',
					},
					{
						name: 'Get User Token',
						value: 'getUserToken',
						description: 'Get an Ovo-Authorization user token',
						action: 'Get user token',
					},
				],
				default: 'callApi',
			},
			{
				displayName: 'Method',
				name: 'method',
				type: 'string',
				default: '',
				required: true,
				description: 'The Ovopark API method name sent as _mt',
				placeholder: 'open.organize.departments.getDepartments',
				displayOptions: {
					show: {
						operation: ['callApi'],
					},
				},
			},
			{
				displayName: 'Request Parameters',
				name: 'params',
				type: 'json',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: '{}',
				description: 'Business parameters to sign and send with the gateway request',
				displayOptions: {
					show: {
						operation: ['callApi'],
					},
				},
			},
			{
				displayName: 'Timeout',
				name: 'timeoutMs',
				type: 'number',
				default: 30000,
				description: 'Request timeout in milliseconds. Use 0 to disable timeout.',
				typeOptions: {
					minValue: 0,
				},
			},
			{
				displayName: 'Additional Headers',
				name: 'headers',
				type: 'json',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: '{}',
				description: 'Additional HTTP headers to send with the request',
				displayOptions: {
					show: {
						operation: ['callApi'],
					},
				},
			},
			{
				displayName: 'Ovo Authorization',
				name: 'authorization',
				type: 'string',
				default: '',
				typeOptions: {
					password: true,
				},
				description:
					'Short-lived Ovo-Authorization header value for APIs that require a login token',
				displayOptions: {
					show: {
						operation: ['callApi'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('ovoparkApi');
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const timeoutMs = this.getNodeParameter('timeoutMs', itemIndex) as number;

				const result =
					operation === 'getUserToken'
						? await getUserToken.call(this, credentials, timeoutMs, itemIndex)
						: await callApi.call(this, credentials, timeoutMs, itemIndex);

				returnData.push({
					json: toJsonObject(result),
					pairedItem: {
						item: itemIndex,
					},
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: getErrorMessage(error),
						},
						pairedItem: {
							item: itemIndex,
						},
					});
					continue;
				}

				if (error instanceof NodeOperationError) {
					throw error;
				}

				throw new NodeOperationError(this.getNode(), getErrorMessage(error), {
					itemIndex,
				});
			}
		}

		return [returnData];
	}
}

async function callApi(
	this: IExecuteFunctions,
	credentials: Record<string, unknown>,
	timeoutMs: number,
	itemIndex: number,
): Promise<unknown> {
	const method = (this.getNodeParameter('method', itemIndex) as string).trim();

	if (!method) {
		throw new NodeOperationError(this.getNode(), 'Method cannot be empty.', {
			itemIndex,
		});
	}

	const client = createClient(credentials, method, this.getNode(), itemIndex);
	const params = toSignableParams(
		parseJsonObject(
			this.getNodeParameter('params', itemIndex),
			'Request Parameters',
			this.getNode(),
			itemIndex,
		),
	);
	const headers = parseHeaders(
		this.getNodeParameter('headers', itemIndex),
		getOptionalCredential(this.getNodeParameter('authorization', itemIndex)),
		this.getNode(),
		itemIndex,
	);

	return await client.request(params, {
		headers,
		timeoutMs,
	});
}

async function getUserToken(
	this: IExecuteFunctions,
	credentials: Record<string, unknown>,
	timeoutMs: number,
	itemIndex: number,
): Promise<IDataObject> {
	const userCredentials = await this.getCredentials('ovoparkUserApi');
	const username = getRequiredCredential(
		userCredentials.username,
		'Username',
		this.getNode(),
		itemIndex,
	);
	const password = getRequiredCredential(
		userCredentials.password,
		'Password',
		this.getNode(),
		itemIndex,
	);
	const client = createClient(credentials, SSO_LOGIN_METHOD, this.getNode(), itemIndex);
	const response = await client.request<IDataObject>(
		{
			userName: username,
			password: md5Hex(password),
		},
		{
			timeoutMs,
		},
	);
	const data = response.data as IDataObject | undefined;
	const token = getOptionalCredential(data?.token);

	if (!token) {
		throw new NodeOperationError(
			this.getNode(),
			`ssoLogin did not return data.token: ${JSON.stringify(response)}`,
			{
				itemIndex,
			},
		);
	}

	return {
		...response,
		ovoAuthorization: token,
		token,
		tokenExpirationTimestamp: data?.tokenExpirationTimestamp as GenericValue,
		tokenExpirationSurplusTimestamp: data?.tokenExpirationSurplusTimestamp as GenericValue,
	};
}

function createClient(
	credentials: Record<string, unknown>,
	method: string,
	node: INode,
	itemIndex: number,
): OpenPlatform {
	return new OpenPlatform({
		url: getRequiredCredential(credentials.url, 'Gateway URL', node, itemIndex),
		aid: getOptionalCredential(credentials.appId),
		akey: getRequiredCredential(credentials.accessKeyId, 'Access Key ID', node, itemIndex),
		asecret: getRequiredCredential(
			credentials.accessKeySecret,
			'Access Key Secret',
			node,
			itemIndex,
		),
		mt: method,
		version: getRequiredCredential(credentials.version, 'Version', node, itemIndex),
		requestMode: getRequiredCredential(credentials.requestMode, 'Request Mode', node, itemIndex),
	});
}

function parseJsonObject(
	value: unknown,
	fieldName: string,
	node: INode,
	itemIndex: number,
): Record<string, unknown> {
	let parsed: unknown;

	try {
		parsed = typeof value === 'string' ? JSON.parse(value) : value;
	} catch (error) {
		throw new NodeOperationError(
			node,
			`${fieldName} must be valid JSON: ${getErrorMessage(error)}`,
			{
				itemIndex,
			},
		);
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new NodeOperationError(node, `${fieldName} must be a JSON object`, {
			itemIndex,
		});
	}

	return parsed as Record<string, unknown>;
}

function parseHeaders(
	value: unknown,
	authorization: string | undefined,
	node: INode,
	itemIndex: number,
): Record<string, string> {
	const headers = parseJsonObject(value, 'Additional Headers', node, itemIndex);
	const normalized: Record<string, string> = {};

	for (const [key, headerValue] of Object.entries(headers)) {
		if (headerValue === undefined || headerValue === null) {
			continue;
		}

		normalized[key] = String(headerValue);
	}

	if (authorization) {
		normalized['Ovo-Authorization'] = authorization;
	}

	return normalized;
}

function toSignableParams(params: Record<string, unknown>): SignableParams {
	const signableParams: SignableParams = {};

	for (const [key, value] of Object.entries(params)) {
		signableParams[key] = toSignableValue(value);
	}

	return signableParams;
}

function toSignableValue(value: unknown): SignableValue {
	if (value === null || value === undefined) {
		return value;
	}

	if (
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean' ||
		typeof value === 'bigint'
	) {
		return value;
	}

	if (value instanceof Date) {
		return value;
	}

	return JSON.stringify(value);
}

function toJsonObject(value: unknown): IDataObject {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return value as IDataObject;
	}

	if (Array.isArray(value)) {
		return {
			data: value as IDataObject[] | GenericValue[],
		};
	}

	if (typeof value === 'bigint') {
		return {
			data: value.toString(),
		};
	}

	return {
		data: value as GenericValue,
	};
}

function getRequiredCredential(
	value: unknown,
	name: string,
	node: INode,
	itemIndex: number,
): string {
	const credential = getOptionalCredential(value);

	if (!credential) {
		throw new NodeOperationError(node, `${name} credential cannot be empty`, {
			itemIndex,
		});
	}

	return credential;
}

function getOptionalCredential(value: unknown): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}

	const credential = String(value).trim();

	return credential || undefined;
}

function md5Hex(value: string): string {
	return createHash('md5').update(value, 'utf8').digest('hex');
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}
