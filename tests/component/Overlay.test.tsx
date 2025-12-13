import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Overlay } from '../../src/components/Overlay';

describe('Overlay component', () => {
  const localStorageMock = (() => {
    let store: { [key: string]: string } = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value.toString();
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
    };
  })();

  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should display the onboarding hint the first time it is rendered', () => {
    render(<Overlay />);
    const hintText = screen.getByText(
      /Drag to orbit • Scroll to zoom • Click planet to fire meteor/i,
    );
    expect(hintText).toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('onboardingHintShown', 'true');
  });

  it('should not display the onboarding hint on subsequent renders after being shown once', () => {
    // Simulate hint being shown once
    localStorageMock.setItem('onboardingHintShown', 'true');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('onboardingHintShown', 'true'); // Verify our mock setup

    // Render the component
    render(<Overlay />);

    // Expect the hint not to be in the document
    const hintText = screen.queryByText(
      /Drag to orbit • Scroll to zoom • Click planet to fire meteor/i,
    );
    expect(hintText).not.toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1); // Should not be called again
  });
});
