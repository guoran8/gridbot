import type { Fill, Order } from "@gridbot/shared";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFills, useOrders } from "@/lib/queries";
import { fmtNum, fmtTime, fmtUsd } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

function SideBadge({ side }: { side: "buy" | "sell" }) {
  const { t } = useI18n();
  return (
    <Badge
      variant="outline"
      className={
        side === "buy"
          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
          : "bg-red-500/15 text-red-500 border-red-500/30"
      }
    >
      {t(`side.${side}`)}
    </Badge>
  );
}

export function OrdersTable({ botId }: { botId: string }) {
  const { t } = useI18n();
  const { data: orders = [] } = useOrders(botId);
  const open = orders.filter((o: Order) => o.status === "open");

  if (open.length === 0) return <Empty />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("table.side")}</TableHead>
          <TableHead>{t("table.price")}</TableHead>
          <TableHead>{t("table.size")}</TableHead>
          <TableHead>{t("table.grid")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {open.map((o) => (
          <TableRow key={o.id}>
            <TableCell>
              <SideBadge side={o.side} />
            </TableCell>
            <TableCell className="tabular-nums">{fmtUsd(o.price)}</TableCell>
            <TableCell className="tabular-nums">{fmtNum(o.size)}</TableCell>
            <TableCell className="text-muted-foreground">#{o.gridIndex}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function FillsTable({ botId }: { botId: string }) {
  const { t } = useI18n();
  const { data: fills = [] } = useFills(botId);

  if (fills.length === 0) return <Empty />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("table.time")}</TableHead>
          <TableHead>{t("table.side")}</TableHead>
          <TableHead>{t("table.price")}</TableHead>
          <TableHead>{t("table.size")}</TableHead>
          <TableHead>{t("table.fee")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fills.map((f: Fill) => (
          <TableRow key={f.id}>
            <TableCell className="text-muted-foreground">{fmtTime(f.timestamp)}</TableCell>
            <TableCell>
              <SideBadge side={f.side} />
            </TableCell>
            <TableCell className="tabular-nums">{fmtUsd(f.price)}</TableCell>
            <TableCell className="tabular-nums">{fmtNum(f.size)}</TableCell>
            <TableCell className="tabular-nums text-muted-foreground">{fmtUsd(f.fee, 4)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Empty() {
  const { t } = useI18n();
  return <p className="py-8 text-center text-sm text-muted-foreground">{t("table.empty")}</p>;
}
