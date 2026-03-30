import { useRef, useCallback } from 'react';

export interface UndoAction {
  apply: () => void;
  reverse: () => void;
}

const MAX_STACK = 100;

/**
 * In-memory undo/redo stack using the command pattern.
 * Each action has apply() and reverse() methods.
 * Stack capped at MAX_STACK entries. Redo stack clears on new action.
 */
export function useUndoRedo() {
  const undoStack = useRef<UndoAction[]>([]);
  const redoStack = useRef<UndoAction[]>([]);

  const push = useCallback((action: UndoAction) => {
    undoStack.current.push(action);
    if (undoStack.current.length > MAX_STACK) {
      undoStack.current.shift();
    }
    redoStack.current = [];
  }, []);

  const undo = useCallback(() => {
    const action = undoStack.current.pop();
    if (!action) return;
    action.reverse();
    redoStack.current.push(action);
  }, []);

  const redo = useCallback(() => {
    const action = redoStack.current.pop();
    if (!action) return;
    action.apply();
    undoStack.current.push(action);
  }, []);

  const canUndo = useCallback(() => undoStack.current.length > 0, []);
  const canRedo = useCallback(() => redoStack.current.length > 0, []);

  return { push, undo, redo, canUndo, canRedo };
}
