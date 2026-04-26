import React from "react";
import { FaEdit } from "react-icons/fa";
import { FaPlay } from "react-icons/fa6";
import { MdDelete } from "react-icons/md";
export default function QueueCard({
    item,
    onEdit,
    onDelete,
    onRun,
    primaryLabel = "Run now",
    meta,
}) {
    return (
        <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate text-sm text-gray-400">{item.dir}</div>
                    <div className="mt-1 text-sm text-gray-200 whitespace-pre-wrap wrap-break-word">
                        {item.command}
                    </div>
                </div>

                <div className="rounded-full border border-gray-700 px-2 py-1 text-xs uppercase tracking-wide text-gray-400">
                    {item.status || "pending"}
                </div>
            </div>

            {meta ? <div className="mb-3 text-xs text-gray-500">{meta}</div> : null}

            <div className="flex flex-wrap items-center gap-2">
                {onRun ? (
                    <button
                        type="button"
                        onClick={onRun}
                        className="flex items-center rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                    >
                        <FaPlay className="inline-block text-lg mr-2" />
                        {primaryLabel}
                    </button>
                ) : null}

                {onEdit ? (
                    <button
                        type="button"
                        onClick={onEdit}
                        className="flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-gray-100"
                    >
                        <FaEdit className="inline-block text-lg mr-2" />
                        Edit
                    </button>
                ) : null}

                {onDelete ? (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-red-500 hover:text-red-200"
                    >
                        <MdDelete className="inline-block text-lg mr-2" />
                        Delete
                    </button>
                ) : null}
            </div>
        </div>
    );
}
