import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as ts from 'typescript';

const repoRoot = path.resolve(import.meta.dirname, '..');
const overtoneRoot = path.join(repoRoot, 'src/overtone');
const productAreaPath = path.join(repoRoot, 'src/shell/routes/product-area.tsx');
const i18nPath = path.join(overtoneRoot, 'i18n.ts');

const USER_VISIBLE_JSX_ATTRIBUTES = new Set([
  'aria-label',
  'ariaLabel',
  'alt',
  'description',
  'emptyLabel',
  'label',
  'message',
  'placeholder',
  'runtimeLabel',
  'runtimeValue',
  'submitLabel',
  'submittingLabel',
  'title',
  'tooltip',
  'warning',
]);

const USER_VISIBLE_OBJECT_PROPERTIES = new Set([
  'action',
  'ariaLabel',
  'description',
  'emptyLabel',
  'label',
  'message',
  'placeholder',
  'runtimeLabel',
  'runtimeValue',
  'submitLabel',
  'submittingLabel',
  'title',
  'tooltip',
  'warning',
]);

const RAW_COPY_EXCEPTIONS = new Map();

const REQUIRED_DYNAMIC_KEYS = [
  "Overtone.song.verse", "Overtone.song.chorus", "Overtone.song.bridge", "Overtone.song.ending",
  "Overtone.playground.energy",
  "Overtone.playground.energyLow",
  "Overtone.playground.energyMid",
  "Overtone.playground.energyHigh",
  "Overtone.playground.surprise",
  "Overtone.playground.surpriseLow",
  "Overtone.playground.surpriseMid",
  "Overtone.playground.surpriseHigh",
  "Overtone.playground.scenes.0",
  "Overtone.playground.scenes.1",
  "Overtone.playground.scenes.2",
  "Overtone.playground.scenes.3",
  "Overtone.playground.scenes.4",
  "Overtone.playground.scenes.5",
  "Overtone.playground.genres.0",
  "Overtone.playground.genres.1",
  "Overtone.playground.genres.2",
  "Overtone.playground.genres.3",
  "Overtone.playground.genres.4",
  "Overtone.playground.genres.5",
  "Overtone.playground.twists.0",
  "Overtone.playground.twists.1",
  "Overtone.playground.twists.2",
  "Overtone.playground.twists.3",
  "Overtone.playground.twists.4",
  "Overtone.playground.twists.5",
  "Overtone.playground.sparks.moon.name",
  "Overtone.playground.sparks.moon.detail",
  "Overtone.playground.sparks.moon.prompt",
  "Overtone.playground.sparks.rain.name",
  "Overtone.playground.sparks.rain.detail",
  "Overtone.playground.sparks.rain.prompt",
  "Overtone.playground.sparks.arcade.name",
  "Overtone.playground.sparks.arcade.detail",
  "Overtone.playground.sparks.arcade.prompt",
  "Overtone.playground.reinterpret.dream.name",
  "Overtone.playground.reinterpret.dream.prompt",
  "Overtone.playground.reinterpret.dance.name",
  "Overtone.playground.reinterpret.dance.prompt",
  "Overtone.playground.reinterpret.stripped.name",
  "Overtone.playground.reinterpret.stripped.prompt",
  "Overtone.song.duration90",
  "Overtone.song.duration120",
  "Overtone.song.duration180",
  "Overtone.song.sectionKinds.intro",
  "Overtone.song.sectionKinds.verse",
  "Overtone.song.sectionKinds.pre-chorus",
  "Overtone.song.sectionKinds.chorus",
  "Overtone.song.sectionKinds.bridge",
  "Overtone.song.sectionKinds.outro",
  "Overtone.runtime.status.queued",
  "Overtone.runtime.status.running",
  "Overtone.runtime.status.completed",
  "Overtone.runtime.status.failed",
  "Overtone.runtime.status.canceled",
  "Overtone.runtime.status.timeout",
  "Overtone.brief.fields.title",
  "Overtone.brief.fields.genre",
  "Overtone.brief.fields.mood",
  "Overtone.brief.fields.tempo",
  "Overtone.brief.fields.description"
];

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function collectTsxFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsxFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseSource(filePath, source) {
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function normalizeVisibleText(text) {
  return String(text)
    .replace(/&nbsp;/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function containsUserCopyCharacters(text) {
  return /[A-Za-z\u3400-\u9fff]/u.test(text);
}

function isIgnorableVisibleText(text) {
  const normalized = normalizeVisibleText(text);
  if (!normalized) return true;
  if (!containsUserCopyCharacters(normalized)) return true;

  const asciiLetters = normalized.match(/[A-Za-z]/gu)?.length ?? 0;
  const cjkCharacters = normalized.match(/[\u3400-\u9fff]/gu)?.length ?? 0;
  return asciiLetters + cjkCharacters <= 1;
}

function isAllowedRawCopy(relPath, text) {
  return RAW_COPY_EXCEPTIONS.has(`${relPath}::${normalizeVisibleText(text)}`);
}

function locationFor(sourceFile, position) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(position);
  return { line: line + 1, column: character + 1 };
}

function finding(sourceFile, relPath, node, kind, text) {
  const { line, column } = locationFor(sourceFile, node.getStart(sourceFile));
  return {
    file: relPath,
    line,
    column,
    kind,
    text: normalizeVisibleText(text),
  };
}

function isTranslationCall(node) {
  if (!ts.isCallExpression(node)) return false;
  const expression = node.expression;
  if (ts.isIdentifier(expression)) return expression.text === 't';
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text === 't';
  return false;
}

function containsTranslationCall(node) {
  let found = false;
  function visit(current) {
    if (found) return;
    if (isTranslationCall(current)) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  }
  visit(node);
  return found;
}

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function inspectRawCopyText(sourceFile, relPath, node, kind, text) {
  if (isIgnorableVisibleText(text)) return [];
  if (isAllowedRawCopy(relPath, text)) return [];
  return [finding(sourceFile, relPath, node, kind, text)];
}

function inspectTemplateStaticText(sourceFile, relPath, node, kind) {
  const findings = [];
  findings.push(...inspectRawCopyText(sourceFile, relPath, node, kind, node.head.text));
  for (const span of node.templateSpans) {
    findings.push(...inspectRawCopyText(sourceFile, relPath, span.literal, kind, span.literal.text));
  }
  return findings;
}

function inspectCopyExpression(sourceFile, relPath, node, kind) {
  const expression = unwrapExpression(node);
  if (containsTranslationCall(expression)) return [];

  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return inspectRawCopyText(sourceFile, relPath, expression, kind, expression.text);
  }
  if (ts.isTemplateExpression(expression)) {
    return inspectTemplateStaticText(sourceFile, relPath, expression, kind);
  }
  if (ts.isConditionalExpression(expression)) {
    return [
      ...inspectCopyExpression(sourceFile, relPath, expression.whenTrue, kind),
      ...inspectCopyExpression(sourceFile, relPath, expression.whenFalse, kind),
    ];
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.flatMap((element) => inspectCopyExpression(sourceFile, relPath, element, kind));
  }
  return [];
}

function jsxAttributeName(node, sourceFile) {
  return node.name.getText(sourceFile);
}

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function collectRawCopyFindingsForSource(relPath, source) {
  const sourceFile = parseSource(relPath, source);
  const findings = [];

  function visit(node) {
    if (ts.isJsxText(node)) {
      findings.push(...inspectRawCopyText(sourceFile, relPath, node, 'jsx-text', node.getFullText(sourceFile)));
    }

    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      findings.push(...inspectCopyExpression(sourceFile, relPath, node.expression, 'jsx-expression'));
    }

    if (ts.isJsxAttribute(node) && USER_VISIBLE_JSX_ATTRIBUTES.has(jsxAttributeName(node, sourceFile))) {
      const initializer = node.initializer;
      if (initializer && ts.isStringLiteral(initializer)) {
        findings.push(...inspectRawCopyText(sourceFile, relPath, initializer, 'jsx-attribute', initializer.text));
      } else if (initializer && ts.isJsxExpression(initializer) && initializer.expression) {
        findings.push(...inspectCopyExpression(sourceFile, relPath, initializer.expression, 'jsx-attribute'));
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = propertyNameText(node.name);
      if (name && USER_VISIBLE_OBJECT_PROPERTIES.has(name)) {
        findings.push(...inspectCopyExpression(sourceFile, relPath, node.initializer, 'copy-property'));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function collectRawCopyFindings() {
  const files = [...collectTsxFiles(overtoneRoot), productAreaPath].sort();
  return files.flatMap((filePath) => {
    const relPath = toRepoPath(filePath);
    return collectRawCopyFindingsForSource(relPath, readFileSync(filePath, 'utf8'));
  });
}

function propertyKey(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  throw new Error(`unsupported i18n resource property key: ${name.getText()}`);
}

function objectLiteralToValue(node) {
  const expression = unwrapExpression(node);
  if (ts.isObjectLiteralExpression(expression)) {
    const output = {};
    for (const property of expression.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(`unsupported i18n resource property: ${property.getText()}`);
      }
      output[propertyKey(property.name)] = objectLiteralToValue(property.initializer);
    }
    return output;
  }
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (expression.kind === ts.SyntaxKind.NullKeyword) return null;
  throw new Error(`unsupported i18n resource value: ${expression.getText()}`);
}

function readOvertoneI18nResources() {
  const source = readFileSync(i18nPath, 'utf8');
  const sourceFile = parseSource(toRepoPath(i18nPath), source);
  let initializer = null;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'overtoneI18nResources') {
      initializer = node.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.ok(initializer, 'src/overtone/i18n.ts must export overtoneI18nResources');
  return objectLiteralToValue(initializer);
}

function flattenLocaleKeys(input, prefix = '') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return prefix ? [prefix] : [];
  return Object.entries(input).flatMap(([key, value]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return flattenLocaleKeys(value, next);
    }
    return [next];
  });
}

function getValueAtKey(input, key) {
  return key.split('.').reduce((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return current[segment];
  }, input);
}

function collectTranslationKeyUsagesForSource(relPath, source) {
  const sourceFile = parseSource(relPath, source);
  const keys = new Set();
  function visit(node) {
    if (isTranslationCall(node)) {
      const firstArg = node.arguments[0];
      if (firstArg && (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg))) {
        keys.add(firstArg.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return keys;
}

function collectTranslationKeyUsages() {
  const files = [
    ...collectTsxFiles(overtoneRoot),
    i18nPath,
    productAreaPath,
  ].sort();
  const keys = new Set();
  for (const filePath of files) {
    for (const key of collectTranslationKeyUsagesForSource(toRepoPath(filePath), readFileSync(filePath, 'utf8'))) {
      if (key.startsWith('Overtone.')) keys.add(key);
    }
  }
  return keys;
}

function formatFindings(findings) {
  return findings
    .map((item) => `${item.file}:${item.line}:${item.column}: ${item.kind} "${item.text}"`)
    .join('\n');
}

test('overtone i18n gate detects raw visible JSX copy', () => {
  const findings = collectRawCopyFindingsForSource(
    'src/overtone/__fixture__.tsx',
    'export function Fixture() { return <button aria-label="Generate song">Generate Song</button>; }',
  );

  assert.equal(findings.length, 2);
  assert.match(formatFindings(findings), /Generate Song/);
  assert.match(formatFindings(findings), /Generate song/);
});

test('overtone app-owned UI has no raw user-visible copy outside i18n resources', () => {
  const findings = collectRawCopyFindings();
  assert.deepEqual(
    findings,
    [],
    `Overtone UI text must use t('Overtone...') or a named gate exception:\n${formatFindings(findings)}`,
  );
});

test('overtone translation keys used by UI resolve in English and Chinese resources', () => {
  const resources = readOvertoneI18nResources();
  const localeResources = {
    en: resources.en?.translation ?? {},
    zh: resources.zh?.translation ?? {},
  };
  const keyUsages = new Set([...collectTranslationKeyUsages(), ...REQUIRED_DYNAMIC_KEYS]);

  for (const [locale, localeData] of Object.entries(localeResources)) {
    const localeKeys = new Set(flattenLocaleKeys(localeData));
    const missing = [...keyUsages].filter((key) => !localeKeys.has(key) && !localeKeys.has(key + '_other')).sort();
    assert.deepEqual(missing, [], `${locale} locale is missing Overtone keys: ${missing.join(', ')}`);

    for (const key of localeKeys) {
      if (!key.startsWith('Overtone.')) continue;
      const value = getValueAtKey(localeData, key);
      assert.equal(typeof value, 'string', `${locale} locale key ${key} must resolve to a string`);
      assert.match(value, /\S/u, `${locale} locale key ${key} must not be empty`);
    }
  }

  const enKeys = new Set(flattenLocaleKeys(localeResources.en));
  const zhKeys = new Set(flattenLocaleKeys(localeResources.zh));
  const missingInZh = [...enKeys].filter((key) => !zhKeys.has(key)).sort();
  const missingInEn = [...zhKeys].filter((key) => !enKeys.has(key)).sort();

  assert.deepEqual(missingInZh, [], `zh locale is missing keys present in en: ${missingInZh.join(', ')}`);
  assert.deepEqual(missingInEn, [], `en locale is missing keys present in zh: ${missingInEn.join(', ')}`);
});
