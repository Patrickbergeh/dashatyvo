"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPoint = {
  date: string;
  spend: number;
  revenue: number;
};

export function SpendChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-fg">Gasto x Receita</h3>
          <p className="text-xs text-muted">Evolução no período selecionado</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="flex items-center gap-1.5 text-muted">
            <i className="h-2.5 w-2.5 rounded-full bg-brand" /> Gasto
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            <i className="h-2.5 w-2.5 rounded-full bg-positive" /> Receita
          </span>
        </div>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--positive))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="rgb(var(--positive))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "rgb(var(--muted))", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "rgb(var(--muted))", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "rgb(var(--elevated))",
                border: "1px solid rgb(var(--line))",
                borderRadius: 12,
                color: "rgb(var(--fg))",
                fontSize: 12,
              }}
              formatter={(v: number, name) => [
                `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                name === "spend" ? "Gasto" : "Receita",
              ]}
            />
            <Area type="monotone" dataKey="revenue" stroke="rgb(var(--positive))" strokeWidth={2} fill="url(#gRev)" />
            <Area type="monotone" dataKey="spend" stroke="rgb(var(--brand))" strokeWidth={2} fill="url(#gSpend)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
