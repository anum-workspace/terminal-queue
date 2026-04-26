import React, { useEffect, useState } from "react";
import EditorCard from "../../components/EditorCard";
import QueueCard from "../../components/QueueCard";
import { MdDelete } from "react-icons/md";

function emptyForm() {
    return {
        dir: "~",
        header: "",
        command: "",
        footer: "",
        delay: 0,
    };
}

export default function StartupPage() {
    const [items, setItems] = useState([]);
    const [managedCommands, setManagedCommands] = useState([]);
    const [selectedCommandId, setSelectedCommandId] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);

    async function loadData() {
        const [startupItems, commandItems] = await Promise.all([
            window.api.startup.list(),
            window.api.commands.list(),
        ]);

        setItems(startupItems);
        setManagedCommands(commandItems);
    }

    useEffect(() => {
        loadData();
    }, []);

    function updateField(field, value) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    }

    function resetForm() {
        setEditingId(null);
        setSelectedCommandId("");
        setForm(emptyForm());
    }

    function applyManagedCommand(commandId) {
        setSelectedCommandId(commandId);
        const match = managedCommands.find((item) => String(item.id) === commandId);

        if (!match) {
            return;
        }

        setForm((current) => ({
            ...current,
            header: match.header || "",
            command: match.command || "",
            footer: match.footer || "",
        }));
    }

    async function handleSave() {
        if (!form.command.trim()) {
            return;
        }

        if (editingId) {
            await window.api.startup.update(editingId, form);
        } else {
            await window.api.startup.create(form);
        }

        await loadData();
        resetForm();
    }

    return (
        <div className="space-y-4 p-3">
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={async () => {
                        await window.api.startup.clear();
                        await loadData();
                    }}
                    className="flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-red-500 hover:text-gray-100 cursor-pointer"
                >
                    <MdDelete className="text-lg mr-2"/>
                    Clear startup
                </button>
            </div>

            <EditorCard
                title={editingId ? "Edit startup item" : "Add startup item"}
                values={form}
                onChange={updateField}
                onSubmit={handleSave}
                submitLabel={editingId ? "Save startup item" : "Add startup item"}
                secondaryAction={{ label: "Run startup queue", onClick: () => window.api.startup.run() }}
                managedCommands={managedCommands}
                selectedCommandId={selectedCommandId}
                onManagedCommandChange={applyManagedCommand}
            >
                <label className="flex flex-col gap-2 text-sm text-gray-400">
                    <span>Delay (seconds)</span>
                    <input
                        type="number"
                        min="0"
                        value={form.delay}
                        onChange={(event) => updateField("delay", event.target.value)}
                        className="w-full rounded-md border border-gray-700 bg-gray-800/80 px-3 py-2 text-sm text-gray-300 outline-none transition focus:border-gray-500"
                    />
                </label>

                {editingId ? (
                    <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-gray-100"
                    >
                        Cancel editing
                    </button>
                ) : null}
            </EditorCard>

            <div className="space-y-3">
                {items.map((item) => (
                    <QueueCard
                        key={item.id}
                        item={item}
                        onEdit={() => {
                            setEditingId(item.id);
                            setSelectedCommandId("");
                            setForm({
                                dir: item.dir || "~",
                                header: item.header || "",
                                command: item.command || "",
                                footer: item.footer || "",
                                delay: item.delay || 0,
                            });
                        }}
                        onDelete={async () => {
                            await window.api.startup.delete(item.id);
                            await loadData();
                        }}
                        onRun={() => window.api.terminal.execute(item)}
                        meta={`Delay: ${item.delay || 0}s`}
                    />
                ))}

                {!items.length ? (
                    <div className="rounded-lg border border-dashed border-gray-800 bg-gray-900/50 p-6 text-sm text-gray-500">
                        Startup items will appear here.
                    </div>
                ) : null}
            </div>
        </div>
    );
}
