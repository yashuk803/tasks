import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Icon buttons ────────────────────────────────────────────────────────
// Real SVG icons instead of unicode glyphs (✦ ✎ ✕): unicode symbols render
// inconsistently across Android/iOS fonts (sometimes almost invisible) and
// have no built-in tap area. These give every action a guaranteed-visible
// icon plus a >=44px touch target (Apple HIG / Material minimum).

const IconMove = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <polyline points="5 9 2 12 5 15" />
    <polyline points="9 5 12 2 15 5" />
    <polyline points="15 19 12 22 9 19" />
    <polyline points="19 9 22 12 19 15" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="12" y1="2" x2="12" y2="22" />
  </svg>
);

const IconEdit = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const IconClose = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

function IconButton({ onClick, title, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={
        'shrink-0 flex items-center justify-center rounded-full w-9 h-9 -my-1 ' +
        'touch-manipulation active:scale-90 transition-transform ' + className
      }
    >
      {children}
    </button>
  );
}

function getDescendantIds(deptId, allDepts) {
  const result = [];
  const queue = [deptId];
  while (queue.length) {
    const cur = queue.shift();
    const children = allDepts.filter((d) => d.parentId === cur);
    children.forEach((c) => { result.push(c.id); queue.push(c.id); });
  }
  return result;
}

function DeptNode({
  dept, allDepts, onEdit, onMove, level = 0,
  dragState, setDragState,
  moveState, setMoveState,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const children = allDepts.filter((d) => d.parentId === dept.id);

  // ── Desktop drag state ──────────────────────────────────────────────
  const isDragging = dragState.draggedId === dept.id;
  const isHovered  = dragState.hoveredId === dept.id;

  const handleDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dept.id);
    setDragState((s) => ({ ...s, draggedId: dept.id }));
  };

  const handleDragEnd = () => {
    setDragState({ draggedId: null, hoveredId: null });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { draggedId } = dragState;
    if (!draggedId || draggedId === dept.id) return;
    const forbidden = [draggedId, ...getDescendantIds(draggedId, allDepts)];
    if (forbidden.includes(dept.id)) return;
    e.dataTransfer.dropEffect = 'move';
    setDragState((s) => ({ ...s, hoveredId: dept.id }));
  };

  const handleDragLeave = (e) => {
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragState((s) => s.hoveredId === dept.id ? { ...s, hoveredId: null } : s);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { draggedId } = dragState;
    if (!draggedId || draggedId === dept.id) {
      setDragState({ draggedId: null, hoveredId: null });
      return;
    }
    const forbidden = [draggedId, ...getDescendantIds(draggedId, allDepts)];
    if (forbidden.includes(dept.id)) {
      setDragState({ draggedId: null, hoveredId: null });
      return;
    }
    onMove(draggedId, dept.id);
    setDragState({ draggedId: null, hoveredId: null });
  };

  // ── Touch / click move mode ─────────────────────────────────────────
  const isMoving     = moveState.movingId === dept.id;   // this node is the one being moved
  const isMoveActive = moveState.movingId !== null;       // some node is in move mode

  // Forbidden targets: the moving dept itself + its descendants
  const moveForbidden = isMoveActive
    ? [moveState.movingId, ...getDescendantIds(moveState.movingId, allDepts)]
    : [];
  const isValidMoveTarget = isMoveActive && !moveForbidden.includes(dept.id);

  const handleMoveButtonClick = (e) => {
    e.stopPropagation();
    // If this dept is already in move mode → cancel
    if (isMoving) {
      setMoveState({ movingId: null });
    } else {
      setMoveState({ movingId: dept.id });
    }
  };

  const handleNodeClickInMoveMode = (e) => {
    e.stopPropagation();
    if (!isMoveActive) return;
    if (!isValidMoveTarget) return;
    onMove(moveState.movingId, dept.id);
    setMoveState({ movingId: null });
  };

  // ── Row style ───────────────────────────────────────────────────────
  // min-h-[44px] keeps the whole row a comfortable touch target once it
  // becomes a tappable drop zone in move mode.
  let rowClasses = 'flex items-center gap-1 py-1.5 px-1 rounded transition-colors touch-manipulation';

  if (isMoving) {
    // Highlighted: this dept is selected to be moved
    rowClasses += ' bg-amber-50 border border-amber-400 min-h-[44px]';
  } else if (isMoveActive && isValidMoveTarget) {
    // Drop-here indicator for valid targets
    rowClasses += ' border border-dashed border-amber-300 cursor-pointer active:bg-amber-100 hover:bg-amber-50 min-h-[44px]';
  } else if (isMoveActive && !isValidMoveTarget) {
    // Forbidden target (self / descendant)
    rowClasses += ' border border-transparent opacity-50';
  } else if (isDragging) {
    rowClasses += ' opacity-40 border border-transparent';
  } else if (isHovered) {
    rowClasses += ' bg-blue-50 border border-brand-dark';
  } else {
    rowClasses += ' border border-transparent';
  }

  if (!isMoveActive && dragState.draggedId && dragState.draggedId !== dept.id) {
    rowClasses += ' cursor-copy';
  } else if (!isMoveActive && !dragState.draggedId) {
    rowClasses += ' cursor-grab';
  }

  return (
    <div className={level > 0 ? 'ms-4 border-s border-gray-200 ps-2 mt-1' : ''}>
      <div
        draggable={!isMoveActive}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={isMoveActive && isValidMoveTarget ? handleNodeClickInMoveMode : undefined}
        className={rowClasses}
      >
        {/* Expand/collapse toggle */}
        {children.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            aria-label={open ? t('common.collapse', 'Collapse') : t('common.expand', 'Expand')}
            className="shrink-0 flex items-center justify-center w-7 h-9 -my-1 text-gray-400 text-sm touch-manipulation"
          >
            {open ? '▾' : '▸'}
          </button>
        )}
        {children.length === 0 && <span className="w-7 shrink-0" />}

        <span className="flex-1 text-sm font-medium text-brand-black select-none">
          {dept.name}
        </span>

        {dept.head && (
          <span className="text-xs text-gray-500 hidden sm:inline select-none">
            {dept.head.firstName} {dept.head.lastName}
          </span>
        )}

        {/* Move mode: cancel button on the selected row */}
        {isMoving && (
          <IconButton
            onClick={handleMoveButtonClick}
            title={t('common.cancel')}
            className="bg-amber-500 text-white active:bg-amber-600"
          >
            <IconClose className="w-4 h-4" />
          </IconButton>
        )}

        {/* Move button — shown when NOT in move mode and NOT currently being dragged */}
        {!isMoving && !isMoveActive && onMove && (
          <IconButton
            onClick={handleMoveButtonClick}
            title={t('dept.moveMode')}
            className="bg-gray-100 text-gray-500 active:bg-amber-100 active:text-amber-600"
          >
            <IconMove className="w-4 h-4" />
          </IconButton>
        )}

        {/* Edit button — hidden during move mode so the whole row is a clean drop target */}
        {onEdit && !isMoveActive && (
          <IconButton
            onClick={(e) => { e.stopPropagation(); onEdit(dept); }}
            title={t('common.edit', 'Edit')}
            className="text-brand-dark active:bg-blue-50"
          >
            <IconEdit className="w-4 h-4" />
          </IconButton>
        )}
      </div>

      {open && children.map((child) => (
        <DeptNode
          key={child.id}
          dept={child}
          allDepts={allDepts}
          onEdit={onEdit}
          onMove={onMove}
          level={level + 1}
          dragState={dragState}
          setDragState={setDragState}
          moveState={moveState}
          setMoveState={setMoveState}
        />
      ))}
    </div>
  );
}

export default function DeptTree({ departments = [], onEdit, onMove }) {
  const { t } = useTranslation();
  const roots = departments.filter((d) => !d.parentId);

  // Desktop drag state
  const [dragState, setDragState] = useState({ draggedId: null, hoveredId: null });
  const [rootZoneHovered, setRootZoneHovered] = useState(false);

  // Touch / click move mode state
  const [moveState, setMoveState] = useState({ movingId: null });
  const [rootZoneMoveHovered, setRootZoneMoveHovered] = useState(false);

  // ── Desktop root-zone handlers ──────────────────────────────────────
  const handleRootZoneDragOver = (e) => {
    e.preventDefault();
    if (!dragState.draggedId) return;
    e.dataTransfer.dropEffect = 'move';
    setRootZoneHovered(true);
    setDragState((s) => ({ ...s, hoveredId: null }));
  };

  const handleRootZoneDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setRootZoneHovered(false);
    }
  };

  const handleRootZoneDrop = (e) => {
    e.preventDefault();
    const { draggedId } = dragState;
    if (draggedId) {
      onMove(draggedId, null);
    }
    setDragState({ draggedId: null, hoveredId: null });
    setRootZoneHovered(false);
  };

  const handleRootZoneDragEnd = () => {
    setRootZoneHovered(false);
  };

  // ── Move-mode root-zone handler ─────────────────────────────────────
  const handleRootZoneMoveClick = () => {
    if (!moveState.movingId) return;
    onMove(moveState.movingId, null);
    setMoveState({ movingId: null });
    setRootZoneMoveHovered(false);
  };

  const isMoveActive = moveState.movingId !== null;

  // Root-zone visual state
  const rootZoneActive    = rootZoneHovered || rootZoneMoveHovered;
  const rootZoneClickable = isMoveActive;

  if (departments.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">{t('common.loading')}</p>;
  }

  return (
    <div className="card flex flex-col gap-1">
      {/* Move mode banner */}
      {isMoveActive && (
        <div className="mb-1 pl-3 pr-1 py-1 rounded bg-amber-50 border border-amber-300 text-sm text-amber-700 flex items-center justify-between select-none">
          <span className="flex items-center gap-1.5">
            <IconMove className="w-4 h-4 shrink-0" />
            {t('dept.moveMode')}
          </span>
          <button
            type="button"
            onClick={() => setMoveState({ movingId: null })}
            className="text-amber-700 font-semibold px-3 py-2 -my-1 min-h-[44px] touch-manipulation active:bg-amber-100 rounded"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {roots.map((dept) => (
        <DeptNode
          key={dept.id}
          dept={dept}
          allDepts={departments}
          onEdit={onEdit}
          onMove={onMove}
          dragState={dragState}
          setDragState={setDragState}
          moveState={moveState}
          setMoveState={setMoveState}
        />
      ))}

      {/* Drop / move-to-root zone */}
      <div
        onDragOver={handleRootZoneDragOver}
        onDragLeave={handleRootZoneDragLeave}
        onDrop={handleRootZoneDrop}
        onMouseEnter={rootZoneClickable ? () => setRootZoneMoveHovered(true) : undefined}
        onMouseLeave={rootZoneClickable ? () => setRootZoneMoveHovered(false) : undefined}
        onClick={rootZoneClickable ? handleRootZoneMoveClick : undefined}
        className={[
          'mt-3 rounded border-2 border-dashed py-2 px-3 text-xs text-center transition-colors select-none',
          'min-h-[44px] flex items-center justify-center touch-manipulation',
          rootZoneActive
            ? 'border-brand-dark bg-blue-50 text-brand-dark'
            : isMoveActive
              ? 'border-amber-300 text-amber-500 cursor-pointer active:bg-amber-100 hover:bg-amber-50'
              : 'border-gray-300 text-gray-400',
          dragState.draggedId || isMoveActive ? 'cursor-pointer' : '',
        ].join(' ')}
      >
        {t('dept.dropToRoot')}
      </div>
    </div>
  );
}
