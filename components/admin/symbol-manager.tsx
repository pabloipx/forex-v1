"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { OTCSymbol } from "@/lib/types"

interface SymbolManagerProps {
  symbols: OTCSymbol[]
  onUpdate: () => void
}

export function SymbolManager({ symbols, onUpdate }: SymbolManagerProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [volatility, setVolatility] = useState<number>(0)

  const handleUpdateVolatility = async (symbolId: string) => {
    try {
      const response = await fetch("/api/admin/symbols", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: symbolId, volatility }),
      })

      if (response.ok) {
        setEditing(null)
        onUpdate()
      }
    } catch (error) {
      console.error("[v0] Failed to update symbol:", error)
    }
  }

  const handleToggleActive = async (symbolId: string, currentStatus: boolean) => {
    try {
      const response = await fetch("/api/admin/symbols", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: symbolId, is_active: !currentStatus }),
      })

      if (response.ok) {
        onUpdate()
      }
    } catch (error) {
      console.error("[v0] Failed to toggle symbol:", error)
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="text-white">OTC Symbols</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {symbols.map((symbol) => (
          <div key={symbol.id} className="bg-zinc-800 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="font-semibold text-white">{symbol.name}</div>
                <div className="text-sm text-zinc-400">{symbol.symbol}</div>
                <div className="text-sm text-zinc-400">Base: {symbol.base_price.toFixed(5)}</div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={symbol.is_active ? "default" : "outline"}
                  onClick={() => handleToggleActive(symbol.id, symbol.is_active)}
                  className={
                    symbol.is_active
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "border-zinc-700 hover:bg-zinc-700 bg-transparent"
                  }
                >
                  {symbol.is_active ? "Active" : "Inactive"}
                </Button>
              </div>
            </div>

            {editing === symbol.id ? (
              <div className="mt-4 space-y-2">
                <Label className="text-zinc-300">Volatility</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={volatility}
                  onChange={(e) => setVolatility(Number(e.target.value))}
                  className="bg-zinc-700 border-zinc-600 text-white"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleUpdateVolatility(symbol.id)} className="bg-emerald-600">
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(null)}
                    className="border-zinc-700 bg-transparent"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex justify-between items-center">
                <span className="text-sm text-zinc-400">Volatility: {symbol.volatility.toFixed(4)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(symbol.id)
                    setVolatility(symbol.volatility)
                  }}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-700"
                >
                  Edit
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
