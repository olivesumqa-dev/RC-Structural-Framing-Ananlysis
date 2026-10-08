const fs = require("fs");

const htmlPath = "index.html";
const projectPath = "JSON/9-STO. BLDG.stf";
const projectJson = fs.readFileSync(projectPath, "utf8").trim();
let html = fs.readFileSync(htmlPath, "utf8");

for (const id of ["defaultProjectData"]) {
  const pattern = new RegExp(`(<script id="${id}" type="application/json">)[\\s\\S]*?(</script>)`);
  if (!pattern.test(html)) throw new Error(`Missing ${id} block in ${htmlPath}`);
  html = html.replace(pattern, `$1\n${projectJson}\n  $2`);
}

fs.writeFileSync(htmlPath, html);
console.log("Embedded 9-STO. BLDG startup project data updated.");
