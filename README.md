# 💰 Splitifyd

> **Expense Sharing Made Simple** - A serverless, account-free bill splitting web app

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Splitifyd-blue?style=for-the-badge)](https://npomfret.github.io/splitifyd/)
[![GitHub Pages](https://img.shields.io/github/deployments/npomfret/splitifyd/github-pages?label=Deployment&style=flat-square)](https://github.com/npomfret/splitifyd/deployments)
[![Version](https://img.shields.io/github/package-json/v/npomfret/splitifyd?style=flat-square)](package.json)

## ✨ Features

- 🚫 **No Account Required** - Start splitting expenses instantly
- 🌐 **Serverless Architecture** - Powered by JSONBin.io cloud storage  
- 💱 **Multi-Currency Support** - USD, EUR, GBP, JPY, and more
- 📱 **Responsive Design** - Works perfectly on mobile and desktop
- 🔄 **Real-Time Sync** - Automatic updates across all devices
- 🎨 **Modern UI** - Beautiful glass-morphism design
- 🧮 **Smart Settlements** - Optimal payment calculations
- 🔗 **Shareable Links** - Easy project sharing via URL
- 📊 **Balance Tracking** - See who owes what at a glance

## 🚀 Live Demo

**Try it now:** [splitifyd.app](https://npomfret.github.io/splitifyd/)

### Quick Start
1. Visit the demo link
2. Create a new project with your name
3. Add members and expenses
4. Share the link with friends
5. Watch balances update in real-time!

## 🎯 How It Works

1. **Create a Project** - Give it a name (e.g., "Europe Trip 2024")
2. **Add Members** - Include everyone who will share expenses  
3. **Record Expenses** - Add what was spent and who paid
4. **Smart Splitting** - Expenses are automatically divided
5. **Settle Up** - See optimized payment suggestions
6. **Share & Sync** - Everyone stays updated in real-time

## 🛠 Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 Modules)
- **Build Tool**: Vite
- **Storage**: JSONBin.io (serverless)
- **Styling**: CSS with Glass-morphism effects
- **Deployment**: GitHub Pages
- **Architecture**: Fully client-side, no backend required

## 📁 Project Structure

```
src/
├── app.js              # Main application logic
├── config/
│   └── constants.js    # Configuration and constants
├── modules/
│   ├── forms.js        # Form handling utilities
│   ├── project-cache.js # Caching layer
│   └── dom-helpers.js  # DOM manipulation helpers
├── services/
│   ├── storage.js      # JSONBin.io API integration
│   ├── project.js      # Project management
│   └── expense.js      # Expense calculations
├── ui/
│   ├── modal.js        # Modal components
│   ├── toast.js        # Notification system
│   └── sync.js         # Sync indicators
├── utils/
│   ├── currency.js     # Currency formatting
│   └── helpers.js      # Utility functions
└── styles/
    └── main.css        # Complete styling
```

## 🔧 Development

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/npomfret/splitifyd.git
cd splitifyd

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts
- `npm run dev` - Start development server (localhost:3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run deploy` - Deploy to GitHub Pages

## 🌐 Deployment

### GitHub Pages (Current)
The app automatically deploys to GitHub Pages on push to main:
```bash
npm run deploy
```

### Custom Deployment
Since this is a static app, you can deploy anywhere:
- Netlify: Drag & drop the `dist/` folder
- Vercel: Connect your GitHub repo
- Any static hosting service

## 🏗 Architecture

### Serverless Design
- **No Backend**: Everything runs in the browser
- **JSONBin.io**: Provides free JSON storage with API
- **Real-time Sync**: Polling-based updates every 5 seconds
- **Offline Ready**: Cached data for improved performance

### Data Flow
1. User creates/joins project → JSONBin.io storage
2. Local caching for fast UI updates
3. Background sync keeps all users updated
4. Conflict resolution via version timestamps

### Storage Strategy
- Projects stored as JSON documents
- Shareable via simple URLs with project IDs
- Client-side encryption possible (future enhancement)
- Local caching with 5-minute TTL

## 🎨 Design System

- **Glass-morphism**: Modern translucent design
- **Responsive**: Mobile-first approach  
- **Accessibility**: Semantic HTML and keyboard navigation
- **Performance**: Lightweight, fast loading
- **Progressive**: Enhanced experience with JavaScript

## 🤝 Contributing

Contributions are welcome! This project values clean, maintainable code.

### Development Guidelines
- Use ES6 modules and modern JavaScript
- Follow existing code style and patterns
- Write descriptive commit messages
- Test functionality across browsers

### Getting Started
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📋 Roadmap

- [ ] PWA support with offline functionality
- [ ] Client-side encryption for enhanced privacy
- [ ] Export data (CSV, PDF reports)
- [ ] Multiple currency handling in single project
- [ ] Split by percentage or custom amounts
- [ ] Receipt photo uploads
- [ ] Dark mode theme

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [JSONBin.io](https://jsonbin.io/) for free JSON storage
- [Vite](https://vitejs.dev/) for lightning-fast development
- Glass-morphism design inspiration from the community

---

<div align="center">

**[🚀 Try Splitifyd Live](https://npomfret.github.io/splitifyd/)**

Made with ❤️ for easy expense sharing

</div>