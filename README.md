# AI Notepad

A modern, real-time notepad application built with React, TypeScript, and Convex. This project provides a collaborative note-taking experience with authentication and real-time synchronization.

## 🚀 Features

- **Real-time Collaboration**: Built on Convex for instant synchronization
- **Modern UI**: Beautiful interface using shadcn/ui components
- **Type Safety**: Full TypeScript support throughout the stack
- **Authentication**: Secure user authentication with Convex Auth
- **Responsive Design**: Optimized for desktop and mobile devices
- **Fast Development**: Hot Module Replacement with Vite

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Convex (real-time database and backend)
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **Authentication**: Convex Auth
- **Icons**: Lucide React
- **Development**: ESLint + TypeScript ESLint

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-notepad
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Set up Convex**
   ```bash
   npx convex dev
   ```

4. **Start the development server**
   ```bash
   npm run dev
   # or
   bun dev
   ```

## 🏗️ Project Structure

```
ai-notepad/
├── src/
│   ├── components/
│   │   ├── ui/          # shadcn/ui components
│   │   ├── molecules/   # Reusable component molecules
│   │   └── organism/    # Complex component organisms
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   └── model/           # Data models and types
├── convex/
│   ├── schema.ts        # Database schema
│   ├── tasks.ts         # Backend functions
│   └── _generated/      # Auto-generated Convex types
├── public/              # Static assets
└── components.json      # shadcn/ui configuration
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## 🎨 UI Components

This project uses [shadcn/ui](https://ui.shadcn.com/) for consistent, accessible components. The component library includes:

- **Layout**: Card, Sheet, Sidebar, Tabs
- **Forms**: Input, Textarea, Select, Checkbox, Radio
- **Navigation**: Breadcrumb, Menu, Navigation Menu
- **Feedback**: Toast, Alert, Dialog, Tooltip
- **Data Display**: Table, Chart, Calendar, Avatar
- **Interactive**: Button, Toggle, Switch, Slider

## 🔐 Authentication

The app uses Convex Auth for secure user authentication. Authentication tables are automatically included in the schema.

## 🚀 Deployment

1. **Deploy to Convex**
   ```bash
   npx convex deploy
   ```

2. **Build and deploy frontend**
   ```bash
   npm run build
   # Deploy the dist/ folder to your hosting provider
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Convex](https://convex.dev/) for the real-time backend
- [shadcn/ui](https://ui.shadcn.com/) for the beautiful component library
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Vite](https://vitejs.dev/) for the fast build tool
