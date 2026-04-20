import { RouterProvider } from "react-router";
import { AuthProvider, useAuth } from "./auth";
import { PreferencesProvider } from "./preferences";
import { router } from "./routes";

function AppShell() {
  const { authState, loading } = useAuth();

  if (loading && !authState) {
    return <RouterProvider router={router} />;
  }

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <AppShell />
      </PreferencesProvider>
    </AuthProvider>
  );
}
