"use client";

import { RotateCcw, Send, Sparkles } from "lucide-react";

type AdvertiserFormProps = {
  description: string;
  loading: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
  onSubmit: () => void;
};

export function AdvertiserForm({ description, loading, onChange, onReset, onSubmit }: AdvertiserFormProps) {
  const canSubmit = description.trim().length >= 4 && !loading;

  return (
    <form
      className="input-panel"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Advertiser</p>
          <h1>Campaign planner</h1>
        </div>
        <Sparkles aria-hidden="true" className="heading-icon" />
      </div>

      <label className="field-label" htmlFor="advertiser-description">
        Business description
      </label>
      <textarea
        id="advertiser-description"
        value={description}
        onChange={(event) => onChange(event.target.value)}
        placeholder="We sell premium dog food for senior dogs, targeting owners who care about joint health and longevity..."
        rows={8}
      />

      <div className="button-row">
        <button className="primary-button" type="submit" disabled={!canSubmit} title="Generate campaign">
          <Send aria-hidden="true" size={18} />
          {loading ? "Generating" : "Generate"}
        </button>
        <button className="ghost-button" type="button" onClick={onReset} disabled={loading} title="Reset form">
          <RotateCcw aria-hidden="true" size={18} />
          Reset
        </button>
      </div>
    </form>
  );
}
