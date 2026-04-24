import { fetch as undiciFetch } from "undici";

async function test(url: string) {
  console.log(`\nTesting ${url}`);
  try {
    const r = await undiciFetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-platform": "webclient",
        "x-api-realm": "edusp",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ token: "test" })
    });
    console.log("Status:", r.status);
    console.log("Text:", (await r.text()).substring(0, 500));
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

async function run() {
  await test("https://edusp-api.ip.tv/registration/edusp/token");
}

run();
