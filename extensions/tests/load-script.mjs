// Loads classic (non-module) extension scripts into one isolated context, the
// way the browser loads content scripts, so their pure helpers can be tested
// under Node. Top-level const and let bindings are not properties of the
// context, so the returned `get` reads any name through the script scope.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url);

export function loadScripts(files, globals = {}) {
  const context = vm.createContext({ chrome: {}, ...globals });
  for (const file of files) {
    vm.runInContext(readFileSync(new URL(file, root), "utf8"), context, { filename: file });
  }
  return { context, get: (name) => vm.runInContext(name, context) };
}
