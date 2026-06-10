# Musk OS Chat

一个基于 Next.js 的 AI 对话页面，用智谱 GLM 接口驱动，并把本地 `elon-musk-skill-main` 的马斯克思维框架整理成服务端系统提示词。

## 本地运行

1. 安装依赖：

```bash
npm install
```

2. 配置 `.env`：

```bash
ZHIPU_API_KEY=你的智谱 API Key
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_MODEL=glm-5.1
ZHIPU_THINKING_TYPE=disabled
ZHIPU_TEMPERATURE=0.72
ZHIPU_MAX_TOKENS=1800
```

3. 启动：

```bash
npm run dev
```

访问 `http://localhost:3000`。

## Vercel 部署

在 Vercel 项目的 Environment Variables 中添加同名变量：

- `ZHIPU_API_KEY`
- `ZHIPU_BASE_URL`
- `ZHIPU_MODEL`
- `ZHIPU_THINKING_TYPE`
- `ZHIPU_TEMPERATURE`
- `ZHIPU_MAX_TOKENS`

`ZHIPU_THINKING_TYPE=disabled` 会关闭模型深度思考。API Key 只在服务端 `app/api/chat/route.ts` 使用，不会暴露到浏览器。
