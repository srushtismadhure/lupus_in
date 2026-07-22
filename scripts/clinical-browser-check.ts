const DEVTOOLS_URL = process.env.DEVTOOLS_URL ?? "http://127.0.0.1:9223";
const APP_URL = process.env.APP_URL ?? "http://localhost:3002";

type PendingRequest = { resolve: (value: Record<string, unknown>) => void; reject: (reason: Error) => void };

class ChromePage {
  private readonly socket: WebSocket;
  private readonly pending = new Map<number, PendingRequest>();
  private nextId = 1;
  readonly errors: string[] = [];

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        method?: string;
        params?: Record<string, unknown>;
        result?: Record<string, unknown>;
        error?: { message?: string };
      };
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message ?? "Chrome request failed"));
        else pending.resolve(message.result ?? {});
      } else if (message.method === "Runtime.exceptionThrown") {
        this.errors.push(JSON.stringify(message.params ?? {}));
      } else if (message.method === "Log.entryAdded") {
        const entry = message.params?.entry as { level?: string; text?: string } | undefined;
        if (entry?.level === "error") this.errors.push(entry.text ?? "Browser error");
      }
    });
  }

  static async connect(url: string) {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("Unable to connect to Chrome")), { once: true });
    });
    return new ChromePage(socket);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression: string): Promise<any> {
    const response = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    return (response.result as { value?: unknown } | undefined)?.value;
  }

  async navigate(path: string) {
    await this.send("Page.navigate", { url: `${APP_URL}${path}` });
    const started = Date.now();
    while (Date.now() - started < 15_000) {
      const state = await this.evaluate(`({ ready: document.readyState, text: document.body?.innerText ?? "" })`);
      const waiting = /loading|evaluating renal monitoring/i.test(state.text);
      if (state.ready === "complete" && !waiting) return;
      await Bun.sleep(300);
    }
  }

  async screenshot(path: string) {
    const response = await this.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    if (typeof response.data !== "string") throw new Error("Chrome did not return screenshot data");
    await Bun.write(path, Buffer.from(response.data, "base64"));
  }

  close() {
    this.socket.close();
  }
}

const MADISON_ID = "a40f6629-abe0-48d2-acbf-8df0055f3f68";
const OLIVIA_ID = "815aee67-810e-468b-8c16-7e9aa60d2758";
const targets = (await fetch(`${DEVTOOLS_URL}/json`).then(response => response.json())) as Array<{ type: string; webSocketDebuggerUrl?: string }>;
const target = targets.find(item => item.type === "page" && item.webSocketDebuggerUrl);
if (!target?.webSocketDebuggerUrl) throw new Error("No Chrome page target was available");

const page = await ChromePage.connect(target.webSocketDebuggerUrl);
await page.send("Page.enable");
await page.send("Runtime.enable");
await page.send("Log.enable");
await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

await page.navigate("/login");
await page.evaluate(`fetch('/api/demo-login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ role: 'clinician' })
}).then(response => response.json())`);

const patientChecks: Array<Record<string, unknown>> = [];
for (const [name, patientId] of [["Madison Grace", MADISON_ID], ["Olivia Bennett", OLIVIA_ID]]) {
  await page.navigate(`/patients/${patientId}`);
  const result = await page.evaluate(`(() => {
    const text = document.body.innerText;
    return {
      heading: document.querySelector('h1')?.textContent?.trim(),
      hasPatient: text.includes(${JSON.stringify(name)}),
      hasCdsPanel: text.includes('automatic patient-view simulation'),
      cdsCompleted: text.includes('No actionable renal monitoring concerns identified.') || text.includes('Worsening renal trend requires review') || text.includes('Renal monitoring overdue'),
      cdsError: text.includes('Retry CDS assessment'),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
    };
  })()`);
  patientChecks.push({ patientId, name, ...result });
}

await page.navigate(`/sle-systems-review?patientId=${MADISON_ID}`);
const patientListStarted = Date.now();
while (Date.now() - patientListStarted < 15_000) {
  const ready = await page.evaluate(`document.querySelectorAll('#sle-patient-select option').length > 1`);
  if (ready) break;
  await Bun.sleep(300);
}
await page.screenshot("/tmp/luppedin-sle-review.png");
const sleCheck = await page.evaluate(`(() => {
  const text = document.body.innerText;
  const regionButtons = [...document.querySelectorAll('[aria-label*="Click to review"]')];
  const clickedRegions = regionButtons.map(button => {
    button.click();
    return button.getAttribute('aria-label')?.split('.')[0];
  });
  return {
    patient: document.querySelector('#sle-patient-select')?.value,
    bodyRegions: regionButtons.length,
    clickedRegions,
    hasStructuredReview: text.toLowerCase().includes('structured sle systems review'),
    hasNoRiskPercentage: !/\\bRisk\\s*\\d+%/i.test(text),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
  };
})()`);

await page.evaluate(`(() => {
  const select = document.querySelector('#sle-patient-select');
  select.value = ${JSON.stringify(OLIVIA_ID)};
  select.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
const switchStarted = Date.now();
while (Date.now() - switchStarted < 15_000) {
  const switched = await page.evaluate(`document.body.innerText.includes('Olivia Bennett') && document.querySelector('#sle-patient-select')?.value === ${JSON.stringify(OLIVIA_ID)}`);
  if (switched) break;
  await Bun.sleep(300);
}
const switchedPatient = await page.evaluate(`({ value: document.querySelector('#sle-patient-select')?.value, hasOlivia: document.body.innerText.includes('Olivia Bennett') })`);

page.close();
console.log(JSON.stringify({ strictModeEnabledInEntryPoint: true, patients: patientChecks, sleReview: { ...sleCheck, switchedPatient }, consoleErrors: page.errors }, null, 2));
