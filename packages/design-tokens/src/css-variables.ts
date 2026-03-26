import { tokens, type Tokens } from './tokens';

interface NestedRecord {
  [key: string]: string | number | NestedRecord;
}

/**
 * Recursively flattens a nested token object into CSS custom property
 * declarations, applying a naming prefix at each level.
 *
 * Example:
 *   flattenTokens({ surface: { base: '#0e0f11' } }, '--color')
 *   → { '--color-surface-base': '#0e0f11' }
 */
function flattenTokens(
  obj: NestedRecord,
  prefix: string,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Convert camelCase keys to kebab-case for CSS custom property names
    const kebabKey = key.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
    const varName = `${prefix}-${kebabKey}`;

    if (typeof value === 'string') {
      result[varName] = value;
    } else if (typeof value === 'number') {
      result[varName] = String(value);
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenTokens(value as NestedRecord, varName));
    }
  }

  return result;
}

/**
 * Generates a complete `:root` CSS block from the design token tree.
 *
 * Token groups are mapped to CSS variable prefixes:
 *
 * | Token group            | CSS prefix        | Example variable              |
 * |------------------------|-------------------|-------------------------------|
 * | colors.surface.*       | --color-surface   | --color-surface-base          |
 * | colors.accent.*        | --color-accent    | --color-accent-primary        |
 * | colors.text.*          | --color-text      | --color-text-primary          |
 * | colors.border.*        | --color-border    | --color-border-default        |
 * | colors.status.*        | --color-status    | --color-status-online         |
 * | colors.danger.*        | --color-danger    | --color-danger-default        |
 * | colors.success.*       | --color-success   | --color-success-default       |
 * | colors.warning.*       | --color-warning   | --color-warning-default       |
 * | colors.mention.*       | --color-mention   | --color-mention-bg            |
 * | colors.voice.*         | --color-voice     | --color-voice-speaking        |
 * | spacing.*              | --space            | --space-4                     |
 * | typography.fontFamily.*| --font-family      | --font-family-sans            |
 * | typography.fontSize.*  | --text             | --text-base                   |
 * | typography.fontWeight.*| --font-weight      | --font-weight-semibold        |
 * | typography.lineHeight.*| --leading          | --leading-normal              |
 * | typography.letterSpacing.*| --tracking      | --tracking-tight              |
 * | radius.*               | --radius           | --radius-md                   |
 * | shadow.*               | --shadow           | --shadow-lg                   |
 * | motion.duration.*      | --duration         | --duration-fast               |
 * | motion.easing.*        | --easing           | --easing-standard             |
 * | zIndex.*               | --z                | --z-modal                     |
 * | layout.*               | --layout           | --layout-server-rail-width    |
 *
 * @param t - The token tree (defaults to the built-in tokens)
 * @returns A string containing `:root { ...custom properties... }` ready to
 *          inject into a `<style>` tag or a `.css` file.
 */
export function generateCSSVariables(t: Tokens = tokens): string {
  const vars: Record<string, string> = {};

  // --- Colors ---
  Object.assign(vars, flattenTokens(t.colors.surface as unknown as NestedRecord, '--color-surface'));
  Object.assign(vars, flattenTokens(t.colors.accent as unknown as NestedRecord, '--color-accent'));
  Object.assign(vars, flattenTokens(t.colors.text as unknown as NestedRecord, '--color-text'));
  Object.assign(vars, flattenTokens(t.colors.border as unknown as NestedRecord, '--color-border'));
  Object.assign(vars, flattenTokens(t.colors.status as unknown as NestedRecord, '--color-status'));
  Object.assign(vars, flattenTokens(t.colors.danger as unknown as NestedRecord, '--color-danger'));
  Object.assign(vars, flattenTokens(t.colors.success as unknown as NestedRecord, '--color-success'));
  Object.assign(vars, flattenTokens(t.colors.warning as unknown as NestedRecord, '--color-warning'));
  Object.assign(vars, flattenTokens(t.colors.mention as unknown as NestedRecord, '--color-mention'));
  Object.assign(vars, flattenTokens(t.colors.voice as unknown as NestedRecord, '--color-voice'));

  // --- Spacing ---
  for (const [key, value] of Object.entries(t.spacing)) {
    vars[`--space-${key}`] = value;
  }

  // --- Typography: font families ---
  for (const [key, value] of Object.entries(t.typography.fontFamily)) {
    const kebab = key.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
    vars[`--font-family-${kebab}`] = value;
  }

  // --- Typography: font sizes ---
  for (const [key, value] of Object.entries(t.typography.fontSize)) {
    vars[`--text-${key}`] = value;
  }

  // --- Typography: font weights ---
  for (const [key, value] of Object.entries(t.typography.fontWeight)) {
    vars[`--font-weight-${key}`] = String(value);
  }

  // --- Typography: line heights ---
  for (const [key, value] of Object.entries(t.typography.lineHeight)) {
    vars[`--leading-${key}`] = String(value);
  }

  // --- Typography: letter spacing ---
  for (const [key, value] of Object.entries(t.typography.letterSpacing)) {
    vars[`--tracking-${key}`] = value;
  }

  // --- Radius ---
  for (const [key, value] of Object.entries(t.radius)) {
    vars[`--radius-${key}`] = value;
  }

  // --- Shadow ---
  for (const [key, value] of Object.entries(t.shadow)) {
    vars[`--shadow-${key}`] = value;
  }

  // --- Motion: duration ---
  for (const [key, value] of Object.entries(t.motion.duration)) {
    vars[`--duration-${key}`] = value;
  }

  // --- Motion: easing ---
  for (const [key, value] of Object.entries(t.motion.easing)) {
    vars[`--easing-${key}`] = value;
  }

  // --- Z-index ---
  for (const [key, value] of Object.entries(t.zIndex)) {
    vars[`--z-${key}`] = String(value);
  }

  // --- Layout ---
  for (const [key, value] of Object.entries(t.layout)) {
    const kebab = key.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
    vars[`--layout-${kebab}`] = value;
  }

  // Serialise to CSS
  const declarations = Object.entries(vars)
    .map(([prop, val]) => `  ${prop}: ${val};`)
    .join('\n');

  return `:root {\n${declarations}\n}\n`;
}

/**
 * A pre-generated CSS string from the default token set.
 * Import this directly when you need the CSS as a module side-effect.
 *
 * @example
 * import { cssVariables } from '@constchat/design-tokens/css';
 * // Inject into document head:
 * const style = document.createElement('style');
 * style.textContent = cssVariables;
 * document.head.appendChild(style);
 */
export const cssVariables: string = generateCSSVariables(tokens);
