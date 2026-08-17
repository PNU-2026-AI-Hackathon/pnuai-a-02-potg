'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { StudioOption } from './studio-options';

type ConditionDropdownProps = {
  label: string;
  placeholder: string;
  options: StudioOption[];
  value: string[];
  multiple?: boolean;
  showDescriptions?: boolean;
  onChange: (value: string[]) => void;
};

export default function ConditionDropdown({
  label,
  placeholder,
  options,
  value,
  multiple,
  showDescriptions = true,
  onChange,
}: ConditionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();
  const listId = useId();

  const selectedOptions = options.filter((option) => value.includes(option.value));
  const buttonText =
    selectedOptions.length > 0
      ? selectedOptions.map((option) => option.label).join(', ')
      : placeholder;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function toggleOption(optionValue: string) {
    if (multiple) {
      onChange(
        value.includes(optionValue)
          ? value.filter((currentValue) => currentValue !== optionValue)
          : [...value, optionValue],
      );
      return;
    }

    onChange([optionValue]);
    setIsOpen(false);
  }

  function resetSelection() {
    onChange([]);
    setIsOpen(false);
  }

  return (
    <div className="studioDropdown" ref={rootRef}>
      <label className="studioFieldLabel" htmlFor={buttonId}>
        <span>{label}</span>
      </label>
      <button
        aria-controls={listId}
        aria-expanded={isOpen}
        className={selectedOptions.length > 0 ? 'studioDropdownButton hasValue' : 'studioDropdownButton'}
        id={buttonId}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{buttonText}</span>
        <span aria-hidden="true">v</span>
      </button>
      {isOpen ? (
        <div className="studioDropdownMenu" id={listId} role="listbox" aria-multiselectable={multiple || undefined}>
          {options.map((option) => {
            const isSelected = value.includes(option.value);

            return (
              <button
                className={isSelected ? 'studioDropdownOption isSelected' : 'studioDropdownOption'}
                key={option.value}
                role="option"
                aria-selected={isSelected}
                type="button"
                onClick={() => toggleOption(option.value)}
              >
                <span aria-hidden="true">{isSelected ? '✓' : ''}</span>
                <strong>{option.label}</strong>
                {showDescriptions && option.description ? <em>{option.description}</em> : null}
              </button>
            );
          })}
          {selectedOptions.length > 0 ? (
            <button className="studioDropdownReset" type="button" onClick={resetSelection}>
              선택 초기화
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
