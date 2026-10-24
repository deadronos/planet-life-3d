import { useEffect } from 'react';

import { METEOR_TOOLS, useUIStore } from '../store/useUIStore';

/** True when the key event originates from a control that consumes typing. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.matches('input, textarea, select')) return true;
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

/**
 * Global keyboard shortcuts. Sim actions go through the UI store's command
 * bus so the sim components run them with their existing logic.
 */
export function useHotkeys({ onToggleUI }: { onToggleUI: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target)) return;

      const key = e.key.toLowerCase();
      const { requestSimCommand, setActiveTool } = useUIStore.getState();

      if (key === 'h') {
        onToggleUI();
      } else if (e.key === ' ') {
        // Stop Space from activating a focused button or scrolling the page.
        e.preventDefault();
        requestSimCommand('togglePlay');
      } else if (key === 'n') {
        requestSimCommand('step');
      } else if (key === 'r') {
        requestSimCommand('randomize');
      } else if (key === 'c') {
        requestSimCommand('clear');
      } else if (/^[1-5]$/.test(e.key)) {
        const tool = METEOR_TOOLS[Number(e.key) - 1];
        if (tool) setActiveTool(tool);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleUI]);
}
