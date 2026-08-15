import { Routes, Route } from "react-router"

import { Auth } from "./Auth"
import { DesktopAuthCallback } from "./DesktopAuthCallback"

function Home() {
    return (
        <Auth>
            <div className="p-6">
                Logged in
            </div>
        </Auth>
    )
}

export default function App() {
    return (
        <Routes>
            <Route
                path="/"
                element={<Home />}
            />

            <Route
                path="/auth/desktop-callback"
                element={<DesktopAuthCallback />}
            />
        </Routes>
    )
}