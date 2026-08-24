#!/usr/bin/env node
import fs from "node:fs";
const name = process.argv[2] || "my-device";
const cells = process.argv.includes("--cells") ? process.argv[process.argv.indexOf("--cells")+1] : "8";
const dots = process.argv.includes("--dots") ? process.argv[process.argv.indexOf("--dots")+1] : "8";
const file = `pwa/src/modules/tactile-output/devices/${name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())}.ts`;
const content = `import type { FrameSink } from "../plugin";
import { registerSink } from "../registry";
export class ${name.replace(/(^\w|-\w)/g, m=>m.replace("-","").toUpperCase())} implements FrameSink {
  name = "${name}";
  onFrame(masks:number[], cellStart:number, index:number){ console.log("[${name}]", index, masks); }
}
registerSink({ name:"${name}", version:"0.1.0", sink:"${name}", capabilities:["custom"], cells:${cells}, dots:${dots} }, () => new ${name.replace(/(^\w|-\w)/g, m=>m.replace("-","").toUpperCase())}());
`;
fs.writeFileSync(file, content);
console.log(`Created ${file}`);
