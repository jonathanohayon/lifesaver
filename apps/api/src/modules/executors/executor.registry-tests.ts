import type { ActionType } from '../actions/actions.types.js';
import {
  EXECUTOR_HANDLER_MAP,
  buildExecutorRegistrySafetySummary,
  getRegisteredExecutorEntry,
  isExecutorHandlerMapped,
  listExecutorRegistryEntries,
  listExecutorRegistrySafetyState,
  resolveExecutorHandlerKey,
} from './executor.registry.js';

function main() {
  const safety = buildExecutorRegistrySafetySummary();
  const registry = listExecutorRegistrySafetyState();
  const entries = listExecutorRegistryEntries();
  const contentEntry = getRegisteredExecutorEntry('content_publish');
  const supportEntry = getRegisteredExecutorEntry('support_reply_send');
  const adsBudgetEntry = getRegisteredExecutorEntry('ad_budget_adjust');
  const adsPauseEntry = getRegisteredExecutorEntry('ad_pause');
  const actionTypes = Object.keys(EXECUTOR_HANDLER_MAP) as ActionType[];

  const assertions = [
    { name: 'phase_is_8_5_sandbox_ads_executor', pass: safety.phase === 'v0.6.0 Phase 8.5 Sandbox Ads Executor' },
    { name: 'all_action_types_have_handler_mapping', pass: actionTypes.length === 8 && actionTypes.every((actionType) => isExecutorHandlerMapped(actionType)) },
    { name: 'content_publish_maps_to_sandbox_content_executor', pass: resolveExecutorHandlerKey('content_publish') === 'sandboxContentExecutor' },
    { name: 'support_reply_send_maps_to_sandbox_support_executor', pass: resolveExecutorHandlerKey('support_reply_send') === 'sandboxSupportExecutor' },
    { name: 'ad_budget_adjust_maps_to_sandbox_ads_budget_executor', pass: resolveExecutorHandlerKey('ad_budget_adjust') === 'sandboxAdsBudgetExecutor' },
    { name: 'ad_pause_maps_to_sandbox_ads_pause_executor', pass: resolveExecutorHandlerKey('ad_pause') === 'sandboxAdsPauseExecutor' },
    { name: 'registry_entries_return_mapping_only_status', pass: entries.every((entry) => entry.status === 'registered_sandbox_mapping_only') },
    { name: 'content_entry_has_sandbox_handler_implementation', pass: contentEntry.handlerImplementationIncluded === true && contentEntry.sandboxExecutorEnabled === true && contentEntry.executionEnabled === false },
    { name: 'support_entry_has_sandbox_handler_implementation_and_no_external_writes', pass: supportEntry.handlerImplementationIncluded === true && supportEntry.sandboxExecutorEnabled === true && supportEntry.externalWritesEnabled === false && supportEntry.realExternalWriteEnabled === false },
    { name: 'ads_budget_entry_has_sandbox_handler_implementation', pass: adsBudgetEntry.handlerImplementationIncluded === true && adsBudgetEntry.sandboxExecutorEnabled === true && adsBudgetEntry.executionEnabled === false },
    { name: 'ads_pause_entry_has_sandbox_handler_implementation', pass: adsPauseEntry.handlerImplementationIncluded === true && adsPauseEntry.sandboxExecutorEnabled === true && adsPauseEntry.executionEnabled === false },
    { name: 'registry_keeps_auto_run_disabled', pass: registry.executorsEnabled === false && registry.sandboxExecutorsEnabled === true },
    { name: 'registry_keeps_real_external_writes_disabled', pass: registry.realExternalWritesEnabled === false && safety.externalWritesEnabled === false },
    { name: 'registry_mappings_count_matches_entries', pass: safety.mappedActionTypeCount === entries.length && registry.items.length === entries.length },
    { name: 'registry_handler_map_exposed_for_ui_docs', pass: registry.handlerMap.content_publish === 'sandboxContentExecutor' },
  ];

  const failed = assertions.filter((item) => !item.pass);
  const payload = {
    version: '0.6.0',
    phase: 'V2 Phase 8.5 Sandbox Ads Executor',
    success: failed.length === 0,
    passed: assertions.length - failed.length,
    failed: failed.length,
    assertions,
    safety,
    registry,
    sampleMappings: {
      content_publish: contentEntry,
      support_reply_send: supportEntry,
      ad_budget_adjust: adsBudgetEntry,
      ad_pause: adsPauseEntry,
    },
    safetyNote: 'This test validates executor registry mappings and confirms content_publish, support_reply_send, ad_budget_adjust, and ad_pause have sandbox handler implementations. It does not auto-run handlers, does not register real executors, and does not call external platforms.',
  };

  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exit(1);
}

main();
