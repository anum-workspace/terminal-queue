import React from "react";
import Navbar from "./layout/Navbar";
import MainLayout from "./layout/MainLayout";

export default function App() {
    return (
        <div className="flex h-screen flex-col bg-gray-950 text-gray-300">
            <Navbar />
            <MainLayout />
        </div>
    );
}
