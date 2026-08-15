import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../source/js/ai-assistant.js", import.meta.url), "utf8");
let pass = 0;
let fail = 0;

function test(name, ok) {
  ok ? pass++ : fail++;
  console.log("[" + (ok ? "PASS" : "FAIL") + "] " + name);
}

test("production default calls same-origin assistant API", source.includes("var API_URL = '/api/assistant'") && source.includes("fetch(API_URL"));
test("demo requires explicit development configuration", source.includes("config.environment === 'development' && config.demoMode === true"));
test("request sends question", source.includes("question: question"));
test("request sends conversation history", source.includes("conversation: history"));
test("request sends current page path", source.includes("page_context: { url: window.location.pathname }"));
test("request is abortable", source.includes("signal: abortController.signal"));
test("MathJax lazy-loads with the safe extension (blocks javascript:/data: URLs)", source.includes("ui/safe") && source.includes("tex-svg.js"));

console.log("\n" + pass + "/" + (pass + fail) + " passed");
process.exitCode = fail > 0 ? 1 : 0;
