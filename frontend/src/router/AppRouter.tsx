import {Route, Routes} from "react-router";
import LoginPage from "@/features/auth/components/Login.tsx";
import {TestComponent} from "@/features/auth/components/TestComponent.tsx";
import {AppLayout} from "@/components/layout/AppLayout.tsx";

export const AppRouter = () => (
    <Routes>
        {/* Rutas públicas */}
        <Route path={"/login"} element={<LoginPage/>}/>
        <Route element={<AppLayout/>}>
            <Route path={"/test"} element={<TestComponent/>}/>
        </Route>
        {/*<Route path="/portal/:projectId" element={<ClientPortalPage />} />*/}


        {/*<Route path="*" element={<Navigate to="/dashboard" replace/>}/>*/}
    </Routes>
)
