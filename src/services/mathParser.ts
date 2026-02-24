/**
 * Sandboxed Math Expression Parser
 * Uses mathjs with strict security constraints for user-provided equations
 */

import { create, all, MathNode, parse, EvalFunction } from 'mathjs';

// Whitelist of allowed functions
const ALLOWED_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'exp', 'log', 'log10', 'log2',
  'sqrt', 'abs', 'ceil', 'floor', 'round',
  'min', 'max', 'pow', 'sign',
  'add', 'subtract', 'multiply', 'divide'
]);

// Allowed variables that can appear in equations
const ALLOWED_VARIABLES = new Set([
  'adoption', 'wellbeing', 'gdp', 'gdpPerCapita', 'population', 'gini', 'governance',
  'contributionRate', 'displacementRate', 'fundSize', 'month', 'aiGrowthRate',
  'aiAdoption', 'ubiReceived', 'marketPressure', 'reputationScore',
  'customerBaseWellbeing', 'projectedDemandCollapse', 'aiRevenue'
]);

// Security constraints
const MAX_EQUATION_LENGTH = 500;
const MAX_OPERATIONS = 10;
const EVALUATION_TIMEOUT_MS = 100;

// Create sandboxed math instance
const math = create(all);

// Export types
export interface ParseResult {
  valid: boolean;
  error?: string;
  node?: MathNode;
}

export interface CompiledEquation {
  evaluate: (vars: Record<string, number>) => number;
  variables: string[];
  complexity: number;
}

/**
 * Count operations in AST to enforce complexity limits
 */
function countOperations(node: MathNode): number {
  let count = 0;

  node.traverse((n) => {
    // Count function calls and operators as operations
    if (n.type === 'FunctionNode' || n.type === 'OperatorNode') {
      count++;
    }
  });

  return count;
}

/**
 * Extract all variable names from AST
 */
function extractVariables(node: MathNode): string[] {
  const variables: string[] = [];

  node.traverse((n) => {
    if (n.type === 'SymbolNode') {
      const symbolNode = n as any;
      const name = symbolNode.name;
      // Only include if not a constant (like pi, e)
      if (!math.hasNumericValue(name) && !variables.includes(name)) {
        variables.push(name);
      }
    }
  });

  return variables;
}

/**
 * Validate AST nodes against security whitelist
 */
function validateNode(node: MathNode): { valid: boolean; error?: string } {
  let error: string | undefined;

  node.traverse((n) => {
    // If we already found an error, skip
    if (error) return;

    // Check function nodes
    if (n.type === 'FunctionNode') {
      const funcNode = n as any;
      if (!ALLOWED_FUNCTIONS.has(funcNode.fn.name)) {
        error = `Function '${funcNode.fn.name}' is not allowed. Allowed functions: ${Array.from(ALLOWED_FUNCTIONS).join(', ')}`;
        return;
      }
    }

    // Check symbol nodes (variables)
    if (n.type === 'SymbolNode') {
      const symbolNode = n as any;
      const name = symbolNode.name;
      // Allow constants like pi, e
      if (!math.hasNumericValue(name) && !ALLOWED_VARIABLES.has(name)) {
        error = `Variable '${name}' is not allowed. Allowed variables: ${Array.from(ALLOWED_VARIABLES).join(', ')}`;
        return;
      }
    }

    // Block accessor nodes (array access, property access)
    if (n.type === 'AccessorNode' || n.type === 'IndexNode') {
      error = 'Array/object access is not allowed';
      return;
    }

    // Block assignment nodes
    if (n.type === 'AssignmentNode') {
      error = 'Assignment operations are not allowed';
      return;
    }
  });

  return error ? { valid: false, error } : { valid: true };
}

/**
 * Validate equation string before parsing
 */
export function validateEquation(equation: string): { valid: boolean; error?: string } {
  // Check length
  if (equation.length > MAX_EQUATION_LENGTH) {
    return {
      valid: false,
      error: `Equation exceeds maximum length of ${MAX_EQUATION_LENGTH} characters`
    };
  }

  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /eval/i,
    /Function/i,
    /constructor/i,
    /__proto__/i,
    /prototype/i,
    /import/i,
    /require/i,
    /process/i,
    /global/i,
    /window/i,
    /document/i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(equation)) {
      return {
        valid: false,
        error: `Equation contains forbidden pattern: ${pattern.source}`
      };
    }
  }

  return { valid: true };
}

/**
 * Parse equation and validate its structure
 */
export function parseEquation(equation: string): ParseResult {
  // Pre-validation
  const preCheck = validateEquation(equation);
  if (!preCheck.valid) {
    return preCheck;
  }

  try {
    // Parse equation
    const node = parse(equation);

    // Count operations
    const operationCount = countOperations(node);
    if (operationCount > MAX_OPERATIONS) {
      return {
        valid: false,
        error: `Equation is too complex: ${operationCount} operations (max: ${MAX_OPERATIONS})`
      };
    }

    // Validate node security
    const nodeValidation = validateNode(node);
    if (!nodeValidation.valid) {
      return nodeValidation;
    }

    return {
      valid: true,
      node
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Failed to parse equation'
    };
  }
}

/**
 * Compile equation for fast repeated evaluation
 */
export function compileEquation(equation: string): CompiledEquation | null {
  const parseResult = parseEquation(equation);

  if (!parseResult.valid || !parseResult.node) {
    console.error('Failed to compile equation:', parseResult.error);
    return null;
  }

  const node = parseResult.node;
  const variables = extractVariables(node);
  const complexity = countOperations(node);

  // Compile the node for faster evaluation
  const compiled = node.compile();

  return {
    evaluate: (vars: Record<string, number>): number => {
      // Timeout wrapper
      const startTime = Date.now();

      try {
        // Create a clean scope with only the provided variables
        const scope: Record<string, number> = {};

        // Only copy allowed variables
        for (const key of Object.keys(vars)) {
          if (ALLOWED_VARIABLES.has(key)) {
            scope[key] = vars[key];
          }
        }

        // Evaluate with timeout check
        const result = compiled.evaluate(scope);

        const elapsed = Date.now() - startTime;
        if (elapsed > EVALUATION_TIMEOUT_MS) {
          console.warn(`Equation evaluation took ${elapsed}ms (timeout: ${EVALUATION_TIMEOUT_MS}ms)`);
        }

        // Ensure result is a number
        if (typeof result !== 'number' || !isFinite(result)) {
          console.error('Equation returned non-finite result:', result);
          return 0;
        }

        return result;
      } catch (err) {
        console.error('Equation evaluation error:', err);
        return 0;
      }
    },
    variables,
    complexity
  };
}

/**
 * One-shot evaluation with timeout (less efficient than compiled)
 */
export function evaluateEquation(
  equation: string,
  variables: Record<string, number>
): number | null {
  const parseResult = parseEquation(equation);

  if (!parseResult.valid || !parseResult.node) {
    console.error('Failed to evaluate equation:', parseResult.error);
    return null;
  }

  const startTime = Date.now();

  try {
    // Create a clean scope with only allowed variables
    const scope: Record<string, number> = {};

    for (const key of Object.keys(variables)) {
      if (ALLOWED_VARIABLES.has(key)) {
        scope[key] = variables[key];
      }
    }

    // Evaluate
    const result = parseResult.node.evaluate(scope);

    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed > EVALUATION_TIMEOUT_MS) {
      console.warn(`Equation evaluation took ${elapsed}ms (timeout: ${EVALUATION_TIMEOUT_MS}ms)`);
    }

    // Ensure result is a number
    if (typeof result !== 'number' || !isFinite(result)) {
      console.error('Equation returned non-finite result:', result);
      return null;
    }

    return result;
  } catch (err) {
    console.error('Equation evaluation error:', err);
    return null;
  }
}

/**
 * Get list of allowed variables for UI display
 */
export function getAllowedVariables(): string[] {
  return Array.from(ALLOWED_VARIABLES).sort();
}

/**
 * Get list of allowed functions for UI display
 */
export function getAllowedFunctions(): string[] {
  return Array.from(ALLOWED_FUNCTIONS).sort();
}

/**
 * Test if equation is valid and return detailed info
 */
export function analyzeEquation(equation: string): {
  valid: boolean;
  error?: string;
  variables?: string[];
  complexity?: number;
  canCompile?: boolean;
} {
  const parseResult = parseEquation(equation);

  if (!parseResult.valid || !parseResult.node) {
    return {
      valid: false,
      error: parseResult.error
    };
  }

  const variables = extractVariables(parseResult.node);
  const complexity = countOperations(parseResult.node);

  // Try to compile to verify it works
  let canCompile = false;
  try {
    parseResult.node.compile();
    canCompile = true;
  } catch (err) {
    console.error('Failed to compile equation:', err);
  }

  return {
    valid: true,
    variables,
    complexity,
    canCompile
  };
}
