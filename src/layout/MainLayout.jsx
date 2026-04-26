import React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import ControlPanel from "../panels/ControlPanel/ControlPanel";
import TerminalTabs from "../panels/TerminalPanel/TerminalTabs";

export default function MainLayout() {
    return (
        <div className="flex min-h-0 flex-1 bg-gray-950 text-gray-300">
            <Group direction="horizontal" className="flex-1">
                <Panel collapsible defaultSize={50}>
                    <ControlPanel />
                </Panel>

                <Separator className="w-px bg-gray-800" />

                <Panel collapsible defaultSize={50}>
                    <TerminalTabs />
                </Panel>
            </Group>
        </div>
    );
}
