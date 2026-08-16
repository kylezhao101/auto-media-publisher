import { Routes, Route } from "react-router"

import { Auth } from "./Auth"
import { DesktopAuthCallback } from "./DesktopAuthCallback"
import { InvitePage } from "./InvitePage"


function Home() {
    return (
        <Auth>
            <div className="p-6">
                Logged in
            </div>
        </Auth>
    )
}


function Invite() {
    return (
        <Auth>
            <InvitePage />
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
                path="/invite"
                element={<Invite />}
            />

            <Route
                path="/auth/desktop-callback"
                element={<DesktopAuthCallback />}
            />
        </Routes>
    )
}