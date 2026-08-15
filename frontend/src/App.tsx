import { Auth } from "./Auth"
import { DesktopAuthCallback } from "./DesktopAuthCallback"

export default function App() {
    if (window.location.pathname === "/auth/desktop-callback") {
        return <DesktopAuthCallback />
    }

    return (
        <Auth>
            <div className="p-6">
                Logged in
            </div>
        </Auth>
    )
}