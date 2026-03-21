'use client'; // drag-and-drop and fetch require browser APIs

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { Session } from '@/lib/types';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// A single draggable session row
function SortableSession({
  session,
  onDelete,
}: {
  session: Session;
  onDelete: (id: string) => void;
}) {
  // dnd-kit hook — gives us drag handle props and transform styles
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: session.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      {/* Drag handle — the session button itself is the handle */}
      <Link
        href={`/sessions/${session.id}`}
        className="flex-1 block px-3 py-1.5 rounded text-sm text-white text-left bg-[rgba(139,26,26,0.55)] hover:bg-[rgba(139,26,26,0.85)] whitespace-nowrap cursor-grab"
        {...attributes}
        {...listeners}
      >
        {session.title || 'Untitled'}
      </Link>

      {/* Delete button — stopPropagation prevents triggering drag */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Delete "${session.title || 'Untitled'}"?`)) onDelete(session.id);
        }}
        className="text-white/35 hover:text-white text-xs px-1 flex-shrink-0"
      >
        ×
      </button>
    </div>
  );
}

export default function SessionList({ initial }: { initial: Session[] }) {
  const [sessions, setSessions] = useState(initial);

  // Support both mouse and touch drag
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // When drag ends, reorder locally and persist new order to the API
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSessions(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id);
      const newIndex = prev.findIndex(s => s.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);

      // Persist new order (fire-and-forget — UI already updated optimistically)
      fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map(s => s.id) }),
      });

      return reordered;
    });
  }, []);

  // Delete a session then remove it from local state
  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  // Create a new session and navigate to its prep sheet
  const handleNew = async () => {
    const maxNum = sessions.reduce((m, s) => Math.max(m, s.number), 0);
    const id = Date.now().toString(36);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, number: maxNum + 1 }),
    });
    const session = await res.json();
    setSessions(prev => [...prev, session]);
    window.location.href = `/sessions/${session.id}`;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* New session button */}
      <button
        onClick={handleNew}
        className="mb-5 px-4 py-1.5 rounded text-sm text-white bg-[#6b7d8e] hover:opacity-85 text-left"
      >
        + New Session
      </button>

      {/* Draggable session list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sessions.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {sessions.map(s => (
            <SortableSession key={s.id} session={s} onDelete={handleDelete} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
