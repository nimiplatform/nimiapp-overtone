import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
export async function loadSource(relativePath) {
  const result = await build({entryPoints:[fileURLToPath(new URL(relativePath,import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',packages:'external'});
  const code = result.outputFiles[0].text.replace(/from "([^".][^"]*)"/g,(_,specifier)=>`from "${import.meta.resolve(specifier)}"`);
  return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
