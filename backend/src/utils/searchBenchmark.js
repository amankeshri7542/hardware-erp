const { performance } = require('perf_hooks');
const { searchByName } = require('../modules/products/products.search.service');

/**
 * Benchmark product search response time in dev.
 * NOT used in production routes — called manually from Node REPL.
 *
 * Usage:
 *   require('dotenv').config();
 *   const { benchmarkProductSearch } = require('./src/utils/searchBenchmark');
 *   benchmarkProductSearch('cement', 10);
 */
async function benchmarkProductSearch(query, runs = 10) {
  const times = [];

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await searchByName(query);
    const elapsed = performance.now() - start;
    times.push(elapsed);
  }

  times.sort((a, b) => a - b);

  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
  const min = times[0];
  const max = times[times.length - 1];
  const p95Index = Math.ceil(0.95 * times.length) - 1;
  const p95 = times[p95Index];

  console.table({
    query,
    runs,
    'avg (ms)': avg.toFixed(2),
    'min (ms)': min.toFixed(2),
    'max (ms)': max.toFixed(2),
    'p95 (ms)': p95.toFixed(2),
    'target (<300ms)': p95 < 300 ? 'PASS' : 'FAIL',
  });

  return { avg, min, max, p95 };
}

module.exports = { benchmarkProductSearch };
