/**
 * throughput-key.js: suffix for the per-source throughput carried alongside
 *                    each chart series.
 *
 * Note: the ingest worker emits 'price' (successes, what the chart plots) and
 *       'price__throughput' (successes + failures, what health divides by) on
 *       the same row, so both survive the same aggregation and the same date
 *       window. the suffix is namespaced rather than a bare 'throughput' key
 *       because a report's 'group_by' names the series, and any single shared
 *       key would be clobbered when rows from different sources sharing a
 *       'window_start' are merged
 *
 */

const THROUGHPUT_KEY = '__throughput';

export default THROUGHPUT_KEY;
