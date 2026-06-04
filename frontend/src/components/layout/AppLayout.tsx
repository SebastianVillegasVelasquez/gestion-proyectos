import { Outlet } from 'react-router-dom'
// import {Sidebar} from "lucide-react";
import {Sidebar as SidebarComponent} from "@/components/layout/SideBar.tsx";

export const AppLayout = () => {
    return (
        <div style={{ display: 'flex' }}>
    <SidebarComponent/>
    <div style={{ flex: 1 }}>
    {/*<Topbar />*/}
    <main>
        <Outlet />  {/* aquí aparece DashboardPage, ProjectsPage, etc. */}
    </main>
    </div>
    </div>
)
}