# VPN Setup Guide

Simple VPN configuration for Downloadarr using a single OpenVPN config file.

## Quick Setup

1. **Get your VPN config file** from your VPN provider
2. **Copy it to the project root** as `config.ovpn`
3. **Create credentials file** (if your VPN requires username/password):
   ```bash
   cp credentials.txt.example credentials.txt
   # Edit credentials.txt with your VPN username and password
   ```
4. **Start with VPN enabled**:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.vpn.yml up -d
   ```

## Configuration File

Place your OpenVPN configuration file in the project root as `config.ovpn`.

### Example structure:
```
downloadarr/
├── config.ovpn          # Your VPN config (not tracked by git)
├── config.ovpn.example  # Example template
├── docker-compose.yml
├── docker-compose.vpn.yml
└── ...
```

## Supported VPN Providers

Most OpenVPN-compatible providers work out of the box:

- **NordVPN** - Download config from your account dashboard
- **ExpressVPN** - Get OpenVPN config from setup page
- **Surfshark** - Download from manual setup section
- **ProtonVPN** - Get config from account downloads
- **Private Internet Access (PIA)** - Download from client area
- **CyberGhost** - Get from manual setup section

## Authentication

If your VPN requires username/password authentication:

1. Add `auth-user-pass` to your `config.ovpn` file
2. The container will prompt for credentials on first run
3. Or create a credentials file (see advanced setup below)

## Testing

Check VPN status via the API:
```bash
curl http://localhost:3001/vpn/status
```

Should return:
```json
{
  "enabled": true,
  "connected": true,
  "publicIP": "your.vpn.ip.address",
  "containerRunning": true,
  "containerHealthy": true,
  "message": "VPN container running and network connected"
}
```

## Advanced Setup

### Credentials File (Optional)

For automatic authentication, create `credentials.txt` in the project root:
```
your_username
your_password
```

Then update your `config.ovpn`:
```
auth-user-pass credentials.txt
```

### Custom VPN Settings

You can modify the VPN container settings in `docker-compose.vpn.yml`:

- **DNS servers**: Change the `dns` section
- **Port forwarding**: Modify the `command` section
- **Network settings**: Adjust `sysctls` if needed

## Troubleshooting

### VPN not connecting
```bash
# Check VPN container logs
docker logs downloadarr-vpn

# Common issues:
# - Invalid config file format
# - Missing authentication
# - Firewall blocking VPN ports
```

### Downloads not using VPN
```bash
# Verify aria2 is using VPN network
docker logs downloadarr-aria2-vpn

# Check VPN status
curl http://localhost:3001/vpn/status
```

### Performance issues
- Try different VPN servers from your provider
- Check if your provider supports UDP (faster than TCP)
- Ensure your config uses optimal encryption settings

## Security Notes

- ✅ `config.ovpn` is automatically excluded from git
- ✅ Never commit VPN credentials to version control
- ✅ Use strong passwords for VPN accounts
- ✅ Regularly rotate VPN servers for better privacy

## Switching Between VPN and No-VPN

**Without VPN** (direct connection):
```bash
docker-compose up -d
```

**With VPN** (routed through VPN):
```bash
docker-compose -f docker-compose.yml -f docker-compose.vpn.yml up -d
```

The system automatically handles the network routing and service configuration.
