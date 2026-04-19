import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { TotalAssets } from "./pages/TotalAssets";
import { Stocks } from "./pages/Stocks";
import { Bonds } from "./pages/Bonds";
import { Gold } from "./pages/Gold";
import { MutualFunds } from "./pages/MutualFunds";
import { Banks } from "./pages/Banks";
import { Lottery } from "./pages/Lottery";
import { MarketDataLab } from "./pages/MarketDataLab";
import { Options } from "./pages/Options";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: TotalAssets },
      { path: "stocks", Component: Stocks },
      { path: "bonds", Component: Bonds },
      { path: "gold", Component: Gold },
      { path: "mutual-funds", Component: MutualFunds },
      { path: "banks", Component: Banks },
      { path: "lottery", Component: Lottery },
      { path: "options", Component: Options },
      { path: "market-data-lab", Component: MarketDataLab },
    ],
  },
]);
