import React, { useEffect, useMemo, useState } from "react";
import EditorCard from "../../components/EditorCard";
import QueueCard from "../../components/QueueCard";
import { useQueueStore } from "../../store/queueStore";
import { useTerminalStore } from "../../store/terminalStore";
import { FaPlay, FaSave } from "react-icons/fa";
import { MdCancel, MdDelete, MdQueue } from "react-icons/md";

function emptyForm(homeDir) {
    return {
        dir: homeDir,
        header: "",
        command: "",
        footer: "",
    };
}

export default function QueuePage() {
    const clear = useQueueStore((s) => s.clear);
    const run = useQueueStore((s) => s.runQueue);
    const running = useQueueStore((s) => s.running);

    const queue = useQueueStore((state) => state.queue);
    const loadQueue = useQueueStore((state) => state.loadQueue);
    const saveQueueItem = useQueueStore((state) => state.saveQueueItem);
    const deleteQueueItem = useQueueStore((state) => state.deleteQueueItem);
    const revealInDefault = useTerminalStore((state) => state.revealInDefault);

    const [managedCommands, setManagedCommands] = useState([]);
    const [selectedCommandId, setSelectedCommandId] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [homeDir, setHomeDir] = useState("~");
    const [form, setForm] = useState(emptyForm(homeDir));

    useEffect(() => {
        loadQueue();
        window.api.commands.list().then(setManagedCommands);
        window.api.system.home().then((home) => {
            setHomeDir(home);
            setForm((current) => ({
                ...current,
                dir: current.dir === "~" ? home : current.dir,
            }));
        });
    }, [loadQueue]);

    const selectedCommand = useMemo(
        () => managedCommands.find((item) => String(item.id) === selectedCommandId),
        [managedCommands, selectedCommandId],
    );

    const previewText = [form.header, form.command, form.footer].filter(Boolean).join("\n");

    function updateField(field, value) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    }

    function resetForm() {
        setEditingId(null);
        setSelectedCommandId("");
        setForm(emptyForm(homeDir));
    }

    function applyManagedCommand(commandId) {
        setSelectedCommandId(commandId);

        const nextCommand = managedCommands.find((item) => String(item.id) === commandId);
        if (!nextCommand) {
            return;
        }

        setForm((current) => ({
            ...current,
            header: nextCommand.header || "",
            command: nextCommand.command || "",
            footer: nextCommand.footer || "",
        }));
    }

    async function handleSave() {
        if (!form.command.trim()) {
            return;
        }

        await saveQueueItem(form, editingId);
        resetForm();
    }

    async function handleRunNow(payload = form) {
        if (!payload.command.trim()) {
            return;
        }

        await window.api.terminal.execute(payload);
    }

    async function handlePickDirectory() {
        const picked = await window.api.system.openDirectory(form.dir || homeDir);
        if (!picked) {
            return;
        }

        updateField("dir", picked);
        await revealInDefault(picked, previewText);
    }

    return (
        <div className="space-y-4 p-3">
            <div className="flex items-center gap-2 justify-end">
                <button
                    onClick={clear}
                    className="flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-red-500 hover:text-gray-100 cursor-pointer"
                >
                    <MdDelete className="inline-block text-lg mr-2" />
                    Clear Queue
                </button>

                <button
                    onClick={run}
                    className="flex items-center rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100 cursor-pointer"
                >
                    {running ? (
                        "Running..."
                    ) : (
                        <span className="flex items-center">
                            <FaPlay className="text-md mr-2" />
                            Run Queue
                        </span>
                    )}
                </button>
            </div>

            <EditorCard
                title={editingId ? "Edit queue item" : "Add queue item"}
                values={form}
                onChange={updateField}
                onSubmit={handleSave}
                submitLabel={
                    editingId ? (
                        <span className="flex items-center">
                            <FaSave className="text-lg mr-2" />
                            Save item
                        </span>
                    ) : (
                        <span className="flex items-center">
                            <MdQueue className="text-lg mr-2" />
                            Add to queue
                        </span>
                    )
                }
                secondaryAction={{
                    label: (
                        <span className="flex items-center">
                            <FaPlay className="text-md mr-2" />
                            Execute now
                        </span>
                    ),
                    onClick: () => handleRunNow(),
                }}
                managedCommands={managedCommands}
                selectedCommandId={selectedCommandId}
                onManagedCommandChange={applyManagedCommand}
                onUseHomeDirectory={async () => {
                    updateField("dir", homeDir);
                    await revealInDefault(homeDir, previewText);
                }}
                onPickDirectory={handlePickDirectory}
            >
                {selectedCommand ? (
                    <div className="rounded-md border border-gray-800 bg-gray-950/60 px-3 py-2 text-xs text-gray-500">
                        Loaded from: {selectedCommand.title || selectedCommand.command}
                    </div>
                ) : null}

                {editingId ? (
                    <button
                        type="button"
                        onClick={resetForm}
                        className="flex items-center rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-red-500 hover:text-gray-100"
                    >
                        <MdCancel className="text-lg mr-2" />
                        Cancel editing
                    </button>
                ) : null}
            </EditorCard>

            <div className="space-y-3">
                {queue.map((item) => (
                    <QueueCard
                        key={item.id}
                        item={item}
                        onEdit={() => {
                            setEditingId(item.id);
                            setSelectedCommandId("");
                            setForm({
                                dir: item.dir || homeDir,
                                header: item.header || "",
                                command: item.command || "",
                                footer: item.footer || "",
                            });
                            revealInDefault(item.dir || homeDir, item.command || "");
                        }}
                        onDelete={() => deleteQueueItem(item.id)}
                        onRun={() => handleRunNow(item)}
                        meta={item.timestamp}
                    />
                ))}

                {!queue.length ? (
                    <div className="rounded-lg border border-dashed border-gray-800 bg-gray-900/50 p-6 text-sm text-gray-500">
                        Queue items will appear here.
                    </div>
                ) : null}
            </div>
        </div>
    );
}
