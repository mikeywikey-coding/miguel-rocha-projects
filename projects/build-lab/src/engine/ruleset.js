import { getRules } from "./gameRules.js";

// The linked-attribute rules the editor uses, looked up by height. This lives in its own
// module so browser tests can substitute a small synthetic rule set.
export const dependencyRules = getRules;
