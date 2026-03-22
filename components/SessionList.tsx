'use client'; // drag-and-drop and fetch require browser APIs

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // dnd-kit hook — gives us drag handle props and transform styles
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: session.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirming) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      onDelete(session.id);
    } else {
      setConfirming(true);
      // Auto-cancel confirmation after 3 seconds
      confirmTimer.current = setTimeout(() => setConfirming(false), 3000);
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 group py-0.5">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 text-[#3d3530] hover:text-[#8a7d6e] cursor-grab active:cursor-grabbing select-none text-base leading-none pt-0.5"
        title="Drag to reorder"
      >
        ⠿
      </div>

      {/* Session number — large decorative numeral */}
      <div className="font-cinzel text-[1.5rem] font-black text-[#e8a030]/30 leading-none w-8 text-right flex-shrink-0 select-none tabular-nums">
        {session.number}
      </div>

      {/* Session link */}
      <Link
        href={`/sessions/${session.id}`}
        className="flex-1 block px-3 py-2 rounded text-sm text-white text-left no-underline
          bg-[rgba(139,26,26,0.4)] border border-[rgba(139,26,26,0.5)]
          hover:bg-[rgba(165,32,32,0.65)] hover:border-[rgba(200,60,60,0.5)]
          transition-all duration-150"
        style={{ fontFamily: 'var(--font-garamond), Georgia, serif' }}
      >
        {session.title || <span className="text-white/35 italic">Untitled</span>}
      </Link>

      {/* Maps link */}
      <Link
        href={`/dm/maps?session=${session.id}`}
        className="text-white/50 hover:text-[#e8a030] text-xs no-underline flex-shrink-0 transition-colors tracking-wide"
        title="Maps for this session"
      >
        Maps
      </Link>

      {/* Delete */}
      <button
        onClick={handleDeleteClick}
        className={`text-xs px-1 flex-shrink-0 transition-colors ${
          confirming
            ? 'text-[#e8a030] font-bold'
            : 'text-white/25 hover:text-white/70 opacity-0 group-hover:opacity-100'
        }`}
        title={confirming ? 'Click again to confirm delete' : 'Delete session'}
      >
        {confirming ? '?' : '×'}
      </button>
    </div>
  );
}

export default function SessionList({ initial }: { initial: Session[] }) {
  const [sessions, setSessions] = useState(initial);
  const router = useRouter();

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
    if (!res.ok) {
      console.error('Failed to create session', await res.text());
      return;
    }
    const session = await res.json();
    setSessions(prev => [...prev, session]);
    router.push(`/sessions/${session.id}`);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* New session button */}
      <button
        onClick={handleNew}
        className="mb-4 px-4 py-2 rounded text-sm text-[#e8a030] border border-dashed border-[#e8a030]/50 bg-transparent hover:bg-[rgba(232,160,48,0.08)] hover:border-[#e8a030] text-left transition-all font-cinzel tracking-widest text-[0.7rem] uppercase"
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
