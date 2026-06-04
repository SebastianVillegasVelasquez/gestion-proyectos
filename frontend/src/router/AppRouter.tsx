import {Navigate, Route, Routes} from "react-router";
// import LoginPage from "@/features/auth/components/Login.tsx";
import {AppLayout} from "@/components/layout/AppLayout.tsx";
import {Dashboard} from "@/features/identity/components/Dashboard.tsx";
// import {AppLayout} from "@/components/layout/AppLayout.tsx";

export const AppRouter = () => (
    <Routes>
        {/* Rutas públicas */}
        {/*<Route path={"/login"} element={<LoginPage/>}/>*/}

        <Route element={<AppLayout/>}>
            <Route path="/" element={<Dashboard />} />
            {/*<Route path="/portal/:projectId" element={<Dashboard />} />*/}
        </Route>


        <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
)
