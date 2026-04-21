import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useRouteError } from "react-router";

function extractMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Something went wrong while rendering this page.";
}

export function AppRouteErrorBoundary() {
  const error = useRouteError();
  const message = extractMessage(error);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12">
        <Card className="w-full border-red-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-normal text-gray-900">Unexpected Application Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-600">
            <p>{message}</p>
            <div className="flex gap-3">
              <Button type="button" onClick={() => window.location.reload()}>
                Reload
              </Button>
              <Button type="button" variant="outline" onClick={() => (window.location.href = "/")}>
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
