import { useState, useEffect } from "react";
import { VscFolderOpened, VscHome, VscRefresh, VscWarning, VscCheck } from "react-icons/vsc";

export default function DirectoryPicker({
    value = "~",
    onChange,
    className = "",
    showValidation = true,
    placeholder = "~ (home directory)",
    label = "Directory",
}) {
    const [dirPath, setDirPath] = useState(value);
    const [dirInfo, setDirInfo] = useState(null);
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        setDirPath(value);
        if (value && showValidation) {
            validateDirectory(value);
        }
    }, [value]);

    const validateDirectory = async (path) => {
        if (!path || !showValidation) return;

        setIsValidating(true);
        setError(null);

        try {
            const info = await window.api.getDirectoryInfo(path);
            setDirInfo(info);

            if (!info.exists) {
                setError("Directory does not exist");
            } else if (!info.isDirectory) {
                setError("Not a directory");
            }
        } catch (err) {
            console.error("Error validating directory:", err);
            setError("Failed to validate directory");
        } finally {
            setIsValidating(false);
        }
    };

    const handleBrowse = async () => {
        try {
            const result = await window.api.browseAndValidate(dirPath);

            if (!result.canceled && result.valid) {
                const newPath = result.displayPath || result.path;
                setDirPath(newPath);
                setDirInfo(result);
                setError(null);
                onChange?.(newPath);
            } else if (result.error) {
                setError(result.error);
            }
        } catch (err) {
            console.error("Error browsing directory:", err);
            setError("Failed to open directory browser");
        }
    };

    const handleInputChange = (e) => {
        const newPath = e.target.value;
        setDirPath(newPath);
        onChange?.(newPath);
        setError(null);
        setDirInfo(null);
    };

    const handleSetHome = () => {
        setDirPath("~");
        onChange?.("~");
        setError(null);
        if (showValidation) {
            validateDirectory("~");
        }
    };

    const handleRefresh = () => {
        if (dirPath) {
            validateDirectory(dirPath);
        }
    };

    return (
        <div className={`space-y-1 ${className}`}>
            {label && <label className="text-xs text-gray-400 block">{label}</label>}

            <div className="flex gap-1">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={dirPath}
                        onChange={handleInputChange}
                        placeholder={placeholder}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 pr-8 text-sm text-gray-200 font-mono focus:outline-none focus:border-blue-500/50"
                    />

                    {/* Validation indicator */}
                    {showValidation && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {isValidating ? (
                                <VscRefresh className="animate-spin text-gray-400" size={14} />
                            ) : error ? (
                                <VscWarning className="text-yellow-400" size={14} title={error} />
                            ) : dirInfo?.exists && dirInfo?.isDirectory ? (
                                <VscCheck
                                    className="text-green-400"
                                    size={14}
                                    title="Directory exists"
                                />
                            ) : null}
                        </div>
                    )}
                </div>

                {/* Browse button */}
                <button
                    onClick={handleBrowse}
                    className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-300 hover:text-gray-200 transition"
                    title="Browse for directory"
                >
                    <VscFolderOpened size={16} />
                </button>

                {/* Home button */}
                <button
                    onClick={handleSetHome}
                    className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-300 hover:text-gray-200 transition"
                    title="Set to home directory"
                >
                    <VscHome size={16} />
                </button>

                {/* Refresh validation */}
                {showValidation && (
                    <button
                        onClick={handleRefresh}
                        className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-300 hover:text-gray-200 transition"
                        title="Refresh validation"
                    >
                        <VscRefresh size={16} />
                    </button>
                )}
            </div>

            {/* Directory info */}
            {showValidation && dirInfo && !error && (
                <div className="text-xs text-gray-500 flex items-center gap-2">
                    {dirInfo.exists ? (
                        <>
                            <span className="text-green-400/70">✓ Exists</span>
                            {dirInfo.fileCount !== undefined && (
                                <span>• {dirInfo.fileCount} items</span>
                            )}
                            {dirInfo.isWritable !== undefined && (
                                <span
                                    className={
                                        dirInfo.isWritable
                                            ? "text-green-400/70"
                                            : "text-yellow-400/70"
                                    }
                                >
                                    • {dirInfo.isWritable ? "Writable" : "Read-only"}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="text-yellow-400/70">Will be created when needed</span>
                    )}
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="text-xs text-red-400/80 flex items-center gap-1">
                    <VscWarning size={12} />
                    {error}
                </div>
            )}
        </div>
    );
}
