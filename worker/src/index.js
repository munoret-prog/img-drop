// img-drop worker
// Принимает multipart/form-data с полем "file", кладёт картинку в GitHub-репозиторий
// через Contents API и возвращает публичную ссылку на jsDelivr CDN.

const ALLOWED_ORIGIN = "https://munoret-prog.github.io";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function extFromType(type) {
  switch (type) {
    case "image/png": return "png";
    case "image/jpeg": return "jpg";
    case "image/gif": return "gif";
    case "image/webp": return "webp";
    case "image/svg+xml": return "svg";
    default: return "bin";
  }
}

function randomName(ext) {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 12);
  return `${Date.now().toString(36)}-${b64}.${ext}`;
}

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers });
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return new Response("Bad form data", { status: 400, headers });
    }

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return new Response("Missing file", { status: 400, headers });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return new Response("Unsupported file type", { status: 400, headers });
    }
    if (file.size > MAX_BYTES) {
      return new Response("File too large", { status: 400, headers });
    }

    const buf = await file.arrayBuffer();
    const base64 = bufferToBase64(buf);
    const name = randomName(extFromType(file.type));
    const path = `images/${name}`;

    const ghResp = await fetch(
      `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "img-drop-worker",
        },
        body: JSON.stringify({
          message: `upload ${name}`,
          content: base64,
          branch: env.GITHUB_BRANCH || "main",
        }),
      }
    );

    if (!ghResp.ok) {
      const errText = await ghResp.text();
      return new Response(`GitHub error ${ghResp.status}: ${errText.slice(0, 300)}`, {
        status: 502,
        headers,
      });
    }

    const branch = env.GITHUB_BRANCH || "main";
    const url = `https://cdn.jsdelivr.net/gh/${env.GITHUB_OWNER}/${env.GITHUB_REPO}@${branch}/${path}`;

    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  },
};
