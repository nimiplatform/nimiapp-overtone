import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
const root = fileURLToPath(new URL('../',import.meta.url));
const productRoot = join(root,'src/overtone');
const CSS_BYTE_BUDGET = 48 * 1024;
function walk(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(entry => entry.isDirectory()?walk(join(dir,entry.name)):entry.name.endsWith('.css')?[join(dir,entry.name)]:[]); }
const files = walk(productRoot);
const failures = [];
let totalBytes = 0;
for (const file of [...files,join(root,'src/styles.css')]) {
  const css=readFileSync(file,'utf8');
  if(files.includes(file))totalBytes+=Buffer.byteLength(css);
  for(const [,selector] of css.matchAll(/([^{}]+)\{/g)) {
    if(/\.nimi-[\w-]+/.test(selector))failures.push(`${relative(root,file)}: private Kit selector: ${selector.trim()}`);
    if(/(^|,)\s*(button|input|textarea|select)(?=[\s.#:[{]|$)/.test(selector))failures.push(`${relative(root,file)}: unscoped native control selector: ${selector.trim()}`);
  }
}
if(!files.length)failures.push('No Overtone product CSS was inspected');
if(totalBytes>CSS_BYTE_BUDGET)failures.push(`Product CSS exceeds ${CSS_BYTE_BUDGET} UTF-8 bytes`);
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`[overtone-kit-style] passed (${totalBytes}/${CSS_BYTE_BUDGET} product CSS bytes, ${files.length} product stylesheet(s))`);
