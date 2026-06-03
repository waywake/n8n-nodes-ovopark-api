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
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class OvoparkApi implements INodeType {
	description: INodeTypeDescription = {
		displayName: '万店掌 API',
		name: 'ovoparkApi',
		icon: 'file:ovopark.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["method"] }}',
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
		],
		properties: [
			{
				displayName: 'Method',
				name: 'method',
				type: 'string',
				default: '',
				required: true,
				description: 'The Ovopark API method name sent as _mt',
				placeholder: 'open.organize.departments.getDepartments',
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
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const credentials = await this.getCredentials('ovoparkApi');
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const method = this.getNodeParameter('method', itemIndex) as string;

				if (!method.trim()) {
					throw new NodeOperationError(this.getNode(), 'Method cannot be empty.', {
						itemIndex,
					});
				}

				const client = new OpenPlatform({
					url: getRequiredCredential(credentials.url, 'Gateway URL', this.getNode(), itemIndex),
					aid: getOptionalCredential(credentials.appId),
					akey: getRequiredCredential(
						credentials.accessKeyId,
						'Access Key ID',
						this.getNode(),
						itemIndex,
					),
					asecret: getRequiredCredential(
						credentials.accessKeySecret,
						'Access Key Secret',
						this.getNode(),
						itemIndex,
					),
					mt: method,
					version: getRequiredCredential(credentials.version, 'Version', this.getNode(), itemIndex),
					requestMode: getRequiredCredential(
						credentials.requestMode,
						'Request Mode',
						this.getNode(),
						itemIndex,
					),
				});

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
					getOptionalCredential(credentials.authorization),
					this.getNode(),
					itemIndex,
				);
				const timeoutMs = this.getNodeParameter('timeoutMs', itemIndex) as number;

				const result = await client.request(params, {
					headers,
					timeoutMs,
				});

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

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}
