import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Download, HardDrive, Wifi, AlertCircle, Loader2 } from 'lucide-react'
import { useQueueStats, useVpnStatus, useAria2Stats } from '@/hooks/useApi'

export default function Dashboard() {
  // Fetch data using React Query hooks
  const {
    data: queueStats,
    isLoading: queueLoading,
    error: queueError
  } = useQueueStats();

  const {
    data: vpnStatus,
    isLoading: vpnLoading,
    error: vpnError
  } = useVpnStatus();

  const {
    data: aria2Stats,
    isLoading: aria2Loading,
    error: aria2Error
  } = useAria2Stats();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your download system
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Downloads
            </CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {queueLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <div className="text-2xl font-bold">--</div>
              </div>
            ) : queueError ? (
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <div className="text-2xl font-bold text-red-500">--</div>
              </div>
            ) : (
              <div className="text-2xl font-bold">{aria2Stats?.numActive || queueStats?.active || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {queueError ? 'Failed to load' : 'Currently downloading'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Queue Size
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {queueLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <div className="text-2xl font-bold">--</div>
              </div>
            ) : queueError ? (
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <div className="text-2xl font-bold text-red-500">--</div>
              </div>
            ) : (
              <div className="text-2xl font-bold">{queueStats?.waiting || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {queueError ? 'Failed to load' : 'Pending downloads'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Download Speed
            </CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {aria2Loading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <div className="text-2xl font-bold">--</div>
              </div>
            ) : aria2Error ? (
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <div className="text-2xl font-bold text-red-500">--</div>
              </div>
            ) : (
              <div className="text-2xl font-bold">
                {aria2Stats?.downloadSpeed ?
                  `${(parseInt(aria2Stats.downloadSpeed) / 1024 / 1024).toFixed(1)} MB/s` :
                  '0 MB/s'
                }
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {aria2Error ? 'Failed to load' : 'Current speed'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              VPN Status
            </CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {vpnLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <div className="text-2xl font-bold">--</div>
              </div>
            ) : vpnError ? (
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <div className="text-2xl font-bold text-red-500">Error</div>
              </div>
            ) : (
              <div className={`text-2xl font-bold ${
                vpnStatus?.connected ? 'text-green-600' :
                vpnStatus?.containerRunning ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {vpnStatus?.connected ? 'Connected' :
                 vpnStatus?.containerRunning ? 'Container Running' :
                 vpnStatus?.enabled ? 'Disconnected' : 'Disabled'}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {vpnError ? 'Failed to load' :
               vpnStatus?.publicIP ? `IP: ${vpnStatus.publicIP}` :
               vpnStatus?.message || 'Status unknown'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>
            Current download system overview
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Queue Status */}
            <div className="flex items-center space-x-4">
              <div className={`w-2 h-2 rounded-full ${
                queueStats?.active && queueStats.active > 0 ? 'bg-blue-500' : 'bg-gray-400'
              }`}></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Download Queue</p>
                <p className="text-xs text-muted-foreground">
                  {queueLoading ? 'Loading...' :
                   queueError ? 'Failed to load queue status' :
                   `${queueStats?.active || 0} active, ${queueStats?.waiting || 0} waiting, ${queueStats?.completed || 0} completed`}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">Live</div>
            </div>

            {/* VPN Status */}
            <div className="flex items-center space-x-4">
              <div className={`w-2 h-2 rounded-full ${
                vpnStatus?.connected ? 'bg-green-500' :
                vpnStatus?.containerRunning ? 'bg-yellow-500' :
                vpnStatus?.enabled ? 'bg-red-500' : 'bg-gray-400'
              }`}></div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  VPN {vpnStatus?.enabled ? 'Connection' : '(Disabled)'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {vpnLoading ? 'Checking...' :
                   vpnError ? 'Failed to check VPN status' :
                   vpnStatus?.message || 'Status unknown'}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">Live</div>
            </div>

            {/* Aria2 Status */}
            <div className="flex items-center space-x-4">
              <div className={`w-2 h-2 rounded-full ${
                aria2Stats ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <div className="flex-1">
                <p className="text-sm font-medium">Download Engine</p>
                <p className="text-xs text-muted-foreground">
                  {aria2Loading ? 'Connecting...' :
                   aria2Error ? 'Aria2 connection failed' :
                   `Connected - ${aria2Stats?.numActive || 0} active downloads`}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">Live</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
