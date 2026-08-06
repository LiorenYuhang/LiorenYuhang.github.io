const fs = require("fs");
const path = require("path");
const src = path.resolve(__dirname, "..", "source", "_routes.json");
const dst = path.resolve(__dirname, "..", "public", "_routes.json");
if (!fs.existsSync(src)) { console.error("ERROR: source/_routes.json not found"); process.exit(1); }
fs.copyFileSync(src, dst);
console.log("_routes.json copied to public/");
const content = JSON.parse(fs.readFileSync(dst, "utf-8"));
if (content.version !== 1 || !content.include || content.include[0] !== "/api/*") {
  console.error("ERROR: _routes.json content invalid");
  process.exit(1);
}
