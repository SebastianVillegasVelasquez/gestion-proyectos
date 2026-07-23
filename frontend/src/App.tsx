import { Suspense } from "react";
import "./App.css";
import { AppRouter } from "@/router/AppRouter.tsx";

// Suspense de nivel superior: cubre las rutas lazy que viven FUERA del AppLayout
// (p. ej. el portal público del cliente), que no tiene su propio boundary.
const App = () => {
  return (
    <Suspense fallback={null}>
      <AppRouter />
    </Suspense>
  );
};

export default App;
