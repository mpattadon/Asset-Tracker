import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { TrendingUp, TrendingDown } from "lucide-react";
import { TradingViewChart } from "../components/charts/TradingViewChart";
import { PageContainer, SummaryCard, SummaryGrid, DataCard } from "../components/layout/index";

const bonds = [
  {
    issuer: "US Treasury",
    type: "10-Year Note",
    coupon: 4.25,
    maturity: "2034-03-15",
    faceValue: 50000,
    currentValue: 48750,
    yield: 4.52,
    change: -2.5,
  },
  {
    issuer: "Apple Inc.",
    type: "Corporate Bond",
    coupon: 3.85,
    maturity: "2028-08-20",
    faceValue: 25000,
    currentValue: 25420,
    yield: 3.45,
    change: 1.68,
  },
  {
    issuer: "Microsoft Corp.",
    type: "Corporate Bond",
    coupon: 4.10,
    maturity: "2030-02-06",
    faceValue: 30000,
    currentValue: 29880,
    yield: 4.23,
    change: -0.4,
  },
  {
    issuer: "Thai Government",
    type: "Government Bond",
    coupon: 3.50,
    maturity: "2029-06-12",
    faceValue: 20000,
    currentValue: 20150,
    yield: 3.35,
    change: 0.75,
  },
];

const yieldData = [
  { time: "2026-01-01", value: 4.2, color: "#60a5fa" },
  { time: "2026-02-01", value: 4.1, color: "#60a5fa" },
  { time: "2026-03-01", value: 4.3, color: "#60a5fa" },
  { time: "2026-04-01", value: 4.4, color: "#60a5fa" },
  { time: "2026-05-01", value: 4.3, color: "#60a5fa" },
  { time: "2026-06-01", value: 4.5, color: "#60a5fa" },
];

export function Bonds() {
  const totalValue = bonds.reduce((sum, bond) => sum + bond.currentValue, 0);
  const totalInvested = bonds.reduce((sum, bond) => sum + bond.faceValue, 0);
  const totalReturn = ((totalValue - totalInvested) / totalInvested) * 100;

  return (
    <PageContainer>
      {/* Summary Cards */}
      <SummaryGrid columns={3}>
        <SummaryCard label="Total Bond Value" value={`$${totalValue.toLocaleString()}`} />
        <SummaryCard label="Total Invested" value={`$${totalInvested.toLocaleString()}`} />
        <SummaryCard
          label="Total Return"
          value={`${totalReturn.toFixed(2)}%`}
          icon={
            totalReturn > 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )
          }
        />
      </SummaryGrid>

      {/* Average Yield Chart */}
      <DataCard title="Average Yield Trend">
        <div className="p-4 sm:p-8">
          <TradingViewChart
            height={250}
            mode="histogram"
            histogramData={yieldData}
            valueFormatter={(value) => `${value.toFixed(2)}%`}
          />
        </div>
      </DataCard>

      {/* Bonds Portfolio Table */}
      <DataCard title="Bonds Portfolio">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium text-gray-600">Issuer</TableHead>
                <TableHead className="font-medium text-gray-600">Type</TableHead>
                <TableHead className="font-medium text-gray-600 text-right">Coupon</TableHead>
                <TableHead className="font-medium text-gray-600">Maturity</TableHead>
                <TableHead className="font-medium text-gray-600 text-right">
                  Face Value
                </TableHead>
                <TableHead className="font-medium text-gray-600 text-right">
                  Current Value
                </TableHead>
                <TableHead className="font-medium text-gray-600 text-right">Yield</TableHead>
                <TableHead className="font-medium text-gray-600 text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bonds.map((bond, index) => (
                <TableRow key={index} className="hover:bg-gray-50">
                  <TableCell className="font-medium text-gray-900">{bond.issuer}</TableCell>
                  <TableCell className="text-gray-600">{bond.type}</TableCell>
                  <TableCell className="text-right text-gray-900">
                    {bond.coupon.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-gray-600">{bond.maturity}</TableCell>
                  <TableCell className="text-right text-gray-900">
                    ${bond.faceValue.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-gray-900">
                    ${bond.currentValue.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-gray-900">
                    {bond.yield.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {bond.change > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                      <span
                        className={`font-medium ${
                          bond.change > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {bond.change > 0 ? "+" : ""}
                        {bond.change.toFixed(2)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DataCard>
    </PageContainer>
  );
}
