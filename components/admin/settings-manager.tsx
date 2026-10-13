"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Setting {
  id: string
  setting_key: string
  setting_value: any
  description: string
}

interface SettingsManagerProps {
  settings: Setting[]
  onUpdate: () => void
}

export function SettingsManager({ settings, onUpdate }: SettingsManagerProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState<any>(null)

  const handleUpdate = async (settingKey: string) => {
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting_key: settingKey, setting_value: value }),
      })

      if (response.ok) {
        setEditing(null)
        onUpdate()
      }
    } catch (error) {
      console.error("[v0] Failed to update setting:", error)
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="text-white">System Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {settings.map((setting) => (
          <div key={setting.id} className="bg-zinc-800 rounded-lg p-4">
            <div className="space-y-2">
              <div className="font-semibold text-white">{setting.setting_key}</div>
              <div className="text-sm text-zinc-400">{setting.description}</div>

              {editing === setting.setting_key ? (
                <div className="space-y-2 mt-3">
                  <Label className="text-zinc-300">Value</Label>
                  <Input
                    type="text"
                    value={JSON.stringify(value)}
                    onChange={(e) => {
                      try {
                        setValue(JSON.parse(e.target.value))
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    className="bg-zinc-700 border-zinc-600 text-white font-mono text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(setting.setting_key)} className="bg-emerald-600">
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
                  <span className="text-sm text-white font-mono">{JSON.stringify(setting.setting_value)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(setting.setting_key)
                      setValue(setting.setting_value)
                    }}
                    className="text-zinc-400 hover:text-white hover:bg-zinc-700"
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
