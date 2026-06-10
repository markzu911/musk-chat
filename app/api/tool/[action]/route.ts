export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ToolAction = "launch" | "verify" | "consume";

const DEFAULT_SAAS_BASE_URL = "http://aibigtree.com";
const ALLOWED_ACTIONS = new Set<ToolAction>(["launch", "verify", "consume"]);

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: createCorsHeaders()
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> }
) {
  const { action } = await context.params;

  if (!isToolAction(action)) {
    return Response.json(
      { success: false, message: "不支持的积分接口。" },
      { status: 404, headers: createCorsHeaders() }
    );
  }

  const payload = await request.json().catch(() => null);
  const userId = readValidId(payload, "userId");
  const toolId = readValidId(payload, "toolId");

  if (!userId || !toolId) {
    return Response.json(
      { success: false, message: "缺少有效的 userId 或 toolId。" },
      { status: 400, headers: createCorsHeaders() }
    );
  }

  const baseUrl = normalizeBaseUrl(
    process.env.SAAS_API_BASE_URL ?? DEFAULT_SAAS_BASE_URL
  );

  try {
    const response = await fetch(`${baseUrl}/api/tool/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, toolId })
    });
    const data = await response.json().catch(() => ({
      success: false,
      message: "积分接口返回格式错误。"
    }));

    return Response.json(data, {
      status: response.status,
      headers: createCorsHeaders()
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "积分代理转发失败。"
      },
      { status: 502, headers: createCorsHeaders() }
    );
  }
}

function createCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Security-Policy": "frame-ancestors *"
  };
}

function isToolAction(action: string): action is ToolAction {
  return ALLOWED_ACTIONS.has(action as ToolAction);
}

function readValidId(payload: unknown, key: "userId" | "toolId") {
  if (!payload || typeof payload !== "object" || !(key in payload)) {
    return "";
  }

  const value = (payload as Record<string, unknown>)[key];

  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized === "null" ||
    normalized === "undefined"
  ) {
    return "";
  }

  return normalized;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}
