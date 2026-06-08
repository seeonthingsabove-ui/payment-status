import React from "react";

export const formatINR = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n));
};

const accent = {
  stuck: { dot: "#A16207", line: "border-t-[#A16207]" },
  pending: { dot: "#0A0A0A", line: "border-t-[#0A0A0A]" },
  recovered: { dot: "#15803D", line: "border-t-[#15803D]" },
  lost: { dot: "#B91C1C", line: "border-t-[#B91C1C]" },
};

export const StatCard = ({ label, value, sublabel, type = "stuck", testid }) => {
  const a = accent[type] || accent.stuck;
  return (
    <div
      data-testid={testid}
      className={`bg-white border border-[#E5E5E5] border-t-2 ${a.line} p-6 transition-colors duration-200 hover:border-[#0A0A0A]`}
    >
      <div className="flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: a.dot }} />
        <span className="label-caps text-[#737373]">{label}</span>
      </div>
      <div className="mt-4 font-display text-3xl md:text-4xl font-black text-[#0A0A0A] tracking-tighter break-words">
        {value}
      </div>
      {sublabel ? (
        <div className="mt-1 text-xs text-[#737373]">{sublabel}</div>
      ) : null}
    </div>
  );
};

export default StatCard;
