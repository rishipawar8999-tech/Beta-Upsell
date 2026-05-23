import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateRemainingTrialDays } from './billing';

describe('calculateRemainingTrialDays', () => {
  beforeEach(() => {
    // Mock the current date to a fixed point for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return 7 days if upgrading to Basic Plan with no existing subscription', () => {
    const result = calculateRemainingTrialDays('Basic Plan', undefined, undefined, undefined);
    expect(result).toBe(7);
  });

  it('should return 0 days if upgrading to Pro Plan with no existing subscription', () => {
    const result = calculateRemainingTrialDays('Pro Plan', undefined, undefined, undefined);
    expect(result).toBe(0);
  });

  it('should carry over remaining trial days when upgrading from Basic to Pro during trial', () => {
    // Existing Basic sub created 2 days ago, initially had 7 trial days.
    const createdDate = new Date('2026-05-08T12:00:00Z');
    
    const result = calculateRemainingTrialDays('Pro Plan', 'Basic Plan', 7, createdDate);
    
    // 7 days total - 2 days used = 5 days remaining
    expect(result).toBe(5);
  });

  it('should return 0 days if upgrading from Basic to Pro after trial expired', () => {
    // Existing Basic sub created 10 days ago, initially had 7 trial days.
    const createdDate = new Date('2026-04-30T12:00:00Z');
    
    const result = calculateRemainingTrialDays('Pro Plan', 'Basic Plan', 7, createdDate);
    
    expect(result).toBe(0);
  });

  it('should return 0 days if resubscribing to Basic Plan after already having Basic', () => {
    // Even if they cancelled immediately, re-subscribing to Basic shouldn't grant a new trial
    const createdDate = new Date('2026-05-08T12:00:00Z');
    
    const result = calculateRemainingTrialDays('Basic Plan', 'Basic Plan', 7, createdDate);
    
    expect(result).toBe(0);
  });

  it('should return 0 days if downgrading from Pro to Basic', () => {
    const createdDate = new Date('2026-05-01T12:00:00Z');
    
    const result = calculateRemainingTrialDays('Basic Plan', 'Pro Plan', 0, createdDate);
    
    expect(result).toBe(0);
  });
});
