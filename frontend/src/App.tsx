import { Suspense } from "react";
import "./App.css";
import { AppRouter } from "@/router/AppRouter.tsx";
import { SpinnerScreen } from "@/components/common/Spinner";

// Suspense de nivel superior: cubre las rutas lazy que viven FUERA del AppLayout
// (p. ej. el portal público del cliente), que no tiene su propio boundary. El
// fallback se ve: con `null` la pantalla quedaba en blanco mientras descargaba
// el chunk, indistinguible de una app colgada.
const App = () => {
  return (
    <Suspense fallback={<SpinnerScreen />}>
      <AppRouter />
    </Suspense>
  );
};

export default App;
