/* global hexo */
const fs = require("fs");
const path = require("path");
const src = path.resolve(__dirname, "..", "source", "_routes.json");

hexo.extend.generator.register("copy-routes", function () {
  if (!fs.existsSync(src)) throw new Error("source/_routes.json not found");

  const data = fs.readFileSync(src, "utf-8");
  const content = JSON.parse(data);
  if (content.version !== 1 || !content.include || content.include[0] !== "/api/*") {
    throw new Error("_routes.json content invalid");
  }

  return { path: "_routes.json", data };
});
