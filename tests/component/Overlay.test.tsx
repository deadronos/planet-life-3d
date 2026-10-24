import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    // The keyboard-shortcut part is its own span (hidden on narrow screens), so
    // match against the whole hint region rather than a single text node.
    const hint = screen.getByRole('region', { name: 'Onboarding instructions' });
    expect(hint).toHaveTextContent(
      /Drag to orbit • Scroll to zoom • Click planet to fire meteor • Press 'h' to toggle UI/i,
    );
    // It should NOT set localStorage immediately on render anymore
    expect(localStorageMock.setItem).not.toHaveBeenCalledWith('onboardingHintShown', 'true');
  });

  it('should not display the onboarding hint if it was previously dismissed', () => {
    // Simulate hint being shown once
    localStorageMock.setItem('onboardingHintShown', 'true');

    // Render the component
    render(<Overlay />);

    // Expect the hint not to be in the document
    expect(screen.queryByRole('region', { name: 'Onboarding instructions' })).toBeNull();
  });

  it('should dismiss the hint when the close button is clicked', () => {
    render(<Overlay />);

    const dismissBtn = screen.getByLabelText('Dismiss instructions');
    expect(dismissBtn).toBeInTheDocument();

    fireEvent.click(dismissBtn);

    // Should disappear
    expect(screen.queryByRole('region', { name: 'Onboarding instructions' })).toBeNull();

    // Should persist to localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledWith('onboardingHintShown', 'true');
  });
});
