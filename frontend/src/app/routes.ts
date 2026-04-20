import { createElement } from "react";
import { Navigate, createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { TotalAssets } from "./pages/TotalAssets";
import { Stocks } from "./pages/Stocks";
import { Bonds } from "./pages/Bonds";
import { Gold } from "./pages/Gold";
import { MutualFunds } from "./pages/MutualFunds";
import { Banks } from "./pages/Banks";
import { Lottery } from "./pages/Lottery";
import { Options } from "./pages/Options";

function RedirectToStocks() {
  return createElement(Navigate, { to: "/stocks", replace: true });
}

function RedirectToHome() {
  return createElement(Navigate, { to: "/", replace: true });
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: TotalAssets },
      { path: "stocks", Component: Stocks },
      { path: "market-data-lab", Component: RedirectToStocks },
      { path: "bonds", Component: Bonds },
      { path: "gold", Component: Gold },
      { path: "mutual-funds", Component: MutualFunds },
      { path: "banks", Component: Banks },
      { path: "lottery", Component: Lottery },
      { path: "options", Component: Options },
      { path: "*", Component: RedirectToHome },
    ],
  },
]);
