/**
 * Model Parser Service
 * Parses model configuration files (JSON/YAML) into ModelConfig objects
 */

import * as yaml from 'js-yaml';
import { ModelConfig } from '../types';

export type FileFormat = 'json' | 'yaml' | 'unknown';

/**
 * Detect file format from filename or content
 */
export function detectFormat(filename: string, content?: string): FileFormat {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'json') return 'json';
  if (ext === 'yaml' || ext === 'yml') return 'yaml';

  // Try to detect from content
  if (content) {
    const trimmed = content.trim();
    if (trimmed.startsWith('{')) return 'json';
    if (trimmed.includes(':') && !trimmed.startsWith('{')) return 'yaml';
  }

  return 'unknown';
}

/**
 * Parse model configuration from string content
 */
export function parseModelContent(content: string, format: FileFormat): ModelConfig {
  if (format === 'yaml') {
    return yaml.load(content) as ModelConfig;
  } else if (format === 'json') {
    return JSON.parse(content);
  } else {
    // Try JSON first, then YAML
    try {
      return JSON.parse(content);
    } catch {
      return yaml.load(content) as ModelConfig;
    }
  }
}

/**
 * Parse model from file
 */
export async function parseModelFile(file: File): Promise<ModelConfig> {
  const content = await file.text();
  const format = detectFormat(file.name, content);
  return parseModelContent(content, format);
}

/**
 * Serialize model to JSON string
 */
export function serializeToJson(config: ModelConfig, pretty = true): string {
  return pretty
    ? JSON.stringify(config, null, 2)
    : JSON.stringify(config);
}

/**
 * Serialize model to YAML string
 */
export function serializeToYaml(config: ModelConfig): string {
  return yaml.dump(config, {
    indent: 2,
    lineWidth: 120,
    quotingType: '"'
  });
}
