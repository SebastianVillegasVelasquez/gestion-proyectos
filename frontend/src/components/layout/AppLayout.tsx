import { Outlet } from 'react-router-dom'
import {Sidebar} from "lucide-react";

export const AppLayout = () => {
    return (
        <div style={{ display: 'flex' }}>
    <Sidebar />
    <div style={{ flex: 1 }}>
    {/*<Topbar />*/}
    <main>
        <Outlet />  {/* aquí aparece DashboardPage, ProjectsPage, etc. */}
    </main>
    </div>
    </div>
)
}