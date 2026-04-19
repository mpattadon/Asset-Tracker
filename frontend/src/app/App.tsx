import { RouterProvider } from "react-router";
import { AuthProvider, useAuth } from "./auth";
import { AuthScreen } from "./components/AuthScreen";
import { router } from "./routes";

function AppShell() {
  const { authState, loading } = useAuth();

  if (loading && !authState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading workspace...
      </div>
    );
  }

  if (!authState?.authenticated) {
    return <AuthScreen />;
  }

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
