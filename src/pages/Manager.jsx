import { useEffect, useState } from 'react';
import { useCommandsStore } from '../stores/commandsStore';
import { 
  VscEdit, VscTrash, VscSave, VscDiscard, VscAdd, 
  VscChevronDown, VscChevronRight 
} from 'react-icons/vsc';

export default function Manager() {
  const { 
    managedCommands, groups, selectedGroup, 
    fetch, fetchGroups, setSelectedGroup,
    saveCommand, updateCommand, deleteCommand, addGroup 
  } = useCommandsStore();

  const [editingId, setEditingId] = useState(null);
  const [isNewCommand, setIsNewCommand] = useState(false);
  const [expandedEditor, setExpandedEditor] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const [formData, setFormData] = useState({
    group: '',
    header: '',
    command: '',
    footer: '',
  });

  useEffect(() => {
    fetch();
    fetchGroups();
  }, []);

  useEffect(() => {
    fetch();
  }, [selectedGroup]);

  const handleEdit = (command) => {
    setEditingId(command.id);
    setIsNewCommand(false);
    setExpandedEditor(true);
    setFormData({
      group: command.group_name,
      header: command.header || '',
      command: command.command,
      footer: command.footer || '',
    });
  };

  const handleNew = () => {
    setEditingId(null);
    setIsNewCommand(true);
    setExpandedEditor(true);
    setFormData({
      group: selectedGroup !== 'All Commands' ? selectedGroup : '',
      header: '',
      command: '',
      footer: '',
    });
  };

  const handleSave = async () => {
    if (!formData.command.trim()) return;

    const data = {
      group_name: formData.group || 'All Commands',
      header: formData.header,
      command: formData.command,
      footer: formData.footer,
    };

    if (isNewCommand) {
      await saveCommand(data);
    } else {
      await updateCommand(editingId, data);
    }

    handleDiscard();
  };

  const handleDiscard = () => {
    setEditingId(null);
    setIsNewCommand(false);
    setExpandedEditor(false);
    setFormData({ group: '', header: '', command: '', footer: '' });
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this command?')) {
      await deleteCommand(id);
    }
  };

  const handleAddGroup = async () => {
    if (newGroupName.trim()) {
      await addGroup(newGroupName.trim());
      setNewGroupName('');
      setShowAddGroup(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Group Filter */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-700/50 bg-gray-800/50">
        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none flex-1"
        >
          {groups.map((group) => (
            <option key={group} value={group}>{group}</option>
          ))}
        </select>

        <button
          onClick={() => setShowAddGroup(!showAddGroup)}
          className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition text-gray-200"
        >
          <VscAdd className="inline mr-1" size={12} />
          New Group
        </button>

        {showAddGroup && (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-200 w-32"
              onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
            />
            <button
              onClick={handleAddGroup}
              className="text-xs px-2 py-0.5 bg-green-700 hover:bg-green-600 rounded text-gray-200"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Command Editor */}
      {expandedEditor && (
        <div className="border-b border-gray-700/50 bg-gray-800/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-200">
              {isNewCommand ? 'New Command' : 'Edit Command'}
            </h3>
            <button
              onClick={() => setExpandedEditor(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              <VscChevronDown />
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Group</label>
              <select
                value={formData.group}
                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
              >
                <option value="">Select group</option>
                {groups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Header (optional)</label>
              <textarea
                value={formData.header}
                onChange={(e) => setFormData({ ...formData, header: e.target.value })}
                rows={2}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 font-mono resize-none"
                placeholder="source /usr/local/gromacs/bin/GMXRC"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Command *</label>
              <textarea
                value={formData.command}
                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                rows={3}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 font-mono resize-none"
                placeholder="gmx mdrun -s topol.tpr"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Footer (optional)</label>
              <textarea
                value={formData.footer}
                onChange={(e) => setFormData({ ...formData, footer: e.target.value })}
                rows={2}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 font-mono resize-none"
                placeholder="echo 'Simulation complete'"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm text-gray-200 transition"
            >
              <VscSave size={14} />
              Save
            </button>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition"
            >
              <VscDiscard size={14} />
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Add New Button */}
      {!expandedEditor && (
        <button
          onClick={handleNew}
          className="m-2 flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-750 border border-gray-600/50 rounded-lg text-sm text-gray-300 hover:text-gray-200 transition"
        >
          <VscAdd size={16} />
          <span>Add New Command</span>
        </button>
      )}

      {/* Saved Commands List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {managedCommands.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
            {selectedGroup === 'All Commands' 
              ? 'No commands saved yet' 
              : `No commands in ${selectedGroup}`}
          </div>
        ) : (
          managedCommands.map((cmd) => (
            <div
              key={cmd.id}
              className={`bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 hover:border-gray-600/50 transition ${
                editingId === cmd.id ? 'ring-1 ring-blue-500/50' : ''
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-gray-700/50 rounded text-gray-400">
                        {cmd.group_name}
                      </span>
                    </div>
                    {cmd.header && (
                      <div className="text-xs text-gray-500 font-mono mb-1 truncate">
                        {cmd.header}
                      </div>
                    )}
                    <div className="text-sm text-gray-200 font-mono truncate">
                      {cmd.command}
                    </div>
                    {cmd.footer && (
                      <div className="text-xs text-gray-500 font-mono mt-1 truncate">
                        {cmd.footer}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-700/30">
                  <button
                    onClick={() => handleEdit(cmd)}
                    className="flex items-center gap-1 text-xs px-2 py-1 hover:bg-gray-700/50 rounded transition text-gray-400 hover:text-yellow-400"
                  >
                    <VscEdit size={12} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(cmd.id)}
                    className="flex items-center gap-1 text-xs px-2 py-1 hover:bg-gray-700/50 rounded transition text-gray-400 hover:text-red-400"
                  >
                    <VscTrash size={12} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}