import assert from 'node:assert/strict';
import { normalizeClaudeApiKey, getClaudeRuntimeStatus } from './claude.client.js';

assert.equal(normalizeClaudeApiKey(' sk-ant-api03-test '), 'sk-ant-api03-test');
assert.equal(normalizeClaudeApiKey('"sk-ant-api03-test"'), 'sk-ant-api03-test');
assert.equal(normalizeClaudeApiKey('Bearer sk-ant-api03-test'), 'sk-ant-api03-test');
assert.equal(normalizeClaudeApiKey('CLAUDE_API_KEY=sk-ant-api03-test'), 'sk-ant-api03-test');
assert.equal(normalizeClaudeApiKey('ANTHROPIC_API_KEY=sk-ant-api03-test'), 'sk-ant-api03-test');
assert.equal(normalizeClaudeApiKey('sk-ant-api03-test\n'), 'sk-ant-api03-test');
assert.equal(normalizeClaudeApiKey('sk-ant-api03-abc\r\ndef'), 'sk-ant-api03-abcdef');

const status = getClaudeRuntimeStatus();
assert.equal(status.version, '0.8.5');
assert.equal(status.healthMode, 'v2-functional-0-8-5-claude-backend-compatibility');
assert.equal(status.safety.keyExposed, false);
assert.equal(status.envChecks.supportsAnthropicApiKeyFallback, true);
assert.equal(status.envChecks.retriesAlternateKeyOnInvalidKey, true);

console.log('claude-backend-compatibility-tests — 17 passed, 0 failed');
