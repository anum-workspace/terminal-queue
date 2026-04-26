import React from "react";
import Dropdown from "./Dropdown";

function Field({ label, children }) {
    return (
        <label className="flex flex-col gap-2 text-sm text-gray-400">
            <span>{label}</span>
            {children}
        </label>
    );
}

const inputClassName =
    "w-full rounded-md border border-gray-700 bg-gray-800/80 px-3 py-2 text-sm text-gray-300 outline-none transition focus:border-gray-500";

export default function EditorCard({
    title,
    values,
    onChange,
    onSubmit,
    submitLabel,
    secondaryAction,
    managedCommands = [],
    selectedCommandId = "",
    onManagedCommandChange,
    onUseHomeDirectory,
    onPickDirectory,
    children,
}) {
    return (
        <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-4 shadow-sm shadow-black/20">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
                </div>

                <div className="flex items-center gap-2">
                    {secondaryAction ? (
                        <button
                            type="button"
                            onClick={secondaryAction.onClick}
                            className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-gray-100"
                        >
                            {secondaryAction.label}
                        </button>
                    ) : null}

                    <button
                        type="button"
                        onClick={onSubmit}
                        className="rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {managedCommands.length > 0 ? (
                    <Field label="Managed command">
                        <Dropdown
                            value={selectedCommandId}
                            onChange={onManagedCommandChange}
                            options={[
                                { label: "Select saved command", value: "" },
                                ...managedCommands.map((item) => ({
                                    label: item.title || item.command,
                                    value: String(item.id),
                                })),
                            ]}
                        />
                    </Field>
                ) : null}

                <Field label="Directory">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onUseHomeDirectory}
                            className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-gray-100"
                        >
                            Home
                        </button>

                        <button
                            type="button"
                            onClick={onPickDirectory}
                            className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-gray-100"
                        >
                            Open Folder
                        </button>

                        <input
                            value={values.dir}
                            onChange={(event) => onChange("dir", event.target.value)}
                            className={inputClassName}
                            placeholder="~/"
                        />
                    </div>
                </Field>

                <Field label="Header command">
                    <textarea
                        value={values.header}
                        onChange={(event) => onChange("header", event.target.value)}
                        className={`${inputClassName} min-h-20 resize-y`}
                        placeholder="Optional setup command"
                    />
                </Field>

                <Field label="Command">
                    <textarea
                        value={values.command}
                        onChange={(event) => onChange("command", event.target.value)}
                        className={`${inputClassName} min-h-28 resize-y`}
                        placeholder="Actual command"
                    />
                </Field>

                <Field label="Footer command">
                    <textarea
                        value={values.footer}
                        onChange={(event) => onChange("footer", event.target.value)}
                        className={`${inputClassName} min-h-20 resize-y`}
                        placeholder="Optional cleanup command"
                    />
                </Field>

                {children}
            </div>
        </div>
    );
}
