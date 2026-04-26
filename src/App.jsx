import { Group, Panel, Separator } from "react-resizable-panels";
import Navbar from "./components/Navbar";
import ControlPanel from "./components/ControlPanel";
import TerminalPanel from "./components/TerminalPanel";

export default function App() {
    return (
        <div className="h-screen w-screen flex flex-col bg-gray-900 text-gray-200 overflow-hidden scrollbar-dark">
            <Navbar />
            <div className="flex-1 h-full">
                <Group direction="horizontal" className="h-full">
                    <Panel
                        defaultSize={50}
                        minSize={20}
                        collapsible
                        className="bg-gray-800/80 backdrop-blur border-r border-gray-700/50"
                    >
                        <ControlPanel />
                    </Panel>
                    <Separator className=" bg-gray-700/80 hover:bg-gray-500/50 transition-colors cursor-col-resize" />
                    <Panel collapsible defaultSize={50} minSize={30} className="bg-gray-900">
                        <TerminalPanel />
                    </Panel>
                </Group>
            </div>
        </div>
    );
}
