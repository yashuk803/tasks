import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  let rowClasses = 'flex items-center gap-2 py-1.5 px-1 rounded transition-colors';

  if (isMoving) {
    // Highlighted: this dept is selected to be moved
    rowClasses += ' bg-amber-50 border border-amber-400';
  } else if (isMoveActive && isValidMoveTarget) {
    // Drop-here indicator for valid targets
    rowClasses += ' border border-dashed border-amber-300 cursor-pointer hover:bg-amber-50';
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
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            className="text-gray-400 w-4 text-xs shrink-0"
          >
            {open ? '▾' : '▸'}
          </button>
        )}
        {children.length === 0 && <span className="w-4 shrink-0" />}

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
          <button
            onClick={handleMoveButtonClick}
            title={t('common.cancel')}
            className="text-xs text-amber-500 hover:text-amber-700 shrink-0 font-bold"
          >
            ✕
          </button>
        )}

        {/* Move button ✦ — shown when NOT in move mode and NOT currently being dragged */}
        {!isMoving && !isMoveActive && onMove && (
          <button
            onClick={handleMoveButtonClick}
            title={t('dept.moveMode')}
            className="text-xs text-gray-400 hover:text-amber-500 shrink-0"
          >
            ✦
          </button>
        )}

        {/* Edit button */}
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(dept); }}
            className="text-xs text-brand-dark hover:underline shrink-0"
          >
            ✎
          </button>
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
        <div className="mb-1 px-2 py-1 rounded bg-amber-50 border border-amber-300 text-xs text-amber-700 flex items-center justify-between select-none">
          <span>✦ {t('dept.moveMode')}</span>
          <button
            onClick={() => setMoveState({ movingId: null })}
            className="text-amber-500 hover:text-amber-700 font-bold ms-3"
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
          rootZoneActive
            ? 'border-brand-dark bg-blue-50 text-brand-dark'
            : isMoveActive
              ? 'border-amber-300 text-amber-500 cursor-pointer hover:bg-amber-50'
              : 'border-gray-300 text-gray-400',
          dragState.draggedId || isMoveActive ? 'cursor-pointer' : '',
        ].join(' ')}
      >
        {t('dept.dropToRoot')}
      </div>
    </div>
  );
}
