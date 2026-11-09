"use client";

import { FEEDBACK_TOPIC_IDS, type FeedbackTopicId } from "@/lib/feedback-topics";
import type { Messages } from "@/lib/i18n";

type Props = {
  selected: FeedbackTopicId[];
  onToggle: (topic: FeedbackTopicId) => void;
  messages: Messages;
  disabled?: boolean;
};

/**
 * Multi-select improvement topics. Large touch targets, clear pressed state.
 */
export function TopicChips({ selected, onToggle, messages, disabled }: Props) {
  return (
    <div
      role="group"
      aria-label={messages.improveHeading}
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {FEEDBACK_TOPIC_IDS.map((id, index) => {
        const isOn = selected.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={isOn}
            disabled={disabled}
            onClick={() => onToggle(id)}
            className={`chip pressable chip-enter min-h-12 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-left text-[0.875rem] font-medium leading-snug ${
              isOn ? "chip--selected" : ""
            }`}
            style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
          >
            {messages.topics[id]}
          </button>
        );
      })}
    </div>
  );
}
