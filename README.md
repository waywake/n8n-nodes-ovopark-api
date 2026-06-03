# @waywake/n8n-nodes-ovopark-api

万店掌开放平台 n8n community node，底层通过 `@waywake/ovopark-sdk` 调用网关。

## 功能

- 使用 `OpenPlatform` SDK 自动生成 `_sig` 并提交表单请求
- 支持自定义网关 URL、App ID、AccessKey ID、AccessKey Secret、版本和请求模式
- 支持独立的 `Get User Token` 操作，通过用户名密码获取短期 `Ovo-Authorization`
- 支持在节点参数中传入短期有效的 `Ovo-Authorization` 请求头
- 支持每个输入 item 通过表达式传入不同 API 方法和业务参数
- 使用 Bun 管理依赖并通过 `bun build` 打包节点

## 开发

```bash
bun install
bun run typecheck
bun run lint
bun run build
```

构建产物输出到 `dist`，n8n 会加载：

- `dist/credentials/OvoparkApi.credentials.js`
- `dist/credentials/OvoparkUserApi.credentials.js`
- `dist/nodes/OvoparkApi/OvoparkApi.node.js`

## 节点参数

Ovopark API Credentials:

- `Gateway URL`: 默认 `https://cloudapi.ovopark.com/cloud.api`
- `App ID`: 对应 `_aid`，留空时使用 SDK 默认值
- `Access Key ID`: 对应 `_akey`
- `Access Key Secret`: 用于生成 `_sig`
- `Version`: 对应 `_version`，默认 `v1`
- `Request Mode`: 对应 `_requestMode`，默认 `post`

Ovopark User API Credentials:

- `Username`: 万店掌用户名
- `Password`: 万店掌密码，节点会按 SDK 示例转换为 MD5 后发送

Node:

- `Operation`: `Call API` 或 `Get User Token`
- `Method`: API 方法名，对应 `_mt`
- `Request Parameters`: 业务参数 JSON object
- `Timeout`: 请求超时时间，单位毫秒，`0` 表示禁用超时
- `Additional Headers`: 额外请求头 JSON object
- `Ovo Authorization`: 短期有效 token，可用表达式从上游登录结果传入，发送为 `Ovo-Authorization` header

`Get User Token` 会调用 `open.shopweb.security.ssoLogin`，并输出 `ovoAuthorization` 字段，可在后续 `Call API` 节点中通过表达式引用。

## 示例

Method:

```text
open.organize.departments.getDepartments
```

Request Parameters:

```json
{
	"pageNumber": "1",
	"pageSize": "20"
}
```

## License

[MIT](LICENSE.md)
