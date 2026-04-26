import React from "react";
export default function Dropdown({ value, onChange, options = [], className = "", ...props }) {
    return (
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={`w-full rounded-md border border-gray-700 bg-gray-800/80 px-3 py-2 text-sm text-gray-300 outline-none transition focus:border-gray-500 ${className}`}
            {...props}
        >
            {options.map((option) => {
                const normalized = typeof option === "string"
                    ? { label: option, value: option }
                    : option;

                return (
                    <option key={normalized.value} value={normalized.value}>
                        {normalized.label}
                    </option>
                );
            })}
        </select>
    );
}
