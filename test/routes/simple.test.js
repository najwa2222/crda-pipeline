import { describe, test, expect } from '@jest/globals';

describe('Simple test', () => {
  test('true is true', () => {
    expect(true).toBe(true);
  });
});

jest.mock('mysql2');