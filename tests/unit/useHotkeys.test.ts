import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHotkeys } from '../../src/hooks/useHotkeys';
import { useUIStore } from '../../src/store/useUIStore';

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('useHotkeys', () => {
  let onToggleUI: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onToggleUI = vi.fn<() => void>();
    useUIStore.setState({ activeTool: 'Life', simCommand: undefined });
    renderHook(() => useHotkeys({ onToggleUI }));
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  describe('UI toggle', () => {
    it('toggles the UI on h and H', () => {
      press('h');
      press('H');
      expect(onToggleUI).toHaveBeenCalledTimes(2);
    });

    it('does not toggle when h is typed into an input', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      press('h', {}, input);
      expect(onToggleUI).not.toHaveBeenCalled();
    });

    it('does not toggle when h is typed into a textarea, select or contenteditable', () => {
      const textarea = document.createElement('textarea');
      const select = document.createElement('select');
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      const child = document.createElement('span');
      editable.appendChild(child);
      document.body.append(textarea, select, editable);

      press('h', {}, textarea);
      press('h', {}, select);
      press('h', {}, child);
      expect(onToggleUI).not.toHaveBeenCalled();
    });

    it('ignores h with modifier keys or auto-repeat', () => {
      press('h', { ctrlKey: true });
      press('h', { metaKey: true });
      press('h', { altKey: true });
      press('h', { repeat: true });
      expect(onToggleUI).not.toHaveBeenCalled();
    });
  });

  describe('sim commands', () => {
    it.each([
      ['n', 'step'],
      ['N', 'step'],
      ['r', 'randomize'],
      ['c', 'clear'],
    ] as const)('requests the matching sim command for %s', (key, command) => {
      press(key);
      expect(useUIStore.getState().simCommand?.command).toBe(command);
    });

    it('requests togglePlay on Space and prevents its default action', () => {
      const event = press(' ');
      expect(useUIStore.getState().simCommand?.command).toBe('togglePlay');
      expect(event.defaultPrevented).toBe(true);
    });

    it('issues a new command object on each press so repeats notify subscribers', () => {
      press('n');
      const first = useUIStore.getState().simCommand;
      press('n');
      expect(useUIStore.getState().simCommand).not.toBe(first);
    });

    it('does not request commands from a typing target', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      press(' ', {}, input);
      press('r', {}, input);
      expect(useUIStore.getState().simCommand).toBeUndefined();
    });

    it('ignores sim hotkeys with modifiers', () => {
      press('n', { ctrlKey: true });
      press('r', { metaKey: true });
      press(' ', { altKey: true });
      expect(useUIStore.getState().simCommand).toBeUndefined();
    });
  });

  describe('meteor tools', () => {
    it.each([
      ['1', 'Life'],
      ['2', 'Sterilizer'],
      ['3', 'Mutation'],
      ['4', 'Comet'],
      ['5', 'Probe'],
    ] as const)('selects the tool for key %s', (key, tool) => {
      press(key);
      expect(useUIStore.getState().activeTool).toBe(tool);
    });

    it('ignores digits outside 1–5', () => {
      press('6');
      press('0');
      expect(useUIStore.getState().activeTool).toBe('Life');
    });

    it('ignores number keys with modifiers', () => {
      press('3', { ctrlKey: true });
      expect(useUIStore.getState().activeTool).toBe('Life');
    });
  });
});
