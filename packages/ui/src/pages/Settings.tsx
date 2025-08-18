import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your download preferences and system settings
        </p>
      </div>

      <div className="grid gap-6">
        {/* VPN Settings */}
        <Card>
          <CardHeader>
            <CardTitle>VPN Configuration</CardTitle>
            <CardDescription>
              Manage your VPN connection for secure downloading
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable VPN</p>
                <p className="text-sm text-muted-foreground">
                  Use VPN for all downloads
                </p>
              </div>
              <Switch />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">VPN Config Path</label>
              <input
                type="text"
                placeholder="/path/to/config.ovpn"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline">Test Connection</Button>
              <Button>Save VPN Settings</Button>
            </div>
          </CardContent>
        </Card>

        {/* Download Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Download Configuration</CardTitle>
            <CardDescription>
              Configure download paths and behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Download Directory</label>
              <input
                type="text"
                placeholder="/downloads"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Concurrent Downloads</label>
              <input
                type="number"
                placeholder="3"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto-start Downloads</p>
                <p className="text-sm text-muted-foreground">
                  Automatically start downloads when added to queue
                </p>
              </div>
              <Switch />
            </div>
            
            <Button>Save Download Settings</Button>
          </CardContent>
        </Card>

        {/* Jackett Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Jackett Integration</CardTitle>
            <CardDescription>
              Configure Jackett for torrent search
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Jackett URL</label>
              <input
                type="text"
                placeholder="http://localhost:9117"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <input
                type="password"
                placeholder="Enter Jackett API key"
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline">Test Connection</Button>
              <Button>Save Jackett Settings</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
