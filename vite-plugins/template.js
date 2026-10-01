import fs from 'node:fs';
import path from 'node:path';
import { escapeHtml } from '../src/utils/escape.js';

/**
 * Minimal build-time HTML templates. Directives are HTML comments, so partials stay
 * valid HTML and editors highlight them normally:
 *
 *   <!-- @include sections/hero/hero.html -->   insert a partial (path relative to src/)
 *   <!-- @each projects as project --> … <!-- @end -->
 *   <!-- @if page.isHome --> … <!-- @else --> … <!-- @end -->   (`!` negates)
 *   {{ project.name }}                           value, HTML-escaped
 *
 * A missing value is a build error (with the file name), never a silent blank.
 */
const TOKEN = /<!--\s*@(include|each|if|else|end)\b\s*(.*?)\s*-->|\{\{\s*(.+?)\s*\}\}/g;

function parse(source, file) {
  const root = { children: [] };
  const stack = [root];
  let last = 0;
  const top = () => stack[stack.length - 1];
  const text = (s) => s && top().children.push({ type: 'text', value: s });

  for (const m of source.matchAll(TOKEN)) {
    text(source.slice(last, m.index));
    last = m.index + m[0].length;
    const [, directive, arg, expr] = m;
    if (expr) top().children.push({ type: 'value', expr });
    else if (directive === 'include') top().children.push({ type: 'include', path: arg });
    else if (directive === 'each') {
      const [, list, name] = arg.match(/^(\S+)\s+as\s+(\w+)$/) || fail(file, `bad @each "${arg}"`);
      const node = { type: 'each', list, name, children: [] };
      top().children.push(node);
      stack.push(node);
    } else if (directive === 'if') {
      const node = { type: 'if', expr: arg, children: [], otherwise: null };
      top().children.push(node);
      stack.push(node);
    } else if (directive === 'else') {
      const node = top();
      if (node.type !== 'if' || node.otherwise) fail(file, '@else without @if');
      node.then = node.children;
      node.children = node.otherwise = [];
    } else if (directive === 'end') {
      if (stack.length === 1) fail(file, '@end without @each/@if');
      stack.pop();
    }
  }
  if (stack.length > 1) fail(file, `unclosed @${top().type}`);
  text(source.slice(last));
  return root.children;
}

function lookup(expr, scope, file) {
  const value = expr.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), scope);
  if (value === undefined) fail(file, `"${expr}" is undefined`);
  return value;
}

function fail(file, message) {
  throw new Error(`[html-partials] ${path.basename(file)}: ${message}`);
}

/**
 * Renders `source` (the contents of `file`) with `scope`. `srcDir` is where @include
 * paths start. `onInclude(file)` is called for every partial (for dev file watching).
 */
export function renderTemplate(source, scope, { file, srcDir, onInclude }) {
  const renderNodes = (nodes, s, f) =>
    nodes
      .map((n) => {
        switch (n.type) {
          case 'text':
            return n.value;
          case 'value':
            return escapeHtml(lookup(n.expr, s, f));
          case 'include': {
            const target = path.resolve(srcDir, n.path);
            if (!fs.existsSync(target)) fail(f, `can't find partial "${n.path}"`);
            onInclude?.(target);
            return renderNodes(parse(fs.readFileSync(target, 'utf8'), target), s, target);
          }
          case 'each': {
            const list = lookup(n.list, s, f);
            if (!Array.isArray(list)) fail(f, `"${n.list}" is not a list`);
            return list.map((item) => renderNodes(n.children, { ...s, [n.name]: item }, f)).join('');
          }
          case 'if': {
            const negate = n.expr.startsWith('!');
            const key = negate ? n.expr.slice(1) : n.expr;
            const value = key.split('.').reduce((obj, k) => (obj == null ? undefined : obj[k]), s);
            const yes = negate ? !value : !!value;
            return renderNodes(yes ? n.then || n.children : n.then ? n.otherwise : [], s, f);
          }
          default:
            return '';
        }
      })
      .join('');
  return renderNodes(parse(source, file), scope, file);
}
