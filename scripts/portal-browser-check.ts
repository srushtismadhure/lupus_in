const DEVTOOLS_URL = process.env.DEVTOOLS_URL ?? "http://127.0.0.1:9223";
const APP_URL = process.env.APP_URL ?? "http://localhost:3002";

type CdpMessage = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message?: string };
};

class CdpClient {
  private readonly socket: WebSocket;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (reason: Error) => void }>();
  readonly consoleErrors: string[] = [];

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (message.id) {
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message ?? "Chrome DevTools request failed"));
        else request.resolve(message.result ?? {});
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.consoleErrors.push(JSON.stringify(message.params ?? {}));
      }
      if (message.method === "Log.entryAdded") {
        const entry = message.params?.entry as { level?: string; text?: string } | undefined;
        if (entry?.level === "error") this.consoleErrors.push(entry.text ?? "Browser log error");
      }
    });
  }

  static async connect(webSocketDebuggerUrl: string): Promise<CdpClient> {
    const socket = new WebSocket(webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("Unable to connect to Chrome DevTools")), { once: true });
    });
    return new CdpClient(socket);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function waitForPage(client: CdpClient, timeoutMs = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await evaluate(client, `({ ready: document.readyState, loading: document.body?.innerText.toLowerCase().includes("loading") ?? true })`);
    if (result.ready === "complete" && !result.loading) return;
    await Bun.sleep(300);
  }
}

async function evaluate(client: CdpClient, expression: string): Promise<any> {
  const response = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  const result = response.result as { value?: unknown; description?: string } | undefined;
  return result?.value;
}

async function navigate(client: CdpClient, path: string) {
  await client.send("Page.navigate", { url: `${APP_URL}${path}` });
  await waitForPage(client);
}

async function capture(client: CdpClient, path: string) {
  const response = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const data = response.data;
  if (typeof data !== "string") throw new Error("Chrome did not return screenshot data");
  await Bun.write(path, Buffer.from(data, "base64"));
}

async function inspect(client: CdpClient) {
  return evaluate(
    client,
    `(() => {
      const interactive = [...document.querySelectorAll('button, a, input, select, textarea')];
      const undersized = interactive.map(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 60) || element.getAttribute('name') || element.tagName,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
        };
      }).filter(item => item.visible && (item.width < 44 || item.height < 44));
      return {
        href: location.href,
        title: document.querySelector('h1')?.textContent?.trim() || document.title,
        text: document.body.innerText.slice(0, 1400),
        viewport: { width: innerWidth, height: innerHeight },
        documentSize: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        brokenImages: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).map(image => image.alt || image.src),
        unlabeledControls: interactive.filter(element => {
          if (element.tagName === 'A' || element.textContent?.trim()) return false;
          return !element.getAttribute('aria-label') && !element.getAttribute('title');
        }).map(element => element.outerHTML.slice(0, 160)),
        undersized
      };
    })()`,
  );
}

const targets = (await fetch(`${DEVTOOLS_URL}/json`).then(response => response.json())) as Array<{ type: string; webSocketDebuggerUrl?: string }>;
const target = targets.find(item => item.type === "page" && item.webSocketDebuggerUrl);
if (!target?.webSocketDebuggerUrl) throw new Error("No Chrome page target was available");

const client = await CdpClient.connect(target.webSocketDebuggerUrl);
await client.send("Page.enable");
await client.send("Runtime.enable");
await client.send("Log.enable");

await navigate(client, "/login");
await evaluate(
  client,
  `fetch('/api/demo-login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'patient' })
  }).then(response => response.json())`,
);

await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await navigate(client, "/portal");
await capture(client, "/tmp/luppedin-portal-desktop.png");
const desktop = await inspect(client);

await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await navigate(client, "/portal");
await capture(client, "/tmp/luppedin-portal-mobile.png");
const mobile = await inspect(client);

const routes = ["/portal/lupus", "/portal/labs", "/portal/nutrition", "/portal/care-plan", "/portal/appointments", "/portal/medications", "/portal/messages", "/portal/care-team", "/portal/documents", "/portal/profile", "/portal/help"];
const routeChecks: Array<Record<string, unknown>> = [];
for (const route of routes) {
  await navigate(client, route);
  const page = await inspect(client);
  routeChecks.push({ route, title: page.title, horizontalOverflow: page.horizontalOverflow, brokenImages: page.brokenImages, text: page.text.slice(0, 240) });
}

client.close();
console.log(JSON.stringify({ desktop, mobile, routes: routeChecks, consoleErrors: client.consoleErrors }, null, 2));
