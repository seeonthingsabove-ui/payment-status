import React from "react";

const STATUS_STYLES = {
  Pending: "bg-[#FEF9C3] text-[#A16207] border-[#FEF08A]",
  Failed: "bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA]",
  Refunded: "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]",
  Lost: "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]",
};

export const StatusBadge = ({ status }) => {
  const cls = STATUS_STYLES[status] || "bg-neutral-100 text-neutral-700 border-neutral-200";
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
        style={{
          background:
            status === "Pending" ? "#A16207" :
            status === "Failed" ? "#C2410C" :
            status === "Refunded" ? "#15803D" :
            status === "Lost" ? "#B91C1C" : "#737373"
        }}
      />
      {status}
    </span>
  );
};

export default StatusBadge;
