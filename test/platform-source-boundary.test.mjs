import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import test from 'node:test';

const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('standalone app consumes Nimi package exports without source aliases', () => {
  assert.doesNotMatch(viteConfig, /nimiRepoRoot|nimiSdkSourceRoot|nimiKitSourceRoot/);
  assert.doesNotMatch(viteConfig, /find: \/\^@nimiplatform\\\/(?:sdk|kit)/);
  assert.match(viteConfig, /dedupe:\s*\['react', 'react-dom', 'react\/jsx-runtime', 'react\/jsx-dev-runtime'\]/);
  assert.match(styles, /@source "\.\.\/node_modules\/@nimiplatform\/kit\/dist\/\*\*\/\*\.\{js,mjs\}";/);
});

function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sources(file) : /\.(?:ts|tsx|cts)$/u.test(file) ? [file] : [];
  });
}
function inspectBoundary(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const errors = []; const factories = new Set(); let clientConstructions = 0;
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const module = node.moduleSpecifier.text;
    if (/runtime\/internal|@renderer\/|@runtime\/|(?:^|\/)nimi\/(?:apps|sdks|runtime)\//u.test(module)) errors.push('private platform source import');
    const bindings = node.importClause?.namedBindings;
    if ((module === '@nimiplatform/sdk' || module === '@nimiplatform/sdk/app') && bindings && ts.isNamedImports(bindings)) {
      for (const item of bindings.elements) if ((item.propertyName ?? item.name).text === 'createNimiClient') factories.add(item.name.text);
    }
  }
  const visit = node => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text
        : ts.isElementAccessExpression(callee) && callee.argumentExpression && ts.isStringLiteral(callee.argumentExpression) ? callee.argumentExpression.text : '';
      if (['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].includes(name)) errors.push(`app-owned direct transport: ${name}`);
      if (ts.isIdentifier(callee) && factories.has(callee.text)) clientConstructions++;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'handle' && /(?:^|\.)ipcMain$/u.test(callee.expression.getText(source))) errors.push('app-owned generic IPC handler');
    }
    ts.forEachChild(node, visit);
  };
  visit(source); return { errors, clientConstructions };
}

test('boundary inspection catches new transports while ignoring strings and comments', () => {
  assert.deepEqual(inspectBoundary('sample.ts', 'const prompt = "fetch / runtime/internal"; // new WebSocket()').errors, []);
  assert.equal(inspectBoundary('sample.ts', 'window["fetch"]("/private"); new WebSocket("ws://private"); ipcMain.handle("anything", handler);').errors.length, 3);
  assert.equal(inspectBoundary('sample.ts', "import { createNimiClient as make } from '@nimiplatform/sdk'; make({}); make({});").clientConstructions, 2);
});

test('all product and shell sources retain one protected client without direct transport or generic IPC', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const files = [...sources(path.join(root, 'src')), ...sources(path.join(root, 'src-electron'))];
  let constructions = 0;
  for (const file of files) {
    const result = inspectBoundary(file, readFileSync(file, 'utf8'));
    assert.deepEqual(result.errors, [], path.relative(root, file)); constructions += result.clientConstructions;
  }
  assert.equal(constructions, 1);
});
