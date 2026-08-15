import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { parseMarkdown, hasMath, isSafeUrl } = require("../source/js/ai-markdown.js");
const source = await readFile(new URL("../source/js/ai-markdown.js", import.meta.url), "utf8");

let pass = 0;
let fail = 0;

function t(name, ok) {
  ok ? pass++ : fail++;
  console.log("[" + (ok ? "PASS" : "FAIL") + "] " + name);
}

const firstBlock = (md) => parseMarkdown(md)[0];
const children = (md) => (firstBlock(md) || {}).children || [];
const childTypes = (md) => children(md).map((c) => c.type);

/* ---------------- 普通文本 ---------------- */

t("plain text -> single paragraph with one text token",
  childTypes("hello world").length === 1 &&
  children("hello world")[0].type === "text" &&
  children("hello world")[0].text === "hello world");

t("multi-line plain text keeps newlines inside one paragraph",
  firstBlock("a\nb").type === "paragraph" &&
  children("a\nb").some((c) => c.type === "text" && c.text.indexOf("\n") !== -1));

/* ---------------- Markdown 粗体 / 斜体 / 行内代码 ---------------- */

t("**bold** -> strong",
  childTypes("**bold**")[0] === "strong" &&
  children("**bold**")[0].children[0].text === "bold");

t("*italic* -> em",
  childTypes("*italic*")[0] === "em" &&
  children("*italic*")[0].children[0].text === "italic");

t("`code` -> inline code token",
  childTypes("`x = 1`")[0] === "code" &&
  children("`x = 1`")[0].text === "x = 1");

t("a * b is NOT parsed as italic (space after *)",
  childTypes("a * b").length === 1 && childTypes("a * b")[0] === "text");

/* ---------------- 代码块 ---------------- */

t("fenced code block -> code block with lang and text",
  firstBlock("```js\nvar x = 1;\n```").type === "code" &&
  firstBlock("```js\nvar x = 1;\n```").lang === "js" &&
  firstBlock("```js\nvar x = 1;\n```").text === "var x = 1;");

t("code block text preserves <script> literally (no HTML interpretation)",
  firstBlock("```html\n<script>alert(1)</script>\n```").text === "<script>alert(1)</script>");

/* ---------------- 列表 ---------------- */

t("unordered list -> 2 items",
  firstBlock("- a\n- b").type === "list" &&
  firstBlock("- a\n- b").ordered === false &&
  firstBlock("- a\n- b").items.length === 2);

t("ordered list -> ordered + 2 items",
  firstBlock("1. a\n2. b").type === "list" &&
  firstBlock("1. a\n2. b").ordered === true &&
  firstBlock("1. a\n2. b").items.length === 2);

/* ---------------- 标题 ---------------- */

t("## Title -> heading level 2",
  firstBlock("## Title").type === "heading" &&
  firstBlock("## Title").level === 2 &&
  firstBlock("## Title").children[0].text === "Title");

/* ---------------- 链接（安全） ---------------- */

t("safe https link -> link token",
  childTypes("[x](https://example.com)")[0] === "link" &&
  children("[x](https://example.com)")[0].href === "https://example.com");

t("relative link -> link token",
  childTypes("[x](/about/)")[0] === "link" &&
  children("[x](/about/)")[0].href === "/about/");

t("javascript: link is rejected -> plain text",
  childTypes("[x](javascript:alert(1))")[0] === "text");

t("isSafeUrl blocks dangerous schemes",
  isSafeUrl("javascript:alert(1)") === false &&
  isSafeUrl("data:text/html,<script>") === false &&
  isSafeUrl("vbscript:msgbox(1)") === false &&
  isSafeUrl("https://ok.com") === true &&
  isSafeUrl("/about/") === true);

/* ---------------- LaTeX 公式 ---------------- */

t("\\(x\\) inline math -> math token display=false",
  childTypes("\\(x\\)")[0] === "math" &&
  children("\\(x\\)")[0].display === false);

t("\\[x\\] block math -> math block display=true",
  firstBlock("\\[x\\]").type === "math" &&
  firstBlock("\\[x\\]").display === true);

t("$$x$$ block math -> math block display=true",
  firstBlock("$$x$$").type === "math" &&
  firstBlock("$$x$$").display === true);

t("inline $$x$$ mid-paragraph -> math token display=true",
  (() => {
    const m = children("a $$x$$ b").find((c) => c.type === "math");
    return !!m && m.display === true;
  })());

t("$x$ inline math -> math token display=false",
  childTypes("$x$")[0] === "math" &&
  children("$x$")[0].display === false);

t("multi-line $$..$$ gathered as one display math block",
  firstBlock("$$\na + b\n$$").type === "math" &&
  firstBlock("$$\na + b\n$$").display === true);

t("hasMath detects LaTeX delimiters, not currency",
  hasMath("\\(x\\)") === true &&
  hasMath("$$x$$") === true &&
  hasMath("$x$") === true &&
  hasMath("hello") === false &&
  hasMath("$5 and $10") === false);

/* ---------------- bug 示例：公式与粗体混合 ---------------- */

t("bug example: bold + inline math + block math",
  (() => {
    const md = "**建立闭环约束方程**…\n\\( U_i=[a_{ix},a_{iy},q_i]^T \\)\n\\[ \\|B_i-U_i\\|=L_i \\]";
    const blocks = parseMarkdown(md);
    const para = blocks[0];
    const inlineMath = (para.children || []).find((c) => c.type === "math");
    return blocks.length === 2 &&
      para.type === "paragraph" &&
      para.children[0].type === "strong" &&
      inlineMath && inlineMath.display === false &&
      blocks[1].type === "math" && blocks[1].display === true;
  })());

/* ---------------- XSS 安全 ---------------- */

t("<script> in plain text stays a text token (never HTML)",
  childTypes("<script>alert(1)</script>").length === 1 &&
  childTypes("<script>alert(1)</script>")[0] === "text" &&
  children("<script>alert(1)</script>")[0].text === "<script>alert(1)</script>");

t("<img onerror> stays a text token (never HTML)",
  childTypes("<img src=x onerror=alert(1)>")[0] === "text");

t("renderer source contains NO .innerHTML usage",
  /\.innerHTML/.test(source) === false);

t("renderer source uses createTextNode / textContent (safe DOM)",
  source.includes("createTextNode") === true && source.includes("textContent") === true);

console.log("\n" + pass + "/" + (pass + fail) + " passed");
process.exitCode = fail > 0 ? 1 : 0;
