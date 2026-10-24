import type { TestDefinition } from '../../types/testing.ts';

export const CUSTOM_TEST_PAGE_SIZE = 10;

/** Presentation only: preserve IDs/order and never change the execution suite. */
export function testLibraryPage(tests: readonly TestDefinition[], query: string, requested = 0) {
  const needle = query.trim().toLowerCase();
  const matching = tests.filter(test => !needle || `${test.name}\n${test.description ?? ''}`.toLowerCase().includes(needle));
  const pages = Math.max(1, Math.ceil(matching.length / CUSTOM_TEST_PAGE_SIZE));
  const page = Math.min(Math.max(0, Number.isFinite(requested) ? Math.floor(requested) : 0), pages - 1);
  const start = page * CUSTOM_TEST_PAGE_SIZE;
  return { items: matching.slice(start, start + CUSTOM_TEST_PAGE_SIZE), matched: matching.length, pages, page, start };
}
