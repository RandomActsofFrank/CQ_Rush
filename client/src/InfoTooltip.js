import React, { useCallback, useEffect, useRef, useState } from 'react';

function InfoTooltip({ text }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [positioned, setPositioned] = useState(false);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const popup = popupRef.current;
    if (!trigger || !popup) return;

    const margin = 12;
    const triggerRect = trigger.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = triggerRect.bottom + 8;
    let left = triggerRect.left;

    if (left + popupRect.width > viewportWidth - margin) {
      left = viewportWidth - margin - popupRect.width;
    }
    if (left < margin) {
      left = margin;
    }

    if (top + popupRect.height > viewportHeight - margin) {
      top = triggerRect.top - popupRect.height - 8;
    }
    if (top < margin) {
      top = margin;
    }

    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) {
      setPositioned(false);
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      updatePosition();
      setPositioned(true);
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="info-tooltip-trigger"
        aria-label="Show help"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        ⓘ
      </button>
      {open && (
        <>
          <button
            type="button"
            className="info-tooltip-backdrop"
            aria-label="Close help"
            onClick={() => setOpen(false)}
          />
          <div
            ref={popupRef}
            className="info-tooltip-popup"
            style={{
              top: position.top,
              left: position.left,
              visibility: positioned ? 'visible' : 'hidden'
            }}
            role="tooltip"
          >
            {text}
          </div>
        </>
      )}
    </>
  );
}

export default InfoTooltip;
