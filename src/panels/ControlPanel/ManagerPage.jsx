import React, { useEffect, useState } from "react";
import Dropdown from "../../components/Dropdown";
import { MdDelete } from "react-icons/md";
import { FaSave } from "react-icons/fa";

function emptyForm() {
    return {
        title: "",
        group_name: "All Commands",
        header: "",
        command: "",
        footer: "",
    };
}

const inputClassName =
    "w-full rounded-md border border-gray-700 bg-gray-800/80 px-3 py-2 text-sm text-gray-300 outline-none transition focus:border-gray-500";

export default function ManagerPage() {
    const [commands, setCommands] = useState([]);
    const [groups, setGroups] = useState(["All Commands"]);
    const [filterGroup, setFilterGroup] = useState("All Commands");
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);

    async function loadData(groupName = filterGroup) {
        const [commandItems, groupItems] = await Promise.all([
            window.api.commands.list(groupName),
            window.api.commands.groups(),
        ]);

        setCommands(commandItems);
        setGroups(groupItems);
    }

    useEffect(() => {
        loadData();
    }, [filterGroup]);

    function updateField(field, value) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    }

    function resetForm() {
        setEditingId(null);
        setForm(emptyForm());
    }

    async function handleSave() {
        if (!form.command.trim()) {
            return;
        }

        await window.api.commands.save({
            ...form,
            id: editingId,
        });

        await loadData();
        resetForm();
    }

    return (
        <div className="space-y-4 p-3">
            <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-gray-200">
                        {editingId ? "Edit managed command" : "Add managed command"}
                    </h2>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-red-500 hover:text-gray-100 cursor-pointer"
                        >
                            <MdDelete className="text-lg mr-2"/>
                            Discard
                        </button>

                        <button
                            type="button"
                            onClick={handleSave}
                            className="flex items-center rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-green-400 cursor-pointer"
                        >
                            <FaSave className="text-lg mr-2"/>
                            Save
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="flex flex-col gap-2 text-sm text-gray-400">
                        <span>Group</span>
                        <input
                            value={form.group_name}
                            onChange={(event) => updateField("group_name", event.target.value)}
                            className={inputClassName}
                            placeholder="All Commands"
                        />
                    </label>

                    <label className="flex flex-col gap-2 text-sm text-gray-400">
                        <span>Title</span>
                        <input
                            value={form.title}
                            onChange={(event) => updateField("title", event.target.value)}
                            className={inputClassName}
                            placeholder="Name shown in the queue page"
                        />
                    </label>

                    <label className="flex flex-col gap-2 text-sm text-gray-400">
                        <span>Header command</span>
                        <textarea
                            value={form.header}
                            onChange={(event) => updateField("header", event.target.value)}
                            className={`${inputClassName} min-h-20 resize-y`}
                        />
                    </label>

                    <label className="flex flex-col gap-2 text-sm text-gray-400">
                        <span>Command</span>
                        <textarea
                            value={form.command}
                            onChange={(event) => updateField("command", event.target.value)}
                            className={`${inputClassName} min-h-28 resize-y`}
                        />
                    </label>

                    <label className="flex flex-col gap-2 text-sm text-gray-400">
                        <span>Footer command</span>
                        <textarea
                            value={form.footer}
                            onChange={(event) => updateField("footer", event.target.value)}
                            className={`${inputClassName} min-h-20 resize-y`}
                        />
                    </label>
                </div>
            </div>

            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-300">Saved commands</h3>
                <div className="w-56">
                    <Dropdown value={filterGroup} onChange={setFilterGroup} options={groups} />
                </div>
            </div>

            <div className="space-y-3">
                {commands.map((item) => (
                    <div key={item.id} className="rounded-lg border border-gray-800 bg-gray-900/70 p-4">
                        <div className="mb-2 flex items-start justify-between gap-3">
                            <div>
                                <div className="text-sm font-medium text-gray-200">
                                    {item.title || item.command}
                                </div>
                                <div className="text-xs text-gray-500">{item.group_name}</div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingId(item.id);
                                        setForm({
                                            title: item.title || "",
                                            group_name: item.group_name || "All Commands",
                                            header: item.header || "",
                                            command: item.command || "",
                                            footer: item.footer || "",
                                        });
                                    }}
                                    className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-gray-100"
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    onClick={async () => {
                                        await window.api.commands.delete(item.id);
                                        await loadData();
                                    }}
                                    className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-red-500 hover:text-red-200"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>

                        <div className="whitespace-pre-wrap break-words text-sm text-gray-400">
                            {item.command}
                        </div>
                    </div>
                ))}

                {!commands.length ? (
                    <div className="rounded-lg border border-dashed border-gray-800 bg-gray-900/50 p-6 text-sm text-gray-500">
                        Saved commands will appear here.
                    </div>
                ) : null}
            </div>
        </div>
    );
}
