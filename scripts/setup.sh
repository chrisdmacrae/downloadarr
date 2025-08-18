#!/bin/bash

# Downloadarr Setup Script
echo "🚀 Setting up Downloadarr development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before starting services"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p downloads
mkdir -p vpn-configs

# Set permissions for downloads directory
chmod 755 downloads

echo "✅ Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Place VPN config files in vpn-configs/ directory (optional)"
echo "3. Run 'npm run dev' for development"
echo "4. Run 'docker-compose up -d' for production"
echo ""
echo "Services will be available at:"
echo "- Frontend: http://localhost:3000"
echo "- API: http://localhost:3001"
echo "- API Docs: http://localhost:3001/api"
echo "- Jackett: http://localhost:9117"
echo "- AriaNG: http://localhost:6880"
