import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { TicketIcon, TrendingUp, TrendingDown } from "lucide-react";
import { PageContainer, SummaryCard, SummaryGrid, DataCard } from "../components/layout/index";

const lotteryTickets = [
  {
    drawDate: "2026-04-15",
    ticketNumber: "123456",
    purchasePrice: 80,
    status: "Pending",
    prize: null,
  },
  {
    drawDate: "2026-04-01",
    ticketNumber: "789012",
    purchasePrice: 80,
    status: "Lost",
    prize: 0,
  },
  {
    drawDate: "2026-03-15",
    ticketNumber: "345678",
    purchasePrice: 80,
    status: "Won",
    prize: 2000,
  },
  {
    drawDate: "2026-03-01",
    ticketNumber: "901234",
    purchasePrice: 80,
    status: "Won",
    prize: 4000,
  },
  {
    drawDate: "2026-02-15",
    ticketNumber: "567890",
    purchasePrice: 80,
    status: "Lost",
    prize: 0,
  },
  {
    drawDate: "2026-02-01",
    ticketNumber: "234567",
    purchasePrice: 80,
    status: "Lost",
    prize: 0,
  },
];

export function Lottery() {
  const totalInvested = lotteryTickets.reduce((sum, ticket) => sum + ticket.purchasePrice, 0);
  const totalWinnings = lotteryTickets.reduce((sum, ticket) => sum + (ticket.prize || 0), 0);
  const netProfit = totalWinnings - totalInvested;
  const pendingTickets = lotteryTickets.filter((t) => t.status === "Pending").length;

  return (
    <PageContainer>
      {/* Summary Cards */}
      <SummaryGrid columns={4}>
        <SummaryCard label="Total Tickets" value={lotteryTickets.length} />
        <SummaryCard label="Total Invested" value={`฿${totalInvested.toLocaleString()}`} />
        <SummaryCard label="Total Winnings" value={`฿${totalWinnings.toLocaleString()}`} />
        <SummaryCard
          label="Net Profit/Loss"
          value={`${netProfit >= 0 ? "+" : ""}฿${netProfit.toLocaleString()}`}
          icon={
            netProfit >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )
          }
        />
      </SummaryGrid>

      {/* Lottery Tickets Table */}
      <DataCard title="Lottery Tickets">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium text-gray-600">Draw Date</TableHead>
                <TableHead className="font-medium text-gray-600">Ticket Number</TableHead>
                <TableHead className="font-medium text-gray-600 text-right">
                  Purchase Price
                </TableHead>
                <TableHead className="font-medium text-gray-600 text-right">Prize</TableHead>
                <TableHead className="font-medium text-gray-600">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lotteryTickets.map((ticket, index) => (
                <TableRow key={index} className="hover:bg-gray-50">
                  <TableCell className="text-gray-900">{ticket.drawDate}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TicketIcon className="w-4 h-4 text-gray-400" />
                      <span className="font-mono text-gray-900">{ticket.ticketNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-gray-900">
                    ฿{ticket.purchasePrice}
                  </TableCell>
                  <TableCell className="text-right">
                    {ticket.status === "Pending" ? (
                      <span className="text-gray-400">-</span>
                    ) : ticket.prize && ticket.prize > 0 ? (
                      <span className="text-green-600 font-medium">
                        ฿{ticket.prize.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-gray-400">฿0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={ticket.status === "Won" ? "default" : "outline"}
                      className={
                        ticket.status === "Won"
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : ticket.status === "Pending"
                          ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                      }
                    >
                      {ticket.status}
                    </Badge>
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
