'use client';

import { useState } from 'react';

type MobileCalendarStatus = 'open' | 'upcoming' | 'closed' | 'unknown';

export type MobileCalendarEntry = {
  sourceId: number;
  title: string;
  libraryName: string | null;
  targetGroup: string | null;
  sourceUrl: string;
  period: string;
  status: MobileCalendarStatus;
  statusLabel: string;
};

export type MobileCalendarDay = {
  iso: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  entries: MobileCalendarEntry[];
};

type MobileProgramCalendarProps = {
  days: MobileCalendarDay[];
  year: number;
  month: number;
  weekdayLabels: readonly string[];
};

function indicatorStatus(status: MobileCalendarStatus) {
  return status === 'unknown' ? 'closed' : status;
}

export default function MobileProgramCalendar({
  days,
  year,
  month,
  weekdayLabels,
}: MobileProgramCalendarProps) {
  const initialDay = days.find((day) => day.inMonth && day.isToday)
    ?? days.find((day) => day.inMonth && day.entries.length > 0)
    ?? days.find((day) => day.inMonth)
    ?? days[0];
  const [selectedIso, setSelectedIso] = useState(initialDay?.iso ?? '');
  const selectedDay = days.find((day) => day.iso === selectedIso) ?? initialDay;

  return (
    <div className="mobileProgramCalendar">
      <div className="mobileCalendarGrid" aria-label={`${year}년 ${month}월 프로그램 달력`}>
        <div className="mobileCalendarWeekdays" aria-hidden="true">
          {weekdayLabels.map((label, index) => (
            <span className={index === 0 ? 'isSunday' : index === 6 ? 'isSaturday' : ''} key={label}>
              {label}
            </span>
          ))}
        </div>

        <div className="mobileCalendarDays">
          {days.map((day) => {
            const statuses = Array.from(new Set(day.entries.map(({ status }) => indicatorStatus(status))));
            const selected = day.iso === selectedDay?.iso;

            return (
              <button
                aria-label={`${day.iso}, 일정 ${day.entries.length}개${day.isToday ? ', 오늘' : ''}`}
                aria-pressed={selected}
                className={[
                  'mobileCalendarDay',
                  day.inMonth ? '' : 'isOutside',
                  day.isToday ? 'isToday' : '',
                  selected ? 'isSelected' : '',
                ].filter(Boolean).join(' ')}
                disabled={!day.inMonth}
                key={day.iso}
                onClick={() => setSelectedIso(day.iso)}
                type="button"
              >
                <span className="mobileCalendarDayNumber">{day.dayOfMonth}</span>
                {day.entries.length > 0 ? (
                  <span className="mobileCalendarIndicators" aria-hidden="true">
                    <span className="mobileCalendarDots">
                      {statuses.map((status) => (
                        <i className={`is-${status}`} key={status} />
                      ))}
                    </span>
                    <small>{day.entries.length}</small>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <section className="mobileCalendarAgenda" aria-live="polite">
        <div className="mobileCalendarAgendaHeader">
          <h2>{month}월 {selectedDay?.dayOfMonth}일 프로그램</h2>
          <span>{selectedDay?.entries.length ?? 0}개</span>
        </div>

        {selectedDay && selectedDay.entries.length > 0 ? (
          <ul className="mobileCalendarAgendaList">
            {selectedDay.entries.map((entry) => (
              <li key={entry.sourceId}>
                <a href={entry.sourceUrl} rel="noreferrer" target="_blank">
                  <div className="mobileCalendarAgendaMeta">
                    <span className={`mobileCalendarAgendaStatus is-${entry.status}`}>
                      <i aria-hidden="true" />
                      {entry.statusLabel}
                    </span>
                    <span>{entry.libraryName ?? '운영 도서관 확인 필요'}</span>
                  </div>
                  <strong>{entry.title}</strong>
                  <p>{entry.period}{entry.targetGroup ? ` · ${entry.targetGroup}` : ''}</p>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mobileCalendarAgendaEmpty">선택한 날짜에 등록된 프로그램이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
